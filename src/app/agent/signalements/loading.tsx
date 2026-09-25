import { LoadingBlock } from "@/components/ui";

export default function Loading() {
  return <LoadingBlock shape="lines" count={6} label="Chargement des signalements…" />;
}
