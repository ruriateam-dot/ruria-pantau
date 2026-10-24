"use client";
import { useState } from "react";
import Link from "next/link";
import { runImport } from "@/components/AutoImport";
import { autoMark } from "./actions";

export default function ImporPage() {
  const [state, setState] = useState<{ status: "run" | "ok" | "err"; msg: string } | null>(null);
  const start = async () => {
    try {
      const r = await runImport((m) => setState({ status: "run", msg: m }));
      if (r.ok) await autoMark();
      setState({ status: r.ok ? "ok" : "err", msg: r.ok ? "Selesai. Semua data arsip sudah masuk." : r.msg });
    } catch { setState({ status: "err", msg: "Koneksi terputus. Klik Impor lagi; data yang sudah masuk tidak akan dobel." }); }
  };
  return (
    <main className="wrap dv">
      <p><Link href="/dashboard">← Kembali ke dashboard</Link></p>
      <h1>Impor data arsip</h1>
      <p className="muted">Memasukkan arsip yang sudah diolah: penjualan harian, iklan, sesi live, dan penjualan per produk. Biasanya berjalan otomatis saat admin membuka dashboard; pakai halaman ini kalau ingin mengulang. Aman dijalankan ulang: data yang sama diganti, bukan dobel.</p>
      <div><button type="button" disabled={state?.status === "run"} onClick={start}>{state?.status === "run" ? "Mengimpor…" : "Impor sekarang"}</button></div>
      {state && <div className={"autoimp " + state.status} role="status">{state.status === "run" && <span className="spin" aria-hidden="true" />}{state.msg}</div>}
    </main>
  );
}
