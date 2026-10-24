import { isStaff, type User } from "@/lib/auth";
import { q } from "@/lib/db";
import Filters from "@/components/Filters";
import { Tabs, LoadingBar } from "@/components/Nav";
import AutoImport from "@/components/AutoImport";
import Affiliate from "@/components/Affiliate";
import AppShell from "@/components/AppShell";
import ExportBar from "@/components/ExportBar";
import { RuriaWord } from "@/components/Logo";
import { logAct } from "@/lib/log";
import ProdukTable, { type PRow } from "@/components/ProdukTable";
import { Kpi, Insight, Bars, LineChart, Share } from "@/components/ui";
import { clientsFor, loadClient, freshness, produkSku, type Sale, type Ad, type Live, type Store } from "@/lib/data";
import { resolvePeriod, buckets, fmt, pct, jm, tgl, addDays, dayDiff, todayWIB, type Range } from "@/lib/period";

type SPv = Record<string, string | undefined>;
type Cl = { id: string; nama: string; modul: string[]; target_roas: number | null };

const TABS: [string, string][] = [["sum", "Dashboard"], ["toko", "Analisa Toko"], ["iklan", "Analisa Iklan"], ["live", "Livestream"], ["affiliate", "Affiliate"]];

/* Dipakai oleh /dashboard (login) dan /lihat/[token] (klien tanpa login, hanya lihat) */
export default async function DashboardView({ sp, profile, clients: all, base, share, shareLabel, token }: { sp: SPv; profile: User | null; clients: Cl[]; base: string; share?: boolean; shareLabel?: string; token?: string }) {
  // Tampilan klien tanpa login: tanpa tab Semua Klien & Affiliate
  const clients = share ? all.map((x) => ({ ...x, modul: x.modul.filter((m) => m !== "affiliate") })) : all;
  const isAdmin = isStaff(profile);
  const c = clients.find((x) => x.id === sp.c) ?? clients[0];
  let tab = sp.m ?? (sp.c || share ? "toko" : "sum");
  if (share && tab === "sum") tab = "toko";
  if (c && tab !== "sum" && !c.modul.includes(tab)) tab = c.modul[0];
  const R = resolvePeriod(sp.per);
  const qs = (patch: Record<string, string>) => { const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]); for (const [k, v] of Object.entries(patch)) q.set(k, v); return "?" + q.toString(); };

  let body: React.ReactNode = <p className="muted">Belum ada klien yang bisa diakses akun ini. Minta admin menambahkan akses.</p>;
  let brands: string[] = [], platforms: string[] = [];
  if (c) {
    const from = R.pf < R.from ? R.pf : R.from;
    const D = await loadClient(c.id, from, R.to);
    brands = [...new Set(D.stores.map((s) => s.brand))];
    platforms = [...new Set(D.stores.map((s) => s.platform))].filter((p) => p !== "CPAS" || tab === "iklan");
    const st = D.stores.filter((s) => (!sp.b || s.brand === sp.b) && (!sp.p || s.platform === sp.p));
    if (tab === "sum") body = await SumTab(R, clients, (id) => base + qs({ c: id, m: "toko", b: "", p: "" }));
    else if (tab === "toko") {
      const ts = st.filter((s) => s.platform !== "CPAS");
      let prod: Prod[] = [], prodErr: string | undefined;
      try { prod = await produkSku(ts.map((s) => s.id), R.from, R.to, R.pf, R.pt); } catch (e) { prodErr = (e as Error).message; }
      body = <><TokoTab R={R} stores={ts} sales={D.sales} /><ProdukSection R={R} rows={prod} stores={ts} err={prodErr} /></>;
    }
    else if (tab === "iklan") body = <IklanTab R={R} stores={st} ads={D.ads} sales={D.sales} target={c.target_roas} />;
    else if (tab === "affiliate") {
      const has = (await q<{ n: number }>("select count(*) n from aff_files where client_id = ?", [c.id]))[0].n > 0;
      body = has ? <Affiliate key={c.id} client={c.id} user={"u" + profile!.id} />
        : <div className="card"><h2>Affiliate · {c.nama}</h2><p className="muted">Ruang kerja affiliate untuk klien ini belum disiapkan. Kirim ke Claude ekspor data affiliate (TikTok: Affiliate → Kreator / Performa; Shopee: Affiliate Marketing Solution → Laporan kreator) untuk periode yang ingin dipantau, nanti disiapkan seperti ruang kerja Just Fluff.</p></div>;
    }
    else if (tab === "live") {
      const jad = await q<Jd>("select date_format(l.tanggal, '%Y-%m-%d') tanggal, l.mulai, l.selesai, h.nama host from live_schedule l join hosts h on h.id = l.host_id where l.client_id = ? and l.tanggal between ? and ?", [c.id, R.from, R.to]);
      body = <LiveTab R={R} live={D.live} brand={sp.b} plat={sp.p} jadwal={jad} />;
    }
  }

  const tabName = TABS.find(([k]) => k === tab)?.[1] ?? tab;
  await logAct(profile, "lihat", tab === "sum" ? null : c?.id ?? null, `${tabName} · ${R.label}${sp.b ? ` · ${sp.b}` : ""}${sp.p ? ` · ${sp.p}` : ""}`, share ? `Link klien${shareLabel ? ` (${shareLabel})` : ""}` : undefined);
  const title = `${tab === "sum" ? "Dashboard semua klien" : c?.nama ?? ""} · ${tabName} · ${R.label}`;
  const tabs = <Tabs active={tab} items={TABS.filter(([k]) => k !== "sum" && c?.modul.includes(k)).map(([k, l]) => ({ k, l, href: base + qs({ m: k }) }))} />;
  const head = (
    <header className="dh">
      <div className="wrap top ctitle">
        {share ? <><span className="brandc"><RuriaWord height={20} /></span><b>Report</b><span className="muted">{c?.nama} · tampilan klien, hanya lihat</span></>
          : <h1>{tab === "sum" ? "Dashboard" : c?.nama}</h1>}
      </div>
      <div className="wrap fbar"><Filters base={base} clients={share ? [] : clients} hideClient brands={tab === "sum" ? [] : brands} platforms={tab === "sum" ? [] : platforms} label={R.label} />{tab !== "affiliate" && <ExportBar title={title} client={tab === "sum" ? null : c?.id ?? null} token={token} />}</div>
      {tab !== "sum" && tabs}
    </header>
  );
  const main = <main className="wrap dv">{isAdmin && <AutoImport />}{body}</main>;
  if (share || !profile) return <><LoadingBar />{head}{main}</>;
  return <AppShell user={profile} active={tab === "sum" ? undefined : c?.id} keep={{ m: tab, per: sp.per }}>{head}{main}</AppShell>;
}

/* ---------------- Semua klien ---------------- */
async function SumTab(R: Range, clients: { id: string; nama: string; modul: string[] }[], href: (id: string) => string) {
  const F = await freshness(clients.map((c) => c.id));
  const yday = addDays(todayWIB(), -1);
  const badge = (d: string | null | undefined) => { if (!d) return <span className="pill mute">Belum ada data</span>; const lag = dayDiff(d, yday); return lag <= 0 ? <span className="pill good">Aman</span> : lag <= 3 ? <span className="pill warn">Kurang {lag} hari</span> : <span className="pill bad">Tertinggal {lag} hari</span>; };
  const cell = (on: boolean, d: string | null | undefined) => on ? <><td>{d ? `${tgl(d)} ${d.slice(0, 4)}` : "–"}</td><td>{badge(d)}</td></> : <><td>–</td><td><span className="pill mute">Tidak dipantau</span></td></>;
  const rows = await Promise.all(clients.filter((c) => c.modul.includes("toko")).map(async (c) => {
    const D = await loadClient(c.id, R.pf < R.from ? R.pf : R.from, R.to);
    const g = (a: string, b: string) => D.sales.filter((s) => s.tanggal >= a && s.tanggal <= b).reduce((x, s) => x + s.gmv, 0);
    const ord = D.sales.filter((s) => s.tanggal >= R.from && s.tanggal <= R.to).reduce((x, s) => x + s.pesanan, 0);
    const ad = D.ads.filter((a) => a.dari <= R.to && a.sampai >= R.from), biaya = ad.reduce((x, a) => x + a.biaya, 0), ag = ad.reduce((x, a) => x + a.gmv, 0);
    return { c, n: g(R.from, R.to), o: g(R.pf, R.pt), ord, roas: biaya ? ag / biaya : null };
  }));
  rows.sort((a, b) => b.n - a.n);
  const tot = rows.reduce((a, r) => a + r.n, 0) || 1;
  const up = [...rows].sort((a, b) => pct(b.n, b.o) - pct(a.n, a.o))[0], dn = [...rows].sort((a, b) => pct(a.n, a.o) - pct(b.n, b.o))[0];
  return (<>
    {rows.length > 0 && <Insight src="Data asli" sum={[`Total GMV klien ${fmt(tot)} (${R.label.toLowerCase()}).`, `Klien terbesar: ${rows[0].c.nama} (${(rows[0].n / tot * 100).toFixed(0)}%).`]}
      ana={[`Pertumbuhan terbaik: ${up.c.nama} (${pct(up.n, up.o).toFixed(1)}%).`, `Paling melemah: ${dn.c.nama} (${pct(dn.n, dn.o).toFixed(1)}%).`]}
      next={[`Review ${dn.c.nama} lebih dulu.`, "Pastikan data semua klien sudah masuk sampai kemarin (lihat Status data)."]} />}
    <div className="ccards">{rows.map((r) => { const v = pct(r.n, r.o); const f = F.find((x) => x.client_id === r.c.id);
      return <a key={r.c.id} className="ccard" href={href(r.c.id)}>
        <div className="top"><h3>{r.c.nama}</h3>{badge(f?.penjualan)}</div>
        <div className="cm"><div><span>GMV</span><b>{fmt(r.n)}</b></div><div><span>Perubahan</span><b className={v >= 0 ? "up" : "dn"}>{isFinite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "–"}</b></div><div><span>ROAS iklan</span><b>{r.roas != null ? r.roas.toFixed(1) : "–"}</b></div></div>
        <div className="muted small">{r.ord.toLocaleString("id")} pesanan · data terakhir {f?.penjualan ? `${tgl(f.penjualan)} ${f.penjualan.slice(0, 4)}` : "–"}</div>
      </a>; })}</div>
    <div className="card"><h2>Status data terakhir</h2><p className="muted small">Aman kalau data sudah masuk sampai kemarin ({tgl(yday)} {yday.slice(0, 4)}).</p>
      <div className="tbl"><table><thead><tr><th>Klien</th><th>Penjualan</th><th></th><th>Iklan</th><th></th><th>Livestream</th><th></th></tr></thead>
        <tbody>{clients.map((c) => { const f = F.find((x) => x.client_id === c.id); return <tr key={c.id}><td>{c.nama}</td>{cell(c.modul.includes("toko"), f?.penjualan)}{cell(c.modul.includes("iklan"), f?.iklan)}{cell(c.modul.includes("live"), f?.live)}</tr>; })}</tbody></table></div></div>
    <div className="card"><h2>GMV per klien · {R.label}</h2><div className="tbl"><table><thead><tr><th>Klien</th><th className="n">GMV</th><th className="n">{R.sub}</th></tr></thead>
      <tbody>{rows.map((r) => { const v = pct(r.n, r.o); return <tr key={r.c.id}><td>{r.c.nama}</td><td className="n">{fmt(r.n)}</td><td className={"n " + (v >= 0 ? "up" : "dn")}>{v >= 0 ? "+" : ""}{v.toFixed(1)}%</td></tr>; })}</tbody></table></div></div>
  </>);
}

/* ---------------- Toko ---------------- */
function TokoTab({ R, stores, sales }: { R: Range; stores: Store[]; sales: Sale[] }) {
  const ids = new Set(stores.map((s) => s.id));
  const S = sales.filter((s) => ids.has(s.store_id));
  const agg = (a: string, b: string, only?: string) => { const r = { g: 0, o: 0, v: 0, vok: true }; S.filter((s) => s.tanggal >= a && s.tanggal <= b && (!only || s.store_id === only)).forEach((s) => { r.g += s.gmv; r.o += s.pesanan; if (s.pengunjung == null) r.vok = false; else r.v += s.pengunjung; }); return r; };
  const n = agg(R.from, R.to), o = agg(R.pf, R.pt);
  if (!stores.length) return <p className="muted">Tidak ada toko untuk pilihan ini.</p>;
  const aov = n.o ? n.g / n.o : 0, aovP = o.o ? o.g / o.o : 0, cr = n.vok && n.v ? (n.o / n.v) * 100 : NaN, crP = o.vok && o.v ? (o.o / o.v) * 100 : NaN;
  const per = stores.map((s) => { const a = agg(R.from, R.to, s.id), b = agg(R.pf, R.pt, s.id); return { s, g: a.g, o: a.o, ch: pct(a.g, b.g) }; }).sort((a, b) => b.g - a.g);
  const B = buckets(R.from, R.to);
  const vals = B.map((b) => agg(b.f, b.t).g);
  // Garis pembanding hanya kalau periode sendiri cukup panjang (tidak diperluas ke 30 hari)
  const PB = dayDiff(R.from, R.to) >= 13 ? buckets(R.pf, R.pt) : null;
  const prevVals = PB ? PB.map((b) => agg(b.f, b.t).g) : undefined;
  const last = S.reduce((m, s) => (s.tanggal > m ? s.tanggal : m), "");
  const worst = [...per].sort((a, b) => a.ch - b.ch)[0], best = [...per].sort((a, b) => b.ch - a.ch)[0];
  const dA = pct(aov, aovP), dC = pct(cr, crP);
  const ana = [isFinite(dC) && Math.abs(dC) > Math.abs(dA) ? `Perubahan GMV lebih didorong konversi (${dC.toFixed(1)}%) daripada AOV (${dA.toFixed(1)}%).` : `Perubahan GMV lebih didorong AOV (${dA.toFixed(1)}%)${isFinite(dC) ? ` daripada konversi (${dC.toFixed(1)}%)` : ""}.`];
  if (per.length > 1 && worst.ch < -5) ana.push(`${worst.s.brand} · ${worst.s.platform} paling melemah (${worst.ch.toFixed(1)}%).`);
  if (per.length > 1 && best.ch > 5) ana.push(`${best.s.brand} · ${best.s.platform} paling tumbuh (+${best.ch.toFixed(1)}%).`);
  const next: string[] = [];
  if (per.length > 1 && worst.ch < -5) next.push(`Cek ${worst.s.brand} · ${worst.s.platform}: listing, stok varian laris, harga, status iklan.`);
  if (dA < -3) next.push("AOV turun: dorong bundling atau voucher minimum belanja.");
  if (isFinite(dC) && dC < -3) next.push("Konversi turun: cek harga vs kompetitor, voucher, dan ulasan produk utama.");
  next.push("Pastikan stok produk andalan aman untuk 14 hari ke depan.");
  return (<>
    <p className="note">Periode: {R.label}. {last ? `Data terakhir ${tgl(last)} ${last.slice(0, 4)}.` : "Belum ada data penjualan di periode ini."}</p>
    <Insight src="Data asli" sum={[`GMV ${fmt(n.g)}, ${pct(n.g, o.g) >= 0 ? "naik" : "turun"} ${Math.abs(pct(n.g, o.g)).toFixed(1)}% ${R.sub}.`, `${n.o.toLocaleString("id")} pesanan, AOV ${fmt(aov)}.`, ...(per.length > 1 ? [`Kontributor terbesar: ${per[0].s.brand} · ${per[0].s.platform} (${(per[0].g / (n.g || 1) * 100).toFixed(0)}%).`] : [])]} ana={ana} next={next} />
    <div className="kpis"><Kpi l="GMV" v={fmt(n.g)} d={pct(n.g, o.g)} sub={R.sub} /><Kpi l="Pesanan" v={n.o.toLocaleString("id")} d={pct(n.o, o.o)} sub={R.sub} /><Kpi l="AOV" v={fmt(aov)} d={dA} sub={R.sub} /><Kpi l="Konversi" v={isFinite(cr) ? cr.toFixed(2) + "%" : "–"} d={isFinite(dC) ? dC : undefined} sub={isFinite(cr) ? R.sub : "butuh data pengunjung semua toko"} /></div>
    <div className="card"><h2>Tren GMV {B[0].f === B[0].t ? "harian" : "bulanan"}</h2>
      <LineChart title="Tren GMV" labels={B.map((b) => b.l)} cur={vals} prev={prevVals} />
      <div className="chart-legend"><span><i />Periode ini</span>{prevVals && <span><i className="prev" />Periode pembanding ({R.sub.replace(/^vs /, "")})</span>}</div></div>
    {per.length > 1 && <div className="grid2c">
      <div className="card"><h2>Porsi GMV per toko</h2><Share items={per.map((r) => ({ l: `${r.s.brand} · ${r.s.platform}`, v: r.g }))} /></div>
      <div className="card"><h2>Porsi per platform</h2>{(() => { const P = ["Shopee", "TikTok"].map((pf) => ({ l: pf, v: per.filter((r) => r.s.platform === pf).reduce((a, r) => a + r.g, 0) })).filter((x) => x.v > 0); const t = P.reduce((a, x) => a + x.v, 0) || 1;
        return <><div className="pfsplit">{P.map((x) => <i key={x.l} style={{ width: `${(x.v / t) * 100}%`, background: x.l === "Shopee" ? "var(--accent)" : "var(--aqua)" }} />)}</div>
          <Share items={P.map((x) => ({ l: x.l, v: x.v }))} /></>; })()}</div>
    </div>}
    <div className="card"><h2>Per toko</h2><div className="tbl"><table><thead><tr><th>Toko</th><th className="n">GMV</th><th className="n">Pesanan</th><th className="n">Δ</th><th>Status</th></tr></thead>
      <tbody>{per.map((r) => <tr key={r.s.id}><td>{r.s.brand} · {r.s.platform}</td><td className="n">{fmt(r.g)}</td><td className="n">{r.o.toLocaleString("id")}</td><td className={"n " + (r.ch >= 0 ? "up" : "dn")}>{r.ch >= 0 ? "+" : ""}{r.ch.toFixed(1)}%</td><td>{r.ch < -25 ? <span className="pill bad">Turun tajam</span> : r.ch < -5 ? <span className="pill warn">Turun</span> : <span className="pill good">Stabil/naik</span>}</td></tr>)}</tbody></table></div></div>
  </>);
}

/* ---------------- Iklan ---------------- */
function IklanTab({ R, stores, ads, sales, target }: { R: Range; stores: Store[]; ads: Ad[]; sales: Sale[]; target: number | null }) {
  const ids = new Set(stores.map((s) => s.id)); const name = (id: string) => { const s = stores.find((x) => x.id === id)!; return `${s.brand} · ${s.platform}`; };
  const A = ads.filter((a) => ids.has(a.store_id) && a.dari <= R.to && a.sampai >= R.from);
  if (!A.length) return <p className="note">Belum ada data iklan untuk {R.label.toLowerCase()} pada pilihan ini. Data iklan bulanan hanya muncul kalau periodenya mencakup bulan itu.</p>;
  const C: Record<string, { c: string; s: number; g: number; o: number }> = {};
  A.forEach((a) => { const k = name(a.store_id) + " · " + a.kampanye; const x = (C[k] ??= { c: k, s: 0, g: 0, o: 0 }); x.s += a.biaya; x.g += a.gmv; x.o += a.pesanan; });
  const camps = Object.values(C).sort((a, b) => b.s - a.s).map((c) => ({ ...c, r: c.s ? c.g / c.s : 0 }));
  const S = camps.reduce((a, c) => a + c.s, 0), G = camps.reduce((a, c) => a + c.g, 0), roas = S ? G / S : 0;
  const om = sales.filter((s) => ids.has(s.store_id) && s.tanggal >= R.from && s.tanggal <= R.to).reduce((a, s) => a + s.gmv, 0);
  const t = target ?? 0, below = t ? camps.filter((c) => c.r < t - 2) : [], ok = t ? camps.filter((c) => c.r >= t - 2) : [];
  const per = [...new Set(A.map((a) => `${tgl(a.dari)}–${tgl(a.sampai)}`))];
  return (<>
    <p className="note">Data iklan asli. Laporan bulanan dihitung utuh kalau bulannya masuk periode. Periode file: {per.length > 4 ? `${per[0]} … ${per[per.length - 1]}` : per.join(", ")}.</p>
    <Insight src="Data asli" sum={[`Biaya iklan ${fmt(S)}${om ? ` (${(S / om * 100).toFixed(1)}% dari omzet toko)` : ""}.`, `ROAS ${roas.toFixed(1)}${t ? ` vs target ${t}; ${ok.length} dari ${camps.length} kampanye tercapai` : ""}.`]}
      ana={[t ? (roas < t - 2 ? `ROAS keseluruhan ${(t - roas).toFixed(1)} poin di bawah target.` : "ROAS keseluruhan dalam toleransi target.") : "Target ROAS klien belum diatur.", ...below.slice(0, 4).map((c) => `${c.c}: ROAS ${c.r.toFixed(1)}, menyerap ${fmt(c.s)}.`)]}
      next={[...below.slice(0, 3).map((c) => `${c.c}: turunkan target ROAS bertahap atau pangkas budget; evaluasi setelah 3 hari.`), ...(ok.length ? [`Naikkan budget kampanye yang tercapai sekitar 20–50% kalau stabil 3 hari.`] : []), "Pastikan produk tidak dobel di iklan otomatis dan iklan produk."]} />
    <div className="kpis"><Kpi l="Biaya iklan" v={fmt(S)} /><Kpi l="GMV dari iklan" v={fmt(G)} /><Kpi l="ROAS" v={roas.toFixed(1)} sub={t ? `target ${t}` : undefined} />{om > 0 && <Kpi l="Biaya iklan / omzet" v={(S / om * 100).toFixed(1) + "%"} />}</div>
    <div className="card"><h2>ROAS per kampanye <span className="muted small">(10 biaya terbesar{t ? `, target ${t}` : ""})</span></h2>
      <Share items={camps.slice(0, 10).map((c) => ({ l: c.c, v: c.r, note: `ROAS ${c.r.toFixed(1)} · biaya ${fmt(c.s)}` }))} />
      {t > 0 && <p className="muted small">Batang lebih panjang = ROAS lebih tinggi. Kampanye di bawah target {t} ditandai di tabel.</p>}</div>
    <div className="card"><h2>Kampanye</h2><div className="tbl"><table><thead><tr><th>Kampanye</th><th className="n">Biaya</th><th className="n">GMV</th><th className="n">Pesanan</th><th className="n">ROAS</th><th>Status</th></tr></thead>
      <tbody>{camps.slice(0, 200).map((c) => <tr key={c.c}><td className="wrapcell">{c.c}</td><td className="n">{fmt(c.s)}</td><td className="n">{fmt(c.g)}</td><td className="n">{c.o || "–"}</td><td className="n">{c.r.toFixed(1)}</td><td>{!t ? "–" : c.r >= t - 2 ? <span className="pill good">Tercapai</span> : c.r >= t - 5 ? <span className="pill warn">Di bawah</span> : <span className="pill bad">Jauh di bawah</span>}</td></tr>)}</tbody></table></div></div>
  </>);
}

/* ---------------- Livestream ---------------- */
const SLOTS: [number, number, string, string][] = [[0, 6, "00–06", "Dini hari"], [6, 12, "06–12", "Pagi"], [12, 18, "12–18", "Siang–sore"], [18, 24.5, "18–24", "Malam"]];
type Jd = { tanggal: string; mulai: string; selesai: string; host: string };
const hh = (t: string) => +t.slice(0, 2) + +t.slice(3) / 60;
/* Jadwal vs realisasi: jam terjadwal vs jam live, dan jadwal yang tidak ada sesi live-nya */
function JadwalVsLive({ jadwal, live }: { jadwal: Jd[]; live: Live[] }) {
  if (!jadwal.length) return <p className="note">Belum ada jadwal host untuk periode ini. Atur di menu <a href="/dashboard/jadwal">Jadwal live</a> untuk membandingkan jadwal dengan realisasi.</p>;
  const k = (x: string | null) => (x ?? "").trim().toLowerCase();
  const M = new Map<string, { nama: string; j: number; n: number; miss: number; r: number }>();
  const used = new Set<Live>();
  for (const s of jadwal) {
    const a = hh(s.mulai); let b = hh(s.selesai); if (b <= a) b += 24;
    const x = M.get(k(s.host)) ?? { nama: s.host, j: 0, n: 0, miss: 0, r: 0 }; x.j += b - a; x.n++;
    // Sesi live host yang sama, mulai antara 1 jam sebelum jadwal sampai jadwal selesai
    const hit = live.filter((l) => !used.has(l) && k(l.host) === k(s.host) && ((l.tanggal === s.tanggal && l.jam_mulai >= a - 1 && l.jam_mulai < b) || (b > 24 && l.tanggal === addDays(s.tanggal, 1) && l.jam_mulai < b - 24)));
    if (!hit.length) x.miss++;
    hit.forEach((l) => { used.add(l); x.r += l.durasi_jam; });
    M.set(k(s.host), x);
  }
  const rows = [...M.values()].sort((a, b) => b.j - a.j);
  const tanpa = live.filter((l) => !used.has(l));
  return <div className="card"><h2>Jadwal vs realisasi</h2><div className="tbl"><table><thead><tr><th>Host</th><th className="n">Jadwal</th><th className="n">Jam terjadwal</th><th className="n">Jam live sesuai jadwal</th><th className="n">Realisasi</th><th className="n">Jadwal tanpa live</th></tr></thead>
    <tbody>{rows.map((x) => { const p = x.j ? (x.r / x.j) * 100 : 0; return <tr key={x.nama}><td>{x.nama}</td><td className="n">{x.n}</td><td className="n">{jm(x.j)}</td><td className="n">{jm(x.r)}</td>
      <td className="n"><span className={"pill " + (p >= 90 ? "good" : p >= 70 ? "warn" : "bad")}>{p.toFixed(0)}%</span></td><td className={"n" + (x.miss ? " dn" : "")}>{x.miss || "–"}</td></tr>; })}</tbody></table></div>
    <p className="muted small">Jam live dihitung dari sesi di laporan live dengan nama host yang sama, yang mulai paling cepat 1 jam sebelum jadwal sampai jadwal selesai.
      {tanpa.length ? ` Ada ${tanpa.length} sesi live (${jm(tanpa.reduce((a, l) => a + l.durasi_jam, 0))}) di luar jadwal: ${[...new Set(tanpa.map((l) => l.host || "tanpa nama"))].join(", ")}.` : ""}</p></div>;
}

function LiveTab({ R, live, brand, plat, jadwal }: { R: Range; live: Live[]; brand?: string; plat?: string; jadwal: Jd[] }) {
  const gf = (x: Live) => plat === "Shopee" ? x.gmv_shopee : plat === "TikTok" ? x.gmv_tiktok : x.gmv_shopee + x.gmv_tiktok;
  const L = live.filter((x) => !brand || x.brand === brand);
  const agg = (xs: Live[]) => { const a = { g: 0, j: 0, n: 0, z: 0, gs: 0, gt: 0 }; xs.forEach((x) => { const g = gf(x); a.g += g; a.gs += x.gmv_shopee; a.gt += x.gmv_tiktok; a.j += x.durasi_jam; a.n++; if (g === 0 && x.durasi_jam >= 1) a.z++; }); return a; };
  const cur = L.filter((x) => x.tanggal >= R.from && x.tanggal <= R.to), prev = L.filter((x) => x.tanggal >= R.pf && x.tanggal <= R.pt);
  if (!cur.length) return <p className="note">Tidak ada sesi live di {R.label.toLowerCase()}{brand ? ` untuk ${brand}` : ""}. Coba periode lain, misalnya Per bulan.</p>;
  const a = agg(cur), b = agg(prev), gj = a.j ? a.g / a.j : 0, gjp = b.j ? b.g / b.j : 0, zr = a.n ? (a.z / a.n) * 100 : 0;
  const H: Record<string, Live[]> = {}; cur.forEach((x) => (H[x.host || "Tanpa nama"] ??= []).push(x));
  const hs = Object.entries(H).map(([k, v]) => ({ k, s: agg(v), v })).filter((h) => h.s.j >= 1).sort((x, y) => y.s.g - x.s.g);
  const slot = (xs: Live[], i: number) => agg(xs.filter((x) => x.jam_mulai >= SLOTS[i][0] && x.jam_mulai < SLOTS[i][1]));
  const sr = SLOTS.map((_, i) => { const s = slot(cur, i); return { i, s, g: s.j ? s.g / s.j : 0 }; }).filter((x) => x.s.j >= 1).sort((x, y) => y.g - x.g);
  const cells = hs.map((h) => SLOTS.map((_, i) => { const v = slot(h.v, i); return { v, g: v.j >= 0.5 ? v.g / v.j : null }; }));
  const mx = Math.max(1, ...cells.flat().map((c) => c.g ?? 0));
  const effi = [...hs].sort((x, y) => y.s.g / y.s.j - x.s.g / x.s.j);
  const B = buckets(R.from, R.to);
  const ser = (k: "gmv_shopee" | "gmv_tiktok") => B.map((bk) => L.filter((x) => x.tanggal >= bk.f && x.tanggal <= bk.t).reduce((s, x) => s + (plat && (k === "gmv_shopee" ? plat !== "Shopee" : plat !== "TikTok") ? 0 : x[k]), 0));
  const fk = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " jt" : Math.round(n / 1e3) + " rb");
  const best = sr[0], worst = sr[sr.length - 1];
  return (<>
    <p className="note">Periode: {R.label}. Durasi dihitung sekali per sesi walau live di Shopee dan TikTok bersamaan.</p>
    <Insight src="Data asli" sum={[`GMV live ${fmt(a.g)} dari ${a.n} sesi (${jm(a.j)}), ${pct(a.g, b.g) >= 0 ? "naik" : "turun"} ${Math.abs(pct(a.g, b.g)).toFixed(1)}% ${R.sub}.`, `Rata-rata ${fmt(gj)} per jam.`, `Shopee ${fmt(a.gs)} · TikTok ${fmt(a.gt)}.`]}
      ana={[...(best && worst && best !== worst ? [`Slot ${SLOTS[best.i][2]} paling produktif (${fmt(best.g)}/jam), slot ${SLOTS[worst.i][2]} paling lemah (${fmt(worst.g)}/jam).`] : []), ...(effi.length > 1 ? [`GMV/jam tertinggi: ${effi[0].k} (${fmt(effi[0].s.g / effi[0].s.j)}); terendah: ${effi[effi.length - 1].k}.`] : []), ...(zr > 15 ? [`${zr.toFixed(0)}% sesi ≥1 jam berakhir Rp0.`] : [])]}
      next={[...(best && worst && best !== worst ? [`Geser jam dari slot ${SLOTS[worst.i][2]} ke ${SLOTS[best.i][2]}, atau coba promo khusus di slot ${SLOTS[worst.i][2]}.`] : []), ...(effi.length > 1 ? [`Tempatkan ${effi[0].k} di slot terbaik; dampingi ${effi[effi.length - 1].k} dengan review rekaman dan skrip penawaran.`] : []), "Cek sesi Rp0: produk yang dipajang, voucher live, dan jam tayang."]} />
    <div className="kpis"><Kpi l="GMV live" v={fmt(a.g)} d={pct(a.g, b.g)} sub={R.sub} /><Kpi l="Durasi live" v={jm(a.j)} d={pct(a.j, b.j)} sub={`${a.n} sesi`} /><Kpi l="GMV per jam" v={fmt(gj)} d={pct(gj, gjp)} sub={R.sub} /><Kpi l="Sesi tanpa penjualan" v={zr.toFixed(0) + "%"} sub="sesi ≥1 jam" /></div>
    <JadwalVsLive jadwal={jadwal} live={cur} />
    <h2>Ringkasan per host</h2>
    <div className="hcs">{hs.slice(0, 8).map((h) => <div className="hc" key={h.k}><h3>{h.k}</h3><div className="hl">GMV</div><div className="hv">{fmt(h.s.g)}</div><div className="hl">Durasi</div><div className="hv">{jm(h.s.j)}</div><div className="hl">GMV/jam</div><div className="hv">{fmt(h.s.g / h.s.j)}</div><div className="hb">{h === hs[0] ? "GMV terbesar" : h.k === effi[0]?.k ? "Paling efisien" : ""}</div></div>)}</div>
    <div className="card"><h2>GMV/jam per sesi</h2><div className="tbl"><div className="hm">
      <div />{SLOTS.map((s) => <div key={s[2]} className="hmh"><b>{s[2]}</b><span>{s[3]}</span></div>)}
      {hs.slice(0, 10).map((h, i) => [<div key={h.k} className="hmn">{h.k}</div>, ...cells[i].map((c, j) => c.g === null ? <div key={j} className="hmc none">Tidak live</div> : <div key={j} className={"hmc l" + Math.min(4, Math.floor((c.g / mx) * 5))}><b>{fk(c.g)}</b><span>Rp{fk(c.v.g)} · {jm(c.v.j)}</span></div>)])}
    </div></div><p className="muted small">Angka besar = GMV per jam. Baris kecil = total GMV · durasi. Dikelompokkan menurut jam mulai live.</p></div>
    <div className="card"><h2>GMV live per {B[0].f === B[0].t ? "hari" : "bulan"}</h2><Bars title="GMV live" labels={B.map((x) => x.l)} series={[ser("gmv_shopee"), ser("gmv_tiktok")]} colors={["var(--accent)", "var(--aqua)"]} /><p className="muted small"><span style={{ color: "var(--accent)" }}>■</span> Shopee <span style={{ color: "var(--aqua)" }}>■</span> TikTok</p></div>
  </>);
}

/* ---------------- Analisa produk ---------------- */
type Prod = { grup: string; nama: string; kode: string[] | null; gmv: number; qty: number; pesanan: number; gmv_prev: number; qty_prev: number; toko: string[] | null; varian: PRow["varian"] };
function ProdukSection({ R, rows, stores, err }: { R: Range; rows: Prod[]; stores: Store[]; err?: string }) {
  if (err) return <div className="card"><h2>Analisa produk</h2><p className="err">Data produk gagal dimuat: {err}</p></div>;
  if (!rows.length) return (
    <div className="card"><h2>Analisa produk</h2><p className="muted">Belum ada data penjualan per produk untuk pilihan ini. Data produk berasal dari ekspor pesanan (Shopee &quot;Pesanan Saya → Ekspor&quot;, TikTok &quot;Pesanan → Ekspor&quot;).</p></div>);
  const tokoName: Record<string, string> = Object.fromEntries(stores.map((s) => [s.id, `${s.brand} ${s.platform === "TikTok" ? "TT" : s.platform === "Shopee" ? "SP" : s.platform}`]));
  const P = rows.map((r) => ({ ...r, gmv: +r.gmv, gmv_prev: +r.gmv_prev, qty: +r.qty, qty_prev: +r.qty_prev }));
  const tot = P.reduce((a, r) => a + r.gmv, 0) || 1;
  let cum = 0;
  const st: PRow[] = P.map((r) => { cum += r.gmv; const ch = pct(r.gmv, r.gmv_prev);
    const status = r.gmv === 0 && r.qty_prev >= 10 ? "stop" : r.gmv_prev === 0 && r.gmv > 0 ? "baru" : cum - r.gmv < tot * 0.8 && r.gmv > 0 ? "andalan" : ch <= -30 && r.gmv_prev > tot * 0.005 ? "turun" : ch >= 30 && r.gmv > tot * 0.005 ? "naik" : "biasa";
    return { grup: r.grup, nama: r.nama ?? r.grup, kode: r.kode, gmv: r.gmv, qty: r.qty, ch, prev: r.gmv_prev, share: (r.gmv / tot) * 100, status, tokoLabel: (r.toko ?? []).map((t) => tokoName[t] ?? t).join(", "), varian: r.varian }; });
  const name = (r: PRow) => { const c = r.kode?.[0] ?? (r.grup.startsWith("NAMA:") ? "" : r.grup); const n = c ? `${c} (${r.nama})` : r.nama; return n.length > 70 ? n.slice(0, 68) + "…" : n; };
  const sold = st.filter((r) => r.gmv > 0), andalan = st.filter((r) => r.status === "andalan"), stop = st.filter((r) => r.status === "stop");
  const turun = st.filter((r) => r.status === "turun").sort((a, b) => a.gmv - a.prev - (b.gmv - b.prev)), naik = st.filter((r) => r.status === "naik").sort((a, b) => b.gmv - b.prev - (a.gmv - a.prev)), baru = st.filter((r) => r.status === "baru");
  const top5 = sold.slice(0, 5).reduce((a, r) => a + r.share, 0);
  const multi = sold.filter((r) => (r.tokoLabel.match(/,/g)?.length ?? 0) >= 1).length;
  return (<>
    <h2 style={{ margin: "8px 0 0" }}>Analisa produk per SKU</h2>
    <Insight src="Data asli, dari ekspor pesanan"
      sum={[`${sold.length} SKU induk terjual ${R.label.toLowerCase()}; ${andalan.length} SKU andalan menyumbang 80% GMV.`, `5 SKU teratas = ${top5.toFixed(0)}% GMV. Terlaris: ${sold[0] ? name(sold[0]) : "-"} (${sold[0] ? sold[0].share.toFixed(0) : 0}%).`, `${multi} SKU dijual di lebih dari satu toko.`]}
      ana={[...(top5 > 60 ? ["Ketergantungan pada sedikit SKU tinggi; kalau satu SKU andalan kosong stok, GMV langsung terpukul."] : []),
        ...turun.slice(0, 2).map((r) => `${name(r)} turun ${Math.abs(r.ch).toFixed(0)}% (${fmt(r.prev)} → ${fmt(r.gmv)}).`),
        ...naik.slice(0, 2).map((r) => `${name(r)} naik ${r.ch.toFixed(0)}% (${fmt(r.prev)} → ${fmt(r.gmv)}).`),
        ...(stop.length ? [`${stop.length} SKU yang laku ≥10 unit di periode pembanding tidak terjual sama sekali sekarang.`] : [])]}
      next={[...(stop.length ? [`Cek stok dan listing: ${stop.slice(0, 3).map(name).join("; ")}.`] : []),
        ...turun.slice(0, 2).map((r) => `${name(r)}: buka detail varian untuk melihat varian mana yang turun atau kosong.`),
        ...(naik.length ? [`Tambah stok dan exposure untuk ${name(naik[0])} selagi naik.`] : []),
        ...(baru.length ? [`Pantau ${baru.length} SKU yang baru mulai terjual.`] : []),
        "Pastikan varian terlaris SKU andalan tidak kosong stok di semua toko."]} />
    <div className="card"><h2>SKU teratas · {R.label}</h2>
      <p className="muted small" style={{ marginTop: -4 }}>Klik baris SKU untuk melihat semua SKU varian beserta toko, qty, dan GMV-nya.</p>
      <ProdukTable rows={st.slice(0, 40)} tokoName={tokoName} />
      {st.length > 40 && <details><summary className="small" style={{ cursor: "pointer", marginTop: 8 }}>Tampilkan semua ({st.length} SKU)</summary><ProdukTable rows={st.slice(40)} tokoName={tokoName} /></details>}
      <p className="muted small">SKU induk = kode SKU sebelum titik pertama; listing yang memakai kode sama di toko berbeda digabung menjadi satu baris. Andalan = SKU teratas yang bersama-sama menyumbang 80% GMV. Berhenti terjual = laku ≥10 unit di periode pembanding, 0 di periode ini. Pembanding: {R.sub}.</p>
    </div>
  </>);
}
