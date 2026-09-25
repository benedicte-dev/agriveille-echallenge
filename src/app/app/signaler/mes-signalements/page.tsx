import type { Metadata } from "next";
import { IconCamera, IconMicro, IconSignaler } from "@/components/icons";
import { Button, Card, EmptyState, ListenButton, PageHeader, intlLocale } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getMessages, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { listReports, type PestLabel } from "@/server/reports";
import { PendingQueue } from "../PendingQueue";
import { ReportStatusBadge } from "../status";

export const metadata: Metadata = { title: "Mes signalements" };

const PAGE_SIZE = 20;

function pestName(p: PestLabel | null, locale: string): string | null {
  if (!p) return null;
  return (locale === "fon" ? p.nameFon : locale === "yo" ? p.nameYo : null) ?? p.nameFr;
}

/** Suivi des signalements de l'exploitante, avec leur statut et la réponse de l'agent. */
export default async function MesSignalementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole("FARMER");
  const sp = await searchParams;
  const locale = await getLocale();
  const m = getMessages(locale);
  const page = await listReports(user, { page: typeof sp.page === "string" ? sp.page : undefined, pageSize: PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(page.total / page.pageSize));
  const dateFmt = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Porto-Novo" });
  const listenLabels = {
    listen: t(m, "common.listen"),
    stop: t(m, "common.stop"),
    loading: t(m, "common.loading"),
    error: t(m, "error.voice_unavailable"),
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t(m, "report.my_reports")}
        icon={<IconSignaler size={32} />}
        backHref="/app/signaler"
        backLabel={t(m, "report.title")}
      />
      <PendingQueue />

      {page.total === 0 ? (
        <EmptyState
          kind="first-use"
          icon={<IconSignaler size={48} />}
          title={t(m, "rep.mine_empty")}
          message={t(m, "rep.mine_empty_hint")}
          listen={<ListenButton text={`${t(m, "rep.mine_empty")} ${t(m, "rep.mine_empty_hint")}`} lang={locale} labels={listenLabels} />}
          action={
            <Button href="/app/signaler" size="lg" icon={<IconSignaler size={24} />}>
              {t(m, "report.title")}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {page.items.map((r) => {
            const statusLabel = t(m, `report.status.${r.status}`);
            const hint = t(m, `rep.status_hint.${r.status}`);
            const name = pestName(r.pest, locale) ?? t(m, "report.unknown_pest");
            const where = r.parcel ? `${r.parcel.name} · ${r.communeName}` : r.communeName;
            return (
              <Card
                as="li"
                key={r.id}
                accent={r.status === "CONFIRMED" ? "primary" : r.status === "PENDING" ? "warning" : undefined}
                title={name}
                titleAs="h2"
                actions={<ReportStatusBadge status={r.status} label={statusLabel} />}
              >
                <p className="text-base text-ink-muted">
                  {t(m, "rep.sent_at", { date: dateFmt.format(r.createdAt) })} · {where}
                </p>
                <p className="mt-2 text-base font-semibold">{hint}</p>
                {r.status === "REJECTED" && r.reviewNote ? (
                  <p className="mt-1 text-base">
                    <span className="font-semibold">{t(m, "rep.reason")} : </span>
                    {r.reviewNote}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {r.hasPhoto ? (
                    <span className="inline-flex items-center gap-1 text-sm text-ink-muted">
                      <IconCamera size={20} /> {t(m, "rep.with_photo")}
                    </span>
                  ) : null}
                  {r.hasVoice ? (
                    <span className="inline-flex items-center gap-1 text-sm text-ink-muted">
                      <IconMicro size={20} /> {t(m, "rep.with_voice")}
                    </span>
                  ) : null}
                  <ListenButton
                    text={`${name}. ${statusLabel}. ${hint}${r.status === "REJECTED" && r.reviewNote ? ` ${r.reviewNote}` : ""}`}
                    lang={locale}
                    labels={listenLabels}
                    variant="icon"
                    className="ml-auto"
                  />
                </div>
              </Card>
            );
          })}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label={t(m, "rep.pagination")} className="flex items-center justify-between gap-3">
          {page.page > 1 ? (
            <Button href={`/app/signaler/mes-signalements?page=${page.page - 1}`} variant="secondary" size="sm">
              {t(m, "rep.prev")}
            </Button>
          ) : (
            <span />
          )}
          <span className="text-base">{t(m, "rep.page_of", { page: page.page, pages })}</span>
          {page.page < pages ? (
            <Button href={`/app/signaler/mes-signalements?page=${page.page + 1}`} variant="secondary" size="sm">
              {t(m, "rep.next")}
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
