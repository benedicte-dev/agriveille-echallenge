import { LoadingBlock } from "@/components/ui";
import { getMessages, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

export default async function Loading() {
  const m = getMessages(await getLocale());
  return <LoadingBlock shape="cards" count={3} label={t(m, "common.loading")} />;
}
