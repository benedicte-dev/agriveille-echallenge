import type { Metadata } from "next";
import Image from "next/image";
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

const BENEFITS: { key: string; icon: IconComponent; chip: string; photo: string }[] = [
  { key: "alerts", icon: IconAlerte, chip: "bg-sun-soft text-sun-ink", photo: "/images/fermes/cultures-boukoumbe.webp" },
  { key: "sell", icon: IconVendre, chip: "bg-earth-soft text-earth", photo: "/images/fermes/au-champ.webp" },
  { key: "pay", icon: IconPayer, chip: "bg-info-soft text-info", photo: "/images/fermes/mais.webp" },
];

const STRIP = [
  { src: "/images/fermes/igname-atacora.webp", key: "igname" },
  { src: "/images/fermes/bas-fond-riz.webp", key: "riz" },
  { src: "/images/fermes/champs-atacora.webp", key: "marche" },
  { src: "/images/fermes/ananas.webp", key: "ananas" },
];

export default async function HomePage() {
  const { locale, tr } = await getTranslator();
  const user = await getCurrentUser();
  const labels = listenLabels(tr);
  const promise = `${tr("app.tagline")}. ${tr("home.intro")}`;

  return (
    <PublicFrame showLanguage={false} width="full">
      {/* Héros : texte à gauche, photo à droite (plein cadre sur mobile, sous le texte). */}
      <section className="relative overflow-hidden border-b border-line bg-canvas">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-12 lg:py-16">
          <div className="flex flex-col items-start gap-5">
            <p className="rise inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-bold tracking-wide text-primary uppercase">
              <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
              {tr("home.hero.kicker")}
            </p>
            <h1 className="rise text-4xl leading-[1.05] sm:text-5xl lg:text-6xl" style={{ ["--d" as string]: "80ms" }}>
              {tr("app.tagline")}
            </h1>
            <p className="rise max-w-xl text-lg text-ink-muted sm:text-xl" style={{ ["--d" as string]: "160ms" }}>
              {tr("home.intro")}
            </p>
            <div className="rise flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap" style={{ ["--d" as string]: "240ms" }}>
              {user ? (
                <Button href={homePathForRole(user.role)} size="lg">
                  {tr("pub.go_space")}
                </Button>
              ) : (
                <>
                  <Button href="/connexion" size="lg">
                    {tr("nav.login")}
                  </Button>
                  <Button href="/inscription" variant="secondary" size="lg">
                    {tr("nav.register")}
                  </Button>
                </>
              )}
              <ListenButton text={promise} lang={locale} labels={labels} className="w-fit" />
            </div>
          </div>

          <div className="rise relative" style={{ ["--d" as string]: "120ms" }}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-raised lg:aspect-[5/6] lg:rounded-tl-[6rem]">
              <Image
                src="/images/fermes/ferme-vue-du-ciel.webp"
                alt={tr("home.hero.photo_alt")}
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="kenburns object-cover"
              />
              <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-transparent" />
            </div>
            {/* Exemple d'alerte, décoratif : montre le produit sur la photo. */}
            <div
              aria-hidden="true"
              className="float absolute -bottom-5 left-4 flex max-w-[85%] items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-raised sm:left-[-1.5rem] sm:p-4"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sun-soft text-sun-ink">
                <IconAlerte size={26} />
              </span>
              <span className="text-sm font-semibold sm:text-base">{tr("home.hero.alert_sample")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Langues : bandeau pleine largeur. */}
      <section aria-labelledby="choix-langue" className="bg-primary text-on-primary">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <p id="choix-langue" className="font-[family-name:var(--font-display)] text-2xl font-bold">
            {tr("home.band.langs")}
          </p>
          <div className="rounded-2xl bg-surface p-2 text-ink lg:min-w-[34rem]">
            <LanguageSwitcher current={locale} action={setLocaleAction} variant="cards" label={tr("lang.choose")} />
          </div>
        </div>
        {locale !== "fr" ? <p className="mx-auto max-w-7xl px-4 pb-4 text-sm opacity-90 sm:px-6">{tr("lang.machine_notice")}</p> : null}
      </section>

      {/* Bénéfices : grille asymétrique, la première carte domine. */}
      <section aria-labelledby="benefices" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <h2 id="benefices" className="reveal mb-6 max-w-2xl text-3xl sm:text-4xl">
          {tr("pub.benefits")}
        </h2>
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr] lg:grid-rows-2">
          {BENEFITS.map(({ key, icon: Icon, chip, photo }, idx) => {
            const title = tr(`pub.benefit.${key}.title`);
            const text = tr(`pub.benefit.${key}.text`);
            const big = idx === 0;
            return (
              <li
                key={key}
                className={`reveal lift group relative flex overflow-hidden rounded-3xl border border-line bg-surface shadow-card ${big ? "flex-col md:col-span-2 lg:col-span-1 lg:row-span-2" : "flex-col sm:flex-row lg:flex-col xl:flex-row"}`}
              >
                <div className={`relative overflow-hidden ${big ? "aspect-[16/10] lg:aspect-auto lg:min-h-80 lg:flex-1" : "aspect-[16/9] shrink-0 sm:aspect-auto sm:w-1/3 lg:aspect-[16/7] lg:w-auto xl:aspect-auto xl:w-1/3"}`}>
                  <Image
                    src={photo}
                    alt={tr(`home.benefit.${key}.photo`)}
                    fill
                    sizes={big ? "(min-width: 1024px) 55vw, 100vw" : "(min-width: 1024px) 18vw, (min-width: 640px) 40vw, 100vw"}
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className={`flex items-start gap-4 p-5 ${big ? "" : "flex-1"}`}>
                  <span className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${chip}`}>
                    <Icon size={34} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className={big ? "text-2xl" : "text-lg"}>{title}</h3>
                    <p className="mt-1 text-base text-ink-muted">{text}</p>
                  </div>
                  <ListenButton text={`${title}. ${text}`} lang={locale} labels={labels} variant="icon" />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Bande photo : défilement horizontal sur mobile. */}
      <section aria-labelledby="photos" className="border-y border-line bg-sunken py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="photos" className="reveal mb-6 text-2xl sm:text-3xl">
            {tr("home.photos.title")}
          </h2>
        </div>
        <ul className="mx-auto flex max-w-7xl snap-x gap-4 overflow-x-auto px-4 pb-2 sm:px-6 lg:grid lg:grid-cols-4 lg:overflow-visible">
          {STRIP.map(({ src, key }, i) => (
            <li key={key} className={`reveal relative w-64 shrink-0 snap-start lg:w-auto ${i % 2 ? "lg:mt-10" : ""}`}>
              <figure className="lift overflow-hidden rounded-2xl bg-surface shadow-card">
                <div className="relative aspect-[3/4]">
                  <Image src={src} alt={tr(`home.photos.${key}`)} fill sizes="(min-width: 1024px) 22vw, 16rem" className="object-cover" />
                </div>
                <figcaption className="px-3 py-2 text-sm font-semibold">{tr(`home.photos.${key}`)}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      {/* Accès publics + vérification de quittance, côte à côte. */}
      <section aria-labelledby="acces-public" className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:py-16">
        <div className="flex flex-col gap-3">
          <h2 id="acces-public" className="reveal text-2xl sm:text-3xl">
            {tr("pub.public_access")}
          </h2>
          <ul className="flex flex-col gap-3">
            {[
              { href: "/reglementation", icon: IconRegle, label: tr("nav.regulation"), hint: tr("pub.reg_hint") },
              { href: "/marche", icon: IconVendre, label: tr("home.market_prices"), hint: tr("pub.market_hint") },
            ].map(({ href, icon: Icon, label, hint }) => (
              <li key={href} className="reveal">
                <Link
                  href={href}
                  className="lift flex min-h-touch-lg items-center gap-4 rounded-2xl border-2 border-line bg-surface p-4 text-ink no-underline hover:border-primary"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon size={30} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-lg font-bold">{label}</span>
                    <span className="text-sm text-ink-muted">{hint}</span>
                  </span>
                  <IconChevron size={24} className="shrink-0 text-ink-muted transition-transform group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div id="verifier" className="reveal scroll-mt-4 self-start rounded-3xl border border-line bg-surface p-6 shadow-card">
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
    </PublicFrame>
  );
}
