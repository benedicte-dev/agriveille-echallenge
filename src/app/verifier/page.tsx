import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IconQr } from "@/components/icons";
import { Button, Field, Input, PageHeader, PublicShell } from "@/components/ui";
import { normalizeVerificationCode } from "@/server/levies/codes";
import { pageI18n } from "@/app/marche/_ui/labels";

export const metadata: Metadata = { title: "Vérifier une quittance", robots: { index: false, follow: false } };

/** Saisie manuelle du code (quand on ne peut pas scanner le QR). Formulaire GET, sans JavaScript. */
export default async function VerifierPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const [{ locale, tr, listenLabels }, sp] = await Promise.all([pageI18n(), searchParams]);
  const raw = Array.isArray(sp.code) ? sp.code[0] : sp.code;
  const submitted = typeof raw === "string" && raw.trim() !== "";
  if (submitted) {
    // Un code mal formé mène au même écran « introuvable » qu'un code inconnu.
    redirect(`/verifier/${encodeURIComponent(normalizeVerificationCode(raw) ?? "INVALIDE0000")}`);
  }
  return (
    <PublicShell>
      <PageHeader
        title={tr("levy.verify_title")}
        subtitle={tr("lev.verify_intro")}
        icon={<IconQr size={36} />}
        listen={{ text: `${tr("levy.verify_title")}. ${tr("lev.verify_intro")}`, lang: locale, labels: listenLabels }}
      />
      <form method="get" action="/verifier" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
        <Field id="code" label={tr("lev.verification_code")} hint="Exemple : DEMOAV2026QR" required requiredLabel={tr("common.required")}>
          {(a) => (
            <Input
              {...a}
              name="code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={20}
              className="font-mono text-lg tracking-widest uppercase"
            />
          )}
        </Field>
        <Button type="submit" size="lg" block icon={<IconQr size={24} />}>
          {tr("lev.verify_submit")}
        </Button>
      </form>
    </PublicShell>
  );
}
