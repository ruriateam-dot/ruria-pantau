/* Keadaan kosong: sebut file apa yang perlu diupload, plus tautan ke Upload untuk tim Ruria. */
export default function Empty({ title, file, up }: { title: string; file: React.ReactNode; up: boolean }) {
  return <div className="empty"><b>{title}</b><p className="muted small">{up ? <>File yang dibutuhkan: {file}</> : "Tim Ruria sedang melengkapi data ini."}</p>
    {up && <a className="btn" href="/dashboard/upload">Buka Upload data</a>}</div>;
}
