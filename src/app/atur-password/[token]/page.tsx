import type { Metadata } from "next";
import { q } from "@/lib/db";
import Form from "./Form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AturPassword({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = /^[a-f0-9]{64}$/.test(token)
    ? await q<{ nama: string; email: string }>("select u.nama, u.email from password_tokens t join users u on u.id = t.user_id where t.token = ? and t.kadaluarsa > now()", [token]) : [];
  return <main className="auth">
    {r[0] ? <Form token={token} nama={r[0].nama} email={r[0].email} />
      : <div className="auth-card"><h1>Ruria Pantau</h1><p className="muted">Link ini sudah tidak berlaku (lewat 3 hari atau sudah dipakai). Minta link baru ke admin.</p><a href="/login">Ke halaman masuk</a></div>}
  </main>;
}
