/* Nama produk pendek: buang bagian setelah " - " / "|" / "(", maksimal ±42 huruf di batas kata. Nama lengkap tetap di tooltip. */
export const shortName = (n: string) => { let x = (n ?? "").split(/\s[-|–]\s|\s\(|\|/)[0].trim(); if (x.length > 42) { x = x.slice(0, 42); const i = x.lastIndexOf(" "); x = (i > 20 ? x.slice(0, i) : x) + "…"; } return x; };
