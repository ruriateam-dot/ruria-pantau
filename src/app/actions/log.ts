"use server";
import { q } from "@/lib/db";
import { getUser, allowedClients } from "@/lib/auth";
import { logAct } from "@/lib/log";

/* Dicatat saat pengguna mengunduh Excel atau mencetak PDF */
export async function logExport(client: string | null, detail: string, token?: string) {
  const d = String(detail).slice(0, 300);
  if (token) {
    const l = /^[a-f0-9]{40}$/.test(token) ? (await q<{ client_id: string; label: string | null }>("select client_id, label from share_links where token = ? and aktif = 1", [token]))[0] : undefined;
    if (l) await logAct(null, "ekspor", l.client_id, d, `Link klien${l.label ? ` (${l.label})` : ""}`);
    return;
  }
  const u = await getUser();
  if (!u) return;
  if (client && !(await allowedClients(u)).includes(client)) return;
  await logAct(u, "ekspor", client, d);
}
