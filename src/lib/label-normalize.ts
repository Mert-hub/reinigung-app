/**
 * "Notion-style" eşleştirme: aynı malzemeyi farklı yazımlarla (bez / bezler) tek kabul eder.
 * Sunucu tarafı yok; tüm sorgu karşılaştırmaları bu anahtar üzerinden yapılmalı.
 */

function trimAndLower(input: string): string {
  return input
    .trim()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Depo/etiket/malzeme adı için tekil "canon" anahtar.
 */
export function toCanonicalItemKey(input: string): string {
  let s = trimAndLower(input);
  if (s.length < 2) {
    return s;
  }
  if (s.length > 3 && (s.endsWith("ler") || s.endsWith("lar"))) {
    s = s.slice(0, -3);
  }
  if (s.length > 2 && s.endsWith("s") && /[a-z]$/i.test(s.slice(0, -1))) {
    s = s.slice(0, -1);
  }
  return s;
}

export function sameItemLabel(a: string, b: string): boolean {
  return toCanonicalItemKey(a) === toCanonicalItemKey(b);
}

/** Tabloda göstermek için: ilk büyük harf + geri kalan (veya girdi olduğu gibi) */
export function formatLabelDisplayName(canonicalKey: string, firstSeen?: string): string {
  if (firstSeen?.trim()) {
    return firstSeen.trim();
  }
  if (!canonicalKey) {
    return "";
  }
  return canonicalKey.charAt(0).toUpperCase() + canonicalKey.slice(1);
}
