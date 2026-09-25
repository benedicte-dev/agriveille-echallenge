/**
 * Reconnaissance d'un enregistrement audio par sa signature (octets magiques),
 * sans faire confiance au type déclaré par le navigateur.
 */
export type SniffedAudio = "audio/webm" | "audio/ogg" | "audio/wav" | "audio/mpeg" | "audio/mp4";

export function sniffAudioUpload(b: Uint8Array): SniffedAudio | null {
  if (b.length < 12) return null;
  // WebM / Matroska : EBML 1A 45 DF A3
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "audio/webm";
  // Ogg : « OggS »
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return "audio/ogg";
  // WAV : « RIFF » …. « WAVE »
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x41 && b[10] === 0x56 && b[11] === 0x45) {
    return "audio/wav";
  }
  // MP3 : « ID3 » ou trame MPEG (11 bits de synchro)
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return "audio/mpeg";
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "audio/mpeg";
  // MP4 / M4A (Safari iOS) : « ftyp » à l'octet 4
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return "audio/mp4";
  return null;
}
