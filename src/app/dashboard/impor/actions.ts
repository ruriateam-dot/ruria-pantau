"use server";
import { exec, q } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import seed from "@/data/seed.json";
import seedProduk from "@/data/seed_produk.json";
import affJf from "@/data/aff/aff-jf.json";
import affEf from "@/data/aff/efektivitas.json";
import affHasil from "@/data/aff/sampel_hasil.json";
import affSampel from "@/data/aff/sampel_mei_okt.json";
import otJf from "@/data/aff/ot/aff-jf.json";
import otEf from "@/data/aff/ot/efektivitas.json";
import otHasil from "@/data/aff/ot/sampel_hasil.json";
import otSampel from "@/data/aff/ot/sampel_mei_okt.json";
import otBrand from "@/data/aff/ot/brand.json";
import chJf from "@/data/aff/cahaya/aff-jf.json";
import chEf from "@/data/aff/cahaya/efektivitas.json";
import chHasil from "@/data/aff/cahaya/sampel_hasil.json";
import chSampel from "@/data/aff/cahaya/sampel_mei_okt.json";
import chBrand from "@/data/aff/cahaya/brand.json";
import extra from "@/data/extra.json";
import hist from "@/data/hist2025.json";
import fcseed from "@/data/fcseed.json";
import upl from "@/data/upl.json";

type Seed = {
  clients?: { id: string; nama: string; modul: string[]; target_roas: number | null }[];
  stores: { id: string; client_id: string; brand: string; platform: string }[];
  sales: [string, string, number, number, number | null, string][];
  ads: [string, string, string, string, number, number, number][];
  live: [string, string | null, string, number, number, number, number, string | null, number | null][];
};
const S = seed as unknown as Seed;

// Naikkan angka ini setiap kali file di src/data diperbarui
const DATA_VERSION = "2026-10-24e";
// Versi terpisah per jenis data, supaya pembaruan satu bagian tidak menimpa data upload tim
const AFF_VERSION = "aff-2026-10-30f";
const EXTRA_VERSION = "extra-2026-10-26a";
// Riwayat 2025 (CV Cahaya & PMG) dari arsip: hanya menambah baris yang belum ada, tidak menimpa data upload tim
const HIST_VERSION = "hist-2025-2026-10-28c";
// Status pesanan per nomor pesanan dari arsip file pesanan (Jan 2025–Okt 2026), di src/data/ord
const ORD_VERSION = "orders-2026-10-28b";
// Perbaikan data sekali jalan: produk Mitra 383 TikTok yang ternyata berasal dari file pesanan Pepisun TikTok
const FIX_VERSION = "fix-pmg-tiktok-2026-10-28";
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

const NO = "Hanya admin yang bisa mengimpor data. Muat ulang halaman lalu login lagi.";
async function bulk(sql: string, rows: unknown[][], upd = "") {
  for (const c of chunk(rows, 1000)) await exec(sql + " values ?" + upd, [c]);
}

export async function importSeed(): Promise<string> {
  const u = await requireAdmin();
  if (!u) return NO;
  let step = "klien";
  try {
    if (S.clients?.length) await bulk("insert into clients (id, nama, modul, target_roas)", S.clients.map((c) => [c.id, c.nama, c.modul.join(","), c.target_roas]), " on duplicate key update nama = values(nama), modul = values(modul)");
    step = "toko";
    await bulk("insert into stores (id, client_id, brand, platform)", S.stores.map((s) => [s.id, s.client_id, s.brand, s.platform]), " on duplicate key update client_id = values(client_id), brand = values(brand), platform = values(platform)");
    step = "penjualan";
    await bulk("insert into daily_sales (store_id, tanggal, gmv, pesanan, pengunjung, sumber, diupload_oleh)", S.sales.map((r) => [...r, u.id]),
      " on duplicate key update gmv = values(gmv), pesanan = values(pesanan), pengunjung = values(pengunjung), sumber = values(sumber)");
    step = "iklan";
    const adStores = [...new Set(S.ads.map((a) => a[0]))];
    if (adStores.length) await exec("delete from ads where store_id in (?)", [adStores]);
    await bulk("insert into ads (store_id, dari, sampai, kampanye, biaya, gmv, pesanan, diupload_oleh)", S.ads.map((r) => [...r, u.id]));
    step = "livestream";
    const liveClients = [...new Set(S.live.map((l) => l[0]))];
    if (liveClients.length) await exec("delete from live_sessions where client_id in (?)", [liveClients]);
    await bulk("insert into live_sessions (client_id, brand, tanggal, jam_mulai, durasi_jam, gmv_shopee, gmv_tiktok, host, penonton, diupload_oleh)", S.live.map((r) => [...r, u.id]));
  } catch (e) {
    return `Gagal di tahap ${step}: ${(e as Error).message}`;
  }
  return `Selesai: ${S.stores.length} toko, ${S.sales.length.toLocaleString("id")} baris penjualan harian, ${S.ads.length.toLocaleString("id")} baris iklan, ${S.live.length.toLocaleString("id")} sesi live.`;
}

const PART = 5000;
type PS = { produk: string[]; rows: [string, string, number, string, number, number, number, string, string][] };

/* Impor produk bertahap: satu panggilan = satu bagian */
export async function importProdukPart(part: number): Promise<{ ok: boolean; msg: string; parts: number }> {
  const P = seedProduk as unknown as PS;
  const parts = Math.ceil(P.rows.length / PART);
  const u = await requireAdmin();
  if (!u) return { ok: false, msg: NO, parts };
  try {
    await bulk("insert into product_sales (store_id, tanggal, produk, varian, qty, gmv, pesanan, sku, grup, diupload_oleh)",
      P.rows.slice(part * PART, (part + 1) * PART).map(([s, t, pi, v, qt, g, o, sku, grup]) => [s, t, P.produk[pi], v ?? "", qt, g, o, sku ?? "", grup || null, u.id]),
      " on duplicate key update qty = values(qty), gmv = values(gmv), pesanan = values(pesanan), sku = values(sku), grup = values(grup)");
  } catch (e) {
    return { ok: false, parts, msg: `Gagal di bagian ${part + 1}: ${(e as Error).message}` };
  }
  return { ok: true, parts, msg: part + 1 >= parts ? `Selesai: ${P.rows.length.toLocaleString("id")} baris produk (${P.produk.length} produk).` : "" };
}

/* Pembaruan otomatis per versi data */
export async function autoStatus(): Promise<{ seed: boolean; aff: boolean; extra: boolean; hist: boolean; ord: boolean; fix: boolean }> {
  const u = await requireAdmin();
  if (!u) return { seed: false, aff: false, extra: false, hist: false, ord: false, fix: false };
  const V = [DATA_VERSION, AFF_VERSION, EXTRA_VERSION, HIST_VERSION, ORD_VERSION, FIX_VERSION].map((v) => "data-otomatis:" + v);
  const done = (await q<{ jenis: string }>("select distinct jenis from uploads where jenis in (?)", [V])).map((x) => x.jenis);
  return { seed: !done.includes(V[0]), aff: !done.includes(V[1]), extra: !done.includes(V[2]), hist: !done.includes(V[3]), ord: !done.includes(V[4]), fix: !done.includes(V[5]) };
}
export async function autoMark(which: "seed" | "aff" | "extra" | "hist" | "ord" | "fix"): Promise<void> {
  const u = await requireAdmin();
  if (!u) return;
  await exec("insert into uploads (client_id, jenis, nama_file, oleh) values (null, ?, 'pembaruan data dari Claude', ?)", ["data-otomatis:" + (which === "seed" ? DATA_VERSION : which === "aff" ? AFF_VERSION : which === "hist" ? HIST_VERSION : which === "ord" ? ORD_VERSION : which === "fix" ? FIX_VERSION : EXTRA_VERSION), u.id]);
}

/* Metrik tambahan Seller Centre: statistik toko, performa produk, laporan iklan */
type EX = { sp: [string, string, string, unknown][]; pm: [string, string, string, unknown][]; ad: [string, string, string, string, number | null, number | null, number | null][] };
export async function importExtra(): Promise<string> {
  const u = await requireAdmin();
  if (!u) return NO;
  const E = extra as unknown as EX;
  try {
    await bulk("insert into store_period (store_id, dari, sampai, data)", E.sp.map(([s, a, b, d]) => [s, a, b, JSON.stringify(d)]), " on duplicate key update data = values(data)");
    for (const c of chunk(E.pm, 5)) await bulk("insert into product_period (store_id, dari, sampai, data)", c.map(([s, a, b, d]) => [s, a, b, JSON.stringify(d)]), " on duplicate key update data = values(data)");
    await bulk("insert into ads_meta (store_id, dari, sampai, kampanye, dilihat, klik, keranjang)", E.ad.map((r) => [r[0], r[1], r[2], r[3].replace(/\s+/g, " ").trim().slice(0, 255), r[4], r[5], r[6]]), " on duplicate key update dilihat = values(dilihat), klik = values(klik), keranjang = values(keranjang)");
  } catch (e) { return "Gagal di tahap metrik Seller Centre: " + (e as Error).message; }
  return "Selesai";
}

/* Data ruang kerja affiliate (saat ini Just Fluff) */
export async function importAff(): Promise<string> {
  const u = await requireAdmin();
  if (!u) return NO;
  try {
    const F: [string, string, unknown][] = [
      ["jf", "aff-jf.json", affJf], ["jf", "efektivitas.json", affEf], ["jf", "sampel_hasil.json", affHasil], ["jf", "sampel_mei_okt.json", affSampel],
      ["ot", "aff-jf.json", otJf], ["ot", "efektivitas.json", otEf], ["ot", "sampel_hasil.json", otHasil], ["ot", "sampel_mei_okt.json", otSampel], ["ot", "brand.json", otBrand],
      ["cahaya", "aff-jf.json", chJf], ["cahaya", "efektivitas.json", chEf], ["cahaya", "sampel_hasil.json", chHasil], ["cahaya", "sampel_mei_okt.json", chSampel], ["cahaya", "brand.json", chBrand]];
    for (const [c, nama, isi] of F)
      await exec("insert into aff_files (client_id, nama, isi) values (?, ?, ?) on duplicate key update isi = values(isi)", [c, nama, JSON.stringify(isi)]);
  } catch (e) { return "Gagal di tahap affiliate: " + (e as Error).message; }
  return "Selesai";
}

/* Riwayat penjualan 2025 dari arsip. Insert ignore: baris yang sudah ada (misalnya hasil upload tim) tidak diubah. */
type HS = { sales: [string, string, number, number, number | null, string][]; produk: string[]; rows: [string, string, number, string, number, number, number, string, string | null][] };
export async function importHistPart(part: number): Promise<{ ok: boolean; msg: string; parts: number }> {
  const H = hist as unknown as HS;
  const parts = Math.ceil(H.rows.length / PART) + 1;
  const u = await requireAdmin();
  if (!u) return { ok: false, msg: NO, parts };
  try {
    if (part === 0) {
      // Stok CV Cahaya per 18 & 28 Okt & HPP dari file HPP Cabydut (perkiraan ditandai), hanya kalau belum ada
      const F = fcseed as unknown as { client: string; snap: { tanggal: string; stok: [string, string, string, number, number][] }[]; hpp: [string, number, number][] };
      for (const sn of F.snap) await bulk("insert ignore into stock_snapshot (client_id, tanggal, sku, produk, varian, stok, harga)", sn.stok.map((x) => [F.client, sn.tanggal, String(x[0]).slice(0, 120), x[1], x[2], Math.round(x[3]), x[4] || null]));
      await bulk("insert ignore into hpp (client_id, sku, hpp, perkiraan)", F.hpp.map((x) => [F.client, String(x[0]).slice(0, 120), x[1], x[2]]));
    }
    if (part === 0) await bulk("insert ignore into daily_sales (store_id, tanggal, gmv, pesanan, pengunjung, sumber, diupload_oleh)", H.sales.map((r) => [...r, u.id]));
    else await bulk("insert ignore into product_sales (store_id, tanggal, produk, varian, qty, gmv, pesanan, sku, grup, diupload_oleh)",
      H.rows.slice((part - 1) * PART, part * PART).map(([s, t, pi, v, qt, g, o, sku, grup]) => [s, t, H.produk[pi], v ?? "", qt, g, o, sku ?? "", grup || null, u.id]));
  } catch (e) {
    return { ok: false, parts, msg: `Gagal memasukkan riwayat 2025 (bagian ${part + 1}): ${(e as Error).message}` };
  }
  return { ok: true, parts, msg: "" };
}

/* Status pesanan dari arsip (src/data/ord, gzip+base64 per toko). Insert ignore: pesanan yang sudah diupload tim (status lebih baru) tidak ditimpa. */
type OStore = { s: string; o: (string | number | null)[][]; i: (string | number)[][] };
type OFees = { fees: { s: string; f: (string | number | null)[][] }[] };
const OP = 4000;
const g2 = globalThis as unknown as { _ordCache?: Map<number, OStore | OFees> };
async function ordPart(k: number): Promise<OStore | OFees> {
  g2._ordCache ??= new Map();
  if (!g2._ordCache.has(k)) {
    const { PARTS } = await import("@/data/ord"); const { gunzipSync } = await import("zlib");
    const m = await PARTS[k](); g2._ordCache.clear(); g2._ordCache.set(k, JSON.parse(gunzipSync(Buffer.from(m.b64, "base64")).toString()));
  }
  return g2._ordCache.get(k)!;
}
export async function importOrdersPart(part: number): Promise<{ ok: boolean; msg: string; parts: number }> {
  const u = await requireAdmin();
  if (!u) return { ok: false, msg: NO, parts: 1 };
  const { COUNTS } = await import("@/data/ord");
  const map: [number, number][] = []; COUNTS.forEach((n, k) => { if (n < 0) map.push([k, 0]); else for (let x = 0; x < Math.max(1, Math.ceil(n / OP)); x++) map.push([k, x]); });
  const parts = map.length;
  if (part >= parts) return { ok: true, msg: "", parts };
  try {
    const [k, x] = map[part]; const D = await ordPart(k);
    const known = new Set((await q<{ id: string }>("select id from stores")).map((r) => r.id));
    if ("fees" in D) { for (const f of D.fees) if (known.has(f.s))
      await bulk("insert ignore into order_fees (store_id, order_id, dilepas, subtotal, refund, voucher, admin, proses, layanan, ongkir, ams, pajak, lain, dana)", f.f.map((r) => [f.s, String(r[0]).slice(0, 40), ...r.slice(1)])); }
    else if (known.has(D.s)) {
      const o = D.o.slice(x * OP, (x + 1) * OP); const ids = new Set(o.map((r) => r[0]));
      if (o.length) await bulk("insert ignore into orders (store_id, order_id, tanggal, status, status_asli, alasan, retur, gmv, qty, metode, provinsi, kota, batas_kirim, dikirim, selesai)", o.map((r) => [D.s, String(r[0]).slice(0, 40), ...r.slice(1)]));
      const it = D.i.filter((r) => ids.has(r[0]));
      if (it.length) await bulk("insert ignore into order_items (store_id, order_id, produk, varian, sku, qty, gmv)", it.map((r) => [D.s, String(r[0]).slice(0, 40), r[1], r[2], r[3], r[4], r[5]]));
    }
  } catch (e) { return { ok: false, parts, msg: `Gagal memasukkan status pesanan (bagian ${part + 1}): ${(e as Error).message}` }; }
  return { ok: true, msg: "", parts };
}

/* Hapus baris produk Mitra 383 TikTok yang sama persis (tanggal + produk + varian) dengan Pepisun TikTok: berasal dari file yang salah */
export async function runFix(): Promise<string> {
  const u = await requireAdmin();
  if (!u) return NO;
  try {
    await exec(`delete a from product_sales a join product_sales b on b.store_id = 'cahaya-pepisun-tiktok' and b.tanggal = a.tanggal and b.produk = a.produk and b.varian = a.varian
      where a.store_id = 'pmg-mitra-383-tiktok'`);
    await exec("delete from orders where store_id = 'pmg-mitra-383-tiktok' and order_id in (select order_id from (select order_id from orders where store_id = 'cahaya-pepisun-tiktok') x)");
  } catch (e) { return "Gagal memperbaiki data Mitra 383 TikTok: " + (e as Error).message; }
  return "Selesai";
}

/* File yang dikirim ke Claude lalu dimasukkan lewat pembaruan otomatis (sama seperti upload tim). Tiap entri dijalankan sekali. */
type UP = { id: string; store: string; client: string; kind: "ads" | "hapus-iklan"; file: string; dari: string; sampai: string; rows: [string, string, string, number, number, number][] };
export async function uplPending(): Promise<string[]> {
  const u = await requireAdmin(); if (!u) return [];
  const L = upl as unknown as UP[]; if (!L.length) return [];
  const done = new Set((await q<{ jenis: string }>("select jenis from uploads where jenis in (?)", [L.map((x) => "data-otomatis:upl:" + x.id)])).map((x) => x.jenis));
  return L.filter((x) => !done.has("data-otomatis:upl:" + x.id)).map((x) => x.id);
}
export async function runUpl(id: string): Promise<string> {
  const u = await requireAdmin(); if (!u) return NO;
  const x = (upl as unknown as UP[]).find((e) => e.id === id); if (!x) return "Selesai";
  try {
    if (!(await q("select id from stores where id = ?", [x.store])).length) return "Selesai";
    if (x.kind === "ads") {
      // file mencakup seluruh periode: baris lama yang beririsan (termasuk rekap bulanan) diganti
      await exec("delete from ads where store_id = ? and dari <= ? and sampai >= ?", [x.store, x.sampai, x.dari]);
      await bulk("insert into ads (store_id, dari, sampai, kampanye, biaya, gmv, pesanan, diupload_oleh)", x.rows.map((r) => [x.store, ...r, u.id]));
    }
    if (x.kind === "hapus-iklan") await exec("delete from ads where store_id = ? and dari >= ? and sampai <= ?", [x.store, x.dari, x.sampai]);
    await exec("insert into uploads (client_id, jenis, nama_file, dari, sampai, baris, oleh) values (?, ?, ?, ?, ?, ?, ?)", [x.client, "data-otomatis:upl:" + x.id, x.file, x.dari, x.sampai, x.rows.length, u.id]);
  } catch (e) { return `Gagal memasukkan ${x.file}: ${(e as Error).message}`; }
  return "Selesai";
}
