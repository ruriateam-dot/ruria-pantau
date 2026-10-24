"use server";
import { revalidatePath } from "next/cache";
import { exec, q } from "@/lib/db";
import { requireAdmin, requireUser, hash, verify } from "@/lib/auth";

const done = (m: string) => { revalidatePath("/dashboard/tim"); return m; };

export async function addUser(_p: string | null, f: FormData): Promise<string | null> {
  if (!(await requireAdmin())) return "Hanya admin.";
  const email = String(f.get("email") || "").trim().toLowerCase(), nama = String(f.get("nama") || "").trim();
  const peran = f.get("peran") === "admin" ? "admin" : "anggota", pw = String(f.get("password") || "");
  const klien = f.getAll("klien").map(String);
  if (!email || !nama) return "Isi nama dan email.";
  if (pw.length < 10) return "Password minimal 10 karakter.";
  if ((await q("select id from users where email = ?", [email])).length) return "Email ini sudah terdaftar.";
  const r = await exec("insert into users (email, nama, peran, password_hash) values (?, ?, ?, ?)", [email, nama, peran, await hash(pw)]);
  if (klien.length) await exec("insert into client_members (client_id, user_id) values ?", [klien.map((c) => [c, r.insertId])]);
  return done(`Akun ${nama} dibuat. Berikan email dan password-nya secara langsung ke orangnya.`);
}

export async function setAccess(_p: string | null, f: FormData): Promise<string | null> {
  const me = await requireAdmin();
  if (!me) return "Hanya admin.";
  const id = Number(f.get("id")), peran = f.get("peran") === "admin" ? "admin" : "anggota";
  const klien = f.getAll("klien").map(String);
  if (id === me.id && peran !== "admin") return "Tidak bisa menurunkan peran akun sendiri.";
  await exec("update users set peran = ? where id = ?", [peran, id]);
  await exec("delete from client_members where user_id = ?", [id]);
  if (klien.length) await exec("insert into client_members (client_id, user_id) values ?", [klien.map((c) => [c, id])]);
  return done("Akses disimpan.");
}

export async function resetPassword(_p: string | null, f: FormData): Promise<string | null> {
  if (!(await requireAdmin())) return "Hanya admin.";
  const id = Number(f.get("id")), pw = String(f.get("password") || "");
  if (pw.length < 10) return "Password minimal 10 karakter.";
  await exec("update users set password_hash = ? where id = ?", [await hash(pw), id]);
  await exec("delete from sessions where user_id = ?", [id]);
  return done("Password diganti. Akun tersebut perlu login ulang.");
}

export async function removeUser(_p: string | null, f: FormData): Promise<string | null> {
  const me = await requireAdmin();
  if (!me) return "Hanya admin.";
  const id = Number(f.get("id"));
  if (id === me.id) return "Tidak bisa menghapus akun sendiri.";
  await exec("delete from client_members where user_id = ?", [id]);
  await exec("delete from sessions where user_id = ?", [id]);
  await exec("delete from users where id = ?", [id]);
  return done("Akun dihapus.");
}

export async function changeOwn(_p: string | null, f: FormData): Promise<string | null> {
  const me = await requireUser();
  const old = String(f.get("lama") || ""), pw = String(f.get("baru") || "");
  const r = await q<{ password_hash: string }>("select password_hash from users where id = ?", [me.id]);
  if (!(await verify(old, r[0].password_hash))) return "Password lama salah.";
  if (pw.length < 10) return "Password baru minimal 10 karakter.";
  await exec("update users set password_hash = ? where id = ?", [await hash(pw), me.id]);
  return done("Password Anda sudah diganti.");
}
