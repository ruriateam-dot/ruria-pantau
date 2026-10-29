import { q } from "@/lib/db";
import { addDays, dayDiff, todayWIB } from "@/lib/period";

/* Forecast GMV & kebutuhan stok.
   Laju dasar = rata-rata harian 90 hari terakhir data (30 hari terakhir bobot 3, 30 hari sebelumnya bobot 2, sisanya bobot 1).
   Pola musiman = (rata-rata harian bulan yang sama tahun lalu) ÷ (rata-rata harian 90 hari yang sama tahun lalu), dibatasi 0,4–2,5.
   Bulan berjalan = aktual sampai data terakhir + sisa hari × laju × pola musiman. */

export const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const blnLabel = (m: string) => `${BLN[+m.slice(5) - 1]}${m.slice(0, 4) === todayWIB().slice(0, 4) ? "" : " " + m.slice(2, 4)}`;
const mStart = (m: string) => m + "-01";
const mEnd = (m: string) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };
export const addMonth = (m: string, n: number) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const ly = (d: string) => addDays(d, -364); // 52 minggu, supaya pola hari dalam seminggu sama
const W = (age: number) => (age < 30 ? 3 : age < 60 ? 2 : 1);
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

type St = { id: string; brand: string; platform: string };
export type FMonth = { m: string; fc: number; lo: number; hi: number; actual: number; ly: number | null; terancam: number; partial: boolean };
export type FStore = { id: string; nama: string; fc: number; ly: number | null; prev: number; last: string; season: boolean };
export type FProd = { key: string; sku: string; produk: string; varian: string; grup: string | null; units: number; gmv: number; prevUnits: number; asp: number; rate: number;
  stok: number | null; habis: string | null; restock: number; terancam: number; prio: string; hpp: number | null; hppEst: boolean };
export type Forecast = { months: string[]; last: string; M: FMonth[]; S: FStore[]; P: FProd[]; stokTgl: string | null; safety: number; noSeason: string[] };

function seasonFactor(daily: Map<string, number>, last: string, m: string) {
  // basis tahun lalu: 90 hari sebelum (data terakhir − 1 tahun), bobot sama dengan laju dasar
  let sw = 0, sv = 0, n = 0;
  for (let i = 0; i < 90; i++) { const d = ly(addDays(last, -i)); const v = daily.get(d); if (v === undefined) continue; sw += W(i); sv += v * W(i); n++; }
  const a = mStart(m), b = mEnd(m); let mv = 0, mn = 0;
  for (let d = ly(a); d <= ly(b); d = addDays(d, 1)) { const v = daily.get(d); if (v === undefined) continue; mv += v; mn++; }
  if (n < 60 || mn < 20 || !sv) return null;
  return clamp((mv / mn) / (sv / sw), 0.4, 2.5);
}

export async function forecast(clientId: string, months: string[], safety: number): Promise<Forecast> {
  const stores = await q<St>("select id, brand, platform from stores where client_id = ? and platform <> 'CPAS'", [clientId]);
  const ids = stores.map((s) => s.id);
  const empty: Forecast = { months, last: "", M: [], S: [], P: [], stokTgl: null, safety, noSeason: [] };
  if (!ids.length) return empty;
  const last = (await q<{ d: string | null }>("select date_format(max(tanggal), '%Y-%m-%d') d from daily_sales where store_id in (?)", [ids]))[0]?.d;
  if (!last) return empty;
  const from = ly(addDays(mStart(months[0]) < addDays(last, -95) ? mStart(months[0]) : addDays(last, -95), -5));
  const DS = await q<{ store_id: string; d: string; gmv: number }>("select store_id, date_format(tanggal, '%Y-%m-%d') d, gmv from daily_sales where store_id in (?) and tanggal >= ?", [ids, from]);
  const byS = new Map<string, Map<string, number>>(); for (const s of ids) byS.set(s, new Map());
  for (const r of DS) byS.get(r.store_id)!.set(r.d, +r.gmv);

  const end = mEnd(months[months.length - 1]);
  // faktor per toko per bulan (untuk bulan terpilih + bulan-bulan sebelum bulan pertama, dipakai di simulasi stok)
  const allM: string[] = []; for (let m = last.slice(0, 7); m <= months[months.length - 1]; m = addMonth(m, 1)) allM.push(m);
  const noSeason: string[] = [];
  const SF = new Map<string, Map<string, number>>(), RATE = new Map<string, number>(), LAST = new Map<string, string>();
  for (const s of stores) {
    const dm = byS.get(s.id)!; const keys = [...dm.keys()].sort(); const sl = keys.length ? keys[keys.length - 1] : last;
    LAST.set(s.id, sl);
    let sw = 0, sv = 0; for (let i = 0; i < 90; i++) { const v = dm.get(addDays(sl, -i)) ?? 0; sw += W(i); sv += v * W(i); }
    RATE.set(s.id, sv / sw);
    const f = new Map<string, number>(); let miss = false;
    for (const m of allM) { const x = seasonFactor(dm, sl, m); if (x === null) miss = true; f.set(m, x ?? 1); }
    SF.set(s.id, f); if (miss && sv > 0) noSeason.push(`${s.platform} · ${s.brand}`);
  }
  const fOf = (s: string, d: string) => SF.get(s)!.get(d.slice(0, 7)) ?? 1;
  const ahead = (m: string) => Math.max(0, (+m.slice(0, 4) - +last.slice(0, 4)) * 12 + (+m.slice(5) - +last.slice(5, 7)));

  // ---- GMV per bulan & per toko
  const M: FMonth[] = months.map((m) => {
    let fc = 0, act = 0, rem = 0, lyv = 0, lyN = 0;
    for (const s of stores) {
      const dm = byS.get(s.id)!, sl = LAST.get(s.id)!, r = RATE.get(s.id)!, f = SF.get(s.id)!.get(m) ?? 1;
      for (let d = mStart(m); d <= mEnd(m); d = addDays(d, 1)) {
        if (d <= sl) act += dm.get(d) ?? 0; else rem += r * f;
        const l = dm.get(ly(d)); if (l !== undefined) { lyv += l; lyN++; }
      }
    }
    fc = act + rem; const u = 0.08 + 0.04 * ahead(m);
    return { m, fc, lo: act + rem * (1 - u), hi: act + rem * (1 + u), actual: act, ly: lyN >= 20 ? lyv : null, terancam: 0, partial: act > 0 };
  });
  const prevM = addMonth(months[0], -1);
  const S: FStore[] = stores.map((s) => {
    const dm = byS.get(s.id)!, sl = LAST.get(s.id)!, r = RATE.get(s.id)!;
    let fc = 0, lyv = 0, lyN = 0, prev = 0;
    for (const m of months) { const f = SF.get(s.id)!.get(m) ?? 1; for (let d = mStart(m); d <= mEnd(m); d = addDays(d, 1)) { fc += d <= sl ? dm.get(d) ?? 0 : r * f; const l = dm.get(ly(d)); if (l !== undefined) { lyv += l; lyN++; } } }
    for (let d = mStart(prevM); d <= mEnd(prevM); d = addDays(d, 1)) prev += dm.get(d) ?? 0;
    return { id: s.id, nama: `${s.platform} · ${s.brand}`, fc, ly: lyN >= 20 ? lyv : null, prev, last: sl, season: !noSeason.includes(`${s.platform} · ${s.brand}`) };
  }).filter((x) => x.fc > 0 || x.prev > 0).sort((a, b) => b.fc - a.fc);

  // ---- Produk / SKU (stok dipakai bersama semua toko klien)
  const b0 = addDays(last, -89);
  const PS = await q<{ store_id: string; d: string; produk: string; varian: string; sku: string; grup: string | null; qty: number; gmv: number }>(
    "select store_id, date_format(tanggal, '%Y-%m-%d') d, produk, varian, sku, grup, qty, gmv from product_sales where store_id in (?) and tanggal >= ?", [ids, mStart(prevM) < b0 ? mStart(prevM) : b0]);
  type Acc = { sku: string; produk: string; varian: string; grup: string | null; uw: Map<string, number>; gw: number; q: number; act: Map<string, number>; prevU: number };
  const A = new Map<string, Acc>();
  for (const r of PS) {
    const key = (r.sku || `${r.produk}|${r.varian}`).trim();
    let a = A.get(key); if (!a) { a = { sku: r.sku, produk: r.produk, varian: r.varian, grup: r.grup, uw: new Map(), gw: 0, q: 0, act: new Map(), prevU: 0 }; A.set(key, a); }
    const sl = LAST.get(r.store_id) ?? last, age = dayDiff(r.d, sl);
    if (age >= 0 && age < 90) { a.uw.set(r.store_id, (a.uw.get(r.store_id) ?? 0) + +r.qty * W(age)); a.gw += +r.gmv; a.q += +r.qty; }
    if (r.d.slice(0, 7) === prevM) a.prevU += +r.qty;
    if (months.includes(r.d.slice(0, 7)) && r.d <= sl) a.act.set(r.d.slice(0, 7), (a.act.get(r.d.slice(0, 7)) ?? 0) + +r.qty);
  }
  const SW = 30 * 3 + 30 * 2 + 30;
  // stok terbaru
  const sk = (await q<{ d: string | null }>("select date_format(max(tanggal), '%Y-%m-%d') d from stock_snapshot where client_id = ?", [clientId]))[0]?.d ?? null;
  const STK = new Map<string, number>();
  if (sk) for (const r of await q<{ sku: string; stok: number }>("select sku, stok from stock_snapshot where client_id = ? and tanggal = ?", [clientId, sk])) STK.set(r.sku.trim(), +r.stok);
  const HPP = new Map<string, [number, boolean]>();
  for (const r of await q<{ sku: string; hpp: number; perkiraan: number }>("select sku, hpp, perkiraan from hpp where client_id = ?", [clientId])) HPP.set(r.sku.trim(), [+r.hpp, !!r.perkiraan]);

  const firstSel = mStart(months[0]);
  const P: FProd[] = [];
  for (const [key, a] of A) {
    const rateBy = [...a.uw].map(([s, w]) => [s, w / SW] as [string, number]); // unit/hari per toko
    const rate = rateBy.reduce((x, y) => x + y[1], 0);
    if (rate <= 0 && !a.act.size) continue;
    const asp = a.q ? a.gw / a.q : 0;
    const dayU = (d: string) => rateBy.reduce((x, [s, r]) => x + (d > (LAST.get(s) ?? last) ? r * fOf(s, d) : 0), 0);
    let units = 0; for (const m of months) { units += a.act.get(m) ?? 0; for (let d = mStart(m); d <= mEnd(m); d = addDays(d, 1)) units += dayU(d); }
    let stok: number | null = null, habis: string | null = null, restock = 0, terancam = 0, prio = "Belum ada stok";
    if (sk && STK.has(key)) {
      stok = STK.get(key)!;
      // simulasi harian dari tanggal stok sampai akhir periode
      const tstart = sk < last ? last : sk; let s = stok - rate * Math.max(0, dayDiff(sk, last)), start = Math.max(0, s), need = 0;
      for (let d = addDays(tstart, 1); d <= end; d = addDays(d, 1)) {
        const u = dayU(d);
        if (d < firstSel) { s -= u; continue; }
        if (d === firstSel) start = Math.max(0, s);
        need += u; s -= u;
        if (s <= 0 && !habis) habis = d;
      }
      
      if (!habis && s <= 0) habis = firstSel;
      const lastRate = rateBy.reduce((x, [sid, r]) => x + r * fOf(sid, end), 0);
      restock = Math.max(0, Math.ceil(need + lastRate * safety - start));
      terancam = Math.max(0, need - start) * asp;
      prio = stok <= 0 ? "Stok 0" : habis ? `Habis ${blnLabel(habis.slice(0, 7))}` : restock > 0 ? "Pengaman" : "Aman";
      // alokasikan GMV terancam per bulan
      let cum = start;
      for (const mo of M) { let dm = 0; for (let d = mStart(mo.m); d <= mEnd(mo.m); d = addDays(d, 1)) dm += dayU(d); const short = Math.max(0, dm - Math.max(0, cum)); mo.terancam += short * asp; cum -= dm; }
    }
    const h = HPP.get(key);
    P.push({ key, sku: a.sku, produk: a.produk, varian: a.varian, grup: a.grup, units, gmv: units * asp, prevUnits: a.prevU, asp, rate, stok, habis, restock, terancam, prio, hpp: h ? h[0] : null, hppEst: h ? h[1] : false });
  }
  P.sort((x, y) => y.gmv - x.gmv);
  return { months, last, M, S, P, stokTgl: sk, safety, noSeason };
}
