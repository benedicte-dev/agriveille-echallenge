import { LoadingBlock } from "@/components/ui";
import { getTranslator } from "@/server/content/ui/i18n";

/** État « chargement » du tableau de bord agent : squelettes à la forme des KPI puis de la carte. */
export default async function AgentLoading() {
  const { tr } = await getTranslator();
  return (
    <div className="flex flex-col gap-6">
      <LoadingBlock shape="cards" count={4} label={tr("common.loading")} />
      <LoadingBlock shape="cards" count={1} className="h-[420px]" label={tr("common.loading")} />
    </div>
  );
}
