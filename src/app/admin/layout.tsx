import type { ReactNode } from "react";
import type { Metadata } from "next";
import type { NavItem } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getTranslator } from "@/server/content/ui/i18n";
import { StaffShell } from "../agent/_ui/StaffShell";

export const metadata: Metadata = { title: { template: "%s · Administration", default: "Administration" } };

/**
 * Espace ADMIN (CMS). Rôle vérifié ici côté serveur ; chaque page et chaque
 * Server Action (src/app/admin/actions.ts) le revérifie.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("ADMIN");
  const { tr } = await getTranslator();
  const items: NavItem[] = [
    { href: "/admin", label: tr("adm.nav.overview"), icon: "graphique", exact: true },
    { href: "/admin/utilisateurs", label: tr("admin.users"), icon: "utilisateur" },
    { href: "/admin/reglementation", label: tr("adm.nav.regulations"), icon: "regle" },
    { href: "/admin/ravageurs", label: tr("adm.nav.pests"), icon: "insecte" },
    { href: "/admin/cultures", label: tr("admin.crops"), icon: "semis" },
    { href: "/admin/prix", label: tr("adm.nav.prices"), icon: "vendre" },
    { href: "/admin/redevances", label: tr("adm.nav.levies"), icon: "payer" },
    { href: "/admin/audit", label: tr("admin.audit"), icon: "horloge" },
    { href: "/agent", label: tr("adm.nav.agent_space"), icon: "carte", exact: true },
    { href: "/agent/profil", label: tr("profile.title"), icon: "utilisateur" },
  ];
  return (
    <StaffShell user={user} items={items} homeHref="/admin">
      {children}
    </StaffShell>
  );
}
