import type { Metadata } from "next";
import { IconRegle } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { RegulationForm } from "../_RegulationForm";

export const metadata: Metadata = { title: "Nouvelle fiche réglementaire" };

export default async function NewRegulationPage() {
  await requireRole("ADMIN");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nouvelle fiche réglementaire" icon={<IconRegle size={32} />} backHref="/admin/reglementation" backLabel="Retour aux fiches" />
      <RegulationForm />
    </div>
  );
}
