import Empty from "@/components/Empty";
import { q } from "@/lib/db";
import { todayWIB, addDays, type Range } from "@/lib/period";
import type { Store } from "@/lib/data";

const rp = (n: number) => { const a = Math.abs(n), s = n < 0 ? "−" : ""; return a >= 1e9 ? `${s}Rp${(a / 1e9).toFixed(2).replace(".", ",")} M` : a >= 1e6 ? `${s}Rp${(a / 1e6).toFixed(1).replace(".", ",")} jt` : `${s}Rp${Math.round(a / 1e3).toLocaleString("id")} rb`; };
const nf = (n: number) => Math.round(n).toLocaleString("id");
const pc = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1).replace(".", ",")}%` : "–");
const ST: [string, string, string][] = [["selesai", "Selesai", "#2e9e5b"], ["diterima", "Diterima, masa retur", "#7cc49a"], ["proses", "Diproses / dikirim", "#6b5bd6"], ["retur", "Retur / refund", "#e0a344"], ["batal", "Batal", "#c2412d"]];
const grp = (s: string) => (s === "dikirim" || s === "perlu_kirim" || s === "belum_bayar" || s === "lainnya" ? "proses" : s);
const FEES: [string, string][] = [["refund", "Pengembalian dana"], ["voucher", "Voucher & cashback penjual"], ["admin", "Biaya administrasi / komisi platform"], ["proses", "Biaya proses & pembayaran"], ["layanan", "Biaya layanan program (Promo XTRA+, Gratis Ongkir XTRA, Live)"], ["ongkir", "Ongkir (selisih)"], ["ams", "Komisi affiliate"], ["pajak", "Pajak"], ["lain", "Lainnya"]];
const EN: [RegExp, string][] = [[/need to change delivery address/i, "Perlu mengubah alamat pengiriman"], [/change (of )?mind|no longer need|don'?t want/i, "Tidak perlu lagi"], [/modify existing order|change.*order/i, "Ubah Pesanan yang Ada"], [/unpaid|payment.*(timeout|overdue)|failed to pay/i, "Pesanan belum dibayar"], [/delivery failed|failed delivery/i, "Pengiriman paket gagal"], [/found (a )?cheaper|better price/i, "Menemukan harga lebih murah"], [/^others?$/i, "Lainnya"], [/out of stock/i, "Stok habis"], [/late payment|paid late/i, "Pesanan dibatalkan karena pembeli terlambat membayar"]];
const reason = (a: string) => { const r = a.replace(/^Dibatalkan (oleh|secara)[^.]*\.\s*Alasan:\s*/i, "").replace(/^Alasan:\s*/i, "").trim() || "Tanpa alasan"; const m = EN.find(([re]) => re.test(r)); return m ? m[1] : r; };

type O = { store_id: string; order_id: string; status: string; alasan: string | null; retur: string | null; gmv: number; metode: string | null; batas_kirim: string | null };
type F = { store_id: string; order_id: string; subtotal: number; dana: number } & Record<string, number | string>;

export default async function StatusView({ R, stores, share, staff }: { R: Range; stores: Store[]; share: boolean; staff: boolean }) {
  const ids = stores.filter((s) => s.platform !== "CPAS").map((s) => s.id);
  if (!ids.length) return <div className="card"><p className="muted">Belum ada toko.</p></div>;
  const O = await q<O>("select store_id, order_id, status, alasan, retur, gmv, metode, date_format(batas_kirim, '%Y-%m-%d') batas_kirim from orders where store_id in (?) and tanggal between ? and ?", [ids, R.from, R.to]);
  if (!O.length) return <div className="card"><h2>Status pesanan</h2><Empty title="Belum ada data status pesanan untuk periode ini." up={staff && !share} file={<>file pesanan (Shopee: Pesanan Saya → Ekspor; TikTok: Pesanan → Semua pesanan → Ekspor).</>} /></div>;
  const FE = await q<F>("select f.* from order_fees f join orders o on o.store_id = f.store_id and o.order_id = f.order_id where o.store_id in (?) and o.tanggal between ? and ?", [ids, R.from, R.to]);
  const fee = new Map(FE.map((f) => [f.store_id + "|" + f.order_id, f]));
  // rasio dana cair ÷ GMV pesanan dari pesanan yang sudah cair (per toko, 120 hari terakhir), dipakai untuk memperkirakan pesanan yang belum cair
  const RA = await q<{ store_id: string; d: number; g: number }>("select f.store_id, sum(f.dana) d, sum(o.gmv) g from order_fees f join orders o on o.store_id = f.store_id and o.order_id = f.order_id where f.store_id in (?) and o.tanggal >= ? and o.status <> 'batal' group by f.store_id", [ids, addDays(R.to, -120)]);
  const ratio = new Map(RA.filter((x) => +x.g > 0).map((x) => [x.store_id, +x.d / +x.g]));
  const all = RA.reduce((a, x) => a + +x.d, 0) / (RA.reduce((a, x) => a + +x.g, 0) || 1);
  const nm = new Map(stores.map((s) => [s.id, `${s.platform} · ${s.brand}`]));

  const by = new Map<string, { n: number; g: number }>(); ST.forEach(([k]) => by.set(k, { n: 0, g: 0 }));
  const T = new Map<string, { kotor: number; batal: number; retur: number; dana: number; est: boolean; n: number }>();
  let kotor = 0, dana = 0, danaEst = false, nCair = 0;
  for (const o of O) {
    const g = +o.gmv, k = grp(o.status); const b = by.get(k)!; b.n++; b.g += g; kotor += g;
    const t = T.get(o.store_id) ?? { kotor: 0, batal: 0, retur: 0, dana: 0, est: false, n: 0 }; t.kotor += g; t.n++;
    if (o.status === "batal") t.batal += g; else if (o.status === "retur") t.retur += g;
    if (o.status !== "batal") {
      const f = fee.get(o.store_id + "|" + o.order_id);
      if (f) { t.dana += +f.dana; dana += +f.dana; nCair++; }
      else if (o.status !== "retur") { const r = ratio.get(o.store_id) ?? (RA.length ? all : 0); if (r) { t.dana += g * r; dana += g * r; t.est = true; danaEst = true; } }
    }
    T.set(o.store_id, t);
  }
  const batal = by.get("batal")!, retur = by.get("retur")!, bersih = kotor - batal.g - retur.g;
  const hasFee = RA.length > 0;

  // potongan dari pesanan yang sudah cair di periode ini
  const FS: Record<string, number> = { subtotal: 0, dana: 0 }; FEES.forEach(([k]) => (FS[k] = 0));
  for (const f of FE) { FS.subtotal += +f.subtotal; FS.dana += +f.dana; for (const [k] of FEES) FS[k] += +f[k]; }
  const pot = FS.subtotal - FS.dana;

  // pesanan bermasalah
  const today = todayWIB();
  const unpaid = O.filter((o) => o.status === "batal" && /belum.*bayar|unpaid|pembayaran|payment/i.test(o.alasan ?? ""));
  const late = O.filter((o) => o.status === "perlu_kirim" && o.batas_kirim && o.batas_kirim < today);
  const returProses = O.filter((o) => o.status === "retur" && /proses|validasi|sedang|menunggu|pending/i.test(o.retur ?? ""));
  const cod = O.filter((o) => /cod|bayar di tempat/i.test(o.metode ?? "")), non = O.filter((o) => !/cod|bayar di tempat/i.test(o.metode ?? ""));
  const cr = (L: O[]) => (L.length ? L.filter((o) => o.status === "batal").length / L.length : 0);
  const codG = cod.reduce((a, o) => a + +o.gmv, 0);

  // alasan batal
  const AL = new Map<string, number>(); for (const o of O) if (o.status === "batal") { const r = reason(o.alasan ?? "").slice(0, 70); AL.set(r, (AL.get(r) ?? 0) + 1); }
  const alasan = [...AL].sort((a, b) => b[1] - a[1]).slice(0, 8);

  // produk batal / retur
  const PI = await q<{ produk: string; status: string; g: number; n: number }>(
    "select i.produk, o.status, sum(i.gmv) g, count(distinct i.order_id) n from order_items i join orders o on o.store_id = i.store_id and o.order_id = i.order_id where o.store_id in (?) and o.tanggal between ? and ? and o.status in ('batal','retur') group by i.produk, o.status", [ids, R.from, R.to]);
  const PS = await q<{ produk: string; g: number }>("select produk, sum(gmv) g from product_sales where store_id in (?) and tanggal between ? and ? group by produk", [ids, R.from, R.to]);
  const sold = new Map(PS.map((x) => [x.produk, +x.g]));
  const PM = new Map<string, { b: number; r: number; nb: number; nr: number }>();
  for (const x of PI) { const m = PM.get(x.produk) ?? { b: 0, r: 0, nb: 0, nr: 0 }; if (x.status === "batal") { m.b += +x.g; m.nb += +x.n; } else { m.r += +x.g; m.nr += +x.n; } PM.set(x.produk, m); }
  const prod = [...PM].sort((a, b) => b[1].b + b[1].r - (a[1].b + a[1].r)).slice(0, 10);

  const tot = ST.reduce((a, [k]) => a + by.get(k)!.g, 0) || 1;
  return <>
    <div className="kpis fck">
      <div className="kpi"><div className="kl">GMV kotor</div><div className="kv">{rp(kotor)}</div><div className="kd muted">{nf(O.length)} pesanan dibuat</div></div>
      <div className="kpi"><div className="kl">GMV bersih</div><div className="kv">{rp(bersih)}</div><div className="kd muted">tanpa batal &amp; retur · {pc(bersih, kotor)} dari kotor</div></div>
      <div className="kpi"><div className="kl">Dana cair (setelah potongan)</div><div className="kv up">{hasFee ? rp(dana) + (danaEst ? "*" : "") : "–"}</div><div className="kd muted">{hasFee ? `${pc(dana, bersih)} dari GMV bersih${danaEst ? ` · *${nf(O.length - batal.n - nCair)} pesanan belum cair, diperkirakan` : ""}` : "upload Laporan Penghasilan untuk menghitung"}</div></div>
      <div className="kpi"><div className="kl">Batal + retur</div><div className="kv dn">{rp(batal.g + retur.g)}</div><div className="kd muted">{nf(batal.n + retur.n)} pesanan · {pc(batal.g + retur.g, kotor)} dari GMV kotor</div></div>
    </div>
    <div className="card"><h3>GMV per status · {R.label}</h3>
      <div className="sflow">{ST.map(([k, , c]) => { const g = by.get(k)!.g; return g ? <i key={k} style={{ width: `${(g / tot) * 100}%`, background: c }}>{g / tot > 0.06 ? `${Math.round((g / tot) * 100)}%` : ""}</i> : null; })}</div>
      <div className="sleg">{ST.map(([k, l, c]) => { const b = by.get(k)!; return <div key={k}><span><i style={{ background: c }} />{l}</span><b>{rp(b.g)}</b><span className="muted small">{nf(b.n)} pesanan</span></div>; })}</div>
      <p className="muted small">Status mengikuti file pesanan terakhir yang diupload. Pesanan yang masih diproses, dikirim, atau dalam masa retur akan berubah saat file pesanan diupload ulang.</p>
    </div>
    <div className="grid2c">
      <div className="card"><h3>GMV kotor vs bersih per toko</h3><div className="tbl"><table><thead><tr><th>Toko</th><th className="n">GMV kotor</th><th className="n">GMV bersih</th><th className="n">Batal</th><th className="n">Retur</th>{hasFee && <th className="n">Dana cair</th>}</tr></thead>
        <tbody>{[...T].sort((a, b) => b[1].kotor - a[1].kotor).map(([id, t]) => <tr key={id}><td><b>{nm.get(id)}</b></td><td className="n">{rp(t.kotor)}</td><td className="n"><b>{rp(t.kotor - t.batal - t.retur)}</b></td><td className="n dn">{pc(t.batal, t.kotor)}</td><td className="n">{pc(t.retur, t.kotor)}</td>{hasFee && <td className="n">{t.dana ? rp(t.dana) + (t.est ? "*" : "") : "–"}</td>}</tr>)}</tbody></table></div></div>
      {!share && staff && <div className="card internal"><h3>Pesanan bermasalah</h3>
        {[
          unpaid.length > 0 && { lv: "bad", t: `${nf(unpaid.length)} pesanan batal karena belum dibayar (${pc(unpaid.length, batal.n || 1)} dari semua batal)`, d: `${rp(unpaid.reduce((a, o) => a + +o.gmv, 0))}. Langkah: kirim pengingat bayar lewat chat dalam 12 jam; pertimbangkan batasi COD di produk dengan batal tinggi.` },
          late.length > 0 && { lv: "warn", t: `${nf(late.length)} pesanan lewat batas kirim`, d: "Status masih perlu dikirim di file terakhir. Cek ke gudang hari ini; keterlambatan menurunkan performa toko." },
          returProses.length > 0 && { lv: "warn", t: `${nf(returProses.length)} retur masih diproses`, d: `${rp(returProses.reduce((a, o) => a + +o.gmv, 0))}. Tanggapi di Seller Centre sebelum batas waktu supaya tidak otomatis disetujui.` },
          cod.length > 0 && { lv: cr(cod) > cr(non) * 1.5 ? "warn" : "good", t: `COD ${pc(codG, kotor)} dari GMV · batal COD ${pc(cr(cod), 1)} vs non-COD ${pc(cr(non), 1)}`, d: cr(cod) > cr(non) * 1.5 ? "Batal COD jauh lebih tinggi. Pertimbangkan batasi COD di produk yang sering batal." : "Tingkat batal COD masih wajar." },
        ].filter(Boolean).map((x, i) => { const y = x as { lv: string; t: string; d: string }; return <div key={i} className={"ppi " + y.lv}><span className="ppic">{y.lv === "bad" ? "!" : y.lv === "warn" ? "↓" : "✓"}</span><div><b>{y.t}</b><div className="muted small">{y.d}</div></div></div>; })}
        {!unpaid.length && !late.length && !returProses.length && !cod.length && <p className="muted">Tidak ada pesanan bermasalah di periode ini.</p>}
      </div>}
    </div>
    <div className="card"><h3>Potongan platform · pesanan periode ini yang dananya sudah cair</h3>
      {!FE.length ? <p className="muted">Belum ada rincian potongan untuk pesanan periode ini. Upload Laporan Penghasilan Shopee (Keuangan → Penghasilan Saya) dan penghasilan TikTok (Keuangan → Transaksi) setiap 5 hari.</p> : <>
        <p>Total potongan <b>{rp(pot)}</b> ({pc(pot, FS.subtotal)} dari harga produk) · dana cair <b>{rp(FS.dana)}</b> dari {nf(FE.length)} pesanan.</p>
        {!share && <div className="wf">
          <div className="wr"><span>Harga produk</span><div><i style={{ left: 0, width: "100%", background: "var(--accent)" }} /></div><b>{rp(FS.subtotal)}</b><span className="muted">100%</span></div>
          {(() => { let run = FS.subtotal; return FEES.filter(([k]) => Math.round(FS[k]) !== 0).map(([k, l]) => { const v = FS[k], a = v < 0 ? run + v : run; run += v; return <div key={k} className="wr"><span>{l}</span><div><i style={{ left: `${(Math.max(0, a) / FS.subtotal) * 100}%`, width: `${(Math.abs(v) / FS.subtotal) * 100}%`, background: v < 0 ? "var(--bad)" : "var(--good)" }} /></div><b>{rp(v)}</b><span className="muted">{pc(Math.abs(v), FS.subtotal)}</span></div>; }); })()}
          <div className="wr"><span><b>Dana cair</b></span><div><i style={{ left: 0, width: `${(FS.dana / FS.subtotal) * 100}%`, background: "var(--good)" }} /></div><b>{rp(FS.dana)}</b><span className="muted">{pc(FS.dana, FS.subtotal)}</span></div>
        </div>}
        <p className="muted small">{share ? "Rincian potongan per jenis biaya tersedia di tim Ruria." : "Rincian per jenis biaya hanya tampil untuk tim; klien melihat total potongan dan dana cair."} Pesanan yang belum cair memakai persentase dana cair pesanan yang sudah cair di toko yang sama (tanda *).</p>
      </>}
    </div>
    {!share && staff && FE.length > 0 && <div className="card internal"><h3>Biaya program & komisi dibanding GMV</h3>
      <div className="tbl"><table><thead><tr><th>Jenis biaya</th><th className="n">Biaya</th><th className="n">% harga produk</th><th>Catatan</th></tr></thead><tbody>
        {[["layanan", "Program berbayar (Promo XTRA+, Gratis Ongkir XTRA, Live)", "Bandingkan GMV hari program aktif vs tidak sebelum memperpanjang"], ["ams", "Komisi affiliate", "Bandingkan dengan GMV affiliate di tab Affiliate"], ["admin", "Biaya administrasi / komisi platform", "Tetap, tidak bisa dikurangi"], ["voucher", "Voucher & cashback penjual", "Cek voucher dengan pemakaian tinggi tapi pesanan kecil"]].map(([k, l, c]) => <tr key={k}><td><b>{l}</b></td><td className="n">{rp(Math.abs(FS[k]))}</td><td className="n">{pc(Math.abs(FS[k]), FS.subtotal)}</td><td className="small muted">{c}</td></tr>)}
      </tbody></table></div></div>}
    <div className="grid2c">
      <div className="card"><h3>Alasan pembatalan</h3>{alasan.length ? <div className="tbl"><table><thead><tr><th>Alasan</th><th className="n">Pesanan</th><th className="n">Porsi</th></tr></thead><tbody>{alasan.map(([a, n]) => <tr key={a}><td>{a}</td><td className="n">{nf(n)}</td><td className="n">{pc(n, batal.n)}</td></tr>)}</tbody></table></div> : <p className="muted">Tidak ada pembatalan.</p>}</div>
      <div className="card"><h3>Produk paling sering batal / retur</h3>{prod.length ? <div className="tbl"><table><thead><tr><th>Produk</th><th className="n">GMV batal</th><th className="n">% batal</th><th className="n">Retur</th></tr></thead><tbody>{prod.map(([p, m]) => <tr key={p}><td>{p.slice(0, 60)}</td><td className="n dn">{rp(m.b)}</td><td className="n">{pc(m.b, m.b + (sold.get(p) ?? 0))}</td><td className="n">{m.nr}</td></tr>)}</tbody></table></div> : <p className="muted">Belum ada data produk batal & retur.</p>}</div>
    </div>
  </>;
}
