"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useNav } from "./Nav";
import Period from "./Period";

type C = { id: string; nama: string; modul: string[] };
export default function Filters({ base = "/dashboard", clients, brands, platforms, label, hideClient, rng, cmp, last, warn }: { warn?: string; base?: string; clients: C[]; brands: string[]; platforms: string[]; label: string; hideClient?: boolean; rng?: [string, string]; cmp?: string; last?: string | null }) {
  const sp = useSearchParams();
  const get = (k: string, d: string) => sp.get(k) ?? d;
  const { pending, go } = useNav();
  const set = (patch: Record<string, string>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) q.set(k, v); else q.delete(k); }
    go(base + "?" + q.toString());
  };
  const per = get("per", "30d");
  const [fo, setFo] = useState(false);
  return (
    <div className="filters" aria-busy={pending}>
      {!hideClient && clients.length > 1 && <select aria-label="Klien" value={get("c", clients[0]?.id ?? "")} onChange={(e) => set({ c: e.target.value, b: "", p: "" })}>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}
      </select>}
      <Period per={per} label={label} rng={rng} cmp={cmp} last={last} warn={warn} onPick={(p) => set({ per: p })} />
      {(brands.length > 1 || platforms.length > 1) && <button type="button" className={"fbtn" + (fo ? " on" : "") + (get("b", "") || get("p", "") ? " act" : "")} aria-expanded={fo} onClick={() => setFo(!fo)}>Filter{get("b", "") || get("p", "") ? " •" : ""}</button>}
      <span className={"fsel" + (fo ? " open" : "")}>
      {brands.length > 1 && <select aria-label="Toko" className={get("b", "") ? "act" : ""} value={get("b", "")} onChange={(e) => set({ b: e.target.value })}><option value="">Semua toko</option>{brands.map((b) => <option key={b}>{b}</option>)}</select>}
      {platforms.length > 1 && <select aria-label="Platform" className={get("p", "") ? "act" : ""} value={get("p", "")} onChange={(e) => set({ p: e.target.value })}><option value="">Semua platform</option>{platforms.map((p) => <option key={p}>{p}</option>)}</select>}
      </span>
    </div>
  );
}
