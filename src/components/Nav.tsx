"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/* Satu tanda "sedang memuat" untuk semua perpindahan di dashboard */
export function useNav() {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => { window.dispatchEvent(new CustomEvent("nav-pending", { detail: pending })); }, [pending]);
  return { pending, go: (url: string) => start(() => router.push(url, { scroll: false })) };
}

export function LoadingBar() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const h = (e: Event) => setOn((e as CustomEvent<boolean>).detail);
    window.addEventListener("nav-pending", h);
    return () => window.removeEventListener("nav-pending", h);
  }, []);
  useEffect(() => { document.body.classList.toggle("is-loading", on); }, [on]);
  return on ? (
    <>
      <div className="topbar" aria-hidden="true" />
      <div className="loadpill" role="status"><span className="spin" aria-hidden="true" />Memuat data…</div>
    </>
  ) : null;
}

export function Tabs({ items, active }: { items: { k: string; l: string; href: string }[]; active: string }) {
  const { go } = useNav();
  const [clicked, setClicked] = useState<string | null>(null);
  return (
    <nav className="wrap tabs">
      {items.map((t) => (
        <a key={t.k} href={t.href} className={"tab" + ((clicked ?? active) === t.k ? " on" : "")}
          onClick={(e) => { e.preventDefault(); setClicked(t.k); go(t.href); }}>{t.l}</a>
      ))}
    </nav>
  );
}
