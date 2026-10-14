"use client";

import { RoomBadge } from "@/components/RoomBadge";
import { fmtTime, type Occurrence } from "@/lib/planner";

/** Ein Eintrag in einer Tagesliste: Zeit, Titel, Art und Raum. */
export function OccurrenceRow({ o, now, onDelete }: { o: Occurrence; now: number; onDelete?: () => void }) {
  const past = o.end < now;
  const live = o.start <= now && o.end > now && !o.allDay;
  return (
    <li className={`occ kind-${o.kind} ${past ? "is-past" : ""} ${live ? "is-live" : ""}`}>
      <span className="occ-time">
        {o.allDay ? "ganztägig" : `${fmtTime(o.start)}–${fmtTime(o.end)}`}
      </span>
      <span className="occ-body">
        <span className="occ-title">
          {o.title}
          {live && <span className="pill live-pill">läuft</span>}
        </span>
        <span className="occ-meta">
          {o.type}
          {o.kind === "lecture" && !past ? (
            <>
              {" · "}
              <RoomBadge occ={o} />
            </>
          ) : (
            o.location && ` · ${o.location}`
          )}
        </span>
        {o.note && o.kind !== "lecture" && <span className="occ-note">{o.note}</span>}
      </span>
      {onDelete && (
        <button className="btn btn-quiet occ-delete" onClick={onDelete} aria-label={`${o.title} löschen`}>
          Löschen
        </button>
      )}
    </li>
  );
}
