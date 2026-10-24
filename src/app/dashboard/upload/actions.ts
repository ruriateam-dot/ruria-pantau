"use server";
import { revalidatePath } from "next/cache";
import { q, exec } from "@/lib/db";
import { requireUser, allowedClients } from "@/lib/auth";
import type { Parsed } from "@/lib/parse";
import { logAct } from "@/lib/log";

type Res = { ok: boolean; msg: string };
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id");

async function access(clientId: string, storeId?: string) {
  const u = await requireUser();
  if (!(await allowedClients(u)).includes(clientId)) return { u, err: "Akun ini tidak punya akses ke klien tersebut." };
  if (storeId) {
    const s = await q<{ id: string; akun: string | null; brand: string; platform: string }>("select id, akun, brand, platform from stores where id = ? and client_id = ?", [storeId, clientId]);
    if (!s[0]) return { u, err: "Toko tidak ditemukan untuk klien ini." };
    return { u, err: "", store: s[0] };
  }
  return { u, err: "" };
}

async function log(clientId: string, jenis: string, file: string, dari: string, sampai: string, baris: number, uid: number) {
  const u = (await q<{ id: number; nama: string; peran: string }>("select id, nama, peran from users where id = ?", [uid]))[0] ?? null;
  await logAct(u, "upload", clientId, `${jenis} · ${file} · ${dari} s/d ${sampai}${baris ? ` · ${baris} baris` : ""}`);
  await exec("insert into uploads (client_id, jenis, nama_file, dari, sampai, baris, oleh) values (?, ?, ?, ?, ?, ?, ?)", [clientId, jenis, file.slice(0, 255), dari, sampai, baris, uid]);
}
const span = (ds: string[]) => { const s = [...ds].sort(); return [s[0], s[s.length - 1]]; };

/* Simpan satu file. Untuk data produk yang besar, dipanggil bertahap (part). */
export async function saveUpload(clientId: string, storeId: string, file: string, p: Parsed, part = 0, parts = 1, rng?: [string, string]): Promise<Res> {
  try {
    const needStore = p.kind !== "live";
    const a = await access(clientId, needStore ? storeId : undefined);
    if (a.err) return { ok: false, msg: a.err };
    const st = a.store, uid = a.u.id;

    if (p.kind === "sales" || p.kind === "ads") {
      if (p.kind === "sales" && st!.platform !== (p.sumber === "shop-stats" ? "Shopee" : "TikTok")) return { ok: false, msg: `File ini laporan ${p.sumber === "shop-stats" ? "Shopee" : "TikTok"}, tetapi toko yang dipilih ${st!.brand} ${st!.platform}.` };
      if (p.akun) {
        if (st!.akun && st!.akun.toLowerCase() !== p.akun.toLowerCase()) return { ok: false, msg: `File ini milik akun "${p.akun}", sedangkan toko ${st!.brand} ${st!.platform} tercatat sebagai akun "${st!.akun}". Periksa lagi pilihan toko.` };
        if (!st!.akun) await exec("update stores set akun = ? where id = ?", [p.akun, st!.id]);
      }
    }

    if (p.kind === "sales") {
      await exec("insert into daily_sales (store_id, tanggal, gmv, pesanan, pengunjung, sumber, diupload_oleh) values ? on duplicate key update gmv = values(gmv), pesanan = values(pesanan), pengunjung = values(pengunjung), sumber = values(sumber), diupload_oleh = values(diupload_oleh)",
        [p.rows.map((r) => [st!.id, r[0], r[1], r[2], r[3], p.sumber, uid])]);
      const [d0, d1] = span(p.rows.map((r) => r[0]));
      await log(clientId, p.sumber, file, d0, d1, p.rows.length, uid);
      return { ok: true, msg: `${p.rows.length} hari tersimpan (${d0} s/d ${d1}), GMV ${rp(p.rows.reduce((s, r) => s + r[1], 0))}.` };
    }

    if (p.kind === "ads") {
      await exec("delete from ads where store_id = ? and dari >= ? and sampai <= ?", [st!.id, p.dari, p.sampai]);
      await exec("insert into ads (store_id, dari, sampai, kampanye, biaya, gmv, pesanan, diupload_oleh) values ?", [p.rows.map((r) => [st!.id, ...r, uid])]);
      await log(clientId, "iklan", file, p.dari, p.sampai, p.rows.length, uid);
      const b = p.rows.reduce((s, r) => s + r[3], 0), g = p.rows.reduce((s, r) => s + r[4], 0);
      return { ok: true, msg: `${p.rows.length} baris iklan tersimpan (${p.dari} s/d ${p.sampai}), biaya ${rp(b)}, ROAS ${b ? (g / b).toFixed(1) : "–"}.` };
    }

    if (p.kind === "produk") {
      // Kelompok SKU: pakai kelompok yang sudah ada (nama produk di toko ini, atau kode SKU induk di klien ini)
      const byName = new Map((await q<{ produk: string; grup: string }>("select produk, max(grup) grup from product_sales where store_id = ? and grup is not null group by produk", [st!.id])).map((x) => [x.produk, x.grup]));
      const byCode = new Map((await q<{ k: string; grup: string }>(
        "select substring_index(sku, '.', 1) k, max(grup) grup from product_sales where store_id in (select id from stores where client_id = ?) and sku <> '' and grup is not null group by k", [clientId])).map((x) => [x.k, x.grup]));
      const rows = p.rows.map((r) => { const k = r[3].split(".")[0]; return [st!.id, r[0], r[1], r[2], r[3], byName.get(r[1]) ?? (k ? byCode.get(k) ?? k : null), r[4], r[5], r[6], uid]; });
      if (part === 0) {
        // Bagian pertama: hapus data lama toko ini di rentang tanggal file, lalu isi ulang
        if (rng) await exec("delete from product_sales where store_id = ? and tanggal between ? and ?", [st!.id, rng[0], rng[1]]);
      }
      for (const c of chunk(rows, 1000))
        await exec("insert into product_sales (store_id, tanggal, produk, varian, sku, grup, qty, gmv, pesanan, diupload_oleh) values ? on duplicate key update qty = values(qty), gmv = values(gmv), pesanan = values(pesanan), sku = values(sku), grup = values(grup)", [c]);
      if (part + 1 === parts) {
        if (rng) await log(clientId, "pesanan", file, rng[0], rng[1], 0, uid);
      }
      return { ok: true, msg: "" };
    }

    // live
    const dates = [...new Set(p.rows.map((r) => r[0]))];
    const brands = [...new Set(p.rows.map((r) => r[7]).filter(Boolean))];
    if (brands.length && p.rows.every((r) => r[7])) await exec("delete from live_sessions where client_id = ? and tanggal in (?) and brand in (?)", [clientId, dates, brands]);
    else await exec("delete from live_sessions where client_id = ? and tanggal in (?)", [clientId, dates]);
    await exec("insert into live_sessions (client_id, brand, tanggal, jam_mulai, durasi_jam, gmv_shopee, gmv_tiktok, host, penonton, diupload_oleh) values ?",
      [p.rows.map((r) => [clientId, r[7] || null, r[0], r[1], r[2], r[3], r[4], r[5] || null, r[6], uid])]);
    const [d0, d1] = span(dates);
    await log(clientId, "live", file, d0, d1, p.rows.length, uid);
    return { ok: true, msg: `${p.rows.length} sesi live tersimpan (${d0} s/d ${d1}), GMV ${rp(p.rows.reduce((s, r) => s + r[3] + r[4], 0))}.` };
  } catch (e) {
    return { ok: false, msg: "Gagal menyimpan: " + (e as Error).message };
  } finally {
    revalidatePath("/dashboard");
  }
}

export async function recentUploads() {
  const u = await requireUser();
  const ok = await allowedClients(u);
  if (!ok.length) return [];
  return q<{ waktu: string; klien: string; jenis: string; nama_file: string; dari: string | null; sampai: string | null; oleh: string | null }>(
    `select up.waktu, c.nama klien, up.jenis, up.nama_file, up.dari, up.sampai, us.nama oleh from uploads up
     left join clients c on c.id = up.client_id left join users us on us.id = up.oleh
     where up.client_id in (?) and up.jenis not like 'data-otomatis:%' order by up.id desc limit 20`, [ok]);
}
