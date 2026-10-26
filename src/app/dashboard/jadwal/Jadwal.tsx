"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addHost, toggleHost, saveShift, deleteShift, copyWeek, type Shift } from "./actions";

type S = Omit<Shift, "catatan"> & { id: number; host: string; catatan: string | null };
type H = { id: number; nama: string; aktif: number };
type C = { id: string; nama: string };
const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const add = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const tg = (d: string) => `${+d.slice(8)} ${BLN[+d.slice(5, 7) - 1]}`;
const dur = (a: string, b: string) => { let m = (+b.slice(0, 2) * 60 + +b.slice(3)) - (+a.slice(0, 2) * 60 + +a.slice(3)); if (m <= 0) m += 1440; return m / 60; };
const jm = (h: number) => `${Math.floor(h)}j${Math.round((h % 1) * 60) ? ` ${Math.round((h % 1) * 60)}m` : ""}`;
const PAL = ["#D16D3D", "#0aa9b5", "#7c5cc4", "#2f9e5b", "#c2417a", "#b7791f", "#3d7bd1", "#8a6b52"];

export default function Jadwal({ mode, week, bulan, from, to, gFrom, gTo, today, shifts, hosts, clients, canEdit }: { mode: string; week: string; bulan: string; from: string; to: string; gFrom: string; gTo: string; today: string; shifts: S[]; hosts: H[]; clients: C[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [brand, setBrand] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [edit, setEdit] = useState<Partial<S> | null>(null);
  const [nh, setNh] = useState("");
  const dlg = useRef<HTMLDialogElement>(null);
  const days: string[] = []; for (let d = gFrom; d <= gTo; d = add(d, 1)) days.push(d);
  const inP = (d: string) => d >= from && d <= to;
  const BL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const addM = (m: string, n: number) => { const x = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1)); return x.toISOString().slice(0, 7); };
  const [cf, setCf] = useState(from), [ct, setCt] = useState(to);
  const color = useMemo(() => Object.fromEntries(hosts.map((h, i) => [h.id, PAL[i % PAL.length]])), [hosts]);
  const cname = (id: string) => clients.find((c) => c.id === id)?.nama ?? id;
  const list = shifts.filter((s) => !brand || s.client_id === brand);
  const run = (p: Promise<{ ok: boolean; msg: string }>, close = false) => start(async () => { const r = await p; setMsg(r); if (r.ok) { if (close) dlg.current?.close(); router.refresh(); } });
  const open = (s: Partial<S>) => { setEdit(s); setMsg(null); dlg.current?.showModal(); };
  const go = (w: string) => router.push("/dashboard/jadwal?w=" + w);
  const goM = (m: string) => router.push("/dashboard/jadwal?v=bulan&m=" + m);
  const goK = (a: string, b: string) => router.push(`/dashboard/jadwal?v=kustom&dari=${a}&sampai=${b}`);
  const label = mode === "bulan" ? `${BL[+bulan.slice(5) - 1]} ${bulan.slice(0, 4)}` : `${tg(from)} – ${tg(to)} ${to.slice(0, 4)}`;
  const per = mode === "minggu" ? "minggu ini" : mode === "bulan" ? "bulan ini" : "periode ini";
  const used = clients.filter((c) => list.some((x) => x.client_id === c.id));
  const rekap = useMemo(() => { const m = new Map<string, { h: number; n: number; b: Record<string, number> }>(); list.forEach((s) => { const x = m.get(s.host) ?? { h: 0, n: 0, b: {} }; const d = dur(s.mulai, s.selesai); x.h += d; x.n++; x.b[s.client_id] = (x.b[s.client_id] ?? 0) + d; m.set(s.host, x); }); return [...m].sort((a, b) => b[1].h - a[1].h); }, [list]);

  return <>
    <div className="card jbar">
      <div className="seg" role="tablist" aria-label="Periode">{[["minggu", "Per minggu"], ["bulan", "Per bulan"], ["kustom", "Pilih tanggal"]].map(([k, l]) => <button key={k} type="button" className={mode === k ? "on" : "ghost"} onClick={() => k === "minggu" ? go(from) : k === "bulan" ? goM(from.slice(0, 7)) : goK(from, to)}>{l}</button>)}</div>
      {mode !== "kustom" ? <div className="jnav">
        <button type="button" className="ghost" onClick={() => mode === "bulan" ? goM(addM(bulan, -1)) : go(add(week, -7))} aria-label="Sebelumnya">‹</button>
        <b>{label}</b>
        <button type="button" className="ghost" onClick={() => mode === "bulan" ? goM(addM(bulan, 1)) : go(add(week, 7))} aria-label="Berikutnya">›</button>
        <button type="button" className="ghost" onClick={() => mode === "bulan" ? goM(today.slice(0, 7)) : go(today)}>{mode === "bulan" ? "Bulan ini" : "Minggu ini"}</button>
      </div> : <form className="jnav" onSubmit={(e) => { e.preventDefault(); goK(cf, ct); }}>
        <input type="date" value={cf} onChange={(e) => setCf(e.target.value)} aria-label="Dari tanggal" /><span>–</span><input type="date" value={ct} onChange={(e) => setCt(e.target.value)} aria-label="Sampai tanggal" /><button>Tampilkan</button>
      </form>}
      <select value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Brand"><option value="">Semua brand</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}</select>
      {canEdit && <><button type="button" onClick={() => open({ tanggal: inP(today) ? today : from, mulai: "19:00", selesai: "22:00", platform: "Shopee+TikTok", client_id: brand || clients[0].id })}>+ Tambah jadwal</button>
        {mode === "minggu" && <button type="button" className="ghost" disabled={pending} onClick={() => confirm("Salin semua jadwal minggu ini ke minggu depan?") && run(copyWeek(week, brand || null))}>Salin ke minggu depan</button>}</>}
    </div>
    {msg && !edit && <p className={msg.ok ? "ok" : "err"} role="status">{msg.msg}</p>}

    <div className={"jgrid" + (days.length > 7 ? " multi" : "")}>{days.map((d, i) => { const it = list.filter((s) => s.tanggal === d);
      if (!inP(d)) return <section key={d} className="jday out" aria-hidden="true"><header><span className="muted small">{tg(d)}</span></header></section>;
      return <section key={d} className={"jday" + (d === today ? " today" : "")} aria-label={`${HARI[i % 7]} ${tg(d)}`}>
        <header><b>{HARI[i % 7]}</b><span className="muted small">{tg(d)}</span></header>
        {it.map((s) => <button type="button" key={s.id} className="shift" style={{ borderLeftColor: color[s.host_id] }} onClick={() => canEdit && open(s)} disabled={!canEdit}>
          <b>{s.mulai}–{s.selesai}</b><span>{s.host}</span><span className="muted small">{cname(s.client_id)} · {s.platform.replace("+", " + ")}</span>{s.catatan && <span className="muted small">{s.catatan}</span>}
        </button>)}
        {!it.length && <p className="muted small jempty">Belum ada jadwal</p>}
        {canEdit && <button type="button" className="ghost jadd" onClick={() => open({ tanggal: d, mulai: "19:00", selesai: "22:00", platform: "Shopee+TikTok", client_id: brand || clients[0].id })}>+</button>}
      </section>; })}</div>

    <div className="grid2c">
      <div className="card"><h2>Rekap jam host {per}</h2>
        {rekap.length ? <div className="tbl"><table><thead><tr><th>Host</th><th className="n">Sesi</th><th className="n">Total jam</th>{used.map((c) => <th key={c.id} className="n">{c.nama}</th>)}</tr></thead>
          <tbody>{rekap.map(([h, x]) => <tr key={h}><td>{h}</td><td className="n">{x.n}</td><td className="n">{jm(x.h)}</td>{used.map((c) => <td key={c.id} className="n">{x.b[c.id] ? jm(x.b[c.id]) : "–"}</td>)}</tr>)}</tbody></table></div>
          : <p className="muted">Belum ada jadwal {per}.</p>}
      </div>
      {canEdit && <div className="card"><h2>Daftar host</h2>
        <div className="hostlist">{hosts.map((h) => <span key={h.id} className={"hchip" + (h.aktif ? "" : " off")}><i style={{ background: color[h.id] }} />{h.nama}
          <button type="button" className="ghost" onClick={() => run(toggleHost(h.id, !h.aktif))}>{h.aktif ? "Nonaktifkan" : "Aktifkan"}</button></span>)}</div>
        <form className="jform-inline" onSubmit={(e) => { e.preventDefault(); run(addHost(nh)); setNh(""); }}>
          <input value={nh} onChange={(e) => setNh(e.target.value)} placeholder="Nama host baru" aria-label="Nama host baru" /><button disabled={pending || !nh.trim()}>Tambah host</button>
        </form>
        <p className="muted small">Gunakan nama yang sama dengan kolom host di laporan live, supaya jadwal bisa dibandingkan dengan realisasi di tab Livestream.</p>
      </div>}
    </div>

    <dialog ref={dlg} className="jdlg" onClose={() => setEdit(null)}>
      {edit && <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
        run(saveShift({ id: edit.id, client_id: String(f.get("client")), tanggal: String(f.get("tanggal")), mulai: String(f.get("mulai")), selesai: String(f.get("selesai")), host_id: Number(f.get("host")), platform: String(f.get("platform")), catatan: String(f.get("catatan") || "") }), true); }}>
        <h2>{edit.id ? "Ubah jadwal" : "Tambah jadwal"}</h2>
        <label>Brand<select name="client" defaultValue={edit.client_id}>{clients.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}</select></label>
        <label>Host<select name="host" defaultValue={edit.host_id ?? ""} required><option value="" disabled>Pilih host…</option>{hosts.filter((h) => h.aktif || h.id === edit.host_id).map((h) => <option key={h.id} value={h.id}>{h.nama}</option>)}</select></label>
        <label>Tanggal<input type="date" name="tanggal" defaultValue={edit.tanggal} required /></label>
        <div className="jrow"><label>Mulai<input type="time" name="mulai" defaultValue={edit.mulai} required /></label><label>Selesai<input type="time" name="selesai" defaultValue={edit.selesai} required /></label></div>
        <p className="muted small">Kalau jam selesai lebih kecil dari jam mulai (mis. 22:00–02:00), dianggap lewat tengah malam.</p>
        <label>Platform<select name="platform" defaultValue={edit.platform}><option value="Shopee+TikTok">Shopee + TikTok</option><option value="Shopee">Shopee</option><option value="TikTok">TikTok</option></select></label>
        <label>Catatan<input name="catatan" defaultValue={edit.catatan ?? ""} placeholder="mis. promo 11.11, ganti host" /></label>
        {msg && <p className={msg.ok ? "ok" : "err"} role="status">{msg.msg}</p>}
        {!hosts.some((h) => h.aktif) && <p className="err">Tambahkan host dulu di bagian Daftar host.</p>}
        <div className="jact">
          {edit.id && <button type="button" className="ghost danger" disabled={pending} onClick={() => confirm("Hapus jadwal ini?") && run(deleteShift(edit.id!), true)}>Hapus</button>}
          <span style={{ flex: 1 }} />
          <button type="button" className="ghost" onClick={() => dlg.current?.close()}>Batal</button>
          <button disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </form>}
    </dialog>
  </>;
}
