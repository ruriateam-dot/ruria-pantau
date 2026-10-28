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
import extra from "@/data/extra.json";
import hist from "@/data/hist2025.json";
import fcseed from "@/data/fcseed.json";

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
const AFF_VERSION = "aff-2026-10-26g";
const EXTRA_VERSION = "extra-2026-10-26a";
// Riwayat 2025 (CV Cahaya & PMG) dari arsip: hanya menambah baris yang belum ada, tidak menimpa data upload tim
const HIST_VERSION = "hist-2025-2026-10-28c";
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
export async function autoStatus(): Promise<{ seed: boolean; aff: boolean; extra: boolean; hist: boolean }> {
  const u = await requireAdmin();
  if (!u) return { seed: false, aff: false, extra: false, hist: false };
  const V = [DATA_VERSION, AFF_VERSION, EXTRA_VERSION, HIST_VERSION].map((v) => "data-otomatis:" + v);
  const done = (await q<{ jenis: string }>("select distinct jenis from uploads where jenis in (?)", [V])).map((x) => x.jenis);
  return { seed: !done.includes(V[0]), aff: !done.includes(V[1]), extra: !done.includes(V[2]), hist: !done.includes(V[3]) };
}
export async function autoMark(which: "seed" | "aff" | "extra" | "hist"): Promise<void> {
  const u = await requireAdmin();
  if (!u) return;
  await exec("insert into uploads (client_id, jenis, nama_file, oleh) values (null, ?, 'pembaruan data dari Claude', ?)", ["data-otomatis:" + (which === "seed" ? DATA_VERSION : which === "aff" ? AFF_VERSION : which === "hist" ? HIST_VERSION : EXTRA_VERSION), u.id]);
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
      ["ot", "aff-jf.json", otJf], ["ot", "efektivitas.json", otEf], ["ot", "sampel_hasil.json", otHasil], ["ot", "sampel_mei_okt.json", otSampel], ["ot", "brand.json", otBrand]];
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
