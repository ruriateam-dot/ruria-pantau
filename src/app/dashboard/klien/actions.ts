"use server";
import { revalidatePath } from "next/cache";
import { q, exec } from "@/lib/db";
import { requireSuper as requireAdmin } from "@/lib/auth";
import { logAct } from "@/lib/log";

type R = { ok: boolean; msg: string };
const MOD = ["toko", "iklan", "live", "affiliate"];
const PF = ["Shopee", "TikTok", "Lazada", "CPAS"];
const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 36);
const done = (msg: string): R => { revalidatePath("/dashboard", "layout"); return { ok: true, msg }; };

export async function saveClient(_p: R | null, f: FormData): Promise<R> {
  const me = await requireAdmin(); if (!me) return { ok: false, msg: "Hanya superadmin." };
  const id = String(f.get("id") || ""), nama = String(f.get("nama") || "").trim().slice(0, 150);
  const modul = f.getAll("modul").map(String).filter((m) => MOD.includes(m));
  const tr = String(f.get("target") || "").replace(",", ".").trim(), target = tr ? Number(tr) : null;
  if (!nama) return { ok: false, msg: "Isi nama klien." };
  if (!modul.length) return { ok: false, msg: "Pilih minimal satu modul." };
  if (target != null && (!isFinite(target) || target < 0 || target > 1000)) return { ok: false, msg: "Target ROAS tidak valid." };
  const ssa = f.get("stok_selalu_ada") ? 1 : 0;
  if (id) {
    await exec("update clients set nama = ?, modul = ?, target_roas = ?, stok_selalu_ada = ? where id = ?", [nama, modul.join(","), target, ssa, id]);
    await logAct(me, "ubah klien", id, `${nama} · modul ${modul.join(", ")} · target ROAS ${target ?? "–"}`);
    return done("Klien disimpan.");
  }
  let nid = slug(nama) || "klien", i = 2;
  while ((await q("select id from clients where id = ?", [nid])).length) nid = `${slug(nama)}-${i++}`;
  await exec("insert into clients (id, nama, modul, target_roas, stok_selalu_ada) values (?, ?, ?, ?, ?)", [nid, nama, modul.join(","), target, ssa]);
  await logAct(me, "tambah klien", nid, `${nama} · modul ${modul.join(", ")}`);
  return done(`Klien ${nama} ditambahkan. Tambahkan tokonya di bawah.`);
}

export async function addStore(_p: R | null, f: FormData): Promise<R> {
  const me = await requireAdmin(); if (!me) return { ok: false, msg: "Hanya superadmin." };
  const c = String(f.get("client") || ""), brand = String(f.get("brand") || "").trim().slice(0, 80), pf = String(f.get("platform") || "");
  const akun = String(f.get("akun") || "").trim().slice(0, 120) || null;
  if (!(await q("select id from clients where id = ?", [c])).length) return { ok: false, msg: "Klien tidak ditemukan." };
  if (!brand) return { ok: false, msg: "Isi nama toko/brand." };
  if (!PF.includes(pf)) return { ok: false, msg: "Pilih platform." };
  const id = `${c}-${slug(brand)}-${pf.toLowerCase()}`.slice(0, 80);
  if ((await q("select id from stores where id = ?", [id])).length) return { ok: false, msg: `${brand} · ${pf} sudah ada.` };
  await exec("insert into stores (id, client_id, brand, platform, akun) values (?, ?, ?, ?, ?)", [id, c, brand, pf, akun]);
  await logAct(me, "tambah toko", c, `${brand} · ${pf}${akun ? ` · akun ${akun}` : ""}`);
  return done(`Toko ${brand} · ${pf} ditambahkan.`);
}

export async function editStore(_p: R | null, f: FormData): Promise<R> {
  const me = await requireAdmin(); if (!me) return { ok: false, msg: "Hanya superadmin." };
  const id = String(f.get("id") || ""), brand = String(f.get("brand") || "").trim().slice(0, 80), akun = String(f.get("akun") || "").trim().slice(0, 120) || null;
  if (!brand) return { ok: false, msg: "Nama toko tidak boleh kosong." };
  const s = (await q<{ client_id: string }>("select client_id from stores where id = ?", [id]))[0]; if (!s) return { ok: false, msg: "Toko tidak ditemukan." };
  await exec("update stores set brand = ?, akun = ? where id = ?", [brand, akun, id]);
  await logAct(me, "ubah toko", s.client_id, `${id} → ${brand}${akun ? ` · akun ${akun}` : ""}`);
  return done("Toko disimpan.");
}

export async function deleteStore(_p: R | null, f: FormData): Promise<R> {
  const me = await requireAdmin(); if (!me) return { ok: false, msg: "Hanya superadmin." };
  const id = String(f.get("id") || "");
  const n = (await q<{ n: number }>("select (select count(*) from daily_sales where store_id = ?) + (select count(*) from ads where store_id = ?) + (select count(*) from product_sales where store_id = ?) n", [id, id, id]))[0].n;
  if (n) return { ok: false, msg: "Toko ini sudah punya data, jadi tidak bisa dihapus (supaya riwayat tidak hilang)." };
  const s = (await q<{ client_id: string; brand: string; platform: string }>("select client_id, brand, platform from stores where id = ?", [id]))[0];
  await exec("delete from stores where id = ?", [id]);
  if (s) await logAct(me, "hapus toko", s.client_id, `${s.platform} · ${s.brand}`);
  return done("Toko dihapus.");
}
