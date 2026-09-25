/**
 * Composants d'interface AgriVeille. Serveur par défaut ; les fichiers marqués "use client"
 * (PinPad, ListenButton, LanguageSwitcher, OfflineBanner, NavLink, ContrastToggle,
 * ServiceWorkerRegister) sont hydratés seuls. Spécification : docs/DESIGN.md.
 */
export { cx } from "./cx";
export { UI_LOCALES, htmlLang, intlLocale, type UiLocale } from "./locale";
export { Spinner } from "./Spinner";
export { Button, buttonClasses, type ButtonProps, type ButtonLinkProps, type ButtonVariant, type ButtonSize } from "./Button";
export { Badge, CountBadge, toneClasses, type BadgeProps, type Tone } from "./Badge";
export { SeverityBadge, severityTone, DEFAULT_SEVERITY_LABELS, type Severity, type SeverityBadgeProps } from "./SeverityBadge";
export { Card, type CardProps } from "./Card";
export { Callout, type CalloutProps, type CalloutTone } from "./Callout";
export { IconTile, TileGrid, type IconTileProps, type TileTone } from "./IconTile";
export { Field, Input, Select, Textarea, type FieldProps, type FieldControlProps } from "./Field";
export { PinPad, type PinPadProps, type PinPadLabels } from "./PinPad";
export { LanguageSwitcher, LANGUAGE_NAMES, type LanguageSwitcherProps } from "./LanguageSwitcher";
export { ListenButton, type ListenButtonProps, type ListenButtonLabels } from "./ListenButton";
export { OfflineBanner, useOnline, type OfflineBannerProps } from "./OfflineBanner";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { Skeleton, LoadingBlock, type LoadingBlockProps } from "./Skeleton";
export { PageHeader, type PageHeaderProps } from "./PageHeader";
export { NavLink } from "./NavLink";
export { AppShell, PublicShell, type AppShellProps, type PublicShellProps, type NavItem } from "./AppShell";
export { StatCard, type StatCardProps } from "./StatCard";
export { DataTable, type Column, type DataTableProps } from "./DataTable";
export {
  WeatherDay,
  WeatherStrip,
  weatherCondition,
  DEFAULT_CONDITION_LABELS,
  type WeatherCondition,
  type WeatherDayProps,
} from "./WeatherDay";
export { ContrastToggle, CONTRAST_COOKIE } from "./ContrastToggle";
export { ServiceWorkerRegister } from "./ServiceWorkerRegister";
