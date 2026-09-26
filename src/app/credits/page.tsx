import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader } from "@/components/ui";
import { IconRegle } from "@/components/icons";
import { BeninArms } from "@/components/brand/BeninArms";
import { PublicFrame } from "@/server/content/ui/PublicFrame";
import { getTranslator } from "@/server/content/ui/i18n";
import photos from "../../../public/images/fermes/credits.json";
import arms from "../../../public/images/brand/credits.json";

export const metadata: Metadata = { title: "Crédits photos" };

type Credit = { file: string; title: string; author: string; license: string | null; licenseUrl?: string | null; source: string };

/** Attribution exigée par les licences CC BY / CC BY-SA des images réutilisées. */
export default async function CreditsPage() {
  const { tr } = await getTranslator();
  const list = photos as Credit[];

  return (
    <PublicFrame>
      <PageHeader title={tr("credits.title")} icon={<IconRegle size={32} />} subtitle={tr("credits.intro")} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <li key={c.file} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="relative aspect-[4/3]">
              <Image src={c.file} alt={c.title.replace(/\.jpe?g$/i, "")} fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" className="object-cover" />
            </div>
            <div className="flex flex-col gap-1 p-4 text-sm">
              <p className="font-semibold text-ink">{c.title.replace(/\.jpe?g$/i, "")}</p>
              <p>
                {tr("credits.author")} : {c.author}
              </p>
              <p>
                {tr("credits.license")} :{" "}
                {c.licenseUrl ? (
                  <a href={c.licenseUrl} rel="noopener noreferrer" target="_blank" className="font-semibold text-primary">
                    {c.license}
                  </a>
                ) : (
                  c.license
                )}
              </p>
              <a href={c.source} rel="noopener noreferrer" target="_blank" className="font-semibold text-primary">
                {tr("credits.source")}
              </a>
            </div>
          </li>
        ))}
        <li className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-sm shadow-card">
          <BeninArms size={72} alt={tr("brand.arms_alt")} />
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-ink">{tr("credits.arms")}</p>
            <p>
              {tr("credits.author")} : {arms.author}
            </p>
            <p>
              {tr("credits.license")} : {arms.license}
            </p>
            <a href={arms.source} rel="noopener noreferrer" target="_blank" className="font-semibold text-primary">
              {tr("credits.source")}
            </a>
          </div>
        </li>
      </ul>
    </PublicFrame>
  );
}
