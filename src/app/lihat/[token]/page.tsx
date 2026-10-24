import type { Metadata } from "next";
import DashboardView from "@/components/DashboardView";
import { clientsFor } from "@/lib/data";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/* Dashboard klien tanpa login (hanya lihat), lewat link rahasia */
export default async function Lihat({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const link = /^[a-f0-9]{40}$/.test(token) ? (await q<{ client_id: string }>("select client_id from share_links where token = ? and aktif = 1", [token]))[0] : undefined;
  if (!link) return <main className="auth"><div className="auth-card"><h1>Ruria Pantau</h1><p className="muted">Link ini tidak berlaku atau sudah dinonaktifkan. Minta link baru ke tim Ruria.</p></div></main>;
  const clients = await clientsFor([link.client_id]);
  return <DashboardView sp={{ ...sp, c: link.client_id }} profile={null} clients={clients} base={`/lihat/${token}`} share />;
}
