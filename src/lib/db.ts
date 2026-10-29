import "server-only";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { SCHEMA } from "./schema";

const g = globalThis as unknown as { _pool?: Pool; _ready?: Promise<void> };

function pool() {
  if (!g._pool) {
    g._pool = mysql.createPool({
      host: (process.env.DB_HOST || "127.0.0.1").trim().replace(/^localhost$/i, "127.0.0.1"),
      port: Number(process.env.DB_PORT || 3306),
      database: process.env.DB_NAME?.trim(),
      user: process.env.DB_USER?.trim(),
      password: process.env.DB_PASSWORD,
      connectionLimit: 5,
      dateStrings: true,
      decimalNumbers: true,
      timezone: "+07:00",
    });
  }
  return g._pool;
}

/* Membuat tabel saat aplikasi pertama kali jalan (aman diulang) */
async function ready() {
  if (!g._ready) {
    g._ready = (async () => {
      const stmts = SCHEMA.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
      for (const s of stmts) await pool().query(s);
      // Perubahan kolom (aman untuk MySQL dan MariaDB)
      const cols = async (t: string) => ((await pool().query("select column_name c from information_schema.columns where table_schema = database() and table_name = ?", [t]))[0] as { c: string }[]).map((x) => x.c.toLowerCase());
      // Peran: superadmin (pemilik), admin (tim Ruria), klien (tim klien)
      await pool().query("update users set peran = 'klien' where peran = 'anggota'");
      const sa = (await pool().query("select count(*) n from users where peran = 'superadmin'"))[0] as { n: number }[];
      if (!sa[0].n) await pool().query("update users set peran = 'superadmin' where peran = 'admin' order by id limit 1");
      if (!(await cols("stores")).includes("akun")) {
        await pool().query("alter table stores add column akun varchar(120) null");
        // Akun Shopee yang sudah diketahui dari file arsip
        for (const [id, akun] of [["cahaya-cabydut-shopee", "cabydutkids"], ["cahaya-qaira-shopee", "qairaofficial"], ["cahaya-pepisun-shopee", "pepisun"], ["cahaya-pepico-shopee", "pepico.id"]])
          await pool().query("update stores set akun = ? where id = ? and akun is null", [akun, id]);
      }
      // Saldo iklan per akun toko, diinput tim (riwayat disimpan)
      // Link klien bisa berisi beberapa klien (dipisah koma)
      await pool().query("alter table share_links modify client_id varchar(400) not null");
      // File Seller Centre tambahan (live, produk, affiliate, penghasilan) disimpan utuh per toko & periode
      await pool().query("create table if not exists seller_files (store_id varchar(80) not null, jenis varchar(40) not null, dari date not null, sampai date not null, n int not null default 0, data longtext not null, diupload_oleh int null, diupdate timestamp not null default current_timestamp on update current_timestamp, primary key (store_id, jenis, dari, sampai))");
      // Klien live tanpa toko (Dren) butuh toko Shopee/TikTok agar ekspor live bisa diunggah
      await pool().query("insert ignore into stores (id, client_id, brand, platform) select 'dren-dren-shopee', 'dren', 'Dren', 'Shopee' from clients where id = 'dren' union all select 'dren-dren-tiktok', 'dren', 'Dren', 'TikTok' from clients where id = 'dren'");
      try { await pool().query("alter table live_sessions add column sumber varchar(20) null"); } catch { /* sudah ada */ }
      await pool().query("create table if not exists ad_balance (id bigint auto_increment primary key, store_id varchar(80) not null, saldo decimal(16,2) not null, catatan varchar(200) null, oleh int null, nama varchar(160) null, waktu datetime not null, index (store_id, waktu))");
      // Metrik tambahan dari ekspor Seller Centre (statistik toko, performa produk, laporan iklan)
      await pool().query("create table if not exists store_period (store_id varchar(80) not null, dari date not null, sampai date not null, data longtext not null, primary key (store_id, dari, sampai))");
      await pool().query("create table if not exists product_period (store_id varchar(80) not null, dari date not null, sampai date not null, data longtext not null, primary key (store_id, dari, sampai))");
      await pool().query("create table if not exists ads_meta (store_id varchar(80) not null, dari date not null, sampai date not null, kampanye varchar(255) not null, dilihat bigint null, klik bigint null, keranjang bigint null, primary key (store_id, dari, sampai, kampanye))");
      // Forecast & kebutuhan stok: stok per SKU per tanggal (per klien, gudang dipakai bersama), HPP per SKU, stok pengaman per klien
      await pool().query("create table if not exists stock_snapshot (client_id varchar(40) not null, tanggal date not null, sku varchar(120) not null, produk varchar(300) null, varian varchar(200) null, stok int not null default 0, harga decimal(14,2) null, primary key (client_id, tanggal, sku))");
      await pool().query("create table if not exists hpp (client_id varchar(40) not null, sku varchar(120) not null, hpp decimal(14,2) not null, perkiraan tinyint not null default 0, diupdate timestamp not null default current_timestamp on update current_timestamp, primary key (client_id, sku))");
      try { await pool().query("alter table clients add column stok_pengaman int null"); } catch { /* sudah ada */ }
      // Klien yang stoknya dianggap selalu ada (tidak perlu upload stok): awalnya Just Fluff & Organic Treasure
      try { await pool().query("alter table clients add column tab_klien varchar(200) null"); } catch { /* sudah ada */ }
      try { await pool().query("alter table clients add column stok_selalu_ada tinyint not null default 0"); await pool().query("update clients set stok_selalu_ada = 1 where id in ('jf', 'ot')"); } catch { /* sudah ada */ }
      // Status pesanan per nomor pesanan (dari file pesanan), produk di pesanan batal/retur, dan potongan per pesanan (dari laporan penghasilan)
      await pool().query("create table if not exists orders (store_id varchar(80) not null, order_id varchar(40) not null, tanggal date not null, status varchar(20) not null, status_asli varchar(100) null, alasan varchar(200) null, retur varchar(60) null, gmv decimal(16,2) not null default 0, qty int not null default 0, metode varchar(40) null, provinsi varchar(50) null, kota varchar(60) null, batas_kirim date null, dikirim date null, selesai date null, diupdate timestamp not null default current_timestamp on update current_timestamp, primary key (store_id, order_id), index (store_id, tanggal))");
      await pool().query("create table if not exists order_items (store_id varchar(80) not null, order_id varchar(40) not null, produk varchar(300) not null, varian varchar(80) not null default '', sku varchar(120) null, qty int not null default 0, gmv decimal(16,2) not null default 0, primary key (store_id, order_id, produk, varian)) row_format=dynamic");
      await pool().query("create table if not exists order_fees (store_id varchar(80) not null, order_id varchar(40) not null, dilepas date null, subtotal decimal(16,2) not null default 0, refund decimal(16,2) not null default 0, voucher decimal(16,2) not null default 0, admin decimal(16,2) not null default 0, proses decimal(16,2) not null default 0, layanan decimal(16,2) not null default 0, ongkir decimal(16,2) not null default 0, ams decimal(16,2) not null default 0, pajak decimal(16,2) not null default 0, lain decimal(16,2) not null default 0, dana decimal(16,2) not null default 0, primary key (store_id, order_id))");
      // Data mentah affiliate (upload 4 file: pesanan affiliate TikTok, Transaction Analysis TikTok, validasi komisi Shopee, AMS Shopee) untuk hitung prioritas P1–P5
      await pool().query("create table if not exists aff_orders (store_id varchar(80) not null, platform char(1) not null, order_id varchar(40) not null, item varchar(80) not null, kreator varchar(120) not null, nama varchar(160) null, tanggal date not null, nilai decimal(16,2) not null default 0, gagal tinyint not null default 0, retur decimal(16,2) not null default 0, konten varchar(40) null, mcn varchar(120) null, komisi decimal(14,2) not null default 0, primary key (store_id, order_id, item, kreator), index (store_id, tanggal))");
      await pool().query("create table if not exists aff_ta (store_id varchar(80) not null, bulan char(7) not null, kreator varchar(120) not null, video int not null default 0, live int not null default 0, sampel int not null default 0, konten_sampel int not null default 0, gmv decimal(16,2) not null default 0, primary key (store_id, bulan, kreator))");
      await pool().query("create table if not exists aff_ams (store_id varchar(80) not null, kreator varchar(120) not null, nama varchar(160) null, pembeli_baru int not null default 0, primary key (store_id, kreator))");
      // Nama klien = nama perusahaan (hanya mengganti nama bawaan lama, nama yang sudah diubah manual dibiarkan)
      for (const [id, lama, baru] of [["ot", "Organic Treasure", "PT Bara Infinity Group"], ["jf", "Just Fluff", "PT Justfluff Nusantara Indo"], ["voie", "VOIE", "PT Natural Sense Asia"],
        ["dren", "Dren", "CV Mitra Berkat Indokreasi"], ["pmg", "PMG", "Putera Mahkota Group"]])
        await pool().query("update clients set nama = ? where id = ? and nama = ?", [baru, id, lama]);
    })().catch((e) => { g._ready = undefined; throw e; });
  }
  return g._ready;
}

export async function q<T = RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ready();
  const [rows] = await pool().query(sql, params);
  return rows as T[];
}

export async function exec(sql: string, params: unknown[] = []) {
  await ready();
  const [r] = await pool().query(sql, params);
  return r as { affectedRows: number; insertId: number };
}
