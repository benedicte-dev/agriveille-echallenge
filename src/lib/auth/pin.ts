/**
 * Hachage du code PIN en argon2id (@node-rs/argon2, algorithme par défaut =
 * Argon2id ; paramètres OWASP : 19 Mio, 2 passes, 1 fil).
 * Un PIN de 4 chiffres a un espace de 10 000 valeurs : la vraie protection est
 * le verrouillage (5 échecs → 15 min) et la limitation de débit par IP ;
 * le hachage protège la base en cas de fuite.
 */
import { hash, verify } from "@node-rs/argon2";

const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export async function hashPin(pin: string): Promise<string> {
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN invalide");
  return hash(pin, OPTIONS);
}

/** Ne lève jamais : un hachage malformé ou un PIN absent donne false. */
export async function verifyPin(pinHash: string, pin: string): Promise<boolean> {
  if (typeof pin !== "string" || typeof pinHash !== "string" || !pinHash.startsWith("$argon2")) return false;
  try {
    return await verify(pinHash, pin);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;
/**
 * Vérification factice quand le compte n'existe pas : même coût qu'une vraie
 * vérification, pour ne pas révéler l'existence d'un numéro par le temps de réponse.
 */
export async function verifyPinAgainstDummy(pin: string): Promise<false> {
  dummyHash ??= hash("0000", OPTIONS);
  await verifyPin(await dummyHash, pin);
  return false;
}
