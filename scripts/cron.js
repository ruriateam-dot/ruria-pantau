// Dijalankan Cron Job Hostinger setiap pagi: memicu email pengingat jadwal upload.
// REMINDER_KEY dibaca dari Variabel environment (lewat --env-file), tidak ditulis di sini.
const url = (process.env.APP_URL || "https://report.ruria.id").replace(/\/$/, "") + "/api/pengingat";
fetch(url, { method: "POST", headers: { "x-reminder-key": process.env.REMINDER_KEY || "" } })
  .then(async (r) => { console.log(new Date().toISOString(), r.status, await r.text()); if (!r.ok) process.exitCode = 1; })
  .catch((e) => { console.error(new Date().toISOString(), "gagal", e.message); process.exitCode = 1; });
