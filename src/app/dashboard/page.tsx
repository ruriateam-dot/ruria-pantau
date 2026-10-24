import DashboardView from "@/components/DashboardView";
import { clientsFor } from "@/lib/data";
import { requireUser, allowedClients } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const profile = await requireUser();
  const clients = await clientsFor(await allowedClients(profile));
  return <DashboardView sp={sp} profile={profile} clients={clients} base="/dashboard" />;
}
