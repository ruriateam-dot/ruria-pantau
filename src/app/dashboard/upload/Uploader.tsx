"use client";
import { useMemo, useState } from "react";
import { detect, type Parsed, type Sheet } from "@/lib/parse";
import { saveUpload } from "./actions";

type C = { id: string; nama: string };
type St = { id: string; client_id: string; brand: string; platform: string };
type Item = { name: string; p?: Parsed; err?: string; status?: "run" | "ok" | "err"; msg?: string };

const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id");

async function readSheets(f: File): Promise<{ name: string; sheets: Record<string, Sheet> }[]> {
  const XLSX = await import("xlsx");
  const one = async (name: string, buf: ArrayBuffer) => {
    const wb = /\.csv$/i.test(name)
      ? XLSX.read(new TextDecoder("utf-8").decode(buf).replace(/^﻿/, ""), { type: "string", raw: true })
      : XLSX.read(buf, { type: "array", raw: true });
    const sheets: Record<string, Sheet> = {};
    for (const n of wb.SheetNames) sheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "" }) as Sheet;
    return { name, sheets };
  };
  const buf = await f.arrayBuffer();
  if (/\.zip$/i.test(f.name)) {
    const { unzipSync } = await import("fflate");
    const files = unzipSync(new Uint8Array(buf));
    const out = [];
    for (const [n, d] of Object.entries(files)) if (/\.(xlsx|xls|csv)$/i.test(n) && !n.startsWith("__MACOSX")) out.push(await one(n.split("/").pop()!, d.slice().buffer));
    return out;
  }
  return [await one(f.name, buf)];
}

function summary(p: Parsed) {
  if (p.kind === "file") return `${p.dari} s/d ${p.dari === p.sampai ? "" : p.sampai} · ${p.info}`.replace(" s/d  ·", " ·");
  if (p.kind === "sales") { const d = p.rows.map((r) => r[0]).sort(); return `${p.rows.length} hari (${d[0]} s/d ${d[d.length - 1]}) · GMV ${rp(p.rows.reduce((s, r) => s + r[1], 0))}${p.akun ? ` · akun ${p.akun}` : ""}`; }
  if (p.kind === "produk") { const d = p.rows.map((r) => r[0]).sort(); return `${new Set(p.rows.map((r) => r[1])).size} produk, ${p.rows.length.toLocaleString("id")} baris (${d[0]} s/d ${d[d.length - 1]}) · GMV ${rp(p.rows.reduce((s, r) => s + r[5], 0))}`; }
  if (p.kind === "ads") { const b = p.rows.reduce((s, r) => s + r[3], 0), g = p.rows.reduce((s, r) => s + r[4], 0); return `${p.rows.length} baris (${p.dari} s/d ${p.sampai}) · biaya ${rp(b)} · ROAS ${b ? (g / b).toFixed(1) : "–"}${p.akun ? ` · akun ${p.akun}` : ""}`; }
  const d = p.rows.map((r) => r[0]).sort();
  return `${p.rows.length} sesi (${d[0]} s/d ${d[d.length - 1]}) · GMV ${rp(p.rows.reduce((s, r) => s + r[3] + r[4], 0))} · host: ${[...new Set(p.rows.map((r) => r[5]).filter(Boolean))].join(", ") || "–"}`;
}

export default function Uploader({ clients, stores }: { clients: C[]; stores: St[] }) {
  const [c, setC] = useState(clients[0]?.id ?? "");
  const [s, setS] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const ss = useMemo(() => stores.filter((x) => x.client_id === c), [stores, c]);
  const store = ss.find((x) => x.id === s);
  const upd = (i: number, patch: Partial<Item>) => setItems((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const out: Item[] = [];
    for (const f of Array.from(files)) {
      try {
        for (const r of await readSheets(f)) {
          try { out.push({ name: r.name, p: detect(r.sheets, r.name) }); }
          catch (e) { out.push({ name: r.name, err: (e as Error).message }); }
        }
      } catch (e) { out.push({ name: f.name, err: "File tidak bisa dibaca: " + (e as Error).message }); }
    }
    setItems(out);
    setBusy(false);
  }

  const needStore = items.some((x) => x.p && x.p.kind !== "live");
  const ready = items.some((x) => x.p && !x.status) && (!needStore || !!store);

  async function save() {
    setBusy(true);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.p || it.status === "ok") continue;
      upd(i, { status: "run", msg: "Menyimpan…" });
      let r;
      if (it.p.kind === "produk") {
        const d = it.p.rows.map((x) => x[0]).sort(), rng: [string, string] = [d[0], d[d.length - 1]];
        const N = 2000, parts = Math.ceil(it.p.rows.length / N);
        for (let k = 0; k < parts; k++) {
          upd(i, { msg: `Menyimpan… bagian ${k + 1} dari ${parts}` });
          r = await saveUpload(c, s, it.name, { ...it.p, rows: it.p.rows.slice(k * N, (k + 1) * N) }, k, parts, rng);
          if (!r.ok) break;
        }
        if (r?.ok) r = { ok: true, msg: "Tersimpan: " + summary(it.p) };
      } else r = await saveUpload(c, s, it.name, it.p);
      upd(i, { status: r!.ok ? "ok" : "err", msg: r!.msg });
    }
    setBusy(false);
  }

  return <div className="card form upl">
    <div className="grid2">
      <label>Klien<select value={c} onChange={(e) => { setC(e.target.value); setS(""); setItems([]); }}>{clients.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}</select></label>
      <label>Toko<select value={s} onChange={(e) => setS(e.target.value)}><option value="">— pilih toko —</option>{ss.map((x) => <option key={x.id} value={x.id}>{x.brand} · {x.platform}</option>)}</select></label>
    </div>
    <label className="drop">
      <input type="file" multiple accept=".xlsx,.xls,.csv,.zip" disabled={busy} onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
      <span>{busy && !items.length ? "Membaca file…" : "Klik untuk memilih file (boleh beberapa sekaligus: xlsx, csv, atau zip)"}</span>
    </label>
    {items.length > 0 && <ul className="ulist">{items.map((it, i) => <li key={i} className={it.status ?? (it.err ? "err" : "")}>
      <b>{it.name}</b>
      {it.p && <div><span className="badge">{it.p.label}</span> {summary(it.p)}</div>}
      {it.err && <div className="err">{it.err}</div>}
      {it.msg && <div className={it.status === "err" ? "err" : it.status === "ok" ? "ok" : "muted"}>{it.msg}</div>}
    </li>)}</ul>}
    {items.length > 0 && <>
      {needStore && !store && <p className="err">Pilih toko tujuan dulu.</p>}
      {store && needStore && <p className="muted small">Akan disimpan ke <b>{store.brand} · {store.platform}</b>. Laporan livestream disimpan per klien.</p>}
      <button disabled={!ready || busy} onClick={save}>{busy ? "Menyimpan…" : "Simpan ke dashboard"}</button>
    </>}
  </div>;
}
