import type { Bucket } from "@/server/levies/stats";
import { formatInt } from "@/server/market/format";

/**
 * Barres horizontales en SVG (Server Component, aucun JS). Décoratif pour les lecteurs d'écran :
 * `role="img"` + libellé qui renvoie au tableau accessible placé juste après.
 */
export function BarChart({ buckets, label, max = 12 }: { buckets: Bucket[]; label: string; max?: number }) {
  const rows = buckets.slice(0, max);
  const top = Math.max(1, ...rows.map((b) => b.totalFcfa));
  const rowH = 32;
  const labelW = 150;
  const valueW = 110;
  const width = 600;
  const barW = width - labelW - valueW;
  const height = rows.length * rowH + 8;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full max-w-3xl"
      preserveAspectRatio="xMinYMin meet"
    >
      {rows.map((b, i) => {
        const y = i * rowH + 4;
        const w = Math.max(b.totalFcfa > 0 ? 2 : 0, Math.round((b.totalFcfa / top) * barW));
        const text = b.label.length > 20 ? `${b.label.slice(0, 19)}…` : b.label;
        return (
          <g key={b.key} aria-hidden="true">
            <text x={labelW - 8} y={y + 18} textAnchor="end" className="fill-ink text-[13px]">
              {text}
            </text>
            <rect x={labelW} y={y + 4} width={barW} height={rowH - 12} rx={4} className="fill-sunken" />
            <rect x={labelW} y={y + 4} width={w} height={rowH - 12} rx={4} className="fill-primary" />
            <text x={labelW + barW + 8} y={y + 18} className="fill-ink text-[13px] font-semibold tabular-nums">
              {formatInt(b.totalFcfa)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
