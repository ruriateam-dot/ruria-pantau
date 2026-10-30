"use client";
import { useActionState } from "react";
import { saveClient, addStore, editStore, deleteStore } from "./actions";

type R = { ok: boolean; msg: string } | null;
const MOD: [string, string][] = [["toko", "Penjualan"], ["iklan", "Iklan"], ["live", "Livestream"], ["affiliate", "Kreator (affiliate)"]];
const TABK: [string, string][] = [["ringkas", "Ringkasan"], ["toko", "Penjualan"], ["status", "Status pesanan (di Penjualan)"], ["iklan", "Iklan"], ["affiliate", "Kreator"], ["live", "Livestream"], ["forecast", "Stok"]];
const Msg = ({ r }: { r: R }) => r ? <p className={r.ok ? "ok" : "err"} role="status">{r.msg}</p> : null;

export function ClientForm({ c }: { c?: { id: string; nama: string; modul: string[]; target_roas: number | null; stok_selalu_ada?: number; tab_klien?: string | null } }) {
  const [r, a, p] = useActionState(saveClient, null);
  return <form action={a} className="kform">
    <input type="hidden" name="id" value={c?.id ?? ""} />
    <div className="grid2">
      <label>Nama klien<input name="nama" defaultValue={c?.nama} required /></label>
      <label>Target ROAS<input name="target" inputMode="decimal" defaultValue={c?.target_roas ?? ""} placeholder="mis. 10" /></label>
    </div>
    <div className="chk">{MOD.map(([k, l]) => <label key={k}><input type="checkbox" name="modul" value={k} defaultChecked={c ? c.modul.includes(k) : k !== "affiliate"} /> {l}</label>)}</div>
    <label className="chk"><input type="checkbox" name="stok_selalu_ada" value="1" defaultChecked={!!c?.stok_selalu_ada} /> Stok dianggap selalu ada (tidak perlu upload stok; kebutuhan stok di Forecast tidak dihitung)</label>
    {c && <fieldset className="chk"><legend>Tab yang terlihat oleh klien (akun klien &amp; link klien)</legend><input type="hidden" name="tab_set" value="1" />
      {TABK.map(([k, l]) => <label key={k}><input type="checkbox" name="tab_klien" value={k} defaultChecked={c.tab_klien == null || c.tab_klien.split(",").includes(k)} /> {l}</label>)}
      <p className="muted small">Tab hanya muncul jika modulnya juga aktif. Tim Ruria tetap melihat semua tab.</p></fieldset>}
    <Msg r={r} /><button disabled={p}>{c ? "Simpan klien" : "Tambah klien"}</button>
  </form>;
}

export function AddStore({ client }: { client: string }) {
  const [r, a, p] = useActionState(addStore, null);
  return <form action={a} className="kform inline">
    <input type="hidden" name="client" value={client} />
    <input name="brand" placeholder="Nama toko/brand" required />
    <select name="platform" defaultValue="Shopee"><option>Shopee</option><option>TikTok</option><option>Lazada</option><option>CPAS</option></select>
    <input name="akun" placeholder="Username akun Shopee (opsional)" />
    <button disabled={p}>Tambah toko</button><Msg r={r} />
  </form>;
}

export function StoreRow({ s }: { s: { id: string; brand: string; platform: string; akun: string | null; n: number } }) {
  const [r1, a1, p1] = useActionState(editStore, null);
  const [r2, a2, p2] = useActionState(deleteStore, null);
  return <tr>
    <td><form action={a1} className="kform inline"><input type="hidden" name="id" value={s.id} />
      <input name="brand" defaultValue={s.brand} aria-label="Nama toko" /><input name="akun" defaultValue={s.akun ?? ""} placeholder="akun" aria-label="Username akun" />
      <button className="ghost" disabled={p1}>Simpan</button><Msg r={r1} /></form></td>
    <td>{s.platform}</td><td className="n">{s.n.toLocaleString("id")}</td>
    <td>{s.n ? <span className="muted small">punya data</span> : <form action={a2} onSubmit={(e) => { if (!confirm(`Hapus toko ${s.platform} · ${s.brand}?`)) e.preventDefault(); }}><input type="hidden" name="id" value={s.id} /><button className="ghost danger" disabled={p2}>Hapus</button><Msg r={r2} /></form>}</td>
  </tr>;
}
