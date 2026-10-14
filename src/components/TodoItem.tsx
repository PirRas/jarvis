"use client";

import type { Todo } from "@/lib/assistant";
import { putItem } from "@/lib/db";
import { fmtShortDay, parseIsoDate } from "@/lib/planner";
import { dueLabel } from "@/lib/todos";

/** Eine Aufgabe mit Haken. `onEdit` zeigt einen Bearbeiten-Knopf. */
export function TodoItem({ todo, now, onEdit, compact = false }: { todo: Todo; now: number; onEdit?: () => void; compact?: boolean }) {
  const overdue = !todo.done && !!todo.due && parseIsoDate(todo.due) < new Date(now).setHours(0, 0, 0, 0);
  const toggle = () => putItem("todos", { ...todo, done: !todo.done, doneAt: todo.done ? undefined : Date.now() });

  return (
    <li className={`todo ${todo.done ? "is-done" : ""} ${overdue ? "is-overdue" : ""}`}>
      <input type="checkbox" checked={todo.done} onChange={toggle} aria-label={`„${todo.title}“ erledigt`} />
      <div className="todo-body">
        <div className="todo-title">{todo.title}</div>
        <div className="todo-meta small">
          {todo.due && (
            <span className="todo-due">
              {fmtShortDay(parseIsoDate(todo.due))}
              {todo.time && `, ${todo.time}`}
              {!todo.done && ` · ${dueLabel(todo.due, now)}`}
            </span>
          )}
          <span className="pill">{todo.category}</span>
          {todo.link && (
            <a href={todo.link} target="_blank" rel="noreferrer">
              Link
            </a>
          )}
        </div>
        {!compact && todo.note && <p className="todo-note small muted">{todo.note}</p>}
      </div>
      {onEdit && (
        <button className="btn btn-quiet small" onClick={onEdit}>
          Bearbeiten
        </button>
      )}
    </li>
  );
}
