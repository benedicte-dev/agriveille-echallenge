import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AppShell, ContrastToggle, CONTRAST_COOKIE, type NavItem } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { countUnacknowledged } from "@/server/monitoring";
import { pageI18n } from "@/server/monitoring/present";

/**
 * Espace FARMER. Le rôle est vérifié ici côté serveur (le proxy ne fait qu'un
 * contrôle optimiste du cookie) ; chaque page et chaque action le revérifie.
 * La langue et le dictionnaire viennent du I18nProvider du layout racine.
 */
export default async function FarmerLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("FARMER");
  const [i, unacked, store] = await Promise.all([pageI18n(), countUnacknowledged(user.id), cookies()]);
  const highContrast = store.get(CONTRAST_COOKIE)?.value === "high";

  const items: NavItem[] = [
    { href: "/app", label: i.tr("nav.home"), icon: "accueil", exact: true },
    { href: "/app/parcelles", label: i.tr("nav.parcels"), icon: "champ" },
    {
      href: "/app/alertes",
      label: i.tr("nav.alerts"),
      icon: "alerte",
      badge: unacked,
      badgeLabel: i.tr("dashboard.new_alerts", { count: unacked }),
    },
    { href: "/app/profil", label: i.tr("nav.profile"), icon: "utilisateur" },
  ];

  return (
    <AppShell
      variant="farmer"
      items={items}
      homeHref="/app"
      brand={i.tr("app.name")}
      navLabel={i.tr("nav.menu")}
      headerEnd={<ContrastToggle initial={highContrast} label={i.tr("mon.profile.contrast")} />}
    >
      {children}
    </AppShell>
  );
}
