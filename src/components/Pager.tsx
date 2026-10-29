"use client";
import { useEffect } from "react";

/* Navigasi halaman otomatis untuk semua tabel panjang (‹ 1 / 26 › + 10/20/50 per halaman). */
const SIZES = [10, 20, 50];
const getSz = () => { try { const v = Number(localStorage.getItem("pg-sz")); return SIZES.includes(v) ? v : 20; } catch { return 20; } };

type TB = HTMLTableSectionElement & { _pg?: number; _sig?: string; _bar?: HTMLDivElement };

function groups(tb: TB): HTMLTableRowElement[][] {
  const rows = Array.from(tb.rows), byHead = rows.some((r) => r.classList.contains("prow"));
  const g: HTMLTableRowElement[][] = [];
  for (const r of rows) { if (!byHead || r.classList.contains("prow") || !g.length) g.push([r]); else g[g.length - 1].push(r); }
  return g;
}

function apply(tb: TB) {
  const table = tb.parentElement as HTMLTableElement | null; if (!table || table.closest(".nopg,.fnote")) return;
  const G = groups(tb), sz = getSz();
  const host = (() => { const p = table.parentElement; if (p && p.children.length === 1 && /auto|scroll/.test(getComputedStyle(p).overflowX)) return p; return table; })();
  if (G.length <= SIZES[0]) { G.flat().forEach((r) => r.removeAttribute("data-pgh")); tb._bar?.remove(); tb._bar = undefined; return; }
  const tot = Math.ceil(G.length / sz); tb._pg = Math.min(Math.max(1, tb._pg ?? 1), tot);
  const pg = tb._pg;
  G.forEach((g, i) => { const hide = i < (pg - 1) * sz || i >= pg * sz; g.forEach((r) => hide ? r.setAttribute("data-pgh", "") : r.removeAttribute("data-pgh")); });
  let bar = tb._bar;
  if (!bar || !bar.isConnected || bar.previousElementSibling !== host) { bar?.remove(); bar = document.createElement("div"); bar.className = "pgr"; host.after(bar); tb._bar = bar;
    bar.addEventListener("click", (e) => { const b = (e.target as HTMLElement).closest("button"); if (!b || b.disabled) return; tb._pg = (tb._pg ?? 1) + (b.dataset.d === "1" ? 1 : -1); apply(tb); });
    bar.addEventListener("change", (e) => { const v = Number((e.target as HTMLSelectElement).value); try { localStorage.setItem("pg-sz", String(v)); } catch { /* */ } tb._pg = 1; document.querySelectorAll("tbody").forEach((t) => apply(t as TB)); });
  }
  const from = (pg - 1) * sz + 1, to = Math.min(G.length, pg * sz);
  bar.innerHTML = `<span class="pgi">${from}–${to} dari ${G.length.toLocaleString("id-ID")}</span><button type="button" data-d="0" aria-label="Halaman sebelumnya"${pg <= 1 ? " disabled" : ""}>‹</button><span class="pgn">${pg}<i>/</i>${tot}</span><button type="button" data-d="1" aria-label="Halaman berikutnya"${pg >= tot ? " disabled" : ""}>›</button><select aria-label="Baris per halaman">${SIZES.map((s) => `<option value="${s}"${s === sz ? " selected" : ""}>${s}/ halaman</option>`).join("")}</select>`;
}

export default function Pager() {
  useEffect(() => {
    let raf = 0;
    const run = () => { raf = 0; document.querySelectorAll("tbody").forEach((t) => { const tb = t as TB; const sig = tb.rows.length + ":" + (tb.rows[0]?.textContent ?? "").slice(0, 40); if (tb._sig !== sig) { tb._sig = sig; tb._pg = 1; } apply(tb); }); };
    const mo = new MutationObserver((ms) => { if (ms.every((m) => Array.from(m.addedNodes).concat(Array.from(m.removedNodes)).every((n) => n instanceof HTMLElement && (n.classList.contains("pgr") || !!n.closest?.(".pgr")) || m.target instanceof HTMLElement && !!m.target.closest(".pgr")))) return; if (!raf) raf = requestAnimationFrame(run); });
    mo.observe(document.body, { childList: true, subtree: true });
    run();
    return () => { mo.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return null;
}
