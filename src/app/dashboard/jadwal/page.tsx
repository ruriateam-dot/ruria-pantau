import AppShell from "@/components/AppShell";
import { requireUser, allowedClients, isStaff } from "@/lib/auth";
import { q } from "@/lib/db";
import { logAct } from "@/lib/log";
import { todayWIB, addDays } from "@/lib/period";
import Jadwal from "./Jadwal";

export const dynamic = "force-dynamic";

const monday = (d: string) => { const w = new Date(d + "T00:00:00Z").getUTCDay(); return addDays(d, w === 0 ? -6 : 1 - w); };

export default async function JadwalPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const staff = isStaff(me);
  const ok = await allowedClients(me);
  const clients = ok.length ? await q<{ id: string; nama: string }>("select id, nama from clients where id in (?) and find_in_set('live', modul) order by nama", [ok]) : [];
  const w = monday(sp.w && /^\d{4}-\d{2}-\d{2}$/.test(sp.w) ? sp.w : todayWIB());
  const ids = clients.map((c) => c.id);
  const shifts = ids.length ? await q<{ id: number; client_id: string; tanggal: string; mulai: string; selesai: string; host_id: number; host: string; platform: string; catatan: string | null }>(
    "select l.id, l.client_id, date_format(l.tanggal, '%Y-%m-%d') tanggal, l.mulai, l.selesai, l.host_id, h.nama host, l.platform, l.catatan from live_schedule l join hosts h on h.id = l.host_id where l.client_id in (?) and l.tanggal between ? and ? order by l.tanggal, l.mulai",
    [ids, w, addDays(w, 6)]) : [];
  const hosts = await q<{ id: number; nama: string; aktif: number }>("select id, nama, aktif from hosts order by aktif desc, nama");
  await logAct(me, "lihat", null, `Jadwal live · minggu ${w}`);
  return <AppShell user={me} keep={{}}>
    <header className="dh"><div className="wrap top ctitle"><h1>Jadwal live</h1><span className="muted small">{staff ? "Atur jadwal host per brand" : "Hanya lihat"}</span></div></header>
    <main className="wrap dv">
      {clients.length ? <Jadwal week={w} today={todayWIB()} shifts={shifts} hosts={hosts} clients={clients} canEdit={staff} />
        : <p className="muted">Belum ada brand livestream yang bisa diakses akun ini.</p>}
    </main>
  </AppShell>;
}
