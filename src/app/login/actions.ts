"use server";
import { redirect } from "next/navigation";
import { q, exec } from "@/lib/db";
import { startSession, endSession, verify, hash, hasUsers } from "@/lib/auth";

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  if (!email || !password) return "Isi email dan password.";
  const r = await q<{ id: number; password_hash: string }>("select id, password_hash from users where email = ?", [email]);
  if (!r[0] || !(await verify(password, r[0].password_hash))) return "Email atau password salah. Coba lagi, atau minta admin mengatur ulang password.";
  await startSession(r[0].id);
  redirect("/dashboard");
}

/* Hanya bisa dipakai sekali: saat belum ada akun sama sekali */
export async function setupAdmin(_prev: string | null, form: FormData): Promise<string | null> {
  if (await hasUsers()) return "Akun admin sudah dibuat. Silakan masuk.";
  const nama = String(form.get("nama") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const pw = String(form.get("password") || "");
  if (!nama || !email) return "Isi nama dan email.";
  if (pw.length < 10) return "Password minimal 10 karakter.";
  const r = await exec("insert into users (email, nama, peran, password_hash) values (?, ?, 'superadmin', ?)", [email, nama, await hash(pw)]);
  await startSession(r.insertId);
  redirect("/dashboard");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
