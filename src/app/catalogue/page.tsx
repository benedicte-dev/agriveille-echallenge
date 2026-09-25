import type { Metadata } from "next";
import { Catalogue } from "@/components/ui/__catalogue";

export const metadata: Metadata = {
  title: "Catalogue des composants",
  robots: { index: false, follow: false },
};

/** Catalogue visuel du système de design (revue design, audits d'accessibilité). Non indexé. */
export default function CataloguePage() {
  return <Catalogue />;
}
