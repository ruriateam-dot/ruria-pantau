import "server-only";
import { q } from "./db";

export type Store = { id: string; client_id: string; brand: string; platform: string };
export type Sale = { store_id: string; tanggal: string; gmv: number; pesanan: number; pengunjung: number | null };
export type Ad = { store_id: string; dari: string; sampai: string; kampanye: string; biaya: number; gmv: number; pesanan: number };
export type Live = { brand: string | null; tanggal: string; jam_mulai: number; durasi_jam: number; gmv_shopee: number; gmv_tiktok: number; host: string | null; penonton: number | null };

/* Pemanggil wajib memastikan clientId termasuk allowedClients() */
export async function loadClient(clientId: string, from: string, to: string) {
  const stores = await q<Store>("select id, client_id, brand, platform from stores where client_id = ? order by brand", [clientId]);
  const ids = stores.map((s) => s.id);
  const sales = ids.length ? await q<Sale>("select store_id, tanggal, gmv, pesanan, pengunjung from daily_sales where store_id in (?) and tanggal between ? and ? order by tanggal", [ids, from, to]) : [];
  const ads = ids.length ? await q<Ad>("select store_id, dari, sampai, kampanye, biaya, gmv, pesanan from ads where store_id in (?) and dari <= ? and sampai >= ?", [ids, to, from]) : [];
  const live = await q<Live>("select brand, tanggal, jam_mulai, durasi_jam, gmv_shopee, gmv_tiktok, host, penonton from live_sessions where client_id = ? and tanggal between ? and ? order by tanggal", [clientId, from, to]);
  return { stores, sales, ads, live };
}

export async function freshness(clientIds: string[]) {
  if (!clientIds.length) return [];
  return q<{ client_id: string; penjualan: string | null; iklan: string | null; live: string | null }>(
    `select c.id client_id,
      (select max(d.tanggal) from daily_sales d join stores s on s.id = d.store_id where s.client_id = c.id) penjualan,
      (select max(a.sampai) from ads a join stores s on s.id = a.store_id where s.client_id = c.id) iklan,
      (select max(l.tanggal) from live_sessions l where l.client_id = c.id) live
     from clients c where c.id in (?)`, [clientIds]);
}

export type ProdRow = { grup: string; nama: string; kode: string[] | null; gmv: number; qty: number; pesanan: number; gmv_prev: number; qty_prev: number; toko: string[] | null;
  varian: { sku: string; varian: string; toko: string; qty: number; gmv: number }[] | null };

/* Analisa produk per SKU induk (lintas toko). storeIds harus sudah disaring sesuai akses. */
export async function produkSku(storeIds: string[], from: string, to: string, pf: string, pt: string): Promise<ProdRow[]> {
  if (!storeIds.length) return [];
  const lo = pf < from ? pf : from, hi = pt > to ? pt : to;
  const rows = await q<{ g: string; produk: string; varian: string; sku: string; store_id: string; cur: number; prv: number; qty: number; gmv: number; pesanan: number }>(
    `select coalesce(nullif(grup, ''), concat('NAMA:', produk)) g, produk, varian, sku, store_id,
       (tanggal between ? and ?) cur, (tanggal between ? and ?) prv,
       sum(qty) qty, sum(gmv) gmv, sum(pesanan) pesanan
     from product_sales where store_id in (?) and tanggal between ? and ?
     group by g, produk, varian, sku, store_id, cur, prv`, [from, to, pf, pt, storeIds, lo, hi]);
  type G = { gmv: number; qty: number; o: number; pg: number; pq: number; toko: Set<string>; nm: Map<string, number>; pnm: Map<string, number>; kd: Map<string, number>; vr: Map<string, { sku: string; varian: string; toko: string; qty: number; gmv: number }> };
  const M = new Map<string, G>();
  for (const r of rows) {
    let x = M.get(r.g);
    if (!x) M.set(r.g, x = { gmv: 0, qty: 0, o: 0, pg: 0, pq: 0, toko: new Set(), nm: new Map(), pnm: new Map(), kd: new Map(), vr: new Map() });
    const gmv = Number(r.gmv), qty = Number(r.qty);
    if (Number(r.cur)) {
      x.gmv += gmv; x.qty += qty; x.o += Number(r.pesanan); x.toko.add(r.store_id);
      x.nm.set(r.produk, (x.nm.get(r.produk) ?? 0) + gmv);
      if (r.sku) { const k = r.sku.split(".")[0]; x.kd.set(k, (x.kd.get(k) ?? 0) + gmv); }
      const vk = r.sku + "\u0001" + r.varian + "\u0001" + r.store_id;
      const v = x.vr.get(vk) ?? { sku: r.sku, varian: r.varian, toko: r.store_id, qty: 0, gmv: 0 };
      v.qty += qty; v.gmv += gmv; x.vr.set(vk, v);
    }
    if (Number(r.prv)) { x.pg += gmv; x.pq += qty; x.pnm.set(r.produk, Math.max(x.pnm.get(r.produk) ?? 0, gmv)); }
  }
  const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  const out: ProdRow[] = [];
  for (const [g, x] of M) {
    if (x.toko.size) out.push({ grup: g, nama: top(x.nm)[0], kode: x.kd.size ? top(x.kd).slice(0, 6) : null, gmv: x.gmv, qty: x.qty, pesanan: x.o, gmv_prev: x.pg, qty_prev: x.pq, toko: [...x.toko],
      varian: [...x.vr.values()].sort((a, b) => b.gmv - a.gmv).slice(0, 60) });
    else if (x.pq >= 10) out.push({ grup: g, nama: top(x.pnm)[0], kode: null, gmv: 0, qty: 0, pesanan: 0, gmv_prev: x.pg, qty_prev: x.pq, toko: null, varian: null });
  }
  return out.sort((a, b) => b.gmv - a.gmv || b.gmv_prev - a.gmv_prev).slice(0, 300);
}

export type Cl = { id: string; nama: string; modul: string[]; target_roas: number | null };
export async function clientsFor(ids: string[]): Promise<Cl[]> {
  return ids.length ? (await q<{ id: string; nama: string; modul: string; target_roas: number | null }>("select id, nama, modul, target_roas from clients where id in (?) order by nama", [ids]))
    .map((x) => ({ ...x, modul: x.modul.split(",") })) : [];
}

