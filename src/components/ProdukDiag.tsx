"use client";
import { useState } from "react";
import { shortName } from "@/lib/nama";

/* Analisis produk ala Seller Centre: chip kategori + tabel pembanding */
export type DRow = { grup: string; nama: string; toko: string; prev: number; gmv: number };
const fmt = (n: number) => n >= 1e9 ? `Rp${(n / 1e9).toFixed(2).replace(".", ",")} M` : n >= 1e6 ? `Rp${(n / 1e6).toFixed(1).replace(".", ",")} jt` : `Rp${Math.round(n / 1e3)} rb`;

export default function ProdukDiag({ groups, sub }: { groups: { k: string; l: string; def: string; rows: DRow[] }[]; sub: string }) {
  const first = groups.find((g) => g.rows.length)?.k ?? groups[0].k;
  const [k, setK] = useState(first), [n, setN] = useState(10);
  const G = groups.find((g) => g.k === k)!;
  return (<>
    <div className="chips">{groups.map((g) => <button type="button" key={g.k} className={"chip-b" + (g.k === k ? " on" : "")} onClick={() => { setK(g.k); setN(10); }}>{g.l} ({g.rows.length})</button>)}</div>
    <p className="note">Definisi: {G.def}</p>
    {G.rows.length ? <div className="tbl"><table><thead><tr><th>Produk</th><th className="n">Periode pembanding</th><th className="n">Periode ini</th><th className="n">Perubahan</th></tr></thead>
      <tbody>{G.rows.map((r) => { const d = r.prev ? ((r.gmv - r.prev) / r.prev) * 100 : null; return <tr key={r.grup}><td className="wrapcell" title={r.nama}><b>{shortName(r.nama)}</b><div className="muted small">{r.toko || "–"}</div></td><td className="n">{fmt(r.prev)}</td><td className="n">{fmt(r.gmv)}</td><td className={"n " + (d == null ? "" : d >= 0 ? "up" : "dn")}>{d == null ? "baru" : `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(0).replace(".", ",")}%`}</td></tr>; })}</tbody></table></div>
      : <p className="muted small">Tidak ada produk di kategori ini.</p>}
    <p className="muted small">Pembanding: {sub}.</p>
  </>);
}
