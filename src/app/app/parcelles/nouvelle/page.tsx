import type { Metadata } from "next";
import { IconPlus } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayInBenin } from "@/lib/monitoring";
import { pageI18n } from "@/server/monitoring/present";
import { NewParcelForm } from "../_components/NewParcelForm";

export const metadata: Metadata = { title: "Ajouter un champ" };

function localName(c: { nameFr: string; nameFon: string | null; nameYo: string | null }, locale: string) {
  return locale === "fon" ? (c.nameFon ?? c.nameFr) : locale === "yo" ? (c.nameYo ?? c.nameFr) : c.nameFr;
}

export default async function NouvelleParcellePage() {
  const user = await requireRole("FARMER");
  const i = await pageI18n();

  const [crops, communes] = await Promise.all([
    prisma.crop.findMany({
      orderBy: { nameFr: "asc" },
      take: 50,
      select: { id: true, slug: true, icon: true, nameFr: true, nameFon: true, nameYo: true },
    }),
    prisma.commune.findMany({ orderBy: { name: "asc" }, take: 200, select: { id: true, name: true, department: true } }),
  ]);

  return (
    <>
      <PageHeader
        title={i.tr("parcel.new")}
        icon={<IconPlus size={32} />}
        backHref="/app/parcelles"
        backLabel={i.tr("parcel.list_title")}
        listen={i.listen(["parcel.new", "mon.new.listen"])}
      />
      <NewParcelForm
        crops={crops.map((c) => ({ id: c.id, label: localName(c, i.locale), icon: c.icon || c.slug }))}
        communes={communes.map((c) => ({ id: c.id, label: `${c.name} (${c.department})` }))}
        defaultCommuneId={user.communeId && communes.some((c) => c.id === user.communeId) ? user.communeId : null}
        today={todayInBenin()}
        labels={{
          crop: i.tr("parcel.choose_crop"),
          commune: i.tr("parcel.commune"),
          communePlaceholder: i.tr("mon.new.commune_placeholder"),
          location: i.tr("parcel.location"),
          locationHint: i.tr("mon.new.location_hint"),
          useMyLocation: i.tr("parcel.use_my_location"),
          locating: i.tr("mon.new.locating"),
          located: i.tr("mon.new.located"),
          geoError: i.tr("mon.new.geo_error"),
          name: i.tr("parcel.name"),
          nameHint: i.tr("mon.new.name_hint"),
          area: i.tr("parcel.area"),
          sowingDate: i.tr("parcel.sowing_date"),
          submit: i.tr("parcel.new"),
          saving: i.tr("mon.new.saving"),
          required: i.tr("common.required"),
        }}
      />
    </>
  );
}
