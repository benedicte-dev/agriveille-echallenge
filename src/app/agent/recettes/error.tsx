"use client";

import { SegmentError } from "@/app/marche/_ui/SegmentError";

export default function RecettesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <SegmentError error={error} reset={reset} titleKey="lev.load_error" />;
}
