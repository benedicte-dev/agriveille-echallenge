import { describe, expect, it } from "vitest";
import { extractUml, mermaidLiveUrl } from "./uml";

const DOC = `# 03 — Séquence

> Source : [SPEC](../SPEC.md)

Le cron déclenche l'**analyse** de chaque parcelle.

## Diagramme

\`\`\`mermaid
sequenceDiagram
  A->>B: ping
\`\`\`

\`\`\`sh
npx mmdc
\`\`\`

## Vue 2

\`\`\`mermaid
flowchart LR
  X --> Y
\`\`\`
`;

describe("extractUml", () => {
  it("extrait titre, intro, et seulement les blocs mermaid avec leur section", () => {
    const d = extractUml("03.md", DOC);
    expect(d.title).toBe("03 — Séquence");
    expect(d.intro).toBe("Le cron déclenche l'analyse de chaque parcelle.");
    expect(d.diagrams).toEqual([
      { heading: "Diagramme", code: "sequenceDiagram\n  A->>B: ping" },
      { heading: "Vue 2", code: "flowchart LR\n  X --> Y" },
    ]);
  });
  it("document sans diagramme", () => {
    expect(extractUml("x.md", "# Titre\n\nTexte.").diagrams).toEqual([]);
  });
});

describe("mermaidLiveUrl", () => {
  it("encode l'état en base64 décodable", () => {
    const url = mermaidLiveUrl("flowchart LR\n A --> B");
    const b64 = url.split("#base64:")[1];
    const state = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    expect(url.startsWith("https://mermaid.live/view#base64:")).toBe(true);
    expect(state.code).toBe("flowchart LR\n A --> B");
  });
});
