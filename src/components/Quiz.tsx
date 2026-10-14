"use client";

import { useMemo, useState } from "react";
import { Md } from "@/components/Md";
import { saveQuizResult } from "@/lib/db";
import type { QuizQuestion } from "@/lib/schema";

const LETTERS = "ABCDEFGH";

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Item = { q: QuizQuestion; index: number };

export function Quiz({ lectureId, questions }: { lectureId: string; questions: QuizQuestion[] }) {
  const topics = useMemo(() => [...new Set(questions.map((q) => q.topic))], [questions]);
  const [topic, setTopic] = useState("alle");
  const [round, setRound] = useState<Item[] | null>(null);
  const [pos, setPos] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);

  function start(only?: number[]) {
    const pool = questions
      .map((q, index) => ({ q, index }))
      .filter((it) => (only ? only.includes(it.index) : topic === "alle" || it.q.topic === topic));
    setRound(shuffle(pool));
    setPos(0);
    setResults([]);
  }

  if (!round) {
    return (
      <div className="quiz">
        <div className="sheet quiz-q">
          <h2 style={{ fontSize: "var(--step-2)", marginBottom: 8 }}>Quiz</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {questions.length} Fragen in zufälliger Reihenfolge. Bei offenen Fragen vergleichst du deine Antwort mit der
            Musterlösung.
          </p>
          <div className="row" style={{ marginTop: 16 }}>
            <label className="field" style={{ minWidth: 240 }}>
              Thema
              <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="alle">Alle Themen</option>
                {topics.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => start()}>
            Quiz starten
          </button>
        </div>
      </div>
    );
  }

  if (pos >= round.length) {
    const right = results.filter(Boolean).length;
    const wrong = round.filter((_, i) => !results[i]).map((it) => it.index);
    return (
      <div className="quiz">
        <div className="sheet quiz-q">
          <div className="score">
            {right} / {round.length}
          </div>
          <p className="muted">
            {right === round.length
              ? "Alles richtig. Dieser Stoff sitzt."
              : `${round.length - right} ${round.length - right === 1 ? "Frage" : "Fragen"} noch einmal ansehen.`}
          </p>
          <div className="row" style={{ marginTop: 16 }}>
            {wrong.length > 0 && (
              <button className="btn btn-primary" onClick={() => start(wrong)}>
                Falsche Fragen wiederholen
              </button>
            )}
            <button className="btn" onClick={() => start()}>
              Neue Runde
            </button>
            <button className="btn btn-quiet" onClick={() => setRound(null)}>
              Themen wählen
            </button>
          </div>
        </div>
      </div>
    );
  }

  const item = round[pos];
  return (
    <div className="quiz">
      <div className="quiz-head">
        <span className="muted small">
          Frage {pos + 1} von {round.length}
        </span>
        <span className="row">
          <span className="pill">{item.q.topic}</span>
          <span className="pill">{item.q.difficulty}</span>
        </span>
      </div>
      <div className="bar" style={{ marginBottom: 16 }}>
        <span style={{ width: `${(pos / round.length) * 100}%` }} />
      </div>
      <Question
        key={`${pos}-${item.index}`}
        q={item.q}
        onAnswered={(ok) => {
          setResults((r) => [...r, ok]);
          saveQuizResult({ id: `${lectureId}:${item.index}`, lectureId, correct: ok, answeredAt: Date.now() });
        }}
        onNext={() => setPos((p) => p + 1)}
      />
    </div>
  );
}

function Question({
  q,
  onAnswered,
  onNext,
}: {
  q: QuizQuestion;
  onAnswered: (ok: boolean) => void;
  onNext: () => void;
}) {
  const [picked, setPicked] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [answer, setAnswer] = useState("");
  const [selfVerdict, setSelfVerdict] = useState<boolean | null>(null);

  const correctSet = new Set(q.correct);
  const isOk = picked.length === q.correct.length && picked.every((i) => correctSet.has(i));

  function toggle(i: number) {
    if (checked) return;
    if (q.kind === "single") setPicked([i]);
    else setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  }

  function check() {
    setChecked(true);
    onAnswered(isOk);
  }

  function selfGrade(ok: boolean) {
    setSelfVerdict(ok);
    onAnswered(ok);
  }

  return (
    <div className="sheet quiz-q">
      <div className="quiz-question">
        <Md>{q.question}</Md>
        {q.kind === "multi" && <p className="muted small">Mehrere Antworten können richtig sein.</p>}
      </div>

      {q.kind !== "open" ? (
        <div className="options" role={q.kind === "single" ? "radiogroup" : "group"}>
          {q.options.map((opt, i) => {
            const state = checked
              ? correctSet.has(i)
                ? "is-correct"
                : picked.includes(i)
                  ? "is-wrong"
                  : ""
              : picked.includes(i)
                ? "is-picked"
                : "";
            return (
              <button
                key={i}
                className={`option ${state}`}
                onClick={() => toggle(i)}
                disabled={checked}
                role={q.kind === "single" ? "radio" : "checkbox"}
                aria-checked={picked.includes(i)}
              >
                <span className="letter">{LETTERS[i]}</span>
                <Md>{opt}</Md>
              </button>
            );
          })}
        </div>
      ) : (
        <textarea
          className="answer-box"
          placeholder="Deine Antwort"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={checked}
        />
      )}

      {!checked && (
        <div className="row" style={{ marginTop: 18 }}>
          {q.kind !== "open" ? (
            <button className="btn btn-primary" onClick={check} disabled={!picked.length}>
              Antwort prüfen
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setChecked(true)}>
              Musterlösung zeigen
            </button>
          )}
        </div>
      )}

      {checked && (
        <div className="explain">
          {q.kind !== "open" && (
            <p className={isOk ? "verdict-ok" : "verdict-bad"}>{isOk ? "Richtig" : "Nicht ganz"}</p>
          )}
          {selfVerdict !== null && (
            <p className={selfVerdict ? "verdict-ok" : "verdict-bad"}>{selfVerdict ? "Gewusst" : "Noch nicht gewusst"}</p>
          )}
          {q.kind === "open" && (
            <>
              <p>
                <strong>Musterlösung</strong>
              </p>
              <Md>{q.model_answer}</Md>
            </>
          )}
          <Md>{q.explanation}</Md>
          {q.kind === "open" && selfVerdict === null && (
            <div className="row" style={{ marginTop: 12 }}>
              <span className="muted small">Wusstest du das Wesentliche?</span>
              <button className="btn" onClick={() => selfGrade(true)}>
                Ja
              </button>
              <button className="btn" onClick={() => selfGrade(false)}>
                Nein
              </button>
            </div>
          )}
          {(q.kind !== "open" || selfVerdict !== null) && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onNext} autoFocus>
              Nächste Frage
            </button>
          )}
        </div>
      )}
    </div>
  );
}
