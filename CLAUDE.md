# SR Group Safety System

Sistem pengurusan keselamatan (HSE) untuk SR Group Safety Committee.
Single-file web app: semua HTML, CSS dan JavaScript berada dalam **SR-Group-Safety-System.html**.

## Cara jalankan
Buka `SR-Group-Safety-System.html` terus dalam browser (double-click). Tiada build step, tiada dependency, tiada server.

## Seni bina
- **Satu fail HTML sahaja** — kekalkan begini kecuali diarahkan sebaliknya.
- **Tiada library luaran / CDN** — vanilla JS sahaja, mesti berfungsi offline
  (offline penuh bila Pelayan Pusat tidak dikonfigur — lihat bawah).
- **Storan:** `localStorage`
  - Kunci `srg_safety_v1` — semua data (objek `D`)
  - Kunci `srg_ui` — pilihan bahasa & tema (objek `UI`, tidak termasuk dalam backup)
  - Kunci `srg_api` — config Pelayan Pusat `{url, token}` (objek `API`, tidak
    termasuk dalam backup — setiap PC configure sendiri)
- **Pelayan Pusat (pilihan)** — Google Apps Script + Google Sheets + Drive,
  supaya semua site kongsi satu database. Lihat
  [`docs/apps-script/Code.gs`](docs/apps-script/Code.gs) (backend) dan
  [`docs/apps-script/SETUP-PUSAT.md`](docs/apps-script/SETUP-PUSAT.md) (panduan
  deploy). Bila `API.url`/`API.token` kosong, sistem 100% offline-only macam
  asal — tiada regresi untuk pengguna yang tak setup backend.
  - **Sync engine** (dalam HTML): `save()` = `persistLocal()` (localStorage +
    render, macam sebelum ini) + `triggerSync()` (push snapshot penuh `D` ke
    Web App, no-op jika tak dikonfigur).
  - **Auto-refresh "live"**: selain sync semasa `save()`/load, klien juga
    auto-panggil `pushToServer()` setiap ~20 saat (skip bila tab tersembunyi)
    + bila tab jadi aktif semula (`visibilitychange`/`focus`) — supaya
    perubahan dari peranti/pengguna lain nampak tanpa reload manual. Ini
    tambah bilangan panggilan Apps Script — masih jauh dalam had kuota untuk
    penggunaan biasa (lihat SETUP-PUSAT.md), tapi kurangkan interval kalau
    ramai pengguna serentak.
  - **Config `srg_api` (URL+Token) berasingan setiap origin/domain** —
    localStorage tak dikongsi merentas domain. Untuk elak setiap peranti kena
    diisi manual, `API_DEFAULT` (URL+Token pengeluaran) **dibina terus** dalam
    kod sebagai nilai lalai `API` — sesiapa buka sistem (fail tempatan atau
    Vercel) terus tersambung tanpa setup. Tetapan → Pelayan Pusat masih boleh
    override ikut peranti (simpan ke `srg_api`, atasi lalai) — kosongkan &
    simpan untuk guna offline sepenuhnya di peranti tu sahaja. **Trade-off**:
    Token jadi kelihatan dalam source HTML awam — boleh diterima untuk alat
    dalaman jawatankuasa, tapi bukan rahsia tahap tinggi lagi selepas ini.
  - **Satu endpoint POST** buat push & pull serentak: klien hantar `D` penuh,
    server gabung (`mergeD()`) dengan `D` di Sheet, upload fail base64 baru ke
    Drive, tulis balik, pulangkan `D` gabungan. PC baru dgn `D` kosong terima
    balik semua data pusat — jadi mekanisme migrasi automatik, bukan butang
    khas.
  - **Merge**: union-by-id ambil `updatedAt` terbesar; padam guna
    `D.tombstones=[{ent,id,ts}]` (union biasa tak boleh nyatakan padam).
    Settings (`sites/target/pass`) satu singleton, guna `D.settingsUpdatedAt`.
    Bila `updatedAt` sama (lazim selepas push berjaya — server pulangkan
    rekod dgn `updatedAt` tak berubah), `mergeD()` utamakan rekod yang
    **"resolved"** (`reports`: ada `driveFileId`; `inspections`: tiada foto
    base64 lagi) berbanding base64 mentah — elak base64 tempatan kekal
    selamanya & penuhkan kuota `localStorage` (bug ini pernah berlaku,
    dibetulkan — logik sama di client & `Code.gs`).
  - **Fail PDF Monthly Report**: base64 dihantar sekali, Apps Script upload ke
    Drive (folder "SR Safety Files/Reports", sharing "Anyone with link"),
    gantikan dengan `driveUrl`/`driveFileId` — elak had saiz sel Sheet & kuota
    `localStorage` penuh (`a_full`).
  - **Site Visit — borang + gambar digabung jadi SATU PDF sebenar** (bukan
    `window.print()` lagi): `pdfBuildInspectionBase64(rec)` (blok "PDF engine"
    sebelum `submitSV()`) jana fail PDF 1.4 penuh secara manual dalam vanilla
    JS — objek tak langsung, jadual xref, `/DCTDecode` untuk benam JPEG gambar
    terus tanpa re-encode, pagination automatik ikut bilangan soalan. Hasil
    (`rec.pdfData`, data URI base64) disimpan pada rekod `inspections` dan
    dihantar dalam sync — `resolveFiles()` di `Code.gs` upload ke folder Drive
    "SR Safety Files/SiteVisit" (sharing "Anyone with link"), gantikan dengan
    `pdfFileId`/`pdfUrl`, buang `pdfData` mentah sebelum tulis ke Sheet. Field
    gambar mentah (`ph[]`) sendiri **tak** disync (`stripPhotos()` — replacer
    `JSON.stringify` di `pushToServer()` kosongkan `ph`) sebab dah terbenam
    dalam PDF; elak Drive/Sheet penuh dgn fail gambar berasingan. Ini bermakna
    buka Site Visit dari akaun Google/peranti lain nampak PDF (borang+gambar)
    yang sama persis — bukan hanya data mentah tanpa gambar. `viewSV(id)`/
    `dlSV(id)` (gantikan `printSV()` lama) buka/muat-turun PDF ini terus.
  - **Cantum berbilang report Site Visit jadi 1 PDF** (`mergeSelectedSV()` +
    checkbox `.svPick` pada senarai): `pdfParseOwnPages(bytes)` baca balik
    struktur PDF yang **kita sendiri jana** (bukan parser PDF umum — hanya
    faham xref fixed-width & format ringkas `pdfSerialize()` sendiri) untuk
    ekstrak setiap muka surat (content stream + imej DCTDecode mentah) tanpa
    perlu regenerate dari data asal (perlu, sebab lepas sync `data[].ph` dan
    `pdfData` dibuang tempatan — hanya fail PDF siap di Drive yang authoritative).
    Muka surat dari semua report dipilih digabung terus (`pdfSerialize()`
    diguna semula, kini terima muka surat "mentah" `{opsBytes,images}` selain
    bentuk berstruktur asal). Kalau `pdfData` dah tiada tempatan (biasa lepas
    ~20s, ikut auto-sync), `apiGetFile(fileId)` panggil endpoint baharu
    `Code.gs` `doGet?action=getfile` (relay base64 fail Drive — perlu sebab
    `fetch()` terus ke drive.google.com dari klien disekat CORS).
  - **Hosting terus dari Apps Script**: `docs/apps-script/Index.html` ialah
    salinan `SR-Group-Safety-System.html` untuk dipaste ke fail `Index.html`
    dalam projek Apps Script — `doGet()` papar sistem penuh bila Web App URL
    dilawat tanpa `?action=`. **Nota**: kaedah ini didapati tak stabil dalam
    amali — `HtmlService` bungkus kandungan dalam iframe wrapper Google
    (untuk OAuth/keizinan) yang boleh bercanggah dengan extension browser
    (Google Translate dll), punca ralat JS yang bukan dari kod kita.
  - **Hosting terus dari Vercel (disyorkan)**: `docs/vercel/index.html` +
    `docs/vercel/SETUP-VERCEL.md` — hos fail statik terus (tiada wrapper,
    tiada isu extension), lebih stabil untuk akses sistem dari satu URL
    dikongsi semua site. Backend tetap Apps Script (sync tak berubah).
  - **Script Property `SHEET_ID`** (pilihan): jika projek Apps Script bukan
    "bound" terus ke Sheet (dibuka dari Drive/URL berasingan), `getSS()` guna
    `SHEET_ID` untuk `openById()` — tanpanya Sheet kekal kosong walaupun sync
    "berjaya" (lihat troubleshooting dalam SETUP-PUSAT.md).
  - **PENTING — `COLS.*` di `Code.gs` mesti sentiasa TAMBAH lajur baharu di
    HUJUNG senarai (sebelum `updatedAt`), JANGAN sisip di tengah.** Baris Sheet
    sedia ada tak "bergerak" ikut lajur baharu — `ensureHeaders()` tulis
    semula header setiap kali, tapi data baris kekal di kedudukan fizikal
    lama, jadi sisipan di tengah buat SEMUA lajur selepasnya tersasar/salah
    label (bug sebenar pernah berlaku — `hari` tersilap disisip sebelum `jam`
    dalam `COLS.manhours`, punca lajur jam/lti/pic/remark lama semua salah
    baca; dibetulkan dengan susun semula + `repairManhoursHariShift()`).

## Model data (objek `D`)
```
{
  sites: ["OTN Next DC", "OSBN", ...],      // senarai site/projek
  target: 1200000,                           // target KPI manhour tahunan (lalai global)
  siteTargets: {"OSJ": 600000, ...},         // target KPI khas ikut site (pilihan) — site tiada entri di sini guna `target` di atas sebagai lalai. Dashboard guna ini bila Tapis Site aktif; "Semua Site" kekal guna `target` global.
  pass: "sradmin",                           // kata laluan admin (Tetapan)
  manhours:    [{id, bulan:"YYYY-MM", site, pekerja, hari, jam, lti, pic, remark}],  // hari = jumlah hari bekerja bulan itu, lti = bil. kes LTI/kemalangan bulan itu, pic = nama penyedia data, remark = catatan
  reports:     [{id, bulan, site, pic, fname, fsize, data(base64 PDF), tarikh}],
  inspections: [{id, jenis:"site"|"store", tarikh, co, branch, scope, lok, site,
                 auditor, pic, findings, good, tot, pdfFileId, pdfUrl,
                 data:[{name, items:[{q, t:"yn"|"txt", neg, a, txt, note, ph[]:[{d(jpeg base64),w,h}]}]}]}],
  programs:    [{id, nama, jenis, tarikh, site, pic, status:"Dirancang"|"Selesai"|"Ditangguh", detail}],
  users:       [{id, uid, nama, pass, kats:["worker"|"staff"|"branch"]}],  // ID penilai reward
  rewards:     [{id, kat, nama, site, bulan, by, tot, scores[], yn[], tarikh}],  // yn = penanda Yes/No rujukan ikut jadual proposal setiap kriteria — TAK beri kesan pengiraan tot
  attendance:  [{id, kategori:"meeting"|"walkabout", bulan, tarikh, lokasi(khas walkabout), nama, branch}],  // satu rekod = satu orang satu sesi; diisi bulk melalui upload .xlsx
  tombstones:  [{ent, id, ts}],   // rekod dipadam — untuk sync merge (lihat Pelayan Pusat)
  settingsUpdatedAt: 0            // timestamp perubahan sites/target/pass terakhir — untuk sync merge
}
// Semua rekod di atas (manhours/reports/inspections/programs/users/rewards) turut ada
// field `updatedAt` (timestamp) untuk sync merge. Reports pulangan dari Pelayan Pusat
// tambah `driveFileId`/`driveUrl` (fail disimpan di Drive, bukan base64 lagi).
```

## Modul / tab
1. **KPI Dashboard** — manhour kumulatif vs target 1.2M, status report ikut site, carta bulanan, peringatan deadline. Tiga penapis: **Tapis Tahun** (`dYearFilter`, senarai tahun dijana automatik dari tahun sebenar dalam `D.manhours` + tahun semasa, default = tahun semasa/`thisYear`), **Tapis Bulan** (`dMonthFilter`, 12 bulan terkini + pilihan **"Semua Bulan"** (`value=""`) di atas sekali, default = bulan pelaporan/`prevMonth()` — **tak berkaitan** dengan Tapis Tahun, tetap tetingkap 12-bulan bergolek) & **Tapis Site** (`dSiteFilter`). Kad "Report Bulanan Diterima" & amaran deadline **sentiasa** guna `prevMonth()` (bulan pelaporan sebenar) tanpa mengira pilihan Tapis Bulan — konsep "deadline semasa" tak masuk akal utk paparan sejarah. Manhour Kumulatif / Jumlah Hari / Kes LTI / carta bulanan ikut Tapis Tahun + Tapis Site; tajuk kad (`dMHTitle`/`dHariTitle`/`dLTITitle`) dikemaskini dinamik papar tahun dipilih.
   **Jadual "Status Report Bulanan"** (`dSiteTbl`) bertukar mod: Tapis Bulan = bulan spesifik → satu baris **setiap site** (asal, tak berubah); Tapis Bulan = "Semua Bulan" **DAN** satu Site khusus dipilih → satu baris **setiap bulan** (`dashMonthsForYear()` — Jan hingga `prevMonth()` utk tahun semasa, Jan-Dis penuh utk tahun lampau) bagi site tu sahaja; "Semua Bulan" + "Semua Site" (tiada site khusus) → papar mesej minta pilih satu site (paparan matriks site×bulan sengaja tak dibina, terlalu besar/mengelirukan).
2. **Safety Manhour** — key-in manhour bulanan per site. Peraturan: manhour bulan X mesti dimasukkan **sebelum 7hb bulan X+1**.
3. **Monthly Report** — upload PDF report (bulan, lokasi, nama PIC). Max 3MB/fail. Deadline sama seperti manhour.
4. **Site Visit** — checklist audit dari template SafetyCulture (SR: Work-Site Visit Checklist Rev.1). Dua jenis: `site` (27 soalan, 9 seksyen) dan `store` (pejabat/stor). Jawapan Yes/No/NA + nota + gambar (butang 📷 Kamera guna `capture="environment"` & 🖼 Galeri guna `multiple`, kedua-dua ke `svPhoto()`; auto-compress 700px JPEG 0.6, max 4/soalan). Submit → jana **satu fail PDF sebenar** (borang + semua gambar terbenam) melalui penjana PDF vanilla-JS sendiri (lihat nota "Site Visit — borang + gambar digabung..." di Seni Bina), disimpan dalam rekod & disync ke Google Drive. Soalan `neg:1` = jawapan "No" dikira patuh (cth: tanda merokok). `viewSV`/`dlSV` papar/muat-turun PDF; sama di semua peranti/akaun selepas sync.
5. **Safety Program** — daftar program (walkabout, toolbox, audit, latihan) dengan PIC, status dan detail.
6. **Safety Reward** — penilaian mengikut proposal SR/HSE/SRP/01 REV.0. Tiga kategori: worker (10 kriteria), staff (11), branch (11). Jenis item: `eval` (skor 0..max oleh committee) dan `count` (bil. kali × pts, ada `cap` untuk sesetengah item). Borang `buildRW()` papar kriteria sebagai **jadual sebenar** (No/Keterangan/Max Point/Input/Pts/Remarks — ikut format jadual dalam dokumen proposal, bukan senarai kad). **Akses**: log in ID penilai (`EVAL`) ATAU admin (`adminOK` dari Tetapan, tanpa perlu ID penilai — `rwView()` semak `EVAL||adminOK`). Hanya admin boleh cipta ID penilai & tick kategori yang dibenarkan (`kats`). **Edit rating sedia ada**: butang ✎ Edit pada senarai (`editRW(id)`) isi semula borang (skor `count` type di-reverse-engineer dari `tot/pts` untuk paparan — skor sebenar tak berubah melainkan disunting semula), `addRW()` kesan mod edit (`rwEditId`) dan kemaskini rekod sedia ada (bukan cipta baharu).
7. **Attendance Report** — dua kategori (`kategori:'meeting'|'walkabout'`), satu rekod = satu orang hadir satu sesi (`{id,kategori,bulan,tarikh,lokasi(khas walkabout),nama,branch,updatedAt}`). Metadata sesi (Bulan/Tarikh/Lokasi) diisi SEKALI di borang, kemudian **upload fail Excel (.xlsx) sebenar** untuk bulk-tambah semua nama hadir sekali gus (bukan taip satu-satu). **Parser xlsx native** (`xlsxReadFirstSheet()`) — xlsx ialah ZIP+XML; dibaca terus guna `DecompressionStream('deflate-raw')` (API pelayar terbina-dalam, bukan library luaran) untuk nyahmampat + `DOMParser` untuk hurai XML (worksheet + sharedStrings). `attFindCols()` cuba kesan lajur "Nama"/"Branch" ikut teks header (jatuh balik ke lajur A/B jika tiada header dikesan). Selalu papar **pratonton** (`attPreviewWrap`) sebelum commit — admin boleh batal jika parsing tersilap.
   **Penjana template** (`xlsxBuildSimple()`/`attDownloadTemplate()`) — pasangan writer utk parser di atas, guna `CompressionStream('deflate-raw')` (juga API pelayar terbina-dalam) utk mampat + bina struktur ZIP (local/central header, EOCD) secara manual, sel `t="inlineStr"` (elak perlu bina sharedStrings table). Butang "⬇ Template Excel" (satu setiap kategori) muat turun fail `.xlsx` sebenar (disahkan sah/boleh dibuka guna `System.IO.Compression.ZipFile` semasa ujian) — pekerja isi Nama+Branch dalam template tu, admin upload semula fail yang sama melalui aliran bulk-import di atas.
   **Attendance Ranking** (`renderATTRanking()`) — papan pendahulu gabung KEDUA-DUA kategori sekali (kira ikut `nama`, case-insensitive), lajur Walkabout/Meeting/Total berasingan. Susun ikut `total` menurun, seri dipecah dengan `walkabout` menurun (Safety Walkabout diutamakan bila jumlah sama — keperluan eksplisit pengguna). Penapis Bulan/Site sendiri, berasingan daripada tab kategori senarai di atas (sebab ranking bukan skop-kategori).
   **3 tab saling eksklusif** (`attSetView('meeting'|'walkabout'|'ranking')`): Meeting/Walkabout papar `#attMainWrap` (borang upload + senarai, skop `attKat`); Ranking papar `#attRankWrap` sahaja (papan pendahulu). Hanya satu wrap kelihatan pada satu masa.
   **Edit rekod individu** (`attEditRow(id)`/`attSaveRow(id,btn)`) — edit-in-line terus dalam baris jadual (bukan borang berasingan, sebab borang atas untuk bulk-upload sesi bukan edit satu rekod) — tarikh/nama/branch(/lokasi khas walkabout) jadi input terus dalam sel, `bulan` auto-derive dari tarikh baharu semasa simpan (elak bulan & tarikh terpisah/tak konsisten).
8. **Tetapan** (link kecil di footer, perlu kata laluan admin) — urus site, target KPI (termasuk target khas ikut site/branch — `D.siteTargets`), kata laluan, ID penilai, backup/import JSON.

## Logo & PWA
Logo "SR Safety Team" dibenamkan terus sebagai data URI JPEG (3 saiz: 64px
header, 192px favicon/manifest, 512px apple-touch-icon/manifest) — bukan fail
luaran, kekal ikut prinsip satu-fail. Digunakan di:
- `<img class="logo">` header (ganti kotak teks "SR").
- `<link rel="icon">`, `<link rel="apple-touch-icon">`, `<link rel="manifest">`
  (manifest itu sendiri data URI JSON) — untuk ikon "Add to Home Screen" iOS/Android.
- `#loadingScreen` — overlay logo (animasi pulse) dipaparkan sehingga sync awal
  siap atau 4 saat (mana lebih dahulu).

**Untuk tukar logo pada masa depan**: perlu proses semula (resize ke
64/192/512px, JPEG) sebelum benam — logo asal 1024×1024 PNG terlalu besar
untuk benam terus (~600KB). Jangan benam PNG asal secara langsung.

## Ciri merentas modul
- **Dwi bahasa** BM/EN — dictionary `DICT` + fungsi `T(key)`; elemen statik guna atribut `data-i18n` / `data-i18n-ph`; `applyLang()` kemaskini semuanya. Bila tambah UI baru, WAJIB tambah kunci dalam `DICT` dan guna `T()`.
- **Light/dark mode** — kelas `dark` pada `<body>`; semua warna melalui CSS variables dalam `:root` / `body.dark`. Jangan hardcode warna latar/teks.
- **Mobile friendly** — media query `@media(max-width:640px)`; input 16px (elak zoom iOS).
- **Cetak/PDF** — kandungan dimasukkan ke `#printArea`, CSS `@media print` sembunyikan yang lain. Cetakan sentiasa latar putih.
- **Backup/Import** — JSON penuh objek `D`; import boleh gabung (merge ikut `id`) atau ganti.

## Konvensyen kod
- Fungsi pendek, tanpa framework. `$()` = getElementById. `esc()` untuk semua output pengguna (XSS).
- Selepas ubah data: panggil `save()` (simpan + `renderAll()`).
- Bahasa UI utama: Bahasa Melayu; soalan checklist/kriteria reward kekal English (standard audit).
- Tarikh: `YYYY-MM` untuk bulan, `YYYY-MM-DD` untuk tarikh. `prevMonth()` = bulan pelaporan.

## Had & hala tuju
- **Berpusat (jika Pelayan Pusat dikonfigur)**: semua site kongsi satu Google
  Sheet + Drive melalui Apps Script — lihat seksyen Seni Bina di atas dan
  `docs/apps-script/SETUP-PUSAT.md`. PDF/gambar auto-upload ke Drive oleh
  skrip (bukan manual lagi) sebab Apps Script jalan atas identiti akaun Google
  admin, bukan browser pengguna.
- **Tanpa Pelayan Pusat**: data setempat dalam browser setiap PC — penyatuan
  melalui export/import JSON seperti sebelum ini (masih berfungsi, tak diubah).
- Setiap sync hantar snapshot penuh `D` (bukan diff) — sesuai untuk skala
  ratusan/ribuan rekod. Kalau data membesar sangat, pertimbangkan sync
  inkremental sebagai penambahbaikan seterusnya.
