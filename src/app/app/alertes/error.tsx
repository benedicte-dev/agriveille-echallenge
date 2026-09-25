"use client";

import { SegmentError } from "./_components/Segment";

export default function AlertesError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <SegmentError {...props} />;
}
