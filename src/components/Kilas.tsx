/* Satu jawaban di atas halaman (verdict) + laporan singkat untuk link klien. Semua dihitung otomatis dari data yang sudah ada. */
import { fmt, pct, type Range } from "@/lib/period";
import type { Sale, Ad, Live, Store } from "@/lib/data";

type Tone = "good" | "warn" | "bad";
const rs = (n: number) => n.toFixed(2).replace(".", ",");
const pc = (n: number) => `${n >= 0 ? "naik" : "turun"} ${Math.abs(n).toFixed(1).replace(".", ",")}%`;

function porsi(x: Ad, a: string, b: string) {
  const f = x.dari > a ? x.dari : a, t = x.sampai < b ? x.sampai : b; if (f > t) return 0;
  const d = (s: string, e: string) => Math.round((Date.parse(e) - Date.parse(s)) / 864e5) + 1;
  return d(f, t) / d(x.dari, x.sampai);
}

export type KilasData = ReturnType<typeof hitung>;

export function hitung(R: Range, stores: Store[], sales: Sale[], ads: Ad[], live: Live[]) {
  const cmp = R.key !== "all";
  const nm = new Map(stores.map((s) => [s.id, `${s.platform} · ${s.brand}`]));
  const ids = new Set(stores.filter((s) => s.platform !== "CPAS").map((s) => s.id)), aids = new Set(stores.map((s) => s.id));
  const gm = (a: string, b: string, id?: string) => sales.filter((x) => (id ? x.store_id === id : ids.has(x.store_id)) && x.tanggal >= a && x.tanggal <= b).reduce((t, x) => t + +x.gmv, 0);
  const G = gm(R.from, R.to), Gp = gm(R.pf, R.pt);
  const camp = (a: string, b: string) => { const C = new Map<string, { k: string; id: string; s: number; g: number; o: number }>();
    for (const x of ads) { if (!aids.has(x.store_id)) continue; const w = porsi(x, a, b); if (!w) continue; const key = x.store_id + "|" + x.kampanye; const c = C.get(key) ?? { k: x.kampanye, id: x.store_id, s: 0, g: 0, o: 0 }; c.s += +x.biaya * w; c.g += +x.gmv * w; c.o += +x.pesanan * w; C.set(key, c); }
    return [...C.values()]; };
  const C = camp(R.from, R.to), CP = camp(R.pf, R.pt);
  const S = C.reduce((t, c) => t + c.s, 0), GA = C.reduce((t, c) => t + c.g, 0), Sp = CP.reduce((t, c) => t + c.s, 0), GAp = CP.reduce((t, c) => t + c.g, 0);
  const roas = S ? GA / S : 0, roasP = Sp ? GAp / Sp : 0;
  const nol = C.filter((c) => c.s >= 100_000 && c.o < 0.5), boros = C.filter((c) => !nol.includes(c) && c.s >= S * 0.03 && c.s > 0 && c.g / c.s < roas * 0.6);
  const bad = [...nol, ...boros], badS = bad.reduce((t, c) => t + c.s, 0);
  const best = C.filter((c) => c.s >= Math.max(50_000, S * 0.02) && c.o >= 1).sort((a, b) => b.g / b.s - a.g / a.s).slice(0, 2);
  const per = [...ids].map((id) => ({ id, n: gm(R.from, R.to, id), o: gm(R.pf, R.pt, id) })).filter((x) => x.n || x.o);
  const naik = cmp ? per.filter((x) => x.o >= 1_000_000).sort((a, b) => pct(b.n, b.o) - pct(a.n, a.o)) : [];
  const L = live.filter((x) => x.tanggal >= R.from && x.tanggal <= R.to), Lp = live.filter((x) => x.tanggal >= R.pf && x.tanggal <= R.pt);
  const lg = (xs: Live[]) => xs.reduce((t, x) => t + +x.gmv_shopee + +x.gmv_tiktok, 0);
  return { cmp, nm, G, Gp, S, Sp, roas, roasP, nol, boros, bad, badS, best, naik, L: L.length, LG: lg(L), LGp: lg(Lp), Lp: Lp.length };
}

export function Verdict({ tab, k, R, href }: { tab: string; k: KilasData; R: Range; href: (m: string) => string }) {
  let tone: Tone = "good", title = "", sub = "", link: [string, string] | null = null;
  const dG = k.cmp && k.Gp ? pct(k.G, k.Gp) : null;
  if (tab === "iklan") {
    if (!k.S) return null;
    tone = k.badS > k.S * 0.15 ? "bad" : k.bad.length ? "warn" : "good";
    title = `ROAS ${rs(k.roas)}${k.cmp && k.roasP ? ` (${k.roas >= k.roasP ? "naik" : "turun"} dari ${rs(k.roasP)})` : ""}` + (k.bad.length ? `, ${k.bad.length} iklan perlu dicek.` : ", semua iklan wajar.");
    sub = k.bad.length ? `Biaya ${fmt(k.badS)} di iklan boros / tanpa penjualan${k.bad[0] ? `, terbesar di ${k.nm.get(k.bad[0].id)}` : ""}.` : `Biaya ${fmt(k.S)} · ${R.label.toLowerCase()}.`;
  } else if (tab === "live") {
    if (!k.L) return null;
    const d = k.cmp && k.LGp ? pct(k.LG, k.LGp) : null;
    tone = d == null || d >= 0 ? "good" : d < -20 ? "bad" : "warn";
    title = `GMV live ${fmt(k.LG)} dari ${k.L} sesi${d != null ? `, ${pc(d)} ${R.sub}` : ""}.`;
    sub = `${fmt(k.LG / k.L)} per sesi${k.Lp ? ` (sebelumnya ${fmt(k.LGp / k.Lp)})` : ""}.`;
  } else {
    if (!k.G) return null;
    tone = dG != null && dG < -10 ? "bad" : (dG != null && dG < 0) || k.bad.length ? "warn" : "good";
    title = `GMV ${fmt(k.G)}${dG != null ? `, ${pc(dG)} ${R.sub}` : ""}` + (k.bad.length ? `, tapi ${k.bad.length} iklan boros.` : ".");
    const top = k.naik[0];
    sub = [k.S ? `ROAS iklan ${rs(k.roas)}` : "", top && pct(top.n, top.o) > 0 ? `pertumbuhan terbaik ${k.nm.get(top.id)} (${pc(pct(top.n, top.o))})` : ""].filter(Boolean).join(" · ");
    if (k.bad.length) link = [href("iklan"), `Lihat ${k.bad.length} iklan →`];
  }
  const ic = tone === "good" ? "✅" : tone === "warn" ? "⚠️" : "⛔";
  return <div className={"verdict v-" + tone} role="status"><span className="vic" aria-hidden>{ic}</span><div><b>{title}</b>{sub && <><br /><span className="muted small">{sub}</span></>} {link && <a href={link[0]}>{link[1]}</a>}</div></div>;
}

export function LaporanKlien({ k, R, nama, last, tem: tm, lang: lg, waktu }: { k: KilasData; R: Range; nama: string; last?: string | null; tem?: string | null; lang?: string | null; waktu?: string | null }) {
  if (!k.G && !k.S) return null;
  const dG = k.cmp && k.Gp ? pct(k.G, k.Gp) : null;
  const tem: string[] = [], lang: string[] = [];
  const top = k.naik[0], low = k.naik[k.naik.length - 1];
  if (top && pct(top.n, top.o) > 0) tem.push(`${k.nm.get(top.id)} tumbuh paling cepat (${pc(pct(top.n, top.o))}).`);
  if (k.best[0]) tem.push(`Iklan paling efisien: ${k.best[0].k.slice(0, 60)} (${k.nm.get(k.best[0].id)}), ROAS ${rs(k.best[0].g / k.best[0].s)}.`);
  if (low && low !== top && pct(low.n, low.o) < 0) tem.push(`${k.nm.get(low.id)} melemah (${pc(pct(low.n, low.o))}).`);
  if (k.L) tem.push(`${k.L} sesi live menghasilkan ${fmt(k.LG)}.`);
  if (k.best.length) lang.push(`Tambah budget ${k.best.length} iklan dengan ROAS tertinggi.`);
  if (k.bad.length) lang.push(`Evaluasi ${k.bad.length} iklan boros / tanpa penjualan (${fmt(k.badS)}).`);
  if (low && pct(low.n, low.o) < 0) lang.push(`Cari penyebab penurunan di ${k.nm.get(low.id)} (stok, harga, iklan).`);
  lang.push("Lanjutkan follow-up kreator affiliate prioritas P1–P2.");
  const lines = (x?: string | null) => (x ?? "").split("\n").map((y) => y.replace(/^\s*[-•\d.)]+\s*/, "").trim()).filter(Boolean);
  const manT = lines(tm), manL = lines(lg);
  if (manT.length) tem.splice(0, tem.length, ...manT);
  if (manL.length) lang.splice(0, lang.length, ...manL);
  return <div className="card lapk">
    <div className={"verdict v-" + (dG != null && dG < -10 ? "bad" : dG != null && dG < 0 ? "warn" : "good")}><div><b>{R.label}: GMV {fmt(k.G)}{dG != null ? ` (${dG >= 0 ? "▲" : "▼"} ${Math.abs(dG).toFixed(1).replace(".", ",")}%)` : ""}</b><br />
      <span className="muted small">{nama}{k.S ? ` · ROAS iklan ${rs(k.roas)}` : ""}{last ? ` · data s.d. ${last}` : ""}</span></div></div>
    <div className="lapk2"><div><h3>Temuan</h3><ol>{tem.slice(0, manT.length ? 6 : 3).map((x) => <li key={x}>{x}</li>)}</ol></div>
      <div><h3>Langkah tim Ruria</h3><ol>{lang.slice(0, manL.length ? 6 : 3).map((x) => <li key={x}>{x}</li>)}</ol></div></div>
    <p className="muted small">{manT.length || manL.length ? `Ditulis tim Ruria${waktu ? `, ${waktu}` : ""}.` : "Temuan dan langkah disusun otomatis dari data periode ini."} Detail ada di tab di bawah.</p>
  </div>;
}
