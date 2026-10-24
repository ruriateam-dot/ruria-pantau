"use server";
import { exec, q } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import seed from "@/data/seed.json";
import seedProduk from "@/data/seed_produk.json";

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
export async function autoStatus(): Promise<{ need: boolean; parts: number }> {
  const P = seedProduk as unknown as PS;
  const u = await requireAdmin();
  if (!u) return { need: false, parts: 0 };
  const done = await q("select id from uploads where jenis = ? limit 1", ["data-otomatis:" + DATA_VERSION]);
  return { need: !done.length, parts: Math.ceil(P.rows.length / PART) };
}
export async function autoMark(): Promise<void> {
  const u = await requireAdmin();
  if (!u) return;
  await exec("insert into uploads (client_id, jenis, nama_file, oleh) values (null, ?, 'pembaruan data dari Claude', ?)", ["data-otomatis:" + DATA_VERSION, u.id]);
}
