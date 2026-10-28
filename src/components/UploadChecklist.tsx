import { Fragment } from "react";
import { q } from "@/lib/db";
import { todayWIB, addDays, tgl } from "@/lib/period";

/* Checklist upload per toko sesuai jadwal di panduan:
   harian (data kemarin): statistik toko, produk, iklan · live: 7 hari terakhir · pesanan & penghasilan: tiap tanggal 1, 6, 11, 16, 21, 26, 30
   stok: mingguan (klien yang stoknya dihitung) · affiliate OT: mingguan */
const JADWAL = [1, 6, 11, 16, 21, 26, 30];
type Cell = { ok: boolean | null; last: string | null; need: string };

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
  const live = await mp("select client_id k, date_format(max(tanggal), '%Y-%m-%d') d from live_sessions where client_id in (?) group by client_id", [clientIds]);
  const stok = await mp("select client_id k, date_format(max(tanggal), '%Y-%m-%d') d from stock_snapshot where client_id in (?) group by client_id", [clientIds]);
  const cell = (last: string | null | undefined, need: string, on = true): Cell => (on ? { ok: !!last && last >= need, last: last ?? null, need } : { ok: null, last: null, need });

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
      R.push({ klien: c.nama, toko: toko || ik ? `${s.brand} · ${s.platform}` : "Livestream", tt, c: {
        stat: cell(jual.get(s.id), y, toko),
        produk: cell(ff(s.id, tt ? /^produk-tiktok$/ : /^produk-shopee$/), y, toko),
        iklan: cell(iklan.get(s.id), y, ik),
        pesanan: cell(ord.get(s.id), ordNeed, toko),
        hasil: cell(ff(s.id, /^penghasilan/), ordNeed, toko),
        live: cell(live.get(c.id), addDays(y, -1), lv && i === 0),
        stok: cell(stok.get(c.id), weekNeed, stokOn && i === 0),
        aff: cell(ff(s.id, /^aff-(shopee|tiktok)$/), addDays(today, -9), c.id === "ot" && m.includes("affiliate")),
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
    ["aff", "Affiliate OT", "mingguan", "AMSAffiliatePerformance…csv", "Transaction_Analysis_Creator_List…xlsx"]];
  const used = COLS.filter(([k]) => R.some((r) => r.c[k].ok !== null));
  const todo = R.reduce((a, r) => a + used.filter(([k]) => r.c[k].ok === false).length, 0), all = R.reduce((a, r) => a + used.filter(([k]) => r.c[k].ok !== null).length, 0);
  const show = (x: Cell, file: string) => x.ok === null ? <td className="ckc na">–</td>
    : <td className={"ckc " + (x.ok ? "ok" : "no")} title={`${file} · ${x.last ? `terakhir s.d. ${x.last}` : "belum ada"}, wajib s.d. ${x.need}`}><b>{x.ok ? "✓" : "✗"}</b><span>{x.last ? tgl(x.last) : "belum ada"}</span>{!x.ok && <em>{file}</em>}</td>;
  return <div className="card ucl">
    <h2>Checklist upload hari ini</h2>
    <p className="muted small"><b className={todo ? "dn" : "up"}>{todo ? `${todo} dari ${all} belum` : `Semua ${all} sudah lengkap`}</b> · data harian wajib s.d. kemarin ({tgl(y)}) · pesanan & penghasilan wajib s.d. {tgl(ordNeed)} · tanggal di kotak = data terakhir yang masuk</p>
    <div className="tbl"><table><thead><tr><th>Klien</th><th>Toko</th>{used.map(([k, l, s, fs, ft]) => <th key={k} className="ckc">{l}<span>{s}</span><span className="fn">S: {fs}</span>{ft !== "–" && <span className="fn">T: {ft}</span>}</th>)}</tr></thead>
      <tbody>{R.map((r, i) => <tr key={i}><td className="small">{i === 0 || R[i - 1].klien !== r.klien ? <b>{r.klien}</b> : ""}</td><td><b>{r.toko}</b></td>{used.map(([k, , , fs, ft]) => <Fragment key={k}>{show(r.c[k], r.tt ? ft : fs)}</Fragment>)}</tr>)}</tbody></table></div>
    <p className="muted small">✓ sudah sesuai jadwal · ✗ belum (nama file yang perlu diupload tertulis di kotak) · – tidak perlu untuk toko ini · S = Shopee, T = TikTok. Stok tidak diminta untuk klien yang stoknya dianggap selalu ada.</p>
  </div>;
}
