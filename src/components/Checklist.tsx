import { q } from "@/lib/db";
import { todayWIB, addDays, tgl } from "@/lib/period";

/* Checklist upload: data apa yang sudah masuk per toko untuk 7 hari terakhir (sampai kemarin) */
export default async function Checklist({ clientIds }: { clientIds: string[] }) {
  if (!clientIds.length) return null;
  try { return await inner(clientIds); }
  catch (e) { const x = e as { code?: string; message?: string }; console.error("Checklist error", e); return <div className="card"><h2>Checklist upload</h2><p className="err">Gagal dimuat: {[x.code, x.message].filter(Boolean).join(": ")}</p></div>; }
}

async function inner(clientIds: string[]) {
  const y = addDays(todayWIB(), -1), d0 = addDays(y, -6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(d0, i));
  const cl = await q<{ id: string; nama: string; modul: string }>("select id, nama, modul from clients where id in (?) order by nama", [clientIds]);
  const stores = await q<{ id: string; client_id: string; brand: string; platform: string }>("select id, client_id, brand, platform from stores where client_id in (?) and platform <> 'CPAS' order by brand, platform", [clientIds]);
  const ids = stores.map((s) => s.id);
  const set = (rows: { k: string; d: string }[]) => new Set(rows.map((r) => r.k + "|" + r.d));
  const sales = ids.length ? set(await q<{ k: string; d: string }>("select store_id k, date_format(tanggal, '%Y-%m-%d') d from daily_sales where store_id in (?) and tanggal between ? and ?", [ids, d0, y])) : new Set<string>();
  const prod = ids.length ? set(await q<{ k: string; d: string }>("select distinct store_id k, date_format(tanggal, '%Y-%m-%d') d from product_sales where store_id in (?) and tanggal between ? and ?", [ids, d0, y])) : new Set<string>();
  const adsR = ids.length ? await q<{ k: string; a: string; b: string }>("select store_id k, date_format(dari, '%Y-%m-%d') a, date_format(sampai, '%Y-%m-%d') b from ads where store_id in (?) and sampai >= ? and dari <= ?", [ids, d0, y]) : [];
  const ads = new Set<string>(); adsR.forEach((r) => days.forEach((d) => { if (d >= r.a && d <= r.b) ads.add(r.k + "|" + d); }));
  const live = set(await q<{ k: string; d: string }>("select distinct client_id k, date_format(tanggal, '%Y-%m-%d') d from live_sessions where client_id in (?) and tanggal between ? and ?", [clientIds, d0, y]));

  const strip = (s: Set<string>, k: string) => <span className="ck">{days.map((d) => <i key={d} className={s.has(k + "|" + d) ? "y" : "n"} title={`${tgl(d)}: ${s.has(k + "|" + d) ? "sudah ada" : "belum ada"}`} />)}</span>;
  const yk = (s: Set<string>, k: string) => s.has(k + "|" + y);
  type Row = { c: string; t: string; cells: [string, Set<string>, string][] };
  const rows: Row[] = [];
  for (const c of cl) {
    const m = c.modul.split(",");
    if (m.includes("toko") || m.includes("iklan")) for (const s of stores.filter((x) => x.client_id === c.id))
      rows.push({ c: c.nama, t: `${s.brand} · ${s.platform}`, cells: [...(m.includes("toko") ? [["Penjualan", sales, s.id], ["Produk", prod, s.id]] as [string, Set<string>, string][] : []), ...(m.includes("iklan") ? [["Iklan", ads, s.id]] as [string, Set<string>, string][] : [])] });
    if (m.includes("live")) rows.push({ c: c.nama, t: "Livestream", cells: [["Live", live, c.id]] });
  }
  const miss = rows.reduce((n, r) => n + r.cells.filter(([, s, k]) => !yk(s, k)).length, 0);
  const tot = rows.reduce((n, r) => n + r.cells.length, 0);
  return <div className="card">
    <h2>Checklist upload · kemarin {tgl(y)} <span className={"pill " + (miss ? "warn" : "good")}>{tot - miss}/{tot} lengkap</span></h2>
    <p className="muted small">Kotak = 7 hari terakhir ({tgl(d0)}–{tgl(y)}), paling kanan kemarin. Hijau = sudah masuk, abu-abu = belum. Iklan bulanan dihitung sudah ada untuk semua hari di periodenya.</p>
    <div className="tbl"><table className="cktab"><thead><tr><th>Klien</th><th>Toko</th><th>Data</th><th>7 hari</th><th>Kemarin</th></tr></thead>
      <tbody>{rows.flatMap((r) => r.cells.map(([lbl, s, k], i) => <tr key={r.c + r.t + lbl} className={i === 0 ? "first" : ""}>
        <td>{i === 0 ? r.c : ""}</td><td>{i === 0 ? r.t : ""}</td><td>{lbl}</td><td>{strip(s, k)}</td>
        <td>{yk(s, k) ? <span className="pill good">Sudah</span> : <span className="pill bad">Belum</span>}</td></tr>))}</tbody></table></div>
  </div>;
}
