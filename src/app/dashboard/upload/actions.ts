"use server";
import { revalidatePath } from "next/cache";
import { q, exec } from "@/lib/db";
import { requireUser, allowedClients } from "@/lib/auth";
import type { Parsed } from "@/lib/parse";
import { logAct } from "@/lib/log";
import { ingestAff, rebuildAff } from "@/lib/affBuild";
const AFF_JENIS = ["aff-pesanan-tiktok", "aff-tiktok", "validasi-shopee", "aff-shopee"];

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

/* Sesi live dari ekspor platform (Shopee: Daftar Livestream, TikTok: Analitik LIVE) masuk ke tab Livestream.
   Tanggal yang sudah punya data dari laporan host tidak ditimpa; sesi Shopee & TikTok yang mulai bersamaan (<=20 menit) digabung. */
async function liveFromPlatform(clientId: string, brand: string, p: Extract<Parsed, { kind: "file" }>, uid: number) {
  const d = p.data as { rows: (string | number)[][] }, tt = p.jenis === "live-tiktok";
  let rows = d.rows;
  if (tt) { const c = new Map<string, number>(); rows.forEach((r) => c.set(String(r[2]), (c.get(String(r[2])) ?? 0) + 1)); const own = [...c].sort((a, b) => b[1] - a[1])[0]?.[0]; rows = rows.filter((r) => String(r[2]) === own); }
  if (!rows.length) return;
  const dates = [...new Set(rows.map((r) => String(r[0]).slice(0, 10)))];
  const manual = new Set((await q<{ t: string }>("select distinct date_format(tanggal, '%Y-%m-%d') t from live_sessions where client_id = ? and tanggal in (?) and (sumber is null or sumber not like 'platform%')", [clientId, dates])).map((x) => x.t));
  const use = rows.filter((r) => !manual.has(String(r[0]).slice(0, 10)));
  const other = tt ? "platform-shopee" : "platform-tiktok", mine = tt ? "platform-tiktok" : "platform-shopee";
  await exec("delete from live_sessions where client_id = ? and brand = ? and sumber = ? and tanggal between ? and ?", [clientId, brand, mine, p.dari, p.sampai]);
  const ex = await q<{ id: number; t: string; j: number; s: string }>("select id, date_format(tanggal, '%Y-%m-%d') t, jam_mulai j, sumber s from live_sessions where client_id = ? and brand = ? and sumber in (?, 'platform-gabung') and tanggal between ? and ?", [clientId, brand, other, p.dari, p.sampai]);
  for (const r of use) {
    const t = String(r[0]), day = t.slice(0, 10), jam = +t.slice(11, 13) + +t.slice(14, 16) / 60, du = Number(r[1]), g = Number(tt ? r[4] : r[9]) || 0, pen = Number(tt ? r[7] : r[3]) || null;
    const m = ex.find((x) => x.t === day && Math.abs(Number(x.j) - jam) <= 0.34);
    if (m) { await exec(`update live_sessions set ${tt ? "gmv_tiktok" : "gmv_shopee"} = ?, sumber = 'platform-gabung' where id = ?`, [g, m.id]); ex.splice(ex.indexOf(m), 1); continue; }
    await exec("insert into live_sessions (client_id, brand, tanggal, jam_mulai, durasi_jam, gmv_shopee, gmv_tiktok, host, penonton, diupload_oleh, sumber) values (?, ?, ?, ?, ?, ?, ?, null, ?, ?, ?)",
      [clientId, brand, day, +jam.toFixed(2), du, tt ? 0 : g, tt ? g : 0, pen, uid, mine]);
  }
}

/* Iklan Shopee sebelum tanggal ini sudah tidak bisa diunduh ulang dari Shopee: hanya boleh ditambah, tidak ditimpa */
const SHOPEE_ADS_ARSIP = "2026-04-01";

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

    if (p.kind === "file") {
      if (p.platform && st!.platform !== p.platform) return { ok: false, msg: `File ini laporan ${p.platform}, tetapi toko yang dipilih ${st!.brand} ${st!.platform}.` };
      if (p.akun && /^penghasilan/.test(p.jenis)) {
        if (st!.akun && st!.akun.toLowerCase() !== p.akun.toLowerCase()) return { ok: false, msg: `File ini milik akun "${p.akun}", sedangkan toko ${st!.brand} ${st!.platform} tercatat sebagai akun "${st!.akun}". Periksa lagi pilihan toko.` };
      }
      if (p.jenis === "stok") {
        const D = p.data as [string, string, string, number, number][];
        for (let i = 0; i < D.length; i += 1000) await exec("insert into stock_snapshot (client_id, tanggal, sku, produk, varian, stok, harga) values ? on duplicate key update produk = values(produk), varian = values(varian), stok = values(stok), harga = values(harga)",
          [D.slice(i, i + 1000).map((x) => [clientId, p.dari, x[0].slice(0, 120), x[1], x[2], Math.round(x[3]), x[4] || null])]);
        await log(clientId, "stok", file, p.dari, p.sampai, p.n, uid);
        return { ok: true, msg: `Tersimpan: ${p.info}. Dipakai untuk kebutuhan stok semua toko ${clientId}.` };
      }
      if (/^penghasilan/.test(p.jenis)) {
        const F = ((p.data as { fees?: (string | number | null)[][] }).fees ?? []);
        for (const c of chunk(F, 1000)) await exec("insert into order_fees (store_id, order_id, dilepas, subtotal, refund, voucher, admin, proses, layanan, ongkir, ams, pajak, lain, dana) values ? on duplicate key update dilepas = values(dilepas), subtotal = values(subtotal), refund = values(refund), voucher = values(voucher), admin = values(admin), proses = values(proses), layanan = values(layanan), ongkir = values(ongkir), ams = values(ams), pajak = values(pajak), lain = values(lain), dana = values(dana)",
          [c.map((r) => [st!.id, String(r[0]).slice(0, 40), ...r.slice(1)])]);
      }
      await exec("insert into seller_files (store_id, jenis, dari, sampai, n, data, diupload_oleh) values (?, ?, ?, ?, ?, ?, ?) on duplicate key update n = values(n), data = values(data), diupload_oleh = values(diupload_oleh)",
        [st!.id, p.jenis, p.dari, p.sampai, p.n, JSON.stringify(p.data), uid]);
      if (p.jenis === "produk-shopee" && p.pp) await exec("insert into product_period (store_id, dari, sampai, data) values (?, ?, ?, ?) on duplicate key update data = values(data)", [st!.id, p.dari, p.sampai, JSON.stringify(p.pp)]);
      if (p.jenis === "live-shopee" || p.jenis === "live-tiktok") await liveFromPlatform(clientId, st!.brand, p, uid);
      await log(clientId, p.jenis, file, p.dari, p.sampai, p.n, uid);
      // File affiliate: simpan data mentah lalu hitung ulang prioritas P1–P5 klien ini
      if (AFF_JENIS.includes(p.jenis)) {
        await ingestAff(st!.id, p.jenis, p.dari, p.data as { rows: (string | number)[][] });
        const r = await rebuildAff(clientId);
        revalidatePath("/dashboard");
        return { ok: true, msg: `Tersimpan: ${p.info} (${p.dari} s/d ${p.sampai}). ${r}` };
      }
      return { ok: true, msg: `Tersimpan: ${p.info} (${p.dari} s/d ${p.sampai}).` };
    }

    if (p.kind === "sales") {
      if (p.sp) await exec("insert into store_period (store_id, dari, sampai, data) values (?, ?, ?, ?) on duplicate key update data = values(data)", [st!.id, p.sp.dari, p.sp.sampai, JSON.stringify(p.sp.data)]);
      await exec("insert into daily_sales (store_id, tanggal, gmv, pesanan, pengunjung, sumber, diupload_oleh) values ? on duplicate key update gmv = values(gmv), pesanan = values(pesanan), pengunjung = values(pengunjung), sumber = values(sumber), diupload_oleh = values(diupload_oleh)",
        [p.rows.map((r) => [st!.id, r[0], r[1], r[2], r[3], p.sumber, uid])]);
      const [d0, d1] = span(p.rows.map((r) => r[0]));
      await log(clientId, p.sumber, file, d0, d1, p.rows.length, uid);
      return { ok: true, msg: `${p.rows.length} hari tersimpan (${d0} s/d ${d1}), GMV ${rp(p.rows.reduce((s, r) => s + r[1], 0))}.` };
    }

    if (p.kind === "ads") {
      // Pengaman: data lama yang sudah tidak bisa diunduh ulang tidak boleh tertimpa file kosong / tidak lengkap
      const old = await q<{ dari: string; sampai: string; kampanye: string; biaya: number }>("select date_format(dari, '%Y-%m-%d') dari, date_format(sampai, '%Y-%m-%d') sampai, kampanye, biaya from ads where store_id = ? and dari >= ? and sampai <= ?", [st!.id, p.dari, p.sampai]);
      const oldB = old.reduce((a, x) => a + +x.biaya, 0), newB = p.rows.reduce((a, r) => a + r[3], 0);
      const arsip = st!.platform === "Shopee" && p.dari < SHOPEE_ADS_ARSIP;
      let rows = p.rows;
      if (arsip && old.length) {
        // Periode arsip Shopee: hanya menambah kampanye/tanggal yang belum ada, data lama tidak dihapus
        const ada = new Set(old.map((x) => `${x.dari}|${x.sampai}|${x.kampanye}`));
        rows = p.rows.filter((r) => !ada.has(`${r[0]}|${r[1]}|${r[2]}`));
        if (!rows.length) return { ok: true, msg: `Tidak ada data baru: iklan Shopee sebelum ${SHOPEE_ADS_ARSIP} sudah tersimpan dan tidak ditimpa (data lama sudah tidak bisa diunduh ulang dari Shopee).` };
      } else {
        if (oldB > 0 && newB < oldB * 0.5) return { ok: false, msg: `Upload ditahan: biaya iklan di file ini (${rp(newB)}) jauh lebih kecil dari data yang sudah tersimpan untuk ${p.dari} s/d ${p.sampai} (${rp(oldB)}). Kemungkinan file tidak lengkap. Cek kembali periode file, atau hubungi superadmin bila memang ingin menimpa.` };
        await exec("delete from ads where store_id = ? and dari >= ? and sampai <= ?", [st!.id, p.dari, p.sampai]);
      }
      await exec("insert into ads (store_id, dari, sampai, kampanye, biaya, gmv, pesanan, diupload_oleh) values ?", [rows.map((r) => [st!.id, ...r, uid])]);
      if (p.meta?.length) await exec("insert into ads_meta (store_id, dari, sampai, kampanye, dilihat, klik, keranjang) values ? on duplicate key update dilihat = values(dilihat), klik = values(klik), keranjang = values(keranjang)", [p.meta.map((m) => [st!.id, p.dari, p.sampai, ...m])]);
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

/* Status pesanan per nomor pesanan (dikirim bertahap dari halaman upload setelah rekap produk tersimpan) */
export async function saveOrders(clientId: string, storeId: string, ord: (string | number | null)[][], oi: (string | number)[][]): Promise<Res> {
  const a = await access(clientId, storeId);
  if (a.err) return { ok: false, msg: a.err };
  try {
    for (const c of chunk(ord, 1000)) await exec("insert into orders (store_id, order_id, tanggal, status, status_asli, alasan, retur, gmv, qty, metode, provinsi, kota, batas_kirim, dikirim, selesai) values ? on duplicate key update tanggal = values(tanggal), status = values(status), status_asli = values(status_asli), alasan = values(alasan), retur = values(retur), gmv = values(gmv), qty = values(qty), metode = values(metode), provinsi = values(provinsi), kota = values(kota), batas_kirim = values(batas_kirim), dikirim = values(dikirim), selesai = values(selesai)",
      [c.map((r) => [storeId, String(r[0]).slice(0, 40), ...r.slice(1)])]);
    if (oi.length) {
      const ids = [...new Set(oi.map((r) => String(r[0])))];
      for (const c of chunk(ids, 1000)) await exec("delete from order_items where store_id = ? and order_id in (?)", [storeId, c]);
      const M = new Map<string, (string | number)[]>();
      for (const r of oi) { const k = `${r[0]}|${r[1]}|${r[2]}`; const x = M.get(k); if (x) { (x[4] as number) += +r[4]; (x[5] as number) += +r[5]; } else M.set(k, [...r]); }
      for (const c of chunk([...M.values()], 1000)) await exec("insert into order_items (store_id, order_id, produk, varian, sku, qty, gmv) values ?", [c.map((r) => [storeId, String(r[0]).slice(0, 40), r[1], r[2], r[3], r[4], r[5]])]);
    }
  } catch (e) { return { ok: false, msg: "Gagal menyimpan status pesanan: " + (e as Error).message }; }
  return { ok: true, msg: "" };
}
