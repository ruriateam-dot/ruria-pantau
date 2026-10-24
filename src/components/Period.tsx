"use client";
import { useEffect, useRef, useState } from "react";
import { BLN, BLNF, todayWIB, addDays, lastDay } from "@/lib/period";

type Mode = "day" | "week" | "month" | "year" | "range";
const PRESETS: [string, string][] = [["today", "Hari ini"], ["yday", "Kemarin"], ["7d", "7 hari terakhir"], ["30d", "30 hari terakhir"], ["3m", "3 bulan terakhir"], ["6m", "6 bulan terakhir"], ["mtd", "Bulan ini"]];
const MODES: [Mode, string][] = [["day", "Per Hari"], ["week", "Per Minggu"], ["month", "Per Bulan"], ["year", "Berdasarkan Tahun"], ["range", "Rentang sendiri"]];
const DOW = ["S", "S", "R", "K", "J", "S", "M"];
const mondayOf = (d: string) => addDays(d, -((new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7));
const shiftYM = (ym: string, n: number) => { let [y, m] = ym.split("-").map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${String(m).padStart(2, "0")}`; };

export default function Period({ per, label, onPick }: { per: string; label: string; onPick: (per: string) => void }) {
  const T = todayWIB();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [ym, setYm] = useState(T.slice(0, 7));
  const [year, setYear] = useState(+T.slice(0, 4));
  const [a, setA] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const pick = (p: string) => { setOpen(false); setA(null); onPick(p); };
  const openMode = (m: Mode) => { setMode(m); setA(null); setHover(null); };

  // rentang yang sedang aktif, untuk menyorot kalender
  const cm = per.match(/^custom:(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
  let selLo = cm?.[1] ?? "", selHi = cm?.[2] ?? "";
  if (mode === "week" && hover) { selLo = mondayOf(hover); selHi = addDays(selLo, 6); }
  if (mode === "range" && a) { const h = hover ?? a; selLo = a < h ? a : h; selHi = a < h ? h : a; }

  const clickDay = (d: string) => {
    if (mode === "day") return pick(`custom:${d}_${d}`);
    if (mode === "week") { const m = mondayOf(d); let s = addDays(m, 6); if (s > T) s = T; return pick(`custom:${m}_${s}`); }
    if (!a) { setA(d); return; }
    const lo = a < d ? a : d, hi = a < d ? d : a; pick(`custom:${lo}_${hi}`);
  };

  const cal = (m: string) => {
    const first = (new Date(m + "-01T00:00:00Z").getUTCDay() + 6) % 7, n = +lastDay(m).slice(8);
    return (
      <div className="cm">
        <div className="cw">{DOW.map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="cg">
          {Array.from({ length: first }, (_, i) => <span key={"e" + i} />)}
          {Array.from({ length: n }, (_, i) => {
            const d = `${m}-${String(i + 1).padStart(2, "0")}`, fut = d > T, inr = selLo && d >= selLo && d <= selHi, edge = d === selLo || d === selHi;
            return <button type="button" key={d} disabled={fut} className={"cd" + (inr ? " in" : "") + (edge ? " edge" : "") + (d === T ? " td" : "")}
              onMouseEnter={() => setHover(d)} onClick={() => clickDay(d)}>{i + 1}</button>;
          })}
        </div>
      </div>
    );
  };

  const curMonth = per.startsWith("month:") ? per.slice(6) : "", curYear = per.startsWith("year:") ? per.slice(5) : "";
  const years = Array.from({ length: +T.slice(0, 4) - 2023 }, (_, i) => +T.slice(0, 4) - i).reverse();

  return (
    <div className="pwrap" ref={box}>
      <button type="button" className="pbtn" aria-expanded={open} onClick={() => { setOpen(!open); setMode(null); setYm(T.slice(0, 7)); setYear(+T.slice(0, 4)); }}>
        <span aria-hidden="true">📅</span> {label} (GMT+7)
      </button>
      {open && (
        <div className="ppop" role="dialog" aria-label="Pilih periode">
          <div className="pre">
            {PRESETS.map(([k, l]) => <button type="button" key={k} className={"pi" + (per === k && !mode ? " on" : "")} onMouseEnter={() => setMode(null)} onClick={() => pick(k)}>{l}</button>)}
            <hr />
            {MODES.map(([k, l]) => <button type="button" key={k} className={"pi sub" + (mode === k ? " on" : "")} onMouseEnter={() => openMode(k)} onClick={() => openMode(k)}>{l}<span aria-hidden="true">›</span></button>)}
          </div>
          {mode && (
            <div className="ppanel">
              {(mode === "day" || mode === "week" || mode === "range") && (<>
                <div className="ph"><button type="button" aria-label="Tahun sebelumnya" onClick={() => setYm(shiftYM(ym, -12))}>«</button><button type="button" aria-label="Bulan sebelumnya" onClick={() => setYm(shiftYM(ym, -1))}>‹</button>
                  <b>{BLNF[+ym.slice(5) - 1]} {ym.slice(0, 4)}</b>
                  <button type="button" aria-label="Bulan berikutnya" disabled={ym >= T.slice(0, 7)} onClick={() => setYm(shiftYM(ym, 1))}>›</button><button type="button" aria-label="Tahun berikutnya" disabled={shiftYM(ym, 12) > T.slice(0, 7)} onClick={() => setYm(shiftYM(ym, 12))}>»</button></div>
                {cal(ym)}
                <p className="hint">{mode === "day" ? "Pilih satu tanggal." : mode === "week" ? "Pilih tanggal mana pun; seminggu Senin–Minggu ikut terpilih." : a ? "Pilih tanggal akhir." : "Klik tanggal mulai, lalu tanggal akhir."}</p>
              </>)}
              {mode === "month" && (<>
                <div className="ph"><button type="button" aria-label="Tahun sebelumnya" disabled={year <= 2024} onClick={() => setYear(year - 1)}>«</button><b>{year}</b><button type="button" aria-label="Tahun berikutnya" disabled={year >= +T.slice(0, 4)} onClick={() => setYear(year + 1)}>»</button></div>
                <div className="mg">{BLN.map((b, i) => { const m = `${year}-${String(i + 1).padStart(2, "0")}`; return <button type="button" key={m} disabled={m > T.slice(0, 7)} className={m === curMonth ? "on" : ""} onClick={() => pick("month:" + m)}>{b}</button>; })}</div>
              </>)}
              {mode === "year" && (
                <div className="mg">{years.map((y) => <button type="button" key={y} className={String(y) === curYear ? "on" : ""} onClick={() => pick("year:" + y)}>{y}</button>)}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
