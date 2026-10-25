export const BLNF = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
export const BLN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
export const todayWIB = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const dayDiff = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
export const lastDay = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
export const prevMonth = (ym: string) => { let [y, m] = ym.split("-").map(Number); m--; if (!m) { m = 12; y--; } return `${y}-${String(m).padStart(2, "0")}`; };
export const tgl = (d: string) => `${+d.slice(8)} ${BLN[+d.slice(5, 7) - 1]}`;

export type Range = { from: string; to: string; pf: string; pt: string; label: string; sub: string; key: string };

export function resolvePeriod(key = "yday"): Range {
  const T = todayWIB();
  const mk = (from: string, to: string, pf: string, pt: string, label: string, sub: string): Range => ({ from, to, pf, pt, label, sub, key });
  if (key === "today") return mk(T, T, addDays(T, -7), addDays(T, -7), `Hari ini, ${tgl(T)}`, "vs minggu lalu");
  if (key === "7d") return mk(addDays(T, -7), addDays(T, -1), addDays(T, -14), addDays(T, -8), "7 hari terakhir", "vs 7 hari sebelumnya");
  if (key === "30d") return mk(addDays(T, -30), addDays(T, -1), addDays(T, -60), addDays(T, -31), "30 hari terakhir", "vs 30 hari sebelumnya");
  if (key === "3m") return mk(addDays(T, -91), addDays(T, -1), addDays(T, -182), addDays(T, -92), "3 bulan terakhir", "vs 3 bulan sebelumnya");
  if (key === "6m") return mk(addDays(T, -182), addDays(T, -1), addDays(T, -364), addDays(T, -183), "6 bulan terakhir", "vs 6 bulan sebelumnya");
  // Semua data yang ada (arsip mulai 2025), tanpa periode pembanding
  if (key === "all") return mk("2025-01-01", addDays(T, -1), "2024-01-01", "2024-01-01", "Semua waktu", "tanpa pembanding");
  if (key === "mtd") { const f = T.slice(0, 8) + "01", pm = prevMonth(T.slice(0, 7)); let pt = addDays(pm + "-01", dayDiff(f, T)); if (pt > lastDay(pm)) pt = lastDay(pm); return mk(f, T, pm + "-01", pt, `Bulan ini (${BLNF[+T.slice(5, 7) - 1]})`, "vs periode sama bulan lalu"); }
  let m = key.match(/^month:(\d{4}-\d{2})$/);
  if (m) { const ym = m[1], pm = prevMonth(ym); let to = lastDay(ym); if (to > T) to = T; return mk(ym + "-01", to, pm + "-01", lastDay(pm), `${BLNF[+ym.slice(5) - 1]} ${ym.slice(0, 4)}`, "vs bulan sebelumnya"); }
  m = key.match(/^year:(\d{4})$/);
  if (m) { const y = m[1]; let to = `${y}-12-31`; if (to > T) to = T; const py = String(+y - 1); return mk(`${y}-01-01`, to, `${py}-01-01`, py + to.slice(4), `Tahun ${y}`, "vs periode sama tahun lalu"); }
  m = key.match(/^custom:(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
  if (m) { let [a, b] = [m[1], m[2]]; if (b < a) [a, b] = [b, a]; const n = dayDiff(a, b) + 1; if (n === 1) return mk(a, b, addDays(a, -7), addDays(a, -7), `${tgl(a)} ${a.slice(0, 4)}`, "vs minggu lalu"); return mk(a, b, addDays(a, -n), addDays(a, -1), `${tgl(a)} – ${tgl(b)} ${b.slice(0, 4)}`, `vs ${n} hari sebelumnya`); }
  const y = addDays(T, -1);
  return { ...mk(y, y, addDays(y, -7), addDays(y, -7), `Kemarin, ${tgl(y)}`, "vs minggu lalu"), key: "yday" };
}

export function buckets(from: string, to: string) {
  const span = dayDiff(from, to) + 1;
  if (span < 14) from = addDays(to, -29);
  const n = dayDiff(from, to) + 1;
  if (n <= 62) return Array.from({ length: n }, (_, i) => { const d = addDays(from, i); return { f: d, t: d, l: tgl(d) }; });
  const out: { f: string; t: string; l: string }[] = [];
  let ym = from.slice(0, 7);
  while (ym <= to.slice(0, 7)) {
    let f = ym + "-01", t = lastDay(ym); if (f < from) f = from; if (t > to) t = to;
    out.push({ f, t, l: BLN[+ym.slice(5) - 1] });
    const [y, mo] = ym.split("-").map(Number); ym = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  return out;
}

export const fmt = (n: number) => n >= 1e9 ? `Rp${(n / 1e9).toFixed(2).replace(".", ",")} M` : n >= 1e6 ? `Rp${(n / 1e6).toFixed(1).replace(".", ",")} jt` : `Rp${Math.round(n / 1e3)} rb`;
export const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);
export const jm = (h: number) => { const t = Math.round(h * 60); return `${Math.floor(t / 60)}j ${String(t % 60).padStart(2, "0")}m`; };
