/* Placeholder abu-abu saat halaman dashboard dimuat */
export default function Loading() {
  return <main className="wrap dv skel" aria-busy="true" aria-label="Memuat">
    <div className="sk sk-title" />
    <div className="sk sk-bar" />
    <div className="sk sk-verdict" />
    <div className="sk-row">{[0, 1, 2, 3].map((i) => <div key={i} className="sk sk-card" />)}</div>
    <div className="sk sk-chart" />
    <div className="sk sk-table" />
  </main>;
}
