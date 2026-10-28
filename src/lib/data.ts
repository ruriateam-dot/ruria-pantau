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
  // Kelompok SKU induk dihitung ulang dari kode SKU:
  // - default: kode sebelum titik pertama (ZORA.BLUESTRIP.L → ZORA)
  // - kalau satu kode depan dipakai untuk beberapa listing berbeda di toko yang sama (judul produk beda),
  //   pisah per segmen kedua (PSUN.SPF50 vs PSUN.PF123001). Segmen bundling (SPF502 = SPF50 isi 2) ikut induknya.
  const code = (s2: string) => s2.match(/^[A-Za-z]*\d{2,}/)?.[0] ?? null;
  const seg = (sku: string) => sku.split(".").map((x) => x.trim()).filter(Boolean);
  const byPre = new Map<string, Map<string, Set<string>>>();
  for (const r of rows) { const sg = seg(r.sku || ""); if (sg.length < 2) continue;
    const m = byPre.get(sg[0]) ?? new Map<string, Set<string>>(); byPre.set(sg[0], m);
    const t = m.get(sg[1]) ?? new Set<string>(); t.add(r.store_id + "\u0001" + r.produk); m.set(sg[1], t); }
  const split = new Map<string, Set<string>>();
  for (const [pre, m] of byPre) {
    if (m.size < 2) continue;
    // Pisah kalau di satu toko ada dua segmen kedua yang judul listingnya sama sekali berbeda
    const perStore = new Map<string, Map<string, Set<string>>>();
    for (const [s2, set] of m) for (const k of set) { const [st, pr] = k.split("\u0001"); const mm = perStore.get(st) ?? new Map<string, Set<string>>(); perStore.set(st, mm); (mm.get(s2) ?? mm.set(s2, new Set()).get(s2)!).add(pr); }
    const differs = [...perStore.values()].some((mm) => { const L = [...mm.values()]; return L.some((x, i) => L.some((y, j) => j > i && ![...x].some((t) => y.has(t)))); });
    // Hanya kalau segmen kedua berupa kode produk (huruf + ≥2 angka: PF123001, SPF50, 9763), bukan warna/ukuran
    const codes = new Set([...m.keys()].map(code).filter(Boolean) as string[]);
    if (differs && codes.size >= 2) split.set(pre, codes);
  }
  const keyOf = (sku: string, produk: string) => { const sg = seg(sku || ""); if (!sg.length) return "NAMA:" + produk; const pre = sg[0].toUpperCase();
    const ss = split.get(sg[0]); let c = sg.length > 1 ? code(sg[1]) : null; if (!ss || !c) return pre;
    const base = c.slice(0, -1); if (ss.has(base) && base.length >= 3) c = base; // SPF502 (isi 2) → SPF50
    return pre + "." + c.toUpperCase(); };
  // Kelompok tersimpan tetap dipakai (sudah menggabungkan kode berbeda untuk produk yang sama);
  // hanya kode depan yang terbukti dipakai beberapa produk berbeda yang dipecah per kode produk.
  const byName = new Map<string, string>();
  for (const r of rows) if (r.sku) { const sg = seg(r.sku); if (split.has(sg[0])) { r.g = keyOf(r.sku, r.produk); byName.set(r.store_id + "\u0001" + r.produk, r.g); } }
  for (const r of rows) if (!r.sku) { const k = byName.get(r.store_id + "\u0001" + r.produk); if (k) r.g = k; }
  type G = { gmv: number; qty: number; o: number; pg: number; pq: number; toko: Set<string>; nm: Map<string, number>; pnm: Map<string, number>; kd: Map<string, number>; vr: Map<string, { sku: string; varian: string; toko: string; qty: number; gmv: number }> };
  const M = new Map<string, G>();
  for (const r of rows) {
    let x = M.get(r.g);
    if (!x) M.set(r.g, x = { gmv: 0, qty: 0, o: 0, pg: 0, pq: 0, toko: new Set(), nm: new Map(), pnm: new Map(), kd: new Map(), vr: new Map() });
    const gmv = Number(r.gmv), qty = Number(r.qty);
    if (Number(r.cur)) {
      x.gmv += gmv; x.qty += qty; x.o += Number(r.pesanan); x.toko.add(r.store_id);
      x.nm.set(r.produk, (x.nm.get(r.produk) ?? 0) + gmv);
      if (r.sku) { const k = r.g.startsWith("NAMA:") ? r.sku.split(".")[0] : r.g; x.kd.set(k, (x.kd.get(k) ?? 0) + gmv); }
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


/* Tanggal data penjualan terakhir per toko */
export async function storeLast(storeIds: string[]): Promise<Record<string, string>> {
  if (!storeIds.length) return {};
  const r = await q<{ store_id: string; d: string }>("select store_id, date_format(max(tanggal), '%Y-%m-%d') d from daily_sales where store_id in (?) group by store_id", [storeIds]);
  return Object.fromEntries(r.map((x) => [x.store_id, x.d]));
}

/* Metrik bulanan dari ekspor Seller Centre, ditimbang sesuai irisan hari dengan periode (laporan bulanan dibagi rata per hari) */
export type SP = { store_id: string; dari: string; sampai: string; w: number; d: Record<string, unknown> };
export async function storePeriods(storeIds: string[], from: string, to: string, table: "store_period" | "product_period" = "store_period"): Promise<SP[]> {
  if (!storeIds.length) return [];
  const r = await q<{ store_id: string; dari: string; sampai: string; data: string }>(
    `select store_id, date_format(dari, '%Y-%m-%d') dari, date_format(sampai, '%Y-%m-%d') sampai, data from ${table} where store_id in (?) and dari <= ? and sampai >= ?`, [storeIds, to, from]);
  const dd = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
  return r.map((x) => { const f = x.dari > from ? x.dari : from, t = x.sampai < to ? x.sampai : to; return { store_id: x.store_id, dari: x.dari, sampai: x.sampai, w: dd(f, t) / dd(x.dari, x.sampai), d: JSON.parse(x.data) }; });
}
export async function adsMeta(storeIds: string[], from: string, to: string) {
  if (!storeIds.length) return [];
  return q<{ store_id: string; dari: string; sampai: string; kampanye: string; dilihat: number | null; klik: number | null; keranjang: number | null }>(
    "select store_id, date_format(dari, '%Y-%m-%d') dari, date_format(sampai, '%Y-%m-%d') sampai, kampanye, dilihat, klik, keranjang from ads_meta where store_id in (?) and dari <= ? and sampai >= ?", [storeIds, to, from]);
}

/* Toko yang datanya belum masuk sampai kemarin (untuk email pengingat). Live dihitung per brand. */
export async function tokoTertinggal(yday: string) {
  const T = await q<{ klien: string; modul: string; brand: string; platform: string; jual: string | null; iklan: string | null; live: string | null }>(
    `select c.nama klien, c.modul, s.brand, s.platform,
      (select date_format(max(d.tanggal), '%Y-%m-%d') from daily_sales d where d.store_id = s.id) jual,
      (select date_format(max(a.sampai), '%Y-%m-%d') from ads a where a.store_id = s.id) iklan,
      (select date_format(max(l.tanggal), '%Y-%m-%d') from live_sessions l where l.client_id = s.client_id and l.brand = s.brand) live
     from stores s join clients c on c.id = s.client_id where s.platform <> 'CPAS' order by c.nama, s.brand, s.platform`);
  const out: { toko: string; klien: string; kurang: string[] }[] = [];
  for (const t of T) {
    const k: string[] = [];
    const cek = (on: boolean, d: string | null, nm: string) => { if (on && (!d || d < yday)) k.push(`${nm} ${d ? `sejak ${d.slice(8, 10)}/${d.slice(5, 7)}` : "belum ada"}`); };
    cek(t.modul.includes("toko"), t.jual, "penjualan"); cek(t.modul.includes("iklan") && !!t.iklan, t.iklan, "iklan"); cek(t.modul.includes("live") && !!t.live, t.live, "live");
    if (k.length) out.push({ toko: `${t.brand} · ${t.platform}`, klien: t.klien, kurang: k });
  }
  return out;
}
