/* Pembaca file laporan marketplace (berjalan di browser). Jenis file dikenali otomatis dari isinya. */
export type Sheet = unknown[][];
export type Parsed =
  | { kind: "sales"; label: string; sumber: string; akun?: string; rows: [string, number, number, number | null][] }
  | { kind: "produk"; label: string; rows: [string, string, string, string, number, number, number][] }
  | { kind: "ads"; label: string; akun?: string; dari: string; sampai: string; rows: [string, string, string, number, number, number][] }
  | { kind: "live"; label: string; rows: [string, number, number, number, number, string, number | null, string][] };

const S = (v: unknown) => String(v ?? "").replace(/^﻿/, "").trim();
export const num = (v: unknown) => {
  if (typeof v === "number") return v;
  let x = S(v).replace(/Rp|\s|%/g, "");
  if (!x || x === "-") return 0;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(x) || /^-?\d+,\d+$/.test(x)) x = x.replace(/\./g, "").replace(",", ".");
  else x = x.replace(/,/g, "");
  const n = parseFloat(x);
  return isNaN(n) ? 0 : n;
};
const pad = (n: string | number) => String(n).padStart(2, "0");
const MON: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12, januari: 1, februari: 2, maret: 3, mei: 5, juni: 6, juli: 7, agustus: 8, oktober: 10, desember: 12 };

/* Tanggal (dan jam desimal bila ada) dari berbagai format */
export function toDT(v: unknown): [string, number | null] | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return [d.toISOString().slice(0, 10), d.getUTCHours() + d.getUTCMinutes() / 60]; }
  const s = S(v); let m;
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\/?(?:[ T]+(\d{1,2}):(\d{2}))?/))) return [`${m[1]}-${pad(m[2])}-${pad(m[3])}`, m[4] != null ? +m[4] + +m[5] / 60 : null];
  if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T]+(\d{1,2}):(\d{2}))?/))) return [`${m[3]}-${pad(m[2])}-${pad(m[1])}`, m[4] != null ? +m[4] + +m[5] / 60 : null];
  if ((m = s.match(/(\d{1,2}) ([A-Za-z]+) (\d{4})/))) { const mo = MON[m[2].toLowerCase()]; if (mo) return [`${m[3]}-${pad(mo)}-${pad(m[1])}`, null]; }
  return null;
}
const day = (v: unknown) => { const s = S(v); if (/^\d{1,2}-\d{1,2}-\d{4}-/.test(s)) return null; return toDT(v)?.[0] ?? null; };
const hm = (v: unknown) => { if (typeof v === "number" && v < 2) return v * 24; const m = S(v).match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] + +m[2] / 60 : null; };
const hdr = (rows: Sheet, test: (H: string[]) => boolean) => rows.findIndex((r) => Array.isArray(r) && test(r.map(S)));
const col = (H: string[], re: RegExp) => H.findIndex((c) => re.test(c));

/* ---------- Statistik toko Shopee: sheet "Pesanan Siap Dikirim" ---------- */
function shopeeStats(sheets: Record<string, Sheet>, file: string): Parsed | null {
  const rows = sheets["Pesanan Siap Dikirim"];
  if (!rows) return null;
  const hi = hdr(rows, (H) => H[0] === "Tanggal" && H.includes("Total Penjualan (IDR)"));
  if (hi < 0) return null;
  const H = rows[hi].map(S), iG = H.indexOf("Total Penjualan (IDR)"), iO = H.indexOf("Total Pesanan"), iV = H.indexOf("Total Pengunjung");
  const out: [string, number, number, number | null][] = [];
  for (const r of rows.slice(hi + 1)) {
    if (S(r?.[0]) === "Tanggal") continue;
    const d = day(r?.[0]); if (!d) continue;
    out.push([d, num(r[iG]), num(r[iO]), iV >= 0 ? num(r[iV]) : null]);
  }
  const akun = file.match(/([^/\\]+?)\.shopee-shop-stats/i)?.[1]?.replace(/^[0-9a-f]{8}-/, "");
  return out.length ? { kind: "sales", label: "Statistik toko Shopee (Pesanan Siap Dikirim)", sumber: "shop-stats", akun, rows: out } : null;
}

/* ---------- TikTok: Key metrics / Overview My Business Performance ---------- */
function tiktokStats(rows: Sheet): Parsed | null {
  const hi = hdr(rows, (H) => H[0] === "Tanggal" && H.some((c) => c === "GMV" || /^Nilai Bruto Barang Dagangan/.test(c)) && H.includes("Pesanan")
    && H.some((c) => c === "Pengunjung" || c === "Kunjungan halaman Toko") && !H.some((c) => /durasi|host|person/i.test(c)));
  if (hi < 0) return null;
  const H = rows[hi].map(S);
  const iG = col(H, /^(GMV|Nilai Bruto Barang Dagangan)/), iO = H.indexOf("Pesanan"), iV = H.includes("Pengunjung") ? H.indexOf("Pengunjung") : H.indexOf("Kunjungan halaman Toko");
  const out: [string, number, number, number | null][] = [];
  for (const r of rows.slice(hi + 1)) { const d = day(r?.[0]); if (!d) continue; out.push([d, num(r[iG]), num(r[iO]), iV >= 0 ? num(r[iV]) : null]); }
  return out.length ? { kind: "sales", label: "Statistik toko TikTok (Key metrics)", sumber: "key-metrics", rows: out } : null;
}

/* ---------- Ekspor pesanan Shopee / TikTok -> penjualan per produk ---------- */
function orders(rows: Sheet): Parsed | null {
  const hi = hdr(rows, (H) => H.includes("No. Pesanan") || H.includes("Order ID"));
  if (hi < 0) return null;
  const H = rows[hi].map(S), tt = H.includes("Order ID");
  const I = tt
    ? { id: H.indexOf("Order ID"), st: H.indexOf("Order Status"), st2: H.indexOf("Order Substatus"), t: H.indexOf("Created Time"), p: H.indexOf("Product Name"), v: H.indexOf("Variation"), q: H.indexOf("Quantity"), g: H.indexOf("SKU Subtotal After Discount"), k: H.indexOf("Seller SKU"), k2: -1 }
    : { id: H.indexOf("No. Pesanan"), st: H.indexOf("Status Pesanan"), st2: -1, t: H.indexOf("Waktu Pesanan Dibuat"), p: H.indexOf("Nama Produk"), v: H.indexOf("Nama Variasi"), q: H.indexOf("Jumlah"), g: H.indexOf("Harga Setelah Diskon"), k: H.indexOf("Nomor Referensi SKU"), k2: H.indexOf("SKU Induk") };
  if (I.t < 0 || I.p < 0 || I.g < 0) throw new Error("Kolom waktu pesanan, nama produk, atau harga tidak ditemukan di file pesanan.");
  const M = new Map<string, { d: string; p: string; v: string; k: string; q: number; g: number; o: Set<string> }>();
  for (const r of rows.slice(hi + 1)) {
    if (!r) continue;
    const st = S(r[I.st]) + " " + (I.st2 >= 0 ? S(r[I.st2]) : "");
    if (/batal|cancel/i.test(st)) continue;
    const d = toDT(r[I.t])?.[0]; const p = S(r[I.p]); if (!d || !p) continue;
    const v = (S(r[I.v]) || "-").slice(0, 80), q = num(r[I.q]);
    const g = tt ? num(r[I.g]) : num(r[I.g]) * q;
    const k = S(r[I.k]) || (I.k2 >= 0 ? S(r[I.k2]) : "");
    const key = d + "\u0001" + p + "\u0001" + v;
    const x = M.get(key) ?? { d, p: p.slice(0, 300), v, k: "", q: 0, g: 0, o: new Set<string>() };
    x.q += q; x.g += g; x.o.add(S(r[I.id])); if (!x.k && k) x.k = k.slice(0, 120); M.set(key, x);
  }
  const out = [...M.values()].map((x) => [x.d, x.p, x.v, x.k, x.q, Math.round(x.g), x.o.size] as [string, string, string, string, number, number, number]);
  return out.length ? { kind: "produk", label: `Ekspor pesanan ${tt ? "TikTok" : "Shopee"} (penjualan per produk)`, rows: out } : null;
}

/* ---------- Iklan Shopee (Data Keseluruhan Iklan, CSV) ---------- */
function shopeeAds(rows: Sheet): Parsed | null {
  const pi = rows.findIndex((r) => S(r?.[0]) === "Periode");
  const hi = hdr(rows, (H) => H.includes("Nama Iklan") && H.includes("Biaya"));
  if (pi < 0 || hi < 0) return null;
  const m = S(rows[pi][1]).match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
  if (!m) return null;
  const dari = toDT(m[1])![0], sampai = toDT(m[2])![0];
  const akun = S(rows.find((r) => S(r?.[0]) === "Username")?.[1]) || undefined;
  const H = rows[hi].map(S), iN = H.indexOf("Nama Iklan"), iC = H.indexOf("Biaya"), iG = H.indexOf("Omzet Penjualan"), iO = H.indexOf("Konversi");
  const C = new Map<string, [number, number, number]>();
  for (const r of rows.slice(hi + 1)) {
    const n = S(r?.[iN]); if (!n) continue;
    const c = C.get(n) ?? [0, 0, 0]; c[0] += num(r[iC]); c[1] += num(r[iG]); c[2] += num(r[iO]); C.set(n, c);
  }
  const out = [...C].filter(([, c]) => c[0] || c[1]).map(([n, c]) => [dari, sampai, n.slice(0, 255), Math.round(c[0]), Math.round(c[1]), Math.round(c[2])] as [string, string, string, number, number, number]);
  return out.length ? { kind: "ads", label: "Iklan Shopee (ringkasan per iklan)", akun, dari, sampai, rows: out } : null;
}

/* ---------- Iklan TikTok (Campaign overview per hari) ---------- */
function tiktokAds(rows: Sheet): Parsed | null {
  const hi = hdr(rows, (H) => H[0] === "Per Hari" && H.includes("Biaya"));
  if (hi < 0) return null;
  const H = rows[hi].map(S), iC = H.indexOf("Biaya"), iG = col(H, /^Penghasilan bruto/), iO = col(H, /^Pesanan SKU/);
  const out: [string, string, string, number, number, number][] = [];
  for (const r of rows.slice(hi + 1)) { const d = day(r?.[0]); if (!d) continue; const c = num(r[iC]), g = num(r[iG]); if (!c && !g) continue; out.push([d, d, "GMV Max", Math.round(c), Math.round(g), Math.round(num(r[iO]))]); }
  if (!out.length) return null;
  const ds = out.map((x) => x[0]).sort();
  return { kind: "ads", label: "Iklan TikTok (GMV Max per hari)", dari: ds[0], sampai: ds[ds.length - 1], rows: out };
}

/* ---------- Livestream ---------- */
type LR = [string, number, "S" | "T", number, number, string, string];
function liveDraft(rows: Sheet): LR[] {
  const hi = hdr(rows, (H) => H.includes("Durasi Live")); if (hi < 0) return [];
  const H = rows[hi].map(S);
  const sSt = H.indexOf("Start Time"), sDu = H.indexOf("Durasi Live"), sG = H.indexOf("GMV"), tSt = H.indexOf("Waktu Live");
  const tDu = tSt >= 0 ? H.indexOf("Durasi Live", tSt) : -1, tG = tSt >= 0 ? H.indexOf("GMV", tSt) : -1, per = H.indexOf("Person");
  const out: LR[] = [];
  for (const r0 of rows.slice(hi + 1)) {
    const r = r0 || []; const host = per >= 0 ? S(r[per]) : "";
    for (const [st, du, g, pl] of [[sSt, sDu, sG, "S"], [tSt, tDu, tG, "T"]] as [number, number, number, "S" | "T"][]) {
      if (st < 0) continue; const dt = toDT(r[st]); const dur = num(r[du]);
      if (!dt || dt[1] == null || dur <= 0.05) continue;
      const gm = g >= 0 ? (r[g + 1] != null && r[g + 1] !== "" ? num(r[g + 1]) : num(r[g])) : 0;
      out.push([dt[0], dt[1], pl, dur, gm, host, ""]);
    }
  }
  return out;
}
function liveHost(rows: Sheet): LR[] {
  const hi = hdr(rows, (H) => H[0] === "Tanggal" && H.includes("Platform/Brand")); if (hi < 0) return [];
  const H = rows[hi].map(S);
  const iS = H.indexOf("Jam Mulai"), iD = H.indexOf("Durasi"), iN = H.indexOf("Nama"), iB = H.indexOf("Platform/Brand"), iG = H.indexOf("Pendapatan");
  let date: string | null = null, prev: LR | null = null; const out: LR[] = [];
  for (const r0 of rows.slice(hi + 1)) {
    const r = r0 || []; const dt = toDT(r[0]); if (dt) date = dt[0];
    const nm = S(r[iN]), pb = S(r[iB]); if (!date || !nm || !pb) continue;
    const tt = /^tt\s*/i.test(pb); let brand = pb.replace(/^tt\s*/i, "").replace(/\s*kids$/i, "").trim(); brand = brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
    let st = hm(r[iS]), du = hm(r[iD]) || 0;
    if ((st == null || !du) && prev && prev[0] === date && prev[5] === nm) { st = st ?? prev[1]; du = du || prev[3]; }
    if (st == null || du <= 0.05) continue;
    const rec: LR = [date, st, tt ? "T" : "S", du, num(r[iG]), nm, brand]; out.push(rec); prev = rec;
  }
  return out;
}
/* Sesi Shopee & TikTok yang mulai bersamaan (selisih <= 20 menit, host & brand sama) digabung; durasi dihitung sekali */
function mergeLive(R: LR[]) {
  const g: Record<string, LR[]> = {}; R.forEach((x) => { (g[x[0] + "|" + x[5] + "|" + x[6]] ??= []).push(x); });
  const out: [string, number, number, number, number, string, number | null, string][] = [];
  Object.values(g).forEach((xs) => {
    const Sx = xs.filter((x) => x[2] === "S").sort((a, b) => a[1] - b[1]), T = xs.filter((x) => x[2] === "T").sort((a, b) => a[1] - b[1]), used = new Set<number>();
    Sx.forEach((s) => {
      let bi = -1; T.forEach((t, i) => { if (!used.has(i) && Math.abs(t[1] - s[1]) <= 0.34 && (bi < 0 || Math.abs(t[1] - s[1]) < Math.abs(T[bi][1] - s[1]))) bi = i; });
      if (bi >= 0) { used.add(bi); const t = T[bi]; out.push([s[0], +s[1].toFixed(2), +t[3].toFixed(2), Math.round(s[4]), Math.round(t[4]), s[5], null, s[6]]); }
      else out.push([s[0], +s[1].toFixed(2), +s[3].toFixed(2), Math.round(s[4]), 0, s[5], null, s[6]]);
    });
    T.forEach((t, i) => { if (!used.has(i)) out.push([t[0], +t[1].toFixed(2), +t[3].toFixed(2), 0, Math.round(t[4]), t[5], null, t[6]]); });
  });
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
}

export function detect(sheets: Record<string, Sheet>, file: string): Parsed {
  const r = shopeeStats(sheets, file);
  if (r) return r;
  const list = Object.values(sheets);
  let L: LR[] = [];
  for (const rows of list) L = L.concat(liveDraft(rows), liveHost(rows));
  if (L.length) return { kind: "live", label: "Laporan livestream", rows: mergeLive(L) };
  for (const rows of list) {
    const x = tiktokStats(rows) ?? shopeeAds(rows) ?? tiktokAds(rows) ?? orders(rows);
    if (x) return x;
  }
  throw new Error("Jenis file tidak dikenali. Yang didukung: statistik toko Shopee, Key metrics TikTok, ekspor pesanan Shopee/TikTok, iklan Shopee (CSV), iklan TikTok (Campaign overview), dan laporan livestream.");
}
