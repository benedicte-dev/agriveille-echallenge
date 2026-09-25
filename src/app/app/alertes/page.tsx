import type { Metadata } from "next";
import { IconAlerte, IconCheck } from "@/components/icons";
import { Button, EmptyState, ListenButton, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { evidenceByAlert, listUserAlerts } from "@/server/monitoring";
import { evidenceFor, pageI18n } from "@/server/monitoring/present";
import { AlertCard } from "./_components/AlertCard";
import { MarkRead } from "./_components/MarkRead";

export const metadata: Metadata = { title: "Mes alertes" };

export default async function AlertesPage() {
  const user = await requireRole("FARMER");
  const i = await pageI18n();
  const items = await listUserAlerts(user.id);
  const active = items.filter((x) => x.active);
  const past = items.filter((x) => !x.active).slice(0, 20);
  const evidence = await evidenceByAlert(active.map((x) => x.alert.id));
  const unread = active.filter((x) => x.status === "SENT").map((x) => x.alert.id);
  const pending = active.filter((x) => x.status !== "ACKNOWLEDGED").length;

  const summary = pending > 0 ? i.tr("dashboard.new_alerts", { count: pending }) : i.tr("dashboard.no_alert");

  return (
    <>
      <PageHeader
        title={i.tr("alert.title")}
        icon={<IconAlerte size={32} />}
        subtitle={summary}
        backHref="/app"
        backLabel={i.tr("common.back")}
        listen={i.listen(["alert.title", pending > 0 ? "dashboard.new_alerts" : "dashboard.no_alert"], { count: pending })}
      />
      {unread.length > 0 ? <MarkRead alertIds={unread} /> : null}

      {active.length === 0 ? (
        <EmptyState
          icon={<IconCheck size={44} />}
          title={i.tr("alert.empty")}
          message={i.tr("mon.alerts_empty_hint")}
          listen={<ListenButton {...i.listen(["alert.empty", "mon.alerts_empty_hint"])} />}
          action={
            <Button href="/app/parcelles" variant="secondary">
              {i.tr("nav.parcels")}
            </Button>
          }
        />
      ) : (
        <section aria-labelledby="alertes-actives">
          <h2 id="alertes-actives" className="sr-only">
            {i.tr("mon.alerts_active")}
          </h2>
          <ul className="flex flex-col gap-4">
            {active.map((item) => (
              <li key={item.alert.id}>
                <AlertCard item={item} i={i} evidence={evidenceFor(item.alert, evidence, i)} titleAs="h3" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 ? (
        <section aria-labelledby="alertes-passees" className="mt-8">
          <h2 id="alertes-passees" className="mb-3 text-lg">
            {i.tr("mon.alerts_past")}
          </h2>
          <ul className="flex flex-col gap-3">
            {past.map((item) => (
              <li key={item.alert.id}>
                <AlertCard item={item} i={i} compact titleAs="h3" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
