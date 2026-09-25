import { LoadingBlock } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <LoadingBlock shape="cards" count={4} label="Chargement des fiches…" />
    </div>
  );
}
