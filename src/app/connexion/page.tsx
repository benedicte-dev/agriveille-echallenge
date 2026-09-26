import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getCurrentUser, homePathForRole } from "@/lib/auth";
import { PublicFrame } from "@/server/content/ui/PublicFrame";
import { AuthSplit } from "@/server/content/ui/AuthSplit";
import { getTranslator, listenLabels } from "@/server/content/ui/i18n";
import { nextAllowedForRole, safeNextPath } from "@/server/content/safe-next";
import { LoginForm, type DemoAccount } from "./LoginForm";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

/** Comptes de démonstration (SPEC §9) : affichés volontairement pour l'évaluation en direct. */
function demoAccounts(tr: (k: string) => string): DemoAccount[] | null {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "false") return null;
  return [
    { role: tr("role.FARMER"), name: "Ablawa (Bohicon)", phone: "0197000001", pin: "1234" },
    { role: tr("role.FARMER"), name: "Issa (Parakou)", phone: "0197000002", pin: "1234" },
    { role: tr("role.BUYER"), name: "Carine", phone: "0197000010", pin: "1234" },
    { role: tr("role.AGENT"), name: "Marcel", phone: "0197000020", pin: "1234" },
    { role: tr("role.ADMIN"), name: "Admin", phone: "0197000099", pin: "9876" },
  ];
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : undefined);

  // Déjà connecté : pas de second formulaire, on va droit à l'espace (ou au chemin demandé s'il est permis).
  const user = await getCurrentUser();
  if (user) redirect(next && nextAllowedForRole(next, user.role) ? next : homePathForRole(user.role));

  const { locale, tr, audio } = await getTranslator();
  return (
    <PublicFrame>
      <AuthSplit photo="/images/fermes/cultures-boukoumbe.webp" alt={tr("home.benefit.alerts.photo")} caption={tr("auth.split_caption")}>
      <PageHeader
        title={tr("auth.title")}
        subtitle={tr("auth.welcome")}
        backHref="/"
        backLabel={tr("nav.home")}
        listen={{ text: `${tr("auth.welcome")}. ${tr("auth.phone")}`, lang: locale, audioSrc: audio("auth.welcome"), labels: listenLabels(tr) }}
      />
      <LoginForm next={next} demoAccounts={demoAccounts(tr)} />
      </AuthSplit>
    </PublicFrame>
  );
}
