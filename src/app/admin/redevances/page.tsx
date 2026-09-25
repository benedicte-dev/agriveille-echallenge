import type { Metadata } from "next";
import { IconPayer } from "@/components/icons";
import { Badge, DataTable, EmptyState, PageHeader, intlLocale, type Column } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { listLevyRatesAdmin } from "@/server/content/admin-cms";
import { getTranslator } from "@/server/content/ui/i18n";
import { saveLevyRateAction, toggleLevyAction } from "../actions";
import { AdminForm, SelectField, Submit, TextField } from "../_ui/AdminForm";
import { fmtInt } from "../_ui/format";

export const metadata: Metadata = { title: "Barème des redevances" };

type Row = Awaited<ReturnType<typeof listLevyRatesAdmin>>[number];

const BASES = ["PER_KG", "PERCENT_VALUE", "FLAT"] as const;

export default async function AdminLeviesPage() {
  await requireRole("ADMIN");
  const { locale, tr } = await getTranslator();
  const rows = await listLevyRatesAdmin();
  const active = rows.filter((r) => r.active).length;
  const basisOptions = BASES.map((b) => ({ value: b, label: tr(`adm.levy.basis.${b}`) }));

  /** PERCENT_VALUE : le taux est stocké en points de base (100 = 1 %). */
  const shown = (r: Row) =>
    tr(`lev.basis.${r.basis}`, {
      rate: r.basis === "PERCENT_VALUE" ? new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 }).format(r.rate / 100) : fmtInt(r.rate, locale),
    });

  const columns: Column<Row>[] = [
    {
      key: "label",
      header: tr("adm.levy.label"),
      primary: true,
      cell: (r) => (
        <span className="flex flex-col">
          <span className="font-semibold">{r.labelFr}</span>
          <code className="text-sm text-ink-muted">{r.code}</code>
        </span>
      ),
    },
    { key: "rate", header: tr("adm.levy.rate"), cell: (r) => shown(r) },
    { key: "uses", header: tr("adm.levy.declarations"), cell: (r) => fmtInt(r._count.declarations, locale), hideOnMobile: true },
    {
      key: "status",
      header: tr("adm.users.status"),
      cell: (r) => <Badge tone={r.active ? "success" : "neutral"}>{tr(r.active ? "admin.active" : "admin.inactive")}</Badge>,
    },
    {
      key: "edit",
      header: tr("adm.levy.edit"),
      cell: (r) => (
        <AdminForm action={saveLevyRateAction} inline className="min-w-64">
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="code" value={r.code} />
          <input type="hidden" name="labelFon" value={r.labelFon ?? ""} />
          <input type="hidden" name="labelYo" value={r.labelYo ?? ""} />
          {/* Conserver l'état : la case absente vaudrait « désactivé ». */}
          {r.active ? <input type="hidden" name="active" value="on" /> : null}
          <TextField name="labelFr" label={tr("adm.levy.label_for", { code: r.code })} defaultValue={r.labelFr} required maxLength={160} />
          <SelectField name="basis" label={tr("adm.levy.basis")} options={basisOptions} defaultValue={r.basis} required />
          <TextField
            name="rate"
            label={tr("adm.levy.rate")}
            hint={tr("adm.levy.rate_hint")}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={r.rate}
            required
          />
          <Submit size="sm" variant="secondary">
            {tr("adm.save")}
          </Submit>
        </AdminForm>
      ),
    },
    {
      key: "actions",
      header: tr("adm.actions"),
      cell: (r) => (
        <AdminForm action={toggleLevyAction} inline>
          <input type="hidden" name="id" value={r.id} />
          {r.active ? null : <input type="hidden" name="active" value="on" />}
          <Submit size="sm" variant={r.active ? "danger" : "primary"}>
            {tr(r.active ? "adm.levy.deactivate" : "adm.levy.activate")}
          </Submit>
        </AdminForm>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={tr("admin.levy_rates")}
        icon={<IconPayer size={32} />}
        subtitle={tr("adm.levy.subtitle", { count: rows.length, active })}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<IconPayer size={40} />} title={tr("adm.levy.empty")} message={tr("adm.levy.empty_hint")} />
      ) : (
        <DataTable caption={tr("admin.levy_rates")} columns={columns} rows={rows} rowKey={(r) => r.id} />
      )}
    </div>
  );
}
