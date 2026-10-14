"use client";

import { fmtTime, type Occurrence } from "@/lib/planner";
import { useRoom, type RoomFound, type RoomMissing } from "@/lib/rooms";

/**
 * Raum einer Lektion. Mit Veranstaltungsnummer wird er live im Vorlesungsverzeichnis geprüft;
 * weicht er vom üblichen Raum ab, erscheint eine auffällige Warnung.
 */
export function RoomBadge({ occ, large = false }: { occ: Occurrence; large?: boolean }) {
  const info = useRoom(occ.kind === "lecture" ? occ : null, occ.code);

  if (!occ.code || !info) {
    return occ.location ? <span className="room">{occ.location}</span> : null;
  }
  if (info.state === "loading") return <span className="room room-checking">Raum wird geprüft …</span>;
  if (info.state === "error") {
    if (info.cached) return <Found info={info.cached} large={large} stale />;
    return (
      <span className="room room-unknown" title={info.message}>
        {occ.location || "Raum unbekannt"} <span className="small">(Prüfung fehlgeschlagen)</span>
      </span>
    );
  }
  return <Found info={info} large={large} />;
}

function Found({ info, large, stale = false }: { info: RoomFound | RoomMissing; large: boolean; stale?: boolean }) {
  const checked = (
    <a className="room-checked" href={info.url} target="_blank" rel="noreferrer" title="Im Vorlesungsverzeichnis ansehen">
      {stale ? "letzter Stand" : "geprüft"} {fmtTime(info.checkedAt)}
    </a>
  );

  if (info.state === "missing") {
    return (
      <span className="room room-missing">
        <strong>Nicht im Vorlesungsverzeichnis</strong>: an diesem Tag ist kein Termin eingetragen. Fällt die Lektion aus?{" "}
        {checked}
      </span>
    );
  }

  if (info.changed) {
    return (
      <span className={`room-alert ${large ? "is-large" : ""}`} role="alert">
        <span className="room-alert-label">Anderer Raum!</span>
        <span className="room-alert-room">{info.room}</span>
        <span className="room-alert-usual">
          sonst: <s>{info.regular}</s>
        </span>
        {checked}
      </span>
    );
  }

  return (
    <span className="room">
      {info.room}
      {info.alternatives.length > 0 && (
        <span className="small muted room-groups">
          {" "}
          oder je nach Gruppe: {info.alternatives.join(" · ")}. Trag im Stundenplan deine Gruppennummer ein (z. B. 10551-07),
          dann zeigt Jarvis nur deinen Raum.
        </span>
      )}{" "}
      {checked}
    </span>
  );
}
