/* Placeholder abu-abu saat halaman dashboard dimuat (dengan kerangka sidebar supaya tidak berkedip) */
export default function Loading() {
  return <div className="app skel-app" aria-busy="true" aria-label="Memuat">
    <aside className="side skel-side">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="sk sk-nav" />)}</aside>
    <div className="main"><main className="wrap dv skel">
      <div className="sk sk-title" />
      <div className="sk sk-bar" />
      <div className="sk sk-verdict" />
      <div className="sk-row">{[0, 1, 2, 3].map((i) => <div key={i} className="sk sk-card" />)}</div>
      <div className="sk sk-chart" />
      <div className="sk sk-table" />
    </main></div>
  </div>;
}
