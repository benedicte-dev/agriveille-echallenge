import { Fragment } from "react";
import type { ReactNode } from "react";
import { blocksToPlainText, parseMarkdown, sectionize, type Block, type Inline } from "./markdown";

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) =>
        n.type === "strong" ? <strong key={i}>{n.text}</strong> : <Fragment key={i}>{n.text}</Fragment>,
      )}
    </>
  );
}

/**
 * Rendu React du markdown simple des fiches. Aucune chaîne n'est injectée
 * comme HTML : React échappe chaque nœud texte.
 */
export function Markdown({ source, lang }: { source: string; lang?: string }) {
  return (
    <div lang={lang} className="flex flex-col gap-4 text-base leading-relaxed text-ink">
      <Blocks blocks={parseMarkdown(source)} />
    </div>
  );
}

/**
 * Rendu par sections (un titre = une section) avec un emplacement à côté de
 * chaque titre, ex. un bouton Écouter qui lit la section (texte brut fourni).
 */
export function MarkdownSections({
  source,
  lang,
  aside,
}: {
  source: string;
  lang?: string;
  aside?: (plainText: string, index: number) => ReactNode;
}) {
  const sections = sectionize(parseMarkdown(source));
  return (
    <div lang={lang} className="flex flex-col gap-6 text-base leading-relaxed text-ink">
      {sections.map((s, i) => {
        const all = s.heading ? [s.heading, ...s.blocks] : s.blocks;
        return (
          <section key={i} className="flex flex-col gap-3">
            {s.heading || aside ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                {s.heading ? <Blocks blocks={[s.heading]} /> : <span />}
                {aside ? aside(blocksToPlainText(all), i) : null}
              </div>
            ) : null}
            <Blocks blocks={s.blocks} />
          </section>
        );
      })}
    </div>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === "heading") {
          const H = b.level === 2 ? "h2" : "h3";
          return (
            <H key={i} className={b.level === 2 ? "mt-2 text-lg" : "text-base font-bold"}>
              <Inlines nodes={b.content} />
            </H>
          );
        }
        if (b.type === "list") {
          const L = b.ordered ? "ol" : "ul";
          return (
            <L key={i} className={b.ordered ? "flex list-decimal flex-col gap-2 pl-6" : "flex list-disc flex-col gap-2 pl-6"}>
              {b.items.map((item, j) => (
                <li key={j} className="pl-1">
                  <Inlines nodes={item} />
                </li>
              ))}
            </L>
          );
        }
        return (
          <p key={i}>
            <Inlines nodes={b.content} />
          </p>
        );
      })}
    </>
  );
}
