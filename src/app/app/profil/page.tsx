import type { Metadata } from "next";
import { cookies } from "next/headers";
import { IconContraste, IconDeconnexion, IconTelephone, IconUtilisateur } from "@/components/icons";
import { Button, Card, ContrastToggle, CONTRAST_COOKIE, LanguageSwitcher, PageHeader } from "@/components/ui";
import { BENIN_PHONE_REGEX, requireRole } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { prisma } from "@/lib/db";
import { pageI18n } from "@/server/monitoring/present";
import { updateLocaleAction } from "./actions";

export const metadata: Metadata = { title: "Mon profil" };

/** +22901XXXXXXXX → « +229 01 •• •• •0 01 » (seuls les 2 premiers et les 3 derniers chiffres). */
function maskPhone(phone: string): string {
  if (!BENIN_PHONE_REGEX.test(phone)) return "•••";
  const d = phone.slice(4);
  return `+229 ${d.slice(0, 2)} •• •• •${d.slice(7, 8)} ${d.slice(8, 10)}`;
}

export default async function ProfilPage() {
  const user = await requireRole("FARMER");
  const [i, store, commune] = await Promise.all([
    pageI18n(),
    cookies(),
    user.communeId ? prisma.commune.findUnique({ where: { id: user.communeId }, select: { name: true } }) : null,
  ]);
  const highContrast = store.get(CONTRAST_COOKIE)?.value === "high";

  return (
    <>
      <PageHeader
        title={i.tr("profile.title")}
        icon={<IconUtilisateur size={32} />}
        subtitle={[user.fullName, commune?.name].filter(Boolean).join(" · ")}
        backHref="/app"
        backLabel={i.tr("common.back")}
        listen={i.listen(["profile.title"], undefined, [user.fullName])}
      />

      <div className="flex flex-col gap-4">
        <Card title={user.fullName}>
          <p className="flex items-center gap-3 text-lg">
            <IconTelephone size={28} className="text-primary" />
            <span className="sr-only">{i.tr("profile.phone")} : </span>
            <span className="font-semibold tabular-nums" aria-label={i.tr("mon.profile.phone_masked")}>
              {maskPhone(user.phone)}
            </span>
          </p>
        </Card>

        <Card title={i.tr("profile.language")}>
          <LanguageSwitcher current={i.locale} action={updateLocaleAction} variant="cards" label={i.tr("lang.choose")} />
        </Card>

        <Card title={i.tr("mon.profile.contrast")}>
          <div className="flex items-center gap-3">
            <IconContraste size={28} className="text-primary" />
            <ContrastToggle initial={highContrast} label={i.tr("mon.profile.contrast")} showLabel />
          </div>
        </Card>

        <form action={logoutAction}>
          <Button type="submit" variant="danger" size="lg" block icon={<IconDeconnexion size={24} />}>
            {i.tr("nav.logout")}
          </Button>
        </form>
      </div>
    </>
  );
}
