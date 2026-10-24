import AppShell from "@/components/AppShell";
import { logAct } from "@/lib/log";
import { headers } from "next/headers";
import { requireUser, isStaff, PERAN_LABEL } from "@/lib/auth";
import { q } from "@/lib/db";
import { AddUser, UserRow, ChangeOwn, Links } from "./Forms";

export const dynamic = "force-dynamic";

export default async function Tim() {
  const me = await requireUser();
  const staff = isStaff(me);
  const clients = staff ? await q<{ id: string; nama: string }>("select id, nama from clients order by nama") : [];
  const users = staff ? await q<{ id: number; email: string; nama: string; peran: string }>("select id, email, nama, peran from users order by field(peran, 'superadmin', 'admin', 'klien'), nama") : [];
  const mem = staff ? await q<{ user_id: number; client_id: string }>("select user_id, client_id from client_members") : [];
  const links = staff ? await q<{ token: string; client_id: string; label: string | null; dibuat: string }>("select token, client_id, label, dibuat from share_links where aktif = 1 order by dibuat desc") : [];
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const editable = (p: string, id: number) => id !== me.id && p !== "superadmin" && (me.peran === "superadmin" || p === "klien");
  const group = (p: string) => users.filter((u) => u.peran === p);
  await logAct(me, "lihat", null, "Kelola tim");
  return <AppShell user={me}>
    <header className="dh"><div className="wrap top ctitle"><h1>{staff ? "Kelola tim" : "Akun saya"}</h1></div></header>
    <main className="wrap dv tim">
      <p className="muted">Masuk sebagai <b>{me.nama}</b> · {PERAN_LABEL[me.peran]}</p>
      {staff && <>
        <AddUser clients={clients} me={me.peran} />
        {(["superadmin", "admin", "klien"] as const).map((p) => group(p).length > 0 && <section key={p}>
          <h2>{PERAN_LABEL[p]} ({group(p).length})</h2>
          {group(p).map((u) => <UserRow key={u.id} me={me.peran} editable={editable(u.peran, u.id)} clients={clients} u={{ ...u, klien: mem.filter((m) => m.user_id === u.id).map((m) => m.client_id) }} />)}
        </section>)}
        <Links clients={clients} links={links} origin={origin} />
      </>}
      <ChangeOwn />
    </main>
  </AppShell>;
}
