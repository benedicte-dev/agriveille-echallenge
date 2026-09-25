import type { Metadata } from "next";
import Link from "next/link";
import { Button, LanguageSwitcher, ListenButton } from "@/components/ui";
import { IconAlerte, IconChevron, IconPayer, IconRegle, IconVendre, type IconComponent } from "@/components/icons";
import { setLocaleAction } from "@/lib/i18n/actions";
import { getCurrentUser, homePathForRole } from "@/lib/auth";
import { PublicFrame } from "@/server/content/ui/PublicFrame";
import { VerifyForm } from "@/server/content/ui/VerifyForm";
import { getTranslator, listenLabels } from "@/server/content/ui/i18n";

export const metadata: Metadata = {
  title: { absolute: "AgriVeille · veille agricole du Bénin" },
};

const BENEFITS: { key: string; icon: IconComponent; chip: string }[] = [
  { key: "alerts", icon: IconAlerte, chip: "bg-sun-soft text-sun-ink" },
  { key: "sell", icon: IconVendre, chip: "bg-earth-soft text-earth" },
  { key: "pay", icon: IconPayer, chip: "bg-info-soft text-info" },
];

export default async function HomePage() {
  const { locale, tr } = await getTranslator();
  const user = await getCurrentUser();
  const labels = listenLabels(tr);
  const promise = `${tr("app.tagline")}. ${tr("home.intro")}`;

  return (
    <PublicFrame showLanguage={false}>
      <div className="flex flex-col gap-8">
        <section aria-labelledby="choix-langue" className="flex flex-col gap-3">
          <p id="choix-langue" className="text-lg font-bold">
            {tr("lang.choose")}
          </p>
          <LanguageSwitcher current={locale} action={setLocaleAction} variant="cards" label={tr("lang.choose")} />
          {locale !== "fr" ? <p className="text-sm text-ink-muted">{tr("lang.machine_notice")}</p> : null}
        </section>

        <section className="flex flex-col gap-3">
          <h1 className="text-xl sm:text-2xl">{tr("app.tagline")}</h1>
          <p className="text-lg text-ink">{tr("home.intro")}</p>
          <ListenButton text={promise} lang={locale} labels={labels} className="w-fit" />
        </section>

        <section aria-labelledby="benefices">
          <h2 id="benefices" className="sr-only">
            {tr("pub.benefits")}
          </h2>
          <ul className="flex flex-col gap-3">
            {BENEFITS.map(({ key, icon: Icon, chip }) => {
              const title = tr(`pub.benefit.${key}.title`);
              const text = tr(`pub.benefit.${key}.text`);
              return (
                <li key={key} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-card">
                  <span className={`flex size-16 shrink-0 items-center justify-center rounded-full ${chip}`}>
                    <Icon size={40} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg">{title}</h3>
                    <p className="text-base text-ink-muted">{text}</p>
                  </div>
                  <ListenButton text={`${title}. ${text}`} lang={locale} labels={labels} variant="icon" />
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label={tr("nav.login")} className="flex flex-col gap-3">
          {user ? (
            <Button href={homePathForRole(user.role)} size="lg" block>
              {tr("pub.go_space")}
            </Button>
          ) : (
            <>
              <Button href="/connexion" size="lg" block>
                {tr("nav.login")}
              </Button>
              <Button href="/inscription" variant="secondary" size="lg" block>
                {tr("nav.register")}
              </Button>
            </>
          )}
        </section>

        <section aria-labelledby="acces-public" className="flex flex-col gap-3">
          <h2 id="acces-public" className="text-lg">
            {tr("pub.public_access")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              { href: "/reglementation", icon: IconRegle, label: tr("nav.regulation"), hint: tr("pub.reg_hint") },
              { href: "/marche", icon: IconVendre, label: tr("home.market_prices"), hint: tr("pub.market_hint") },
            ].map(({ href, icon: Icon, label, hint }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex min-h-touch-lg items-center gap-3 rounded-xl border-2 border-line bg-surface p-4 text-ink no-underline transition-colors hover:border-primary"
                >
                  <Icon size={32} className="shrink-0 text-primary" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-lg font-bold">{label}</span>
                    <span className="text-sm text-ink-muted">{hint}</span>
                  </span>
                  <IconChevron size={24} className="shrink-0 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
          <div id="verifier" className="scroll-mt-4 rounded-xl border border-line bg-surface p-4 shadow-card">
            <VerifyForm
              labels={{
                title: tr("nav.verify"),
                label: tr("pub.verify.label"),
                hint: tr("pub.verify.hint"),
                submit: tr("pub.verify.submit"),
                invalid: tr("pub.verify.invalid"),
              }}
            />
          </div>
        </section>
      </div>
    </PublicFrame>
  );
}
