import type { ReactNode } from "react";
import { IconDeconnexion } from "@/components/icons";
import { AppShell, ContrastToggle, LanguageSwitcher, type NavItem } from "@/components/ui";
import type { CurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { setLocaleAction } from "@/lib/i18n/actions";
import { getTranslator, isHighContrast } from "@/server/content/ui/i18n";

/**
 * Coquille commune aux espaces AGENT et ADMIN. Langue, contraste et
 * déconnexion vivent dans l'en-tête (visible à toutes les largeurs : la barre
 * latérale n'existe qu'à partir de 1024 px).
 */
export async function StaffShell({
  user,
  items,
  homeHref,
  children,
}: {
  user: Pick<CurrentUser, "fullName" | "role">;
  items: NavItem[];
  homeHref: string;
  children: ReactNode;
}) {
  const [{ locale, tr }, highContrast] = await Promise.all([getTranslator(), isHighContrast()]);
  return (
    <AppShell
      variant="staff"
      items={items}
      homeHref={homeHref}
      brand={tr("app.name")}
      navLabel={tr("nav.menu")}
      menuLabel={tr("nav.menu")}
      headerEnd={
        <>
          <LanguageSwitcher current={locale} action={setLocaleAction} label={tr("profile.language")} variant="compact" />
          <ContrastToggle initial={highContrast} label={tr("pub.contrast")} />
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex min-h-touch items-center gap-2 rounded-lg border-2 border-line-strong bg-surface px-3 font-semibold text-ink hover:bg-sunken"
            >
              <IconDeconnexion size={22} />
              <span className="sr-only sm:not-sr-only">{tr("nav.logout")}</span>
            </button>
          </form>
        </>
      }
      sidebarFooter={
        <p className="truncate text-sm font-semibold text-ink" title={user.fullName}>
          {user.fullName}
          <span className="block font-normal text-ink-muted">{tr(`role.${user.role}`)}</span>
        </p>
      }
    >
      {children}
    </AppShell>
  );
}
