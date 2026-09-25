"use client";

import { SegmentError } from "./_ui/SegmentError";

export default function MarcheError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <SegmentError error={error} reset={reset} titleKey="mkt.load_error" />;
}
