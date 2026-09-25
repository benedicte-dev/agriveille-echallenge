"use client";

import { IconRegle } from "@/components/icons";
import { Button } from "@/components/ui";

/** Ouvre la boîte d'impression du navigateur (la feuille de style d'impression isole la quittance). */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="secondary" size="md" icon={<IconRegle size={24} />} onClick={() => window.print()}>
      {label}
    </Button>
  );
}
