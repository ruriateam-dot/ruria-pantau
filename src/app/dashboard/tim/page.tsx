import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { AddUser, UserRow, ChangeOwn } from "./Forms";

export const dynamic = "force-dynamic";

export default async function Tim() {
  const me = await requireUser();
  const admin = me.peran === "admin";
  const clients = admin ? await q<{ id: string; nama: string }>("select id, nama from clients order by nama") : [];
  const users = admin ? await q<{ id: number; email: string; nama: string; peran: string }>("select id, email, nama, peran from users order by peran, nama") : [];
  const mem = admin ? await q<{ user_id: number; client_id: string }>("select user_id, client_id from client_members") : [];
  return <>
    <header className="dh"><div className="wrap top"><b>Ruria Pantau</b><Link href="/dashboard" className="hlink">← Kembali ke dashboard</Link></div></header>
    <main className="wrap dv tim">
      <h1>{admin ? "Kelola tim" : "Akun saya"}</h1>
      {admin && <>
        <AddUser clients={clients} />
        <h2>Akun ({users.length})</h2>
        {users.map((u) => <UserRow key={u.id} self={u.id === me.id} clients={clients} u={{ ...u, klien: mem.filter((m) => m.user_id === u.id).map((m) => m.client_id) }} />)}
      </>}
      <ChangeOwn />
    </main>
  </>;
}
