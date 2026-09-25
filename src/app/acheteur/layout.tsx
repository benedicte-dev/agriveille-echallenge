import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AppShell, ContrastToggle, LanguageSwitcher, CONTRAST_COOKIE, type NavItem } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { setLocaleAction } from "@/lib/i18n/actions";
import { pageI18n } from "@/app/marche/_ui/labels";

/**
 * Espace BUYER : marché ouvert + mes offres, une seule page (`/acheteur`). Le rôle est vérifié
 * ici côté serveur (le proxy ne fait qu'un contrôle optimiste) ; l'action de marché revérifie aussi.
 */
export default async function AcheteurLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("BUYER");
  const [{ locale, tr }, store] = await Promise.all([pageI18n(), cookies()]);
  const highContrast = store.get(CONTRAST_COOKIE)?.value === "high";

  const items: NavItem[] = [{ href: "/acheteur", label: tr("nav.market"), icon: "vendre", exact: true }];

  return (
    <AppShell
      variant="staff"
      items={items}
      homeHref="/acheteur"
      brand={tr("app.name")}
      navLabel={tr("nav.menu")}
      headerEnd={<ContrastToggle initial={highContrast} />}
      sidebarFooter={
        <div className="flex flex-col gap-3">
          <p className="truncate text-sm font-semibold text-ink" title={user.fullName}>
            {user.fullName}
          </p>
          <LanguageSwitcher current={locale} action={setLocaleAction} label={tr("profile.language")} />
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-lg border-2 border-line-strong bg-surface px-4 font-semibold text-ink hover:bg-sunken"
            >
              {tr("nav.logout")}
            </button>
          </form>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
