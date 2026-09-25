import type { ReportStatus } from "@prisma/client";
import { IconCheck, IconCroix, IconHorloge } from "@/components/icons";
import { Badge, type Tone } from "@/components/ui";

/** Statut d'un signalement : pictogramme + mot + couleur (jamais la couleur seule). */
const META: Record<ReportStatus, { tone: Tone; Icon: typeof IconCheck }> = {
  PENDING: { tone: "sun", Icon: IconHorloge },
  CONFIRMED: { tone: "success", Icon: IconCheck },
  REJECTED: { tone: "neutral", Icon: IconCroix },
};

export function ReportStatusBadge({ status, label, size = "md" }: { status: ReportStatus; label: string; size?: "sm" | "md" }) {
  const { tone, Icon } = META[status];
  return (
    <Badge tone={tone} size={size} icon={<Icon size={size === "md" ? 20 : 16} />}>
      {label}
    </Badge>
  );
}
