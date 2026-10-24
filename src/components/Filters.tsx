"use client";
import { useSearchParams } from "next/navigation";
import { useNav } from "./Nav";
import Period from "./Period";

type C = { id: string; nama: string; modul: string[] };
export default function Filters({ clients, brands, platforms, label }: { clients: C[]; brands: string[]; platforms: string[]; label: string }) {
  const sp = useSearchParams();
  const get = (k: string, d: string) => sp.get(k) ?? d;
  const { pending, go } = useNav();
  const set = (patch: Record<string, string>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) q.set(k, v); else q.delete(k); }
    go("/dashboard?" + q.toString());
  };
  const per = get("per", "yday");
  return (
    <div className="filters" aria-busy={pending}>
      <select aria-label="Klien" value={get("c", clients[0]?.id ?? "")} onChange={(e) => set({ c: e.target.value, b: "", p: "" })}>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}
      </select>
      <select aria-label="Toko" value={get("b", "")} onChange={(e) => set({ b: e.target.value })}>
        <option value="">Semua toko</option>{brands.map((b) => <option key={b}>{b}</option>)}
      </select>
      <select aria-label="Platform" value={get("p", "")} onChange={(e) => set({ p: e.target.value })}>
        <option value="">Semua platform</option>{platforms.map((p) => <option key={p}>{p}</option>)}
      </select>
      <Period per={per} label={label} onPick={(p) => set({ per: p })} />
    </div>
  );
}
