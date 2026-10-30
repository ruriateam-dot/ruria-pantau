"use client";
import { useEffect, useMemo, useState } from "react";
import { shortName } from "@/lib/nama";

export type CRow = { k: string; toko: string; platform: string; tipe: string; nama: string; s: number; g: number; o: number; r: number; dr: number | null; st: string; dl?: number | null; kl?: number | null };
const fmt = (n: number) => n >= 1e9 ? `Rp${(n / 1e9).toFixed(2).replace(".", ",")} M` : n >= 1e6 ? `Rp${(n / 1e6).toFixed(1).replace(".", ",")} jt` : `Rp${Math.round(n / 1e3)} rb`;
export const ST: Record<string, [string, string]> = { boros: ["bad", "Boros"], scale: ["good", "Bisa di-scale"], nol: ["bad", "Tanpa penjualan"], normal: ["mute", "Normal"] };
const STEP = 15;

export default function IklanTable({ rows, lite }: { rows: CRow[]; lite?: boolean }) {
  const [toko, setToko] = useState(""), [tipe, setTipe] = useState(""), [st, setSt] = useState(""), [cari, setCari] = useState(""), [n, setN] = useState(STEP);
  const opt = (k: keyof CRow) => [...new Set(rows.map((r) => String(r[k])))].sort();
  const F = useMemo(() => { const c = cari.trim().toLowerCase(); return rows.filter((r) => (!toko || r.toko === toko) && (!tipe || r.tipe === tipe) && (!st || r.st === st) && (!c || r.nama.toLowerCase().includes(c))); }, [rows, toko, tipe, st, cari]);
  useEffect(() => { const h = () => { const m = location.hash.match(/^#st=(\w*)$/); if (m) { setSt(m[1]); document.getElementById("daftar-iklan")?.scrollIntoView({ behavior: "smooth", block: "start" }); } }; h(); addEventListener("hashchange", h); return () => removeEventListener("hashchange", h); }, []);
  const set = (f: (v: string) => void) => (e: { target: { value: string } }) => { f(e.target.value); setN(STEP); };
  return (<>
    <div className="pfil">
      <input type="search" placeholder="Cari kampanye / produk" value={cari} onChange={set(setCari)} aria-label="Cari kampanye" />
      <select value={st} onChange={set(setSt)} className={st ? "act" : ""} aria-label="Status"><option value="">Semua status ({rows.length})</option>{Object.keys(ST).map((k) => <option key={k} value={k}>{ST[k][1]} ({rows.filter((r) => r.st === k).length})</option>)}</select>
      <select value={tipe} onChange={set(setTipe)} className={tipe ? "act" : ""} aria-label="Tipe iklan"><option value="">Semua tipe</option>{opt("tipe").map((x) => <option key={x}>{x}</option>)}</select>
      <select value={toko} onChange={set(setToko)} className={toko ? "act" : ""} aria-label="Toko"><option value="">Semua toko</option>{opt("toko").map((x) => <option key={x}>{x}</option>)}</select>
      <span className="muted small">{F.length} kampanye</span>
    </div>
    <div className="tbl"><table><thead><tr><th>Kampanye</th><th>Tipe</th>{!lite && <><th className="n">Dilihat</th><th className="n">Klik</th><th className="n">CTR</th></>}<th className="n">Biaya</th><th className="n">GMV</th><th className="n">Pesanan</th>{!lite && <th className="n">CPA</th>}<th className="n">ROAS</th><th className="n">Δ ROAS</th><th>Diagnosis</th></tr></thead>
      <tbody>{F.map((c) => <tr key={c.k} className={"row-" + c.st}><td className="wrapcell" title={c.nama}>{shortName(c.nama)}<div className="muted small">{c.toko}</div></td><td className="small">{c.tipe}</td>
        {!lite && <><td className="n">{c.dl != null ? Math.round(c.dl).toLocaleString("id") : "–"}</td><td className="n">{c.kl != null ? Math.round(c.kl).toLocaleString("id") : "–"}</td><td className="n">{c.dl ? ((c.kl ?? 0) / c.dl * 100).toFixed(2).replace(".", ",") + "%" : "–"}</td></>}
        <td className="n">{fmt(c.s)}</td><td className="n">{fmt(c.g)}</td><td className="n">{c.o ? c.o.toLocaleString("id") : "–"}</td>{!lite && <td className="n">{c.o ? fmt(c.s / c.o) : "–"}</td>}<td className="n">{c.r.toFixed(2).replace(".", ",")}</td>
        <td className={"n " + (c.dr == null ? "" : c.dr >= 0 ? "up" : "dn")}>{c.dr == null ? "–" : `${c.dr >= 0 ? "+" : ""}${c.dr.toFixed(2).replace(".", ",")}`}</td>
        <td><span className={"pill " + ST[c.st][0]}>{ST[c.st][1]}</span></td></tr>)}</tbody></table></div>
  </>);
}
