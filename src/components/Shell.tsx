"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useNav } from "./Nav";
import { logout } from "@/app/login/actions";
import { RuriaWord, RuriaMark } from "./Logo";

type Item = { id: string; nama: string; href: string };
type Props = { user: { nama: string; peran: string }; staff: boolean; clients: Item[]; active?: string; dashHref: string; children: React.ReactNode };

function Theme() {
  const [t, setT] = useState("auto");
  useEffect(() => { try { setT(localStorage.getItem("rp-theme") || "auto"); } catch {} }, []);
  const pick = (v: string) => {
    setT(v);
    try { if (v === "auto") localStorage.removeItem("rp-theme"); else localStorage.setItem("rp-theme", v); } catch {}
    if (v === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
  };
  return <div className="seg" role="radiogroup" aria-label="Tema tampilan">
    {[["light", "Terang"], ["dark", "Gelap"], ["auto", "Otomatis"]].map(([k, l]) =>
      <button key={k} type="button" role="radio" aria-checked={t === k} className={t === k ? "on" : ""} onClick={() => pick(k)}>{l}</button>)}
  </div>;
}

export default function Shell({ user, staff, clients, active, dashHref, children }: Props) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const { go } = useNav();
  useEffect(() => { setOpen(false); }, [path, active]);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [open]);
  const link = (href: string, label: React.ReactNode, on: boolean, key?: string) =>
    <a key={key} href={href} className={"sl" + (on ? " on" : "")} aria-current={on ? "page" : undefined} onClick={(e) => { e.preventDefault(); setOpen(false); go(href); }}>{label}</a>;
  const cur = clients.find((c) => c.id === active);
  return <div className="app">
    <aside className={"side" + (open ? " open" : "")} aria-label="Navigasi">
      <div className="sbrand"><RuriaWord height={24} title="Ruria" /><small>Report</small></div>
      <nav className="sgroup">
        {link(dashHref, "Dashboard", path === "/dashboard" && !active)}
      </nav>
      <nav className="sgroup">
        <div className="sh">Klien</div>
        {clients.length ? clients.map((c) => link(c.href, c.nama, path === "/dashboard" && c.id === active, c.id)) : <p className="muted small">Belum ada klien.</p>}
      </nav>
      <nav className="sgroup">
        <div className="sh">Menu</div>
        {link("/dashboard/upload", "Upload data", path === "/dashboard/upload")}
        {link("/dashboard/jadwal", "Jadwal live", path === "/dashboard/jadwal")}
        {link("/dashboard/tim", staff ? "Kelola tim" : "Akun saya", path === "/dashboard/tim")}
        {staff && link("/dashboard/klien", "Kelola klien", path === "/dashboard/klien")}
        {user.peran === "Superadmin" && link("/dashboard/log", "Log aktivitas", path === "/dashboard/log")}
      </nav>
      <div className="sfoot">
        <Theme />
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
  </div>;
}
