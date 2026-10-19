"use client";

// Sprachassistent: schickt den Verlauf an Gemini, führt dessen Funktionsaufrufe mit den Werkzeugen aus
// (voiceTools.ts) und wiederholt das, bis eine gesprochene Antwort kommt. Text geht gestreamt an onText,
// damit das Vorlesen schon beim ersten Satz beginnt.

import { chatTurn, type ChatTurn } from "./gemini";
import { memoryFacts, quickContext, runTool, systemPrompt, TOOL_DECLARATIONS, type ToolContext } from "./voiceTools";

export type { ChatTurn };

const MAX_ROUNDS = 6; // mehr Werkzeug-Runden braucht keine Bitte; schützt vor Endlosschleifen

type FunctionCall = { name: string; args?: Record<string, unknown>; id?: string };

export async function askJarvis(text: string, history: ChatTurn[], ctx: ToolContext, onText?: (t: string) => void) {
  const turns: ChatTurn[] = [...history, { role: "user", parts: [{ text }] }];
  const actions: string[] = [];
  let via = "";
  let said = ""; // alles, was schon gestreamt (und vorgelesen) wurde, über alle Runden
  const [facts, snap] = await Promise.all([memoryFacts(ctx.store).catch(() => []), quickContext(ctx).catch(() => "")]);
  const system = systemPrompt(ctx.now, ctx.name, facts, snap);
  let newRound = false;
  const stream = (t: string) => {
    // Text vor einem Werkzeugaufruf und Text danach nicht aneinanderkleben
    if (newRound && said && !/\s$/.test(said) && !/^\s/.test(t)) t = ` ${t}`;
    newRound = false;
    said += t;
    onText?.(t);
  };
  for (let round = 0; round < MAX_ROUNDS; round++) {
    newRound = true;
    const res = await chatTurn(turns, { system, tools: TOOL_DECLARATIONS, onText: stream });
    via = res.via;
    turns.push(res.content); // unverändert zurück, sonst fehlen Gemini die Gedanken-Signaturen
    const calls = res.content.parts.map((p) => p.functionCall as FunctionCall | undefined).filter((c): c is FunctionCall => !!c);
    if (!calls.length) return { reply: said.trim() || "Erledigt.", history: turns, via, actions };
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
