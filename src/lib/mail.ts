import "server-only";
import nodemailer from "nodemailer";
import { headers } from "next/headers";
import { randomBytes } from "crypto";
import { exec } from "./db";

/* Email lewat SMTP (mis. kotak email noreply@ruria.id di Hostinger). Tanpa pengaturan SMTP, email tidak dikirim. */
export const mailReady = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);

export async function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

/* Link sekali pakai untuk membuat / mengganti password, berlaku 3 hari */
export async function passwordLink(userId: number) {
  const t = randomBytes(32).toString("hex");
  await exec("delete from password_tokens where user_id = ? or kadaluarsa < now()", [userId]);
  await exec("insert into password_tokens (token, user_id, kadaluarsa) values (?, ?, now() + interval 3 day)", [t, userId]);
  return `${await appUrl()}/atur-password/${t}`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export async function sendInvite(to: string, nama: string, link: string, oleh: string, baru: boolean): Promise<boolean> {
  if (!mailReady()) return false;
  const port = Number(process.env.SMTP_PORT || 465);
  const tr = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  const judul = baru ? "Undangan ke Ruria Pantau" : "Atur ulang password Ruria Pantau";
  const isi = baru ? `${oleh} membuatkan akun Ruria Pantau untuk Anda.` : `${oleh} meminta Anda mengatur ulang password Ruria Pantau.`;
  try {
    await tr.sendMail({
      from: `"Ruria Pantau" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`, to, subject: judul,
      text: `Halo ${nama},\n\n${isi}\n\nBuat password Anda lewat link ini (berlaku 3 hari, sekali pakai):\n${link}\n\nSetelah itu, masuk dengan email ${to}.\n\nAbaikan email ini jika Anda tidak merasa membutuhkannya.\n\nRuria`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:520px;line-height:1.5;color:#1c2420">
        <h2 style="margin:0 0 12px">${judul}</h2><p>Halo ${esc(nama)},</p><p>${esc(isi)}</p>
        <p><a href="${link}" style="display:inline-block;background:#0f7a5c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Buat password</a></p>
        <p style="font-size:13px;color:#66706a">Link berlaku 3 hari dan hanya bisa dipakai sekali. Setelah itu, masuk dengan email <b>${esc(to)}</b>.<br>Abaikan email ini jika Anda tidak merasa membutuhkannya.</p></div>`,
    });
    return true;
  } catch (e) {
    console.error("Email gagal", (e as Error).message);
    return false;
  }
}
