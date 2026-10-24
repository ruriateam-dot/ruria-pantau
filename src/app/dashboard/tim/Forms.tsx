"use client";
import { useActionState } from "react";
import { addUser, setAccess, resetPassword, removeUser, changeOwn } from "./actions";

type C = { id: string; nama: string };
type U = { id: number; email: string; nama: string; peran: string; klien: string[] };

function Msg({ m }: { m: string | null }) {
  return m ? <p className={/^(Akun|Akses|Password)/.test(m) && !/salah|minimal|Hanya|Tidak/.test(m) ? "ok" : "err"} role="status">{m}</p> : null;
}
function Klien({ clients, sel }: { clients: C[]; sel: string[] }) {
  return <div className="chk">{clients.map((c) => <label key={c.id}><input type="checkbox" name="klien" value={c.id} defaultChecked={sel.includes(c.id)} /> {c.nama}</label>)}</div>;
}

export function AddUser({ clients }: { clients: C[] }) {
  const [m, a, p] = useActionState(addUser, null);
  return <form action={a} className="card form">
    <h2>Tambah anggota</h2>
    <div className="grid2">
      <label>Nama<input name="nama" required /></label>
      <label>Email<input name="email" type="email" required /></label>
      <label>Password awal<input name="password" type="text" minLength={10} required autoComplete="off" /></label>
      <label>Peran<select name="peran" defaultValue="anggota"><option value="anggota">Anggota (klien tertentu)</option><option value="admin">Admin (semua klien)</option></select></label>
    </div>
    <p className="muted small">Klien yang bisa dilihat (khusus anggota):</p>
    <Klien clients={clients} sel={[]} />
    <Msg m={m} /><button disabled={p}>{p ? "Menyimpan…" : "Tambah"}</button>
  </form>;
}

export function UserRow({ u, clients, self }: { u: U; clients: C[]; self: boolean }) {
  const [m1, a1, p1] = useActionState(setAccess, null);
  const [m2, a2, p2] = useActionState(resetPassword, null);
  const [m3, a3, p3] = useActionState(removeUser, null);
  return <details className="card urow">
    <summary><b>{u.nama}</b> <span className="muted">{u.email}</span> <span className="badge">{u.peran}</span>
      <span className="muted small">{u.peran === "admin" ? "semua klien" : u.klien.map((k) => clients.find((c) => c.id === k)?.nama ?? k).join(", ") || "belum ada klien"}</span></summary>
    <form action={a1}><input type="hidden" name="id" value={u.id} />
      <label>Peran <select name="peran" defaultValue={u.peran}><option value="anggota">Anggota</option><option value="admin">Admin</option></select></label>
      <Klien clients={clients} sel={u.klien} /><Msg m={m1} /><button disabled={p1}>Simpan akses</button></form>
    <form action={a2} className="inline"><input type="hidden" name="id" value={u.id} />
      <input name="password" type="text" placeholder="Password baru (min. 10)" minLength={10} required autoComplete="off" /><button disabled={p2}>Ganti password</button><Msg m={m2} /></form>
    {!self && <form action={a3} className="inline" onSubmit={(e) => { if (!confirm(`Hapus akun ${u.nama}?`)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={u.id} /><button className="danger" disabled={p3}>Hapus akun</button><Msg m={m3} /></form>}
  </details>;
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
