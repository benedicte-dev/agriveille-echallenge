import Link from "next/link";
import { buttonClasses } from "@/components/ui";

/** Pagination par liens (l'état vit dans l'URL). */
export function Pager({
  page,
  pages,
  base,
  params,
  labels,
}: {
  page: number;
  pages: number;
  base: string;
  params: Record<string, string | undefined>;
  labels: { prev: string; next: string; status: string; nav: string };
}) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <nav aria-label={labels.nav} className="flex flex-wrap items-center gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClasses({ variant: "secondary", size: "sm" })} rel="prev">
          {labels.prev}
        </Link>
      ) : null}
      <span className="text-ink-muted" aria-current="page">
        {labels.status}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={buttonClasses({ variant: "secondary", size: "sm" })} rel="next">
          {labels.next}
        </Link>
      ) : null}
    </nav>
  );
}
