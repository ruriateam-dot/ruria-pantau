import { fmt, pct } from "@/lib/period";

export function Kpi({ l, v, d, sub, invert }: { l: string; v: string; d?: number; sub?: string; invert?: boolean }) {
  const good = d === undefined ? true : invert ? d <= 0 : d >= 0;
  return (
    <div className="kpi"><div className="kl">{l}</div><div className="kv">{v}</div>
      {d !== undefined && isFinite(d) && <div className={"kd " + (good ? "up" : "dn")}>{d >= 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)}% <span className="muted">{sub}</span></div>}
      {d === undefined && sub && <div className="kd muted">{sub}</div>}
    </div>
  );
}

export function Insight({ sum, ana, next, src }: { sum: string[]; ana: string[]; next: string[]; src: string }) {
  return (
    <details className="ins" open>
      <summary><b>Ringkasan, analisa & langkah berikutnya</b> <span className="muted">{src}</span></summary>
      <div className="insg">
        <div className="insc"><h3>Ringkasan</h3><ul>{sum.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div className="insc"><h3>Analisa</h3><ul>{ana.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div className="insc nx"><h3>Langkah berikutnya</h3><ol>{next.map((x, i) => <li key={i}>{x}</li>)}</ol></div>
      </div>
    </details>
  );
}

export function Bars({ labels, series, colors, title }: { labels: string[]; series: number[][]; colors: string[]; title: string }) {
  const W = 560, H = 180, P = 44, n = labels.length;
  const tot = labels.map((_, i) => series.reduce((a, s) => a + (s[i] || 0), 0));
  const mx = Math.max(1, ...tot) * 1.1, bw = (W - P - 8) / Math.max(1, n), y = (v: number) => H - 22 - (v / mx) * (H - 36);
  const step = Math.max(1, Math.ceil(n / 6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title}>
      {[0, 1, 2, 3].map((k) => { const v = (mx * k) / 3; return <g key={k}><line x1={P} x2={W - 6} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={P - 4} y={y(v) + 3} textAnchor="end">{(v / 1e6).toFixed(v < 3e6 ? 1 : 0)}jt</text></g>; })}
      {labels.map((l, i) => { const x = P + i * bw + bw * 0.15, w = bw * 0.7; let base = H - 22;
        return <g key={i}>{series.map((s, j) => { const h = ((s[i] || 0) / mx) * (H - 36); base -= h; return <rect key={j} x={x} y={base} width={w} height={h} fill={colors[j]} />; })}
          {(i % step === 0 || i === n - 1) && <text x={x + w / 2} y={H - 6} textAnchor="middle">{l}</text>}</g>; })}
    </svg>
  );
}

/* Garis tren: periode ini (tegas) vs periode pembanding (putus-putus) */
export function LineChart({ labels, cur, prev, title }: { labels: string[]; cur: number[]; prev?: number[]; title: string }) {
  const W = 640, H = 210, L = 46, R = 10, T = 12, B = 24, n = labels.length;
  const all = [...cur, ...(prev ?? [])];
  const mx = Math.max(1, ...all) * 1.1;
  const x = (i: number) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v: number) => H - B - (v / mx) * (H - T - B);
  const path = (s: number[]) => s.slice(0, n).map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v || 0).toFixed(1)}`).join("");
  const area = `${path(cur)}L${x(Math.min(n, cur.length) - 1)},${H - B}L${x(0)},${H - B}Z`;
  const step = Math.max(1, Math.ceil(n / 7));
  const yl = (v: number) => (v >= 1e9 ? (v / 1e9).toFixed(1) + "M" : v >= 1e6 ? (v / 1e6).toFixed(v < 1e7 ? 1 : 0) + "jt" : Math.round(v / 1e3) + "rb");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title} className="lc">
      {[0, 1, 2, 3].map((k) => { const v = (mx * k) / 3; return <g key={k}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={L - 6} y={y(v) + 3} textAnchor="end">{yl(v)}</text></g>; })}
      <path d={area} fill="color-mix(in srgb, var(--accent) 14%, transparent)" />
      {prev && prev.length > 0 && <path d={path(prev)} fill="none" stroke="var(--muted)" strokeWidth="1.6" strokeDasharray="5 4" />}
      <path d={path(cur)} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" />
      {cur.slice(0, n).map((v, i) => <circle key={i} cx={x(i)} cy={y(v || 0)} r={n > 40 ? 1.6 : 2.8} fill="var(--accent)"><title>{`${labels[i]}: Rp${Math.round(v || 0).toLocaleString("id")}${prev?.[i] != null ? ` (pembanding Rp${Math.round(prev[i]).toLocaleString("id")})` : ""}`}</title></circle>)}
      {labels.map((l, i) => (i % step === 0 || i === n - 1) && <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{l}</text>)}
    </svg>
  );
}

/* Porsi per item, batang horizontal */
export function Share({ items, color = "var(--accent)" }: { items: { l: string; v: number; note?: string }[]; color?: string }) {
  const tot = items.reduce((a, x) => a + x.v, 0) || 1, mx = Math.max(1, ...items.map((x) => x.v));
  return <div className="share">{items.map((x) => <div className="srow" key={x.l}>
    <span>{x.l}</span><span className="v">{x.note ?? `${fmt(x.v)} · ${((x.v / tot) * 100).toFixed(0)}%`}</span>
    <div className="bar"><i style={{ width: `${(x.v / mx) * 100}%`, background: color }} /></div>
  </div>)}</div>;
}

export const Chg = ({ a, b }: { a: number; b: number }) => { const v = pct(a, b); return <b className={v >= 0 ? "up" : "dn"}>{v >= 0 ? "naik" : "turun"} {Math.abs(v).toFixed(1)}%</b>; };
export { fmt };

/* Grafik tren kecil untuk tabel */
export function Spark({ v }: { v: number[] }) {
  const W = 90, H = 24, n = v.length, mx = Math.max(1, ...v);
  if (n < 2) return null;
  const d = v.map((x, i) => `${i ? "L" : "M"}${((i * W) / (n - 1)).toFixed(1)},${(H - 2 - (x / mx) * (H - 4)).toFixed(1)}`).join("");
  return <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" className="spark"><path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" /></svg>;
}
