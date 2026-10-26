"use server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { exec, q } from "@/lib/db";
import { requireAdmin, requireUser, hash, verify, type User } from "@/lib/auth";
import { passwordLink, sendInvite } from "@/lib/mail";
import { logAct } from "@/lib/log";

const done = (m: string) => { revalidatePath("/dashboard/tim"); return m; };

/* Superadmin boleh mengatur admin & tim klien. Admin hanya boleh mengatur tim klien. */
const canGive = (me: User, peran: string) => me.peran === "superadmin" ? peran === "admin" || peran === "klien" : peran === "klien";
async function target(me: User, id: number) {
  const r = await q<{ id: number; peran: string }>("select id, peran from users where id = ?", [id]);
  if (!r[0]) return { err: "Akun tidak ditemukan." };
  if (r[0].id === me.id) return { err: "Untuk akun sendiri, pakai bagian Ganti password saya." };
  if (r[0].peran === "superadmin" || !canGive(me, r[0].peran)) return { err: "Anda tidak berwenang mengubah akun ini." };
  return { err: "" };
}

export async function addUser(_p: string | null, f: FormData): Promise<string | null> {
  const me = await requireAdmin();
  if (!me) return "Hanya admin.";
  const email = String(f.get("email") || "").trim().toLowerCase(), nama = String(f.get("nama") || "").trim();
  const peran = String(f.get("peran") || "klien");
  const klien = f.getAll("klien").map(String);
  if (!canGive(me, peran)) return "Anda tidak berwenang membuat akun dengan peran ini.";
  if (!email || !nama) return "Isi nama dan email.";
  if (peran === "klien" && !klien.length) return "Pilih minimal satu klien untuk tim klien.";
  if ((await q("select id from users where email = ?", [email])).length) return "Email ini sudah terdaftar.";
  // Password acak yang tidak diketahui siapa pun; orangnya membuat password sendiri lewat link
  const r = await exec("insert into users (email, nama, peran, password_hash) values (?, ?, ?, ?)", [email, nama, peran, await hash(randomBytes(24).toString("hex"))]);
  if (peran === "klien") await exec("insert into client_members (client_id, user_id) values ?", [klien.map((c) => [c, r.insertId])]);
  const link = await passwordLink(r.insertId);
  const sent = await sendInvite(email, nama, link, me.nama, true);
  await logAct(me, "tambah akun", null, `${nama} <${email}> sebagai ${peran}${klien.length ? ` · klien: ${klien.join(", ")}` : ""}`);
  return done(!sent ? `Akun ${nama} dibuat. Undangan sudah dikirim ke ${email}.`
    : `Akun ${nama} dibuat. Email belum terkirim karena ${sent}. Sementara, kirim link ini ke orangnya (berlaku 3 hari, sekali pakai): ${link}`);
}

export async function setAccess(_p: string | null, f: FormData): Promise<string | null> {
  const me = await requireAdmin();
  if (!me) return "Hanya admin.";
  const id = Number(f.get("id")), peran = String(f.get("peran") || "klien");
  const klien = f.getAll("klien").map(String);
  const t = await target(me, id); if (t.err) return t.err;
  if (!canGive(me, peran)) return "Anda tidak berwenang memberi peran ini.";
  if (peran === "klien" && !klien.length) return "Pilih minimal satu klien.";
  await exec("update users set peran = ? where id = ?", [peran, id]);
  await exec("delete from client_members where user_id = ?", [id]);
  if (peran === "klien") await exec("insert into client_members (client_id, user_id) values ?", [klien.map((c) => [c, id])]);
  await logAct(me, "ubah akses", null, `${await who(id)} → ${peran}${klien.length ? ` · klien: ${klien.join(", ")}` : ""}`);
  return done("Akses disimpan.");
}

export async function resetPassword(_p: string | null, f: FormData): Promise<string | null> {
  const me = await requireAdmin();
  if (!me) return "Hanya admin.";
  const id = Number(f.get("id")), pw = String(f.get("password") || "");
  const t = await target(me, id); if (t.err) return t.err;
  if (pw.length < 10) return "Password minimal 10 karakter.";
  await exec("update users set password_hash = ? where id = ?", [await hash(pw), id]);
  await exec("delete from sessions where user_id = ?", [id]);
  await logAct(me, "ganti password akun", null, await who(id));
  return done("Password diganti. Akun tersebut perlu login ulang.");
}

export async function sendLink(_p: string | null, f: FormData): Promise<string | null> {
  const me = await requireAdmin();
  if (!me) return "Hanya admin.";
  const id = Number(f.get("id"));
  const t = await target(me, id); if (t.err) return t.err;
  const u = (await q<{ email: string; nama: string }>("select email, nama from users where id = ?", [id]))[0];
  const link = await passwordLink(id);
  const sent = await sendInvite(u.email, u.nama, link, me.nama, false);
  await logAct(me, "kirim link password", null, `${u.nama} <${u.email}>`);
  return done(!sent ? `Link atur password dikirim ke ${u.email}.` : `Email belum terkirim karena ${sent}. Sementara, kirim link ini ke ${u.nama} (berlaku 3 hari, sekali pakai): ${link}`);
}

export async function removeUser(_p: string | null, f: FormData): Promise<string | null> {
  const me = await requireAdmin();
  if (!me) return "Hanya admin.";
  const id = Number(f.get("id"));
  const t = await target(me, id); if (t.err) return t.err;
  await logAct(me, "hapus akun", null, await who(id));
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
  await logAct(me, "ganti password sendiri", null, "");
  return done("Password Anda sudah diganti.");
}

/* Link lihat-saja untuk klien (tanpa login) */
export async function addLink(_p: string | null, f: FormData): Promise<string | null> {
  const me = await requireAdmin();
  if (!me) return "Hanya admin.";
  const pick = [...new Set(f.getAll("klien").map(String).filter(Boolean))], label = String(f.get("label") || "").trim().slice(0, 120);
  const ok = pick.length ? (await q<{ id: string }>("select id from clients where id in (?)", [pick])).map((x) => x.id) : [];
  if (!ok.length) return "Pilih minimal satu klien.";
  const c = pick.filter((x) => ok.includes(x)).join(",");
  await exec("insert into share_links (token, client_id, label, dibuat_oleh) values (?, ?, ?, ?)", [randomBytes(20).toString("hex"), c, label || null, me.id]);
  await logAct(me, "buat link klien", c.split(",")[0], (label || "") + (c.includes(",") ? ` · ${c}` : ""));
  return done("Link dibuat. Salin dan kirim ke klien.");
}
export async function revokeLink(_p: string | null, f: FormData): Promise<string | null> {
  const me = await requireAdmin();
  if (!me) return "Hanya admin.";
  const l = (await q<{ client_id: string; label: string | null }>("select client_id, label from share_links where token = ?", [String(f.get("token") || "")]))[0];
  await exec("update share_links set aktif = 0 where token = ?", [String(f.get("token") || "")]);
  if (l) await logAct(me, "nonaktifkan link klien", l.client_id.split(",")[0], l.label ?? "");
  return done("Link dinonaktifkan. Link itu tidak bisa dibuka lagi.");
}

async function who(id: number) {
  const u = (await q<{ nama: string; email: string }>("select nama, email from users where id = ?", [id]))[0];
  return u ? `${u.nama} <${u.email}>` : `#${id}`;
}
