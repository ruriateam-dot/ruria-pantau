import "server-only";
import { headers } from "next/headers";
import { exec, q } from "./db";

type Who = { id: number; nama: string; peran: string } | null;

/* Catat aktivitas semua peran (dibaca hanya oleh superadmin & admin). Tidak pernah menggagalkan proses utama. */
export async function logAct(who: Who, aksi: string, clientId: string | null, detail: string, namaTamu?: string) {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim().slice(0, 64) || null;
    // Hindari baris ganda untuk tampilan halaman yang sama dalam 15 detik
    if (aksi === "lihat") {
      const dup = await q<{ n: number }>("select count(*) n from activity_log where aksi = 'lihat' and detail = ? and coalesce(user_id, 0) = ? and coalesce(ip, '') = ? and waktu > now() - interval 15 second", [detail.slice(0, 500), who?.id ?? 0, ip ?? ""]);
      if (dup[0].n) return;
    }
    await exec("insert into activity_log (user_id, nama, peran, aksi, client_id, detail, ip) values (?, ?, ?, ?, ?, ?, ?)",
      [who?.id ?? null, (who?.nama ?? namaTamu ?? "Tamu").slice(0, 160), who?.peran ?? "tamu", aksi.slice(0, 40), clientId, detail.slice(0, 500), ip]);
  } catch (e) { console.error("log gagal", (e as Error).message); }
}
