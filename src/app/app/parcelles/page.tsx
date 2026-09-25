import type { Metadata } from "next";
import Link from "next/link";
import { IconChamp, IconChevron, IconPlus, getCropIcon } from "@/components/icons";
import { Badge, Button, EmptyState, ListenButton, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pageI18n } from "@/server/monitoring/present";

export const metadata: Metadata = { title: "Mes champs" };

/** Borne de la liste (le formulaire en limite la création à 30). */
const MAX_LISTED = 50;

function localName(c: { nameFr: string; nameFon: string | null; nameYo: string | null }, locale: string) {
  return locale === "fon" ? (c.nameFon ?? c.nameFr) : locale === "yo" ? (c.nameYo ?? c.nameFr) : c.nameFr;
}

export default async function ParcellesPage() {
  const user = await requireRole("FARMER");
  const i = await pageI18n();
  const now = new Date();

  const parcels = await prisma.parcel.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    take: MAX_LISTED,
    select: {
      id: true,
      name: true,
      areaHa: true,
      commune: { select: { name: true } },
      plantings: {
        where: { status: { not: "HARVESTED" } },
        orderBy: { sowingDate: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          crop: { select: { slug: true, icon: true, nameFr: true, nameFon: true, nameYo: true } },
        },
      },
    },
  });

  // Alertes actives non acquittées, par champ (livraisons IN_APP de l'utilisateur uniquement).
  const pending = parcels.length
    ? await prisma.alertDelivery.findMany({
        where: {
          userId: user.id,
          channel: "IN_APP",
          status: { not: "ACKNOWLEDGED" },
          alert: { parcelId: { in: parcels.map((p) => p.id) }, validUntil: { gt: now } },
        },
        select: { alert: { select: { parcelId: true, severity: true } } },
        take: 500,
      })
    : [];
  const counts = new Map<string, { n: number; critical: boolean }>();
  for (const d of pending) {
    if (!d.alert.parcelId) continue;
    const c = counts.get(d.alert.parcelId) ?? { n: 0, critical: false };
    c.n += 1;
    c.critical ||= d.alert.severity === "CRITICAL";
    counts.set(d.alert.parcelId, c);
  }

  return (
    <>
      <PageHeader
        title={i.tr("parcel.list_title")}
        icon={<IconChamp size={32} />}
        subtitle={i.tr("mon.parcels_count", { count: parcels.length })}
        backHref="/app"
        backLabel={i.tr("common.back")}
        listen={i.listen(["parcel.list_title", "mon.parcels_count"], { count: parcels.length })}
        actions={
          parcels.length > 0 ? (
            <Button href="/app/parcelles/nouvelle" icon={<IconPlus size={24} />}>
              {i.tr("parcel.new")}
            </Button>
          ) : null
        }
      />

      {parcels.length === 0 ? (
        <EmptyState
          icon={<IconChamp size={48} />}
          title={i.tr("parcel.empty")}
          message={i.tr("mon.parcels_empty_hint")}
          listen={<ListenButton {...i.listen(["parcel.empty", "mon.parcels_empty_hint"])} />}
          action={
            <Button href="/app/parcelles/nouvelle" size="lg" icon={<IconPlus size={24} />}>
              {i.tr("parcel.new")}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {parcels.map((p) => {
            const main = p.plantings.find((x) => x.status === "GROWING") ?? p.plantings[0];
            const CropIcon = getCropIcon(main?.crop.icon ?? main?.crop.slug);
            const c = counts.get(p.id);
            const crops = p.plantings.map((x) => localName(x.crop, i.locale));
            return (
              <li key={p.id}>
                <Link
                  href={`/app/parcelles/${p.id}`}
                  className="flex min-h-touch-lg items-center gap-4 rounded-xl border-2 border-line bg-surface p-4 hover:border-primary"
                >
                  <span className="shrink-0 rounded-lg bg-primary-soft p-2 text-primary">
                    <CropIcon size={40} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-lg font-semibold text-ink">{p.name}</span>
                    <span className="text-base text-ink-muted">
                      {[crops.length ? crops.join(", ") : i.tr("mon.parcel_no_crop"), i.tr("common.ha", { count: i.fmtNum(p.areaHa, 2) }), p.commune.name].join(" · ")}
                    </span>
                    <span className="flex flex-wrap gap-2">
                      {p.plantings.slice(0, 2).map((x) => (
                        <Badge key={x.id} tone={x.status === "GROWING" ? "primary" : "neutral"}>
                          {i.tr(`parcel.status.${x.status}`)}
                        </Badge>
                      ))}
                      {c ? (
                        <Badge tone={c.critical ? "critical-strong" : "warning"}>{i.tr("mon.parcel_alert_count", { count: c.n })}</Badge>
                      ) : (
                        <Badge tone="success">{i.tr("mon.parcel_no_alert")}</Badge>
                      )}
                    </span>
                  </span>
                  <IconChevron size={24} className="shrink-0 text-ink-muted" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
