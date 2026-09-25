import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
/** sm = 48 px (minimum tactile, écrans agent) · md = 56 px · lg = 64 px (action principale fermier). */
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "av-control inline-flex items-center justify-center gap-2 rounded-lg border-2 font-semibold " +
  "select-none transition-colors no-underline " +
  "disabled:cursor-not-allowed aria-disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-primary bg-primary text-on-primary hover:border-primary-hover hover:bg-primary-hover " +
    "active:bg-primary-hover",
  secondary:
    "border-line-strong bg-surface text-ink hover:bg-sunken active:bg-sunken",
  danger:
    "border-critical bg-critical text-on-critical hover:border-critical-hover hover:bg-critical-hover",
  ghost: "border-transparent bg-transparent text-primary hover:bg-primary-soft active:bg-primary-soft",
};

/** Désactivé : on ne baisse pas l'opacité (contraste perdu) ; on passe en fond retrait + texte secondaire. */
const disabledCls =
  "disabled:border-line disabled:bg-sunken disabled:text-ink-muted " +
  "aria-disabled:border-line aria-disabled:bg-sunken aria-disabled:text-ink-muted";

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-touch px-4 text-base",
  md: "min-h-14 px-5 text-base",
  lg: "min-h-touch-lg px-6 text-lg",
};

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Pictogramme à gauche du libellé (élément, ex. <IconCheck />). */
  icon?: ReactNode;
  /** Pleine largeur (actions principales sur mobile). */
  block?: boolean;
  className?: string;
  children: ReactNode;
};

export type ButtonProps = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
    /** Remplace l'icône par un indicateur, désactive le bouton et pose aria-busy. */
    loading?: boolean;
    /** Libellé pendant le chargement (défaut : libellé normal conservé). */
    loadingLabel?: ReactNode;
  };

export type ButtonLinkProps = Common & {
  href: string;
  /** Lien externe : ouvre dans l'onglet courant, mais sans prefetch Next. */
  external?: boolean;
  prefetch?: boolean;
  "aria-label"?: string;
  "aria-current"?: "page" | "step" | "true";
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  block,
  className,
  loading = false,
}: Pick<Common, "variant" | "size" | "block" | "className"> & { loading?: boolean } = {}): string {
  // En chargement, le bouton garde sa couleur (l'action est en cours, pas indisponible).
  return cx(base, variants[variant], loading ? "cursor-progress" : disabledCls, sizes[size], block && "w-full", className);
}

/**
 * Bouton d'action. `href` → rendu en lien (next/link) avec le même aspect.
 * Toutes les tailles respectent la cible de 48 px ; le libellé est toujours visible.
 */
export function Button(props: ButtonProps | ButtonLinkProps) {
  if (props.href !== undefined) {
    const { href, variant, size, icon, block, className, children, external, prefetch, ...aria } =
      props as ButtonLinkProps;
    const cls = buttonClasses({ variant, size, block, className });
    const content = (
      <>
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span>{children}</span>
      </>
    );
    if (external) {
      return (
        <a href={href} className={cls} {...aria}>
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className={cls} prefetch={prefetch} {...aria}>
        {content}
      </Link>
    );
  }

  const {
    variant,
    size,
    icon,
    block,
    className,
    children,
    loading = false,
    loadingLabel,
    disabled,
    type = "button",
    ...rest
  } = props;
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, block, className, loading })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon ? <span className="shrink-0">{icon}</span> : null}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}
