import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IconCheck, IconHorsLigne, getCropIcon } from "@/components/icons";
import { Button, Callout, Card, EmptyState, ListenButton, LoadingBlock, PageHeader, WeatherStrip, type Severity } from "@/components/ui";
import { assertOwner, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { forecastWindow, summarizeForecast, toBeninDate, todayInBenin, type Forecast } from "@/lib/monitoring";
import { idSchema } from "@/lib/validation";
import { analyzeParcel, evidenceByAlert, listUserAlerts, refreshParcel, type UserAlert } from "@/server/monitoring";
import { evidenceFor, pageI18n, type PageI18n } from "@/server/monitoring/present";
import { AlertCard } from "../../alertes/_components/AlertCard";
import { MarkRead } from "../../alertes/_components/MarkRead";
import { CropCalendar } from "../_components/CropCalendar";
import { RefreshButton } from "../_components/RefreshButton";
import { ForecastDay } from "../_components/weather";

export const metadata: Metadata = { title: "Mon champ" };

const SEVERITY_RANK: Record<Severity, number> = { INFO: 0, WARNING: 1, CRITICAL: 2 };

function localName(c: { nameFr: string; nameFon: string | null; nameYo: string | null }, locale: string) {
  return locale === "fon" ? (c.nameFon ?? c.nameFr) : locale === "yo" ? (c.nameYo ?? c.nameFr) : c.nameFr;
}

export default async function ParcelPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("FARMER");
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();

  const parcel = await prisma.parcel.findUnique({
    where: { id: id.data },
    select: {
      id: true,
      name: true,
      ownerId: true,
      areaHa: true,
      communeId: true,
      commune: { select: { name: true } },
      plantings: {
        orderBy: [{ status: "asc" }, { sowingDate: "desc" }],
        take: 10,
        select: {
          id: true,
          status: true,
          sowingDate: true,
          expectedHarvestDate: true,
          crop: { select: { slug: true, icon: true, nameFr: true, nameFon: true, nameYo: true, sowingMonths: true, harvestMonths: true } },
        },
      },
    },
  });
  // Anti-IDOR : 404 si le champ n'existe pas ou n'appartient pas à l'utilisateur.
  if (!parcel) notFound();
  assertOwner(user, parcel.ownerId);

  const i = await pageI18n();
  const current = parcel.plantings.filter((p) => p.status !== "HARVESTED");
  const main = current.find((p) => p.status === "GROWING") ?? current[0] ?? parcel.plantings[0];
  const CropIcon = getCropIcon(main?.crop.icon ?? main?.crop.slug);
  const subtitle = [
    main ? localName(main.crop, i.locale) : null,
    i.tr("common.ha", { count: i.fmtNum(parcel.areaHa, 2) }),
    parcel.commune.name,
  ]
    .filter(Boolean)
    .join(" · ");
  const currentMonth = Number(todayInBenin().slice(5, 7));

  return (
    <>
      <PageHeader
        title={parcel.name}
        icon={<CropIcon size={36} />}
        subtitle={subtitle}
        backHref="/app/parcelles"
        backLabel={i.tr("parcel.list_title")}
        actions={
          <RefreshButton
            parcelId={parcel.id}
            labels={{
              refresh: i.tr("mon.refresh"),
              refreshing: i.tr("mon.refreshing"),
              done: i.tr("mon.refresh_done"),
              stale: i.tr("mon.weather_stale_short"),
              error: i.tr("weather.unavailable"),
              offline: i.tr("error.network"),
            }}
          />
        }
      />

      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <LoadingBlock shape="cards" count={1} label={i.tr("mon.loading_weather")} />
            <LoadingBlock shape="weather" count={7} label="" />
          </div>
        }
      >
        <ParcelLive i={i} userId={user.id} parcel={{ id: parcel.id, communeId: parcel.communeId }} hasPlanned={current.some((p) => p.status === "PLANNED")} harvestSoon={current.some((p) => p.status === "GROWING" && p.expectedHarvestDate.getTime() - Date.now() < 15 * 86_400_000)} />
      </Suspense>

      <Card as="section" className="mt-6" title={i.tr("parcel.calendar")}>
        {current.length === 0 ? (
          <p className="text-base text-ink-muted">{i.tr("mon.calendar.none")}</p>
        ) : (
          <div className="flex flex-col gap-6">
            {current.map((p) => (
              <CropCalendar
                key={p.id}
                i={i}
                currentMonth={currentMonth}
                planting={{
                  id: p.id,
                  status: p.status,
                  sowingDate: p.sowingDate,
                  expectedHarvestDate: p.expectedHarvestDate,
                  cropName: localName(p.crop, i.locale),
                  sowingMonths: p.crop.sowingMonths,
                  harvestMonths: p.crop.harvestMonths,
                }}
              />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

/** Météo (rafraîchie si le snapshot a expiré) + analyse + alertes du champ. Rendu en flux. */
async function ParcelLive({
  i,
  userId,
  parcel,
  hasPlanned,
  harvestSoon,
}: {
  i: PageI18n;
  userId: string;
  parcel: { id: string; communeId: string };
  hasPlanned: boolean;
  harvestSoon: boolean;
}) {
  const weather = await refreshParcel(parcel.id);
  let analysisFailed = false;
  if (weather.forecast) {
    try {
      await analyzeParcel(parcel.id, { weather });
    } catch (err) {
      analysisFailed = true;
      console.error("[parcelle] analyse à l'ouverture", { parcelId: parcel.id }, err);
    }
  }

  const all = await listUserAlerts(userId, { take: 100 });
  const alerts = all.filter(
    (x) => x.active && (x.alert.parcelId === parcel.id || (x.alert.parcelId === null && x.alert.communeId === parcel.communeId)),
  );
  const evidence = await evidenceByAlert(alerts.map((x) => x.alert.id));
  const unread = alerts.filter((x) => x.status === "SENT").map((x) => x.alert.id);

  return (
    <>
      {unread.length > 0 ? <MarkRead alertIds={unread} /> : null}
      <section aria-labelledby="alertes-champ" className="mb-6">
        <h2 id="alertes-champ" className="mb-3 text-lg">
          {i.tr("mon.parcel_alerts")}
        </h2>
        {analysisFailed ? (
          <Callout tone="warning" title={i.tr("mon.analysis_failed")} className="mb-3">
            {i.tr("mon.error_kept")}
          </Callout>
        ) : null}
        {alerts.length === 0 ? (
          <EmptyState
            icon={<IconCheck size={44} />}
            title={i.tr("mon.parcel_no_alert")}
            listen={<ListenButton {...i.listen(["mon.parcel_no_alert"])} />}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {alerts.map((item) => (
              <li key={item.alert.id}>
                <AlertCard item={item} i={i} evidence={evidenceFor(item.alert, evidence, i)} titleAs="h3" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <WeatherSection i={i} weather={weather} alerts={alerts} hasPlanned={hasPlanned} harvestSoon={harvestSoon} />
    </>
  );
}

function WeatherSection({
  i,
  weather,
  alerts,
  hasPlanned,
  harvestSoon,
}: {
  i: PageI18n;
  weather: Awaited<ReturnType<typeof refreshParcel>>;
  alerts: UserAlert[];
  hasPlanned: boolean;
  harvestSoon: boolean;
}) {
  if (!weather.forecast) {
    return (
      <Card as="section" title={i.tr("weather.title")}>
        <Callout tone="critical" role="alert" title={i.tr("weather.unavailable")}>
          {i.tr("mon.weather_retry_later")}
        </Callout>
      </Card>
    );
  }

  const today = todayInBenin();
  const days = forecastWindow(weather.forecast.days, today);
  const shown = days.length > 0 ? days : weather.forecast.days.slice(-7);
  const summary = summarizeForecast({ ...weather.forecast, days: shown } as Forecast);

  // Jour touché par une alerte : la sévérité la plus haute couvrant ce jour.
  const severityByDay = new Map<string, Severity>();
  for (const { alert } of alerts) {
    const from = toBeninDate(alert.validFrom);
    const until = toBeninDate(alert.validUntil);
    for (const d of shown) {
      if (d.date < from || d.date > until) continue;
      const prev = severityByDay.get(d.date);
      if (!prev || SEVERITY_RANK[alert.severity] > SEVERITY_RANK[prev]) severityByDay.set(d.date, alert.severity);
    }
  }

  const parts: Array<[string, Record<string, string | number>?]> = [
    ["mon.summary.rain", { days: summary.days, value: i.fmtNum(summary.rainTotalMm) }],
    [summary.waterBalanceMm < 0 ? "mon.summary.drying" : "mon.summary.wet", { value: i.fmtNum(Math.abs(summary.waterBalanceMm)) }],
    ["mon.summary.dry_days", { count: summary.dryDays, run: summary.maxConsecutiveDryDays }],
  ];
  if (summary.tmaxMax !== null && summary.tmaxMaxDate) {
    parts.push(["mon.summary.hottest", { value: i.fmtNum(summary.tmaxMax), date: i.fmtIsoDay(summary.tmaxMaxDate) }]);
  }
  if (harvestSoon && summary.bestHarvestDay) parts.push(["mon.summary.best_harvest", { date: i.fmtIsoDay(summary.bestHarvestDay) }]);
  if (hasPlanned && summary.bestSowingDay) parts.push(["mon.summary.best_sowing", { date: i.fmtIsoDay(summary.bestSowingDay) }]);

  const updated = weather.fetchedAt
    ? `Open-Meteo · ${i.tr("weather.updated", { time: i.fmtTime(weather.fetchedAt) })}${
        weather.fetchedAt.getTime() < Date.now() - 20 * 60 * 60 * 1000 ? ` (${i.fmtDate(weather.fetchedAt)})` : ""
      }`
    : "Open-Meteo";

  return (
    <Card as="section" title={i.tr("weather.title")} actions={<ListenButton variant="icon" {...i.listenParts(parts)} />}>
      {weather.stale ? (
        <Callout tone="offline" icon={<IconHorsLigne size={28} />} title={i.tr("mon.weather_stale")} className="mb-3">
          {i.tr("mon.weather_stale_hint", { date: weather.fetchedAt ? i.fmtDate(weather.fetchedAt, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "" })}
        </Callout>
      ) : null}
      <WeatherStrip label={i.tr("weather.title")}>
        {shown.map((d) => (
          <ForecastDay key={d.date} day={d} i={i} todayIso={today} alert={severityByDay.get(d.date)} />
        ))}
      </WeatherStrip>
      <p className="mt-1 text-sm text-ink-muted">{updated}</p>

      <ul className="mt-4 flex flex-col gap-1.5 text-base">
        {parts.map(([key, vars]) => (
          <li key={key}>{i.tr(key, vars)}</li>
        ))}
      </ul>
      {days.length === 0 ? (
        <div className="mt-3">
          <Button href="." variant="secondary" size="sm">
            {i.tr("common.retry")}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
