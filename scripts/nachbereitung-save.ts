// Speichert eine von Claude Code erstellte Nachbereitung in Supabase (Skill /nachbereitung).
//   npx tsx scripts/nachbereitung-save.ts <notes.json> <study.json> [--dry-run]
//   npx tsx scripts/nachbereitung-save.ts --courses     (vorhandene Fächer auflisten)
// Anmeldung wie in der App (E-Mail + Passwort), Zugangsdaten in .env.local:
//   JARVIS_EMAIL=… und JARVIS_PASSWORD=…
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { matchExistingCourse } from "../src/lib/courses";
import { buildLecture, lectureCards } from "../src/lib/lectureRecords";
import { NotesSchema, parseClaudeJson, StudySchema } from "../src/lib/schema";

for (const f of [".env", ".env.local"]) if (existsSync(f)) process.loadEnvFile(f);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const files = args.filter((a) => !a.startsWith("--"));

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function login() {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key, JARVIS_EMAIL: email, JARVIS_PASSWORD: password } = process.env;
  if (!url || !key) fail("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fehlen (stehen in .env).");
  if (!email || !password) fail("JARVIS_EMAIL und JARVIS_PASSWORD fehlen. Lege sie in .env.local an (Konto wie in der App unter /konto).");
  const sb = createClient(url, key);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) fail(`Anmeldung fehlgeschlagen: ${error.message}`);
  return { sb, userId: data.user.id };
}

async function existingCourses(sb: Awaited<ReturnType<typeof login>>["sb"]) {
  const { data, error } = await sb.from("sync_items").select("data").eq("store", "lectures").eq("deleted", false);
  if (error) fail(`Fächer lesen fehlgeschlagen: ${error.message}`);
  return [...new Set(data.map((r) => (r.data as { course?: string } | null)?.course).filter((c): c is string => !!c))];
}

async function main() {
  if (args.includes("--courses")) {
    const { sb } = await login();
    console.log((await existingCourses(sb)).join("\n"));
    return;
  }
  if (files.length !== 2) fail("Aufruf: npx tsx scripts/nachbereitung-save.ts <notes.json> <study.json> [--dry-run]");
  const read = (f: string) => {
    if (!existsSync(f)) fail(`Datei nicht gefunden: ${f}`);
    return readFileSync(f, "utf8");
  };
  const notes = parseClaudeJson(read(files[0]), NotesSchema);
  if (!notes.ok) fail(`notes.json ungültig: ${notes.error}`);
  const study = parseClaudeJson(read(files[1]), StudySchema);
  if (!study.ok) fail(`study.json ungültig: ${study.error}`);

  const session = dryRun ? null : await login();
  const course = session ? matchExistingCourse(notes.data.course, await existingCourses(session.sb)) : null;
  const lecture = buildLecture(notes.data, study.data, course ?? notes.data.course);
  const cards = lectureCards(lecture);

  if (session) {
    // wie sync.ts: ein Eintrag je Datensatz in sync_items, Zeitstempel = Änderungszeit
    const now = Date.now();
    const rows = [
      { store: "lectures", id: lecture.id, data: { ...lecture, updatedAt: now } },
      ...cards.map((c) => ({ store: "cards", id: c.id, data: { ...c, updatedAt: now } })),
    ].map((r) => ({ ...r, user_id: session.userId, deleted: false, client_updated_at: now }));
    const { error } = await session.sb.from("sync_items").upsert(rows, { onConflict: "user_id,store,id" });
    if (error) fail(`Speichern fehlgeschlagen: ${error.message}`);
  }
  console.log(
    `${dryRun ? "Prüfung ok (nichts gespeichert)" : "Gespeichert"}: „${lecture.title}“, Fach „${lecture.course}“, ` +
      `${cards.length} Karteikarten, ${study.data.quiz.length} Quizfragen, ${study.data.exam_tasks.length} Klausuraufgaben. Erscheint beim nächsten Abgleich in der App.`,
  );
}

main();
