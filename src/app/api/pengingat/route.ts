import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { sendMail, esc } from "@/lib/mail";
import { jadwalHariIni } from "@/components/JadwalUpload";
import { exec, q } from "@/lib/db";

export const dynamic = "force-dynamic";
const PANDUAN = "https://claude.ai/artifact/KcLiA3FgzVkWbrb6GYuwM2";

/* Dipanggil cron harian (scripts/cron.js). Mengirim jadwal upload hari ini ke tim dari email SMTP (halo@ruria.id). */
async function run(req: NextRequest) {
  const key = process.env.REMINDER_KEY ?? "", got = req.headers.get("x-reminder-key") ?? req.nextUrl.searchParams.get("key") ?? "";
  if (key.length < 16 || got.length !== key.length || !timingSafeEqual(Buffer.from(got), Buffer.from(key))) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  const to = (process.env.PENGINGAT_TO || "anindraptr@gmail.com,vava.shufa@gmail.com").split(",").map((s) => s.trim()).filter(Boolean);
  const { judul, L } = jadwalHariIni();
  // Cron boleh jalan setiap jam; email hanya dikirim pada jam 09.xx WIB (tidak bergantung zona waktu server)
  const jamWIB = new Date(Date.now() + 7 * 36e5).getUTCHours();
  if (!req.nextUrl.searchParams.has("ulang") && jamWIB !== Number(process.env.PENGINGAT_JAM || 9)) return NextResponse.json({ ok: true, info: `bukan jam kirim (sekarang jam ${jamWIB} WIB)` });
  const tag = "pengingat:" + new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  if (!req.nextUrl.searchParams.has("ulang") && (await q("select 1 from uploads where jenis = ? limit 1", [tag])).length) return NextResponse.json({ ok: true, info: "sudah terkirim hari ini" });
  const text = `Halo Anin, Vava,\n\nIni jadwal upload hari ini (${judul}) ke report.ruria.id:\n\n` + L.map((x) => `${x.j.toUpperCase()}\n` + x.isi.map((s) => `- ${s}`).join("\n")).join("\n\n") + `\n\nPanduan lengkap: ${PANDUAN}\nAbaikan bagian yang sudah kamu upload.\n\nTerima kasih,\nAhmad — Ruria`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5;color:#1c1a18"><p>Halo Anin, Vava,</p><p>Ini jadwal upload hari ini (<b>${esc(judul)}</b>) ke <a href="https://report.ruria.id">report.ruria.id</a>:</p>` +
    L.map((x) => `<h3 style="margin:16px 0 6px;font-size:14px;color:#D16D3D">${esc(x.j)}</h3><ul style="margin:0;padding-left:18px">${x.isi.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`).join("") +
    `<p style="margin-top:18px"><a href="${PANDUAN}">Panduan lengkap</a> · Abaikan bagian yang sudah kamu upload.</p><p>Terima kasih,<br>Ahmad — Ruria</p></div>`;
  const err = await sendMail(to, `[Ruria] Jadwal upload hari ini — ${judul}`, text, html);
  if (err) return NextResponse.json({ ok: false, error: err }, { status: 500 });
  await exec("insert into uploads (client_id, jenis, nama_file, oleh) values (null, ?, 'email pengingat', null)", [tag]);
  return NextResponse.json({ ok: true, to });
}
export const GET = run;
export const POST = run;
