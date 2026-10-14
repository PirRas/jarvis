"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Review } from "@/components/Review";
import { getLecture } from "@/lib/db";

function LearnInner() {
  const deck = useSearchParams().get("deck") ?? undefined;
  const [name, setName] = useState<string | undefined>();

  useEffect(() => {
    if (deck) getLecture(deck).then((l) => setName(l?.title));
  }, [deck]);

  return <Review key={deck ?? "all"} lectureId={deck} deckName={deck ? name : undefined} />;
}

export default function LearnPage() {
  return (
    <Suspense fallback={<p className="muted">Lade …</p>}>
      <LearnInner />
    </Suspense>
  );
}
