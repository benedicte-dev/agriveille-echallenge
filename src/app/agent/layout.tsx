import type { ReactNode } from "react";
import type { NavItem } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { countPendingReports } from "@/server/reports";
import { getTranslator } from "@/server/content/ui/i18n";
import { StaffShell } from "./_ui/StaffShell";

/**
 * Espace AGENT (ADMIN passe aussi : hasRole). Le rôle est vérifié ici côté
 * serveur ; chaque page et chaque Server Action le revérifie.
 */
export default async function AgentLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("AGENT");
  const [{ tr }, pending] = await Promise.all([getTranslator(), countPendingReports(user)]);

  const items: NavItem[] = [
    { href: "/agent", label: tr("agt.nav.dashboard"), icon: "graphique", exact: true },
    {
      href: "/agent/signalements",
      label: tr("agent.reports"),
      icon: "signaler",
      badge: pending,
      badgeLabel: tr("agt.nav.pending", { count: pending }),
    },
    { href: "/agent/alertes", label: tr("agt.nav.alerts"), icon: "alerte" },
    { href: "/agent/recettes", label: tr("agent.revenue"), icon: "payer" },
    { href: "/agent/sms", label: tr("agt.nav.sms"), icon: "telephone" },
  ];
  if (user.role === "ADMIN") items.push({ href: "/admin", label: tr("admin.title"), icon: "regle" });

  return (
    <StaffShell user={user} items={items} homeHref="/agent">
      {children}
    </StaffShell>
  );
}
