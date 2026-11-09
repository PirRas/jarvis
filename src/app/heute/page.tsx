import type { Metadata } from "next";
import Today from "./Today";

export const metadata: Metadata = { title: "Heute" };

export default function HeutePage() {
  return <Today />;
}
