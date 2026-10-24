"use client";
import { useActionState } from "react";
import Link from "next/link";
import { importSeed, importProduk } from "./actions";

export default function ImporPage() {
  const [msg, action, pending] = useActionState(async () => importSeed(), null as string | null);
  const [msg2, action2, pending2] = useActionState(async () => importProduk(), null as string | null);
  return (
    <main className="wrap">
      <p><Link href="/dashboard">← Kembali ke dashboard</Link></p>
      <h1>Impor data awal 2026</h1>
      <p className="muted">Memasukkan arsip yang sudah diolah: penjualan harian, iklan, dan sesi live untuk Cahaya, PMG, Just Fluff, Organic Treasure, dan VOIE. Aman dijalankan ulang: data yang sama akan diganti, bukan dobel.</p>
      <form action={action}>
        <button type="submit" disabled={pending}>{pending ? "Mengimpor… (bisa 1–2 menit)" : "Impor sekarang"}</button>
      </form>
      {msg && <p role="status" className={msg.startsWith("Selesai") ? "ok" : "err"}>{msg}</p>}
      <h2 style={{ marginTop: 32 }}>Data produk (CV Cahaya)</h2>
      <p className="muted">Penjualan per produk dan varian per hari, Jan–Sep 2026, untuk bagian Analisa Produk. Jalankan file <code>0003_produk.sql</code> di SQL Editor Supabase sebelum menekan tombol ini.</p>
      <form action={action2}>
        <button type="submit" disabled={pending2}>{pending2 ? "Mengimpor produk… (bisa 2–3 menit)" : "Impor data produk"}</button>
      </form>
      {msg2 && <p role="status" className={msg2.startsWith("Selesai") ? "ok" : "err"}>{msg2}</p>}
    </main>
  );
}
