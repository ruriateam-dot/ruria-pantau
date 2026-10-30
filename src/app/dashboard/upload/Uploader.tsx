"use client";
import { useEffect, useMemo, useState } from "react";
import { detect, type Parsed, type Sheet } from "@/lib/parse";
import { saveUpload, saveOrders, cekIklan } from "./actions";

type C = { id: string; nama: string };
type St = { id: string; client_id: string; brand: string; platform: string; akun?: string | null };
type Item = { name: string; p?: Parsed; err?: string; status?: "run" | "ok" | "err"; msg?: string; s?: string; warn?: string | null; ck?: string };
const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
/* Tebak toko dari akun di file, platform di jenis file, dan nama toko di nama file */
function guess(it: Item, stores: St[], c: string): string {
  if (!it.p || it.p.kind === "live") return "";
  const pl = /shopee/i.test(it.p.label) ? "Shopee" : /tiktok/i.test(it.p.label) ? "TikTok" : "";
  const ak = "akun" in it.p && it.p.akun ? norm(it.p.akun) : "", fn = norm(it.name);
  const C = stores.filter((x) => !pl || x.platform === pl);
  const byAk = ak ? C.filter((x) => x.akun && (norm(x.akun) === ak || ak.includes(norm(x.brand)))) : [];
  if (byAk.length === 1) return byAk[0].id;
  const byNm = C.filter((x) => fn.includes(norm(x.brand)) || (x.akun && fn.includes(norm(x.akun))));
  if (byNm.length === 1) return byNm[0].id;
  const inC = C.filter((x) => x.client_id === c);
  return inC.length === 1 ? inC[0].id : "";
}

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
  const [busy, setBusy] = useState(false), [drag, setDrag] = useState(false);
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
    setItems(out.map((x) => ({ ...x, s: guess(x, stores, c) })));
    setBusy(false);
  }

  const sOf = (it: Item) => it.s || s;
  useEffect(() => { items.forEach((it, i) => { const st = sOf(it); if (!it.p || it.p.kind !== "ads" || !st || it.status || it.ck === st) return; const p = it.p; upd(i, { ck: st });
    cekIklan(st, p.dari, p.sampai, p.rows.reduce((a, r) => a + r[3], 0)).then((w) => upd(i, { warn: w })).catch(() => {}); }); }, [items, s]); // eslint-disable-line react-hooks/exhaustive-deps
  const missing = items.filter((x) => x.p && !x.status && x.p.kind !== "live" && !sOf(x)).length;
  const ready = items.some((x) => x.p && !x.status) && !missing;

  async function save() {
    setBusy(true);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.p || it.status === "ok") continue;
      const st = sOf(it), cl = stores.find((x) => x.id === st)?.client_id ?? c;
      upd(i, { status: "run", msg: "Menyimpan…" });
      let r;
      if (it.p.kind === "produk") {
        const d = it.p.rows.map((x) => x[0]).sort(), rng: [string, string] = [d[0], d[d.length - 1]];
        const N = 2000, parts = Math.ceil(it.p.rows.length / N);
        for (let k = 0; k < parts; k++) {
          upd(i, { msg: `Menyimpan… bagian ${k + 1} dari ${parts}` });
          r = await saveUpload(cl, st, it.name, { kind: "produk", label: it.p.label, rows: it.p.rows.slice(k * N, (k + 1) * N) }, k, parts, rng);
          if (!r.ok) break;
        }
        if (!parts) r = { ok: true, msg: "" };
        const ord = it.p.ord ?? [], oi = it.p.oi ?? [];
        if (r?.ok && ord.length) {
          const M = 3000, pp = Math.ceil(ord.length / M);
          for (let k = 0; k < pp; k++) {
            upd(i, { msg: `Menyimpan status pesanan… bagian ${k + 1} dari ${pp}` });
            const ids = new Set(ord.slice(k * M, (k + 1) * M).map((o) => o[0]));
            r = await saveOrders(cl, st, ord.slice(k * M, (k + 1) * M), oi.filter((x) => ids.has(x[0])));
            if (!r.ok) break;
          }
        }
        if (r?.ok) r = { ok: true, msg: "Tersimpan: " + summary(it.p) + (ord.length ? ` · ${ord.length.toLocaleString("id")} pesanan dengan status` : "") };
      } else r = await saveUpload(cl, st, it.name, it.p);
      upd(i, { status: r!.ok ? "ok" : "err", msg: r!.msg });
    }
    setBusy(false);
  }

  return <div className="card form upl">
    <div className="grid2">
      <label>Klien<select value={c} onChange={(e) => { setC(e.target.value); setS(""); setItems([]); }}>{clients.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}</select></label>
      <label>Toko bawaan (opsional)<select value={s} onChange={(e) => setS(e.target.value)}><option value="">— otomatis per file —</option>{ss.map((x) => <option key={x.id} value={x.id}>{x.platform} · {x.brand}</option>)}</select></label>
    </div>
    <label className={"drop" + (drag ? " over" : "")} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}>
      <input type="file" multiple accept=".xlsx,.xls,.csv,.zip" disabled={busy} onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
      <span>{busy && !items.length ? "Membaca file…" : <><b>Tarik semua file ke sini</b> atau klik untuk memilih (xlsx, csv, zip). Klien, toko dan jenis file dikenali otomatis.</>}</span>
    </label>
    {items.length > 0 && <ul className="ulist">{items.map((it, i) => <li key={i} className={it.status ?? (it.err ? "err" : "")}>
      <b>{it.name}</b>
      {it.p && <div><span className="badge">{it.p.label}</span> {summary(it.p)}</div>}
      {it.p && it.p.kind !== "live" && !it.status && <label className="small">Toko tujuan <select value={it.s ?? ""} onChange={(e) => upd(i, { s: e.target.value })} aria-label={"Toko tujuan " + it.name}><option value="">{store ? `Pakai pilihan atas (${store.platform} · ${store.brand})` : "— pilih toko —"}</option>{stores.map((x) => <option key={x.id} value={x.id}>{clients.find((k) => k.id === x.client_id)?.nama} · {x.platform} · {x.brand}</option>)}</select></label>}
      {it.warn && !it.status && <div className="warnnote small">⚠ {it.warn}</div>}
      {it.err && <div className="err">{it.err}</div>}
      {it.msg && <div className={it.status === "err" ? "err" : it.status === "ok" ? "ok" : "muted"}>{it.msg}</div>}
    </li>)}</ul>}
    {items.length > 0 && <>
      {missing > 0 && <p className="err">{missing} file belum dikenali tokonya. Pilih toko tujuan di file tersebut.</p>}
      <p className="muted small">Toko tujuan tiap file sudah ditebak otomatis, cek sebelum menyimpan. Laporan livestream disimpan per klien.</p>
      <button disabled={!ready || busy} onClick={save}>{busy ? "Menyimpan…" : "Simpan ke dashboard"}</button>
    </>}
  </div>;
}
