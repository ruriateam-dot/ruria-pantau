"use server";
import { revalidatePath } from "next/cache";
import { q, exec } from "@/lib/db";
import { requireAdmin, requireWorker, allowedClients } from "@/lib/auth";
import { logAct } from "@/lib/log";

type R = { ok: boolean; msg: string };
const T = /^([01]\d|2[0-3]):[0-5]\d$/;
const D = /^\d{4}-\d{2}-\d{2}$/;
const PF = ["Shopee+TikTok", "Shopee", "TikTok"];
const min = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3);
/* Rentang menit; shift yang melewati tengah malam berlanjut ke hari berikutnya */
const span = (d: string, a: string, b: string) => { const base = Date.parse(d + "T00:00:00Z") / 60000; const s = base + min(a); let e = base + min(b); if (e <= s) e += 1440; return [s, e]; };
const done = (msg: string): R => { revalidatePath("/dashboard/jadwal"); return { ok: true, msg }; };

export async function addHost(nama: string): Promise<R> {
  const me = await requireAdmin(); if (!me) return { ok: false, msg: "Hanya admin." };
  const n = nama.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!n) return { ok: false, msg: "Isi nama host." };
  if ((await q("select id from hosts where nama = ?", [n])).length) { await exec("update hosts set aktif = 1 where nama = ?", [n]); return done(`${n} diaktifkan lagi.`); }
  await exec("insert into hosts (nama) values (?)", [n]);
  await logAct(me, "tambah host", null, n);
  return done(`Host ${n} ditambahkan.`);
}
export async function toggleHost(id: number, aktif: boolean): Promise<R> {
  const me = await requireAdmin(); if (!me) return { ok: false, msg: "Hanya admin." };
  await exec("update hosts set aktif = ? where id = ?", [aktif ? 1 : 0, id]);
  await logAct(me, aktif ? "aktifkan host" : "nonaktifkan host", null, String(id));
  return done(aktif ? "Host diaktifkan." : "Host dinonaktifkan (jadwal lama tetap tersimpan).");
}

export type Shift = { id?: number; client_id: string; tanggal: string; mulai: string; selesai: string; host_id: number; platform: string; catatan?: string };

async function conflict(s: Shift) {
  const [a, b] = span(s.tanggal, s.mulai, s.selesai);
  const near = await q<{ id: number; client: string; tanggal: string; mulai: string; selesai: string }>(
    "select l.id, c.nama client, l.tanggal, l.mulai, l.selesai from live_schedule l join clients c on c.id = l.client_id where l.host_id = ? and l.tanggal between ? - interval 1 day and ? + interval 1 day and l.id <> ?",
    [s.host_id, s.tanggal, s.tanggal, s.id ?? 0]);
  return near.find((x) => { const [c, d] = span(x.tanggal, x.mulai, x.selesai); return a < d && c < b; });
}

export async function saveShift(s: Shift): Promise<R> {
  const me = await requireWorker(); if (!me) return { ok: false, msg: "Silakan login dulu." };
  if (!(await allowedClients(me)).includes(s.client_id)) return { ok: false, msg: "Akun ini tidak punya akses ke brand tersebut." };
  if (!D.test(s.tanggal) || !T.test(s.mulai) || !T.test(s.selesai)) return { ok: false, msg: "Tanggal atau jam tidak valid." };
  if (s.mulai === s.selesai) return { ok: false, msg: "Jam mulai dan selesai tidak boleh sama." };
  if (!PF.includes(s.platform)) return { ok: false, msg: "Platform tidak valid." };
  if (!(await q("select id from clients where id = ? and find_in_set('live', modul)", [s.client_id])).length) return { ok: false, msg: "Brand tidak valid." };
  if (!(await q("select id from hosts where id = ? and aktif = 1", [s.host_id])).length) return { ok: false, msg: "Pilih host yang aktif." };
  const c = await conflict(s);
  if (c) return { ok: false, msg: `Bentrok: host ini sudah dijadwalkan di ${c.client} ${c.tanggal} ${c.mulai}–${c.selesai}.` };
  const cat = (s.catatan ?? "").trim().slice(0, 200) || null;
  if (s.id) await exec("update live_schedule set client_id = ?, tanggal = ?, mulai = ?, selesai = ?, host_id = ?, platform = ?, catatan = ? where id = ?", [s.client_id, s.tanggal, s.mulai, s.selesai, s.host_id, s.platform, cat, s.id]);
  else await exec("insert into live_schedule (client_id, tanggal, mulai, selesai, host_id, platform, catatan, dibuat_oleh) values (?, ?, ?, ?, ?, ?, ?, ?)", [s.client_id, s.tanggal, s.mulai, s.selesai, s.host_id, s.platform, cat, me.id]);
  const h = (await q<{ nama: string }>("select nama from hosts where id = ?", [s.host_id]))[0]?.nama;
  await logAct(me, s.id ? "ubah jadwal live" : "tambah jadwal live", s.client_id, `${h} · ${s.tanggal} ${s.mulai}–${s.selesai} · ${s.platform}`);
  return done("Jadwal disimpan.");
}

export async function deleteShift(id: number): Promise<R> {
  const me = await requireWorker(); if (!me) return { ok: false, msg: "Silakan login dulu." };
  const own = (await q<{ client_id: string }>("select client_id from live_schedule where id = ?", [id]))[0];
  if (own && !(await allowedClients(me)).includes(own.client_id)) return { ok: false, msg: "Akun ini tidak punya akses ke brand tersebut." };
  const x = (await q<{ client_id: string; tanggal: string; mulai: string; selesai: string; nama: string }>("select l.client_id, l.tanggal, l.mulai, l.selesai, h.nama from live_schedule l join hosts h on h.id = l.host_id where l.id = ?", [id]))[0];
  await exec("delete from live_schedule where id = ?", [id]);
  if (x) await logAct(me, "hapus jadwal live", x.client_id, `${x.nama} · ${x.tanggal} ${x.mulai}–${x.selesai}`);
  return done("Jadwal dihapus.");
}

/* Salin jadwal satu minggu ke minggu berikutnya (yang bentrok dilewati) */
export async function copyWeek(fromMonday: string, client: string | null): Promise<R> {
  const me = await requireWorker(); if (!me) return { ok: false, msg: "Silakan login dulu." };
  const ok = await allowedClients(me);
  if (client && !ok.includes(client)) return { ok: false, msg: "Akun ini tidak punya akses ke brand tersebut." };
  if (!client && me.peran === "klien") { if (ok.length !== 1) return { ok: false, msg: "Pilih brand dulu sebelum menyalin minggu." }; client = ok[0]; }
  if (!D.test(fromMonday)) return { ok: false, msg: "Minggu tidak valid." };
  const rows = await q<Shift & { tanggal: string }>(
    `select client_id, date_format(tanggal + interval 7 day, '%Y-%m-%d') tanggal, mulai, selesai, host_id, platform, catatan from live_schedule
     where tanggal between ? and ? + interval 6 day ${client ? "and client_id = ?" : ""}`, client ? [fromMonday, fromMonday, client] : [fromMonday, fromMonday]);
  if (!rows.length) return { ok: false, msg: "Minggu sumber belum punya jadwal." };
  let n = 0, skip = 0;
  for (const r of rows) {
    if (await conflict(r)) { skip++; continue; }
    await exec("insert into live_schedule (client_id, tanggal, mulai, selesai, host_id, platform, catatan, dibuat_oleh) values (?, ?, ?, ?, ?, ?, ?, ?)", [r.client_id, r.tanggal, r.mulai, r.selesai, r.host_id, r.platform, r.catatan ?? null, me.id]);
    n++;
  }
  await logAct(me, "salin jadwal minggu", client, `dari minggu ${fromMonday}: ${n} jadwal, ${skip} dilewati`);
  return done(`${n} jadwal disalin ke minggu berikutnya${skip ? `, ${skip} dilewati karena bentrok/sudah ada` : ""}.`);
}
