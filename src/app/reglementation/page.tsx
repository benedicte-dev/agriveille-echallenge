import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Callout, EmptyState, ListenButton, PageHeader, cx, intlLocale } from "@/components/ui";
import { IconChevron, IconRegle } from "@/components/icons";
import { prisma } from "@/lib/db";
import { PublicFrame } from "@/server/content/ui/PublicFrame";
import { getTranslator, listenLabels } from "@/server/content/ui/i18n";
import { pickLocalized } from "@/server/content/localize";
import { REG_CATEGORIES, REG_CATEGORY_ICONS, isRegCategory } from "@/server/content/regulation-meta";

export const metadata: Metadata = {
  title: "Règles et lois",
  description: "Fiches pratiques : produits phytosanitaires, semences, export, redevances, foncier, bio.",
};

export default async function RegulationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const category = isRegCategory(sp.categorie) ? sp.categorie : null;
  const { locale, tr } = await getTranslator();
  const labels = listenLabels(tr);

  let rows: Awaited<ReturnType<typeof load>> | null = null;
  try {
    rows = await load();
  } catch (err) {
    console.error("[reglementation] lecture impossible", err);
  }
  const visible = rows?.filter((r) => !category || r.category === category) ?? [];
  const counts = new Map<string, number>();
  for (const r of rows ?? []) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  const dateFmt = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Porto-Novo" });

  const chip = "inline-flex min-h-touch items-center gap-2 rounded-full border-2 px-4 font-semibold no-underline transition-colors";
  return (
    <PublicFrame>
      <PageHeader
        title={tr("reg.title")}
        icon={<IconRegle size={32} />}
        subtitle={tr("pub.reg.subtitle")}
        backHref="/"
        backLabel={tr("nav.home")}
        listen={{ text: `${tr("reg.title")}. ${tr("pub.reg.subtitle")}`, lang: locale, labels }}
      />

      {rows === null ? (
        <Callout tone="critical" role="alert" title={tr("error.generic")} action={<Button href="/reglementation" variant="secondary" size="sm">{tr("common.retry")}</Button>}>
          {tr("pub.reg.load_error")}
        </Callout>
      ) : rows.length === 0 ? (
        <EmptyState icon={<IconRegle size={48} />} title={tr("pub.reg.empty_title")} message={tr("pub.reg.empty_text")} />
      ) : (
        <div className="flex flex-col gap-5">
          <nav aria-label={tr("pub.reg.filter")}>
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link
                  href="/reglementation"
                  aria-current={category === null ? "page" : undefined}
                  className={cx(chip, category === null ? "border-primary bg-primary text-on-primary" : "border-line-strong bg-surface text-ink hover:border-primary")}
                >
                  {tr("pub.reg.all")} <span className="tabular-nums">({rows.length})</span>
                </Link>
              </li>
              {REG_CATEGORIES.filter((c) => counts.has(c)).map((c) => {
                const Icon = REG_CATEGORY_ICONS[c];
                const on = category === c;
                return (
                  <li key={c}>
                    <Link
                      href={`/reglementation?categorie=${c}`}
                      aria-current={on ? "page" : undefined}
                      className={cx(chip, on ? "border-primary bg-primary text-on-primary" : "border-line-strong bg-surface text-ink hover:border-primary")}
                    >
                      <Icon size={22} />
                      {tr(`reg.category.${c}`)} <span className="tabular-nums">({counts.get(c)})</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {visible.length === 0 ? (
            <EmptyState
              kind="no-results"
              icon={<IconRegle size={48} />}
              title={tr("pub.reg.no_results")}
              action={<Button href="/reglementation" variant="secondary" size="sm">{tr("pub.reg.all")}</Button>}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {visible.map((r) => {
                const title = pickLocalized(locale, r, "title");
                const summary = pickLocalized(locale, r, "summary");
                const Icon = REG_CATEGORY_ICONS[r.category];
                return (
                  <li key={r.id} className="rounded-xl border border-line bg-surface p-4 shadow-card">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="primary" icon={<Icon size={18} />}>
                        {tr(`reg.category.${r.category}`)}
                      </Badge>
                      <span className="text-sm text-ink-muted">{tr("reg.updated", { date: dateFmt.format(r.updatedAt) })}</span>
                    </div>
                    <h2 className="mt-2 text-lg" lang={title.lang}>
                      <Link href={`/reglementation/${r.slug}`} className="text-ink hover:text-primary">
                        {title.text}
                      </Link>
                    </h2>
                    <p className="mt-1 text-base text-ink-muted" lang={summary.lang}>
                      {summary.text}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <ListenButton text={`${title.text}. ${summary.text}`} lang={summary.lang} labels={labels} />
                      <Button href={`/reglementation/${r.slug}`} variant="ghost" size="sm" icon={<IconChevron size={20} />} aria-label={`${tr("pub.reg.read")} : ${title.text}`}>
                        {tr("pub.reg.read")}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </PublicFrame>
  );
}

function load() {
  return prisma.regulation.findMany({
    where: { published: true },
    orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      category: true,
      titleFr: true,
      titleFon: true,
      titleYo: true,
      summaryFr: true,
      summaryFon: true,
      summaryYo: true,
      updatedAt: true,
    },
  });
}
