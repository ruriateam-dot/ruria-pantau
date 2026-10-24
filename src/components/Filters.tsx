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
  const per = get("per", "yday");
  return (
    <div className="filters" aria-busy={pending}>
      {!hideClient && clients.length > 1 && <select aria-label="Klien" value={get("c", clients[0]?.id ?? "")} onChange={(e) => set({ c: e.target.value, b: "", p: "" })}>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}
      </select>}
      {brands.length > 0 && <select aria-label="Toko" value={get("b", "")} onChange={(e) => set({ b: e.target.value })}>
        <option value="">Semua toko</option>{brands.map((b) => <option key={b}>{b}</option>)}
      </select>}
      {platforms.length > 0 && <select aria-label="Platform" value={get("p", "")} onChange={(e) => set({ p: e.target.value })}>
        <option value="">Semua platform</option>{platforms.map((p) => <option key={p}>{p}</option>)}
      </select>}
      <Period per={per} label={label} onPick={(p) => set({ per: p })} />
    </div>
  );
}
