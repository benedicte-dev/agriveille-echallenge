import type { Metadata } from "next";
import Link from "next/link";
import { IconHorloge, IconInsecte, IconPayer, IconRegle, IconSemis, IconUtilisateur, IconVendre } from "@/components/icons";
import { DataTable, EmptyState, PageHeader, StatCard, type Column } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { contentCounts, listAudit } from "@/server/content/admin-cms";
import { getTranslator } from "@/server/content/ui/i18n";
import { fmtDateTime, fmtInt } from "./_ui/format";

export const metadata: Metadata = { title: "Vue d'ensemble" };

type AuditRow = Awaited<ReturnType<typeof listAudit>>["rows"][number];

export default async function AdminHome() {
  await requireRole("ADMIN");
  const { locale, tr } = await getTranslator();
  const [c, recent] = await Promise.all([contentCounts(), listAudit({ page: 1 }, 10)]);
  const n = (v: number) => fmtInt(v, locale);

  const cards = [
    { href: "/admin/utilisateurs", label: tr("admin.users"), value: n(c.users), hint: tr("adm.home.active_users", { count: c.activeUsers }), icon: <IconUtilisateur size={28} />, tone: "primary" as const },
    { href: "/admin/reglementation", label: tr("adm.nav.regulations"), value: n(c.regulations), hint: tr("adm.home.published", { count: c.published }), icon: <IconRegle size={28} />, tone: "info" as const },
    { href: "/admin/ravageurs", label: tr("adm.nav.pests"), value: n(c.pests), icon: <IconInsecte size={28} />, tone: "warning" as const },
    { href: "/admin/cultures", label: tr("admin.crops"), value: n(c.crops), icon: <IconSemis size={28} />, tone: "primary" as const },
    { href: "/admin/prix", label: tr("adm.nav.prices"), value: n(c.prices), icon: <IconVendre size={28} />, tone: "earth" as const },
    { href: "/admin/redevances", label: tr("adm.nav.levies"), value: n(c.levies), hint: tr("adm.home.active_levies", { count: c.activeLevies }), icon: <IconPayer size={28} />, tone: "earth" as const },
  ];

  const columns: Column<AuditRow>[] = [
    { key: "date", header: tr("common.date"), cell: (r) => fmtDateTime(r.createdAt, locale) },
    { key: "action", header: tr("adm.audit.action"), cell: (r) => <code className="text-sm">{r.action}</code>, primary: true },
    { key: "actor", header: tr("adm.audit.actor"), cell: (r) => r.actor?.fullName ?? tr("adm.audit.system") },
    { key: "entity", header: tr("adm.audit.entity"), cell: (r) => r.entity, hideOnMobile: true },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={tr("admin.title")} subtitle={tr("adm.home.subtitle")} />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <li key={card.href}>
            <Link href={card.href} className="block rounded-2xl focus-visible:outline-offset-4">
              <StatCard label={card.label} value={card.value} hint={card.hint} icon={card.icon} tone={card.tone} />
            </Link>
          </li>
        ))}
      </ul>
      <section aria-labelledby="adm-recent" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="adm-recent" className="text-xl">
            {tr("adm.home.recent")}
          </h2>
          <Link href="/admin/audit" className="font-semibold text-primary underline">
            {tr("adm.home.see_audit")}
          </Link>
        </div>
        {recent.rows.length === 0 ? (
          <EmptyState icon={<IconHorloge size={40} />} title={tr("adm.audit.empty")} message={tr("adm.audit.empty_hint")} />
        ) : (
          <DataTable caption={tr("adm.home.recent")} columns={columns} rows={recent.rows} rowKey={(r) => r.id} />
        )}
      </section>
    </div>
  );
}
