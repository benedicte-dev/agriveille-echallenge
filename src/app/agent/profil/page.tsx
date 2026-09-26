import type { Metadata } from "next";
import { IconAlerte, IconContraste, IconDeconnexion, IconPayer, IconSignaler, IconTelephone, IconUtilisateur } from "@/components/icons";
import { BeninArms } from "@/components/brand/BeninArms";
import { Button, Card, ContrastToggle, LanguageSwitcher, PageHeader, StatCard } from "@/components/ui";
import { BENIN_PHONE_REGEX, requireRole } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { prisma } from "@/lib/db";
import { getTranslator, isHighContrast } from "@/server/content/ui/i18n";
import { updateStaffLocaleAction } from "./actions";

export const metadata: Metadata = { title: "Mon profil" };

function maskPhone(phone: string): string {
  if (!BENIN_PHONE_REGEX.test(phone)) return "•••";
  const d = phone.slice(4);
  return `+229 ${d.slice(0, 2)} •• •• •${d.slice(7, 8)} ${d.slice(8, 10)}`;
}

/** Profil des agents de l'État (et des admins : requireRole("AGENT") les accepte). */
export default async function StaffProfilePage() {
  const user = await requireRole("AGENT");
  const [{ locale, tr }, highContrast, me, reviewed, alerts, validated] = await Promise.all([
    getTranslator(),
    isHighContrast(),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { organization: true, createdAt: true, lastLoginAt: true, commune: { select: { name: true, department: true } } },
    }),
    prisma.pestReport.count({ where: { reviewedById: user.id } }),
    prisma.alert.count({ where: { createdById: user.id } }),
    prisma.declaration.count({ where: { validatedById: user.id } }),
  ]);
  const dateFmt = new Intl.DateTimeFormat("fr-BJ", { dateStyle: "long" });
  const zone = me?.commune ? `${me.commune.name} (${me.commune.department})` : "—";

  return (
    <>
      <PageHeader
        title={tr("profile.title")}
        icon={<IconUtilisateur size={32} />}
        subtitle={[user.fullName, tr(`role.${user.role}`)].join(" · ")}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-start gap-4">
              <BeninArms size={56} alt={tr("brand.arms_alt")} />
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">{tr("brand.republic")}</p>
                <h2 className="mt-1 text-2xl">{user.fullName}</h2>
                <p className="text-ink-muted">{tr(`role.${user.role}`)}</p>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-ink-muted">{tr("staff.profile.org")}</dt>
                <dd className="font-semibold">{me?.organization ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">{tr("staff.profile.zone")}</dt>
                <dd className="font-semibold">{zone}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">{tr("profile.phone")}</dt>
                <dd className="flex items-center gap-2 font-semibold tabular-nums">
                  <IconTelephone size={20} className="text-primary" />
                  {maskPhone(user.phone)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">{tr("staff.profile.member_since")}</dt>
                <dd className="font-semibold">{me ? dateFmt.format(me.createdAt) : "—"}</dd>
              </div>
            </dl>
          </Card>

          <section aria-labelledby="activite" className="flex flex-col gap-3">
            <h2 id="activite" className="text-xl">{tr("staff.profile.activity")}</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label={tr("staff.profile.reviewed")} value={String(reviewed)} icon={<IconSignaler size={28} />} />
              <StatCard label={tr("staff.profile.alerts")} value={String(alerts)} icon={<IconAlerte size={28} />} />
              <StatCard label={tr("staff.profile.validated")} value={String(validated)} icon={<IconPayer size={28} />} />
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <Card title={tr("profile.language")}>
            <LanguageSwitcher current={locale} action={updateStaffLocaleAction} variant="cards" label={tr("lang.choose")} />
          </Card>
          <Card title={tr("mon.profile.contrast")}>
            <div className="flex items-center gap-3">
              <IconContraste size={28} className="text-primary" />
              <ContrastToggle initial={highContrast} label={tr("mon.profile.contrast")} showLabel />
            </div>
          </Card>
          <form action={logoutAction}>
            <Button type="submit" variant="danger" size="lg" block icon={<IconDeconnexion size={24} />}>
              {tr("nav.logout")}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
