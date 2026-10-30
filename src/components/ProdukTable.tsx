"use client";
import { Fragment, useMemo, useState } from "react";
import { shortName } from "@/lib/nama";

export type PRow = { grup: string; nama: string; kode: string[] | null; gmv: number; qty: number; ch: number; prev: number; share: number; cum: number; status: string; toko: string[]; tokoLabel: string;
  varian: { sku: string; varian: string; toko: string; qty: number; gmv: number }[] | null; sc?: { dl: number; kl: number; kr: number; pg: number } | null };

const fmt = (n: number) => n >= 1e9 ? `Rp${(n / 1e9).toFixed(2).replace(".", ",")} M` : n >= 1e6 ? `Rp${(n / 1e6).toFixed(1).replace(".", ",")} jt` : `Rp${Math.round(n / 1e3)} rb`;
const PILL: Record<string, [string, string]> = { andalan: ["good", "Andalan"], naik: ["good", "Naik"], turun: ["warn", "Turun"], stop: ["bad", "Berhenti terjual"], baru: ["mute", "Baru terjual"], biasa: ["mute", "Stabil"] };
const STEP = 15;

export default function ProdukTable({ rows, tokoName }: { rows: PRow[]; tokoName: Record<string, string> }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [toko, setToko] = useState(""), [status, setStatus] = useState(""), [cari, setCari] = useState(""), [n, setN] = useState(STEP);
  const toggle = (g: string) => setOpen((s) => { const x = new Set(s); if (x.has(g)) x.delete(g); else x.add(g); return x; });
  const tokoOpts = useMemo(() => [...new Set(rows.flatMap((r) => r.toko))], [rows]);
  const F = useMemo(() => { const c = cari.trim().toLowerCase();
    return rows.filter((r) => (!toko || r.toko.includes(toko)) && (!status || r.status === status) && (!c || r.nama.toLowerCase().includes(c) || r.grup.toLowerCase().includes(c) || (r.kode ?? []).some((k) => k.toLowerCase().includes(c)))); }, [rows, toko, status, cari]);
  const hasSC = rows.some((r) => r.sc);
  const reset = (f: () => void) => { f(); setN(STEP); };
  return (<>
    <div className="pfil">
      <input type="search" placeholder="Cari SKU / nama produk" value={cari} onChange={(e) => reset(() => setCari(e.target.value))} aria-label="Cari SKU" />
      <select value={toko} onChange={(e) => reset(() => setToko(e.target.value))} aria-label="Toko" className={toko ? "act" : ""}><option value="">Semua toko</option>{tokoOpts.map((t) => <option key={t} value={t}>{tokoName[t] ?? t}</option>)}</select>
      <select value={status} onChange={(e) => reset(() => setStatus(e.target.value))} aria-label="Status" className={status ? "act" : ""}><option value="">Semua status</option>{Object.entries(PILL).map(([k, v]) => <option key={k} value={k}>{v[1]}</option>)}</select>
      <span className="muted small">{F.length} SKU</span>
    </div>
    <div className="tbl"><table className="ptab">
      <thead><tr><th className="o">#</th><th className="o">SKU induk</th><th>Produk</th><th className="n">GMV</th><th className="n o">Qty</th><th className="n o">Harga rata²</th>{hasSC && <><th className="n o" title="Shopee, laporan bulanan">Dilihat</th><th className="n o">Klik</th><th className="n o">CTR</th><th className="n o">Keranjang</th></>}<th className="n">Δ GMV</th><th className="n o">Porsi</th><th className="n o">Kumulatif</th><th>Status</th></tr></thead>
      <tbody>{F.map((r) => {
        const isOpen = open.has(r.grup), code = r.kode?.[0] ?? (r.grup.startsWith("NAMA:") ? "–" : r.grup);
        return (
          <Fragment key={r.grup}>
            <tr className={"prow" + (isOpen ? " open" : "")} data-rank={rows.indexOf(r) + 1} onClick={() => toggle(r.grup)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(r.grup); } }} aria-expanded={isOpen}>
              <td className="o">{(() => { const k = rows.indexOf(r) + 1; return r.gmv > 0 ? <span className={"rk" + (k <= 3 ? " r" + k : "")}>{k}</span> : "–"; })()}</td>
              <td className="o"><span className="chev" aria-hidden="true">{isOpen ? "▾" : "▸"}</span> <b>{code}</b>{r.kode && r.kode.length > 1 && <div className="muted small">+{r.kode.length - 1} kode lain</div>}</td>
              <td className="wrapcell" title={r.nama}><span className="chev pm" aria-hidden="true">{isOpen ? "▾ " : "▸ "}</span>{shortName(r.nama)}<div className="muted small">{r.tokoLabel}</div></td>
              <td className="n">{fmt(r.gmv)}</td><td className="n o">{r.qty.toLocaleString("id")}</td><td className="n o">{r.qty ? fmt(r.gmv / r.qty) : "–"}</td>{hasSC && <><td className="n o">{r.sc ? Math.round(r.sc.dl).toLocaleString("id") : "–"}</td><td className="n o">{r.sc ? Math.round(r.sc.kl).toLocaleString("id") : "–"}</td><td className="n o">{r.sc && r.sc.dl ? ((r.sc.kl / r.sc.dl) * 100).toFixed(2).replace(".", ",") + "%" : "–"}</td><td className="n o">{r.sc ? Math.round(r.sc.kr).toLocaleString("id") : "–"}</td></>}
              <td className={"n " + (r.ch >= 0 ? "up" : "dn")}>{r.prev ? `${r.ch >= 0 ? "+" : ""}${r.ch.toFixed(0).replace(".", ",")}%` : "–"}</td>
              <td className="n o">{r.share.toFixed(1).replace(".", ",")}%</td><td className="n muted o">{r.gmv ? r.cum.toFixed(0).replace(".", ",") + "%" : "–"}</td>
              <td><span className={"pill " + PILL[r.status][0]}>{PILL[r.status][1]}</span></td>
            </tr>
            {isOpen && (
              <tr className="vrow"><td colSpan={hasSC ? 14 : 10}>
                <p className="small" style={{ margin: "0 0 6px" }}>{r.nama}</p>
                {r.varian?.length ? (
                  <table className="vtab"><thead><tr><th>SKU varian</th><th>Varian</th><th>Toko</th><th className="n">Qty</th><th className="n">GMV</th><th className="n">Porsi di SKU</th></tr></thead>
                    <tbody>{r.varian.map((v, i) => <tr key={i}><td>{v.sku || "–"}</td><td className="wrapcell">{v.varian}</td><td>{tokoName[v.toko] ?? v.toko}</td><td className="n">{v.qty.toLocaleString("id")}</td><td className="n">{fmt(+v.gmv)}</td><td className="n">{r.gmv ? ((+v.gmv / r.gmv) * 100).toFixed(1) : "0"}%</td></tr>)}</tbody></table>
                ) : <p className="muted small">Tidak ada penjualan varian di periode ini.</p>}
                {r.kode && r.kode.length > 1 && <p className="muted small">Kode SKU dalam kelompok ini: {r.kode.join(", ")}</p>}
              </td></tr>
            )}
          </Fragment>
        );
      })}</tbody>
    </table></div>
  </>);
}
