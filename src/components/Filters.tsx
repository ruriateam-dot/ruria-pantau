"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BLNF, todayWIB, prevMonth } from "@/lib/period";

type C = { id: string; nama: string; modul: string[] };
export default function Filters({ clients, brands, platforms, label }: { clients: C[]; brands: string[]; platforms: string[]; label: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const get = (k: string, d: string) => sp.get(k) ?? d;
  const set = (patch: Record<string, string>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) q.set(k, v); else q.delete(k); }
    router.push("/dashboard?" + q.toString());
  };
  const per = get("per", "yday");
  const [open, setOpen] = useState(false);
  const [cf, setCf] = useState(""); const [ct, setCt] = useState("");
  const T = todayWIB();
  const months: string[] = []; let ym = T.slice(0, 7); for (let i = 0; i < 22 && ym >= "2025-01"; i++) { months.push(ym); ym = prevMonth(ym); }
  const years = Array.from({ length: +T.slice(0, 4) - 2024 }, (_, i) => String(+T.slice(0, 4) - i));
  const presets: [string, string][] = [["today", "Hari ini"], ["yday", "Kemarin"], ["7d", "7 hari terakhir"], ["30d", "30 hari terakhir"], ["3m", "3 bulan terakhir"], ["6m", "6 bulan terakhir"], ["mtd", "Bulan ini"]];
  return (
    <div className="filters">
      <select aria-label="Klien" value={get("c", clients[0]?.id ?? "")} onChange={(e) => set({ c: e.target.value, b: "", p: "" })}>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}
      </select>
      <select aria-label="Toko" value={get("b", "")} onChange={(e) => set({ b: e.target.value })}>
        <option value="">Semua toko</option>{brands.map((b) => <option key={b}>{b}</option>)}
      </select>
      <select aria-label="Platform" value={get("p", "")} onChange={(e) => set({ p: e.target.value })}>
        <option value="">Semua platform</option>{platforms.map((p) => <option key={p}>{p}</option>)}
      </select>
      <div className="pwrap">
        <button type="button" className="pbtn" aria-expanded={open} onClick={() => setOpen(!open)}>📅 {label} (GMT+7)</button>
        {open && (
          <div className="ppop" role="dialog" aria-label="Pilih periode">
            <div className="pre">
              {presets.map(([k, l]) => <button type="button" key={k} className={per === k ? "on" : ""} onClick={() => { setOpen(false); set({ per: k }); }}>{l}</button>)}
              <label>Per bulan<select value={per.startsWith("month:") ? per.slice(6) : ""} onChange={(e) => { setOpen(false); set({ per: "month:" + e.target.value }); }}>
                <option value="" disabled>Pilih bulan</option>{months.map((m) => <option key={m} value={m}>{BLNF[+m.slice(5) - 1]} {m.slice(0, 4)}</option>)}</select></label>
              <label>Per tahun<select value={per.startsWith("year:") ? per.slice(5) : ""} onChange={(e) => { setOpen(false); set({ per: "year:" + e.target.value }); }}>
                <option value="" disabled>Pilih tahun</option>{years.map((y) => <option key={y}>{y}</option>)}</select></label>
            </div>
            <div className="cust">
              <b>Rentang sendiri</b>
              <label>Dari<input type="date" max={T} value={cf} onChange={(e) => setCf(e.target.value)} /></label>
              <label>Sampai<input type="date" max={T} value={ct} onChange={(e) => setCt(e.target.value)} /></label>
              <button type="button" disabled={!cf || !ct} onClick={() => { setOpen(false); set({ per: `custom:${cf}_${ct}` }); }}>Terapkan</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
