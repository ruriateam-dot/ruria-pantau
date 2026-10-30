"use client";
import { useMemo, useState } from "react";

/* Daftar sesi live ala Seller Centre: bisa diurutkan & disaring per host */
export type SRow = { tgl: string; hari: string; jam: string; host: string; dur: number; pen: number | null; gs: number; gt: number };
const fmt = (n: number) => n >= 1e9 ? `Rp${(n / 1e9).toFixed(2).replace(".", ",")} M` : n >= 1e6 ? `Rp${(n / 1e6).toFixed(1).replace(".", ",")} jt` : `Rp${Math.round(n / 1e3)} rb`;
const jm = (h: number) => { const t = Math.round(h * 60); return `${Math.floor(t / 60)}j ${String(t % 60).padStart(2, "0")}m`; };
type K = "tgl" | "dur" | "pen" | "gs" | "gt" | "g" | "gj" | "gp";
const COLS: [K, string][] = [["tgl", "Mulai"], ["dur", "Durasi"], ["pen", "Penonton"], ["gs", "GMV Shopee"], ["gt", "GMV TikTok"], ["g", "GMV total"], ["gj", "GMV/jam"], ["gp", "GMV/penonton"]];
const STEP = 20;

export default function LiveSessions({ rows }: { rows: SRow[] }) {
  const [host, setHost] = useState(""), [sk, setSk] = useState<K>("tgl"), [asc, setAsc] = useState(false), [, setN] = useState(STEP), [q, setQ] = useState<"" | "lemah" | "kuat">("");
  const val = (r: SRow, k: K) => k === "tgl" ? r.tgl + r.jam : k === "g" ? r.gs + r.gt : k === "gj" ? (r.gs + r.gt) / (r.dur || 1) : k === "gp" ? (r.pen ? (r.gs + r.gt) / r.pen : -1) : k === "pen" ? r.pen ?? -1 : r[k];
  const F = useMemo(() => { const base = rows.filter((r) => !host || r.host === host);
    if (q) { const ok = base.filter((r) => r.dur >= 1).sort((a, b) => ((a.gs + a.gt) / a.dur - (b.gs + b.gt) / b.dur) * (q === "lemah" ? 1 : -1)); return ok.slice(0, 10); }
    return base.sort((a, b) => { const x = val(a, sk), y = val(b, sk); return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1); }); }, [rows, host, sk, asc, q]);
  const hosts = [...new Set(rows.map((r) => r.host))].sort();
  const sort = (k: K) => { if (k === sk) setAsc(!asc); else { setSk(k); setAsc(false); } };
  return (<>
    <div className="pfil"><span className="qf" style={{ margin: 0 }}>{([["", "Semua"], ["lemah", "10 terlemah"], ["kuat", "10 terbaik"]] as const).map(([k, l]) => <button type="button" key={k} className={"fchip" + (q === k ? " on" : "")} onClick={() => setQ(k)}>{l}</button>)}</span><select value={host} onChange={(e) => { setHost(e.target.value); setN(STEP); }} className={host ? "act" : ""} aria-label="Host"><option value="">Semua host</option>{hosts.map((h) => <option key={h}>{h}</option>)}</select><span className="muted small">{F.length} sesi · klik judul kolom untuk mengurutkan</span></div>
    <div className="tbl"><table><thead><tr><th>Host</th>{COLS.map(([k, l]) => <th key={k} className={k === "tgl" ? "" : "n"}><button type="button" className="sorth" onClick={() => sort(k)}>{l}{sk === k ? (asc ? " ▲" : " ▼") : ""}</button></th>)}</tr></thead>
      <tbody>{F.map((r, i) => { const g = r.gs + r.gt; return <tr key={i}><td>{r.host}</td><td>{r.hari}, {r.tgl.slice(8)}/{r.tgl.slice(5, 7)} · {r.jam}</td><td className="n">{jm(r.dur)}</td><td className="n">{r.pen != null ? r.pen.toLocaleString("id") : "–"}</td><td className="n">{fmt(r.gs)}</td><td className="n">{fmt(r.gt)}</td><td className="n"><b>{fmt(g)}</b></td><td className={"n" + (g === 0 && r.dur >= 1 ? " dn" : "")}>{fmt(g / (r.dur || 1))}</td><td className="n">{r.pen ? fmt(g / r.pen).replace(" rb", " rb") : "–"}</td></tr>; })}</tbody></table></div>
  </>);
}
