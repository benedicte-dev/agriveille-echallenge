/**
 * Extraction des diagrammes Mermaid des documents docs/uml/*.md (module pur).
 * La lecture des fichiers est faite par la page /modelisation.
 */
export interface MermaidDiagram {
  /** Titre de section (## …) le plus proche au-dessus du bloc. */
  heading: string | null;
  code: string;
}

export interface UmlDocument {
  file: string;
  title: string;
  /** Premier paragraphe descriptif (hors citations, tableaux, titres). */
  intro: string | null;
  diagrams: MermaidDiagram[];
}

const stripMd = (s: string) =>
  s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();

export function extractUml(file: string, markdown: string): UmlDocument {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let title = file;
  let intro: string | null = null;
  let heading: string | null = null;
  const diagrams: MermaidDiagram[] = [];
  let inBlock: "mermaid" | "other" | null = null;
  let buf: string[] = [];
  let para: string[] = [];

  for (const line of lines) {
    const fence = /^\s*```\s*([\w-]*)/.exec(line);
    if (fence) {
      if (inBlock === null) {
        inBlock = fence[1].toLowerCase() === "mermaid" ? "mermaid" : "other";
        buf = [];
      } else {
        if (inBlock === "mermaid" && buf.join("").trim()) diagrams.push({ heading, code: buf.join("\n").trimEnd() });
        inBlock = null;
      }
      continue;
    }
    if (inBlock) {
      buf.push(line);
      continue;
    }
    const h1 = /^#\s+(.*)$/.exec(line);
    if (h1) {
      title = stripMd(h1[1]);
      continue;
    }
    const h = /^#{2,6}\s+(.*)$/.exec(line);
    if (h) {
      heading = stripMd(h[1]);
      if (intro === null && para.length) intro = stripMd(para.join(" "));
      para = [];
      continue;
    }
    if (intro === null) {
      const t = line.trim();
      if (t === "") {
        if (para.length) intro = stripMd(para.join(" "));
      } else if (!/^[>|<-]/.test(t)) {
        para.push(t);
      }
    }
  }
  return { file, title, intro, diagrams };
}

/**
 * Lien vers l'éditeur en ligne Mermaid Live (rendu du diagramme), format
 * « #base64: » de l'éditeur : état JSON { code, mermaid } encodé en base64.
 */
export function mermaidLiveUrl(code: string): string {
  const state = JSON.stringify({ code, mermaid: JSON.stringify({ theme: "default" }), autoSync: true, updateDiagram: true });
  const b64 = Buffer.from(state, "utf8").toString("base64");
  return `https://mermaid.live/view#base64:${b64}`;
}
