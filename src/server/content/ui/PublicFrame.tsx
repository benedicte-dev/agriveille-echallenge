import Link from "next/link";
import type { ReactNode } from "react";
import { ContrastToggle, LanguageSwitcher, PublicShell } from "@/components/ui";
import { IconQr, IconRegle, IconVendre } from "@/components/icons";
import { setLocaleAction } from "@/lib/i18n/actions";
import { getCurrentUser, homePathForRole } from "@/lib/auth";
import { getTranslator, isHighContrast } from "./i18n";

/**
 * Coquille des pages publiques : langue (compacte), contraste, accès à
 * l'espace ou connexion ; pied avec les accès publics et la mention démo.
 */
export async function PublicFrame({
  children,
  width = "wide",
  showLanguage = true,
}: {
  children: ReactNode;
  width?: "narrow" | "wide" | "full";
  /** L'accueil affiche déjà le grand choix de langue. */
  showLanguage?: boolean;
}) {
  const { locale, tr } = await getTranslator();
  const [contrast, user] = await Promise.all([isHighContrast(), getCurrentUser()]);

  const footerLink = "inline-flex min-h-touch items-center gap-2 rounded-lg px-1 font-semibold text-primary";
  return (
    <PublicShell
      width={width}
      headerEnd={
        <>
          {showLanguage ? <LanguageSwitcher current={locale} action={setLocaleAction} label={tr("lang.choose")} /> : null}
          <ContrastToggle initial={contrast} label={tr("pub.contrast")} />
          {user ? (
            <Link href={homePathForRole(user.role)} className={footerLink}>
              {tr("nav.dashboard")}
            </Link>
          ) : (
            <Link href="/connexion" className={footerLink}>
              {tr("nav.login")}
            </Link>
          )}
        </>
      }
      footer={
        <div className="flex flex-col gap-3">
          <nav aria-label={tr("pub.footer_nav")}>
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              <li>
                <Link href="/reglementation" className={footerLink}>
                  <IconRegle size={22} />
                  {tr("nav.regulation")}
                </Link>
              </li>
              <li>
                <Link href="/marche" className={footerLink}>
                  <IconVendre size={22} />
                  {tr("home.market_prices")}
                </Link>
              </li>
              <li>
                <Link href="/#verifier" className={footerLink}>
                  <IconQr size={22} />
                  {tr("nav.verify")}
                </Link>
              </li>
            </ul>
          </nav>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{tr("pub.demo_notice")}</span>
            <Link href="/credits" className="font-semibold text-primary">
              {tr("credits.link")}
            </Link>
          </p>
        </div>
      }
    >
      {children}
    </PublicShell>
  );
}
