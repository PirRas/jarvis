"use client";

// Sprachassistent: schickt den Verlauf an Gemini, führt dessen Funktionsaufrufe mit den Werkzeugen aus
// (voiceTools.ts) und wiederholt das, bis eine gesprochene Antwort kommt.

import { chatTurn, type ChatTurn } from "./gemini";
import { memoryFacts, runTool, systemPrompt, TOOL_DECLARATIONS, type ToolContext } from "./voiceTools";

export type { ChatTurn };

const MAX_ROUNDS = 6; // mehr Werkzeug-Runden braucht keine Bitte; schützt vor Endlosschleifen

type FunctionCall = { name: string; args?: Record<string, unknown>; id?: string };

export async function askJarvis(text: string, history: ChatTurn[], ctx: ToolContext) {
  const turns: ChatTurn[] = [...history, { role: "user", parts: [{ text }] }];
  const actions: string[] = [];
  let via = "";
  const facts = await memoryFacts(ctx.store).catch(() => []);
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await chatTurn(turns, { system: systemPrompt(ctx.now, ctx.name, facts), tools: TOOL_DECLARATIONS });
    via = res.via;
    turns.push(res.content); // unverändert zurück, sonst fehlen Gemini die Gedanken-Signaturen
    const calls = res.content.parts.map((p) => p.functionCall as FunctionCall | undefined).filter((c): c is FunctionCall => !!c);
    if (!calls.length) {
      const reply = res.content.parts.map((p) => (typeof p.text === "string" && !p.thought ? p.text : "")).join("").trim();
      return { reply: reply || "Erledigt.", history: turns, via, actions };
    }
    const responses = [];
    for (const c of calls) {
      const result = await runTool(c.name, c.args ?? {}, ctx);
      if (!("fehler" in result)) actions.push(c.name);
      responses.push({ functionResponse: { name: c.name, response: result, ...(c.id && { id: c.id }) } });
    }
    turns.push({ role: "user", parts: responses });
  }
  return { reply: "Das wurde mir zu verschachtelt. Sag es bitte nochmal etwas einfacher.", history: turns, via, actions };
}
