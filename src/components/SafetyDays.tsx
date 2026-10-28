"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSafety } from "@/app/dashboard/forecast/actions";

export default function SafetyDays({ clientId, value, canEdit }: { clientId: string; value: number; canEdit: boolean }) {
  const [v, setV] = useState(String(value));
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = (h: number) => start(async () => { setV(String(h)); const e = await setSafety(clientId, h); setErr(e); if (!e) router.refresh(); });
  if (!canEdit) return <span className="safety">Stok pengaman: <b>{value} hari</b></span>;
  return <span className="safety">
    Stok pengaman
    {[14, 21, 28, 42].map((h) => <button key={h} type="button" className={"ghost" + (+v === h ? " on" : "")} disabled={pending} onClick={() => save(h)}>{h}</button>)}
    <input type="number" min={0} max={180} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(+v); }} onBlur={() => { if (+v !== value) save(+v); }} aria-label="Stok pengaman (hari)" />
    hari{pending && " · menghitung ulang…"}{err && <span className="err"> {err}</span>}
  </span>;
}
