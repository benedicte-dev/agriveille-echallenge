import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Badge, Callout, ListenButton, PageHeader, intlLocale } from "@/components/ui";
import { IconInfo } from "@/components/icons";
import { prisma } from "@/lib/db";
import { slugSchema } from "@/lib/validation";
import { PublicFrame } from "@/server/content/ui/PublicFrame";
import { getTranslator, listenLabels } from "@/server/content/ui/i18n";
import { pickLocalized } from "@/server/content/localize";
import { MarkdownSections } from "@/server/content/Markdown";
import { REG_CATEGORY_ICONS } from "@/server/content/regulation-meta";
import { clip } from "@/server/content/text";

type Props = { params: Promise<{ slug: string }> };

/** Limite de la synthèse vocale 229langues (1 000 caractères) : lecture section par section. */
const TTS_MAX = 950;

const load = cache(async (slug: string) => {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  return prisma.regulation.findFirst({ where: { slug: parsed.data, published: true } });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load((await params).slug).catch(() => null);
  return r ? { title: r.titleFr, description: r.summaryFr } : { title: "Fiche introuvable" };
}

export default async function RegulationPage({ params }: Props) {
  const { slug } = await params;
  const r = await load(slug);
  if (!r) notFound();

  const { locale, tr } = await getTranslator();
  const labels = listenLabels(tr);
  const title = pickLocalized(locale, r, "title");
  const summary = pickLocalized(locale, r, "summary");
  const body = pickLocalized(locale, r, "body");
  const anyFallback = title.fallback || summary.fallback || body.fallback;
  const Icon = REG_CATEGORY_ICONS[r.category];
  const dateFmt = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Porto-Novo" });

  return (
    <PublicFrame>
      <article className="flex flex-col gap-5">
        <PageHeader
          title={<span lang={title.lang}>{title.text}</span>}
          icon={<Icon size={32} />}
          backHref="/reglementation"
          backLabel={tr("reg.title")}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone="primary">{tr(`reg.category.${r.category}`)}</Badge>
              <span className="text-sm">{tr("reg.updated", { date: dateFmt.format(r.updatedAt) })}</span>
            </span>
          }
        />

        {anyFallback ? (
          <Callout tone="info" title={tr("pub.reg.fallback_title")}>
            {tr("pub.reg.fallback_text")}
          </Callout>
        ) : locale !== "fr" ? (
          <p className="text-sm text-ink-muted">{tr("lang.machine_notice")}</p>
        ) : null}

        <section aria-labelledby="resume" className="rounded-xl border-l-4 border-primary bg-primary-soft p-4">
          <h2 id="resume" className="sr-only">
            {tr("pub.reg.summary")}
          </h2>
          <p className="text-lg font-semibold text-ink" lang={summary.lang}>
            {summary.text}
          </p>
          <ListenButton text={clip(summary.text, TTS_MAX)} lang={summary.lang} labels={labels} className="mt-3" />
        </section>

        <MarkdownSections
          source={body.text}
          lang={body.lang}
          aside={(text) => <ListenButton text={clip(text, TTS_MAX)} lang={body.lang} labels={labels} variant="icon" />}
        />

        {r.sourceRef ? (
          <footer className="flex items-start gap-2 border-t border-line pt-4 text-sm text-ink-muted">
            <IconInfo size={20} className="mt-0.5 shrink-0" />
            <p>
              <span className="font-semibold text-ink">{tr("reg.source")} : </span>
              <span lang="fr">{r.sourceRef}</span>
            </p>
          </footer>
        ) : null}
      </article>
    </PublicFrame>
  );
}
