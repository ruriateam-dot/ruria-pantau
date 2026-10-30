"use server";
import { revalidatePath } from "next/cache";
import { q, exec } from "@/lib/db";
import { requireWorker as requireAdmin, allowedClients } from "@/lib/auth";
import { logAct } from "@/lib/log";

/* Tim Ruria mencatat sisa saldo iklan per akun toko. Waktu input dicatat otomatis oleh server. */
export async function catatSaldo(storeId: string, saldoTxt: string, catatan: string): Promise<{ ok: boolean; msg: string }> {
  const me = await requireAdmin(); if (!me) return { ok: false, msg: "Silakan login dulu." };
  const saldo = Number(String(saldoTxt).replace(/[^\d]/g, ""));
  if (!String(saldoTxt).trim() || !isFinite(saldo) || saldo < 0 || saldo > 1e12) return { ok: false, msg: "Isi saldo dalam rupiah, misalnya 1500000." };
  const st = (await q<{ client_id: string; brand: string; platform: string }>("select client_id, brand, platform from stores where id = ?", [storeId]))[0];
  if (!st) return { ok: false, msg: "Toko tidak ditemukan." };
  if (!(await allowedClients(me)).includes(st.client_id)) return { ok: false, msg: "Akun ini tidak punya akses ke klien tersebut." };
  // Waktu disimpan dalam WIB dari jam server aplikasi (tidak bergantung zona waktu database)
  const wib = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 19).replace("T", " ");
  await exec("insert into ad_balance (store_id, saldo, catatan, oleh, nama, waktu) values (?, ?, ?, ?, ?, ?)", [storeId, saldo, catatan.trim().slice(0, 200) || null, me.id, me.nama || me.email, wib]);
  await logAct(me, "catat saldo iklan", st.client_id, `${st.platform} · ${st.brand}: Rp${saldo.toLocaleString("id")}`);
  revalidatePath("/dashboard");
  return { ok: true, msg: `Saldo ${st.platform} · ${st.brand} tercatat.` };
}
