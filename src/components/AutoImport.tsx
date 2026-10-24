"use client";
import { useEffect, useState } from "react";
import { autoImport } from "@/app/dashboard/impor/actions";

export default function AutoImport() {
  const [state, setState] = useState<{ status: string; msg: string } | null>(null);
  useEffect(() => {
    let alive = true;
    setState({ status: "run", msg: "" });
    autoImport().then((r) => alive && setState(r)).catch(() => alive && setState({ status: "err", msg: "Pembaruan data otomatis gagal. Coba muat ulang halaman, atau pakai menu Impor data." }));
    return () => { alive = false; };
  }, []);
  if (!state || state.status === "skip") return null;
  return (
    <div className={"autoimp " + state.status} role="status">
      {state.status === "run" ? <><span className="spin" aria-hidden="true" /> Memeriksa dan memasukkan data terbaru…</> : state.msg}
      {state.status === "ok" && <button type="button" onClick={() => location.reload()}>Muat ulang</button>}
    </div>
  );
}
