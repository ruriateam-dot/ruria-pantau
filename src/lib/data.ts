import { createClient } from "@/lib/supabase/server";

export type Store = { id: string; client_id: string; brand: string; platform: string };
export type Sale = { store_id: string; tanggal: string; gmv: number; pesanan: number; pengunjung: number | null };
export type Ad = { store_id: string; dari: string; sampai: string; kampanye: string; biaya: number; gmv: number; pesanan: number };
export type Live = { brand: string | null; tanggal: string; jam_mulai: number; durasi_jam: number; gmv_shopee: number; gmv_tiktok: number; host: string | null; penonton: number | null };

// Supabase membatasi 1000 baris per permintaan, jadi ambil bertahap
export async function fetchAll<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await q(i, i + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadClient(clientId: string, from: string, to: string) {
  const sb = await createClient();
  const { data: stores } = await sb.from("stores").select("id, client_id, brand, platform").eq("client_id", clientId).order("brand");
  const ids = (stores ?? []).map((s) => s.id);
  const sales = ids.length ? await fetchAll<Sale>((a, b) => sb.from("daily_sales").select("store_id, tanggal, gmv, pesanan, pengunjung").in("store_id", ids).gte("tanggal", from).lte("tanggal", to).order("tanggal").range(a, b)) : [];
  const ads = ids.length ? await fetchAll<Ad>((a, b) => sb.from("ads").select("store_id, dari, sampai, kampanye, biaya, gmv, pesanan").in("store_id", ids).lte("dari", to).gte("sampai", from).range(a, b)) : [];
  const live = await fetchAll<Live>((a, b) => sb.from("live_sessions").select("brand, tanggal, jam_mulai, durasi_jam, gmv_shopee, gmv_tiktok, host, penonton").eq("client_id", clientId).gte("tanggal", from).lte("tanggal", to).order("tanggal").range(a, b));
  return { stores: (stores ?? []) as Store[], sales: sales.map((s) => ({ ...s, gmv: +s.gmv })), ads: ads.map((x) => ({ ...x, biaya: +x.biaya, gmv: +x.gmv })), live: live.map((l) => ({ ...l, jam_mulai: +l.jam_mulai, durasi_jam: +l.durasi_jam, gmv_shopee: +l.gmv_shopee, gmv_tiktok: +l.gmv_tiktok })) };
}

export async function freshness() {
  const sb = await createClient();
  const { data } = await sb.rpc("data_terakhir");
  return (data ?? []) as { client_id: string; penjualan: string | null; iklan: string | null; live: string | null }[];
}
