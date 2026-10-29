import Empty from "@/components/Empty";
import { forecast, blnLabel, addMonth, type FProd } from "@/lib/forecast";
import { q } from "@/lib/db";
import { todayWIB, tgl } from "@/lib/period";
import SafetyDays from "./SafetyDays";

const rp = (n: number) => n >= 1e9 ? `Rp${(n / 1e9).toFixed(2).replace(".", ",")} M` : n >= 1e6 ? `Rp${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace(".", ",")} jt` : `Rp${Math.round(n / 1e3).toLocaleString("id")} rb`;
const nf = (n: number) => Math.round(n).toLocaleString("id");
const pc = (a: number, b: number | null) => (b ? ((a - b) / b) * 100 : null);
const chg = (v: number | null) => v === null || !isFinite(v) ? <span className="muted">–</span> : <span className={v >= 0 ? "up" : "dn"}>{v >= 0 ? "▲" : "▼"} {Math.abs(v).toFixed(0)}%</span>;
const PRIO = ["Stok 0", "Habis", "Pengaman", "Aman", "Belum ada stok"];
const pcls = (p: string) => (p === "Stok 0" ? "bad" : p.startsWith("Habis") ? "warn" : p === "Pengaman" ? "mute" : p === "Aman" ? "good" : "mute");

export default async function ForecastView({ clientId, sp, base, staff, share }: { clientId: string; sp: Record<string, string | undefined>; base: string; staff: boolean; share: boolean }) {
  const now = todayWIB().slice(0, 7);
  const opts = Array.from({ length: 7 }, (_, i) => addMonth(now, i - 1));
  let sel = (sp.fb ?? "").split(",").filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
  if (!sel.length) sel = [now, addMonth(now, 1), addMonth(now, 2)];
  // bulan harus berurutan
  const months: string[] = []; for (let m = sel[0]; m <= sel[sel.length - 1]; m = addMonth(m, 1)) months.push(m);
  const cfg = (await q<{ s: number | null; a: number }>("select stok_pengaman s, stok_selalu_ada a from clients where id = ?", [clientId]))[0];
  const safety = cfg?.s ?? 28, alwaysStock = !!cfg?.a;
  const F = await forecast(clientId, months, safety);
  const link = (m: string) => {
    let a = months[0], b = months[months.length - 1];
    if (months.length === 1 && m === a) return null;
    if (m < a) a = m; else if (m > b) b = m; else if (m === a) a = addMonth(a, 1); else if (m === b) b = addMonth(b, -1); else { a = m; b = m; }
    const L: string[] = []; for (let x = a; x <= b; x = addMonth(x, 1)) L.push(x);
    const p = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]); p.set("fb", L.join(",")); return base + "?" + p.toString();
  };
  const title = months.length === 1 ? blnLabel(months[0]) : `${blnLabel(months[0])}–${blnLabel(months[months.length - 1])}`;
  if (!F.last) return <div className="card"><h2>Forecast</h2><Empty title="Belum ada data penjualan harian untuk klien ini." up={staff && !share} file={<>ekspor pesanan atau statistik toko harian (Shopee &amp; TikTok).</>} /></div>;

  const tot = F.M.reduce((a, m) => a + m.fc, 0), lo = F.M.reduce((a, m) => a + m.lo, 0), hi = F.M.reduce((a, m) => a + m.hi, 0);
  const lyT = F.M.every((m) => m.ly !== null) ? F.M.reduce((a, m) => a + (m.ly ?? 0), 0) : null;
  const terancam = F.M.reduce((a, m) => a + m.terancam, 0);
  const hasStock = !!F.stokTgl && !alwaysStock;
  const P = F.P.filter((p) => p.units >= 0.5 || (p.stok ?? 0) > 0);
  const withStock = P.filter((p) => p.stok !== null);
  const restockP = withStock.filter((p) => p.restock > 0);
  const modal = restockP.reduce((a, p) => a + p.restock * (p.hpp ?? 0), 0), modalEst = restockP.some((p) => p.hpp === null || p.hppEst);
  const noHpp = restockP.filter((p) => p.hpp === null).length;
  const cnt = (k: string) => withStock.filter((p) => (k === "Habis" ? p.prio.startsWith("Habis") : p.prio === k)).length;
  const mx = Math.max(...F.M.map((m) => m.hi), 1);
  // per seri (grup / nama produk)
  const G = new Map<string, { n: string; u: number; g: number; st: number; rs: number; md: number; est: boolean; z: number }>();
  for (const p of withStock) { const k = p.grup || p.produk; const x = G.get(k) ?? { n: p.produk, u: 0, g: 0, st: 0, rs: 0, md: 0, est: false, z: 0 }; x.u += p.units; x.g += p.gmv; x.st += Math.max(0, p.stok ?? 0); x.rs += p.restock; x.md += p.restock * (p.hpp ?? 0); x.est ||= p.restock > 0 && (p.hpp === null || p.hppEst); if ((p.stok ?? 0) <= 0) x.z++; G.set(k, x); }
  const GS = [...G.values()].filter((x) => x.rs > 0).sort((a, b) => b.md - a.md || b.rs - a.rs).slice(0, 15);
  const top = (share ? P : P).slice(0, 40);
  const prodRow = (p: FProd) => {
    const v = pc(p.units / F.months.length, p.prevUnits || null);
    return <tr key={p.key}>
      <td className="small">{p.sku || "–"}</td><td><b>{p.produk.slice(0, 60)}</b><div className="muted small">{p.varian}</div></td>
      <td className="n">{nf(p.units)}</td><td className="n">{rp(p.gmv)}</td><td className="n">{nf(p.prevUnits)}</td><td className="n">{chg(v)}</td>
      {!share && hasStock && <><td className={"n" + ((p.stok ?? 1) <= 0 ? " dn" : "")}>{p.stok === null ? "–" : nf(p.stok)}</td>
        <td className="small">{p.stok === null ? "–" : (p.stok ?? 0) <= 0 ? <span className="dn">sudah habis</span> : p.habis ? tgl(p.habis) : `aman s/d ${blnLabel(F.months[F.months.length - 1])}`}</td>
        <td className="n"><b>{p.restock ? nf(p.restock) : "–"}</b></td>
        <td className="n small">{p.hpp === null ? "–" : `Rp${nf(p.hpp)}${p.hppEst ? "*" : ""}`}</td>
        <td>{p.stok === null ? <span className="pill mute">Tidak ada di file stok</span> : <span className={"pill " + pcls(p.prio)}>{p.prio}</span>}</td></>}
    </tr>;
  };
  return <>
    <div className="card fcbar">
      <span className="muted small">Bulan</span>
      <div className="mchips">{opts.map((m) => { const on = months.includes(m), h = link(m); return h ? <a key={m} href={h} className={on ? "on" : ""}>{blnLabel(m)}</a> : <span key={m} className="on">{blnLabel(m)}</span>; })}</div>
      <span className="muted small">Klik bulan di ujung untuk menambah/mengurangi; klik bulan di tengah untuk memilih satu bulan saja.</span>
      {!share && !alwaysStock && <SafetyDays clientId={clientId} value={safety} canEdit={staff} />}
    </div>
    <h2 className="sec">Forecast GMV · {title}</h2>
    <p className="muted small" style={{ marginTop: -6 }}>Data penjualan masuk s.d. {tgl(F.last)} {F.last.slice(0, 4)}{F.M.some((m) => m.partial) ? " · bulan berjalan = aktual + perkiraan sisa hari" : ""}</p>
    <div className="kpis fck">
      <div className="kpi"><div className="kl">Perkiraan GMV {title}</div><div className="kv">{rp(tot)}</div><div className="kd muted">kisaran {rp(lo)} – {rp(hi)}</div></div>
      <div className="kpi"><div className="kl">Tahun lalu, bulan yang sama</div><div className="kv">{lyT !== null ? rp(lyT) : "–"}</div><div className="kd">{lyT !== null ? <>{chg(pc(tot, lyT))} perkiraan vs tahun lalu</> : <span className="muted">data tahun lalu belum ada</span>}</div></div>
      {!share && hasStock && <div className="kpi"><div className="kl">GMV terancam (stok kurang)</div><div className="kv dn">{rp(terancam)}</div><div className="kd muted">{tot ? `${((terancam / tot) * 100).toFixed(0)}% dari perkiraan, hanya tercapai kalau restock` : ""}</div></div>}
      {!share && hasStock && <div className="kpi"><div className="kl">Modal restock (HPP)</div><div className="kv">{rp(modal)}{modalEst ? "*" : ""}</div><div className="kd muted">{nf(restockP.reduce((a, p) => a + p.restock, 0))} unit · {restockP.length} SKU{noHpp ? ` · ${noHpp} SKU tanpa HPP` : ""}</div></div>}
    </div>
    <div className="grid2c">
      <div className="card"><h3>Perkiraan GMV per bulan</h3>
        <div className="fcbars">{F.M.map((m) => <div key={m.m} className="fcb">
          <div className="fcv">{rp(m.fc)}</div>
          <div className="fcc" style={{ height: 180 }}>
            {m.ly !== null && <i className="ly" style={{ bottom: `${(m.ly / mx) * 100}%` }} title={`Tahun lalu ${rp(m.ly)}`} />}
            <div className="rg" style={{ bottom: `${(m.lo / mx) * 100}%`, height: `${((m.hi - m.lo) / mx) * 100}%` }} />
            <div className="fc" style={{ height: `${((m.fc - (share ? 0 : m.terancam)) / mx) * 100}%` }} />
            {!share && m.terancam > 0 && <div className="tr" style={{ bottom: `${((m.fc - m.terancam) / mx) * 100}%`, height: `${(m.terancam / mx) * 100}%` }} />}
            {m.actual > 0 && <div className="ac" style={{ height: `${(m.actual / mx) * 100}%` }} title={`Aktual ${rp(m.actual)}`} />}
          </div>
          <div className="small"><b>{blnLabel(m.m)}</b></div>
          <div className="muted small">{m.ly !== null ? <>tahun lalu {rp(m.ly)}</> : "tahun lalu –"}</div>
          {!share && hasStock && m.terancam > 0 && <div className="small dn">terancam {rp(m.terancam)}</div>}
        </div>)}</div>
        <div className="lg small"><span><i style={{ background: "var(--accent)" }} />Perkiraan</span><span><i style={{ background: "#8a4a2d" }} />Aktual</span>{!share && hasStock && <span><i className="trl" />Terancam</span>}<span><i style={{ background: "#2a2320", height: 2 }} />Tahun lalu</span></div>
      </div>
      <div className="card"><h3>Per toko · {title}</h3><div className="tbl"><table><thead><tr><th>Toko</th><th className="n">Perkiraan</th><th className="n">Tahun lalu</th><th className="n">vs</th><th>Data s.d.</th></tr></thead>
        <tbody>{F.S.map((s) => <tr key={s.id}><td><b>{s.nama}</b>{!s.season && <span className="muted small"> *</span>}</td><td className="n">{rp(s.fc)}</td><td className="n">{s.ly !== null ? rp(s.ly) : "–"}</td><td className="n">{chg(pc(s.fc, s.ly))}</td><td className="small">{tgl(s.last)}</td></tr>)}</tbody></table></div>
        {F.noSeason.length > 0 && <p className="muted small">* Data tahun lalu belum cukup, jadi perkiraan memakai laju terakhir tanpa pola musiman.</p>}
      </div>
    </div>
    {!share && !alwaysStock && <div className="card internal"><h3>Kebutuhan stok · {title}</h3>
      {!hasStock ? <p className="muted">Belum ada data stok. Upload file stok Shopee di menu Upload data: Produk Saya → Ubah Massal → Info penjualan (berisi kolom Stok per gudang). Setelah itu kebutuhan restock, tanggal habis, dan GMV terancam muncul di sini.</p> : <>
        <p className="muted small">Stok per {tgl(F.stokTgl!)} {F.stokTgl!.slice(0, 4)} · stok pengaman {safety} hari di akhir {blnLabel(F.months[F.months.length - 1])} · {withStock.length.toLocaleString("id")} SKU terjual yang ada di file stok</p>
        <div className="prio">{PRIO.slice(0, 4).map((k) => <div key={k} className={"pr " + pcls(k === "Habis" ? "Habis" : k)}><b>{nf(cnt(k))}</b><span>{k === "Habis" ? `Habis di ${title}` : k}</span></div>)}</div>
        {GS.length > 0 && <div className="tbl"><table><thead><tr><th>Produk / seri</th><th className="n">Perkiraan unit</th><th className="n">Stok</th><th className="n">Restock</th><th className="n">Modal restock</th><th className="n">SKU stok 0</th></tr></thead>
          <tbody>{GS.map((x) => <tr key={x.n}><td><b>{x.n.slice(0, 60)}</b></td><td className="n">{nf(x.u)}</td><td className="n">{nf(x.st)}</td><td className="n"><b>{nf(x.rs)}</b></td><td className="n">{x.md ? rp(x.md) : "–"}{x.est ? "*" : ""}</td><td className={"n" + (x.z ? " dn" : "")}>{x.z}</td></tr>)}</tbody></table></div>}
        <p className="muted small">* HPP perkiraan atau belum ada. Restock = kebutuhan bulan terpilih + stok pengaman − stok (sudah dikurangi perkiraan penjualan sejak tanggal stok).</p>
      </>}
    </div>}
    <div className="card"><h3>Forecast produk · {title}</h3>
      <div className="tbl"><table><thead><tr><th>SKU</th><th>Produk</th><th className="n">Perkiraan unit</th><th className="n">Perkiraan GMV</th><th className="n">Unit {blnLabel(addMonth(F.months[0], -1))}</th><th className="n">vs</th>
        {!share && hasStock && <><th className="n">Stok</th><th>Habis</th><th className="n">Restock</th><th className="n">HPP</th><th>Prioritas</th></>}</tr></thead>
        <tbody>{top.map(prodRow)}</tbody></table></div>
      <p className="muted small">40 produk dengan perkiraan GMV terbesar. “vs” = rata-rata perkiraan unit per bulan dibanding unit {blnLabel(addMonth(F.months[0], -1))}. Perkiraan produk dari data pesanan, jadi totalnya bisa sedikit berbeda dari GMV statistik toko.</p>
    </div>
    <p className="muted small">Cara hitung: laju harian 90 hari terakhir (30 hari terakhir dibobot paling besar) × jumlah hari × pola musiman tahun lalu per toko (bulan yang sama dibanding 90 hari yang sama tahun lalu, dibatasi 0,4–2,5×). Kisaran melebar ±4% per bulan ke depan.</p>
  </>;
}
