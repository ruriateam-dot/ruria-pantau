"use client";
import { Fragment, useState, useTransition } from "react";
import { catatSaldo } from "@/app/dashboard/saldo/actions";

export type SaldoRow = { id: string; nama: string; saldo: number | null; waktu: string | null; oleh: string | null; catatan: string | null; riwayat: { saldo: number; waktu: string; oleh: string | null }[] };
const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id");
/* waktu dari server dalam WIB "YYYY-MM-DD HH:MM" */
const umur = (w: string) => { const t = Date.parse(w.replace(" ", "T") + ":00+07:00"), h = (Date.now() - t) / 36e5; return h < 1 ? `${Math.max(1, Math.round(h * 60))} menit lalu` : h < 24 ? `${Math.round(h)} jam lalu` : `${Math.round(h / 24)} hari lalu`; };
const tglW = (w: string) => { const B = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]; return `${+w.slice(8, 10)} ${B[+w.slice(5, 7) - 1]} ${w.slice(0, 4)}, ${w.slice(11, 16)} WIB`; };

export default function SaldoIklan({ rows, canEdit }: { rows: SaldoRow[]; canEdit: boolean }) {
  const [open, setOpen] = useState<string | null>(null), [val, setVal] = useState(""), [cat, setCat] = useState(""), [msg, setMsg] = useState(""), [pend, start] = useTransition(), [hist, setHist] = useState<string | null>(null);
  const save = (id: string) => start(async () => { const r = await catatSaldo(id, val, cat); setMsg(r.msg); if (r.ok) { setOpen(null); setVal(""); setCat(""); } });
  return (
    <div className="card"><h2>Sisa saldo iklan</h2>
      <p className="muted small" style={{ marginTop: -4 }}>Diisi tim yang memegang akun. Waktu input tercatat otomatis.</p>
      <div className="tbl"><table><thead><tr><th>Akun</th><th className="n">Sisa saldo</th><th>Dicatat</th><th>Oleh</th><th>Catatan</th><th /></tr></thead>
        <tbody>{rows.map((r) => <Fragment key={r.id}>
          <tr><td>{r.nama}</td><td className="n"><b>{r.saldo != null ? rp(r.saldo) : "–"}</b></td>
            <td className="small">{r.waktu ? <>{tglW(r.waktu)}<div className={"muted" + (Date.now() - Date.parse(r.waktu.replace(" ", "T") + ":00+07:00") > 3 * 864e5 ? " dn" : "")}>{umur(r.waktu)}</div></> : <span className="muted">Belum pernah diisi</span>}</td>
            <td className="small">{r.oleh ?? "–"}</td><td className="small wrapcell">{r.catatan ?? ""}</td>
            <td style={{ whiteSpace: "nowrap" }}>{r.riwayat.length > 1 && <button type="button" className="ghost small" onClick={() => setHist(hist === r.id ? null : r.id)}>Riwayat</button>}{" "}
              {canEdit && <button type="button" className="small" onClick={() => { setOpen(open === r.id ? null : r.id); setMsg(""); }}>{open === r.id ? "Batal" : "Update saldo"}</button>}</td></tr>
          {open === r.id && <tr key={r.id + "f"}><td colSpan={6}><form className="pfil" onSubmit={(e) => { e.preventDefault(); save(r.id); }}>
            <input inputMode="numeric" placeholder="Sisa saldo (Rp)" value={val} onChange={(e) => setVal(e.target.value)} aria-label="Sisa saldo" autoFocus style={{ maxWidth: 200 }} />
            <input placeholder="Catatan (opsional), mis. sudah top up Rp2 jt" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Catatan" />
            <button type="submit" disabled={pend}>{pend ? "Menyimpan…" : "Simpan"}</button></form></td></tr>}
          {hist === r.id && <tr key={r.id + "h"}><td colSpan={6}><table className="vtab"><thead><tr><th>Waktu</th><th className="n">Saldo</th><th>Oleh</th></tr></thead>
            <tbody>{r.riwayat.map((h, i) => <tr key={i}><td>{tglW(h.waktu)}</td><td className="n">{rp(h.saldo)}</td><td>{h.oleh ?? "–"}</td></tr>)}</tbody></table></td></tr>}
        </Fragment>)}</tbody></table></div>
      {msg && <p className="small" role="status">{msg}</p>}
    </div>);
}
