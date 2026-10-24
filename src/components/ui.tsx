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
      <summary><b>Summary, analisa & next action</b> <span className="muted">{src}</span></summary>
      <div className="insg">
        <div className="insc"><h3>Summary</h3><ul>{sum.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div className="insc"><h3>Analisa</h3><ul>{ana.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div className="insc nx"><h3>Next action</h3><ol>{next.map((x, i) => <li key={i}>{x}</li>)}</ol></div>
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

export const Chg = ({ a, b }: { a: number; b: number }) => { const v = pct(a, b); return <b className={v >= 0 ? "up" : "dn"}>{v >= 0 ? "naik" : "turun"} {Math.abs(v).toFixed(1)}%</b>; };
export { fmt };
