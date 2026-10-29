"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useNav } from "./Nav";
import { logout } from "@/app/login/actions";
import { RuriaWord, RuriaMark } from "./Logo";

type Item = { id: string; nama: string; href: string };
type Props = { user: { nama: string; peran: string }; staff: boolean; clients: Item[]; active?: string; dashHref: string; children: React.ReactNode };

/* Pilihan tema hanya untuk superadmin; akun lain selalu terang */
function Theme({ show }: { show: boolean }) {
  const [t, setT] = useState("light");
  const apply = (v: string) => { const d = document.documentElement; d.dataset.theme = v === "dark" || (v === "auto" && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light"; };
  useEffect(() => {
    let v = "light"; try { v = localStorage.getItem("rp-theme") || "light"; } catch {}
    if (!show && v !== "light") { v = "light"; try { localStorage.setItem("rp-theme", "light"); } catch {} }
    setT(v); apply(v);
  }, [show]);
  const pick = (v: string) => { setT(v); try { localStorage.setItem("rp-theme", v); } catch {} apply(v); };
  if (!show) return null;
  return <div className="seg" role="radiogroup" aria-label="Tema tampilan">
    {[["light", "Terang"], ["dark", "Gelap"], ["auto", "Otomatis"]].map(([k, l]) =>
      <button key={k} type="button" role="radio" aria-checked={t === k} className={t === k ? "on" : ""} onClick={() => pick(k)}>{l}</button>)}
  </div>;
}

const IC: Record<string, string> = {
  dash: "M3 11l9-7 9 7v9H3z", up: "M12 16V4M6 10l6-6 6 6M4 20h16", cal: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  tim: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6", klien: "M4 3h16v18H4zM8 8h8M8 12h8M8 16h5", log: "M5 4h14v16H5zM9 9h6M9 13h6M9 17h3",
  menu: "M4 6h16M4 12h16M4 18h16", side: "M3 4h18v16H3zM9 4v16",
};
const Ic = ({ k }: { k: string }) => <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d={IC[k]} /></svg>;
const Dot = ({ n }: { n: string }) => { let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) % 360; return <span className="cdot" style={{ background: `hsl(${h} 55% 55%)` }} aria-hidden="true" />; };
/* Menu samping: manual (tombol) atau otomatis (sempit < 1280px jadi ikon). Saat ikon, arahkan kursor untuk membuka sementara. */
function useSide() {
  const [pref, setPref] = useState<"auto" | "open" | "mini">("auto");
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    try { const v = localStorage.getItem("rp-side"); if (v === "open" || v === "mini") setPref(v); } catch {}
    const m = matchMedia("(max-width:1279px)"); const f = () => setNarrow(m.matches); f(); m.addEventListener("change", f); return () => m.removeEventListener("change", f);
  }, []);
  const mini = pref === "mini" || (pref === "auto" && narrow);
  const toggle = () => { const v = mini ? "open" : "mini"; const auto = (v === "mini") === narrow; const nv = auto ? "auto" : v; setPref(nv); try { if (nv === "auto") localStorage.removeItem("rp-side"); else localStorage.setItem("rp-side", nv); } catch {} };
  return { mini, toggle };
}

export default function Shell({ user, staff, clients, active, dashHref, children }: Props) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const { go } = useNav();
  useEffect(() => { setOpen(false); }, [path, active]);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [open]);
  const { mini, toggle } = useSide();
  const link = (href: string, label: string, on: boolean, key?: string, icon?: React.ReactNode) =>
    <a key={key} href={href} title={label} className={"sl" + (on ? " on" : "")} aria-current={on ? "page" : undefined} onClick={(e) => { e.preventDefault(); setOpen(false); go(href); }}>{icon}<span className="slt">{label}</span></a>;
  const bl = (href: string, label: string, k: string, on: boolean) =>
    <a href={href} className={on ? "on" : ""} aria-current={on ? "page" : undefined} onClick={(e) => { e.preventDefault(); setOpen(false); go(href); }}><Ic k={k} /><span>{label}</span></a>;
  const cur = clients.find((c) => c.id === active);
  return <div className={"app" + (mini ? " mini" : "")}>
    <aside className={"side" + (open ? " open" : "")} aria-label="Navigasi">
      <div className="sbrand"><span className="sbw"><RuriaWord height={24} title="Ruria" /><small>Report</small></span><span className="sbm"><RuriaMark size={24} /></span>
        <button type="button" className="stog" onClick={toggle} aria-label={mini ? "Lebarkan menu" : "Ciutkan menu"} title={mini ? "Lebarkan menu" : "Ciutkan menu"}><Ic k="side" /></button></div>
      <nav className="sgroup">
        {link(dashHref, "Dashboard", path === "/dashboard" && !active, undefined, <Ic k="dash" />)}
      </nav>
      <nav className="sgroup">
        <div className="sh">Klien</div>
        {clients.length ? clients.map((c) => link(c.href, c.nama, path === "/dashboard" && c.id === active, c.id, <Dot n={c.id} />)) : <p className="muted small">Belum ada klien.</p>}
      </nav>
      <nav className="sgroup">
        <div className="sh">Menu</div>
        {link("/dashboard/upload", "Upload data", path === "/dashboard/upload", undefined, <Ic k="up" />)}
        {link("/dashboard/jadwal", "Jadwal live", path === "/dashboard/jadwal", undefined, <Ic k="cal" />)}
        {user.peran === "Superadmin" && link("/dashboard/tim", "Kelola tim", path === "/dashboard/tim", undefined, <Ic k="tim" />)}
        {user.peran === "Superadmin" && link("/dashboard/klien", "Kelola klien", path === "/dashboard/klien", undefined, <Ic k="klien" />)}
        {user.peran === "Superadmin" && link("/dashboard/log", "Log aktivitas", path === "/dashboard/log", undefined, <Ic k="log" />)}
      </nav>
      <div className="sfoot">
        <Theme show={user.peran === "Superadmin"} />
        <div className="suser"><b>{user.nama}</b><span className="muted small">{user.peran}</span></div>
        <form action={logout}><button type="submit" className="ghost wide">Keluar</button></form>
      </div>
    </aside>
    {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
    <div className="main">
      <div className="mbar">
        <button type="button" className="ghost" aria-label="Buka menu" aria-expanded={open} onClick={() => setOpen(true)}>☰</button>
        <RuriaMark size={22} /><b>Ruria Report</b>{cur && <span className="muted small">{cur.nama}</span>}
      </div>
      {children}
    </div>
    <nav className="bbar" aria-label="Menu bawah">
      {bl(dashHref, "Dashboard", "dash", path === "/dashboard")}
      {bl("/dashboard/upload", "Upload", "up", path === "/dashboard/upload")}
      {bl("/dashboard/jadwal", "Jadwal", "cal", path === "/dashboard/jadwal")}
      {user.peran === "Superadmin" && bl("/dashboard/tim", "Tim", "tim", path === "/dashboard/tim")}
      <button type="button" aria-label="Buka menu lengkap" aria-expanded={open} onClick={() => setOpen(true)}><Ic k="menu" /><span>Menu</span></button>
    </nav>
  </div>;
}
