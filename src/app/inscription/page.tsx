import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Callout, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getCurrentUser, homePathForRole } from "@/lib/auth";
import { PublicFrame } from "@/server/content/ui/PublicFrame";
import { AuthSplit } from "@/server/content/ui/AuthSplit";
import { getTranslator, listenLabels } from "@/server/content/ui/i18n";
import { RegisterForm, type CommuneOption } from "./RegisterForm";

export const metadata: Metadata = { title: "Créer un compte", robots: { index: false } };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathForRole(user.role));
  const { locale, tr } = await getTranslator();

  let communes: CommuneOption[] | null = null;
  try {
    communes = await prisma.commune.findMany({ select: { id: true, name: true, department: true }, orderBy: { name: "asc" } });
  } catch (err) {
    console.error("[inscription] communes indisponibles", err);
  }

  return (
    <PublicFrame>
      <AuthSplit photo="/images/fermes/igname-atacora.webp" alt={tr("home.photos.igname")} caption={tr("auth.register_caption")}>
      <PageHeader
        title={tr("auth.register_title")}
        subtitle={tr("pub.register.subtitle")}
        backHref="/"
        backLabel={tr("nav.home")}
        listen={{ text: `${tr("auth.register_title")}. ${tr("pub.register.subtitle")}`, lang: locale, labels: listenLabels(tr) }}
      />
      {communes ? (
        <RegisterForm communes={communes} currentLocale={locale} />
      ) : (
        <Callout tone="critical" role="alert" title={tr("error.generic")}>
          {tr("pub.register.unavailable")}
        </Callout>
      )}
      </AuthSplit>
    </PublicFrame>
  );
}
