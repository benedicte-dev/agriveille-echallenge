import { IconCalendrier, IconRecolte, IconSemis } from "@/components/icons";
import { Badge, cx } from "@/components/ui";
import type { PageI18n } from "@/server/monitoring/present";

export type CalendarPlanting = {
  id: string;
  status: "PLANNED" | "GROWING" | "HARVESTED";
  sowingDate: Date;
  expectedHarvestDate: Date;
  cropName: string;
  sowingMonths: number[];
  harvestMonths: number[];
};

/**
 * Frise des 12 mois : semis conseillés (vert + pictogramme semis), récolte
 * (soleil + pictogramme récolte), mois courant encadré. Le sens passe aussi par
 * les pictogrammes et la légende en mots, jamais par la couleur seule.
 */
export function CropCalendar({ planting, i, currentMonth }: { planting: CalendarPlanting; i: PageI18n; currentMonth: number }) {
  const months = Array.from({ length: 12 }, (_, k) => k + 1);
  const monthName = (m: number, style: "short" | "long") =>
    i.fmtDate(new Date(Date.UTC(2026, m - 1, 15, 12)), { month: style });
  const sow = new Set(planting.sowingMonths);
  const harvest = new Set(planting.harvestMonths);
  const statusTone = planting.status === "GROWING" ? "primary" : planting.status === "PLANNED" ? "info" : "neutral";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <IconCalendrier size={24} className="text-primary" />
        <h3 className="text-lg">{planting.cropName}</h3>
        <Badge tone={statusTone}>{i.tr(`parcel.status.${planting.status}`)}</Badge>
      </div>

      <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-12" aria-label={i.tr("parcel.calendar")}>
        {months.map((m) => {
          const isSow = sow.has(m);
          const isHarvest = harvest.has(m);
          const words = [isSow ? i.tr("mon.calendar.sowing") : "", isHarvest ? i.tr("mon.calendar.harvest") : ""].filter(Boolean);
          return (
            <li
              key={m}
              aria-current={m === currentMonth ? "date" : undefined}
              className={cx(
                "flex min-h-16 flex-col items-center justify-start gap-1 rounded-lg border px-0.5 py-1.5 text-center",
                isSow && isHarvest ? "bg-sunken" : isSow ? "bg-primary-soft" : isHarvest ? "bg-sun-soft" : "bg-surface",
                m === currentMonth ? "border-2 border-ink" : "border-line",
              )}
            >
              <span className="text-xs font-bold text-ink capitalize">{monthName(m, "short")}</span>
              <span className="flex gap-0.5">
                {isSow ? <IconSemis size={18} className="text-primary" /> : null}
                {isHarvest ? <IconRecolte size={18} className="text-sun-ink" /> : null}
              </span>
              <span className="sr-only">
                {monthName(m, "long")}
                {words.length ? ` : ${words.join(", ")}` : ""}
                {m === currentMonth ? ` (${i.tr("mon.calendar.this_month")})` : ""}
              </span>
            </li>
          );
        })}
      </ol>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted" aria-hidden="true">
        <li className="inline-flex items-center gap-1">
          <IconSemis size={18} className="text-primary" /> {i.tr("mon.calendar.sowing")}
        </li>
        <li className="inline-flex items-center gap-1">
          <IconRecolte size={18} className="text-sun-ink" /> {i.tr("mon.calendar.harvest")}
        </li>
        <li className="inline-flex items-center gap-1">
          <span className="inline-block size-4 rounded border-2 border-ink" /> {i.tr("mon.calendar.this_month")}
        </li>
      </ul>

      <p className="text-base">
        {i.tr(planting.status === "PLANNED" ? "mon.calendar.sow_planned" : "mon.calendar.sown", {
          date: i.fmtDate(planting.sowingDate, { day: "numeric", month: "long", year: "numeric" }),
        })}
        {" · "}
        {i.tr("mon.calendar.harvest_expected", {
          date: i.fmtDate(planting.expectedHarvestDate, { day: "numeric", month: "long", year: "numeric" }),
        })}
      </p>
    </div>
  );
}
