"use client";
import { useActionState, useState } from "react";
import { addUser, setAccess, resetPassword, removeUser, changeOwn, addLink, revokeLink } from "./actions";

type C = { id: string; nama: string };
type U = { id: number; email: string; nama: string; peran: string; klien: string[] };
const LABEL: Record<string, string> = { superadmin: "Superadmin", admin: "Admin Ruria", klien: "Tim klien" };
const roles = (me: string) => (me === "superadmin" ? ["klien", "admin"] : ["klien"]);

function Msg({ m }: { m: string | null }) {
  return m ? <p className={/salah|minimal|Hanya|Tidak|tidak|Pilih|sudah terdaftar|Untuk akun/.test(m) ? "err" : "ok"} role="status">{m}</p> : null;
}
function Klien({ clients, sel }: { clients: C[]; sel: string[] }) {
  return <div className="chk">{clients.map((c) => <label key={c.id}><input type="checkbox" name="klien" value={c.id} defaultChecked={sel.includes(c.id)} /> {c.nama}</label>)}</div>;
}
function RoleSel({ me, value, onChange }: { me: string; value: string; onChange: (v: string) => void }) {
  return <select name="peran" value={value} onChange={(e) => onChange(e.target.value)}>
    {roles(me).map((r) => <option key={r} value={r}>{LABEL[r]}{r === "admin" ? " (semua klien, bisa kelola tim klien)" : " (hanya klien yang dipilih)"}</option>)}
  </select>;
}

export function AddUser({ clients, me }: { clients: C[]; me: string }) {
  const [m, a, p] = useActionState(addUser, null);
  const [peran, setPeran] = useState("klien");
  return <form action={a} className="card form">
    <h2>Tambah akun</h2>
    <div className="grid2">
      <label>Nama<input name="nama" required /></label>
      <label>Email<input name="email" type="email" required /></label>
      <label>Password awal<input name="password" type="text" minLength={10} required autoComplete="off" /></label>
      <label>Peran<RoleSel me={me} value={peran} onChange={setPeran} /></label>
    </div>
    {peran === "klien" && <><p className="muted small">Klien yang bisa dilihat dan dipakai:</p><Klien clients={clients} sel={[]} /></>}
    <Msg m={m} /><button disabled={p}>{p ? "Menyimpan…" : "Tambah"}</button>
  </form>;
}

export function UserRow({ u, clients, me, editable }: { u: U; clients: C[]; me: string; editable: boolean }) {
  const [m1, a1, p1] = useActionState(setAccess, null);
  const [m2, a2, p2] = useActionState(resetPassword, null);
  const [m3, a3, p3] = useActionState(removeUser, null);
  const [peran, setPeran] = useState(u.peran);
  const info = u.peran === "klien" ? u.klien.map((k) => clients.find((c) => c.id === k)?.nama ?? k).join(", ") || "belum ada klien" : "semua klien";
  if (!editable) return <div className="card urow"><b>{u.nama}</b> <span className="muted">{u.email}</span> <span className="badge">{LABEL[u.peran] ?? u.peran}</span> <span className="muted small">{info}</span></div>;
  return <details className="card urow">
    <summary><b>{u.nama}</b> <span className="muted">{u.email}</span> <span className="badge">{LABEL[u.peran] ?? u.peran}</span> <span className="muted small">{info}</span></summary>
    <form action={a1}><input type="hidden" name="id" value={u.id} />
      <label>Peran <RoleSel me={me} value={peran} onChange={setPeran} /></label>
      {peran === "klien" && <Klien clients={clients} sel={u.klien} />}
      <Msg m={m1} /><button disabled={p1}>Simpan akses</button></form>
    <form action={a2} className="inline"><input type="hidden" name="id" value={u.id} />
      <input name="password" type="text" placeholder="Password baru (min. 10)" minLength={10} required autoComplete="off" /><button disabled={p2}>Ganti password</button><Msg m={m2} /></form>
    <form action={a3} className="inline" onSubmit={(e) => { if (!confirm(`Hapus akun ${u.nama}?`)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={u.id} /><button className="danger" disabled={p3}>Hapus akun</button><Msg m={m3} /></form>
  </details>;
}

export function Links({ clients, links, origin }: { clients: C[]; links: { token: string; client_id: string; label: string | null; dibuat: string }[]; origin: string }) {
  const [m, a, p] = useActionState(addLink, null);
  const [m2, a2] = useActionState(revokeLink, null);
  const [copied, setCopied] = useState("");
  const url = (t: string) => `${origin}/lihat/${t}`;
  return <div className="card form">
    <h2>Link untuk klien (lihat tanpa login)</h2>
    <p className="muted small">Siapa pun yang memegang link bisa melihat dashboard klien tersebut (Analisa Toko, Iklan, Livestream) tanpa bisa mengubah apa pun. Nonaktifkan link kalau tidak dipakai lagi.</p>
    <form action={a} className="inline">
      <select name="klien" required defaultValue=""><option value="" disabled>Pilih klien…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}</select>
      <input name="label" placeholder="Catatan, mis. untuk owner" />
      <button disabled={p}>Buat link</button>
    </form>
    <Msg m={m} /><Msg m={m2} />
    {links.length > 0 && <div className="tw"><table><thead><tr><th>Klien</th><th>Catatan</th><th>Link</th><th></th></tr></thead><tbody>
      {links.map((l) => <tr key={l.token}>
        <td>{clients.find((c) => c.id === l.client_id)?.nama ?? l.client_id}</td><td>{l.label ?? "–"}</td>
        <td><button type="button" className="ghost" onClick={() => { navigator.clipboard?.writeText(url(l.token)); setCopied(l.token); }}>{copied === l.token ? "Tersalin ✓" : "Salin link"}</button> <a href={url(l.token)} target="_blank" rel="noreferrer">Buka</a></td>
        <td><form action={a2}><input type="hidden" name="token" value={l.token} /><button className="danger ghost">Nonaktifkan</button></form></td>
      </tr>)}</tbody></table></div>}
  </div>;
}

export function ChangeOwn() {
  const [m, a, p] = useActionState(changeOwn, null);
  return <form action={a} className="card form">
    <h2>Ganti password saya</h2>
    <div className="grid2">
      <label>Password lama<input name="lama" type="password" required autoComplete="current-password" /></label>
      <label>Password baru<input name="baru" type="password" minLength={10} required autoComplete="new-password" /></label>
    </div>
    <Msg m={m} /><button disabled={p}>Ganti</button>
  </form>;
}
