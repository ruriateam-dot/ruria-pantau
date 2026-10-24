"use server";
import { createClient } from "@/lib/supabase/server";
import seed from "@/data/seed.json";
import seedProduk from "@/data/seed_produk.json";

type Seed = {
  stores: { id: string; client_id: string; brand: string; platform: string }[];
  sales: [string, string, number, number, number | null, string][];
  ads: [string, string, string, string, number, number, number][];
  live: [string, string | null, string, number, number, number, number, string | null, number | null][];
};
const S = seed as unknown as Seed;

// Naikkan angka ini setiap kali file di src/data diperbarui
const DATA_VERSION = "2026-10-24b";
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export async function importSeed(): Promise<string> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return "Sesi login habis. Muat ulang halaman lalu login lagi.";
  const { data: me } = await sb.from("profiles").select("peran").eq("id", user.id).single();
  if (me?.peran !== "admin") return "Hanya admin yang bisa mengimpor data.";

  const fail = (step: string, msg: string) => `Gagal di tahap ${step}: ${msg}`;

  let r = await sb.from("stores").upsert(S.stores);
  if (r.error) return fail("toko", r.error.message);

  for (const part of chunk(S.sales, 1000)) {
    r = await sb.from("daily_sales").upsert(part.map(([store_id, tanggal, gmv, pesanan, pengunjung, sumber]) =>
      ({ store_id, tanggal, gmv, pesanan, pengunjung, sumber, diupload_oleh: user.id })));
    if (r.error) return fail("penjualan", r.error.message);
  }

  const adStores = [...new Set(S.ads.map((a) => a[0]))];
  r = await sb.from("ads").delete().in("store_id", adStores);
  if (r.error) return fail("hapus iklan lama", r.error.message);
  for (const part of chunk(S.ads, 1000)) {
    r = await sb.from("ads").insert(part.map(([store_id, dari, sampai, kampanye, biaya, gmv, pesanan]) =>
      ({ store_id, dari, sampai, kampanye, biaya, gmv, pesanan, diupload_oleh: user.id })));
    if (r.error) return fail("iklan", r.error.message);
  }

  const liveClients = [...new Set(S.live.map((l) => l[0]))];
  r = await sb.from("live_sessions").delete().in("client_id", liveClients);
  if (r.error) return fail("hapus live lama", r.error.message);
  for (const part of chunk(S.live, 1000)) {
    r = await sb.from("live_sessions").insert(part.map(([client_id, brand, tanggal, jam_mulai, durasi_jam, gmv_shopee, gmv_tiktok, host, penonton]) =>
      ({ client_id, brand, tanggal, jam_mulai, durasi_jam, gmv_shopee, gmv_tiktok, host, penonton, diupload_oleh: user.id })));
    if (r.error) return fail("livestream", r.error.message);
  }

  await sb.from("uploads").insert(liveClients.concat(["cahaya", "pmg", "jf", "ot"]).filter((v, i, a) => a.indexOf(v) === i)
    .map((c) => ({ client_id: c, jenis: "arsip-2026", nama_file: "data awal dari dashboard artifact", oleh: user.id })));

  return `Selesai: ${S.stores.length} toko, ${S.sales.length.toLocaleString("id")} baris penjualan harian, ${S.ads.length.toLocaleString("id")} baris iklan, ${S.live.length.toLocaleString("id")} sesi live.`;
}

export async function importProduk(): Promise<string> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return "Sesi login habis. Muat ulang halaman lalu login lagi.";
  const { data: me } = await sb.from("profiles").select("peran").eq("id", user.id).single();
  if (me?.peran !== "admin") return "Hanya admin yang bisa mengimpor data.";
  const P = seedProduk as unknown as { produk: string[]; rows: [string, string, number, string, number, number, number][] };
  for (const part of chunk(P.rows, 2000)) {
    const r = await sb.from("product_sales").upsert(part.map(([store_id, tanggal, pi, varian, qty, gmv, pesanan]) =>
      ({ store_id, tanggal, produk: P.produk[pi], varian, qty, gmv, pesanan, diupload_oleh: user.id })));
    if (r.error) return r.error.message.includes("product_sales") && r.error.message.includes("does not exist")
      ? "Tabel produk belum dibuat. Jalankan file 0003_produk.sql di SQL Editor Supabase dulu."
      : `Gagal di tahap produk: ${r.error.message}`;
  }
  return `Selesai: ${P.rows.length.toLocaleString("id")} baris penjualan produk per hari (${P.produk.length} produk, CV Cahaya, Jan–Sep 2026).`;
}

/* Impor otomatis: dijalankan sekali per versi data saat admin membuka dashboard */
export async function autoImport(): Promise<{ status: "skip" | "ok" | "err"; msg: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { status: "skip", msg: "" };
  const { data: me } = await sb.from("profiles").select("peran").eq("id", user.id).single();
  if (me?.peran !== "admin") return { status: "skip", msg: "" };
  const tag = "data-otomatis:" + DATA_VERSION;
  const { data: done } = await sb.from("uploads").select("id").eq("jenis", tag).limit(1);
  if (done?.length) return { status: "skip", msg: "" };
  const a = await importSeed();
  if (!a.startsWith("Selesai")) return { status: "err", msg: a };
  const b = await importProduk();
  if (!b.startsWith("Selesai")) return { status: "err", msg: b };
  await sb.from("uploads").insert({ client_id: "cahaya", jenis: tag, nama_file: "pembaruan data dari Claude", oleh: user.id });
  return { status: "ok", msg: "Data terbaru dari Claude sudah dimasukkan. Muat ulang halaman untuk melihatnya." };
}
