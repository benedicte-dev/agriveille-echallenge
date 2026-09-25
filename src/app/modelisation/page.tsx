import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Button, Callout, PageHeader } from "@/components/ui";
import { IconGraphique } from "@/components/icons";
import { PublicFrame } from "@/server/content/ui/PublicFrame";
import { getTranslator } from "@/server/content/ui/i18n";
import { extractUml, mermaidLiveUrl, type UmlDocument } from "@/server/content/uml";

export const metadata: Metadata = {
  title: "Modélisation UML",
  description: "Cas d'utilisation, classes et séquences d'AgriVeille (Mermaid).",
};

/**
 * Fichiers lus côté serveur (liste explicite : le traçage des fichiers de
 * Next les embarque plus sûrement qu'un readdir).
 */
const FILES = [
  "docs/uml/01-cas-utilisation.md",
  "docs/uml/02-classes.md",
  "docs/uml/03-sequence-alerte-climatique.md",
  "docs/uml/04-sequence-signalement-ravageur.md",
  "docs/ARCHITECTURE.md",
] as const;

async function loadDocs(): Promise<{ docs: UmlDocument[]; missing: string[] }> {
  const docs: UmlDocument[] = [];
  const missing: string[] = [];
  await Promise.all(
    FILES.map(async (f, i) => {
      try {
        const md = await readFile(path.join(process.cwd(), f), "utf8");
        docs[i] = extractUml(f, md);
      } catch {
        missing.push(f);
      }
    }),
  );
  return { docs: docs.filter(Boolean), missing };
}

/**
 * Le paquet `mermaid` n'est pas installé (package.json figé) : les diagrammes
 * sont affichés en source Mermaid lisible, avec un lien de rendu vers Mermaid
 * Live et vers le dépôt (GitHub rend Mermaid nativement).
 */
export default async function ModelingPage() {
  const { tr } = await getTranslator();
  const { docs, missing } = await loadDocs();
  const repo = process.env.NEXT_PUBLIC_REPO_URL?.replace(/\/+$/, "");
  const repoLink = (f: string) => (repo && /^https:\/\//.test(repo) ? `${repo}/blob/main/${f}` : null);
  const total = docs.reduce((n, d) => n + d.diagrams.length, 0);

  return (
    <PublicFrame width="wide">
      <PageHeader
        title={tr("pub.uml.title")}
        icon={<IconGraphique size={32} />}
        subtitle={tr("pub.uml.subtitle", { count: total })}
        backHref="/"
        backLabel={tr("nav.home")}
      />

      <Callout tone="info" title={tr("pub.uml.how_title")} className="mb-6">
        {tr("pub.uml.how_text")}
      </Callout>

      {missing.length > 0 ? (
        <Callout tone="warning" role="status" title={tr("pub.uml.missing")} className="mb-6">
          <ul className="list-disc pl-5">
            {missing.map((f) => (
              <li key={f}>
                <code>{f}</code>
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}

      {docs.length > 0 ? (
        <nav aria-label={tr("pub.uml.toc")} className="mb-6">
          <ol className="flex flex-col gap-1">
            {docs.map((d, i) => (
              <li key={d.file}>
                <a href={`#doc-${i}`} className="inline-flex min-h-touch items-center font-semibold text-primary">
                  {d.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-col gap-10">
        {docs.map((d, i) => {
          const link = repoLink(d.file);
          return (
            <section key={d.file} id={`doc-${i}`} aria-labelledby={`doc-${i}-t`} className="scroll-mt-4">
              <h2 id={`doc-${i}-t`} className="text-xl">
                {d.title}
              </h2>
              {d.intro ? <p className="mt-1 max-w-3xl text-base text-ink-muted">{d.intro}</p> : null}
              <p className="mt-1 text-sm text-ink-muted">
                <code>{d.file}</code>
                {link ? (
                  <>
                    {" · "}
                    <a href={link} className="font-semibold text-primary">
                      {tr("pub.uml.repo")}
                    </a>
                  </>
                ) : null}
              </p>
              <div className="mt-4 flex flex-col gap-6">
                {d.diagrams.map((g, j) => (
                  <figure key={j} className="rounded-xl border border-line bg-surface shadow-card">
                    <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
                      <h3 className="text-lg">{g.heading ?? d.title}</h3>
                      <Button href={mermaidLiveUrl(g.code)} external variant="secondary" size="sm">
                        {tr("pub.uml.render")}
                      </Button>
                    </figcaption>
                    <pre
                      tabIndex={0}
                      aria-label={`${tr("pub.uml.source")} : ${g.heading ?? d.title}`}
                      className="max-h-[32rem] overflow-auto p-4 font-mono text-sm leading-relaxed text-ink"
                    >
                      <code>{g.code}</code>
                    </pre>
                  </figure>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </PublicFrame>
  );
}
