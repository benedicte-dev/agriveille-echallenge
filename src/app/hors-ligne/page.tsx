import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { IconAlerte, IconChamp, IconHautParleur, IconHorsLigne, IconMeteoNuage, IconSignaler, IconVendre } from "@/components/icons";
import { ListenButton, PublicShell } from "@/components/ui";
import { getMessages, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { OfflineActions } from "./OfflineActions";

export const metadata: Metadata = { title: "Hors ligne", robots: { index: false } };

/**
 * Page de repli du service worker (public/sw.js) quand une page n'est ni
 * joignable ni en cache. Aucune donnée personnelle : elle est pré-cachée.
 */
export default async function HorsLignePage() {
  const locale = await getLocale();
  const m = getMessages(locale);
  const can: Array<{ icon: ReactNode; text: string; href?: string }> = [
    { icon: <IconSignaler size={32} />, text: t(m, "off.can_report"), href: "/app/signaler" },
    { icon: <IconAlerte size={32} />, text: t(m, "off.can_read"), href: "/app/alertes" },
    { icon: <IconChamp size={32} />, text: t(m, "off.can_fields"), href: "/app/parcelles" },
    { icon: <IconHautParleur size={32} />, text: t(m, "off.can_listen") },
  ];
  const cannot: Array<{ icon: ReactNode; text: string }> = [
    { icon: <IconMeteoNuage size={32} />, text: t(m, "off.need_weather") },
    { icon: <IconVendre size={32} />, text: t(m, "off.need_market") },
  ];
  const spoken = [t(m, "offline.title"), t(m, "offline.message"), t(m, "off.can_title"), ...can.map((c) => c.text)].join(". ");

  return (
    <PublicShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-warning-soft text-warning">
            <IconHorsLigne size={48} />
          </span>
          <h1 className="text-xl sm:text-2xl">{t(m, "offline.title")}</h1>
          <p className="max-w-prose text-base">{t(m, "offline.message")}</p>
          <ListenButton
            text={spoken}
            lang={locale}
            labels={{ listen: t(m, "common.listen"), stop: t(m, "common.stop"), loading: t(m, "common.loading"), error: t(m, "error.voice_unavailable") }}
          />
        </header>

        <OfflineActions />

        <section aria-labelledby="off-can" className="flex flex-col gap-3">
          <h2 id="off-can" className="text-lg">
            {t(m, "off.can_title")}
          </h2>
          <ul className="flex flex-col gap-3">
            {can.map((c) => (
              <li key={c.text}>
                {c.href ? (
                  <Link
                    href={c.href}
                    prefetch={false}
                    className="av-control flex min-h-touch-lg items-center gap-4 rounded-xl border-2 border-line-strong bg-surface p-3 text-lg font-semibold text-ink no-underline hover:bg-sunken"
                  >
                    <span className="shrink-0 text-primary">{c.icon}</span>
                    {c.text}
                  </Link>
                ) : (
                  <p className="flex min-h-touch-lg items-center gap-4 rounded-xl border border-line bg-surface p-3 text-lg font-semibold">
                    <span className="shrink-0 text-primary">{c.icon}</span>
                    {c.text}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="off-cannot" className="flex flex-col gap-3">
          <h2 id="off-cannot" className="text-lg">
            {t(m, "off.need_title")}
          </h2>
          <ul className="flex flex-col gap-2">
            {cannot.map((c) => (
              <li key={c.text} className="flex items-center gap-4 rounded-xl bg-sunken p-3 text-base">
                <span className="shrink-0 text-ink-muted">{c.icon}</span>
                {c.text}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PublicShell>
  );
}
