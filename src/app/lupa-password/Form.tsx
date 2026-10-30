"use client";
import { useActionState } from "react";
import { RuriaWord } from "@/components/Logo";
import { lupaPassword } from "../login/actions";

export default function Form() {
  const [res, action, pending] = useActionState(lupaPassword, null);
  return <main className="auth">
    <form action={action} className="auth-card">
      <h1 className="authlogo"><RuriaWord height={30} /><span>Report</span></h1>
      {res === "OK" ? <>
        <p>Kalau email itu terdaftar, link untuk mengatur ulang password sudah dikirim. Cek kotak masuk (dan folder spam). Link berlaku 3 hari dan hanya bisa dipakai sekali.</p>
        <a href="/login">Kembali ke halaman masuk</a>
      </> : <>
        <p className="muted">Masukkan email akun Ruria Report. Kami kirimkan link untuk membuat password baru.</p>
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        {res && <p className="err" role="alert">{res}</p>}
        <button type="submit" disabled={pending}>{pending ? "Mengirim…" : "Kirim link"}</button>
        <p className="small" style={{ textAlign: "center", margin: "4px 0 0" }}><a href="/login">Kembali ke halaman masuk</a></p>
      </>}
    </form>
  </main>;
}
