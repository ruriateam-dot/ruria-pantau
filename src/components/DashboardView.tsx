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
import IklanTable, { type CRow } from "@/components/IklanTable";
import MetricBoard, { type Metric } from "@/components/MetricBoard";
import LiveSessions from "@/components/LiveSessions";
import ProdukDiag from "@/components/ProdukDiag";
import JadwalUpload from "@/components/JadwalUpload";
import UploadChecklist from "@/components/UploadChecklist";
import ForecastView from "@/components/ForecastView";
import StatusView from "@/components/StatusView";
import SaldoIklan, { type SaldoRow } from "@/components/SaldoIklan";
/* Akun yang saldo iklannya perlu dicatat tim */
const SALDO_STORES = ["cahaya-cabydut-tiktok", "cahaya-qaira-tiktok", "jf-just-fluff-shopee", "cahaya-cabydut-cpas", "cahaya-qaira-cpas", "cahaya-pepisun-cpas", "pascal-pascal-shopee", "pascal-ruang-mebel-shopee"];
import { shortName } from "@/lib/nama";
import { Kpi, Insight, Bars, LineChart, Share, Spark } from "@/components/ui";
import Empty from "@/components/Empty";
import { hitung, Verdict, LaporanKlien } from "@/components/Kilas";
import { clientsFor, loadClient, freshness, produkSku, storeLast, storePeriods, adsMeta, type SP, type Sale, type Ad, type Live, type Store } from "@/lib/data";
import { resolvePeriod, buckets, fmt, pct, jm, tgl, addDays, dayDiff, todayWIB, type Range } from "@/lib/period";

type SPv = Record<string, string | undefined>;
type Cl = { id: string; nama: string; modul: string[]; target_roas: number | null; tab_klien?: string[] | null; lap_temuan?: string | null; lap_langkah?: string | null; lap_waktu?: string | null; brand?: string };

const TABS: [string, string][] = [["sum", "Dashboard"], ["lapor", "Laporan"], ["ringkas", "Ringkasan"], ["toko", "Penjualan"], ["iklan", "Iklan"], ["affiliate", "Kreator"], ["live", "Livestream"], ["forecast", "Stok"]];

/* Dipakai oleh /dashboard (login) dan /lihat/[token] (klien tanpa login, hanya lihat) */
export default async function DashboardView({ sp, profile, clients: all, base, share, shareLabel, token }: { sp: SPv; profile: User | null; clients: Cl[]; base: string; share?: boolean; shareLabel?: string; token?: string }) {
  // Tampilan klien tanpa login: tanpa tab Semua Klien & Affiliate
  const clients = all;
  const isAdmin = isStaff(profile);
  const c = clients.find((x) => x.id === sp.c) ?? clients[0];
  let tab = sp.m ?? (share ? "lapor" : sp.c ? "toko" : "sum");
  if (tab === "status") tab = "toko";
  if (share && tab === "sum") tab = "lapor";
  const viewKlien = !!share || !isAdmin;
  const has = (k: string) => !!c && (k === "lapor" ? !!share && c.modul.includes("toko") : true) && (k === "forecast" || k === "lapor" || k === "status" || k === "ringkas" ? c.modul.includes("toko") : c.modul.includes(k)) && !(viewKlien && c.tab_klien && !c.tab_klien.includes(k));
  if (c && tab !== "sum" && !has(tab)) tab = TABS.map(([k]) => k).find((k) => k !== "sum" && has(k)) ?? c.modul[0];
  // Periode relatif dihitung mundur dari tanggal data terakhir klien (per jenis data)
  const F0 = c && tab !== "sum" ? (await freshness([c.id]))[0] : undefined;
  const lastData = tab === "iklan" ? F0?.iklan : tab === "live" ? F0?.live : F0?.penjualan;
  const R = resolvePeriod(sp.per, tab === "sum" ? null : lastData);
  const qs = (patch: Record<string, string>) => { const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]); for (const [k, v] of Object.entries(patch)) q.set(k, v); return "?" + q.toString(); };

  let body: React.ReactNode = <p className="muted">Belum ada klien yang bisa diakses akun ini. Minta admin menambahkan akses.</p>;
  let brands: string[] = [], platforms: string[] = [];
  let kilas: React.ReactNode = null;
  if (c) {
    const from = R.pf < R.from ? R.pf : R.from;
    const D = await loadClient(c.id, from, R.to);
    brands = [...new Set(D.stores.map((s) => s.brand))];
    platforms = [...new Set(D.stores.map((s) => s.platform))].filter((p) => p !== "CPAS" || tab === "iklan");
    const st = D.stores.filter((s) => (!sp.b || s.brand === sp.b) && (!sp.p || s.platform === sp.p));
    const ttl = (d: string) => `${tgl(R.from)}–${tgl(d < R.to ? d : R.to)}`;
    const fr: { l: string; w?: string; src?: string } = { l: lastData ? `data s.d. ${tgl(lastData)}` : "belum ada data", src: lastData ? (tab === "iklan" ? `File iklan Shopee (Data Keseluruhan) & TikTok GMV Max, ${ttl(lastData)}` : tab === "live" ? `Laporan livestream Shopee & TikTok, ${ttl(lastData)}` : `Statistik toko & ekspor pesanan Shopee/TikTok, ${ttl(lastData)}`) : undefined };
    if (lastData && (tab === "toko" || tab === "ringkas")) { const SLx = await storeLast(st.filter((x) => x.platform !== "CPAS").map((x) => x.id)); const lag = st.filter((x) => SLx[x.id] && SLx[x.id] < addDays(lastData, -1)); if (lag.length) fr.w = lag.map((x) => `${x.platform} · ${x.brand} baru s.d. ${tgl(SLx[x.id])}`).join(", "); }
    if (lastData && tab === "iklan" && st.length) { const AL = await q<{ store_id: string; d: string }>("select store_id, date_format(max(sampai), '%Y-%m-%d') d from ads where store_id in (?) group by store_id", [st.map((x) => x.id)]); const m = Object.fromEntries(AL.map((x) => [x.store_id, x.d])); const lag = st.filter((x) => m[x.id] && m[x.id] < addDays(lastData, -1) && m[x.id] >= R.from); if (lag.length) fr.w = lag.map((x) => `${x.platform} · ${x.brand} baru s.d. ${tgl(m[x.id])}`).join(", "); }
    if (lastData && tab === "live") { const LL = await q<{ b: string | null; d: string }>("select brand b, date_format(max(tanggal), '%Y-%m-%d') d from live_sessions where client_id = ? group by brand", [c.id]).catch(() => []); const lag = LL.filter((x) => x.d < addDays(lastData, -1) && x.d >= R.from); if (lag.length) fr.w = lag.map((x) => `Live ${x.b ?? "tanpa brand"} baru s.d. ${tgl(x.d)}`).join(", "); }
    const lagN = lastData ? dayDiff(lastData, addDays(todayWIB(), -1)) : 0;
    const lagTxt = !share && lastData && lagN > 3 ? `Data ${tab === "iklan" ? "iklan" : tab === "live" ? "live" : "penjualan"} baru sampai ${tgl(lastData)} (tertinggal ${lagN} hari); periode dihitung sampai tanggal itu.` : "";
    if (["toko", "ringkas", "iklan", "live"].includes(tab)) {
      const K = hitung(R, st, D.sales, D.ads, D.live);
      kilas = <>{<Verdict tab={tab} k={K} R={R} href={(m) => base + qs({ m })} lag={[lagTxt, fr.w ? `Data ${fr.w}; angka belum lengkap untuk toko tersebut.` : ""].filter(Boolean).join(" ") || null} />}</>;
    }
    if (tab === "sum") body = await SumTab(R, clients, (id) => base + qs({ c: id, m: "toko", b: "", p: "" }), isAdmin && !share, (id) => base + qs({ c: id, m: "iklan", b: "", p: "" }), isAdmin && !share ? <><UploadChecklist clientIds={clients.map((x) => x.id)} /><details className="jadw"><summary>Jadwal upload ▾</summary><JadwalUpload /></details></> : null);
    else if (tab === "toko") {
      const ts = st.filter((s) => s.platform !== "CPAS");
      let prod: Prod[] = [], prodErr: string | undefined;
      try { prod = await produkSku(ts.map((s) => s.id), R.from, R.to, R.pf, R.pt); } catch (e) { prodErr = (e as Error).message; }
      const SL = await storeLast(ts.map((s) => s.id));
      const scN = await storePeriods(ts.map((s) => s.id), R.from, R.to), scP = R.key === "all" ? [] : await storePeriods(ts.map((s) => s.id), R.pf, R.pt);
      const PP = await storePeriods(ts.map((s) => s.id), R.from, R.to, "product_period");
      const PM = new Map<string, { dl: number; kl: number; kr: number; pg: number }>();
      for (const x of PP) for (const r of x.d as unknown as [string, string, number, number, number | null, number | null, number | null, number | null, number | null][]) {
        const k = String(r[1]).trim().toLowerCase(), m = PM.get(k) ?? { dl: 0, kl: 0, kr: 0, pg: 0 }; m.dl += (r[4] ?? 0) * x.w; m.kl += (r[5] ?? 0) * x.w; m.pg += (r[6] ?? 0) * x.w; m.kr += (r[7] ?? 0) * x.w; PM.set(k, m); }
      const PS = prodStats(prod, ts, PM);
      body = <><nav className="jump" aria-label="Lompat ke bagian"><a href="#top">Ringkas</a><a href="#produk">Produk</a><a href="#status">Status pesanan</a><a href="#potongan">Potongan</a></nav><span id="top" /><TokoTab R={R} stores={ts} sales={D.sales} last={SL} prod={PS} live={D.live} ads={D.ads} plat={sp.p} scN={scN} scP={scP} fr={fr} /><ProdukSection R={R} ps={PS} err={prodErr} />{(!(viewKlien && c.tab_klien) || c.tab_klien.includes("status")) && <><h2 className="secth" id="status">Status pesanan, batal &amp; retur</h2><p className="note small">Angka di bagian ini <b>dihitung dari file pesanan yang diupload</b>, jadi bisa lebih kecil dari GMV di atas (yang berasal dari statistik toko). Kalau selisihnya besar, berarti file pesanan untuk periode ini belum lengkap.</p><StatusView R={R} stores={ts} share={!!share} staff={isAdmin && !share} /></>}</>;
    }
    else if (tab === "iklan") {
      // Saldo iklan hanya untuk tim (tidak tampil di link klien)
      let saldo: React.ReactNode = null;
      if (isAdmin && !share) {
        const acc = st.filter((s) => SALDO_STORES.includes(s.id));
        const H = acc.length ? await q<{ store_id: string; saldo: number; catatan: string | null; nama: string | null; w: string }>("select store_id, saldo, catatan, nama, date_format(waktu, '%Y-%m-%d %H:%i') w from ad_balance where store_id in (?) order by waktu desc, id desc", [acc.map((s) => s.id)]) : [];
        const rowsS: SaldoRow[] = acc.map((s) => { const h = H.filter((x) => x.store_id === s.id); return { id: s.id, nama: `${s.platform} · ${s.brand}`, saldo: h[0] ? +h[0].saldo : null, waktu: h[0]?.w ?? null, oleh: h[0]?.nama ?? null, catatan: h[0]?.catatan ?? null, riwayat: h.slice(0, 15).map((x) => ({ saldo: +x.saldo, waktu: x.w, oleh: x.nama })) }; });
        // Rata-rata belanja iklan per hari (30 hari s.d. kemarin) untuk perkiraan saldo cukup berapa hari
        const yd = addDays(todayWIB(), -1), d30 = addDays(yd, -29);
        const AR = acc.length ? await q<{ store_id: string; dari: string; sampai: string; biaya: number }>("select store_id, date_format(dari, '%Y-%m-%d') dari, date_format(sampai, '%Y-%m-%d') sampai, biaya from ads where store_id in (?) and sampai >= ? and dari <= ?", [acc.map((x) => x.id), d30, yd]) : [];
        for (const r of rowsS) r.avg = AR.filter((x) => x.store_id === r.id).reduce((t, x) => t + (+x.biaya * porsi({ ...x, dari: x.dari, sampai: x.sampai } as unknown as Ad, d30, yd)) / 30, 0);
        saldo = rowsS.length ? <SaldoIklan rows={rowsS} canEdit={isAdmin} /> : null;
      }
      const AM = await adsMeta(st.map((s) => s.id), R.pf < R.from ? R.pf : R.from, R.to);
      body = <>{saldo}<IklanTab R={R} stores={st} ads={D.ads} sales={D.sales} meta={AM} share={!!share} fr={fr} /></>;
    }
    else if (tab === "affiliate") {
      const has = (await q<{ n: number }>("select count(*) n from aff_files where client_id = ?", [c.id]))[0].n > 0;
      body = has ? <Affiliate key={c.id} client={c.id} nama={c.nama} user={profile ? "u" + profile.id : "klien"} readOnly={!!share || !isAdmin} token={share ? token : undefined} />
        : <div className="card"><h2>Affiliate · {c.nama}</h2><Empty title="Ruang kerja affiliate belum ada datanya." up={isAdmin && !share} file={<>TikTok: Affiliate → pesanan affiliate &amp; Transaction Analysis; Shopee: laporan validasi komisi &amp; Affiliate Marketing Solution → performa.</>} /></div>;
    }
    else if (tab === "lapor") {
      const K = hitung(R, st, D.sales, D.ads, D.live);
      const ts = st.filter((s) => s.platform !== "CPAS");
      let prod: Prod[] = []; try { prod = (await produkSku(ts.map((s) => s.id), R.from, R.to, R.pf, R.pt)) as unknown as Prod[]; } catch { /* abaikan */ }
      let aff = 0; try { aff = +((await q<{ a: number | null }>("select sum(case when gagal = 0 then nilai - retur else 0 end) a from aff_orders where store_id in (?) and tanggal between ? and ?", [ts.map((x) => x.id), R.from, R.to]))[0]?.a ?? 0); } catch { /* abaikan */ }
      body = <LaporTab R={R} c={c} K={K} stores={ts} sales={D.sales} prod={prod} aff={aff} last={lastData ? tgl(lastData) : null} detail={base + qs({ m: "ringkas" })} />;
    }
    else if (tab === "ringkas") body = await RingkasTab({ R, c, stores: st, sales: D.sales, ads: D.ads, live: D.live });
    else if (tab === "status") {
      body = <StatusView R={R} stores={st} share={!!share} staff={isAdmin && !share} />;
    }
    else if (tab === "forecast") {
      body = <ForecastView clientId={c.id} sp={sp} base={base} staff={isAdmin && !share} share={!!share} />;
    }
    else if (tab === "live") {
      const jad = await q<Jd>("select date_format(l.tanggal, '%Y-%m-%d') tanggal, l.mulai, l.selesai, h.nama host from live_schedule l join hosts h on h.id = l.host_id where l.client_id = ? and l.tanggal between ? and ?", [c.id, R.from, R.to]);
      // Catatan: ekspor statistik toko Shopee hanya memuat 5 sesi live teratas per bulan, jadi tidak dipakai untuk total live
      body = <LiveTab R={R} live={D.live} brand={sp.b} plat={sp.p} jadwal={jad} fr={fr} />;
    }
  }

  const tabName = TABS.find(([k]) => k === tab)?.[1] ?? tab;
  await logAct(profile, "lihat", tab === "sum" ? null : c?.id ?? null, `${tabName} · ${R.label}${sp.b ? ` · ${sp.b}` : ""}${sp.p ? ` · ${sp.p}` : ""}`, share ? `Link klien${shareLabel ? ` (${shareLabel})` : ""}` : undefined);
  const title = `${tab === "sum" ? "Dashboard semua klien" : c?.nama ?? ""} · ${tabName} · ${R.label}`;
  const tabs = <Tabs active={tab} items={TABS.filter(([k]) => k !== "sum" && has(k)).map(([k, l]) => ({ k, l, href: base + qs({ m: k }) }))} />;
  const head = (
    <header className="dh">
      <div className="wrap top ctitle">
        {share ? <><span className="brandc"><RuriaWord height={20} /></span><b>Report</b><span className="muted">{c?.nama} · tampilan klien, hanya lihat</span></>
          : tab === "sum" ? <h1>Dashboard</h1> : <div><nav className="crumb small muted" aria-label="Breadcrumb"><a href={base + "?m=sum"}>Dashboard</a> › <span>{c?.brand ?? c?.nama}</span> › <span>{tabName}</span></nav><h1>{tabName} · {c?.brand ?? c?.nama}{c?.brand && c.brand !== c.nama && <small className="h1pt">{c.nama}</small>}</h1></div>}
      </div>
      {tab !== "forecast" && tab !== "affiliate" && <div className="wrap fbar"><Filters rng={[R.from, R.to]} cmp={R.key === "all" ? undefined : R.sub.replace(/^vs /, "dibanding ")} last={lastData ?? null} base={base} clients={share ? clients : []} hideClient={!share || clients.length < 2} brands={tab === "sum" || tab === "lapor" ? [] : brands} platforms={tab === "sum" || tab === "lapor" ? [] : platforms} label={R.label} />{tab !== "affiliate" && <ExportBar title={title} client={tab === "sum" ? null : c?.id ?? null} token={token} />}</div>}
      {tab !== "sum" && tab !== "lapor" && tabs}
    </header>
  );
  const lag = lastData ? dayDiff(lastData, addDays(todayWIB(), -1)) : 0;
  // Peringatan data terlambat hanya untuk yang login (tim Ruria & tim klien), tidak tampil di link klien
  const warn = !share && tab !== "sum" && tab !== "affiliate" && lastData && lag > 3 ? <p className="note warnnote">Data {tab === "iklan" ? "iklan" : tab === "live" ? "live" : "penjualan"} klien ini baru sampai <b>{tgl(lastData)} {lastData.slice(0, 4)}</b> (tertinggal {lag} hari). Periode dihitung sampai tanggal itu supaya data yang belum diupload tidak terbaca sebagai penurunan.</p> : null;
  const main = <main className="wrap dv">{isAdmin && <AutoImport />}{kilas}{["toko", "ringkas", "iklan", "live"].includes(tab) ? null : warn}{body}</main>;
  if (share || !profile) return <><LoadingBar />{head}{main}</>;
  return <AppShell user={profile} active={tab === "sum" ? undefined : c?.id} keep={{ m: tab, per: sp.per }} subs={c ? TABS.filter(([k]) => k !== "sum" && has(k)).map(([k, l]) => ({ k, l, href: base + qs({ m: k }) })) : []}>{head}{main}</AppShell>;
}

/* ---------------- Ringkasan 1 layar untuk klien ---------------- */
async function RingkasTab({ R, c, stores, sales, ads, live }: { R: Range; c: Cl; stores: Store[]; sales: Sale[]; ads: Ad[]; live: Live[] }) {
  const ids = new Set(stores.filter((s) => s.platform !== "CPAS").map((s) => s.id)), cmp = R.key !== "all";
  const gm = (a: string, b: string, id?: string) => sales.filter((x) => (id ? x.store_id === id : ids.has(x.store_id)) && x.tanggal >= a && x.tanggal <= b).reduce((t, x) => t + +x.gmv, 0);
  const ad = (a: string, b: string) => ads.filter((x) => x.dari <= b && x.sampai >= a).reduce((t, x) => { const w = porsi(x, a, b); t.s += +x.biaya * w; t.g += +x.gmv * w; return t; }, { s: 0, g: 0 });
  const lv = (a: string, b: string) => live.filter((x) => x.tanggal >= a && x.tanggal <= b);
  const G = gm(R.from, R.to), Gp = gm(R.pf, R.pt), A = ad(R.from, R.to), Ap = ad(R.pf, R.pt), roas = A.s ? A.g / A.s : null, roasP = Ap.s ? Ap.g / Ap.s : null;
  const L = lv(R.from, R.to), LG = L.reduce((t, x) => t + +x.gmv_shopee + +x.gmv_tiktok, 0); const LGp = lv(R.pf, R.pt).reduce((t, x) => t + +x.gmv_shopee + +x.gmv_tiktok, 0);
  let aff = 0, affP = 0;
  try { const af = await q<{ a: number; b: number }>("select sum(case when tanggal between ? and ? and gagal = 0 then nilai - retur else 0 end) a, sum(case when tanggal between ? and ? and gagal = 0 then nilai - retur else 0 end) b from aff_orders where store_id in (?)", [R.from, R.to, R.pf, R.pt, [...ids]]); aff = +(af[0]?.a ?? 0); affP = +(af[0]?.b ?? 0); } catch { /* tabel affiliate belum ada */ }
  const act = await q<{ aksi: string; n: number }>("select aksi, count(*) n from activity_log where client_id = ? and waktu >= now() - interval 7 day group by aksi", [c.id]).catch(() => []);
  const nAct = (re: RegExp) => act.filter((x) => re.test(x.aksi)).reduce((t, x) => t + +x.n, 0);
  const done = [nAct(/^affiliate/) ? `${nAct(/^affiliate/)} catatan follow-up affiliate diperbarui` : "", nAct(/upload|impor/) ? `${nAct(/upload|impor/)} file data diperbarui` : "", nAct(/saldo/) ? `${nAct(/saldo/)} kali saldo iklan dicatat` : ""].filter(Boolean);
  const ch = (a: number, b: number) => cmp && b ? <span className={a >= b ? "up" : "dn"}>{a >= b ? "▲" : "▼"} {Math.abs(pct(a, b)).toFixed(2).replace(".", ",")}% {R.sub}</span> : null;
  const per = stores.filter((s) => ids.has(s.id)).map((s) => ({ s, n: gm(R.from, R.to, s.id), o: gm(R.pf, R.pt, s.id) })).filter((x) => x.n || x.o).sort((a, b) => b.n - a.n);
  return (<>
    <div className="rk">
      <div className="card rkc"><span className="muted small">GMV · {R.label}</span><b>{fmt(G)}</b>{ch(G, Gp)}</div>
      <div className="card rkc"><span className="muted small">ROAS iklan</span><b>{roas != null ? roas.toFixed(2).replace(".", ",") : "–"}</b>
        {c.target_roas ? <><div className="rkbar"><i style={{ width: `${Math.min(100, ((roas ?? 0) / c.target_roas) * 100)}%` }} /></div><span className={"small " + ((roas ?? 0) >= c.target_roas ? "up" : "dn")}>target {c.target_roas} · {(roas ?? 0) >= c.target_roas ? "tercapai" : "di bawah target"}</span></> : roas != null && roasP != null ? <span className={roas >= roasP ? "up small" : "dn small"}>{roas >= roasP ? "▲" : "▼"} dari {roasP.toFixed(2).replace(".", ",")}</span> : null}</div>
      <div className="card rkc"><span className="muted small">Kontribusi affiliate</span><b>{G ? ((aff / G) * 100).toFixed(2).replace(".", ",") + "%" : "–"}</b><span className="small muted">{fmt(aff)} dari affiliate</span>{ch(aff, affP)}</div>
      <div className="card rkc"><span className="muted small">Livestream</span><b>{fmt(LG)}</b><span className="small muted">{L.length} sesi{L.length ? ` · ${fmt(LG / L.length)}/sesi` : ""}</span>{ch(LG, LGp)}</div>
    </div>
    <div className="rk2">
      <div className="card"><h2>Per toko</h2><div className="tbl"><table><thead><tr><th>Toko</th><th className="n">GMV</th><th className="n">{R.sub}</th><th className="n">Porsi</th></tr></thead>
        <tbody>{per.map((x) => { const v = pct(x.n, x.o); return <tr key={x.s.id}><td>{x.s.platform} · {x.s.brand}</td><td className="n">{fmt(x.n)}</td><td className={"n " + (v >= 0 ? "up" : "dn")}>{cmp && x.o ? `${v >= 0 ? "+" : ""}${v.toFixed(2).replace(".", ",")}%` : "–"}</td><td className="n">{G ? ((x.n / G) * 100).toFixed(0) : 0}%</td></tr>; })}</tbody></table></div></div>
      <div className="card"><h2>Yang dikerjakan Ruria · 7 hari terakhir</h2>{done.length ? <ol className="small">{done.map((x) => <li key={x}>{x}</li>)}</ol> : <p className="muted small">Belum ada aktivitas tercatat minggu ini.</p>}</div>
    </div>
  </>);
}

/* ---------------- Semua klien ---------------- */
async function SumTab(R: Range, clients: { id: string; nama: string; modul: string[]; brand?: string }[], href: (id: string) => string, staff = false, hrefIklan: (id: string) => string = href, upl: React.ReactNode = null) {
  const F = await freshness(clients.map((c) => c.id));
  const yday = addDays(todayWIB(), -1);
  const badge = (d: string | null | undefined) => { if (!d) return <span className="pill mute">Belum ada data</span>; const lag = dayDiff(d, yday); return lag <= 0 ? <span className="pill good">Aman</span> : lag <= 3 ? <span className="pill warn">Kurang {lag} hari</span> : <span className="pill bad">Tertinggal {lag} hari</span>; };
  const cell = (on: boolean, d: string | null | undefined) => on ? <><td>{d ? `${tgl(d)} ${d.slice(0, 4)}` : "–"}</td><td>{badge(d)}</td></> : <><td>–</td><td><span className="pill mute">Tidak dipantau</span></td></>;
  const rows = await Promise.all(clients.filter((c) => c.modul.includes("toko")).map(async (c) => {
    const D = await loadClient(c.id, R.pf < R.from ? R.pf : R.from, R.to);
    const g = (a: string, b: string) => D.sales.filter((s) => s.tanggal >= a && s.tanggal <= b).reduce((x, s) => x + s.gmv, 0);
    const ord = D.sales.filter((s) => s.tanggal >= R.from && s.tanggal <= R.to).reduce((x, s) => x + s.pesanan, 0);
    const ad = D.ads.filter((a) => a.dari <= R.to && a.sampai >= R.from), biaya = ad.reduce((x, a) => x + a.biaya, 0), ag = ad.reduce((x, a) => x + a.gmv, 0);
    const adP = D.ads.filter((a) => a.dari <= R.pt && a.sampai >= R.pf), bP = adP.reduce((x, a) => x + a.biaya, 0), gP = adP.reduce((x, a) => x + a.gmv, 0);
    return { c, n: g(R.from, R.to), o: g(R.pf, R.pt), ord, roas: biaya ? ag / biaya : null, roasP: bP ? gP / bP : null };
  }));
  rows.sort((a, b) => b.n - a.n);
  const tot = rows.reduce((a, r) => a + r.n, 0) || 1;
  const up = [...rows].sort((a, b) => pct(b.n, b.o) - pct(a.n, a.o))[0], dn = [...rows].sort((a, b) => pct(a.n, a.o) - pct(b.n, b.o))[0];
  // Indikator status kartu klien: data terlambat, saldo iklan menipis, ROAS turun
  // Rata-rata biaya iklan harian 30 hari terakhir per akun (untuk ambang saldo: 2 hari belanja)
  const a30 = addDays(yday, -29);
  const AR = staff ? await q<{ store_id: string; dari: string; sampai: string; biaya: number }>("select store_id, date_format(dari, '%Y-%m-%d') dari, date_format(sampai, '%Y-%m-%d') sampai, biaya from ads where store_id in (?) and sampai >= ? and dari <= ?", [SALDO_STORES, a30, yday]) : [];
  const AVG = new Map<string, number>(); for (const x of AR) { const f = x.dari > a30 ? x.dari : a30, t = x.sampai < yday ? x.sampai : yday; const w = (dayDiff(f, t) + 1) / (dayDiff(x.dari, x.sampai) + 1); AVG.set(x.store_id, (AVG.get(x.store_id) ?? 0) + (+x.biaya * w) / 30); }
  const SL = staff ? await q<{ client_id: string; store_id: string; brand: string; platform: string; saldo: number }>(
    `select s.client_id, s.id store_id, s.brand, s.platform, b.saldo from ad_balance b join stores s on s.id = b.store_id where s.id in (?) and b.id = (select b2.id from ad_balance b2 where b2.store_id = b.store_id order by b2.waktu desc, b2.id desc limit 1)`, [SALDO_STORES]) : [];
  const statusOf = (r: (typeof rows)[number]) => { const f = F.find((x) => x.client_id === r.c.id); const out: [number, string][] = [];
    for (const [k, d] of [["penjualan", f?.penjualan], ["iklan", r.c.modul.includes("iklan") ? f?.iklan : undefined]] as const) { if (!d) continue; const lag = dayDiff(d, yday); if (lag > 3) out.push([2, `Data ${k} tertinggal ${lag} hari`]); else if (lag >= 2) out.push([1, `Data ${k} kurang ${lag} hari`]); }
    for (const x of SL.filter((x) => x.client_id === r.c.id && +x.saldo < 2 * (AVG.get(x.store_id) ?? 0))) out.push([1, `Saldo ${x.platform} ${x.brand} < 2 hari belanja iklan`]);
    if (r.roas != null && r.roasP && r.roas < r.roasP * 0.85) out.push([1, `ROAS turun ${((1 - r.roas / r.roasP) * 100).toFixed(0).replace(".", ",")}%`]);
    out.sort((a, b) => b[0] - a[0]); return out; };
  const totN = rows.reduce((a, r) => a + r.n, 0), totO = rows.reduce((a, r) => a + r.o, 0), dT = R.key !== "all" && totO ? pct(totN, totO) : null;
  const perhatian = rows.map((r) => ({ r, so: statusOf(r) })).filter((x) => x.so.length);
  const tone = perhatian.some((x) => x.so[0][0] === 2) ? "bad" : perhatian.length ? "warn" : "good";
  return (<>
    {rows.length > 0 && <div className={"verdict v-" + tone} role="status"><span className="vic" aria-hidden>{tone === "good" ? "✅" : tone === "warn" ? "⚠️" : "⛔"}</span><div>
      <b>Total GMV {rows.length} klien {fmt(totN)}{dT != null ? ` (${dT >= 0 ? "▲" : "▼"} ${Math.abs(dT).toFixed(1).replace(".", ",")}%)` : ""}. {perhatian.length ? `${perhatian.length} klien perlu perhatian.` : "Semua klien aman."}</b>
      <ul className="vpts">{perhatian.slice(0, 3).map((x) => <li key={x.r.c.id}><a href={href(x.r.c.id)}>{x.r.c.brand ?? x.r.c.nama}</a>: {x.so.map((y) => y[1]).join(" · ")}.</li>)}{!perhatian.length && up && <li>Pertumbuhan terbaik: {up.c.brand ?? up.c.nama} ({pct(up.n, up.o).toFixed(1).replace(".", ",")}%).</li>}</ul></div></div>}
    <div className="ccards">{rows.map((r) => { const v = pct(r.n, r.o); const f = F.find((x) => x.client_id === r.c.id);
      const so = statusOf(r), lv = so[0]?.[0] ?? 0;
      return <a key={r.c.id} className={"ccard st" + lv} href={href(r.c.id)}>
        <div className="top"><h3>{r.c.brand ?? r.c.nama}{r.c.brand && r.c.brand !== r.c.nama && <small className="h1pt">{r.c.nama}</small>}</h3><span className={"pill " + (lv === 2 ? "bad" : lv === 1 ? "warn" : "good")} title={so.map((x) => x[1]).join(" · ")}>{so[0]?.[1] ?? "Aman"}{so.length > 1 ? ` +${so.length - 1}` : ""}</span></div>
        <div className="cm"><div><span>GMV</span><b>{fmt(r.n)}</b></div><div><span>Perubahan</span><b className={v >= 0 ? "up" : "dn"}>{isFinite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}%` : "–"}</b></div><div><span>ROAS iklan</span><b>{r.roas != null ? r.roas.toFixed(2).replace(".", ",") : "–"}</b></div></div>
        <div className="muted small">{r.ord.toLocaleString("id")} pesanan · data terakhir {f?.penjualan ? `${tgl(f.penjualan)} ${f.penjualan.slice(0, 4)}` : "–"}</div>
      </a>; })}</div>
    {upl}
    <div className="grid2c">{staff && await (async () => {
      const S2a = await q<{ client_id: string; store_id: string; nama: string; brand: string; platform: string; saldo: number; oleh: string | null; w: string }>(
        `select s.client_id, s.id store_id, c.nama, s.brand, s.platform, b.saldo, b.nama oleh, date_format(b.waktu, '%Y-%m-%d %H:%i') w from ad_balance b join stores s on s.id = b.store_id join clients c on c.id = s.client_id
         where s.client_id in (?) and s.id in (?) and b.id = (select b2.id from ad_balance b2 where b2.store_id = b.store_id order by b2.waktu desc, b2.id desc limit 1) order by b.saldo`, [clients.map((c) => c.id), SALDO_STORES]);
      const lama0 = (w: string) => Date.now() - Date.parse(w.replace(" ", "T") + ":00+07:00") > 3 * 864e5;
      const hari = (x: { store_id: string; saldo: number }) => { const a = AVG.get(x.store_id) ?? 0; return a > 0 ? +x.saldo / a : null; };
      const S2 = S2a.filter((x) => { const h = hari(x); return lama0(x.w) || (h != null && h < 3); });
      if (!S2a.length) return null;
      if (!S2.length) return <div className="card"><h2>Saldo iklan</h2><p className="muted small">Semua saldo iklan cukup untuk 3 hari atau lebih. Daftar lengkap di tab Iklan tiap klien.</p></div>;
      const lama = (w: string) => Date.now() - Date.parse(w.replace(" ", "T") + ":00+07:00") > 3 * 864e5;
      return <div className="card"><h2>Saldo iklan menipis</h2><div className="tbl"><table><thead><tr><th>Klien</th><th>Akun</th><th className="n">Sisa saldo</th><th className="n">Cukup</th><th>Dicatat</th><th>Oleh</th></tr></thead>
        <tbody>{S2.map((x, i) => <tr key={i}><td><a href={hrefIklan(x.client_id)}>{x.nama}</a></td><td>{x.platform} · {x.brand}</td><td className="n"><b>Rp{Math.round(+x.saldo).toLocaleString("id")}</b></td><td className="n">{(() => { const h = hari(x); return h == null ? "–" : <span className={"pill " + (h < 2 ? "bad" : "warn")}>{h.toFixed(1).replace(".", ",")} hari</span>; })()}</td><td className={"small" + (lama(x.w) ? " dn" : "")}>{tgl(x.w.slice(0, 10))} {x.w.slice(11)} WIB{lama(x.w) ? " · lebih dari 3 hari" : ""}</td><td className="small">{x.oleh ?? "–"}</td></tr>)}</tbody></table></div>
        <p className="muted small">Hanya akun yang saldonya cukup &lt; 3 hari belanja iklan atau belum dicatat &gt; 3 hari. Daftar lengkap & update saldo di tab Iklan tiap klien.</p></div>;
    })()}</div>
  </>);
}

/* ---------------- Toko ---------------- */
function TokoTab({ R, stores, sales, last, prod, live, ads, plat, scN, scP, fr }: { fr?: { l: string; w?: string; src?: string }; R: Range; stores: Store[]; sales: Sale[]; last: Record<string, string>; prod: PStats; live: Live[]; ads: Ad[]; plat?: string; scN: SP[]; scP: SP[] }) {
  if (!stores.length) return <p className="muted">Tidak ada toko untuk pilihan ini.</p>;
  // Toko yang datanya berhenti sebelum akhir periode (lebih dari 3 hari) tidak ikut dibandingkan
  const stale = (id: string) => !last[id] || dayDiff(last[id], R.to) > 3;
  const fresh = stores.filter((s) => !stale(s.id));
  const ids = new Set(stores.map((s) => s.id)), fids = new Set(fresh.map((s) => s.id));
  const S = sales.filter((s) => ids.has(s.store_id));
  const agg = (a: string, b: string, only?: Set<string> | string) => { const r = { g: 0, o: 0, v: 0, vok: true }; S.filter((s) => s.tanggal >= a && s.tanggal <= b && (!only || (typeof only === "string" ? s.store_id === only : only.has(s.store_id)))).forEach((s) => { r.g += s.gmv; r.o += s.pesanan; if (s.pengunjung == null) r.vok = false; else r.v += s.pengunjung; }); return r; };
  const n = agg(R.from, R.to), nf = agg(R.from, R.to, fids), o = agg(R.pf, R.pt, fids);
  const cmp = R.key !== "all" && fresh.length > 0;
  const aov = n.o ? n.g / n.o : 0, aovF = nf.o ? nf.g / nf.o : 0, aovP = o.o ? o.g / o.o : 0;
  const cr = n.vok && n.v ? (n.o / n.v) * 100 : NaN, crF = nf.vok && nf.v ? (nf.o / nf.v) * 100 : NaN, crP = o.vok && o.v ? (o.o / o.v) * 100 : NaN;
  const B = buckets(R.from, R.to);
  const per = stores.map((s) => { const a = agg(R.from, R.to, s.id), b = agg(R.pf, R.pt, s.id), st = stale(s.id);
    return { s, g: a.g, o: a.o, v: a.vok ? a.v : null, aov: a.o ? a.g / a.o : 0, cr: a.vok && a.v ? (a.o / a.v) * 100 : NaN, ch: st ? NaN : pct(a.g, b.g), st, last: last[s.id], tr: B.map((k) => agg(k.f, k.t, s.id).g) }; }).sort((a, b) => b.g - a.g);
  const vals = B.map((b) => agg(b.f, b.t).g);
  const PB = dayDiff(R.from, R.to) >= 13 ? buckets(R.pf, R.pt) : null;
  const prevVals = PB ? PB.map((b) => agg(b.f, b.t).g) : undefined;
  const cmpd = per.filter((r) => !r.st && isFinite(r.ch));
  const worst = [...cmpd].sort((a, b) => a.ch - b.ch)[0], best = [...cmpd].sort((a, b) => b.ch - a.ch)[0];
  const dG = pct(nf.g, o.g), dA = pct(aovF, aovP), dC = pct(crF, crP);
  const staleN = per.filter((r) => r.st);
  // Satu kotak ringkasan per tab: toko + produk, maksimal 3–4 poin per kolom
  const sum = [`GMV ${fmt(n.g)}${cmp ? `, ${dG >= 0 ? "naik" : "turun"} ${Math.abs(dG).toFixed(1).replace(".", ",")}% ${R.sub}` : ""}${staleN.length ? ` (perbandingan tanpa ${staleN.length} toko yang datanya belum lengkap)` : ""}.`,
    ...(per.length > 1 ? [`Kontributor terbesar: ${per[0].s.brand} · ${per[0].s.platform} (${(per[0].g / (n.g || 1) * 100).toFixed(0).replace(".", ",")}%).`] : []), ...prod.sum.slice(0, 2)];
  const ana = [...(cmp ? [isFinite(dC) && Math.abs(dC) > Math.abs(dA) ? `Perubahan GMV lebih didorong konversi (${dC.toFixed(1).replace(".", ",")}%) daripada AOV (${dA.toFixed(1).replace(".", ",")}%).` : `Perubahan GMV lebih didorong AOV (${dA.toFixed(1).replace(".", ",")}%)${isFinite(dC) ? ` daripada konversi (${dC.toFixed(1).replace(".", ",")}%)` : ""}.`] : []),
    ...(worst && worst.ch < -5 && cmpd.length > 1 ? [`${worst.s.platform} · ${worst.s.brand} paling melemah (${worst.ch.toFixed(1).replace(".", ",")}%).`] : []),
    ...(best && best.ch > 5 && cmpd.length > 1 ? [`${best.s.platform} · ${best.s.brand} paling tumbuh (+${best.ch.toFixed(1).replace(".", ",")}%).`] : []), ...prod.ana.slice(0, 2)];
  const next = [...(worst && worst.ch < -5 && cmpd.length > 1 ? [`Cek ${worst.s.platform} · ${worst.s.brand}: listing, stok varian laris, harga, status iklan.`] : []),
    ...(staleN.length ? [`Upload data terbaru: ${staleN.map((r) => `${r.s.platform} · ${r.s.brand}`).join(", ")}.`] : []), ...prod.next.slice(0, 2)];
  const tot = n.g || 1;
  return (<>
    <div className="ichart"><Insight src="Data asli" sum={sum} ana={ana.length ? ana : ["Belum ada pembanding untuk periode ini."]} next={next.length ? next : ["Pastikan stok produk andalan aman untuk 14 hari ke depan."]} />
    {(() => { const ser = (f: (x: ReturnType<typeof agg>) => number, bs: { f: string; t: string }[]) => bs.map((k) => f(agg(k.f, k.t)));
      const PBs = PB ?? undefined, cv = (x: ReturnType<typeof agg>) => x.vok && x.v ? (x.o / x.v) * 100 : NaN;
      const M: Metric[] = [
        { g: "Penjualan", k: "g", l: "Penjualan", f: "rp", v: n.g, d: cmp ? dG : null, s: vals, ps: prevVals },
        { g: "Penjualan", k: "o", l: "Pesanan", f: "n", v: n.o, d: cmp ? pct(nf.o, o.o) : null, s: ser((x) => x.o, B), ps: PBs && ser((x) => x.o, PBs) },
        { g: "Trafik", k: "v", l: "Pengunjung", f: "n", v: n.vok ? n.v : NaN, d: cmp && o.vok && nf.vok ? pct(nf.v, o.v) : null, s: ser((x) => x.v, B), ps: PBs && ser((x) => x.v, PBs), note: n.vok ? undefined : "data pengunjung belum lengkap" },
        { g: "Trafik", k: "cr", l: "Tingkat konversi", f: "pct", v: cr, ex: n.vok && n.v ? `${Math.round(n.o).toLocaleString("id")} pesanan ÷ ${Math.round(n.v).toLocaleString("id")} pengunjung × 100 = ${cr.toFixed(2).replace(".", ",")}%` : undefined, d: cmp ? dC : null, s: ser(cv, B), ps: PBs && ser(cv, PBs) },
        { g: "Penjualan", k: "aov", l: "Penjualan per pesanan", f: "rp", v: aov, ex: n.o ? `${fmt(n.g)} ÷ ${Math.round(n.o).toLocaleString("id")} pesanan = ${fmt(aov)}` : undefined, d: cmp ? dA : null, s: ser((x) => (x.o ? x.g / x.o : 0), B), ps: PBs && ser((x) => (x.o ? x.g / x.o : 0), PBs) },
        { g: "Trafik", k: "vp", l: "Penjualan per pengunjung", f: "rp", v: n.vok && n.v ? n.g / n.v : NaN, d: cmp && nf.vok && nf.v && o.vok && o.v ? pct(nf.g / nf.v, o.g / o.v) : null, s: ser((x) => (x.v ? x.g / x.v : 0), B), ps: PBs && ser((x) => (x.v ? x.g / x.v : 0), PBs) },
      ];
      return <MetricBoard metrics={M} labels={B.map((b) => b.l)} sub={R.sub} init={["g", "o"]} fresh={fr} />; })()}</div>
    {scN.length > 0 && (() => { // Metrik Seller Centre (ekspor statistik toko Shopee, bulanan)
      const S2 = (L: SP[], k: string) => L.reduce((t, x) => t + (typeof x.d[k] === "number" ? (x.d[k] as number) * x.w : 0), 0);
      const has = (L: SP[], k: string) => L.some((x) => typeof x.d[k] === "number");
      const card = (l: string, v: number, p: number | null, f: (n: number) => string, inv = false, note?: string) => { const d = p && cmpSC ? ((v - p) / p) * 100 : null, good = d == null || (inv ? d <= 0 : d >= 0);
        return <div className="mbc" key={l} style={{ cursor: "default" }}><span className="mbl">{l}</span><b>{f(v)}</b><span className={"mbd " + (d == null ? "muted" : good ? "up" : "dn")}>{d == null ? (note ?? "") : `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1).replace(".", ",")}% ${R.sub}`}</span></div>; };
      const cmpSC = scP.length > 0 && R.key !== "all";
      const nn = (n: number) => Math.round(n).toLocaleString("id"), pc = (n: number) => n.toFixed(2).replace(".", ",") + "%";
      const pen = S2(scN, "penjualan"), penP = S2(scP, "penjualan"), pes = S2(scN, "pesanan"), pesP = S2(scP, "pesanan");
      const bo = S2(scN, "batal_o"), bg = S2(scN, "batal_g"), ro = S2(scN, "retur_o"), rg = S2(scN, "retur_g"), pb = S2(scN, "pembeli"), br = S2(scN, "baru"), lm = S2(scN, "lama"), kl = S2(scN, "diklik"), pt = S2(scN, "potensi");
      const tokoSC = [...new Set(scN.map((x) => x.store_id))].map((id) => stores.find((s2) => s2.id === id)?.brand).filter(Boolean).join(", ");
      const monthly = scN.some((x) => x.w < 0.999);
      const kk = has(scN, "k_halaman");
      const K = [["Halaman produk", "k_halaman"], ["Live penjual", "k_live"], ["Video penjual", "k_video"], ["Live & video affiliate", "k_aff"]] as const;
      return <div className="card mb"><h2 style={{ marginTop: 14 }}>Detail Seller Centre <span className="muted small">Shopee · {tokoSC}</span></h2>
        <h3 className="mbgh">Pesanan & pembatalan</h3><div className="mbg">
          {card("Pesanan dibatalkan", bo, cmpSC ? S2(scP, "batal_o") : null, nn, true)}
          {card("Penjualan dibatalkan", bg, cmpSC ? S2(scP, "batal_g") : null, fmt, true)}
          {card("% pesanan dibatalkan", pes ? (bo / (pes + bo)) * 100 : 0, cmpSC && pesP ? (S2(scP, "batal_o") / (pesP + S2(scP, "batal_o"))) * 100 : null, pc, true)}
          {card("Pesanan dikembalikan", ro, cmpSC ? S2(scP, "retur_o") : null, nn, true)}
          {card("Penjualan dikembalikan", rg, cmpSC ? S2(scP, "retur_g") : null, fmt, true)}
        </div>
        <h3 className="mbgh">Pembeli & trafik</h3><div className="mbg">
          {card("Pembeli", pb, cmpSC ? S2(scP, "pembeli") : null, nn)}
          {card("Pembeli baru", br, cmpSC ? S2(scP, "baru") : null, nn)}
          {card("Pembeli lama", lm, cmpSC ? S2(scP, "lama") : null, nn, false, pb ? `${((lm / pb) * 100).toFixed(1).replace(".", ",")}% dari pembeli` : undefined)}
          {card("Potensi pembeli", pt, cmpSC ? S2(scP, "potensi") : null, nn)}
          {card("Produk diklik", kl, cmpSC ? S2(scP, "diklik") : null, nn)}
          {card("Penjualan (Seller Centre)", pen, cmpSC ? penP : null, fmt)}
        </div>
        {kk && <><h3 className="mbgh">Rincian kontribusi penjualan</h3><div className="contrib" style={{ marginTop: 8 }}>
          <div className="tot"><span>Total penjualan (100%)</span><b>{fmt(pen)}</b></div>
          {K.map(([l, k]) => { const v = S2(scN, k), vp = S2(scP, k); return <div key={k}><span>{l}</span><b>{fmt(v)}</b><small className="small muted">{pen ? ((v / pen) * 100).toFixed(0) : 0}% dari penjualan{cmpSC && vp ? <span className={v >= vp ? "up" : "dn"}> {v >= vp ? "▲" : "▼"} {Math.abs(pct(v, vp)).toFixed(1).replace(".", ",")}%</span> : null}</small></div>; })}
          <div><span>Iklan Shopee (kontribusi)</span><b>{fmt(S2(scN, "k_iklan"))}</b><small className="small muted">{pen ? Math.min(100, (S2(scN, "k_iklan") / pen) * 100).toFixed(0) : 0}% dari penjualan</small></div>
        </div></>}
        <p className="muted small" style={{ marginBottom: 12 }}>Sumber: ekspor statistik toko Shopee (Data Bisnis), status pesanan dibuat. Laporannya bulanan{monthly ? ", jadi untuk periode yang tidak sebulan penuh angkanya dibagi rata per hari (perkiraan)" : ""}. Kontribusi iklan dihitung Shopee terpisah dan bisa tumpang tindih dengan sumber lain.</p>
      </div>; })()}
    {!scN.some((x) => typeof x.d.k_halaman === "number") && (() => { // Rincian kontribusi penjualan (perkiraan, kalau belum ada data Seller Centre)
      const brands = new Set(stores.map((x) => x.brand.toLowerCase()));
      const lv = live.filter((x) => x.tanggal >= R.from && x.tanggal <= R.to && (!x.brand || brands.has(x.brand.toLowerCase()))).reduce((t, x) => t + (plat === "TikTok" ? 0 : +x.gmv_shopee) + (plat === "Shopee" ? 0 : +x.gmv_tiktok), 0);
      const lvP = live.filter((x) => x.tanggal >= R.pf && x.tanggal <= R.pt && (!x.brand || brands.has(x.brand.toLowerCase()))).reduce((t, x) => t + (plat === "TikTok" ? 0 : +x.gmv_shopee) + (plat === "Shopee" ? 0 : +x.gmv_tiktok), 0);
      const ids2 = new Set(stores.map((x) => x.id)), pr = (x: Ad, a: string, b: string) => { const f = x.dari > a ? x.dari : a, t = x.sampai < b ? x.sampai : b; return f > t ? 0 : (dayDiff(f, t) + 1) / (dayDiff(x.dari, x.sampai) + 1); };
      const ad = ads.filter((x) => ids2.has(x.store_id)).reduce((t, x) => t + +x.gmv * pr(x, R.from, R.to), 0), adP = ads.filter((x) => ids2.has(x.store_id)).reduce((t, x) => t + +x.gmv * pr(x, R.pf, R.pt), 0);
      if (!lv && !ad) return null;
      const tot = n.g || 1, ch = (a2: number, b2: number) => cmp && b2 ? <span className={a2 >= b2 ? "up" : "dn"}> {a2 >= b2 ? "▲" : "▼"} {Math.abs(pct(a2, b2)).toFixed(1).replace(".", ",")}%</span> : null;
      return <div className="card"><h2>Rincian kontribusi penjualan</h2><div className="contrib">
        <div className="tot"><span>Total penjualan (100%)</span><b>{fmt(n.g)}</b><small className="small">{ch(n.g, o.g)}</small></div>
        {lv > 0 && <div><span>Livestream (data laporan live)</span><b>{fmt(lv)}</b><small className="small muted">{Math.min(100, (lv / tot) * 100).toFixed(0).replace(".", ",")}% dari penjualan{ch(lv, lvP)}</small></div>}
        {lv > 0 && <div><span>Di luar livestream</span><b>{fmt(Math.max(0, n.g - lv))}</b><small className="small muted">{Math.max(0, 100 - (lv / tot) * 100).toFixed(0).replace(".", ",")}% dari penjualan</small></div>}
        {ad > 0 && <div><span>Dipengaruhi iklan (atribusi platform)</span><b>{fmt(ad)}</b><small className="small muted">{Math.min(100, (ad / tot) * 100).toFixed(0).replace(".", ",")}% dari penjualan{ch(ad, adP)}</small></div>}
      </div><p className="muted small">Kontribusi iklan dan livestream bisa saling tumpang tindih (pesanan dari live juga bisa tercatat sebagai hasil iklan), jadi persentasenya tidak dijumlahkan. Video & affiliate belum termasuk karena belum ada data hariannya.</p></div>; })()}
    <div className="card"><h2>Per toko</h2>
      {per.length > 1 && (() => { const P = ["Shopee", "TikTok"].map((pf) => ({ l: pf, v: per.filter((r) => r.s.platform === pf).reduce((a, r) => a + r.g, 0) })).filter((x) => x.v > 0); const t = P.reduce((a, x) => a + x.v, 0) || 1;
        return P.length > 1 ? <div className="pfrow"><div className="pfsplit">{P.map((x) => <i key={x.l} style={{ width: `${(x.v / t) * 100}%`, background: x.l === "Shopee" ? "var(--accent)" : "var(--aqua)" }} />)}</div>
          <div className="muted small">{P.map((x) => <span key={x.l} style={{ marginRight: 14 }}><b style={{ color: x.l === "Shopee" ? "var(--accent)" : "var(--aqua)" }}>■</b> {x.l} {fmt(x.v)} · {((x.v / t) * 100).toFixed(0).replace(".", ",")}%</span>)}</div></div> : null; })()}
      <div className="tbl"><table><thead><tr><th>Toko</th><th className="n">GMV</th><th className="n">Porsi</th><th className="n">Pesanan</th><th className="n">AOV</th><th className="n">Pengunjung</th><th className="n">Konversi</th><th className="n">Δ GMV</th><th>Tren</th><th>Data s.d.</th><th>Status</th></tr></thead>
      <tbody>{per.map((r) => <tr key={r.s.id}><td>{r.s.platform} · {r.s.brand}</td><td className="n">{fmt(r.g)}</td>
        <td className="n"><div className="minibar"><i style={{ width: `${(r.g / tot) * 100}%` }} /></div>{((r.g / tot) * 100).toFixed(0).replace(".", ",")}%</td>
        <td className="n">{r.o.toLocaleString("id")}</td><td className="n">{r.o ? fmt(r.aov) : "–"}</td><td className="n">{r.v != null ? r.v.toLocaleString("id") : "–"}</td><td className="n">{isFinite(r.cr) ? r.cr.toFixed(2).replace(".", ",") + "%" : "–"}</td>
        <td className={"n " + (!isFinite(r.ch) ? "" : r.ch >= 0 ? "up" : "dn")}>{!isFinite(r.ch) || R.key === "all" ? "–" : `${r.ch >= 0 ? "+" : ""}${r.ch.toFixed(1).replace(".", ",")}%`}</td>
        <td><Spark v={r.tr} /></td><td className="small">{r.last ? tgl(r.last) : "–"}</td>
        <td>{r.st ? <span className="pill mute">Data belum lengkap</span> : R.key === "all" ? "–" : r.ch < -25 ? <span className="pill bad">Turun tajam</span> : r.ch < -5 ? <span className="pill warn">Turun</span> : <span className="pill good">Stabil/naik</span>}</td></tr>)}</tbody></table></div>
      {staleN.length > 0 && <p className="muted small">Toko bertanda &quot;Data belum lengkap&quot; datanya berhenti lebih dari 3 hari sebelum akhir periode, jadi tidak dihitung dalam perbandingan.</p>}</div>
  </>);
}

/* ---------------- Iklan ---------------- */
const tipeIklan = (k: string, pf: string) => /gmv max/i.test(k) ? "GMV Max" : /otomatis/i.test(k) ? "Iklan Otomatis" : /total bulan/i.test(k) ? "Total iklan (bulanan)" : /^iklan toko|toko$/i.test(k) ? "Iklan Toko" : pf === "TikTok" ? "Iklan TikTok" : "Iklan Produk";
/* Bagian biaya/GMV sebuah baris iklan yang jatuh di rentang [a,b] (laporan bulanan dibagi rata per hari) */
const porsi = (x: Ad, a: string, b: string) => { const f = x.dari > a ? x.dari : a, t = x.sampai < b ? x.sampai : b; if (f > t) return 0; return (dayDiff(f, t) + 1) / (dayDiff(x.dari, x.sampai) + 1); };
/* Tab iklan: angka desimal 2 digit */
const fmt2 = (n: number) => fmt(n); // Rupiah tetap 1 desimal; ROAS & persen 2 desimal
type AMeta = { store_id: string; dari: string; sampai: string; kampanye: string; dilihat: number | null; klik: number | null; keranjang: number | null };
function IklanTab({ R, stores, ads, sales, meta = [], share = false, fr }: { fr?: { l: string; w?: string; src?: string }; R: Range; stores: Store[]; ads: Ad[]; sales: Sale[]; meta?: AMeta[]; share?: boolean }) {
  const nk = (s2: string) => s2.replace(/\s+/g, " ").trim().slice(0, 255);
  const MM = new Map(meta.map((m) => [m.store_id + "|" + m.dari + "|" + m.sampai + "|" + m.kampanye, m]));
  const ids = new Set(stores.map((s) => s.id)); const SM = new Map(stores.map((s) => [s.id, s]));
  const nameS = (id: string) => { const s = SM.get(id)!; return `${s.platform} · ${s.brand}`; };
  const all = ads.filter((a) => ids.has(a.store_id));
  const A = all.filter((a) => porsi(a, R.from, R.to) > 0), PA = all.filter((a) => porsi(a, R.pf, R.pt) > 0);
  if (!A.length) return <Empty title={`Belum ada data iklan untuk ${R.label.toLowerCase()} pada pilihan ini.`} up={!share} file={<>laporan iklan harian (Shopee: Iklan Shopee → Data Keseluruhan → Unduh; TikTok: Ads Manager / GMV Max → Ekspor).</>} />;
  type Ag = { s: number; g: number; o: number; dl: number; kl: number; kr: number; mt: boolean };
  const camp = (xs: Ad[], a: string, b: string) => { const C = new Map<string, Ag & { id: string; k: string }>(); xs.forEach((x) => { const w = porsi(x, a, b), key = x.store_id + "\u0001" + x.kampanye; const c = C.get(key) ?? { id: x.store_id, k: x.kampanye, s: 0, g: 0, o: 0, dl: 0, kl: 0, kr: 0, mt: false }; c.s += x.biaya * w; c.g += x.gmv * w; c.o += x.pesanan * w;
    const m = MM.get(x.store_id + "|" + x.dari + "|" + x.sampai + "|" + nk(x.kampanye)); if (m) { c.mt = true; c.dl += (+(m.dilihat ?? 0)) * w; c.kl += (+(m.klik ?? 0)) * w; c.kr += (+(m.keranjang ?? 0)) * w; } C.set(key, c); }); return C; };
  const C = camp(A, R.from, R.to), CP = camp(PA, R.pf, R.pt);
  const S = [...C.values()].reduce((a, c) => a + c.s, 0), G = [...C.values()].reduce((a, c) => a + c.g, 0), roas = S ? G / S : 0;
  const Sp = [...CP.values()].reduce((a, c) => a + c.s, 0), Gp = [...CP.values()].reduce((a, c) => a + c.g, 0), roasP = Sp ? Gp / Sp : 0;
  const om = sales.filter((s) => ids.has(s.store_id) && s.tanggal >= R.from && s.tanggal <= R.to).reduce((a, s) => a + s.gmv, 0);
  const omP = sales.filter((s) => ids.has(s.store_id) && s.tanggal >= R.pf && s.tanggal <= R.pt).reduce((a, s) => a + s.gmv, 0);
  const cmp = R.key !== "all" && Sp > 0;
  // Status tanpa target: dibandingkan dengan ROAS rata-rata periode ini
  const sorted = [...C.values()].map((c) => c.s).sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const rows: CRow[] = [...C.entries()].map(([key, c]) => { const r = c.s ? c.g / c.s : 0, p = CP.get(key), rp = p && p.s ? p.g / p.s : null, s0 = SM.get(c.id)!;
    const st = c.s >= 100_000 && c.o < 0.5 ? "nol" : c.s >= S * 0.03 && r < roas * 0.6 ? "boros" : r >= roas * 1.3 && c.s <= Math.max(med, S * 0.03) && c.o >= 1 ? "scale" : "normal";
    return { k: key, toko: nameS(c.id), platform: s0.platform, tipe: tipeIklan(c.k, s0.platform), nama: c.k, s: c.s, g: c.g, o: Math.round(c.o), r, dr: rp == null || !cmp ? null : r - rp, st, dl: c.mt ? c.dl : null, kl: c.mt ? c.kl : null }; }).sort((a, b) => b.s - a.s);
  const boros = rows.filter((r) => r.st === "boros"), scale = rows.filter((r) => r.st === "scale").sort((a, b) => b.r - a.r), nol = rows.filter((r) => r.st === "nol");
  // Tren
  const B = buckets(R.from, R.to);
  const tr = B.map((k) => A.reduce((a, x) => { const w = porsi(x, k.f, k.t); a.s += x.biaya * w; a.g += x.gmv * w; return a; }, { s: 0, g: 0 }));
  const monthly = A.some((x) => dayDiff(x.dari, x.sampai) > 6) && B[0].f === B[0].t;
  // Per toko
  const per = stores.map((st) => { const cs = rows.filter((r) => r.k.startsWith(st.id + "\u0001")), ps = [...CP.entries()].filter(([k]) => k.startsWith(st.id + "\u0001")).map(([, v]) => v);
    const s = cs.reduce((a, r) => a + r.s, 0), g = cs.reduce((a, r) => a + r.g, 0), o = cs.reduce((a, r) => a + r.o, 0), sp = ps.reduce((a, r) => a + r.s, 0), gp = ps.reduce((a, r) => a + r.g, 0);
    const oms = sales.filter((x) => x.store_id === st.id && x.tanggal >= R.from && x.tanggal <= R.to).reduce((a, x) => a + x.gmv, 0);
    return { st, s, g, o, r: s ? g / s : 0, rp: sp ? gp / sp : null, sp, bo: oms ? (s / oms) * 100 : null }; }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  // Keterangan periode data
  const harian = A.filter((x) => x.dari === x.sampai).length, bulanan = A.length - harian;
  const ket = [harian ? `harian (${[...new Set(A.filter((x) => x.dari === x.sampai).map((x) => SM.get(x.store_id)!.platform))].join(", ")})` : "", bulanan ? `bulanan (${[...new Set(A.filter((x) => x.dari !== x.sampai).map((x) => SM.get(x.store_id)!.platform))].join(", ")}, dibagi rata per hari kalau periodenya tidak sebulan penuh)` : ""].filter(Boolean).join(" dan ");
  const sumB = boros.reduce((a, r) => a + r.s, 0);
  const L = (t: string, xs: CRow[], f: (r: CRow) => string, cls: string, hint: string) => <div className="act"><h3><span className={"pill " + cls}>{xs.length}</span> {t}</h3><p className="muted small" style={{ margin: "-4px 0 8px" }}>{hint}</p>{xs.length ? <ul>{xs.slice(0, 5).map((r) => <li key={r.k} title={r.nama}><b>{shortName(r.nama)}</b> <span className="muted small">{r.toko} · {f(r)}</span></li>)}{xs.length > 5 && <li className="muted small">+{xs.length - 5} lainnya (filter status di tabel)</li>}</ul> : <p className="muted small">Tidak ada.</p>}</div>;
  return (<>
    <p className="muted small">Data iklan: {ket}.</p>
    <div className="ichart"><Insight src="Data asli" sum={[`Biaya iklan ${fmt2(S)}${om ? ` (${(S / om * 100).toFixed(2).replace(".", ",")}% dari GMV toko)` : ""}, ROAS ${roas.toFixed(2).replace(".", ",")}${cmp ? ` (${roas >= roasP ? "naik" : "turun"} dari ${roasP.toFixed(2).replace(".", ",")} ${R.sub})` : ""}.`, ...(per.length > 1 ? [`Biaya terbesar: ${per[0].st.brand} · ${per[0].st.platform} (${fmt2(per[0].s)}, ROAS ${per[0].r.toFixed(2).replace(".", ",")}).`] : [])]}
      ana={[...(boros.length ? [`${boros.length} kampanye boros menyerap ${fmt2(sumB)} (${(sumB / S * 100).toFixed(0).replace(".", ",")}% biaya) dengan ROAS di bawah ${(roas * 0.6).toFixed(2).replace(".", ",")}.`] : []), ...(nol.length ? [`${nol.length} kampanye keluar biaya tanpa pesanan (${fmt2(nol.reduce((a, r) => a + r.s, 0))}).`] : []), ...(scale.length ? [`${scale.length} kampanye efisien (ROAS ≥ ${(roas * 1.3).toFixed(2).replace(".", ",")}) masih berbiaya kecil.`] : [])]}
      next={[...(boros.length ? [`Pangkas atau turunkan bid ${boros.length} kampanye boros, hemat sampai ${fmt2(sumB * 0.5)}.`] : []), ...(nol.length ? [`Matikan atau ganti produk di ${nol.length} kampanye tanpa penjualan.`] : []), ...(scale.length ? [`Naikkan budget ${Math.min(5, scale.length)} kampanye "bisa di-scale" 20–30%, evaluasi 3 hari.`] : [])]} />
    {(() => { const B0 = buckets(R.from, R.to), PB0 = dayDiff(R.from, R.to) >= 13 ? buckets(R.pf, R.pt) : null;
      const ser = (bs: { f: string; t: string }[]) => bs.map((k) => { const r = all.reduce((a, x) => { const w = porsi(x, k.f, k.t); a.s += x.biaya * w; a.g += x.gmv * w; a.o += x.pesanan * w; return a; }, { s: 0, g: 0, o: 0 });
        const om2 = sales.filter((x) => ids.has(x.store_id) && x.tanggal >= k.f && x.tanggal <= k.t).reduce((a, x) => a + x.gmv, 0); return { ...r, om: om2 }; });
      const c = ser(B0), pv = PB0 ? ser(PB0) : null, Oo = [...C.values()].reduce((a, x) => a + x.o, 0), Op = [...CP.values()].reduce((a, x) => a + x.o, 0);
      const M: Metric[] = [
        { g: "Biaya & hasil", k: "s", l: "Biaya iklan", f: "rp", v: S, p: cmp ? Sp : null, inv: true, s: c.map((x) => x.s), ps: pv?.map((x) => x.s) },
        { g: "Biaya & hasil", k: "g", l: "GMV atribusi iklan", f: "rp", v: G, p: cmp ? Gp : null, s: c.map((x) => x.g), ps: pv?.map((x) => x.g) },
        { g: "Efisiensi", k: "r", l: "ROAS", f: "x", v: roas, ex: S ? `${fmt(G)} ÷ ${fmt(S)} = ${roas.toFixed(2).replace(".", ",")}` : undefined, p: cmp ? roasP : null, s: c.map((x) => (x.s ? x.g / x.s : 0)), ps: pv?.map((x) => (x.s ? x.g / x.s : 0)) },
        { g: "Biaya & hasil", k: "o", l: "Pesanan dari iklan", f: "n", v: Oo, p: cmp ? Op : null, s: c.map((x) => x.o), ps: pv?.map((x) => x.o) },
        { g: "Efisiensi", k: "cpa", l: "Biaya per pesanan", f: "rp", v: Oo ? S / Oo : NaN, ex: Oo ? `${fmt(S)} ÷ ${Math.round(Oo).toLocaleString("id")} pesanan = ${fmt(S / Oo)}` : undefined, p: cmp && Op ? Sp / Op : null, inv: true, s: c.map((x) => (x.o ? x.s / x.o : 0)), ps: pv?.map((x) => (x.o ? x.s / x.o : 0)) },
        ...((() => { const cs = [...C.values()].filter((x) => x.mt), ps = [...CP.values()].filter((x) => x.mt); if (!cs.length) return [] as Metric[];
          const dl = cs.reduce((t, x) => t + x.dl, 0), kl = cs.reduce((t, x) => t + x.kl, 0), kr = cs.reduce((t, x) => t + x.kr, 0), dlP = ps.reduce((t, x) => t + x.dl, 0), klP = ps.reduce((t, x) => t + x.kl, 0), krP = ps.reduce((t, x) => t + x.kr, 0);
          const nt = "Shopee saja, laporan bulanan";
          return [{ g: "Jangkauan (Shopee)", k: "dl", l: "Iklan dilihat", f: "n", v: dl, p: cmp && dlP ? dlP : null, s: c.map(() => NaN), note: nt },
            { g: "Jangkauan (Shopee)", k: "kl", l: "Klik", f: "n", v: kl, p: cmp && klP ? klP : null, s: c.map(() => NaN), note: nt },
            { g: "Jangkauan (Shopee)", k: "ctr", l: "Persentase klik", f: "pct", v: dl ? (kl / dl) * 100 : NaN, p: cmp && dlP ? (klP / dlP) * 100 : null, s: c.map(() => NaN), note: nt },
            { g: "Jangkauan (Shopee)", k: "kr", l: "Tambah ke keranjang", f: "n", v: kr, p: cmp && krP ? krP : null, s: c.map(() => NaN), note: nt }] as Metric[]; })()),
        { g: "Efisiensi", k: "bo", l: "Biaya iklan / GMV toko", f: "pct", v: om ? (S / om) * 100 : NaN, ex: om ? `${fmt(S)} ÷ ${fmt(om)} × 100 = ${((S / om) * 100).toFixed(2).replace(".", ",")}%` : undefined, p: cmp && omP ? (Sp / omP) * 100 : null, inv: true, s: c.map((x) => (x.om ? (x.s / x.om) * 100 : 0)), ps: pv?.map((x) => (x.om ? (x.s / x.om) * 100 : 0)) },
      ];
      return <MetricBoard metrics={M} labels={B0.map((b) => b.l)} sub={R.sub} init={["s", "r"]} dec={2} fresh={fr} />; })()}</div>
    {((G > om && om > 0) || monthly) && <details className="infod"><summary>ⓘ Catatan data iklan</summary>{G > om && om > 0 && <p className="muted small">GMV atribusi iklan bisa lebih besar dari GMV toko: platform menghitung pesanan dalam beberapa hari setelah klik (satu pesanan bisa tercatat di lebih dari satu kampanye) dan belum mengurangi pembatalan sebelum pesanan dikirim.</p>}
      {monthly && <p className="muted small">Laporan bulanan Shopee dibagi rata per hari, jadi angka hariannya perkiraan.</p>}</details>}
    {per.length > 0 && <div className="card"><h2>Per toko</h2><div className="tbl"><table><thead><tr><th>Toko</th><th className="n">Biaya</th><th className="n">GMV iklan</th><th className="n">Pesanan</th><th className="n">ROAS</th><th className="n">Δ ROAS</th><th className="n">Biaya / omzet</th></tr></thead>
      <tbody>{per.map((x) => <tr key={x.st.id}><td>{x.st.platform} · {x.st.brand}</td><td className="n">{fmt2(x.s)}</td><td className="n">{fmt2(x.g)}</td><td className="n">{x.o.toLocaleString("id")}</td><td className="n">{x.r.toFixed(2).replace(".", ",")}</td>
        <td className={"n " + (x.rp == null || !cmp ? "" : x.r >= x.rp ? "up" : "dn")}>{x.rp == null || !cmp ? "–" : `${x.r - x.rp >= 0 ? "+" : ""}${(x.r - x.rp).toFixed(2).replace(".", ",")}`}</td><td className="n">{x.bo != null ? x.bo.toFixed(2).replace(".", ",") + "%" : "–"}</td></tr>)}</tbody></table></div></div>}
    {(boros.length + scale.length + nol.length) > 0 && <div className="card"><h2>Perlu tindakan</h2><div className="acts">
      {L("Boros", boros, (r) => `${fmt2(r.s)} · ROAS ${r.r.toFixed(2).replace(".", ",")}`, "bad", `Biaya ≥3% total, ROAS < ${(roas * 0.6).toFixed(2).replace(".", ",")}`)}
      {L("Bisa di-scale", scale, (r) => `${fmt2(r.s)} · ROAS ${r.r.toFixed(2).replace(".", ",")}`, "good", `ROAS ≥ ${(roas * 1.3).toFixed(2).replace(".", ",")}, biaya masih kecil`)}
      {L("Tanpa penjualan", nol, (r) => `${fmt2(r.s)} · 0 pesanan`, "bad", "Biaya ≥ Rp100 rb, 0 pesanan")}
    </div><p className="muted small">Patokan memakai ROAS rata-rata periode ini ({roas.toFixed(2).replace(".", ",")}), sampai KPI tiap klien diisi.</p></div>}
    <div className="card"><h2>Daftar iklan</h2><IklanTable rows={rows} lite={share} /></div>
  </>);
}

/* ---------------- Livestream ---------------- */
const SLOTS: [number, number, string, string][] = [[0, 6, "00–06", "Dini hari"], [6, 12, "06–12", "Pagi"], [12, 18, "12–18", "Siang–sore"], [18, 24.5, "18–24", "Malam"]];
type Jd = { tanggal: string; mulai: string; selesai: string; host: string };
const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const dow = (d: string) => (new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7; // 0 = Senin
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
  const tglJadwal = new Set(jadwal.map((j) => j.tanggal));
  const tanpa = live.filter((l) => !used.has(l) && tglJadwal.has(l.tanggal));
  return <div className="card"><h2>Jadwal vs realisasi</h2><div className="tbl"><table><thead><tr><th>Host</th><th className="n">Jadwal</th><th className="n">Jam terjadwal</th><th className="n">Jam live sesuai jadwal</th><th className="n">Realisasi</th><th className="n">Jadwal tanpa live</th></tr></thead>
    <tbody>{rows.map((x) => { const p = x.j ? (x.r / x.j) * 100 : 0; return <tr key={x.nama}><td>{x.nama}</td><td className="n">{x.n}</td><td className="n">{jm(x.j)}</td><td className="n">{jm(x.r)}</td>
      <td className="n"><span className={"pill " + (p >= 90 ? "good" : p >= 70 ? "warn" : "bad")}>{p.toFixed(0).replace(".", ",")}%</span></td><td className={"n" + (x.miss ? " dn" : "")}>{x.miss || "–"}</td></tr>; })}</tbody></table></div>
    <p className="muted small">Jam live dihitung dari sesi di laporan live dengan nama host yang sama, yang mulai paling cepat 1 jam sebelum jadwal sampai jadwal selesai.
      {` Dibandingkan hanya pada ${tglJadwal.size} tanggal yang sudah punya jadwal.`}{tanpa.length ? ` Di tanggal itu ada ${tanpa.length} sesi live (${jm(tanpa.reduce((a, l) => a + l.durasi_jam, 0))}) yang tidak sesuai jadwal: ${[...new Set(tanpa.map((l) => l.host || "tanpa nama"))].join(", ")}.` : ""}</p></div>;
}

function LiveTab({ R, live, brand, plat, jadwal, fr }: { fr?: { l: string; w?: string; src?: string }; R: Range; live: Live[]; brand?: string; plat?: string; jadwal: Jd[] }) {
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
  // Minggu (Senin–Minggu) dalam periode, untuk tren GMV/jam per host
  const WK: { f: string; t: string }[] = []; { let f = R.from; while (f <= R.to) { const d = dow(f), t0 = addDays(f, 6 - d); WK.push({ f, t: t0 < R.to ? t0 : R.to }); f = addDays(t0, 1); } }
  const mxD = Math.max(1, ...HARI.flatMap((_, d) => SLOTS.map((__, i) => { const v = slot(cur.filter((x) => dow(x.tanggal) === d), i); return v.j >= 0.5 ? v.g / v.j : 0; })));
  const weak = cur.filter((x) => x.durasi_jam >= 1).sort((a, b) => gf(a) / a.durasi_jam - gf(b) / b.durasi_jam).slice(0, 10);
  return (<>
    <p className="note">Periode: {R.label}. Durasi dihitung sekali per sesi walau live di Shopee dan TikTok bersamaan.</p>
    <div className="ichart"><Insight src="Data asli" sum={[`GMV live ${fmt(a.g)} dari ${a.n} sesi (${jm(a.j)})${R.key === "all" ? "" : `, ${pct(a.g, b.g) >= 0 ? "naik" : "turun"} ${Math.abs(pct(a.g, b.g)).toFixed(1).replace(".", ",")}% ${R.sub}`}.`, `Rata-rata ${fmt(gj)} per jam.`, `Shopee ${fmt(a.gs)} · TikTok ${fmt(a.gt)}.`]}
      ana={[...(best && worst && best !== worst ? [`Slot ${SLOTS[best.i][2]} paling produktif (${fmt(best.g)}/jam), slot ${SLOTS[worst.i][2]} paling lemah (${fmt(worst.g)}/jam).`] : []), ...(effi.length > 1 ? [`GMV/jam tertinggi: ${effi[0].k} (${fmt(effi[0].s.g / effi[0].s.j)}); terendah: ${effi[effi.length - 1].k}.`] : []), ...(zr > 15 ? [`${zr.toFixed(0).replace(".", ",")}% sesi ≥1 jam berakhir Rp0.`] : [])]}
      next={[...(best && worst && best !== worst ? [`Geser jam dari slot ${SLOTS[worst.i][2]} ke ${SLOTS[best.i][2]}, atau coba promo khusus di slot ${SLOTS[worst.i][2]}.`] : []), ...(effi.length > 1 ? [`Tempatkan ${effi[0].k} di slot terbaik; dampingi ${effi[effi.length - 1].k} dengan review rekaman dan skrip penawaran.`] : []), "Cek sesi Rp0: produk yang dipajang, voucher live, dan jam tayang."]} />
    {(() => { const PBl = dayDiff(R.from, R.to) >= 13 ? buckets(R.pf, R.pt) : null;
      const sr2 = (bs: { f: string; t: string }[]) => bs.map((k) => { const xs = L.filter((x) => x.tanggal >= k.f && x.tanggal <= k.t); const a2 = agg(xs); return { ...a2, pen: xs.reduce((s2, x) => s2 + (x.penonton ?? 0), 0) }; });
      const c = sr2(B), pv = PBl ? sr2(PBl) : null, pen = cur.reduce((s2, x) => s2 + (x.penonton ?? 0), 0), penP = prev.reduce((s2, x) => s2 + (x.penonton ?? 0), 0), hasPen = cur.some((x) => x.penonton != null), cm = R.key !== "all" && b.n > 0;
      // Penonton hanya dibandingkan kalau kedua periode punya data penonton hampir lengkap
      const cov = (xs: Live[]) => xs.length ? xs.filter((x) => x.penonton != null).length / xs.length : 0, cmPen = cm && cov(cur) > 0.9 && cov(prev) > 0.9;
      const M: Metric[] = [
        { g: "Transaksi", k: "g", l: "GMV live", f: "rp", v: a.g, p: cm ? b.g : null, s: c.map((x) => x.g), ps: pv?.map((x) => x.g) },
        { g: "Kunjungan", k: "rd", l: "Rata-rata durasi", f: "jam", v: a.n ? a.j / a.n : NaN, p: cm && b.n ? b.j / b.n : null, s: c.map((x) => (x.n ? x.j / x.n : 0)), ps: pv?.map((x) => (x.n ? x.j / x.n : 0)) },
        { g: "Kunjungan", k: "j", l: "Durasi live", f: "jam", v: a.j, p: cm ? b.j : null, s: c.map((x) => x.j), ps: pv?.map((x) => x.j) },
        { g: "Kunjungan", k: "n", l: "Sesi", f: "n", v: a.n, p: cm ? b.n : null, s: c.map((x) => x.n), ps: pv?.map((x) => x.n) },
        { g: "Konversi", k: "gj", l: "GMV per jam", f: "rp", v: gj, ex: a.j ? `${fmt(a.g)} ÷ ${jm(a.j)} = ${fmt(gj)}` : undefined, p: cm ? gjp : null, s: c.map((x) => (x.j ? x.g / x.j : 0)), ps: pv?.map((x) => (x.j ? x.g / x.j : 0)) },
        ...(hasPen ? [{ g: "Kunjungan", k: "pen", l: "Penonton", f: "n", v: pen, p: cmPen ? penP : null, note: cmPen ? undefined : "data penonton belum lengkap untuk dibandingkan", s: c.map((x) => x.pen), ps: pv?.map((x) => x.pen) } as Metric,
          { g: "Konversi", k: "gp", l: "GMV per penonton", f: "rp", v: pen ? a.g / pen : NaN, p: cmPen && penP ? b.g / penP : null, note: cmPen ? undefined : "data penonton belum lengkap untuk dibandingkan", s: c.map((x) => (x.pen ? x.g / x.pen : 0)), ps: pv?.map((x) => (x.pen ? x.g / x.pen : 0)) } as Metric] : []),
        { g: "Transaksi", k: "gs", l: "GMV Shopee", f: "rp", v: a.gs, p: cm ? b.gs : null, s: c.map((x) => x.gs), ps: pv?.map((x) => x.gs) },
        { g: "Transaksi", k: "gt", l: "GMV TikTok", f: "rp", v: a.gt, p: cm ? b.gt : null, s: c.map((x) => x.gt), ps: pv?.map((x) => x.gt) },
        { g: "Konversi", k: "z", l: "Sesi tanpa penjualan", f: "pct", v: zr, p: cm && b.n ? (b.z / b.n) * 100 : null, inv: true, s: c.map((x) => (x.n ? (x.z / x.n) * 100 : 0)) },
      ];
      return <MetricBoard metrics={M} labels={B.map((x) => x.l)} sub={R.sub} init={["g", "gj"]} fresh={fr} />; })()}</div>
    <JadwalVsLive jadwal={jadwal} live={cur} />
    <div className="card"><h2>Per host</h2><div className="tbl"><table><thead><tr><th>Host</th><th className="n">GMV</th><th className="n">Shopee</th><th className="n">TikTok</th><th className="n">Durasi</th><th className="n">Sesi</th><th className="n">GMV/jam</th><th className="n">Δ GMV/jam</th><th className="n">Sesi Rp0</th><th>Slot terbaik</th><th>Tren GMV/jam</th></tr></thead>
      <tbody>{hs.map((h) => { const p = agg(prev.filter((x) => (x.host || "Tanpa nama") === h.k)), gjH = h.s.g / h.s.j, gjPrev = p.j ? p.g / p.j : 0, d = gjPrev && R.key !== "all" ? pct(gjH, gjPrev) : NaN;
        const bs = SLOTS.map((_, i) => { const v = slot(h.v, i); return { i, g: v.j >= 1 ? v.g / v.j : -1 }; }).sort((x, y) => y.g - x.g)[0];
        const tw = WK.map((w) => { const v = agg(h.v.filter((x) => x.tanggal >= w.f && x.tanggal <= w.t)); return v.j ? v.g / v.j : 0; });
        return <tr key={h.k}><td><b>{h.k}</b>{h === hs[0] ? <div className="muted small">GMV terbesar</div> : h.k === effi[0]?.k ? <div className="muted small">Paling efisien</div> : null}</td><td className="n">{fmt(h.s.g)}</td><td className="n">{fmt(h.s.gs)}</td><td className="n">{fmt(h.s.gt)}</td><td className="n">{jm(h.s.j)}</td><td className="n">{h.s.n}</td><td className="n"><b>{fmt(gjH)}</b></td>
          <td className={"n " + (!isFinite(d) ? "" : d >= 0 ? "up" : "dn")}>{isFinite(d) ? `${d >= 0 ? "+" : ""}${d.toFixed(0).replace(".", ",")}%` : "–"}</td><td className="n">{h.s.n ? ((h.s.z / h.s.n) * 100).toFixed(0).replace(".", ",") + "%" : "–"}</td><td className="small">{bs && bs.g > 0 ? `${SLOTS[bs.i][2]} (${fmt(bs.g)}/jam)` : "–"}</td><td>{WK.length > 1 ? <Spark v={tw} /> : "–"}</td></tr>; })}</tbody></table></div>
      {WK.length > 1 && <p className="muted small">Tren = GMV per jam per minggu ({WK.length} minggu). Δ dibanding {R.sub.replace(/^vs /, "")}.</p>}</div>
    <div className="card"><h2>GMV/jam per host & slot</h2><div className="tbl"><div className="hm">
      <div />{SLOTS.map((s) => <div key={s[2]} className="hmh"><b>{s[2]}</b><span>{s[3]}</span></div>)}
      {hs.slice(0, 10).map((h, i) => [<div key={h.k} className="hmn">{h.k}</div>, ...cells[i].map((c, j) => c.g === null ? <div key={j} className="hmc none">Tidak live</div> : <div key={j} className={"hmc l" + Math.min(4, Math.floor((c.g / mx) * 5))}><b>{fk(c.g)}</b><span>Rp{fk(c.v.g)} · {jm(c.v.j)}</span></div>)])}
    </div></div><p className="muted small">Angka besar = GMV per jam. Baris kecil = total GMV · durasi. Dikelompokkan menurut jam mulai live.</p></div>
    <div className="card"><h2>GMV/jam per hari & slot</h2><div className="tbl"><div className="hm">
      <div />{SLOTS.map((s) => <div key={s[2]} className="hmh"><b>{s[2]}</b><span>{s[3]}</span></div>)}
      {HARI.map((nm, d) => [<div key={nm} className="hmn">{nm}</div>, ...SLOTS.map((_, i) => { const v = slot(cur.filter((x) => dow(x.tanggal) === d), i); const g = v.j >= 0.5 ? v.g / v.j : null;
        return g === null ? <div key={i} className="hmc none">Tidak live</div> : <div key={i} className={"hmc l" + Math.min(4, Math.floor((g / mxD) * 5))}><b>{fk(g)}</b><span>Rp{fk(v.g)} · {jm(v.j)}</span></div>; })])}
    </div></div><p className="muted small">Untuk menyusun jadwal: kotak paling gelap = kombinasi hari & jam dengan GMV per jam tertinggi.</p></div>
    {weak.length > 0 && <div className="card"><h2>10 sesi terlemah</h2><div className="tbl"><table><thead><tr><th>Tanggal</th><th>Jam</th><th>Host</th><th className="n">Durasi</th><th className="n">GMV</th><th className="n">GMV/jam</th><th className="n">vs rata-rata host</th></tr></thead>
      <tbody>{weak.map((x, i) => { const hh2 = hs.find((h) => h.k === (x.host || "Tanpa nama")), avg = hh2 ? hh2.s.g / hh2.s.j : 0, g = gf(x) / x.durasi_jam;
        return <tr key={i}><td>{HARI[dow(x.tanggal)]}, {tgl(x.tanggal)}</td><td>{String(Math.floor(x.jam_mulai)).padStart(2, "0")}:{String(Math.round((x.jam_mulai % 1) * 60)).padStart(2, "0")}</td><td>{x.host || "–"}</td><td className="n">{jm(x.durasi_jam)}</td><td className="n">{fmt(gf(x))}</td><td className="n">{fmt(g)}</td><td className="n dn">{avg ? `${pct(g, avg).toFixed(0).replace(".", ",")}%` : "–"}</td></tr>; })}</tbody></table></div>
      <p className="muted small">Sesi ≥1 jam dengan GMV per jam terendah. Cek rekaman: produk yang dipajang, voucher live, dan alur penawaran.</p></div>}
    <div className="card"><h2>Daftar sesi live</h2><LiveSessions rows={cur.map((x) => ({ tgl: x.tanggal, hari: HARI[dow(x.tanggal)], jam: `${String(Math.floor(x.jam_mulai)).padStart(2, "0")}:${String(Math.round((x.jam_mulai % 1) * 60) % 60).padStart(2, "0")}`, host: x.host || "Tanpa nama", dur: x.durasi_jam, pen: x.penonton, gs: plat === "TikTok" ? 0 : x.gmv_shopee, gt: plat === "Shopee" ? 0 : x.gmv_tiktok }))} /></div>
    <div className="card"><h2>GMV live per {B[0].f === B[0].t ? "hari" : "bulan"}</h2><Bars title="GMV live" labels={B.map((x) => x.l)} series={[ser("gmv_shopee"), ser("gmv_tiktok")]} colors={["var(--accent)", "var(--aqua)"]} /><p className="muted small"><span style={{ color: "var(--accent)" }}>■</span> Shopee <span style={{ color: "var(--aqua)" }}>■</span> TikTok</p></div>
  </>);
}

/* ---------------- Analisa produk ---------------- */
type Prod = { grup: string; nama: string; kode: string[] | null; gmv: number; qty: number; pesanan: number; gmv_prev: number; qty_prev: number; toko: string[] | null; varian: PRow["varian"] };
type PStats = { st: PRow[]; tokoName: Record<string, string>; sum: string[]; ana: string[]; next: string[]; stop: PRow[]; turun: PRow[]; baru: PRow[]; naik: PRow[] };
function prodStats(rows: Prod[], stores: Store[], PM: Map<string, { dl: number; kl: number; kr: number; pg: number }> = new Map()): PStats {
  const tokoName: Record<string, string> = Object.fromEntries(stores.map((s) => [s.id, `${s.platform === "TikTok" ? "TT" : s.platform === "Shopee" ? "SP" : s.platform} ${s.brand}`]));
  const P = rows.map((r) => ({ ...r, gmv: +r.gmv, gmv_prev: +r.gmv_prev, qty: +r.qty, qty_prev: +r.qty_prev }));
  const tot = P.reduce((a, r) => a + r.gmv, 0) || 1;
  let cum = 0;
  const st: PRow[] = P.map((r) => { cum += r.gmv; const ch = pct(r.gmv, r.gmv_prev);
    const status = r.gmv === 0 && r.qty_prev >= 10 ? "stop" : r.gmv_prev === 0 && r.gmv > 0 ? "baru" : cum - r.gmv < tot * 0.8 && r.gmv > 0 ? "andalan" : ch <= -30 && r.gmv_prev > tot * 0.005 ? "turun" : ch >= 30 && r.gmv > tot * 0.005 ? "naik" : "biasa";
    return { grup: r.grup, nama: r.nama ?? r.grup, kode: r.kode, gmv: r.gmv, qty: r.qty, ch, prev: r.gmv_prev, share: (r.gmv / tot) * 100, cum: (cum / tot) * 100, status, toko: r.toko ?? [], tokoLabel: (r.toko ?? []).map((t) => tokoName[t] ?? t).join(", "), varian: r.varian, sc: PM.get(String(r.nama ?? "").trim().toLowerCase()) ?? null }; });
  const nm = (r: PRow) => shortName(r.nama);
  const sold = st.filter((r) => r.gmv > 0), andalan = st.filter((r) => r.status === "andalan"), stop = st.filter((r) => r.status === "stop");
  const turun = st.filter((r) => r.prev > tot * 0.005 && r.ch <= -50 && r.gmv > 0).sort((a, b) => a.gmv - a.prev - (b.gmv - b.prev)), naik = st.filter((r) => r.status === "naik").sort((a, b) => b.gmv - b.prev - (a.gmv - a.prev)), baru = st.filter((r) => r.status === "baru");
  if (!sold.length) return { st, tokoName, sum: [], ana: [], next: [], stop, turun, baru, naik };
  return { st, tokoName, stop, turun, baru, naik,
    sum: [`${andalan.length} dari ${sold.length} SKU menyumbang 80% GMV; terlaris ${nm(sold[0])} (${sold[0].share.toFixed(0).replace(".", ",")}%).`],
    ana: [...(stop.length ? [`${stop.length} SKU yang biasanya laku berhenti terjual.`] : []), ...turun.slice(0, 1).map((r) => `${nm(r)} turun ${Math.abs(r.ch).toFixed(0).replace(".", ",")}% (${fmt(r.prev)} → ${fmt(r.gmv)}).`)],
    next: [...(stop.length ? [`Cek stok & listing SKU yang berhenti terjual (lihat "Perlu tindakan").`] : []), ...(naik.length ? [`Tambah stok dan exposure ${nm(naik[0])} selagi naik.`] : [])] };
}
function ProdukSection({ R, ps, err }: { R: Range; ps: PStats; err?: string }) {
  return <div id="produk">{ProdukSection0({ R, ps, err })}</div>;
}
function ProdukSection0({ R, ps, err }: { R: Range; ps: PStats; err?: string }) {
  if (err) return <div className="card"><h2>Analisa produk</h2><p className="err">Data produk gagal dimuat: {err}</p></div>;
  if (!ps.st.length) return (
    <div className="card"><h2>Analisa produk</h2><Empty title="Belum ada data penjualan per produk untuk pilihan ini." up={false} file={<>ekspor pesanan (Shopee: Pesanan Saya → Ekspor; TikTok: Pesanan → Ekspor).</>} /></div>);
  const L = (t: string, xs: PRow[], f: (r: PRow) => string, cls: string) => <div className="act"><h3><span className={"pill " + cls}>{xs.length}</span> {t}</h3>{xs.length ? <ul>{xs.slice(0, 6).map((r) => <li key={r.grup} title={r.nama}><b>{shortName(r.nama)}</b> <span className="muted small">{f(r)}</span></li>)}{xs.length > 6 && <li className="muted small">+{xs.length - 6} lainnya (filter status di tabel)</li>}</ul> : <p className="muted small">Tidak ada.</p>}</div>;
  return (<>
    <h2 style={{ margin: "8px 0 0" }}>Analisa produk per SKU</h2>
    <div className="card"><h2>Analisis produk</h2>
      <ProdukDiag sub={R.sub} groups={[
        { k: "turun", l: "Penurunan penjualan", def: "penjualan SKU turun 50% atau lebih dibanding periode pembanding (SKU dengan porsi ≥0,5%).", rows: ps.turun.map((r) => ({ grup: r.grup, nama: r.nama, toko: r.tokoLabel, prev: r.prev, gmv: r.gmv })) },
        { k: "stop", l: "Berhenti terjual", def: "laku ≥10 unit di periode pembanding, tidak terjual sama sekali di periode ini. Cek stok & status listing.", rows: ps.stop.map((r) => ({ grup: r.grup, nama: r.nama, toko: r.tokoLabel, prev: r.prev, gmv: r.gmv })) },
        { k: "naik", l: "Penjualan naik", def: "penjualan naik 30% atau lebih (SKU dengan porsi ≥0,5%). Tambah stok & exposure.", rows: ps.naik.map((r) => ({ grup: r.grup, nama: r.nama, toko: r.tokoLabel, prev: r.prev, gmv: r.gmv })) },
        { k: "baru", l: "Baru mulai laku", def: "tidak terjual di periode pembanding, mulai terjual di periode ini.", rows: ps.baru.map((r) => ({ grup: r.grup, nama: r.nama, toko: r.tokoLabel, prev: r.prev, gmv: r.gmv })) },
      ]} /></div>
    <div className="card"><h2>Produk dengan performa terbaik · {R.label}</h2>
      <ProdukTable rows={ps.st} tokoName={ps.tokoName} />
      <p className="muted small">Klik baris untuk melihat SKU varian. SKU induk = kode SKU sebelum titik pertama; kode sama di toko berbeda digabung. Andalan = SKU teratas yang bersama-sama menyumbang 80% GMV (lihat kolom Kumulatif). Berhenti terjual = laku ≥10 unit di periode pembanding, 0 di periode ini. Pembanding: {R.sub}.</p>
    </div>
  </>);
}

/* ---------------- Link klien: laporan versi baca ---------------- */
function LaporTab({ R, c, K, stores, sales, prod, aff, last, detail }: { R: Range; c: Cl; K: ReturnType<typeof hitung>; stores: Store[]; sales: Sale[]; prod: Prod[]; aff: number; last: string | null; detail: string }) {
  const ids = new Set(stores.map((s) => s.id));
  const B = buckets(R.from, R.to);
  const shift = dayDiff(R.pf, R.from);
  const g = (a: string, b: string) => sales.filter((x) => ids.has(x.store_id) && x.tanggal >= a && x.tanggal <= b).reduce((t, x) => t + +x.gmv, 0);
  const cur = B.map((b) => g(b.f, b.t)), prv = R.key === "all" ? [] : B.map((b) => g(addDays(b.f, -shift), addDays(b.t, -shift)));
  const mx = Math.max(1, ...cur, ...prv), W = 600, H = 160, x = (i: number) => (B.length < 2 ? 0 : (i * W) / (B.length - 1)), y = (v: number) => H - 14 - (v / mx) * (H - 28);
  const line = (v: number[]) => v.map((n, i) => `${x(i).toFixed(1)},${y(n).toFixed(1)}`).join(" ");
  const per = stores.map((s) => ({ s, n: g(R.from, R.to), o: 0 })).map((r) => ({ ...r, n: sales.filter((x) => x.store_id === r.s.id && x.tanggal >= R.from && x.tanggal <= R.to).reduce((t, x) => t + +x.gmv, 0), o: sales.filter((x) => x.store_id === r.s.id && x.tanggal >= R.pf && x.tanggal <= R.pt).reduce((t, x) => t + +x.gmv, 0) })).filter((r) => r.n || r.o).sort((a, b) => b.n - a.n);
  const top = [...prod].sort((a, b) => +b.gmv - +a.gmv).slice(0, 5);
  return <div className="lapv">
    <LaporanKlien k={K} R={R} nama={c.nama} last={last} tem={c.lap_temuan} lang={c.lap_langkah} waktu={c.lap_waktu ? tgl(c.lap_waktu) : null} />
    <div className="grid2c">
      <div className="card"><h2>Tren GMV</h2><svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Tren GMV">
        {prv.length > 0 && <polyline fill="none" stroke="var(--muted)" strokeOpacity=".8" strokeDasharray="5 4" strokeWidth="1.5" points={line(prv)} />}
        <polyline fill="none" stroke="var(--accent)" strokeWidth="2.5" points={line(cur)} /></svg>
        <p className="muted small">{B[0]?.l} – {B[B.length - 1]?.l}{prv.length ? " · garis putus = periode sebelumnya" : ""}</p></div>
      <div className="card"><h2>Per toko</h2><div className="tbl"><table><tbody>{per.map((r) => { const v = pct(r.n, r.o); return <tr key={r.s.id}><td>{r.s.platform} · {r.s.brand}</td><td className="n">{fmt(r.n)}</td><td className={"n " + (v >= 0 ? "up" : "dn")}>{R.key !== "all" && r.o ? `${v >= 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}%` : "–"}</td></tr>; })}</tbody></table></div></div>
    </div>
    <div className="grid2c">
      <div className="card"><h2>Top 5 produk</h2>{top.length ? <div className="tbl"><table><tbody>{top.map((p) => <tr key={p.grup}><td>{p.nama ?? p.grup}</td><td className="n">{fmt(+p.gmv)}</td></tr>)}</tbody></table></div> : <p className="muted small">Belum ada data produk untuk periode ini.</p>}</div>
      <div className="card"><h2>Iklan &amp; kreator</h2><div className="lapkv">
        <div><span>Biaya iklan</span><b>{K.S ? fmt(K.S) : "–"}</b></div><div><span>ROAS iklan</span><b>{K.S ? K.roas.toFixed(2).replace(".", ",") : "–"}</b></div>
        <div><span>GMV dari affiliate</span><b>{aff ? fmt(aff) : "–"}</b></div><div><span>Porsi affiliate</span><b>{K.G && aff ? ((aff / K.G) * 100).toFixed(1).replace(".", ",") + "%" : "–"}</b></div>
      </div></div>
    </div>
    <p style={{ textAlign: "center", margin: "18px 0" }}><a className="btn2" href={detail}>Lihat detail lengkap →</a></p>
  </div>;
}
