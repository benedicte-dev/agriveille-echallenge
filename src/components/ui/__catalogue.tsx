"use client";

/**
 * Catalogue visuel de tous les composants (revue design, tests e2e visuels).
 * À monter sur une route de développement, ex. src/app/(dev)/catalogue/page.tsx :
 *   import { Catalogue } from "@/components/ui/__catalogue";
 *   export default function Page() { return <Catalogue />; }
 * AppShell et PublicShell occupent toute la page : ils sont décrits, pas montés ici.
 */
import { useState, type ReactNode } from "react";
import {
  IconAlerte,
  IconCalendrier,
  IconChamp,
  IconCheck,
  IconGraphique,
  IconInsecte,
  IconPayer,
  IconRegle,
  IconSignaler,
  IconVendre,
  cropIcons,
  icons,
} from "@/components/icons";
import {
  Badge,
  Button,
  Callout,
  Card,
  ContrastToggle,
  DataTable,
  EmptyState,
  Field,
  IconTile,
  Input,
  LanguageSwitcher,
  ListenButton,
  LoadingBlock,
  PageHeader,
  PinPad,
  Select,
  SeverityBadge,
  StatCard,
  Textarea,
  TileGrid,
  WeatherDay,
  WeatherStrip,
  weatherCondition,
  type UiLocale,
} from "./index";

const SWATCHES = [
  "canvas",
  "surface",
  "sunken",
  "ink",
  "ink-muted",
  "line",
  "line-strong",
  "primary",
  "primary-soft",
  "earth",
  "earth-soft",
  "sun",
  "sun-ink",
  "sun-soft",
  "info",
  "info-soft",
  "warning",
  "warning-soft",
  "critical",
  "critical-soft",
  "success",
  "success-soft",
] as const;

const WEEK = [
  { d: "Auj.", tMax: 33, tMin: 23, rain: 0, wind: 14, hum: 62 },
  { d: "Ven. 26", tMax: 34, tMin: 24, rain: 0.4, wind: 18, hum: 70 },
  { d: "Sam. 27", tMax: 31, tMin: 23, rain: 6, wind: 22, hum: 84 },
  { d: "Dim. 28", tMax: 29, tMin: 22, rain: 58, wind: 41, hum: 92 },
  { d: "Lun. 29", tMax: 30, tMin: 22, rain: 12, wind: 20, hum: 88 },
  { d: "Mar. 30", tMax: 32, tMin: 23, rain: 0, wind: 16, hum: 81 },
  { d: "Mer. 1", tMax: 39, tMin: 25, rain: 0, wind: 12, hum: 55 },
];

type Row = { id: string; commune: string; crop: string; status: "PENDING" | "CONFIRMED"; date: string; km: number };
const ROWS: Row[] = [
  { id: "r1", commune: "Bohicon", crop: "Maïs", status: "PENDING", date: "25/09/2026", km: 3 },
  { id: "r2", commune: "Parakou", crop: "Manioc", status: "CONFIRMED", date: "24/09/2026", km: 11 },
  { id: "r3", commune: "Djougou", crop: "Niébé", status: "PENDING", date: "23/09/2026", km: 7 },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-line pt-6">
      <h2 id={id} className="text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Catalogue() {
  const [locale, setLocale] = useState<UiLocale>("fr");
  const [pin, setPin] = useState("");

  return (
    <main id="contenu" tabIndex={-1} className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 outline-none">
      <PageHeader
        title="Catalogue AgriVeille"
        subtitle="Tous les composants, sur les tokens de globals.css."
        icon={<IconGraphique size={32} />}
        backHref="/"
        listen={{ text: "Catalogue des composants AgriVeille", lang: "fr" }}
        actions={<ContrastToggle showLabel />}
      />

      <Section id="cat-tokens" title="Couleurs (rôles)">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {SWATCHES.map((s) => (
            <li key={s} className="overflow-hidden rounded-lg border border-line bg-surface text-sm">
              <span className="block h-12 border-b border-line" style={{ background: `var(--color-${s})` }} />
              <span className="block px-2 py-1 font-mono">{s}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="cat-type" title="Typographie">
        <div className="flex flex-col gap-2">
          <p className="text-3xl font-bold tabular-nums">36 · 1 250 000 FCFA</p>
          <p className="text-2xl font-bold">30 · Titre de page bureau</p>
          <p className="text-xl font-bold">24 · Titre de page mobile</p>
          <p className="text-lg font-bold">20 · Libellé de tuile</p>
          <p className="text-base">17 · Corps : Ablawa, votre champ de maïs à Bohicon a besoin d&apos;eau.</p>
          <p className="text-base" lang="fon">17 · Fɔngbe : Mǐ ɖò nǔ wɛ ɖò gbɛ̀ ɔ mɛ.</p>
          <p className="text-base" lang="yo">17 · Yorùbá : Ẹ ṣé o, ọ̀rẹ́ mi. Ojú ọjọ́ dára.</p>
          <p className="text-sm text-ink-muted">15 · Tableau agent, métadonnées</p>
        </div>
      </Section>

      <Section id="cat-buttons" title="Boutons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primaire</Button>
          <Button variant="secondary">Secondaire</Button>
          <Button variant="danger">Rejeter</Button>
          <Button variant="ghost">Discret</Button>
          <Button disabled>Désactivé</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Petit 48</Button>
          <Button size="md">Moyen 56</Button>
          <Button size="lg" icon={<IconCheck size={24} />}>
            Grand 64
          </Button>
          <Button loading loadingLabel="Envoi…">
            Envoyer
          </Button>
          <Button href="/app/signaler" variant="secondary" icon={<IconSignaler size={22} />}>
            Lien bouton
          </Button>
        </div>
        <Button size="lg" block icon={<IconCheck size={28} />}>
          J&apos;ai compris
        </Button>
      </Section>

      <Section id="cat-badges" title="Badges et sévérités">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity="INFO" />
          <SeverityBadge severity="WARNING" />
          <SeverityBadge severity="CRITICAL" />
          <SeverityBadge severity="CRITICAL" size="md" />
          <Badge tone="primary">Payé</Badge>
          <Badge tone="earth">Export</Badge>
          <Badge tone="sun">Démo</Badge>
          <Badge tone="neutral">En attente</Badge>
          <Badge tone="success" icon={<IconCheck size={16} />}>
            Validé
          </Badge>
        </div>
      </Section>

      <Section id="cat-states" title="Les cinq états">
        <LoadingBlock label="Chargement de la météo…" shape="weather" count={5} />
        <EmptyState
          kind="first-use"
          icon={<IconChamp size={44} />}
          title="Vous n'avez pas encore de champ"
          message="Ajoutez votre premier champ pour recevoir la météo et les alertes."
          action={<Button size="lg">Ajouter un champ</Button>}
        />
        <EmptyState
          kind="no-results"
          icon={<IconInsecte size={44} />}
          title="Aucun signalement pour ce filtre"
          message="Essayez une autre commune ou une autre période."
          action={<Button variant="secondary">Effacer les filtres</Button>}
        />
        <Callout tone="critical" role="alert" title="L'envoi n'a pas marché" action={<Button variant="secondary">Réessayer</Button>}>
          Votre photo est gardée sur le téléphone. Réessayez dans un moment.
        </Callout>
        <Callout tone="offline" title="Hors ligne">
          Vous pouvez continuer. Tout sera envoyé au retour du réseau.
        </Callout>
        <Callout tone="success" role="status" title="Signalement envoyé">
          Un agent va le regarder. Vous recevrez une réponse ici.
        </Callout>
        <Callout tone="warning" title="Pas de pluie depuis 9 jours">
          Arrosez tôt le matin si vous pouvez.
        </Callout>
      </Section>

      <Section id="cat-tiles" title="Tableau de bord fermier (6 tuiles)">
        <TileGrid label="Mon espace">
          <IconTile href="/app/parcelles" icon={<IconChamp size={44} />} label="Mes champs" hint="3 champs" tone="primary" />
          <IconTile
            href="/app/alertes"
            icon={<IconAlerte size={44} />}
            label="Alertes"
            badge={3}
            badgeLabel="3 nouvelles alertes"
            tone="sun"
          />
          <IconTile href="/app/signaler" icon={<IconSignaler size={44} />} label="Signaler" tone="critical" />
          <IconTile href="/app/marche" icon={<IconVendre size={44} />} label="Vendre" tone="earth" />
          <IconTile href="/app/redevances" icon={<IconPayer size={44} />} label="Payer" hint="Quittances" tone="info" />
          <IconTile href="/reglementation" icon={<IconRegle size={44} />} label="Règles" tone="neutral" />
        </TileGrid>
      </Section>

      <Section id="cat-cards" title="Cartes, indicateurs, météo">
        <Card
          title="Maïs · Champ derrière la maison"
          accent="warning"
          actions={<ListenButton text="Maïs, champ derrière la maison. Pas de pluie depuis neuf jours." lang="fr" variant="icon" />}
        >
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity="WARNING" />
            <span className="text-base">Sécheresse : pas de pluie depuis 9 jours.</span>
          </div>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Alertes actives" value="12" icon={<IconAlerte size={24} />} tone="warning" hint="3 critiques" />
          <StatCard label="Taux d'accusés" value="78" unit="%" icon={<IconCheck size={24} />} hint="94 sur 120" />
          <StatCard label="Signalements à valider" value="5" icon={<IconInsecte size={24} />} tone="critical" />
          <StatCard label="Recettes du mois" value="1 250 000" unit="FCFA" icon={<IconPayer size={24} />} tone="earth" />
        </div>
        <WeatherStrip label="Météo des 7 prochains jours">
          {WEEK.map((w, i) => (
            <WeatherDay
              key={w.d}
              dayLabel={w.d}
              today={i === 0}
              condition={weatherCondition({ rainMm: w.rain, windKmh: w.wind, humidity: w.hum })}
              tMax={w.tMax}
              tMin={w.tMin}
              rainMm={w.rain}
              windKmh={w.wind}
              alert={w.rain >= 50 ? "WARNING" : w.tMax >= 38 ? "WARNING" : undefined}
            />
          ))}
        </WeatherStrip>
        <DataTable<Row>
          caption="Signalements récents"
          captionVisible
          rows={ROWS}
          rowKey={(r) => r.id}
          columns={[
            { key: "commune", header: "Commune", cell: (r) => r.commune, primary: true },
            { key: "crop", header: "Culture", cell: (r) => r.crop },
            {
              key: "status",
              header: "Statut",
              cell: (r) =>
                r.status === "PENDING" ? <Badge tone="neutral">En attente</Badge> : <Badge tone="success">Confirmé</Badge>,
            },
            { key: "date", header: "Date", cell: (r) => r.date },
            { key: "km", header: "Distance", cell: (r) => `${r.km} km`, align: "end", hideOnMobile: true },
          ]}
        />
      </Section>

      <Section id="cat-forms" title="Formulaires">
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="cat-qty" label="Quantité (kg)" hint="Exemple : 200" required>
            {(a) => <Input {...a} name="quantityKg" inputMode="numeric" />}
          </Field>
          <Field id="cat-price" label="Prix par kg (FCFA)" error="Le prix doit être un nombre.">
            {(a) => <Input {...a} name="price" inputMode="numeric" defaultValue="abc" />}
          </Field>
          <Field id="cat-market" label="Marché">
            {(a) => (
              <Select {...a} name="market" defaultValue="LOCAL">
                <option value="LOCAL">Local</option>
                <option value="EXPORT">Export</option>
              </Select>
            )}
          </Field>
          <Field id="cat-note" label="Note (facultatif)" hint="Qualité, lieu de retrait…">
            {(a) => <Textarea {...a} name="note" />}
          </Field>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          <PinPad name="phone" mode="phone" label="Votre numéro" hint="Exemple : 01 97 00 00 01" />
          <PinPad
            name="pin"
            label="Votre code secret"
            onChange={setPin}
            error={pin.length === 4 && pin !== "1234" ? "Code incorrect. Il reste 4 essais." : undefined}
          />
        </div>
      </Section>

      <Section id="cat-lang" title="Langue et voix">
        <LanguageSwitcher current={locale} action={setLocale} variant="cards" />
        <LanguageSwitcher current={locale} action={setLocale} />
        <div className="flex flex-wrap gap-3">
          <ListenButton text="Bonjour Ablawa. Il va pleuvoir dimanche." lang="fr" />
          <ListenButton text="Bonjour" lang="fon" />
          <ListenButton text="Bonjour" lang="yo" audioSrc="/audio/yo/absent.mp3" />
        </div>
      </Section>

      <Section id="cat-icons" title="Pictogrammes">
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
          {Object.entries(icons).map(([k, I]) => (
            <li key={k} className="flex flex-col items-center gap-1 rounded-lg bg-surface p-2 text-center text-xs">
              <I size={32} />
              <span className="font-mono break-all">{k}</span>
            </li>
          ))}
        </ul>
        <h3 className="text-lg">Cultures</h3>
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {Object.entries(cropIcons).map(([k, I]) => (
            <li key={k} className="flex flex-col items-center gap-1 rounded-lg bg-surface p-2 text-center text-xs text-primary">
              <I size={40} />
              <span className="font-mono text-ink">{k}</span>
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <IconCalendrier size={20} /> 24 × 24, trait 2 px, currentColor.
        </p>
      </Section>
    </main>
  );
}
