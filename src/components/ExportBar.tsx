"use client";
import { useState } from "react";
import { logExport } from "@/app/actions/log";

const num = (v: string) => {
  const t = v.replace(/Rp|\s|%|▲|▼|\+/g, "");
  if (!/^-?[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
  let x = t; const jt = /jt$/.test(v.trim()), m = /\sM$/.test(v.trim());
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(x) || /,\d+$/.test(x)) x = x.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(x); if (isNaN(n)) return null;
  return jt ? n * 1e6 : m ? n * 1e9 : n;
};
const cellVal = (raw: string) => { const s = raw.trim(); if (/jt$|\sM$|rb$/.test(s)) return s; const n = num(s); return n != null && !/^\d{1,2}\.\d{2}$/.test(s) ? n : s; };

/* Unduh Excel (ringkasan + semua tabel di tab ini) dan cetak / simpan PDF */
export default function ExportBar({ title, client, token }: { title: string; client: string | null; token?: string }) {
  const [busy, setBusy] = useState(false);
  async function excel() {
    setBusy(true);
    try {
      const X = await import("xlsx");
      const root = document.querySelector("main.dv")!;
      const wb = X.utils.book_new();
      const info: (string | number)[][] = [["Ruria Report"], [title], ["Diunduh", new Date().toLocaleString("id-ID")], []];
      root.querySelectorAll(".note").forEach((n) => info.push(["Catatan", n.textContent!.trim()]));
      root.querySelectorAll(".kpi").forEach((k) => info.push([k.querySelector(".kl")?.textContent?.trim() ?? "", k.querySelector(".kv")?.textContent?.trim() ?? "", k.querySelector(".kd")?.textContent?.replace(/\s+/g, " ").trim() ?? ""]));
      root.querySelectorAll(".insc").forEach((c) => { info.push([]); info.push([c.querySelector("h3")!.textContent!.trim().toUpperCase()]); c.querySelectorAll("li").forEach((li, i) => info.push([(c.querySelector("ol") ? `${i + 1}. ` : "• ") + li.textContent!.trim()])); });
      const s0 = X.utils.aoa_to_sheet(info); s0["!cols"] = [{ wch: 60 }, { wch: 18 }, { wch: 30 }]; X.utils.book_append_sheet(wb, s0, "Ringkasan");
      const used = new Set(["Ringkasan"]);
      const nm = (t: string) => { let s = (t || "Tabel").replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || "Tabel"; const b = s; let i = 2; while (used.has(s)) s = `${b.slice(0, 25)} ${i++}`; used.add(s); return s; };
      root.querySelectorAll("table").forEach((tb) => {
        const t = tb.closest(".card")?.querySelector("h2")?.textContent?.trim() ?? "Tabel";
        const aoa = [...(tb as HTMLTableElement).rows].filter((r) => !r.classList.contains("vrow")).map((r) => [...r.cells].map((c, i) => (r.parentElement?.tagName === "THEAD" || i === 0 ? c.textContent!.trim() : cellVal(c.textContent!))));
        if (aoa.length < 2) return;
        const s = X.utils.aoa_to_sheet(aoa); s["!cols"] = aoa[0].map((_, i) => ({ wch: i ? 14 : 40 })); X.utils.book_append_sheet(wb, s, nm(t));
      });
      X.writeFile(wb, `Ruria Report - ${title.replace(/[\\/:*?"<>|]/g, "-")}.xlsx`);
      logExport(client, "Excel · " + title, token);
    } finally { setBusy(false); }
  }
  function pdf() {
    document.querySelectorAll("details.ins").forEach((d) => ((d as HTMLDetailsElement).open = true));
    logExport(client, "PDF · " + title, token);
    const old = document.title; document.title = `Ruria Report - ${title}`;
    window.print(); setTimeout(() => (document.title = old), 500);
  }
  const [open, setOpen] = useState(false);
  return <div className="xbar">
    <div className="xdd"><button type="button" className="ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} disabled={busy}>{busy ? "Menyiapkan…" : <><span className="xlbl">Unduh</span><span className="xdots" aria-hidden="true">⋯</span> ▾</>}</button>
      {open && <div className="xmenu" role="menu" onMouseLeave={() => setOpen(false)}>
        <button type="button" role="menuitem" onClick={() => { setOpen(false); excel(); }}>Excel (.xlsx)</button>
        <button type="button" role="menuitem" onClick={() => { setOpen(false); pdf(); }}>Cetak / PDF</button></div>}</div>
    <div className="ptitle" aria-hidden="true"><b>Ruria Report</b> · {title}</div>
  </div>;
}
