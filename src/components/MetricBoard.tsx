"use client";
import { useState } from "react";

/* Kartu metrik ala Seller Centre: klik kartu untuk menampilkan/menyembunyikan garisnya di grafik (maks. 4). */
export type Metric = { k: string; l: string; f: "rp" | "n" | "pct" | "x" | "jam"; v: number; p?: number | null; s: number[]; ps?: number[]; inv?: boolean; note?: string; d?: number | null; g?: string };
const COL = ["var(--accent)", "var(--aqua)", "#7c5cff", "#e0a100"];
const fmtV = (f: Metric["f"], n: number) => {
  if (!isFinite(n)) return "–";
  if (f === "rp") return n >= 1e9 ? `Rp${(n / 1e9).toFixed(2).replace(".", ",")} M` : n >= 1e6 ? `Rp${(n / 1e6).toFixed(1).replace(".", ",")} jt` : `Rp${Math.round(n / 1e3)} rb`;
  if (f === "pct") return n.toFixed(2).replace(".", ",") + "%";
  if (f === "x") return n.toFixed(1).replace(".", ",");
  if (f === "jam") { const t = Math.round(n * 60); return `${Math.floor(t / 60)}j ${String(t % 60).padStart(2, "0")}m`; }
  return Math.round(n).toLocaleString("id");
};

export default function MetricBoard({ metrics, labels, sub, init }: { metrics: Metric[]; labels: string[]; sub: string; init?: string[] }) {
  const [sel, setSel] = useState<string[]>(init ?? metrics.slice(0, 2).map((m) => m.k));
  const [hov, setHov] = useState<number | null>(null);
  const toggle = (k: string) => setSel((s) => s.includes(k) ? (s.length > 1 ? s.filter((x) => x !== k) : s) : [...s, k].slice(-4));
  const on = sel.map((k) => metrics.find((m) => m.k === k)!).filter(Boolean);
  const W = 720, H = 230, L = 12, R = 12, T = 14, B = 26, n = labels.length;
  const x = (i: number) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const step = Math.max(1, Math.ceil(n / 8));
  return (
    <div className="card mb">
      {[...new Set(metrics.map((m) => m.g ?? ""))].map((grp) => <div key={grp}>{grp && <h3 className="mbgh">{grp}</h3>}<div className="mbg">{metrics.filter((m) => (m.g ?? "") === grp).map((m) => { const i = sel.indexOf(m.k), d = m.d !== undefined ? (m.d != null && isFinite(m.d) ? m.d : null) : m.p != null && m.p !== 0 && isFinite(m.p) ? ((m.v - m.p) / Math.abs(m.p)) * 100 : null, good = d == null ? true : m.inv ? d <= 0 : d >= 0;
        return <button type="button" key={m.k} className={"mbc" + (i >= 0 ? " on" : "")} style={i >= 0 ? { borderTopColor: COL[i] } : undefined} onClick={() => toggle(m.k)} aria-pressed={i >= 0}>
          <span className="mbl">{m.l}</span><b>{fmtV(m.f, m.v)}</b>
          <span className={"mbd " + (d == null ? "muted" : good ? "up" : "dn")}>{d == null ? (m.note ?? sub) : `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}% ${sub}`}</span>
        </button>; })}</div></div>)}
      <div className="mbch" onMouseLeave={() => setHov(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Tren metrik">
          {[0, 1, 2, 3].map((k) => <line key={k} x1={L} x2={W - R} y1={T + (k * (H - T - B)) / 3} y2={T + (k * (H - T - B)) / 3} stroke="var(--line)" />)}
          {on.map((m, j) => { const mx = Math.max(1e-9, ...m.s.filter(isFinite), ...(m.ps ?? []).filter(isFinite)) * 1.08, y = (v: number) => H - B - ((isFinite(v) ? v : 0) / mx) * (H - T - B);
            const path = (s: number[]) => s.slice(0, n).map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
            return <g key={m.k}>{m.ps && on.length === 1 && <path d={path(m.ps)} fill="none" stroke={COL[j]} strokeOpacity=".45" strokeWidth="1.5" strokeDasharray="5 4" />}
              <path d={path(m.s)} fill="none" stroke={COL[j]} strokeWidth="2.2" strokeLinejoin="round" />
              {hov != null && <circle cx={x(hov)} cy={y(m.s[hov])} r="3.5" fill={COL[j]} />}</g>; })}
          {hov != null && <line x1={x(hov)} x2={x(hov)} y1={T} y2={H - B} stroke="var(--muted)" strokeDasharray="3 3" />}
          {labels.map((l, i) => ((i % step === 0 && (n - 1 - i >= step * 0.6 || i === n - 1)) || i === n - 1) && <text key={i} x={x(i)} y={H - 8} textAnchor="middle">{l}</text>)}
          {labels.map((_, i) => <rect key={i} x={x(i) - (W - L - R) / Math.max(1, n - 1) / 2} y={0} width={(W - L - R) / Math.max(1, n - 1)} height={H} fill="transparent" onMouseEnter={() => setHov(i)} onTouchStart={() => setHov(i)} />)}
        </svg>
        {hov != null && <div className="mbtip"><b>{labels[hov]}</b>{on.map((m, j) => <div key={m.k}><i style={{ background: COL[j] }} />{m.l}: <b>{fmtV(m.f, m.s[hov])}</b>{m.ps && on.length === 1 && m.ps[hov] != null ? <span className="muted"> (pembanding {fmtV(m.f, m.ps[hov])})</span> : null}</div>)}</div>}
      </div>
      <div className="mbleg">{on.map((m, j) => <span key={m.k}><i style={{ background: COL[j] }} />{m.l}</span>)}{on.length === 1 && on[0].ps && <span><i style={{ background: "none", borderTop: "2px dashed " + COL[0] }} />Periode pembanding</span>}<span className="muted small">Klik kartu untuk memilih metrik di grafik (maks. 4). Tiap garis memakai skalanya sendiri.</span></div>
    </div>
  );
}
