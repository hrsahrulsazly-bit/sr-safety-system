# Serah Terima Projek — SR Group Safety System

Dokumen ini untuk pasukan/rakan sekerja yang akan terus bangunkan sistem ini
menggunakan Claude Code (individu atau team seat). Baca sekali dengan
[`CLAUDE.md`](../CLAUDE.md) di root repo — `CLAUDE.md` itu rujukan teknikal
terperinci (seni bina, model data, konvensyen kod) dan **dibaca automatik**
oleh Claude Code setiap kali sesi baharu dibuka dalam folder projek ni.
Dokumen ini pula beri **konteks operasi & sejarah** yang CLAUDE.md tak
liputi (kredential, URL langsung, latar belakang keputusan).

## 1. Apa sistem ini
Sistem pengurusan keselamatan (HSE) dalaman untuk SR Group Safety Committee
— manhour, monthly report, site visit checklist (jana PDF), safety program,
safety reward (penilaian), attendance report (meeting/walkabout + ranking),
dan KPI dashboard. Pemilik projek: Sahrul Fauzi (sahrul.fauzi@swisresources.com).

**Prinsip asas (WAJIB dikekalkan)**: satu fail HTML tunggal
(`SR-Group-Safety-System.html`) — semua HTML/CSS/JS dalam satu fail, vanilla
JS sahaja, **tiada library/CDN luaran**. Ini termasuk perkara yang biasanya
guna library (parser/writer .xlsx, penjana PDF) — semuanya dibina native
guna API pelayar terbina-dalam (`DecompressionStream`, `CompressionStream`,
`DOMParser`). Jangan pecahkan fail ni kepada berbilang fail JS/CSS atau
tambah `<script src="...">` luaran melainkan diminta khusus.

## 2. Struktur repo
- **`SR-Group-Safety-System.html`** — fail utama, sumber kebenaran (source
  of truth). Setiap kali diubah, salin ke DUA lokasi di bawah supaya semua
  cara deployment guna versi sama:
  - `docs/vercel/index.html` (+ `docs/vercel/sw.js` — Service Worker, jarang
    berubah)
  - `docs/apps-script/Index.html`
- **`docs/apps-script/Code.gs`** — backend Google Apps Script (lihat
  seksyen 4). **Fail ini TIDAK auto-sync** — kemas kini manual dalam editor
  Apps Script bila `Code.gs` berubah.
- **`CLAUDE.md`** — rujukan teknikal utama, kemas kini setiap kali ciri
  besar/seni bina berubah.
- **`docs/vercel/SETUP-VERCEL.md`**, **`docs/apps-script/SETUP-PUSAT.md`**,
  **`docs/linux/SETUP-LINUX.md`** — panduan deploy tiga cara berlainan
  (lihat seksyen 3).

**PENTING — repo git sebenar cuma di GitHub, bukan di folder tempatan ni.**
Kerja sepanjang ni dibuat dengan edit fail terus (Read/Write/Edit tools)
dalam folder Windows tempatan, kemudian **upload/edit manual** ke GitHub
melalui web UI (bukan `git push` dari command line — folder ni bukan git
repo). Kalau pasukan baharu nak workflow git biasa (`git clone`/`commit`/
`push`), disyorkan **clone repo GitHub terus** ke folder kerja baharu:
```bash
git clone https://github.com/hrsahrulsazly-bit/sr-safety-system.git
```
dan pindah ke workflow git standard dari situ — lebih selamat & auto-track
sejarah berbanding cara salin-tampal manual yang digunakan sepanjang sesi
ni.

## 3. Deployment — 3 cara serentak (kongsi backend sama)
| Cara | URL/akses | Panduan | Auto-deploy? |
|---|---|---|---|
| Vercel (utama, disyorkan) | `https://safetycommittee.vercel.app` | `docs/vercel/SETUP-VERCEL.md` | Ya — auto-deploy bila commit ke GitHub (tapi **kena semak** tab Deployments → "Promote to Production" kalau tak auto-assign, especially lepas rollback) |
| Google Apps Script terus | URL Web App (`.../exec`) | `docs/apps-script/SETUP-PUSAT.md` | Tidak — paste manual `Index.html` bila berubah. **Nota**: kaedah ni pernah ada isu "wrapper" HtmlService bercanggah dengan extension browser — Vercel lebih stabil |
| Server Linux sendiri (nginx) | `http://IP-SERVER` (tiada domain/HTTPS lagi) | `docs/linux/SETUP-LINUX.md` | Tidak — `git pull` manual di server |

**Repo GitHub**: `https://github.com/hrsahrulsazly-bit/sr-safety-system`
(Public). Vercel project disambung ke repo ni (`sahrul-hr` akaun Vercel).

**Cara kemas kini (semua 3 kaedah)**: edit `SR-Group-Safety-System.html` →
salin ke `docs/vercel/index.html` + `docs/apps-script/Index.html` → upload
`index.html` (+`sw.js` kalau berubah) ke root repo GitHub (guna "Add file →
Upload files" atau edit fail sedia ada terus — **elak salin-tampal dalam
editor GitHub untuk fail besar, senang tersilap/terpotong**) → Vercel
auto-deploy → server Linux perlu `git pull` manual.

## 4. Backend — Google Apps Script + Sheets + Drive
Satu Google Sheet ("SR Group Safety — Database Pusat") + Google Drive
(folder "SR Safety Files") jadi database berpusat dikongsi semua
site/deployment. Lihat `CLAUDE.md` seksyen "Pelayan Pusat" untuk seni bina
sync penuh (merge `updatedAt`, tombstones, tie-break `isResolved`).

**Kredential/config** (Script Properties dalam projek Apps Script — **BUKAN**
dalam kod, dan token **JUGA** hardcode dalam `SR-Group-Safety-System.html`
sebagai `API_DEFAULT` untuk auto-connect semua peranti):
- `TOKEN` — token rahsia sync (kawal siapa boleh baca/tulis data).
- `SHEET_ID` — ID Google Sheet (wajib kalau Apps Script project bukan
  "bound" terus ke Sheet).

⚠️ **Token ni kelihatan dalam source HTML awam** (`API_DEFAULT` dalam kod) —
trade-off yang diterima untuk alat dalaman committee, bukan rahsia tahap
tinggi. Kalau perlu tukar/putar token pada masa depan: kemas kini Script
Property `TOKEN` di Apps Script, deploy semula (New version), **DAN**
kemas kini `API_DEFAULT` dalam HTML di ketiga-tiga lokasi (seksyen 2).

**Sesiapa yang perlu akses Google Sheet/Drive/Apps Script tu sendiri** —
minta akses kongsi terus daripada pemilik akaun Google yang deploy Apps
Script asal (bukan sesuatu yang boleh diselesaikan dari repo/dokumen ni).

## 5. Sejarah & konteks keputusan penting (ringkas)
- Sistem asalnya localStorage semata-mata (setiap PC/site berasingan) →
  dipusatkan ke Apps Script+Sheets+Drive sepanjang sesi Claude Code ni.
- Hosting Apps Script langsung (`HtmlService`) tak stabil (isu wrapper
  iframe/extension browser) → beralih ke Vercel sebagai kaedah utama.
- Site Visit: gambar+borang digabung jadi **satu PDF sebenar** (penjana PDF
  vanilla-JS native, termasuk keupayaan cantum berbilang PDF) — bukan
  `window.print()` lama.
- **Pengajaran penting** (dicatat dalam CLAUDE.md, WAJIB ikut): lajur baharu
  dalam skema Google Sheets (`COLS.*` di `Code.gs`) **mesti** ditambah di
  HUJUNG senarai, JANGAN disisip di tengah — pernah terjadi bug sebenar
  (lajur `hari` tersalah letak) yang buat data lama tersasar/salah label.
  Ada fungsi pembaikan (`repairManhoursHariShift()`) sebagai contoh cara
  betulkan kalau ini terjadi lagi.
- Attendance Report (Meeting/Walkabout/Ranking) — ciri terkini, termasuk
  upload/muat-turun `.xlsx` sebenar (parser+writer native, tiada library).

## 6. Cara uji perubahan (sebelum deploy)
Tiada automated test suite — pengesahan dibuat manual setiap round melalui
pelayar (Claude Code Browser tool sepanjang sesi ni): jalankan pelayan
statik tempatan (`docs/vercel/` sebagai root), suntik data ujian melalui
`javascript_tool`/console, sahkan tingkah laku betul sebelum sync ke
deployment sebenar. Kalau pasukan baharu guna Claude Code, minta ia buat
perkara serupa — jangan tulis terus ke fail deployment tanpa uji.

## 7. Apa yang belum/boleh diteruskan
- Domain + HTTPS untuk server Linux (lihat "Tambah domain + HTTPS kemudian"
  dalam `SETUP-LINUX.md`) — belum disediakan, IP-only buat masa ini.
- App kedua/lain akan ditambah ke server Linux yang sama (nginx sub-path
  atau port berlainan — lihat perbincangan terkini, belum dilaksana).
- Tiada automated backup berjadual untuk Google Sheet/Drive — backup JSON
  manual sedia ada dalam Tetapan sistem (`backup()`), tapi tak berjadual.
