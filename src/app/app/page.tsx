import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { IconAlerte, IconChamp, IconPayer, IconRegle, IconSignaler, IconVendre } from "@/components/icons";
import { Card, IconTile, ListenButton, PageHeader, TileGrid, type TileTone } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseForecast, todayInBenin, type DailyForecast } from "@/lib/monitoring";
import { listUserAlerts } from "@/server/monitoring";
import { pageI18n, type Listen, type PageI18n } from "@/server/monitoring/present";
import { AlertCard } from "./alertes/_components/AlertCard";
import { SegmentLoading } from "./alertes/_components/Segment";
import { ForecastDay } from "./parcelles/_components/weather";

export const metadata: Metadata = { title: "Mon espace" };

export default function FarmerHomePage() {
  return (
    <Suspense fallback={<SegmentLoading />}>
      <Dashboard />
    </Suspense>
  );
}

/** Tuile + bouton Écouter posé dans l'angle (frère du lien, jamais imbriqué dedans). */
function ListenTile(props: {
  href: string;
  icon: ReactNode;
  label: string;
  hint?: string;
  badge?: number;
  badgeLabel?: string;
  tone: TileTone;
  listen: Listen;
}) {
  const { listen, ...tile } = props;
  return (
    <div className="relative h-full w-full">
      <IconTile {...tile} className="h-full w-full pt-8" />
      <ListenButton variant="icon" {...listen} className="absolute top-1.5 left-1.5" />
    </div>
  );
}

async function Dashboard() {
  const user = await requireRole("FARMER");
  const i = await pageI18n();

  const [profile, parcels, alerts, pendingOffers] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { commune: { select: { name: true } } } }),
    prisma.parcel.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
      take: 50,
    }),
    listUserAlerts(user.id, { take: 60 }),
    prisma.offer.count({ where: { status: "PENDING", listing: { sellerId: user.id } } }),
  ]);

  const pending = alerts.filter((a) => a.active && a.status !== "ACKNOWLEDGED");
  // Déjà triées : CRITICAL puis WARNING puis INFO, la plus récente d'abord.
  const urgent = pending.find((a) => a.alert.severity !== "INFO");

  const first = parcels[0];
  const snapshot = first
    ? await prisma.weatherSnapshot.findFirst({
        where: { parcelId: first.id },
        orderBy: { fetchedAt: "desc" },
        select: { payload: true },
      })
    : null;
  const todayIso = todayInBenin();
  let today: DailyForecast | undefined;
  try {
    today = snapshot ? parseForecast(snapshot.payload).days.find((d) => d.date === todayIso) : undefined;
  } catch {
    today = undefined;
  }

  const firstName = user.fullName.split(/\s+/)[0] ?? user.fullName;
  const summaryKey = pending.length > 0 ? "dashboard.new_alerts" : "dashboard.no_alert";
  const subtitle = [profile?.commune?.name, i.tr("mon.parcels_count", { count: parcels.length })].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        title={i.tr("dashboard.hello", { name: firstName })}
        subtitle={subtitle}
        listen={i.listen(["dashboard.hello", summaryKey], { name: firstName, count: pending.length })}
      />

      {urgent ? (
        <section aria-labelledby="alerte-urgente" className="mb-6">
          <h2 id="alerte-urgente" className="mb-2 text-lg">
            {i.tr("mon.urgent_alert")}
          </h2>
          <AlertCard item={urgent} i={i} compact titleAs="h3" />
        </section>
      ) : null}

      <TileGrid label={i.tr("nav.menu")}>
        <ListenTile
          href="/app/parcelles"
          icon={<IconChamp size={48} />}
          label={i.tr("tile.parcels")}
          hint={i.tr("mon.parcels_count", { count: parcels.length })}
          tone="primary"
          listen={i.listen(["tile.parcels"])}
        />
        <ListenTile
          href="/app/alertes"
          icon={<IconAlerte size={48} />}
          label={i.tr("tile.alerts")}
          badge={pending.length}
          badgeLabel={i.tr("dashboard.new_alerts", { count: pending.length })}
          tone="sun"
          listen={i.listen(["tile.alerts"])}
        />
        <ListenTile
          href="/app/signaler"
          icon={<IconSignaler size={48} />}
          label={i.tr("nav.report")}
          tone="critical"
          listen={i.listen(["tile.report"])}
        />
        <ListenTile
          href="/app/marche"
          icon={<IconVendre size={48} />}
          label={i.tr("tile.market")}
          hint={pendingOffers > 0 ? i.tr("mon.offers_count", { count: pendingOffers }) : undefined}
          tone="earth"
          listen={i.listen(["tile.market"])}
        />
        <ListenTile
          href="/app/redevances"
          icon={<IconPayer size={48} />}
          label={i.tr("mon.tile.pay")}
          hint={i.tr("tile.levies")}
          tone="info"
          listen={i.listen(["tile.levies"])}
        />
        <ListenTile
          href="/reglementation"
          icon={<IconRegle size={48} />}
          label={i.tr("nav.regulation")}
          tone="neutral"
          listen={i.listen(["nav.regulation"])}
        />
      </TileGrid>

      {first ? <TodayWeather i={i} parcel={first} day={today} todayIso={todayIso} /> : null}
    </>
  );
}

function TodayWeather({
  i,
  parcel,
  day,
  todayIso,
}: {
  i: PageI18n;
  parcel: { id: string; name: string };
  day: DailyForecast | undefined;
  todayIso: string;
}) {
  return (
    <Card as="section" className="mt-6" title={i.tr("mon.today_weather", { name: parcel.name })}>
      {day ? (
        <div className="flex flex-wrap items-center gap-4">
          <ForecastDay day={day} i={i} todayIso={todayIso} />
          <div className="flex flex-col gap-2">
            <p className="text-base">{i.tr("weather.rain_mm", { value: i.fmtNum(day.precipMm) })}</p>
            <Link
              href={`/app/parcelles/${parcel.id}`}
              className="inline-flex min-h-touch items-center font-semibold text-primary"
            >
              {i.tr("weather.title")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-base text-ink-muted">{i.tr("mon.weather_open_parcel")}</p>
          <Link href={`/app/parcelles/${parcel.id}`} className="inline-flex min-h-touch items-center font-semibold text-primary">
            {i.tr("weather.title")}
          </Link>
        </div>
      )}
    </Card>
  );
}
