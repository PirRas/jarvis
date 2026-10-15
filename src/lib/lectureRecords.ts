import type { Lecture } from "./db";
import type { Notes, Study, Video } from "./schema";
import { newCard } from "./srs";

/** Die Vorlesung, wie der Importer sie speichert (auch vom Skript /nachbereitung genutzt). */
export function buildLecture(notes: Notes, study: Study, course: string, videos: Video[] = []): Lecture {
  return {
    id: crypto.randomUUID(),
    fileName: notes.title,
    createdAt: Date.now(),
    title: notes.title,
    course,
    notes: { ...notes, course },
    study,
    videos,
  };
}

/** Die Karteikarten zu einer Vorlesung, mit festen IDs `${lectureId}:0000` … */
export function lectureCards(lecture: Lecture) {
  return lecture.study.flashcards.map((card, i) => newCard(lecture.id, card, `${lecture.id}:${String(i).padStart(4, "0")}`));
}
