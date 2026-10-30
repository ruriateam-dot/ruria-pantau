import { Fragment } from "react";
import { q } from "@/lib/db";
import { todayWIB, addDays, tgl } from "@/lib/period";

/* Checklist upload per toko sesuai jadwal di panduan:
   harian (data kemarin): statistik toko, produk, iklan · live: 7 hari terakhir · pesanan & penghasilan: tiap tanggal 1, 6, 11, 16, 21, 26, 30
   stok: mingguan (klien yang stoknya dihitung) · affiliate (JF, OT, CV Cahaya): 4 file mingguan */
const JADWAL = [1, 6, 11, 16, 21, 26, 30];
type Cell = { ok: boolean | null; last: string | null; need: string; gaps: [string, string][]; old?: [string, string][] };
/* Iklan Shopee Jan–Mar 2026 sudah tidak bisa diunduh dari Shopee: tidak diminta & tidak ditandai kurang */
const SHOPEE_ADS_ARSIP = "2026-04-01";
/* Klien dengan ruang kerja affiliate: wajib 4 file per brand (Shopee: validasi komisi + AMS; TikTok: pesanan affiliate + Transaction Analysis) */
const AFF_KLIEN = ["jf", "ot", "cahaya"];
const maxD = (a: string | null, b: string) => (a && a > b ? a : b);
const START = "2026-01-01", BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const mEnd = (d: string) => { const [y, m] = d.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
/* Rentang hari yang kosong antara start dan end. monthOnly: hanya bulan yang kosong seluruhnya (iklan & live boleh tidak jalan beberapa hari) */
function gaps(have: Set<string>, start: string, end: string, minDays = 1, monthOnly = false): [string, string][] {
  const out: [string, string][] = []; let a: string | null = null;
  for (let d = start; d <= end; d = addDays(d, 1)) { if (!have.has(d)) { a ??= d; } else if (a) { out.push([a, addDays(d, -1)]); a = null; } }
  if (a) out.push([a, end]);
  const L = out.filter(([x, y]) => (Date.parse(y) - Date.parse(x)) / 864e5 + 1 >= minDays);
  if (!monthOnly) return L;
  const M: [string, string][] = [];
  for (const [x, y] of L) for (let m = x.slice(0, 7) + "-01"; m <= y; m = addDays(mEnd(m), 1)) { const e = mEnd(m); if (m >= x && e <= y) { const p = M[M.length - 1]; if (p && addDays(p[1], 1) === m) p[1] = e; else M.push([m, e]); } }
  return M;
}
const fmtGap = ([a, b]: [string, string]) => {
  const full = a.slice(8) === "01" && b === mEnd(b), mo = (d: string) => BLN[+d.slice(5, 7) - 1];
  if (full) return a.slice(0, 7) === b.slice(0, 7) ? `${mo(a)} ${a.slice(0, 4)}` : `${mo(a)}–${mo(b)} ${b.slice(0, 4)}`;
  if (a === b) return `${+a.slice(8)} ${mo(a)}`;
  return a.slice(0, 7) === b.slice(0, 7) ? `${+a.slice(8)}–${+b.slice(8)} ${mo(b)}` : `${+a.slice(8)} ${mo(a)} – ${+b.slice(8)} ${mo(b)}`;
};
const joinGaps = (G: [string, string][]) => { const t = G.map(fmtGap); const head = t.slice(0, 3), rest = t.length - head.length;
  const s = head.length > 1 ? head.slice(0, -1).join(", ") + " dan " + head[head.length - 1] : head[0] ?? ""; return rest > 0 ? `${s} +${rest} lainnya` : s; };

export default async function UploadChecklist({ clientIds }: { clientIds: string[] }) {
  if (!clientIds.length) return null;
  try { return await inner(clientIds); }
  catch (e) { console.error("UploadChecklist", e); return <div className="card"><h2>Checklist upload</h2><p className="err">Gagal dimuat: {(e as Error).message}</p></div>; }
}

async function inner(clientIds: string[]) {
  const today = todayWIB(), y = addDays(today, -1);
  // batas pesanan: jadwal terakhir yang sudah lewat (data wajib sampai sehari sebelumnya)
  const d = +today.slice(8), mStart = today.slice(0, 8) + "01";
  const due = [...JADWAL].reverse().find((x) => x <= d);
  const ordNeed = due ? addDays(today.slice(0, 8) + String(due).padStart(2, "0"), -1) : addDays(mStart, -2);
  const weekNeed = addDays(today, -7);
  const C = await q<{ id: string; nama: string; modul: string; stok_selalu_ada: number | null }>("select id, nama, modul, stok_selalu_ada from clients where id in (?) order by nama", [clientIds]);
  const S = await q<{ id: string; client_id: string; brand: string; platform: string }>("select id, client_id, brand, platform from stores where client_id in (?) and platform <> 'CPAS' order by brand, platform", [clientIds]);
  const ids = S.map((s) => s.id);
  const mp = async (sql: string, p: unknown[]) => new Map((await q<{ k: string; d: string | null }>(sql, p)).map((r) => [r.k, r.d]));
  const jual = await mp("select store_id k, date_format(max(tanggal), '%Y-%m-%d') d from daily_sales where store_id in (?) group by store_id", [ids]);
  const iklan = await mp("select store_id k, date_format(max(sampai), '%Y-%m-%d') d from ads where store_id in (?) group by store_id", [ids]);
  const ord = await mp("select store_id k, date_format(max(tanggal), '%Y-%m-%d') d from product_sales where store_id in (?) group by store_id", [ids]);
  const F = await q<{ k: string; j: string; d: string }>("select store_id k, jenis j, date_format(max(sampai), '%Y-%m-%d') d from seller_files where store_id in (?) group by store_id, jenis", [ids]);
  const ff = (k: string, re: RegExp) => F.filter((x) => x.k === k && re.test(x.j)).map((x) => x.d).sort().pop() ?? null;
  const pp = await mp("select store_id k, date_format(max(sampai), '%Y-%m-%d') d from product_period where store_id in (?) group by store_id", [ids]);
  const mx = (...a: (string | null | undefined)[]) => a.filter(Boolean).sort().pop() ?? null;
  const live = await mp("select client_id k, date_format(max(tanggal), '%Y-%m-%d') d from live_sessions where client_id in (?) group by client_id", [clientIds]);
  const stok = await mp("select client_id k, date_format(max(tanggal), '%Y-%m-%d') d from stock_snapshot where client_id in (?) group by client_id", [clientIds]);
  // tanggal yang sudah ada per toko/klien, untuk mencari bulan atau tanggal yang terlewat
  const sets = new Map<string, Set<string>>(); const put = (k: string, d: string) => { let x = sets.get(k); if (!x) sets.set(k, (x = new Set())); x.add(d); };
  const range = (k: string, a: string, b: string) => { for (let d = a < START ? START : a; d <= b; d = addDays(d, 1)) put(k, d); };
  for (const r of await q<{ k: string; d: string }>("select store_id k, date_format(tanggal, '%Y-%m-%d') d from daily_sales where store_id in (?) and tanggal >= ?", [ids, START])) put("stat|" + r.k, r.d);
  for (const r of await q<{ k: string; d: string }>("select distinct store_id k, date_format(tanggal, '%Y-%m-%d') d from product_sales where store_id in (?) and tanggal >= ?", [ids, START])) put("ord|" + r.k, r.d);
  for (const r of await q<{ k: string; a: string; b: string }>("select store_id k, date_format(dari, '%Y-%m-%d') a, date_format(sampai, '%Y-%m-%d') b from ads where store_id in (?) and sampai >= ?", [ids, START])) range("ads|" + r.k, r.a, r.b);
  for (const r of await q<{ k: string; a: string; b: string }>("select store_id k, date_format(dari, '%Y-%m-%d') a, date_format(sampai, '%Y-%m-%d') b from product_period where store_id in (?) and sampai >= ?", [ids, START])) range("prod|" + r.k, r.a, r.b);
  for (const r of await q<{ k: string; j: string; a: string; b: string }>("select store_id k, jenis j, date_format(dari, '%Y-%m-%d') a, date_format(sampai, '%Y-%m-%d') b from seller_files where store_id in (?) and sampai >= ?", [ids, START]))
    range((/^produk-/.test(r.j) ? "prod|" : /^penghasilan/.test(r.j) ? "inc|" : "x|") + r.k, r.a, r.b);
  for (const r of await q<{ k: string; d: string }>("select distinct client_id k, date_format(tanggal, '%Y-%m-%d') d from live_sessions where client_id in (?) and tanggal >= ?", [clientIds, START])) put("live|" + r.k, r.d);
  const first = (k: string) => { let m: string | null = null; for (const p of ["stat|", "ord|", "ads|"]) for (const d of sets.get(p + k) ?? []) if (!m || d < m) m = d; return m; };
  const cell = (last: string | null | undefined, need: string, on = true, key?: string, start?: string | null, minDays = 1, monthOnly = false): Cell => {
    if (!on) return { ok: null, last: null, need, gaps: [], old: [] };
    const G = key ? gaps(sets.get(key) ?? new Set(), start && start > START ? start : START, need, minDays, monthOnly) : [];
    // data terbaru yang belum masuk selalu dihitung, berapa pun lamanya
    const tail: [string, string] | null = !last || last < need ? [last && last >= (start ?? START) ? addDays(last, 1) : (start && start > START ? start : START), need] : null;
    if (tail) { const lastG = G[G.length - 1]; if (!lastG || lastG[1] < tail[0]) G.push(tail); else if (lastG[1] < need) lastG[1] = need; }
    // "Hari ini" = kekurangan 7 hari terakhir sebelum batas; sisanya = data lama yang belum lengkap
    const rs = addDays(need, -6), rec: [string, string][] = [], old: [string, string][] = [];
    for (const [a, b] of G) { if (b >= rs) rec.push([a > rs ? a : rs, b]); if (a < rs) old.push([a, b < rs ? b : addDays(rs, -1)]); }
    return { ok: !rec.length, last: last ?? null, need, gaps: rec, old };
  };

  type Row = { klien: string; toko: string; tt: boolean; c: Record<string, Cell> };
  const R: Row[] = [];
  for (const c of C) {
    const m = c.modul.split(","), toko = m.includes("toko"), ik = m.includes("iklan"), lv = m.includes("live");
    const st = S.filter((s) => s.client_id === c.id);
    const stokOn = toko && !c.stok_selalu_ada;
    st.forEach((s, i) => {
      const tt = s.platform === "TikTok";
      // toko live-only (VOIE, Dren): cukup satu baris live per klien
      if (!toko && !ik && i > 0) return;
      R.push({ klien: c.nama, toko: toko || ik ? `${s.platform} · ${s.brand}` : "Livestream", tt, c: {
        stat: cell(jual.get(s.id), y, toko, "stat|" + s.id, first(s.id)),
        // file produk TikTok (product_list) baru diminta sejak Okt 2026
        produk: cell(tt ? ff(s.id, /^produk-tiktok$/) : mx(ff(s.id, /^produk-shopee$/), pp.get(s.id)), y, toko, "prod|" + s.id, tt ? "2026-10-01" : first(s.id)),
        iklan: cell(iklan.get(s.id), y, ik, "ads|" + s.id, s.platform === "Shopee" ? maxD(first(s.id), SHOPEE_ADS_ARSIP) : first(s.id), 1, true),
        pesanan: cell(ord.get(s.id), ordNeed, toko, "ord|" + s.id, first(s.id), 5),
        hasil: cell(ff(s.id, /^penghasilan/), ordNeed, toko, "inc|" + s.id, "2026-10-01"),
        live: cell(live.get(c.id), addDays(y, -1), lv && i === 0, "live|" + c.id, [...(sets.get("live|" + c.id) ?? [])].sort()[0] ?? addDays(today, -183).slice(0, 8) + "01", 1, true),
        stok: cell(stok.get(c.id), weekNeed, stokOn && i === 0),
        // Affiliate: 2 file per platform (pesanan + kreator) untuk klien yang punya ruang kerja affiliate
        affp: cell(ff(s.id, /^(aff-pesanan-tiktok|validasi-shopee)$/), addDays(today, -9), AFF_KLIEN.includes(c.id) && (s.platform === "Shopee" || s.platform === "TikTok")),
        affk: cell(ff(s.id, /^aff-(shopee|tiktok)$/), addDays(today, -9), AFF_KLIEN.includes(c.id) && (s.platform === "Shopee" || s.platform === "TikTok")),
      } });
    });
  }
  // [kunci, judul, jadwal, file Shopee, file TikTok]
  const COLS: [string, string, string, string, string][] = [
    ["stat", "Statistik toko", "harian", "…shopee-shop-stats…xlsx", "Shop_Analytics_Key_metrics…xlsx"],
    ["produk", "Performa produk", "harian", "parentskudetail…xlsx", "product_list…xlsx"],
    ["iklan", "Iklan", "harian", "DataKeseluruhanIklanShopee…csv", "Campaign_overview_data…xlsx"],
    ["live", "Live", "7 hari terakhir", "…live_stream_list_export…xlsx", "Live_Analysis…xlsx"],
    ["pesanan", "Pesanan", `s.d. ${tgl(ordNeed)}`, "Order.all…xlsx", "Semua pesanan…csv"],
    ["hasil", "Penghasilan", `s.d. ${tgl(ordNeed)}`, "Income.sudah_dilepas…xlsx", "income_…xlsx"],
    ["stok", "Stok", "mingguan", "mass_update_sales_info…zip", "–"],
    ["affp", "Affiliate: pesanan / validasi tagihan", "mingguan", "SellerOnlinePaymentValidationReport…csv", "affiliate_orders…xlsx"],
    ["affk", "Affiliate: performa", "mingguan", "AMSAffiliatePerformance…csv", "Transaction_Analysis_Creator_List…xlsx"]];
  const used = COLS.filter(([k]) => R.some((r) => r.c[k].ok !== null));
  const todo = R.reduce((a, r) => a + used.filter(([k]) => r.c[k].ok === false).length, 0), all = R.reduce((a, r) => a + used.filter(([k]) => r.c[k].ok !== null).length, 0);
  const show = (x: Cell, file: string) => x.ok === null ? <td className="ckc na">–</td>
    : x.ok ? <td className="ckc ok" title={`${file} · terakhir s.d. ${x.last ?? "–"}`}><b>✓</b><span>{x.last ? `s.d. ${tgl(x.last)}` : "aman"}</span>{x.old?.length ? <span className="oldg">+ data lama</span> : null}</td>
    : <td className="ckc no" title={`${file} · perlu: ${x.gaps.map(fmtGap).join(", ")}`}><b>✗</b><span className="per">{joinGaps(x.gaps) || `s.d. ${tgl(x.need)}`}</span><span>{x.last ? `ada s.d. ${tgl(x.last)}` : "belum pernah ada"}</span><em>{file}</em></td>;
  return <div className="card ucl">
    <h2>Upload hari ini</h2>
    <p className="muted small"><b className={todo ? "dn" : "up"}>{todo ? `${todo} dari ${all} belum` : `Semua ${all} sudah lengkap`}</b> · data harian wajib s.d. kemarin ({tgl(y)}) · pesanan & penghasilan wajib s.d. {tgl(ordNeed)} · ✗ = kekurangan 7 hari terakhir (data lama di bagian bawah) · dicek sejak 1 Jan 2026 atau sejak data pertama toko)</p>
    <div className="tbl"><table><thead><tr><th>Klien</th><th>Toko</th>{used.map(([k, l, s, fs, ft]) => <th key={k} className="ckc">{l}<span>{s}</span><span className="fn">S: {fs}</span>{ft !== "–" && <span className="fn">T: {ft}</span>}</th>)}</tr></thead>
      <tbody>{R.map((r, i) => <tr key={i}><td className="small">{i === 0 || R[i - 1].klien !== r.klien ? <b>{r.klien}</b> : ""}</td><td><b>{r.toko}</b></td>{used.map(([k, , , fs, ft]) => <Fragment key={k}>{show(r.c[k], r.tt ? ft : fs)}</Fragment>)}</tr>)}</tbody></table></div>
    {(() => { const L = R.flatMap((r) => used.filter(([k]) => r.c[k].old?.length).map(([k, l, , fs, ft]) => ({ r, l, f: r.tt ? ft : fs, g: r.c[k].old! })));
      return L.length ? <details className="oldd"><summary>Data lama yang belum lengkap <span className="muted small">({L.length} kotak · tidak mendesak)</span></summary>
        <div className="tbl"><table><thead><tr><th>Klien · toko</th><th>Data</th><th>Periode belum ada</th><th>File</th></tr></thead><tbody>{L.map((x, i) => <tr key={i}><td>{x.r.klien} · {x.r.toko}</td><td>{x.l}</td><td>{joinGaps(x.g)}</td><td className="muted small">{x.f}</td></tr>)}</tbody></table></div></details> : null; })()}
    <p className="muted small">✓ sudah sesuai jadwal · ✗ belum (nama file yang perlu diupload tertulis di kotak) · – tidak perlu untuk toko ini · S = Shopee, T = TikTok. Stok tidak diminta untuk klien yang stoknya dianggap selalu ada.</p>
    {used.some(([k]) => k === "affp" || k === "affk") && <div className="tbl" style={{ marginTop: 12 }}><table><thead><tr><th>Platform</th><th>Performa affiliate</th><th>Pesanan affiliate / validasi tagihan</th><th>Jadwal</th></tr></thead><tbody>
      <tr><td><b>Shopee</b></td><td><code>AMSAffiliatePerformance…csv</code></td><td>Validasi tagihan · <code>SellerOnlinePaymentValidationReport…csv</code></td><td>mingguan</td></tr>
      <tr><td><b>TikTok</b></td><td><code>Transaction_Analysis_Creator_List…xlsx</code></td><td>Pesanan affiliate · <code>affiliate_orders…xlsx</code></td><td>mingguan</td></tr>
    </tbody></table><p className="muted small">4 file affiliate per brand (2 per platform). Setelah di-upload, prioritas P1–P5 dihitung ulang otomatis.</p></div>}
  </div>;
}
