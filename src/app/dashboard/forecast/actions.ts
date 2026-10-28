"use server";
import { exec } from "@/lib/db";
import { requireAdmin, allowedClients } from "@/lib/auth";
import { logAct } from "@/lib/log";

/* Stok pengaman (hari) per klien, diubah tim */
export async function setSafety(clientId: string, hari: number): Promise<string> {
  const u = await requireAdmin();
  if (!u) return "Hanya tim Ruria yang bisa mengubah stok pengaman.";
  if (!(await allowedClients(u)).includes(clientId)) return "Klien ini tidak bisa diakses akun ini.";
  const h = Math.round(hari);
  if (!(h >= 0 && h <= 180)) return "Isi 0 sampai 180 hari.";
  await exec("update clients set stok_pengaman = ? where id = ?", [h, clientId]);
  await logAct(u, "ubah", clientId, `Stok pengaman ${h} hari`);
  return "";
}
