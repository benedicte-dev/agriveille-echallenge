"use client";

import { SegmentError } from "@/app/marche/_ui/SegmentError";

export default function VerifierError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <SegmentError error={error} reset={reset} />;
}
