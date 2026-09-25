import type { Metadata } from "next";
import Link from "next/link";
import { IconQr, IconRegle, IconUtilisateur, IconVendre } from "@/components/icons";
import { Button, Callout, PageHeader, PublicShell } from "@/components/ui";
import { getCurrentUser, homePathForRole } from "@/lib/auth";
import { listListings, marketReferenceData, referencePrices } from "@/server/market/queries";
import { MarketBrowser } from "./_ui/MarketBrowser";
import { ReferencePriceTable } from "./_ui/ReferencePriceTable";
import { pageI18n } from "./_ui/labels";

export const metadata: Metadata = { title: "Marché" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function flat(sp: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}

/** Marché public (lecture seule) : annonces ouvertes + prix de référence. */
export default async function MarchePage({ searchParams }: { searchParams: SearchParams }) {
  const [{ locale, tr, listenLabels }, sp, user] = await Promise.all([pageI18n(), searchParams, getCurrentUser()]);
  const [page, { crops, communes }, refs] = await Promise.all([listListings(flat(sp)), marketReferenceData(), referencePrices()]);

  const cta =
    user?.role === "BUYER" ? (
      <Button href="/acheteur" size="lg" icon={<IconVendre size={24} />}>
        {tr("mkt.go_buyer")}
      </Button>
    ) : user ? null : (
      <Button href="/connexion?next=/acheteur" size="lg" icon={<IconUtilisateur size={24} />}>
        {tr("mkt.login_to_offer")}
      </Button>
    );

  return (
    <PublicShell
      width="wide"
      headerEnd={
        user ? (
          <Button href={homePathForRole(user.role)} variant="secondary" size="sm">
            {tr("nav.dashboard")}
          </Button>
        ) : (
          <Button href="/connexion" variant="secondary" size="sm">
            {tr("nav.login")}
          </Button>
        )
      }
      footer={
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li>
            <Link href="/reglementation" className="inline-flex min-h-touch items-center gap-2 font-semibold text-primary">
              <IconRegle size={20} />
              {tr("nav.regulation")}
            </Link>
          </li>
          <li>
            <Link href="/verifier" className="inline-flex min-h-touch items-center gap-2 font-semibold text-primary">
              <IconQr size={20} />
              {tr("nav.verify")}
            </Link>
          </li>
          <li className="inline-flex min-h-touch items-center">{tr("common.demo")}</li>
        </ul>
      }
    >
      <PageHeader
        title={tr("mkt.public_title")}
        subtitle={tr("mkt.public_intro")}
        icon={<IconVendre size={36} />}
        listen={{ text: `${tr("mkt.public_title")}. ${tr("mkt.public_intro")}`, lang: locale, labels: listenLabels }}
      />
      {cta ? <div className="mb-6">{cta}</div> : null}

      <section aria-labelledby="annonces" className="mb-10">
        <h2 id="annonces" className="mb-3 text-xl">
          {tr("market.title")}
        </h2>
        <MarketBrowser page={page} crops={crops} communes={communes} basePath="/marche" locale={locale} tr={tr} />
      </section>

      <section aria-labelledby="prix-reference">
        <h2 id="prix-reference" className="mb-3 text-xl">
          {tr("mkt.ref_title")}
        </h2>
        <ReferencePriceTable refs={refs} crops={crops} locale={locale} tr={tr} />
        {!user ? (
          <Callout tone="info" title={tr("mkt.login_to_offer")} className="mt-6" action={cta} />
        ) : null}
      </section>
    </PublicShell>
  );
}
