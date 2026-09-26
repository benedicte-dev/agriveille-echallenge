import { cx } from "@/components/ui/cx";

/**
 * Armoiries de la République du Bénin (Wikimedia Commons, CC BY-SA 3.0 ;
 * crédits dans public/images/brand/credits.json et sur /credits).
 */
export function BeninArms({ size = 40, alt, className }: { size?: number; alt: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG statique, next/image n'apporte rien ici.
    <img
      src="/images/brand/armoiries-benin.svg"
      alt={alt}
      width={size}
      height={size}
      decoding="async"
      className={cx("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
