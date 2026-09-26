import { BeninArms } from "./BeninArms";

/**
 * En-tête institutionnel des documents (quittance, vérification) : armoiries,
 * République du Bénin, ministère, liseré aux couleurs du drapeau.
 * Les libellés arrivent traduits de la page appelante.
 */
export function OfficialHeader({
  armsAlt,
  republic,
  motto,
  ministry,
}: {
  armsAlt: string;
  republic: string;
  motto: string;
  ministry: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <BeninArms size={64} alt={armsAlt} />
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-display)] text-lg font-extrabold tracking-wide uppercase">{republic}</p>
          <p className="text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">{motto}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{ministry}</p>
        </div>
      </div>
      <div aria-hidden="true" className="flex h-1.5 overflow-hidden rounded-full">
        <span className="w-2/5" style={{ background: "#008751" }} />
        <span className="w-3/10 flex-1" style={{ background: "#fcd116" }} />
        <span className="flex-1" style={{ background: "#e8112d" }} />
      </div>
    </div>
  );
}
