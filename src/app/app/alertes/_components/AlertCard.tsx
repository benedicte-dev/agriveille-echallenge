import Link from "next/link";
import { IconChevron, IconInfo, alertTypeIcons } from "@/components/icons";
import { Card, ListenButton, SeverityBadge, type Severity } from "@/components/ui";
import type { UserAlert } from "@/server/monitoring";
import { alertInLocale, type PageI18n } from "@/server/monitoring/present";
import { AckButton } from "./AckButton";

const ACCENT: Record<Severity, "info" | "warning" | "critical"> = { INFO: "info", WARNING: "warning", CRITICAL: "critical" };

export function severityLabels(i: PageI18n): Record<Severity, string> {
  return {
    INFO: i.tr("alert.severity.INFO"),
    WARNING: i.tr("alert.severity.WARNING"),
    CRITICAL: i.tr("alert.severity.CRITICAL"),
  };
}

export function ackLabels(i: PageI18n) {
  return { ack: i.tr("alert.ack"), acked: i.tr("alert.acked"), error: i.tr("error.generic"), offline: i.tr("mon.ack_offline") };
}

/**
 * Carte d'alerte fermier : sévérité (forme + mot + couleur), titre, message,
 * conseil, chiffres déclencheurs, bouton Écouter, « J'ai compris ».
 * `compact` : liste (message court + lien vers le détail).
 */
export function AlertCard({
  item,
  i,
  evidence = [],
  compact = false,
  titleAs = "h2",
}: {
  item: UserAlert;
  i: PageI18n;
  evidence?: string[];
  compact?: boolean;
  titleAs?: "h2" | "h3";
}) {
  const a = item.alert;
  const text = alertInLocale(a, i.locale);
  const TypeIcon = alertTypeIcons[a.type];
  const acknowledged = item.status === "ACKNOWLEDGED";
  const where = a.parcel
    ? i.tr("alert.for_parcel", { name: a.parcel.name })
    : a.commune
      ? `${i.tr("alert.zone")} · ${a.commune.name}${a.radiusKm ? ` (${i.fmtNum(a.radiusKm, 0)} km)` : ""}`
      : i.tr("alert.zone");
  const spoken = [text.title, text.message, text.advice ? `${i.tr("alert.advice")} ${text.advice}` : ""].filter(Boolean).join(". ");
  const H = titleAs;

  return (
    <Card as="article" accent={ACCENT[a.severity]}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={a.severity} labels={severityLabels(i)} />
          {item.status === "SENT" && item.active ? (
            <span className="text-sm font-bold text-critical">{i.tr("alert.new")}</span>
          ) : null}
          {!item.active ? <span className="text-sm text-ink-muted">{i.tr("mon.alert_expired")}</span> : null}
        </div>

        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-12 shrink-0 items-center justify-center rounded-full bg-sunken text-ink">
            <TypeIcon size={28} />
          </span>
          <div className="min-w-0 flex-1">
            <H className="text-lg leading-snug" lang={text.lang}>
              {text.title}
            </H>
            <p className="text-sm text-ink-muted">{where}</p>
          </div>
          <ListenButton variant="icon" {...i.listenText(spoken, text.lang)} />
        </div>

        <p className="text-base" lang={text.lang}>
          {text.message}
        </p>

        {!compact && text.advice ? (
          <div className="rounded-lg bg-primary-soft p-3">
            <p className="font-bold text-ink">{i.tr("alert.advice")}</p>
            <p className="text-base text-ink" lang={text.lang}>
              {text.advice}
            </p>
          </div>
        ) : null}

        {!compact && evidence.length > 0 ? (
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <IconInfo size={18} />
              {i.tr("mon.evidence_title")}
            </p>
            <ul className="mt-1 list-disc pl-6 text-sm text-ink-muted">
              {evidence.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-sm text-ink-muted">
          {i.tr("alert.valid_until", { date: i.fmtDate(a.validUntil, { weekday: "long", day: "numeric", month: "long" }) })}
          {" · "}
          {i.tr(`alert.source.${a.source}`)}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {item.active ? (
            <div className="sm:min-w-64">
              <AckButton alertId={a.id} acknowledged={acknowledged} labels={ackLabels(i)} />
            </div>
          ) : null}
          {compact ? (
            <Link
              href={`/app/alertes/${a.id}`}
              prefetch={false}
              className="inline-flex min-h-touch items-center gap-1 rounded-lg px-2 font-semibold text-primary hover:bg-primary-soft"
            >
              <span>{i.tr("common.see_more")}</span>
              <IconChevron size={20} />
            </Link>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
