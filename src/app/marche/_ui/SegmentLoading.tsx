import { LoadingBlock, type LoadingBlockProps } from "@/components/ui";
import { pageI18n } from "./labels";

/** État chargement des pages M3 : squelette à la forme du contenu + libellé lu. */
export async function SegmentLoading({ shape = "cards", count = 4, wide = false }: Pick<LoadingBlockProps, "shape" | "count"> & { wide?: boolean }) {
  const { tr } = await pageI18n();
  return (
    <div className={wide ? "mx-auto w-full max-w-7xl px-4 py-6" : "mx-auto w-full max-w-3xl py-2"}>
      <LoadingBlock shape={shape} count={count} label={tr("common.loading")} />
    </div>
  );
}
