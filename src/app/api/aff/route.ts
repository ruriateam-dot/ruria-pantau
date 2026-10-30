import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { getUser, allowedClients, canWork } from "@/lib/auth";
import { q, exec } from "@/lib/db";
import { logAct } from "@/lib/log";

export const dynamic = "force-dynamic";
const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });

/* Link klien (tanpa login): hanya boleh membaca klien yang ada di link */
async function shareOk(c: string | null, t: string | null) {
  if (!c || !t || !/^[a-f0-9]{40}$/.test(t)) return false;
  const r = await q<{ client_id: string }>("select client_id from share_links where token = ? and aktif = 1", [t]);
  return !!r[0] && r[0].client_id.split(",").includes(c);
}
async function guard(c: string | null) {
  const u = await getUser();
  if (!u) return { err: bad("Sesi login habis", 401) };
  if (!c || !(await allowedClients(u)).includes(c)) return { err: bad("Tidak punya akses", 403) };
  return { u };
}
const okPath = (s: unknown): s is string => typeof s === "string" && s.length > 0 && s.length <= 190 && /^[\w\-./@]+$/.test(s);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams, c = sp.get("c");
  if (!(await shareOk(c, sp.get("t")))) { const g = await guard(c); if (g.err) return g.err; }
  const file = sp.get("file");
  if (file) {
    const r = await q<{ isi: string }>("select isi from aff_files where client_id = ? and nama = ?", [c, file]);
    if (!r[0]) return bad("Data belum ada", 404);
    return new NextResponse(r[0].isi, { headers: { "content-type": "application/json", "cache-control": "private, max-age=300" } });
  }
  const coll = sp.get("coll"), id = sp.get("id");
  if (!okPath(coll)) return bad("Koleksi tidak valid");
  if (id) {
    const r = await q<{ data: string }>("select data from aff_docs where client_id = ? and coll = ? and id = ?", [c, coll, id]);
    return NextResponse.json({ data: r[0] ? JSON.parse(r[0].data) : null });
  }
  const r = await q<{ id: string; data: string }>("select id, data from aff_docs where client_id = ? and coll = ? limit 5000", [c, coll]);
  return NextResponse.json(r.map((x) => ({ id: x.id, data: JSON.parse(x.data) })));
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null) as { c?: string; op?: string; coll?: string; id?: string; data?: unknown } | null;
  if (!b) return bad("Data tidak valid");
  const g = await guard(b.c ?? null); if (g.err) return g.err;
  // Tim klien hanya bisa melihat; perubahan hanya oleh tim Ruria (log aktivitas tetap boleh tercatat)
  if (!canWork(g.u) && !/^jf_log/.test(b.coll ?? "")) return bad("Akun klien hanya bisa melihat data affiliate", 403);
  if (!okPath(b.coll)) return bad("Koleksi tidak valid");
  const body = JSON.stringify(b.data ?? {});
  const d = b.data as Record<string, unknown> | undefined;
  const ringkas = d ? Object.entries(d).filter(([, v]) => ["string", "number", "boolean"].includes(typeof v)).slice(0, 6).map(([k, v]) => `${k}=${String(v).slice(0, 40)}`).join(", ") : "";
  if (!/^jf_log/.test(b.coll ?? "")) await logAct(g.u!, "affiliate " + (b.op ?? ""), b.c ?? null, `${b.coll}${b.id ? "/" + b.id : ""}${ringkas ? " · " + ringkas : ""}`);
  if (body.length > 200_000) return bad("Data terlalu besar");
  if (b.op === "add") {
    const id = randomBytes(10).toString("hex");
    await exec("insert into aff_docs (client_id, coll, id, data) values (?, ?, ?, ?)", [b.c, b.coll, id, body]);
    return NextResponse.json({ id });
  }
  if (!okPath(b.id) || b.id.includes("/")) return bad("ID tidak valid");
  if (b.op === "set") await exec("insert into aff_docs (client_id, coll, id, data) values (?, ?, ?, ?) on duplicate key update data = values(data)", [b.c, b.coll, b.id, body]);
  else if (b.op === "update") {
    const r = await q<{ data: string }>("select data from aff_docs where client_id = ? and coll = ? and id = ?", [b.c, b.coll, b.id]);
    if (!r[0]) return bad("Dokumen tidak ditemukan", 404);
    await exec("update aff_docs set data = ? where client_id = ? and coll = ? and id = ?", [JSON.stringify({ ...JSON.parse(r[0].data), ...(b.data as object) }), b.c, b.coll, b.id]);
  } else if (b.op === "delete") await exec("delete from aff_docs where client_id = ? and coll = ? and id = ?", [b.c, b.coll, b.id]);
  else return bad("Operasi tidak dikenal");
  return NextResponse.json({ ok: true });
}
