import type { Metadata } from "next";
import { Button } from "@/components/ui";
import { IconAccueil, IconRegle, IconInfo } from "@/components/icons";
import { PublicFrame } from "@/server/content/ui/PublicFrame";
import { getTranslator } from "@/server/content/ui/i18n";

export const metadata: Metadata = { title: "Page introuvable", robots: { index: false } };

export default async function NotFound() {
  const { tr } = await getTranslator();
  return (
    <PublicFrame>
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-sunken text-ink">
          <IconInfo size={48} />
        </span>
        <h1 className="text-xl sm:text-2xl">{tr("error.not_found")}</h1>
        <p className="max-w-prose text-base text-ink-muted">{tr("pub.not_found.text")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button href="/" icon={<IconAccueil size={24} />}>
            {tr("nav.home")}
          </Button>
          <Button href="/reglementation" variant="secondary" icon={<IconRegle size={24} />}>
            {tr("nav.regulation")}
          </Button>
        </div>
      </div>
    </PublicFrame>
  );
}
