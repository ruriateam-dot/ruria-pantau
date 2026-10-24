"use client";
import { Fragment, useState } from "react";

export type PRow = { grup: string; nama: string; kode: string[] | null; gmv: number; qty: number; ch: number; prev: number; share: number; status: string; tokoLabel: string;
  varian: { sku: string; varian: string; toko: string; qty: number; gmv: number }[] | null };

const fmt = (n: number) => n >= 1e9 ? `Rp${(n / 1e9).toFixed(2).replace(".", ",")} M` : n >= 1e6 ? `Rp${(n / 1e6).toFixed(1).replace(".", ",")} jt` : `Rp${Math.round(n / 1e3)} rb`;
const PILL: Record<string, [string, string]> = { andalan: ["good", "Andalan"], naik: ["good", "Naik"], turun: ["warn", "Turun"], stop: ["bad", "Berhenti terjual"], baru: ["mute", "Baru terjual"], biasa: ["mute", "Stabil"] };

export default function ProdukTable({ rows, tokoName }: { rows: PRow[]; tokoName: Record<string, string> }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (g: string) => setOpen((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; });
  return (
    <div className="tbl"><table className="ptab">
      <thead><tr><th>SKU induk</th><th>Produk</th><th className="n">GMV</th><th className="n">Qty</th><th className="n">Δ GMV</th><th className="n">Porsi</th><th>Status</th></tr></thead>
      <tbody>{rows.map((r) => {
        const isOpen = open.has(r.grup), code = r.kode?.[0] ?? (r.grup.startsWith("NAMA:") ? "–" : r.grup);
        return (
          <Fragment key={r.grup}>
            <tr className={"prow" + (isOpen ? " open" : "")} onClick={() => toggle(r.grup)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(r.grup); } }} aria-expanded={isOpen}>
              <td><span className="chev" aria-hidden="true">{isOpen ? "▾" : "▸"}</span> <b>{code}</b>{r.kode && r.kode.length > 1 && <div className="muted small">+{r.kode.length - 1} kode lain</div>}</td>
              <td className="wrapcell" title={r.nama}>{r.nama.length > 60 ? r.nama.slice(0, 58) + "…" : r.nama}<div className="muted small">{r.tokoLabel}</div></td>
              <td className="n">{fmt(r.gmv)}</td><td className="n">{r.qty.toLocaleString("id")}</td>
              <td className={"n " + (r.ch >= 0 ? "up" : "dn")}>{r.prev ? `${r.ch >= 0 ? "+" : ""}${r.ch.toFixed(0)}%` : "–"}</td>
              <td className="n">{r.share.toFixed(1)}%</td>
              <td><span className={"pill " + PILL[r.status][0]}>{PILL[r.status][1]}</span></td>
            </tr>
            {isOpen && (
              <tr className="vrow"><td colSpan={7}>
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
  );
}
