/* Pembaca file laporan marketplace (berjalan di browser). Jenis file dikenali otomatis dari isinya. */
export type Sheet = unknown[][];
export type SP = { dari: string; sampai: string; data: Record<string, unknown> };
export type FileData = { kind: "file"; jenis: string; label: string; scope: "store" | "client"; platform?: "Shopee" | "TikTok"; akun?: string; dari: string; sampai: string; n: number; info: string; data: unknown; pp?: unknown[] };
/* Pesanan per nomor: [id, tanggal, status, status asli, alasan batal, status retur, gmv, qty, metode bayar, provinsi, kota, batas kirim, dikirim, selesai] */
export type OrdRow = [string, string, string, string, string, string, number, number, string, string, string, string | null, string | null, string | null];
/* Produk di pesanan batal/retur: [id, produk, varian, sku, qty, gmv] */
export type OrdItem = [string, string, string, string, number, number];
export function ordStatus(raw: string, ret: string, tt: boolean) {
  const s = raw.toLowerCase(), r = ret.toLowerCase();
  if (/batal|cancel/.test(s)) return "batal";
  if (r && /pengembalian|refund|return|disetujui|divalidasi|retur/.test(r) && !/ditolak|dibatalkan/.test(r)) return "retur";
  if (/belum bayar|belum dibayar|unpaid|menunggu pembayaran/.test(s)) return "belum_bayar";
  if (/perlu dikirim|akan dikirim|to ship|siap dikirim|awaiting/.test(s)) return "perlu_kirim";
  if (/dikirim|shipped|in transit|dalam pengiriman/.test(s) && !/diterima|terkirim/.test(s)) return "dikirim";
  if (/pesanan diterima|terkirim|delivered/.test(s)) return tt ? "diterima" : "diterima";
  if (/selesai|completed/.test(s)) return "selesai";
  return "lainnya";
}
export type Parsed =
  | FileData
  | { kind: "sales"; label: string; sumber: string; akun?: string; rows: [string, number, number, number | null][]; sp?: SP }
  | { kind: "produk"; label: string; rows: [string, string, string, string, number, number, number][]; ord?: OrdRow[]; oi?: OrdItem[] }
  | { kind: "ads"; label: string; akun?: string; dari: string; sampai: string; rows: [string, string, string, number, number, number][]; meta?: [string, number | null, number | null, number | null][] }
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

/* ---------- Statistik toko Shopee: sheet "Pesanan Siap Dikirim" ----------
   Ekspor 1 hari berisi rincian per jam: dijumlah per tanggal (bukan ditimpa jam terakhir). */
const rangeRow = (v: unknown) => S(v).match(/^(\d{1,2})-(\d{1,2})-(\d{4})-(\d{1,2})-(\d{1,2})-(\d{4})$/);
function shopeeStats(sheets: Record<string, Sheet>, file: string): Parsed | null {
  const rows = sheets["Pesanan Siap Dikirim"];
  if (!rows) return null;
  const hi = hdr(rows, (H) => H[0] === "Tanggal" && H.includes("Total Penjualan (IDR)"));
  if (hi < 0) return null;
  const H = rows[hi].map(S), iG = H.indexOf("Total Penjualan (IDR)"), iO = H.indexOf("Total Pesanan"), iV = H.indexOf("Total Pengunjung");
  const sum = rows.find((r) => rangeRow(r?.[0]));
  const M = new Map<string, [number, number, number | null, number]>();
  for (const r of rows.slice(hi + 1)) {
    if (S(r?.[0]) === "Tanggal") continue;
    const d = day(r?.[0]); if (!d) continue;
    const x = M.get(d) ?? [0, 0, iV >= 0 ? 0 : null, 0]; x[0] += num(r[iG]); x[1] += num(r[iO]); if (x[2] != null) x[2] += num(r[iV]); x[3]++; M.set(d, x);
  }
  // Satu hari: pakai baris ringkasan (pengunjung unik), bukan jumlah per jam
  if (M.size === 1 && sum) { const m = rangeRow(sum[0])!, d = `${m[3]}-${pad(m[2])}-${pad(m[1])}`; if (M.has(d) && `${m[6]}-${pad(m[5])}-${pad(m[4])}` === d) M.set(d, [num(sum[iG]), num(sum[iO]), iV >= 0 ? num(sum[iV]) : null, 1]); }
  const out = [...M].map(([d, x]) => [d, x[0], x[1], x[2]] as [string, number, number, number | null]);
  const akun = file.match(/([^/\\]+?)\.shopee-shop-stats/i)?.[1]?.replace(/^[0-9a-f]{8}-/, "");
  return out.length ? { kind: "sales", label: "Statistik toko Shopee (Pesanan Siap Dikirim)", sumber: "shop-stats", akun, rows: out, sp: shopeeExtra(sheets, file) } : null;
}
/* Metrik tambahan statistik toko (pembatalan, pembeli, asal penjualan, sesi live) untuk kartu "Detail Seller Centre" */
function shopeeExtra(sheets: Record<string, Sheet>, file: string): SP | undefined {
  const m = file.match(/shopee-shop-stats\.(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})/); if (!m) return undefined;
  const first = Object.values(sheets)[0]; if (!first?.length) return undefined;
  const H = first[0].map(S), r = first.find((x) => rangeRow(x?.[0])) ?? first[1]; if (!r) return undefined;
  const g = (k: string) => { const i = H.indexOf(k); return i >= 0 ? num(r[i]) : null; };
  const D: Record<string, unknown> = { penjualan: g("Total Penjualan (IDR)"), pesanan: g("Total Pesanan"), diklik: g("Produk Diklik"), pengunjung: g("Total Pengunjung"),
    batal_o: g("Pesanan Dibatalkan"), batal_g: g("Penjualan Dibatalkan"), retur_o: g("Pesanan Dikembalikan"), retur_g: g("Penjualan Dikembalikan"),
    pembeli: g("Pembeli"), baru: g("Total Pembeli Baru"), lama: g("Total Pembeli Saat Ini"), potensi: g("Total Potensi Pembeli"), ulang: g("Tingkat Pembelian Berulang") };
  for (const [n, R] of Object.entries(sheets)) {
    if (n.startsWith("Asal Kunjungan") && S(R[0]?.[0]) === "Tanggal" && R[1]) { const k = R[1]; Object.assign(D, { k_halaman: num(k[3]), k_live: num(k[4]), k_video: num(k[5]), k_aff: num(k[6]), k_iklan: num(k[7]) }); }
    if (n === "Kontribusi Livestream (Dibuat)") D.live = R.slice(2).filter((y) => y && S(y[0])).slice(0, 300).map((y) => [S(y[1]).slice(0, 80), num(y[3]), num(y[5]), num(y[7]), num(y[8]), S(y[9]), num(y[10]), num(y[11]), num(y[13])]);
  }
  return { dari: `${m[1]}-${m[2]}-${m[3]}`, sampai: `${m[4]}-${m[5]}-${m[6]}`, data: D };
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
  const c = (k: string) => H.indexOf(k);
  const J = tt
    ? { ret: c("Cancelation/Return Type"), al: c("Cancel Reason"), m: c("Payment Method"), pv: c("Province"), kt: c("Regency and City"), bk: -1, kr: c("Shipped Time"), sl: c("Delivered Time"), rq: c("Sku Quantity of return") }
    : { ret: c("Status Pembatalan/ Pengembalian"), al: c("Alasan Pembatalan"), m: c("Metode Pembayaran"), pv: c("Provinsi"), kt: c("Kota/Kabupaten"), bk: c("Pesanan Harus Dikirimkan Sebelum (Menghindari keterlambatan)"), kr: c("Waktu Pengiriman Diatur"), sl: c("Waktu Pesanan Selesai"), rq: c("Returned quantity") };
  const O = new Map<string, OrdRow>(); const OI: OrdItem[] = [];
  const g0 = (r: unknown[], i: number) => (i >= 0 ? S(r[i]) : "");
  for (const r of rows.slice(hi + 1)) {
    if (!r) continue;
    const st = S(r[I.st]) + " " + (I.st2 >= 0 ? S(r[I.st2]) : "");
    const oid = S(r[I.id]);
    if (oid) {
      const d0 = toDT(r[I.t])?.[0]; const q0 = num(r[I.q]); const gg = tt ? num(r[I.g]) : num(r[I.g]) * q0;
      if (d0) {
        const raw = (S(r[I.st]) + (I.st2 >= 0 && S(r[I.st2]) ? " / " + S(r[I.st2]) : "")).slice(0, 100), ret = g0(r, J.ret).slice(0, 60);
        const stt = ordStatus(raw, ret || (J.rq >= 0 && num(r[J.rq]) > 0 ? "retur" : ""), tt);
        const o = O.get(oid);
        if (o) { o[6] += gg; o[7] += q0; }
        else O.set(oid, [oid, d0, stt, raw, g0(r, J.al).slice(0, 200), ret, gg, q0, g0(r, J.m).slice(0, 40), g0(r, J.pv).slice(0, 50), g0(r, J.kt).slice(0, 60), J.bk >= 0 ? toDT(r[J.bk])?.[0] ?? null : null, J.kr >= 0 ? toDT(r[J.kr])?.[0] ?? null : null, J.sl >= 0 ? toDT(r[J.sl])?.[0] ?? null : null]);
        if (stt === "batal" || stt === "retur") OI.push([oid, S(r[I.p]).slice(0, 300), (S(r[I.v]) || "-").slice(0, 80), (S(r[I.k]) || "").slice(0, 120), q0, Math.round(gg)]);
      }
    }
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
  const ord = [...O.values()].map((o) => { o[6] = Math.round(o[6]); return o; });
  return out.length || ord.length ? { kind: "produk", label: `Ekspor pesanan ${tt ? "TikTok" : "Shopee"} (penjualan per produk + status pesanan)`, rows: out, ord, oi: OI } : null;
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
  const H = rows[hi].map(S), iN = H.indexOf("Nama Iklan"), iC = H.indexOf("Biaya"), iG = H.indexOf("Omzet Penjualan"), iO = H.indexOf("Konversi"), iL = H.indexOf("Dilihat"), iK = H.indexOf("Jumlah Klik"), iT = H.indexOf("Tambah ke Keranjang");
  const C = new Map<string, [number, number, number]>(), MT = new Map<string, [number | null, number | null, number | null]>();
  for (const r of rows.slice(hi + 1)) {
    const n = S(r?.[iN]); if (!n) continue;
    const c = C.get(n) ?? [0, 0, 0]; c[0] += num(r[iC]); c[1] += num(r[iG]); c[2] += num(r[iO]); C.set(n, c);
    const z = (i: number) => (i >= 0 && S(r[i]) !== "-" && S(r[i]) !== "" ? num(r[i]) : null);
    MT.set(n.replace(/\s+/g, " ").trim().slice(0, 255), [z(iL), z(iK), z(iT)]);
  }
  const out = [...C].filter(([, c]) => c[0] || c[1]).map(([n, c]) => [dari, sampai, n.slice(0, 255), Math.round(c[0]), Math.round(c[1]), Math.round(c[2])] as [string, string, string, number, number, number]);
  return out.length ? { kind: "ads", label: "Iklan Shopee (ringkasan per iklan)", akun, dari, sampai, rows: out, meta: [...MT].map(([n, v]) => [n, ...v]) } : null;
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

/* ================= File Seller Centre tambahan (disimpan utuh per periode) ================= */
const ymd = (v: unknown) => toDT(v)?.[0] ?? null;
const addD = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const rangeOf = (ds: (string | null)[]) => { const s = ds.filter(Boolean).sort() as string[]; return s.length ? [s[0], s[s.length - 1]] : null; };
const dur = (v: unknown) => { const t = S(v); let m; if ((m = t.match(/^(\d+):(\d{2}):(\d{2})$/))) return +m[1] + +m[2] / 60 + +m[3] / 3600; if ((m = t.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*min)?/)) && (m[1] || m[2])) return (+(m[1] || 0)) + (+(m[2] || 0)) / 60; return hm(v) ?? 0; };
const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id");
/* CSV ekspor Shopee/TikTok memakai titik sebagai desimal (mis. 1043.625) */
const pf = (v: unknown) => { if (typeof v === "number") return v; const n = parseFloat(S(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; };
const fileYmd = (f: string, re: RegExp) => { const m = f.match(re); return m ? [`${m[1]}-${m[2]}-${m[3]}`, `${m[4]}-${m[5]}-${m[6]}`] : null; };

/* Daftar livestream Shopee (Live & Video → Daftar Livestream → Export) */
function shopeeLive(rows: Sheet): FileData | null {
  const hi = hdr(rows, (H) => H.includes("Nama Livestream") && H.includes("Start Time") && H.includes("Penonton")); if (hi < 0) return null;
  const H = rows[hi].map(S), c = (k: string) => H.indexOf(k);
  const R = rows.slice(hi + 1).filter((r) => toDT(r?.[c("Start Time")])).map((r) => {
    const t = toDT(r[c("Start Time")])!;
    return [`${t[0]} ${pad(Math.floor(t[1] ?? 0))}:${pad(Math.round(((t[1] ?? 0) % 1) * 60))}`, +dur(r[c("Durasi:")]).toFixed(2), S(r[c("Nama Livestream")]).slice(0, 120),
      num(r[c("Penonton")]), num(r[c("Penonton Aktif")]), num(r[c("Komentar")]), num(r[c("Tambah ke Keranjang")]), S(r[c("Rata-rata durasi ditonton")]),
      num(r[c("Pesanan(Pesanan Dibuat)")]), num(r[c("Penjualan(Pesanan Dibuat)")]), num(r[c("Pesanan(Pesanan Siap Dikirim)")]), num(r[c("Penjualan(Pesanan Siap Dikirim)")])];
  });
  if (!R.length) return null;
  const pm = S(rows[hi + 1]?.[c("Periode Data")]).match(/(\d{1,2}-\d{1,2}-\d{4})\s*-\s*(\d{1,2}-\d{1,2}-\d{4})/);
  const rg = pm ? [ymd(pm[1])!, ymd(pm[2])!] : rangeOf(R.map((x) => String(x[0]).slice(0, 10)))!;
  const jam = R.reduce((a, x) => a + (x[1] as number), 0), g = R.reduce((a, x) => a + (x[9] as number), 0);
  return { kind: "file", jenis: "live-shopee", label: "Daftar livestream Shopee", scope: "store", platform: "Shopee", akun: S(rows[hi + 1]?.[c("User Id")]).replace(/\.0$/, "") || undefined,
    dari: rg[0], sampai: rg[1], n: R.length, info: `${R.length} sesi · ${jam.toFixed(0)} jam · penjualan ${rp(g)}`, data: { h: ["mulai", "durasi_jam", "judul", "penonton", "penonton_aktif", "komentar", "keranjang", "rata_tonton", "pesanan", "penjualan", "pesanan_siap", "penjualan_siap"], rows: R } };
}

/* Sesi LIVE TikTok (Analitik LIVE & video → Detail → Unduh) */
function tiktokLive(rows: Sheet): FileData | null {
  const hi = hdr(rows, (H) => H.includes("Waktu Live") && H.includes("Durasi") && H.some((c) => /^GMV LIVE/.test(c))); if (hi < 0) return null;
  const H = rows[hi].map(S), c = (k: string) => H.indexOf(k), cr = (re: RegExp) => col(H, re);
  const R = rows.slice(hi + 1).filter((r) => toDT(r?.[c("Waktu Live")])).map((r) => {
    const t = toDT(r[c("Waktu Live")])!;
    return [`${t[0]} ${pad(Math.floor(t[1] ?? 0))}:${pad(Math.round(((t[1] ?? 0) % 1) * 60))}`, +dur(r[c("Durasi")]).toFixed(2), S(r[c("Nama panggilan")]) || S(r[c("Kreator")]),
      num(r[cr(/^GMV dari LIVE/)]), num(r[cr(/^GMV LIVE/)]), num(r[c("Pesanan Dibayar")]), num(r[c("Produk Terjual")]), num(r[c("Penonton")]), num(r[c("Live Stream Dilihat")]),
      num(r[c("Komentar")]), num(r[c("Suka pada LIVE")]), num(r[c("Produk Dilihat")]), num(r[c("Klik Produk")]), S(r[c("Durasi menonton rata-rata (Siaran LIVE)")])];
  });
  if (!R.length) return null;
  const dm = S(rows[0]?.[0]).match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
  const rg = dm ? [dm[1], dm[2]] : rangeOf(R.map((x) => String(x[0]).slice(0, 10)))!;
  const akunL = [...new Set(R.map((x) => x[2]))];
  const jam = R.reduce((a, x) => a + (x[1] as number), 0), g = R.reduce((a, x) => a + (x[3] as number), 0);
  return { kind: "file", jenis: "live-tiktok", label: "Sesi LIVE TikTok", scope: "store", platform: "TikTok", dari: rg[0], sampai: rg[1], n: R.length,
    info: `${R.length} sesi · ${jam.toFixed(0)} jam · GMV ${rp(g)} · akun: ${akunL.slice(0, 3).join(", ")}${akunL.length > 3 ? "…" : ""}`,
    data: { h: ["mulai", "durasi_jam", "akun", "gmv_dari_live", "gmv_live", "pesanan", "terjual", "penonton", "dilihat", "komentar", "suka", "produk_dilihat", "klik_produk", "rata_tonton"], rows: R } };
}

/* Analitik produk TikTok (Analitik produk → Berdasarkan produk → Unduh) */
function tiktokProduk(rows: Sheet): FileData | null {
  const dm = S(rows[0]?.[0]).match(/Tanggal analisis:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*~\s*(\d{1,2}\/\d{1,2}\/\d{4})/); if (!dm) return null;
  const hi = hdr(rows, (H) => H[0] === "Nama" && H[1] === "ID Produk"); if (hi < 0) return null;
  const H = rows[hi].map(S), c = (k: string) => H.indexOf(k);
  const R = rows.slice(hi + 1).filter((r) => S(r?.[1])).map((r) => [S(r[1]), S(r[0]).slice(0, 150), num(r[c("GMV")]), num(r[c("Pesanan")]), num(r[c("Produk terjual")]), num(r[c("Impresi produk")]), num(r[c("Klik produk")]),
    num(r[c("Jumlah tambahkan ke keranjang")]), num(r[c("Pengembalian dana")]), num(r[c("GMV dari LIVE penjual")]), num(r[c("GMV dari video penjual")]), num(r[c("GMV dari kreator")]), num(r[c("GMV kartu produk penjual")])]);
  if (!R.length) return null;
  const g = R.reduce((a, x) => a + (x[2] as number), 0);
  return { kind: "file", jenis: "produk-tiktok", label: "Analitik produk TikTok", scope: "store", platform: "TikTok", dari: ymd(dm[1])!, sampai: ymd(dm[2])!, n: R.length, info: `${R.length} produk · GMV ${rp(g)}`,
    data: { h: ["id", "nama", "gmv", "pesanan", "terjual", "impresi", "klik", "keranjang", "refund", "gmv_live", "gmv_video", "gmv_kreator", "gmv_kartu"], rows: R } };
}

/* Performa produk Shopee (Performa Toko → Produk → Performa Produk → Download) */
function shopeeProduk(sheets: Record<string, Sheet>, file: string): FileData | null {
  const rows = sheets["Produk dengan Performa Terbaik"]; if (!rows) return null;
  const H = (rows[0] ?? []).map(S), c = (k: string) => H.indexOf(k);
  if (c("Kode Produk") < 0 || c("Total Penjualan (Pesanan Dibuat) (IDR)") < 0) return null;
  const rg = fileYmd(file, /parentskudetail\.(\d{4})(\d{2})(\d{2})_(\d{4})(\d{2})(\d{2})/); if (!rg) throw new Error("Nama file performa produk Shopee tidak berisi periode (parentskudetail.YYYYMMDD_YYYYMMDD). Unggah file asli tanpa mengganti nama.");
  const par = rows.slice(1).filter((r) => r && S(r[0]) && (S(r[3]) === "-" || !S(r[3])));
  const pp = par.map((r) => [S(r[0]), S(r[1]).slice(0, 150), num(r[c("Total Penjualan (Pesanan Dibuat) (IDR)")]), num(r[c("Pesanan Dibuat")]), num(r[c("Jumlah Produk Dilihat")]), num(r[c("Produk Diklik")]),
    num(r[c("Pengunjung Produk (Kunjungan)")]), num(r[c("Dimasukkan ke Keranjang (Produk)")]), num(r[c("Pengunjung Produk (Menambahkan Produk ke Keranjang)")])]);
  if (!pp.length) return null;
  const g = pp.reduce((a, x) => a + (x[2] as number), 0);
  return { kind: "file", jenis: "produk-shopee", label: "Performa produk Shopee", scope: "store", platform: "Shopee", dari: rg[0], sampai: rg[1], n: pp.length, info: `${pp.length} produk · penjualan ${rp(g)}`, data: { n: pp.length }, pp };
}

/* Performa affiliate Shopee (Performa Affiliate → Ekspor). File tidak memuat periode: dianggap "7 hari terakhir" (berakhir H-2 dari waktu ekspor di nama file) */
function shopeeAff(rows: Sheet, file: string): FileData | null {
  const hi = hdr(rows, (H) => H[0] === "ID Affiliates" && H.includes("Username Affiliate")); if (hi !== 0) return null;
  const H = rows[0].map(S), c = (k: string) => H.indexOf(k);
  const R = rows.slice(1).filter((r) => S(r?.[c("Username Affiliate")])).map((r) => [S(r[c("Username Affiliate")]), S(r[c("Nama Affiliate")]).slice(0, 80), pf(r[c("Omzet Penjualan(Rp)")]), pf(r[c("Produk Terjual")]), pf(r[c("Pesanan")]),
    pf(r[c("Clicks")]), pf(r[c("Estimasi Komisi(Rp)")]), S(r[c("ROI")]), pf(r[c("Total Pembeli")]), pf(r[c("Pembeli Baru")])]);
  if (!R.length) return null;
  const m = file.match(/AMSAffiliatePerformance_(\d{4})(\d{2})(\d{2})/); if (!m) throw new Error("Nama file performa affiliate Shopee harus asli (AMSAffiliatePerformance_YYYYMMDDhhmm) agar periodenya diketahui.");
  const sampai = addD(`${m[1]}-${m[2]}-${m[3]}`, -2), dari = addD(sampai, -6);
  const g = R.reduce((a, x) => a + (x[2] as number), 0);
  return { kind: "file", jenis: "aff-shopee", label: "Performa affiliate Shopee", scope: "store", platform: "Shopee", dari, sampai, n: R.length, info: `${R.length} kreator · omzet ${rp(g)} · periode dianggap ${dari} s/d ${sampai}`,
    data: { h: ["username", "nama", "omzet", "terjual", "pesanan", "klik", "komisi", "roi", "pembeli", "pembeli_baru"], rows: R } };
}

/* Performa kreator TikTok (Affiliate Center → Performa → Kreator → Export) */
function tiktokAff(rows: Sheet, file: string): FileData | null {
  const hi = hdr(rows, (H) => H[0] === "Creator name" && H.includes("GMV dari kreator")); if (hi < 0) return null;
  const H = rows[hi].map(S), c = (k: string) => H.indexOf(k);
  const R = rows.slice(hi + 1).filter((r) => S(r?.[0]) && /\d/.test(S(r[c("GMV dari kreator")])) && S(r[c("GMV dari kreator")]).length < 30).map((r) => [S(r[0]), num(r[c("GMV dari kreator")]), num(r[c("GMV dari LIVE kreator")]), num(r[c("GMV dari video afiliasi")]),
    num(r[c("Pengembalian dana")]), num(r[c("Pesanan teratribusi")]), num(r[c("Produk yang terjual dari kreator")]), num(r[c("Produk yang dikembalikan dananya")]), num(r[c("Sampel terkirim")]), num(r[c("Impresi produk")]), num(r[c("Tayangan video")]), num(r[c("Perkiraan komisi")])]);
  if (!R.length) return null;
  const rg = fileYmd(file, /Creator_List_(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})/); if (!rg) throw new Error("Nama file performa kreator TikTok harus asli (…Creator_List_YYYYMMDD-YYYYMMDD) agar periodenya diketahui.");
  const g = R.reduce((a, x) => a + (x[1] as number), 0), rf = R.reduce((a, x) => a + (x[4] as number), 0);
  return { kind: "file", jenis: "aff-tiktok", label: "Performa kreator affiliate TikTok", scope: "store", platform: "TikTok", dari: rg[0], sampai: rg[1], n: R.length, info: `${R.length} kreator · GMV ${rp(g)} · pengembalian ${rp(rf)}`,
    data: { h: ["kreator", "gmv", "gmv_live", "gmv_video", "refund", "pesanan", "terjual", "terjual_refund", "sampel", "impresi", "tayangan", "komisi"], rows: R } };
}

/* Pesanan affiliate TikTok (Affiliate Center → Pesanan afiliasi → Unduh Pesanan) */
function tiktokAffOrders(rows: Sheet): FileData | null {
  const hi = hdr(rows, (H) => H[0] === "ID Pesanan" && H.includes("Nama pengguna kreator") && H.includes("Waktu Dibuat")); if (hi < 0) return null;
  const H = rows[hi].map(S), c = (k: string) => H.indexOf(k);
  const R = rows.slice(hi + 1).filter((r) => S(r?.[0])).map((r) => [S(r[0]), ymd(r[c("Waktu Dibuat")]), S(r[c("Nama pengguna kreator")]), S(r[c("SKU penjual")]).slice(0, 60), num(r[c("Payment Amount")]), num(r[c("Kuantitas")]),
    S(r[c("Status Pesanan")]), S(r[c("Pengembalian barang atau dana penuh")]), S(r[c("Jenis Konten")]), num(r[c("Perkiraan pembayaran komisi standar")])]);
  if (!R.length) return null;
  const rg = rangeOf(R.map((x) => x[1] as string))!, g = R.reduce((a, x) => a + (x[4] as number), 0), rt = R.filter((x) => /^ya/i.test(String(x[7]))).length;
  return { kind: "file", jenis: "aff-pesanan-tiktok", label: "Pesanan affiliate TikTok", scope: "store", platform: "TikTok", dari: rg[0], sampai: rg[1], n: R.length, info: `${R.length} baris pesanan · ${rp(g)} · ${rt} retur/refund penuh`,
    data: { h: ["id", "tanggal", "kreator", "sku", "nilai", "qty", "status", "refund_penuh", "konten", "komisi"], rows: R } };
}

/* Validasi tagihan affiliate Shopee (Validation Bill → View Reports): diringkas per affiliate */
function shopeeValidasi(rows: Sheet): FileData | null {
  const hi = hdr(rows, (H) => H[0] === "Kode Pesanan" && H.includes("Status Terverifikasi") && H.includes("Username Affiliate")); if (hi < 0) return null;
  const H = rows[hi].map(S), c = (k: string) => H.indexOf(k);
  const M = new Map<string, { o: Set<string>; n: number; r: number; k: number; x: number }>(); const ds: string[] = [];
  for (const r of rows.slice(hi + 1)) {
    const u = S(r?.[c("Username Affiliate")]); if (!u) continue; const d = ymd(r[c("Waktu Pesanan")]); if (d) ds.push(d);
    const x = M.get(u) ?? { o: new Set(), n: 0, r: 0, k: 0, x: 0 }; x.o.add(S(r[c("Kode Pesanan")])); x.n += pf(r[c("Nilai Pembelian(Rp)")]); x.r += pf(r[c("Jumlah Pengembalian(Rp)")]);
    x.k += pf(r[c("Estimasi Komisi Affiliate per Produk(Rp)")]); x.x += pf(r[c("Pengeluaran(Rp)")]); M.set(u, x);
  }
  if (!M.size) return null;
  const R = [...M].map(([u, x]) => [u, x.o.size, Math.round(x.n), Math.round(x.r), Math.round(x.k), Math.round(x.x)]);
  const rg = rangeOf(ds)!, tot = R.reduce((a, x) => a + (x[5] as number), 0);
  return { kind: "file", jenis: "validasi-shopee", label: "Validasi tagihan affiliate Shopee", scope: "store", platform: "Shopee", dari: rg[0], sampai: rg[1], n: R.length, info: `${R.length} affiliate · ${R.reduce((a, x) => a + (x[1] as number), 0)} pesanan · biaya ${rp(tot)}`,
    data: { h: ["username", "pesanan", "nilai", "pengembalian", "komisi", "biaya"], rows: R } };
}

/* Penghasilan Shopee (Penghasilan Saya → Sudah Dilepas → Export) */
/* Potongan per pesanan: [id, tgl dilepas, subtotal, refund, voucher, admin, proses, layanan, ongkir, ams, pajak, lain, dilepas] */
export type FeeRow = [string, string | null, number, number, number, number, number, number, number, number, number, number, number];
/* "lain" = selisih supaya subtotal + semua potongan = dana dilepas */
const balance = (r: FeeRow): FeeRow => { const sum = r.slice(2, 11).reduce((a: number, b) => a + (b as number), 0); r[11] = Math.round(r[12] - sum); return r; };
const FEE_KEYS = ["refund", "voucher", "admin", "proses", "layanan", "ongkir", "ams", "pajak", "lain"] as const;
function feeBucket(h: string): (typeof FEE_KEYS)[number] | null {
  const x = h.toLowerCase();
  if (/pengembalian dana|refund/.test(x) && !/ongkir|biaya kirim/.test(x)) return "refund";
  if (/voucher|cashback|diskon produk dari shopee/.test(x)) return "voucher";
  if (/administrasi|komisi platform|biaya layanan mall|commission fee/.test(x)) return "admin";
  if (/proses pesanan|biaya pembayaran|biaya transaksi|handling fee|installment/.test(x)) return "proses";
  if (/komisi ams|afiliasi|affiliate/.test(x)) return "ams";
  if (/pph|pajak|ppn/.test(x) && !/termasuk ppn/.test(x)) return "pajak";
  if (/xtra|promo|layanan|kampanye|program|live|pre-order/.test(x)) return "layanan";
  if (/ongkir|ongkos kirim|biaya kirim|return to seller|jasa kirim|logistik/.test(x)) return "ongkir";
  if (/premi|fbs|isi saldo|biaya lain|lainnya/.test(x)) return "lain";
  return null;
}
function shopeeIncome(sheets: Record<string, Sheet>): FileData | null {
  const sm = sheets["Summary"], pr = sheets["Penghasilan"]; if (!sm || !pr) return null;
  const dari = ymd(sm.find((r) => S(r?.[0]) === "Dari")?.[1]), sampai = ymd(sm.find((r) => S(r?.[0]) === "ke")?.[1]);
  const hi = hdr(pr, (H) => H.includes("No. Pesanan") && H.includes("Total Penghasilan")); if (hi < 0 || !dari || !sampai) return null;
  const H = pr[hi].map(S), c = (k: string) => H.indexOf(k);
  const R = pr.slice(hi + 1).filter((r) => S(r?.[1]) === "Order").map((r) => [S(r[c("No. Pesanan")]), ymd(r[c("Waktu Pesanan Dibuat")]), ymd(r[c("Tanggal Dana Dilepaskan")]), num(r[c("Total Penghasilan")]), num(r[c("Harga Produk")]), num(r[c("Jumlah Pengembalian Dana ke Pembeli")])]);
  // kolom biaya: setelah "Harga Produk" sampai sebelum "Username (Pembeli)"
  const i0 = c("Harga Produk"), i1 = c("Username (Pembeli)"); const FC: [number, (typeof FEE_KEYS)[number]][] = [];
  for (let j = i0 + 1; j < (i1 > 0 ? i1 : H.length); j++) { const b = /ongkir dibayar pembeli|gratis ongkir dari shopee|potongan ongkos kirim/i.test(H[j]) ? "ongkir" : feeBucket(H[j]); if (b) FC.push([j, b]); }
  const fees: FeeRow[] = pr.slice(hi + 1).filter((r) => S(r?.[1]) === "Order").map((r) => { const f = Object.fromEntries(FEE_KEYS.map((k) => [k, 0])) as Record<string, number>; for (const [j, b] of FC) f[b] += num(r[j]);
    return [S(r[c("No. Pesanan")]), ymd(r[c("Tanggal Dana Dilepaskan")]), num(r[i0]), ...FEE_KEYS.map((k) => Math.round(f[k])), num(r[c("Total Penghasilan")])] as FeeRow; }).map(balance);
  const akun = S(sm.find((r) => S(r?.[0]) === "Username (Penjual)")?.[1]) || undefined;
  const t = R.reduce((a, x) => a + (x[3] as number), 0);
  return { kind: "file", jenis: "penghasilan-shopee", label: "Penghasilan Shopee (sudah dilepas)", scope: "store", platform: "Shopee", akun, dari, sampai, n: R.length, info: `${R.length} pesanan · dana cair ${rp(t)}`,
    data: { h: ["pesanan", "dibuat", "dilepas", "penghasilan", "harga_produk", "refund"], rows: R, fees } };
}

/* Penghasilan TikTok (Keuangan → Transaksi → Selesai → Unduh) */
function tiktokIncome(sheets: Record<string, Sheet>): FileData | null {
  const dp = sheets["Detail pesanan"], lp = sheets["Laporan"]; if (!dp || !lp) return null;
  const pr2 = lp.find((r) => (r ?? []).some((v) => S(v) === "Periode")) ?? [], pm = S(pr2.slice(pr2.findIndex((v) => S(v) === "Periode") + 1).find((v) => S(v))).match(/(\d{4}\/\d{2}\/\d{2})-(\d{4}\/\d{2}\/\d{2})/);
  const hi = hdr(dp, (H) => H[0] === "ID Pesanan/Penyesuaian" && H.includes("Jumlah penyelesaian pembayaran")); if (hi < 0) return null;
  const H = dp[hi].map(S), c = (k: string) => H.indexOf(k);
  const R = dp.slice(hi + 1).filter((r) => S(r?.[0])).map((r) => [S(r[0]), S(r[c("Jenis transaksi")]), ymd(r[c("Waktu pemesanan")]), num(r[c("Jumlah penyelesaian pembayaran")]), num(r[c("Total Pendapatan")]), num(r[c("Total Biaya")])]);
  // kolom biaya TikTok: setelah "Total Biaya" (rincian), dikelompokkan dari namanya; refund dari "Total pengembalian dana setelah diskon"
  const iTB = c("Total Biaya"), FC: [number, (typeof FEE_KEYS)[number]][] = [];
  for (let j = iTB + 1; j < H.length; j++) { if (/^total|penyesuaian|^jumlah|catatan|mata uang/i.test(H[j])) continue; const b = feeBucket(H[j]); if (b && b !== "refund") FC.push([j, b]); }
  const iRf = c("Total pengembalian dana setelah diskon"), iSub = c("Subtotal setelah diskon penjual"), iPay = c("Waktu pembayaran pesanan");
  const fees: FeeRow[] = dp.slice(hi + 1).filter((r) => S(r?.[0]) && /pesanan|order/i.test(S(r[c("Jenis transaksi")]))).map((r) => { const f = Object.fromEntries(FEE_KEYS.map((k) => [k, 0])) as Record<string, number>; for (const [j, b] of FC) f[b] += num(r[j]); if (iRf >= 0) f.refund += num(r[iRf]);
    return [S(r[0]), iPay >= 0 ? ymd(r[iPay]) : null, iSub >= 0 ? num(r[iSub]) : 0, ...FEE_KEYS.map((k) => Math.round(f[k])), num(r[c("Jumlah penyelesaian pembayaran")])] as FeeRow; }).map(balance);
  const rg = pm ? [ymd(pm[1])!, ymd(pm[2])!] : rangeOf(R.map((x) => x[2] as string)); if (!rg) return null;
  const t = R.reduce((a, x) => a + (x[3] as number), 0);
  return { kind: "file", jenis: "penghasilan-tiktok", label: "Penghasilan TikTok (transaksi selesai)", scope: "store", platform: "TikTok", dari: rg[0], sampai: rg[1], n: R.length, info: `${R.length} transaksi · dana cair ${rp(t)}`,
    data: { h: ["id", "jenis", "dipesan", "penyelesaian", "pendapatan", "biaya"], rows: R, fees } };
}

/* Stok dari Shopee: Produk Saya → Ubah Massal → Info penjualan (kolom "Stok:<gudang>") */
function shopeeStok(rows: Sheet, file: string): FileData | null {
  const h = rows.findIndex((r) => r.some((c) => S(c) === "SKU") && r.some((c) => /^Stok/i.test(S(c))) && r.some((c) => S(c) === "Nama Produk"));
  if (h < 0) return null;
  const H = rows[h].map(S), iS = H.indexOf("SKU"), iI = H.indexOf("SKU Induk"), iP = H.indexOf("Nama Produk"), iV = H.indexOf("Nama Variasi"), iH = H.indexOf("Harga");
  const iK = H.map((x, i) => (/^Stok/i.test(x) ? i : -1)).filter((i) => i >= 0);
  const M = new Map<string, [string, string, string, number, number]>();
  for (const r of rows.slice(h + 1)) {
    const sku = S(r[iS]) || S(r[iI]); const nama = S(r[iP]);
    if (!sku || !nama || S(r[iK[0]]) === "" || isNaN(Number(S(r[iK[0]]).replace(/[.,]/g, "")))) continue;
    const st = iK.reduce((a, i) => a + num(r[i]), 0);
    const x = M.get(sku); if (x) { x[3] += st; continue; }
    M.set(sku, [sku, nama.slice(0, 300), S(r[iV]).slice(0, 200), st, iH >= 0 ? num(r[iH]) : 0]);
  }
  if (!M.size) return null;
  const m = file.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})/);
  const wib = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  const tgl = m ? `${m[1]}-${m[2]}-${m[3]}` : wib;
  const data = [...M.values()], tot = data.reduce((a, x) => a + x[3], 0);
  const gud = iK.map((i) => H[i].replace(/^Stok:?\s*/i, "")).join(" + ");
  return { kind: "file", jenis: "stok", label: "Stok produk Shopee (Ubah Massal)", scope: "client", platform: "Shopee", dari: tgl, sampai: tgl, n: data.length,
    info: `${data.length.toLocaleString("id")} SKU · ${tot.toLocaleString("id")} unit · gudang ${gud} · stok per ${tgl}`, data };
}

export function detect(sheets: Record<string, Sheet>, file: string): Parsed {
  const r = shopeeStats(sheets, file) ?? shopeeProduk(sheets, file) ?? shopeeIncome(sheets) ?? tiktokIncome(sheets);
  if (r) return r;
  const list = Object.values(sheets);
  for (const rows of list) { const k = shopeeStok(rows, file); if (k) return k; }
  for (const rows of list) { const x = shopeeLive(rows) ?? tiktokLive(rows) ?? tiktokProduk(rows) ?? shopeeAff(rows, file) ?? tiktokAff(rows, file) ?? tiktokAffOrders(rows) ?? shopeeValidasi(rows); if (x) return x; }
  let L: LR[] = [];
  for (const rows of list) L = L.concat(liveDraft(rows), liveHost(rows));
  if (L.length) return { kind: "live", label: "Laporan livestream", rows: mergeLive(L) };
  for (const rows of list) {
    const x = tiktokStats(rows) ?? shopeeAds(rows) ?? tiktokAds(rows) ?? orders(rows);
    if (x) return x;
  }
  throw new Error("Jenis file tidak dikenali. Pastikan file diunduh dari menu yang ada di panduan dan tidak diubah isinya.");
}
