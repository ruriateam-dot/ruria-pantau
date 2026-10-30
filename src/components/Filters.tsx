"use client";
import { useSearchParams } from "next/navigation";
import { useNav } from "./Nav";
import Period from "./Period";

type C = { id: string; nama: string; modul: string[] };
export default function Filters({ base = "/dashboard", clients, brands, platforms, label, hideClient }: { base?: string; clients: C[]; brands: string[]; platforms: string[]; label: string; hideClient?: boolean }) {
  const sp = useSearchParams();
  const get = (k: string, d: string) => sp.get(k) ?? d;
  const { pending, go } = useNav();
  const set = (patch: Record<string, string>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) q.set(k, v); else q.delete(k); }
    go(base + "?" + q.toString());
  };
  const per = get("per", "30d");
  return (
    <div className="filters" aria-busy={pending}>
      {!hideClient && clients.length > 1 && <select aria-label="Klien" value={get("c", clients[0]?.id ?? "")} onChange={(e) => set({ c: e.target.value, b: "", p: "" })}>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}
      </select>}
      {[["7d", "7 hari"], ["30d", "30 hari"], ["mtd", "Bulan ini"]].map(([k, l]) => <button type="button" key={k} className={"fchip" + (per === k ? " on" : "")} aria-pressed={per === k} onClick={() => set({ per: k })}>{l}</button>)}
      {brands.length > 1 && (brands.length <= 4 ? <span className="fgrp" role="group" aria-label="Toko"><button type="button" className={"fchip" + (!get("b", "") ? " on" : "")} onClick={() => set({ b: "" })}>Semua toko</button>{brands.map((b) => <button type="button" key={b} className={"fchip" + (get("b", "") === b ? " on" : "")} aria-pressed={get("b", "") === b} onClick={() => set({ b })}>{b}</button>)}</span>
        : <select aria-label="Toko" value={get("b", "")} onChange={(e) => set({ b: e.target.value })}><option value="">Semua toko</option>{brands.map((b) => <option key={b}>{b}</option>)}</select>)}
      {platforms.length > 1 && <span className="fgrp" role="group" aria-label="Platform"><button type="button" className={"fchip" + (!get("p", "") ? " on" : "")} onClick={() => set({ p: "" })}>Semua platform</button>{platforms.map((p) => <button type="button" key={p} className={"fchip" + (get("p", "") === p ? " on" : "")} aria-pressed={get("p", "") === p} onClick={() => set({ p })}>{p}</button>)}</span>}
      <span className="fmore"><Period per={per} label={label} onPick={(p) => set({ per: p })} /></span>
    </div>
  );
}
