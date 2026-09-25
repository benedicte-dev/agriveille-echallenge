"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Lien de navigation qui pose aria-current="page" selon l'URL courante.
 * `exact` : actif seulement sur l'URL exacte (ex. /app), sinon aussi sur les sous-pages.
 */
export function NavLink({
  href,
  exact = false,
  className,
  activeClassName,
  children,
}: {
  href: string;
  exact?: boolean;
  className?: string;
  activeClassName?: string;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cx(className, active && activeClassName)}>
      {children}
    </Link>
  );
}
