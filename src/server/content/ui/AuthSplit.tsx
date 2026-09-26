import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Connexion / inscription : formulaire à gauche, photo à droite (≥ 1024 px).
 * Sur mobile, seule la colonne formulaire reste : rien à charger en plus
 * (l'image est masquée et `sizes` évite de la télécharger en grand).
 */
export function AuthSplit({ photo, alt, caption, children }: { photo: string; alt: string; caption: string; children: ReactNode }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start">
      <div className="rise min-w-0 max-w-2xl">{children}</div>
      <aside aria-hidden="true" className="rise sticky top-6 hidden lg:block" style={{ ["--d" as string]: "120ms" }}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] rounded-br-[6rem] shadow-raised">
          <Image src={photo} alt={alt} fill priority sizes="(min-width: 1024px) 40vw, 1px" className="kenburns object-cover" />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
          <p className="absolute right-6 bottom-6 left-6 font-[family-name:var(--font-display)] text-2xl leading-tight font-bold text-white">
            {caption}
          </p>
        </div>
      </aside>
    </div>
  );
}
