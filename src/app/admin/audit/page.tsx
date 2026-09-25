import type { Metadata } from "next";
import { IconHorloge } from "@/components/icons";
import { Button, DataTable, EmptyState, Field, PageHeader, Select, type Column } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { AUDIT_PAGE_SIZE, auditFilterOptions, listAudit } from "@/server/content/admin-cms";
import { auditFilterSchema } from "@/server/content/schemas";
import { getTranslator } from "@/server/content/ui/i18n";
import { Pager } from "../_ui/Pager";
import { fmtDateTime, fmtInt, one, type SearchParams } from "../_ui/format";

export const metadata: Metadata = { title: "Journal d'audit" };

type AuditRow = Awaited<ReturnType<typeof listAudit>>["rows"][number];

export default async function AdminAuditPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("ADMIN");
  const { locale, tr } = await getTranslator();
  const sp = await searchParams;
  const filter = auditFilterSchema.parse({ action: one(sp.action), actor: one(sp.actor), page: one(sp.page) });
  const action = filter.action || undefined;
  const actor = filter.actor || undefined;
  const [{ rows, total, pages }, options] = await Promise.all([
    listAudit({ action, actor, page: filter.page }, AUDIT_PAGE_SIZE),
    auditFilterOptions(),
  ]);
  const filtered = Boolean(action || actor);

  const columns: Column<AuditRow>[] = [
    { key: "date", header: tr("common.date"), cell: (r) => fmtDateTime(r.createdAt, locale) },
    { key: "action", header: tr("adm.audit.action"), cell: (r) => <code className="text-sm">{r.action}</code>, primary: true },
    { key: "actor", header: tr("adm.audit.actor"), cell: (r) => r.actor?.fullName ?? tr("adm.audit.system") },
    {
      key: "entity",
      header: tr("adm.audit.entity"),
      hideOnMobile: true,
      cell: (r) => (
        <span className="flex flex-col">
          <span>{r.entity}</span>
          {r.entityId ? <code className="text-sm text-ink-muted">{r.entityId}</code> : null}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={tr("admin.audit")} icon={<IconHorloge size={32} />} subtitle={tr("adm.audit.subtitle", { count: fmtInt(total, locale) })} />

      <form method="get" role="search" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-end">
        <Field id="a-action" label={tr("adm.audit.action")} className="flex-1">
          {(a) => (
            <Select {...a} name="action" defaultValue={action ?? ""}>
              <option value="">{tr("adm.all")}</option>
              {options.actions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field id="a-actor" label={tr("adm.audit.actor")} className="flex-1">
          {(a) => (
            <Select {...a} name="actor" defaultValue={actor ?? ""}>
              <option value="">{tr("adm.all")}</option>
              {options.actors.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="submit" size="sm">
          {tr("common.search")}
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          kind={filtered ? "no-results" : "first-use"}
          icon={<IconHorloge size={40} />}
          title={tr(filtered ? "adm.no_results" : "adm.audit.empty")}
          message={filtered ? undefined : tr("adm.audit.empty_hint")}
          action={filtered ? <Button href="/admin/audit" variant="secondary" size="sm">{tr("adm.clear_filters")}</Button> : undefined}
        />
      ) : (
        <DataTable caption={tr("admin.audit")} columns={columns} rows={rows} rowKey={(r) => r.id} />
      )}

      <Pager
        page={filter.page}
        pages={pages}
        base="/admin/audit"
        params={{ action, actor }}
        labels={{ prev: tr("adm.prev"), next: tr("adm.next"), nav: tr("adm.pagination"), status: tr("adm.page_of", { page: filter.page, pages }) }}
      />
    </div>
  );
}
