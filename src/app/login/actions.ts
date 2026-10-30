"use server";
import { redirect } from "next/navigation";
import { q, exec } from "@/lib/db";
import { startSession, endSession, verify, hash, hasUsers, getUser } from "@/lib/auth";
import { logAct } from "@/lib/log";

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  if (!email || !password) return "Isi email dan password.";
  const r = await q<{ id: number; password_hash: string; nama: string; peran: string }>("select id, password_hash, nama, peran from users where email = ?", [email]);
  if (!r[0] || !(await verify(password, r[0].password_hash))) { await logAct(r[0] ? { id: r[0].id, nama: r[0].nama, peran: r[0].peran } : null, "login gagal", null, `email: ${email}`); return "Email atau password salah. Coba lagi, atau minta admin mengatur ulang password."; }
  await startSession(r[0].id);
  await logAct({ id: r[0].id, nama: r[0].nama, peran: r[0].peran }, "login", null, email);
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
  await logAct({ id: r.insertId, nama, peran: "superadmin" }, "buat superadmin", null, email);
  redirect("/dashboard");
}

export async function logout() {
  await logAct(await getUser(), "logout", null, "");
  await endSession();
  redirect("/login");
}

/* Lupa password: kirim link atur ulang ke email terdaftar. Jawaban selalu sama supaya tidak membocorkan email mana yang terdaftar. */
export async function lupaPassword(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Isi email yang valid.";
  const r = await q<{ id: number; nama: string; peran: string }>("select id, nama, peran from users where email = ?", [email]);
  if (r[0]) {
    const recent = await q<{ n: number }>("select count(*) n from activity_log where aksi = 'minta reset password' and user_id = ? and waktu > now() - interval 15 minute", [r[0].id]).catch(() => [{ n: 0 }]);
    if (!+recent[0].n) {
      const { passwordLink, sendInvite } = await import("@/lib/mail");
      const link = await passwordLink(r[0].id);
      const err = await sendInvite(email, r[0].nama, link, "Ada yang (lewat halaman Lupa password)", false);
      await logAct({ id: r[0].id, nama: r[0].nama, peran: r[0].peran }, "minta reset password", null, err ? `gagal kirim: ${err}` : email);
    }
  }
  return "OK";
}
