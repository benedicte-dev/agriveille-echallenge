import type { Metadata } from "next";
import { IconSignaler } from "@/components/icons";
import { Button, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { audioUrlFor, getMessages, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { getReportFormContext } from "@/server/reports";
import { PendingQueue } from "./PendingQueue";
import { ReportWizard, type WizardPest } from "./ReportWizard";

export const metadata: Metadata = { title: "Signaler un ravageur" };

/** Parcours fermier « Signaler un ravageur » : photo, voix, lieu, Envoyer (docs/uml/04). */
export default async function SignalerPage() {
  const user = await requireRole("FARMER");
  const [locale, ctx] = await Promise.all([getLocale(), getReportFormContext(user)]);
  const m = getMessages(locale);

  const pests: WizardPest[] = ctx.pests.map((p) => ({
    id: p.id,
    name: (locale === "fon" ? p.nameFon : locale === "yo" ? p.nameYo : null) ?? p.nameFr,
    kind: p.kind,
    cropSlugs: p.cropSlugs,
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t(m, "report.title")}
        icon={<IconSignaler size={32} />}
        subtitle={t(m, "rep.intro")}
        backHref="/app"
        backLabel={t(m, "common.back")}
        listen={{
          text: `${t(m, "report.title")}. ${t(m, "rep.intro")}`,
          lang: locale,
          audioSrc: audioUrlFor(locale, "tile.report"),
          labels: {
            listen: t(m, "common.listen"),
            stop: t(m, "common.stop"),
            loading: t(m, "common.loading"),
            error: t(m, "error.voice_unavailable"),
          },
        }}
        actions={
          <Button href="/app/signaler/mes-signalements" variant="secondary" size="sm">
            {t(m, "report.my_reports")}
          </Button>
        }
      />
      <PendingQueue />
      <ReportWizard
        parcels={ctx.parcels.map((p) => ({ id: p.id, name: p.name, communeName: p.communeName, cropSlugs: p.cropSlugs }))}
        pests={pests}
        communes={ctx.communes}
        mineHref="/app/signaler/mes-signalements"
      />
    </div>
  );
}
