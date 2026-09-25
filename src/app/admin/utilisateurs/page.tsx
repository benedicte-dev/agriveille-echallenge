import type { Metadata } from "next";
import { IconUtilisateur } from "@/components/icons";
import { Badge, Button, DataTable, EmptyState, Field, Input, PageHeader, Select, type Column } from "@/components/ui";
import { maskBeninPhone, requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/validation";
import { listUsers } from "@/server/content/admin-cms";
import { userFilterSchema } from "@/server/content/schemas";
import { getTranslator } from "@/server/content/ui/i18n";
import { setUserActiveAction, setUserRoleAction } from "../actions";
import { AdminForm, SelectField, Submit } from "../_ui/AdminForm";
import { Pager } from "../_ui/Pager";
import { fmtDate, one, type SearchParams } from "../_ui/format";

export const metadata: Metadata = { title: "Utilisateurs" };

type UserRow = Awaited<ReturnType<typeof listUsers>>["rows"][number];

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireRole("ADMIN");
  const { locale, tr } = await getTranslator();
  const sp = await searchParams;
  const filter = userFilterSchema.parse({ q: one(sp.q), role: one(sp.role), page: one(sp.page) });
  const { rows, total, pages } = await listUsers({ q: filter.q, role: filter.role, page: filter.page });
  const filtered = Boolean(filter.q || filter.role);
  const roleOptions = ROLES.map((r) => ({ value: r, label: tr(`role.${r}`) }));

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      header: tr("adm.users.name"),
      primary: true,
      cell: (u) => (
        <span className="flex flex-col">
          <span className="font-semibold">
            {u.fullName}
            {u.id === admin.id ? <span className="ml-2 text-sm font-normal text-ink-muted">({tr("adm.users.you")})</span> : null}
          </span>
          <span className="text-sm text-ink-muted">{maskBeninPhone(u.phone)}</span>
        </span>
      ),
    },
    { key: "commune", header: tr("adm.users.commune"), cell: (u) => u.commune?.name ?? "—", hideOnMobile: true },
    { key: "last", header: tr("adm.users.last_login"), cell: (u) => (u.lastLoginAt ? fmtDate(u.lastLoginAt, locale) : "—"), hideOnMobile: true },
    {
      key: "status",
      header: tr("adm.users.status"),
      cell: (u) => <Badge tone={u.isActive ? "success" : "neutral"}>{tr(u.isActive ? "admin.active" : "admin.inactive")}</Badge>,
    },
    {
      key: "role",
      header: tr("adm.users.role"),
      cell: (u) =>
        u.id === admin.id ? (
          <span>{tr(`role.${u.role}`)}</span>
        ) : (
          <AdminForm action={setUserRoleAction} inline className="min-w-52">
            <input type="hidden" name="userId" value={u.id} />
            <SelectField name="role" label={tr("adm.users.role_for", { name: u.fullName })} options={roleOptions} defaultValue={u.role} />
            <Submit size="sm" variant="secondary">
              {tr("adm.users.change_role")}
            </Submit>
          </AdminForm>
        ),
    },
    {
      key: "actions",
      header: tr("adm.actions"),
      cell: (u) =>
        u.id === admin.id ? (
          <span className="text-sm text-ink-muted">{tr("adm.users.self_note")}</span>
        ) : (
          <AdminForm action={setUserActiveAction} inline>
            <input type="hidden" name="userId" value={u.id} />
            {u.isActive ? null : <input type="hidden" name="active" value="on" />}
            <Submit size="sm" variant={u.isActive ? "danger" : "primary"}>
              {tr(u.isActive ? "adm.users.deactivate" : "adm.users.activate")}
            </Submit>
          </AdminForm>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={tr("admin.users")} icon={<IconUtilisateur size={32} />} subtitle={tr("adm.users.subtitle", { count: total })} />

      <form method="get" role="search" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-end">
        <Field id="u-q" label={tr("adm.users.search")} hint={tr("adm.users.search_hint")} className="flex-1">
          {(a) => <Input {...a} type="search" name="q" defaultValue={filter.q ?? ""} maxLength={60} />}
        </Field>
        <Field id="u-role" label={tr("adm.users.role")} className="sm:w-56">
          {(a) => (
            <Select {...a} name="role" defaultValue={filter.role ?? ""}>
              <option value="">{tr("adm.all")}</option>
              {roleOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
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
          icon={<IconUtilisateur size={40} />}
          title={tr(filtered ? "adm.no_results" : "adm.users.empty")}
          action={filtered ? <Button href="/admin/utilisateurs" variant="secondary" size="sm">{tr("adm.clear_filters")}</Button> : undefined}
        />
      ) : (
        <DataTable caption={tr("admin.users")} columns={columns} rows={rows} rowKey={(u) => u.id} />
      )}

      <Pager
        page={filter.page}
        pages={pages}
        base="/admin/utilisateurs"
        params={{ q: filter.q, role: filter.role || undefined }}
        labels={{ prev: tr("adm.prev"), next: tr("adm.next"), nav: tr("adm.pagination"), status: tr("adm.page_of", { page: filter.page, pages }) }}
      />
    </div>
  );
}
