"use client";

import { useEffect, useState } from "react";
import { Calculators } from "@/components/pharma/Calculators";
import { CompoundLookup } from "@/components/pharma/CompoundLookup";
import { PlantGallery } from "@/components/pharma/PlantGallery";
import "./pharmazie.css";

const TABS = [
  { id: "wirkstoff", label: "Wirkstoff-Steckbrief" },
  { id: "rechner", label: "Rechner" },
  { id: "pflanzen", label: "Arzneipflanzen" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function PharmaPage() {
  const [tab, setTab] = useState<Tab>("wirkstoff");

  // Reiter über die Adresse ansteuerbar, z. B. /pharmazie#rechner
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (TABS.some((t) => t.id === h)) setTab(h as Tab);
  }, []);

  function choose(t: Tab) {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Pharmazie</h1>
          <p className="lede">Wirkstoffe nachschlagen, im Labor rechnen und Arzneipflanzen lernen.</p>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} className="tab" role="tab" aria-selected={tab === t.id} onClick={() => choose(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "wirkstoff" && <CompoundLookup />}
      {tab === "rechner" && <Calculators />}
      {tab === "pflanzen" && <PlantGallery />}
    </>
  );
}
