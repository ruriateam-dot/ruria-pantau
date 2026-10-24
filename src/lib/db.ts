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
      if (!(await cols("stores")).includes("akun")) {
        await pool().query("alter table stores add column akun varchar(120) null");
        // Akun Shopee yang sudah diketahui dari file arsip
        for (const [id, akun] of [["cahaya-cabydut-shopee", "cabydutkids"], ["cahaya-qaira-shopee", "qairaofficial"], ["cahaya-pepisun-shopee", "pepisun"], ["cahaya-pepico-shopee", "pepico.id"]])
          await pool().query("update stores set akun = ? where id = ? and akun is null", [akun, id]);
      }
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
