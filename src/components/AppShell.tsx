import Shell from "./Shell";
import { LoadingBar } from "./Nav";
import { clientsFor } from "@/lib/data";
import { allowedClients, isStaff, PERAN_LABEL, type User } from "@/lib/auth";

/* Kerangka halaman untuk pengguna yang login: menu samping + konten */
export default async function AppShell({ user, active, keep = {}, children }: { user: User; active?: string; keep?: Record<string, string | undefined>; children: React.ReactNode }) {
  let clients: Awaited<ReturnType<typeof clientsFor>> = [];
  try { clients = await clientsFor(await allowedClients(user)); } catch (e) { console.error("AppShell error", e); }
  const href = (c: string) => { const q = new URLSearchParams(); if (keep.m && keep.m !== "sum") q.set("m", keep.m); if (keep.per) q.set("per", keep.per); q.set("c", c); return "/dashboard?" + q.toString(); };
  const dashHref = "/dashboard?m=sum" + (keep.per ? "&per=" + encodeURIComponent(keep.per) : "");
  return <>
    <LoadingBar />
    <Shell dashHref={dashHref} user={{ nama: user.nama, peran: PERAN_LABEL[user.peran] ?? user.peran }} staff={isStaff(user)} active={active}
      clients={clients.map((c) => ({ id: c.id, nama: c.nama, href: href(c.id) }))}>{children}</Shell>
  </>;
}
