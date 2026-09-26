import Link from "next/link";
import type { ReactNode } from "react";
import { IconMenu, icons, type IconComponent, type IconName } from "@/components/icons";
import { BeninArms } from "@/components/brand/BeninArms";
import { CountBadge } from "./Badge";
import { NavLink } from "./NavLink";
import { cx } from "./cx";

export type NavItem = {
  href: string;
  label: string;
  /** Clé de pictogramme (`icons`) ou composant. */
  icon: IconName | IconComponent;
  /** Actif seulement sur l'URL exacte (à mettre sur la racine /app, /agent…). */
  exact?: boolean;
  badge?: number;
  /** Texte lu pour le badge, ex. « 3 nouvelles alertes ». */
  badgeLabel?: string;
};

export type AppShellProps = {
  /** "farmer" : barre basse 4 icônes (mobile) ; "staff" : barre latérale (agent, admin). */
  variant: "farmer" | "staff";
  items: NavItem[];
  /** Lien de la marque (accueil de l'espace). */
  homeHref: string;
  brand?: string;
  /** Zone en haut à droite : langue, contraste, profil, déconnexion. */
  headerEnd?: ReactNode;
  /** Nom du bloc de navigation pour les lecteurs d'écran. */
  navLabel?: string;
  /** Libellé du bouton menu (staff, mobile). */
  menuLabel?: string;
  /** Pied de barre latérale (staff) : utilisateur, déconnexion. */
  sidebarFooter?: ReactNode;
  children: ReactNode;
};

function renderIcon(icon: NavItem["icon"], size: number) {
  const Icon = typeof icon === "string" ? icons[icon] : icon;
  return <Icon size={size} />;
}

function Brand({ href, brand }: { href: string; brand: string }) {
  return (
    <Link href={href} className="group inline-flex min-h-touch items-center gap-3 rounded-lg pr-2 text-ink no-underline">
      <BeninArms size={40} alt="Armoiries de la République du Bénin" className="transition-transform duration-300 group-hover:-rotate-3" />
      <span aria-hidden="true" className="h-8 w-px bg-line" />
      <span className="flex flex-col leading-none">
        <span className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-tight">{brand}</span>
        <span className="mt-1 text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">République du Bénin</span>
      </span>
    </Link>
  );
}

/**
 * Coquille d'application. Le <main id="contenu"> est la cible du lien d'évitement du layout.
 * - farmer : en-tête sobre + barre basse fixe (4 items max, pictogramme 28 px + mot, 72 px de haut),
 *   au-delà de 640 px la barre devient une rangée sous l'en-tête. Ordre DOM = en-tête, nav, main.
 * - staff : barre latérale ≥ 1024 px ; en dessous, menu repliable <details> (sans JS).
 */
export function AppShell({
  variant,
  items,
  homeHref,
  brand = "AgriVeille",
  headerEnd,
  navLabel = "Navigation principale",
  menuLabel = "Menu",
  sidebarFooter,
  children,
}: AppShellProps) {
  if (variant === "farmer") {
    const farmerItems = items.slice(0, 4);
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-1.5">
            <Brand href={homeHref} brand={brand} />
            {headerEnd ? <div className="flex items-center gap-2">{headerEnd}</div> : null}
          </div>
        </header>
        <nav
          aria-label={navLabel}
          className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-surface sm:static sm:border-t-0 sm:border-b"
        >
          <ul className="mx-auto grid max-w-3xl grid-cols-4">
            {farmerItems.map((it) => (
              <li key={it.href}>
                <NavLink
                  href={it.href}
                  exact={it.exact}
                  className="relative flex min-h-18 flex-col items-center justify-center gap-1 border-t-4 border-transparent px-1 text-sm font-semibold text-ink-muted no-underline hover:text-ink"
                  activeClassName="border-primary! text-primary!"
                >
                  <span className="relative">
                    {renderIcon(it.icon, 28)}
                    {it.badge ? (
                      <CountBadge count={it.badge} label={it.badgeLabel ?? String(it.badge)} className="absolute -top-2 -right-3" />
                    ) : null}
                  </span>
                  <span className="leading-tight">{it.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-28 outline-none sm:pb-10">
          {children}
        </main>
      </div>
    );
  }

  const list = (
    <ul className="flex flex-col gap-1">
      {items.map((it) => (
        <li key={it.href}>
          <NavLink
            href={it.href}
            exact={it.exact}
            className="flex min-h-touch items-center gap-3 rounded-lg border-l-4 border-transparent px-3 font-semibold text-ink no-underline hover:bg-sunken"
            activeClassName="border-primary! bg-primary-soft text-primary"
          >
            {renderIcon(it.icon, 22)}
            <span className="flex-1">{it.label}</span>
            {it.badge ? <CountBadge count={it.badge} label={it.badgeLabel ?? String(it.badge)} /> : null}
          </NavLink>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="border-b border-line bg-surface lg:sticky lg:w-64 lg:shrink-0 lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-2 px-4 py-2 lg:py-4">
          <Brand href={homeHref} brand={brand} />
          <div className="flex items-center gap-2 lg:hidden">{headerEnd}</div>
        </div>
        {/* Mobile / tablette : menu repliable natif */}
        <details className="group border-t border-line lg:hidden">
          <summary className="flex min-h-touch items-center gap-2 px-4 font-semibold text-ink list-none [&::-webkit-details-marker]:hidden">
            <IconMenu size={22} />
            <span>{menuLabel}</span>
          </summary>
          <nav aria-label={navLabel} className="px-3 pb-3">
            {list}
          </nav>
        </details>
        {/* Bureau : barre latérale */}
        <nav aria-label={navLabel} className="hidden flex-1 overflow-y-auto px-3 pb-4 lg:block">
          {list}
        </nav>
        {sidebarFooter ? <div className="hidden border-t border-line p-3 lg:block">{sidebarFooter}</div> : null}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {headerEnd ? (
          <div className="hidden items-center justify-end gap-2 border-b border-line bg-surface px-6 py-2 lg:flex">{headerEnd}</div>
        ) : null}
        <main id="contenu" tabIndex={-1} className="w-full max-w-7xl flex-1 px-4 py-5 outline-none sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export type PublicShellProps = {
  homeHref?: string;
  brand?: string;
  /** Zone en haut à droite : langue, contraste, « Se connecter ». */
  headerEnd?: ReactNode;
  /** Pied de page (liens réglementation, vérifier une quittance, mention démo). */
  footer?: ReactNode;
  /** Largeur du contenu : "narrow" (768 px, parcours fermier) ou "wide" (1280 px). */
  width?: "narrow" | "wide" | "full";
  children: ReactNode;
};

/** Coquille des pages publiques (accueil, connexion, réglementation, marché, vérification). */
export function PublicShell({ homeHref = "/", brand = "AgriVeille", headerEnd, footer, width = "narrow", children }: PublicShellProps) {
  const w = width === "narrow" ? "max-w-3xl" : "max-w-7xl";
  const full = width === "full";
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className={cx("mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-1.5 sm:px-6", full ? "max-w-7xl" : w)}>
          <Brand href={homeHref} brand={brand} />
          {headerEnd ? <div className="flex flex-wrap items-center gap-2">{headerEnd}</div> : null}
        </div>
      </header>
      <main id="contenu" tabIndex={-1} className={cx("w-full flex-1 outline-none", full ? "" : cx("mx-auto px-4 py-6 sm:px-6", w))}>
        {children}
      </main>
      {footer ? (
        <footer className="border-t border-line bg-sunken">
          <div className={cx("mx-auto px-4 py-8 text-sm text-ink-muted sm:px-6", full ? "max-w-7xl" : w)}>{footer}</div>
        </footer>
      ) : null}
    </div>
  );
}
