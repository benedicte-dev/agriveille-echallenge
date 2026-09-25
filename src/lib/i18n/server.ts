/** Lecture de la langue côté serveur (Server Components, actions, routes). */
import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale, toLocale } from "./config";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return toLocale(store.get(LOCALE_COOKIE)?.value);
}
