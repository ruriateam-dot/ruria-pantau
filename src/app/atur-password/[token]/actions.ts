"use server";
import { redirect } from "next/navigation";
import { q, exec } from "@/lib/db";
import { hash, startSession } from "@/lib/auth";

export async function setPassword(_p: string | null, f: FormData): Promise<string | null> {
  const token = String(f.get("token") || ""), pw = String(f.get("password") || ""), pw2 = String(f.get("password2") || "");
  if (pw.length < 10) return "Password minimal 10 karakter.";
  if (pw !== pw2) return "Kedua password tidak sama.";
  const r = /^[a-f0-9]{64}$/.test(token) ? await q<{ user_id: number }>("select user_id from password_tokens where token = ? and kadaluarsa > now()", [token]) : [];
  if (!r[0]) return "Link sudah tidak berlaku. Minta link baru ke admin.";
  await exec("update users set password_hash = ? where id = ?", [await hash(pw), r[0].user_id]);
  await exec("delete from password_tokens where user_id = ?", [r[0].user_id]);
  await exec("delete from sessions where user_id = ?", [r[0].user_id]);
  await startSession(r[0].user_id);
  redirect("/dashboard");
}
