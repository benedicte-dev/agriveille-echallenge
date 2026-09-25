import type { ReactNode } from "react";
import { cx } from "./cx";

export type Column<T> = {
  key: string;
  header: string;
  /** Rendu de la cellule. */
  cell: (row: T) => ReactNode;
  align?: "start" | "end";
  /** Colonne titre de la carte en vue mobile (une seule, la 1re par défaut). */
  primary?: boolean;
  /** Masquée en vue mobile (détail secondaire). */
  hideOnMobile?: boolean;
};

export type DataTableProps<T> = {
  /** Légende du tableau (lue par les lecteurs d'écran ; visible si captionVisible). */
  caption: string;
  captionVisible?: boolean;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Contenu si aucune ligne (EmptyState). */
  empty?: ReactNode;
  className?: string;
};

/**
 * Tableau responsive sans JS :
 * - ≥ 768 px : vrai <table> (en-têtes th scope="col", chiffres alignés à droite).
 * - < 768 px : une carte par ligne, paires libellé / valeur en <dl>.
 */
export function DataTable<T>({ caption, captionVisible = false, columns, rows, rowKey, empty, className }: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const rest = columns.filter((c) => c !== primary && !c.hideOnMobile);
  return (
    <div className={className}>
      <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface md:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className={captionVisible ? "px-4 py-3 text-left text-lg font-bold" : "sr-only"}>{caption}</caption>
          <thead className="bg-sunken">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cx("border-b border-line-strong px-4 py-3 font-semibold text-ink", c.align === "end" && "text-right")}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="border-b border-line last:border-b-0 hover:bg-canvas">
                {columns.map((c) => (
                  <td key={c.key} className={cx("px-4 py-3 align-top text-ink", c.align === "end" && "text-right")}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <p className={captionVisible ? "mb-2 text-lg font-bold" : "sr-only"}>{caption}</p>
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={rowKey(r)} className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <div className="text-base font-bold text-ink">{primary.cell(r)}</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                {rest.map((c) => (
                  <div key={c.key} className="flex flex-col">
                    <dt className="text-ink-muted">{c.header}</dt>
                    <dd className="font-semibold text-ink">{c.cell(r)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
