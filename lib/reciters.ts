export interface Reciter {
  name: string;
  /** Islamic Network audio edition identifier. */
  edition: string;
}

/**
 * Renowned qurra streamed from the Islamic Network audio CDN.
 * Audio URL pattern: https://cdn.islamic.network/quran/audio/128/{edition}/{ayah}.mp3
 */
export const RECITERS: Reciter[] = [
  { name: "Mishary Rashid Alafasy", edition: "ar.alafasy" },
  { name: "Abdul Basit Abdus-Samad", edition: "ar.abdulbasitmurattal" },
  { name: "Mahmoud Khalil Al-Husary", edition: "ar.husary" },
  { name: "Shahriar Parhizgar", edition: "ar.parhizgar" },
  { name: "Maher Al-Muaiqly", edition: "ar.mahermuaiqly" },
  { name: "Mohamed Al-Minshawi", edition: "ar.minshawi" },
  { name: "Abdul Rahman Al-Sudais", edition: "ar.abdurrahmaansudais" },
];

/** Global ayah numbers (1-based across the whole Qur'an). */
export const FATIHA = [1, 2, 3, 4, 5, 6, 7];
export const KURSI = [262]; // Ayat al-Kursi, 2:255

export type Piece = "fatiha" | "kursi";

export const audioURL = (edition: string, ayah: number) =>
  `https://cdn.islamic.network/quran/audio/128/${edition}/${ayah}.mp3`;

export function pieceAyahs(piece: Piece): number[] {
  return piece === "kursi" ? KURSI : FATIHA;
}

export function pieceLabel(piece: Piece): string {
  return piece === "kursi" ? "Āyat al-Kursī · 2:255" : "Sūrat al-Fātiḥa";
}
