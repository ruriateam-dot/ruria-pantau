import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { q, exec } from "./db";

export const COOKIE = "rp_sesi";
export type Peran = "superadmin" | "admin" | "klien";
export type User = { id: number; email: string; nama: string; peran: Peran };
export const PERAN_LABEL: Record<string, string> = { superadmin: "Superadmin", admin: "Admin Ruria", klien: "Tim klien" };
export const isStaff = (u: { peran: string } | null | undefined) => u?.peran === "superadmin" || u?.peran === "admin";
/* Hak kerja (input data, follow-up, sampel, saldo, jadwal): tim Ruria & tim klien, tetap dibatasi ke klien yang boleh diakses */
export const canWork = (u: { peran: string } | null | undefined) => isStaff(u) || u?.peran === "klien";

export async function getUser(): Promise<User | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t || !/^[a-f0-9]{64}$/.test(t)) return null;
  const r = await q<User>("select u.id, u.email, u.nama, u.peran from sessions s join users u on u.id = s.user_id where s.token = ? and s.kadaluarsa > now()", [t]);
  if (r[0] && !logoutDone) {
    // Sekali jalan: keluarkan semua sesi semua akun (diminta superadmin 30 Okt 2026). Penanda disimpan di tabel uploads.
    const done = await q<{ n: number }>("select count(*) n from uploads where jenis = ?", [LOGOUT_ALL]);
    if (!+done[0].n) {
      await exec("insert into uploads (client_id, jenis, nama_file, oleh) values (null, ?, 'logout semua akun', ?)", [LOGOUT_ALL, r[0].id]);
      await exec("delete from sessions");
      logoutDone = true;
      return null;
    }
    logoutDone = true;
  }
  return r[0] ?? null;
}
const LOGOUT_ALL = "sistem:logout-semua-2026-10-30";
let logoutDone = false;

export async function requireUser() {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin() {
  const u = await getUser();
  return isStaff(u) ? u : null;
}

export async function requireWorker() {
  const u = await getUser();
  return canWork(u) ? u : null;
}

export async function startSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  await exec("insert into sessions (token, user_id, kadaluarsa) values (?, ?, now() + interval 30 day)", [token, userId]);
  await exec("delete from sessions where kadaluarsa < now()");
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function endSession() {
  const c = await cookies();
  const t = c.get(COOKIE)?.value;
  if (t) await exec("delete from sessions where token = ?", [t]);
  c.delete(COOKIE);
}

export const hash = (pw: string) => bcrypt.hash(pw, 12);
export const verify = (pw: string, h: string) => bcrypt.compare(pw, h);

export async function hasUsers() {
  const r = await q<{ n: number }>("select count(*) n from users");
  return r[0].n > 0;
}

/* Klien yang boleh dilihat akun ini (admin: semua) */
export async function allowedClients(u: User): Promise<string[]> {
  const r = isStaff(u)
    ? await q<{ id: string }>("select id from clients")
    : await q<{ id: string }>("select client_id id from client_members where user_id = ?", [u.id]);
  return r.map((x) => x.id);
}

export async function requireSuper() {
  const u = await getUser();
  return u?.peran === "superadmin" ? u : null;
}
