"use server";
import { exec, q } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import seed from "@/data/seed.json";
import seedProduk from "@/data/seed_produk.json";
import affJf from "@/data/aff/aff-jf.json";
import affEf from "@/data/aff/efektivitas.json";
import affHasil from "@/data/aff/sampel_hasil.json";
import affSampel from "@/data/aff/sampel_mei_okt.json";

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
const AFF_VERSION = "aff-2026-10-25a";
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
export async function autoStatus(): Promise<{ seed: boolean; aff: boolean }> {
  const u = await requireAdmin();
  if (!u) return { seed: false, aff: false };
  const done = (await q<{ jenis: string }>("select distinct jenis from uploads where jenis in (?)", [["data-otomatis:" + DATA_VERSION, "data-otomatis:" + AFF_VERSION]])).map((x) => x.jenis);
  return { seed: !done.includes("data-otomatis:" + DATA_VERSION), aff: !done.includes("data-otomatis:" + AFF_VERSION) };
}
export async function autoMark(which: "seed" | "aff"): Promise<void> {
  const u = await requireAdmin();
  if (!u) return;
  await exec("insert into uploads (client_id, jenis, nama_file, oleh) values (null, ?, 'pembaruan data dari Claude', ?)", ["data-otomatis:" + (which === "seed" ? DATA_VERSION : AFF_VERSION), u.id]);
}

/* Data ruang kerja affiliate (saat ini Just Fluff) */
export async function importAff(): Promise<string> {
  const u = await requireAdmin();
  if (!u) return NO;
  try {
    for (const [nama, isi] of [["aff-jf.json", affJf], ["efektivitas.json", affEf], ["sampel_hasil.json", affHasil], ["sampel_mei_okt.json", affSampel]] as [string, unknown][])
      await exec("insert into aff_files (client_id, nama, isi) values ('jf', ?, ?) on duplicate key update isi = values(isi)", [nama, JSON.stringify(isi)]);
  } catch (e) { return "Gagal di tahap affiliate: " + (e as Error).message; }
  return "Selesai";
}
