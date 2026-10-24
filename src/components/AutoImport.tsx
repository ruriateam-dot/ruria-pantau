"use client";
import { useEffect, useState } from "react";
import { autoStatus, autoMark, importSeed, importProdukPart } from "@/app/dashboard/impor/actions";

export async function runImport(onStep: (msg: string) => void): Promise<{ ok: boolean; msg: string }> {
  onStep("Memasukkan data toko, iklan, dan live…");
  const a = await importSeed();
  if (!a.startsWith("Selesai")) return { ok: false, msg: a };
  let parts = 1;
  for (let i = 0; i < parts; i++) {
    onStep(`Memasukkan data produk… bagian ${i + 1}${parts > 1 ? ` dari ${parts}` : ""}`);
    const r = await importProdukPart(i);
    parts = r.parts;
    if (!r.ok) return { ok: false, msg: r.msg };
  }
  return { ok: true, msg: "Data terbaru sudah masuk. Muat ulang halaman untuk melihatnya." };
}

export default function AutoImport() {
  const [state, setState] = useState<{ status: "run" | "ok" | "err"; msg: string } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await autoStatus();
        if (!s.need || !alive) return;
        setState({ status: "run", msg: "Memeriksa data terbaru…" });
        const r = await runImport((m) => alive && setState({ status: "run", msg: m }));
        if (r.ok) await autoMark();
        if (alive) setState({ status: r.ok ? "ok" : "err", msg: r.msg });
      } catch {
        if (alive) setState({ status: "err", msg: "Pembaruan data otomatis terputus. Muat ulang halaman untuk melanjutkan." });
      }
    })();
    return () => { alive = false; };
  }, []);
  if (!state) return null;
  return (
    <div className={"autoimp " + state.status} role="status">
      {state.status === "run" && <span className="spin" aria-hidden="true" />}
      {state.msg}{state.status === "run" && " Jangan tutup halaman ini."}
      {state.status === "ok" && <button type="button" onClick={() => location.reload()}>Muat ulang</button>}
    </div>
  );
}
