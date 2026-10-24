"use client";
import { RuriaWord } from "@/components/Logo";
import { useActionState } from "react";
import { login, setupAdmin } from "./actions";

export default function LoginForm({ setup }: { setup: boolean }) {
  const [error, action, pending] = useActionState(setup ? setupAdmin : login, null);
  return (
    <main className="auth">
      <form action={action} className="auth-card">
        <h1 className="authlogo"><RuriaWord height={30} /><span>Report</span></h1>
        <p className="muted">{setup ? "Buat akun admin pertama. Halaman ini hanya muncul sekali." : "Masuk dengan akun Ruria Report."}</p>
        {setup && <label>Nama<input name="nama" required autoComplete="name" /></label>}
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete={setup ? "new-password" : "current-password"} minLength={setup ? 10 : undefined} required /></label>
        {setup && <p className="muted small">Minimal 10 karakter. Gunakan password yang tidak dipakai di tempat lain.</p>}
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit" disabled={pending}>{pending ? "Memproses…" : setup ? "Buat akun admin" : "Masuk"}</button>
      </form>
    </main>
  );
}
