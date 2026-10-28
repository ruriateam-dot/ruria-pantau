/* Arsip status pesanan (gzip + base64), dimuat per bagian saat impor */
export const PARTS: (() => Promise<{ b64: string }>)[] = [
  () => import("./p0"),
  () => import("./p1"),
  () => import("./p2"),
  () => import("./p3"),
  () => import("./p4"),
  () => import("./p5"),
  () => import("./p6"),
  () => import("./p7"),
  () => import("./p8"),
  () => import("./p9"),
  () => import("./p10"),
  () => import("./p11"),
  () => import("./p12"),
  () => import("./p13"),
  () => import("./p14"),
  () => import("./p15"),
];
/* jumlah pesanan per bagian (-1 = potongan/penghasilan) */
export const COUNTS = [87308, 56145, 39845, 4077, 11236, 10981, 5310, 4101, 6196, 8011, 73534, 64493, 89752, 150, 107, -1];
