// Passwortregeln und Leak-Prüfung (Have I Been Pwned, k-Anonymität: nur die ersten 5 Zeichen des Hashes verlassen das Gerät).

export const MIN_PASSWORD_LENGTH = 10;

const COMMON = [
  "password", "passwort", "passwort123", "password123", "qwertzuiop", "qwertyuiop", "qwerty123", "iloveyou1",
  "willkommen", "willkommen1", "welcome123", "letmein123", "abc1234567", "admin12345", "changeme123", "1q2w3e4r5t",
];

/** Deutsche Fehlermeldung oder null, wenn das Passwort die Regeln erfüllt. */
export function checkPassword(pw: string, email: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`;
  if (/^\d+$/.test(pw)) return "Das Passwort darf nicht nur aus Ziffern bestehen.";
  const local = email.split("@")[0].trim().toLowerCase();
  if (local.length >= 3 && pw.toLowerCase().includes(local)) return "Das Passwort darf nicht deine E-Mail-Adresse enthalten.";
  if (COMMON.includes(pw.toLowerCase())) return "Dieses Passwort ist zu häufig. Bitte wähle ein anderes.";
  return null;
}

/** Anzahl Treffer in bekannten Datenlecks (0 = keine), bei Netzfehler null (dann nicht blockieren). */
export async function isPwned(pw: string): Promise<number | null> {
  try {
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(pw));
    const hex = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, { headers: { "Add-Padding": "true" } });
    if (!res.ok) return null;
    const suffix = hex.slice(5);
    for (const line of (await res.text()).split("\n")) {
      const [s, count] = line.trim().split(":");
      if (s === suffix) return Number(count) || 0; // Padding-Zeilen haben Anzahl 0
    }
    return 0;
  } catch {
    return null;
  }
}

/** Regeln plus Leak-Prüfung in einem Schritt: Fehlermeldung oder null. */
export async function passwordProblem(pw: string, email: string): Promise<string | null> {
  const rule = checkPassword(pw, email);
  if (rule) return rule;
  const n = await isPwned(pw);
  return n ? `Dieses Passwort ist in bekannten Datenlecks aufgetaucht (${n}-mal). Bitte wähle ein anderes.` : null;
}
