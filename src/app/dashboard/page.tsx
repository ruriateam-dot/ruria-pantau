import DashboardView from "@/components/DashboardView";
import { clientsFor } from "@/lib/data";
import { requireUser, allowedClients } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const profile = await requireUser();
  try {
    const clients = await clientsFor(await allowedClients(profile));
    // Dijalankan langsung supaya error di server bisa ditampilkan dengan jelas
    return await DashboardView({ sp, profile, clients, base: "/dashboard" });
  } catch (e) {
    const x = e as { digest?: string; message?: string; code?: string; sqlMessage?: string };
    if (x.digest?.startsWith("NEXT_")) throw e;
    console.error("Dashboard error", e);
    return <main className="auth"><div className="auth-card"><h1>Ruria Report</h1>
      <p className="err">Dashboard gagal dimuat.</p>
      <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{[x.code, x.sqlMessage ?? x.message].filter(Boolean).join(": ")}</pre>
      <p className="muted small">Kirim tangkapan layar pesan ini ke Claude.</p></div></main>;
  }
}
