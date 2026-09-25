import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconAlerte } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { evidenceByAlert, getUserAlert } from "@/server/monitoring";
import { evidenceFor, pageI18n } from "@/server/monitoring/present";
import { AlertCard } from "../_components/AlertCard";
import { MarkRead } from "../_components/MarkRead";

export const metadata: Metadata = { title: "Alerte" };

export default async function AlerteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("FARMER");
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  // Seules les alertes livrées à cet utilisateur sont visibles (anti-IDOR : 404 sinon).
  const item = await getUserAlert(user.id, parsed.data);
  if (!item) notFound();
  const i = await pageI18n();
  const evidence = await evidenceByAlert([item.alert.id]);

  return (
    <>
      <PageHeader
        title={i.tr(`alert.type.${item.alert.type}`)}
        icon={<IconAlerte size={32} />}
        backHref="/app/alertes"
        backLabel={i.tr("alert.title")}
      />
      {item.status === "SENT" ? <MarkRead alertIds={[item.alert.id]} /> : null}
      <AlertCard item={item} i={i} evidence={evidenceFor(item.alert, evidence, i)} />
    </>
  );
}
