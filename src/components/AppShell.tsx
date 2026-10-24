import Shell from "./Shell";
import { LoadingBar } from "./Nav";
import { clientsFor } from "@/lib/data";
import { allowedClients, isStaff, PERAN_LABEL, type User } from "@/lib/auth";

/* Kerangka halaman untuk pengguna yang login: menu samping + konten */
export default async function AppShell({ user, active, keep = {}, children }: { user: User; active?: string; keep?: Record<string, string | undefined>; children: React.ReactNode }) {
  const clients = await clientsFor(await allowedClients(user));
  const href = (c: string) => { const q = new URLSearchParams(); for (const k of ["m", "per"]) if (keep[k]) q.set(k, keep[k]!); q.set("c", c); return "/dashboard?" + q.toString(); };
  return <>
    <LoadingBar />
    <Shell user={{ nama: user.nama, peran: PERAN_LABEL[user.peran] ?? user.peran }} staff={isStaff(user)} active={active}
      clients={clients.map((c) => ({ id: c.id, nama: c.nama, href: href(c.id) }))}>{children}</Shell>
  </>;
}
