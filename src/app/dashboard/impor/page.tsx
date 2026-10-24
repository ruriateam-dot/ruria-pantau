"use client";
import { useActionState } from "react";
import Link from "next/link";
import { importSeed } from "./actions";

export default function ImporPage() {
  const [msg, action, pending] = useActionState(async () => importSeed(), null as string | null);
  return (
    <main className="wrap">
      <p><Link href="/dashboard">← Kembali ke dashboard</Link></p>
      <h1>Impor data awal 2026</h1>
      <p className="muted">Memasukkan arsip yang sudah diolah: penjualan harian, iklan, dan sesi live untuk Cahaya, PMG, Just Fluff, Organic Treasure, dan VOIE. Aman dijalankan ulang: data yang sama akan diganti, bukan dobel.</p>
      <form action={action}>
        <button type="submit" disabled={pending}>{pending ? "Mengimpor… (bisa 1–2 menit)" : "Impor sekarang"}</button>
      </form>
      {msg && <p role="status" className={msg.startsWith("Selesai") ? "ok" : "err"}>{msg}</p>}
    </main>
  );
}
