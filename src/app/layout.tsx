import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { LOCALE_HTML_LANG, frMessages, getMessages, t } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/provider";
import { CONTRAST_COOKIE } from "@/components/ui/ContrastToggle";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { ServiceWorkerRegister } from "@/components/ui/ServiceWorkerRegister";

// Titres : Bricolage Grotesque (caractère affirmé) ; texte : Figtree (lisible en petit).
// Les glyphes fon absents (ɔ, ɛ, ɖ) retombent sur la pile système de --font-sans.
const display = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], variable: "--font-display-face", display: "swap" });
const body = Figtree({ subsets: ["latin", "latin-ext"], variable: "--font-body-face", display: "swap" });

export const metadata: Metadata = {
  title: { default: "AgriVeille", template: "%s · AgriVeille" },
  description:
    "Météo de vos champs, alertes ravageurs, marché et quittances : la veille agricole du Bénin, en français, fɔngbe et yorùbá.",
  applicationName: "AgriVeille",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "AgriVeille", statusBarStyle: "default" },
  // Les numéros (téléphone, montants) ne doivent pas devenir des liens automatiques.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pas de maximumScale : le zoom reste possible (WCAG 1.4.4).
  themeColor: "#1e6b3a",
  colorScheme: "light",
};

/** Libellé local si la clé n'existe pas encore dans le dictionnaire. */
function label(messages: Parameters<typeof t>[0], key: string, fallback: string): string {
  const value = t(messages, key);
  return value === key ? fallback : value;
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const highContrast = (await cookies()).get(CONTRAST_COOKIE)?.value === "high";

  return (
    <html lang={LOCALE_HTML_LANG[locale]} className={`${display.variable} ${body.variable}`} data-contrast={highContrast ? "high" : undefined}>
      <body className="min-h-dvh">
        <a
          href="#contenu"
          className="sr-only z-100 rounded-lg bg-surface px-4 py-3 font-bold text-ink shadow-raised focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          {label(messages, "a11y.skip_to_content", "Aller au contenu")}
        </a>
        <OfflineBanner
          title={label(messages, "offline.banner", "Hors ligne")}
          message={label(messages, "offline.message", "Vous pouvez continuer. Tout sera envoyé au retour du réseau.")}
        />
        <I18nProvider locale={locale} messages={messages} fallback={locale === "fr" ? undefined : frMessages}>
          {children}
        </I18nProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
