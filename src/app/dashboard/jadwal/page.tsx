import { clientsFor } from "@/lib/data";
import AppShell from "@/components/AppShell";
import { requireUser, allowedClients, canWork } from "@/lib/auth";
import { q } from "@/lib/db";
import { logAct } from "@/lib/log";
import { todayWIB, addDays } from "@/lib/period";
import Jadwal from "./Jadwal";

export const dynamic = "force-dynamic";

const monday = (d: string) => { const w = new Date(d + "T00:00:00Z").getUTCDay(); return addDays(d, w === 0 ? -6 : 1 - w); };

export default async function JadwalPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const staff = canWork(me);
  const ok = await allowedClients(me);
  const clients = (await clientsFor(ok)).filter((c) => c.modul.includes("live")).map((c) => ({ id: c.id, nama: c.brand ?? c.nama }));
  // Periode: minggu (default), bulan, atau rentang pilihan sendiri
  const D = /^\d{4}-\d{2}-\d{2}$/, t0 = todayWIB();
  const mode = sp.v === "bulan" || sp.v === "kustom" ? sp.v : "minggu";
  const w = monday(sp.w && D.test(sp.w) ? sp.w : t0);
  const bln = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : t0.slice(0, 7);
  const endM = (m: string) => { const x = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)); return x.toISOString().slice(0, 10); };
  let from = w, to = addDays(w, 6), gFrom = from, gTo = to;
  if (mode === "bulan") { from = bln + "-01"; to = endM(bln); gFrom = monday(from); gTo = addDays(monday(to), 6); }
  if (mode === "kustom") { from = sp.dari && D.test(sp.dari) ? sp.dari : w; to = sp.sampai && D.test(sp.sampai) ? sp.sampai : addDays(from, 6); if (to < from) [from, to] = [to, from]; if (addDays(from, 92) < to) to = addDays(from, 92); gFrom = monday(from); gTo = addDays(monday(to), 6); }
  const ids = clients.map((c) => c.id);
  const shifts = ids.length ? await q<{ id: number; client_id: string; tanggal: string; mulai: string; selesai: string; host_id: number; host: string; platform: string; catatan: string | null }>(
    "select l.id, l.client_id, date_format(l.tanggal, '%Y-%m-%d') tanggal, l.mulai, l.selesai, l.host_id, h.nama host, l.platform, l.catatan from live_schedule l join hosts h on h.id = l.host_id where l.client_id in (?) and l.tanggal between ? and ? order by l.tanggal, l.mulai",
    [ids, from, to]) : [];
  const hosts = await q<{ id: number; nama: string; aktif: number }>("select id, nama, aktif from hosts order by aktif desc, nama");
  await logAct(me, "lihat", null, `Jadwal live · ${mode} ${from}–${to}`);
  return <AppShell user={me} keep={{}}>
    <header className="dh"><div className="wrap top ctitle"><h1>Jadwal live</h1><span className="muted small">{staff ? "Atur jadwal host per brand" : "Hanya lihat"}</span></div></header>
    <main className="wrap dv">
      {clients.length ? <Jadwal mode={mode} week={w} bulan={bln} from={from} to={to} gFrom={gFrom} gTo={gTo} today={t0} shifts={shifts} hosts={hosts} clients={clients} canEdit={staff} />
        : <p className="muted">Belum ada brand livestream yang bisa diakses akun ini.</p>}
    </main>
  </AppShell>;
}
