import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import Filters from "@/components/Filters";
import { Kpi, Insight, Bars } from "@/components/ui";
import { loadClient, freshness, type Sale, type Ad, type Live, type Store } from "@/lib/data";
import { resolvePeriod, buckets, fmt, pct, jm, tgl, addDays, dayDiff, todayWIB, type Range } from "@/lib/period";

type SP = Promise<Record<string, string | undefined>>;
const TABS: [string, string][] = [["sum", "Semua Klien"], ["toko", "Analisa Toko"], ["iklan", "Analisa Iklan"], ["live", "Livestream"]];

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: profile } = await sb.from("profiles").select("nama, peran").eq("id", user!.id).single();
  const { data: clientsRaw } = await sb.from("clients").select("id, nama, modul, target_roas").order("nama");
  const clients = clientsRaw ?? [];
  const isAdmin = profile?.peran === "admin";
  const c = clients.find((x) => x.id === sp.c) ?? clients[0];
  let tab = sp.m ?? "toko";
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
    if (tab === "sum") body = await SumTab(R, clients);
    else if (tab === "toko") body = <TokoTab R={R} stores={st.filter((s) => s.platform !== "CPAS")} sales={D.sales} />;
    else if (tab === "iklan") body = <IklanTab R={R} stores={st} ads={D.ads} sales={D.sales} target={c.target_roas} />;
    else if (tab === "live") body = <LiveTab R={R} live={D.live} brand={sp.b} plat={sp.p} />;
  }

  return (
    <>
      <header className="dh">
        <div className="wrap top">
          <b>Ruria Pantau</b>
          {isAdmin && <Link href="/dashboard/impor" className="hlink">Impor data</Link>}
          <span className="muted">{profile?.nama} · {profile?.peran}</span>
          <form action={logout}><button type="submit" className="ghost">Keluar</button></form>
        </div>
        <div className="wrap"><Filters clients={clients} brands={brands} platforms={platforms} label={R.label} /></div>
        <nav className="wrap tabs">
          {TABS.filter(([k]) => k === "sum" || c?.modul.includes(k)).map(([k, l]) => <Link key={k} href={qs({ m: k })} className={"tab" + (k === tab ? " on" : "")}>{l}</Link>)}
        </nav>
      </header>
      <main className="wrap dv">{body}</main>
    </>
  );
}

/* ---------------- Semua klien ---------------- */
async function SumTab(R: Range, clients: { id: string; nama: string; modul: string[] }[]) {
  const F = await freshness();
  const yday = addDays(todayWIB(), -1);
  const badge = (d: string | null | undefined) => { if (!d) return <span className="pill mute">Belum ada data</span>; const lag = dayDiff(d, yday); return lag <= 0 ? <span className="pill good">Aman</span> : lag <= 3 ? <span className="pill warn">Kurang {lag} hari</span> : <span className="pill bad">Tertinggal {lag} hari</span>; };
  const cell = (on: boolean, d: string | null | undefined) => on ? <><td>{d ? `${tgl(d)} ${d.slice(0, 4)}` : "–"}</td><td>{badge(d)}</td></> : <><td>–</td><td><span className="pill mute">Tidak dipantau</span></td></>;
  const rows = await Promise.all(clients.filter((c) => c.modul.includes("toko")).map(async (c) => {
    const D = await loadClient(c.id, R.pf < R.from ? R.pf : R.from, R.to);
    const g = (a: string, b: string) => D.sales.filter((s) => s.tanggal >= a && s.tanggal <= b).reduce((x, s) => x + s.gmv, 0);
    return { c, n: g(R.from, R.to), o: g(R.pf, R.pt) };
  }));
  rows.sort((a, b) => b.n - a.n);
  const tot = rows.reduce((a, r) => a + r.n, 0) || 1;
  const up = [...rows].sort((a, b) => pct(b.n, b.o) - pct(a.n, a.o))[0], dn = [...rows].sort((a, b) => pct(a.n, a.o) - pct(b.n, b.o))[0];
  return (<>
    {rows.length > 0 && <Insight src="Data asli" sum={[`Total GMV klien ${fmt(tot)} (${R.label.toLowerCase()}).`, `Klien terbesar: ${rows[0].c.nama} (${(rows[0].n / tot * 100).toFixed(0)}%).`]}
      ana={[`Pertumbuhan terbaik: ${up.c.nama} (${pct(up.n, up.o).toFixed(1)}%).`, `Paling melemah: ${dn.c.nama} (${pct(dn.n, dn.o).toFixed(1)}%).`]}
      next={[`Review ${dn.c.nama} lebih dulu.`, "Pastikan data semua klien sudah masuk sampai kemarin (lihat Status data)."]} />}
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
    <div className="card"><h2>Tren GMV</h2><Bars title="Tren GMV" labels={B.map((b) => b.l)} series={[vals]} colors={["var(--accent)"]} /></div>
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
    <div className="card"><h2>Kampanye</h2><div className="tbl"><table><thead><tr><th>Kampanye</th><th className="n">Biaya</th><th className="n">GMV</th><th className="n">Pesanan</th><th className="n">ROAS</th><th>Status</th></tr></thead>
      <tbody>{camps.slice(0, 200).map((c) => <tr key={c.c}><td className="wrapcell">{c.c}</td><td className="n">{fmt(c.s)}</td><td className="n">{fmt(c.g)}</td><td className="n">{c.o || "–"}</td><td className="n">{c.r.toFixed(1)}</td><td>{!t ? "–" : c.r >= t - 2 ? <span className="pill good">Tercapai</span> : c.r >= t - 5 ? <span className="pill warn">Di bawah</span> : <span className="pill bad">Jauh di bawah</span>}</td></tr>)}</tbody></table></div></div>
  </>);
}

/* ---------------- Livestream ---------------- */
const SLOTS: [number, number, string, string][] = [[0, 6, "00–06", "Dini hari"], [6, 12, "06–12", "Pagi"], [12, 18, "12–18", "Siang–sore"], [18, 24.5, "18–24", "Malam"]];
function LiveTab({ R, live, brand, plat }: { R: Range; live: Live[]; brand?: string; plat?: string }) {
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
    <h2>Ringkasan per host</h2>
    <div className="hcs">{hs.slice(0, 8).map((h) => <div className="hc" key={h.k}><h3>{h.k}</h3><div className="hl">GMV</div><div className="hv">{fmt(h.s.g)}</div><div className="hl">Durasi</div><div className="hv">{jm(h.s.j)}</div><div className="hl">GMV/jam</div><div className="hv">{fmt(h.s.g / h.s.j)}</div><div className="hb">{h === hs[0] ? "GMV terbesar" : h.k === effi[0]?.k ? "Paling efisien" : ""}</div></div>)}</div>
    <div className="card"><h2>GMV/jam per sesi</h2><div className="tbl"><div className="hm">
      <div />{SLOTS.map((s) => <div key={s[2]} className="hmh"><b>{s[2]}</b><span>{s[3]}</span></div>)}
      {hs.slice(0, 10).map((h, i) => [<div key={h.k} className="hmn">{h.k}</div>, ...cells[i].map((c, j) => c.g === null ? <div key={j} className="hmc none">Tidak live</div> : <div key={j} className={"hmc l" + Math.min(4, Math.floor((c.g / mx) * 5))}><b>{fk(c.g)}</b><span>Rp{fk(c.v.g)} · {jm(c.v.j)}</span></div>)])}
    </div></div><p className="muted small">Angka besar = GMV per jam. Baris kecil = total GMV · durasi. Dikelompokkan menurut jam mulai live.</p></div>
    <div className="card"><h2>GMV live per {B[0].f === B[0].t ? "hari" : "bulan"}</h2><Bars title="GMV live" labels={B.map((x) => x.l)} series={[ser("gmv_shopee"), ser("gmv_tiktok")]} colors={["var(--warn)", "var(--accent)"]} /><p className="muted small"><span style={{ color: "var(--warn)" }}>■</span> Shopee <span style={{ color: "var(--accent)" }}>■</span> TikTok</p></div>
  </>);
}
