# Setup Pelayan Pusat (Google Apps Script)

Panduan ini untuk **admin sistem** (bukan perlu tahu coding) — sekali sahaja
untuk setup, kemudian setiap PC/site hanya perlu paste 2 nilai dalam Tetapan.

Selepas ini disiapkan, semua site berkongsi **satu database** (Google Sheet).
Data disimpan dalam browser (localStorage) seperti biasa walau tiada
internet, dan auto-segerak ke pusat bila sambungan kembali.

## 1. Cipta Google Sheet
1. Buka [sheets.google.com](https://sheets.google.com) → **Blank spreadsheet**.
2. Namakan cth. `SR Group Safety — Database Pusat`.

## 2. Masukkan kod Apps Script
1. Dalam Sheet, klik **Extensions → Apps Script**.
2. Padam kod contoh (`Code.gs`) yang ada, gantikan dengan kandungan penuh
   fail [`Code.gs`](Code.gs) dalam folder ini (salin-tampal semua).
3. Klik ikon 💾 **Save** (namakan projek cth. "SR Safety Backend").

## 3. Tetapkan Token Rahsia (dan SHEET_ID jika perlu)
1. Dalam Apps Script editor, klik ⚙️ **Project Settings** (menu kiri).
2. Skrol ke **Script Properties → Add script property**.
3. Property: `TOKEN`, Value: mana-mana rentetan rawak yang panjang & rahsia
   (cth. jana di [randomkeygen.com](https://randomkeygen.com) — guna yang
   "CodeIgniter Encryption Keys" punya panjang).
4. **Save script properties**.
   > Token ini seperti kata laluan — sesiapa yang ada Token & URL Web App
   > boleh baca/tulis semua data. Jangan kongsi di tempat awam.
5. **Tambah satu lagi property**: `SHEET_ID`, Value: ID Sheet anda (bahagian
   dalam URL Sheet antara `/d/` dan `/edit`, cth. URL
   `docs.google.com/spreadsheets/d/1cJguu.../edit` → SHEET_ID ialah `1cJguu...`).
   > Property ini **wajib** jika projek Apps Script anda dibuka secara
   > berasingan (bukan terus dari menu Extensions dalam Sheet) — tanpanya,
   > skrip tak tahu Sheet mana nak tulis dan data akan "hilang" (Sheet nampak
   > kosong walaupun status kata "Bersambung").

## 4. Tambah fail Index.html (untuk buka sistem terus dari Web App URL)
1. Dalam Apps Script editor, klik ikon **+** di sebelah "Files" → **HTML**.
2. Namakan fail **`Index`** (mesti tepat — huruf besar I).
3. Padam kandungan kosong, gantikan dengan **kandungan penuh**
   `SR-Group-Safety-System.html` anda (fail yang sama yang anda buka di PC) —
   salin-tampal semuanya.
4. Save (💾).
   > Ini membolehkan sesiapa terus buka sistem dengan melawat Web App URL
   > (Langkah 5) tanpa perlu fail HTML tempatan — sistem sentiasa terkini
   > kerana semua orang guna salinan yang sama dari Apps Script.

## 5. Deploy sebagai Web App
1. Klik **Deploy → New deployment** (kali pertama sahaja — selepas ini guna
   "Manage deployments → Edit → New version" bila kod berubah, supaya URL
   kekal sama).
2. Klik ikon ⚙️ sebelah "Select type" → pilih **Web app**.
3. Tetapan:
   - **Execute as:** `Me` (akaun anda)
   - **Who has access:** `Anyone`
     (Ini perlu supaya sistem HTML boleh hantar data tanpa login Google.
     Keselamatan dikawal oleh Token, bukan oleh akses Google.)
4. Klik **Deploy**. Google akan minta kebenaran (Authorize) — benarkan akses
   ke Sheets & Drive akaun anda (script ini hanya jalan bila dipanggil, dan
   hanya baca/tulis Sheet & folder yang ia cipta sendiri).
5. Salin **Web app URL** yang dipaparkan (bentuk
   `https://script.google.com/macros/s/AKfycb.../exec`). Melawat URL ini
   terus dalam browser akan papar sistem HTML penuh (dari Langkah 4).

## 6. Sambungkan setiap PC/site
Di setiap PC yang guna sistem HTML (sama ada fail tempatan atau buka terus
Web App URL):
1. Buka `SR-Group-Safety-System.html` (atau Web App URL dari Langkah 5.5).
2. Ke footer → **⚙ Tetapan Sistem (Admin)** → masukkan kata laluan admin.
3. Skrol ke kad **☁ Pelayan Pusat (Segerak Semua Site)**:
   - **URL Web App** → paste URL dari Langkah 5.5.
   - **Token** → paste Token dari Langkah 3.3.
4. Klik **Simpan & Sambung**. Jika berjaya, akan papar "✔ Bersambung!".
5. Data sedia ada dalam PC ini akan **automatik disegerak ke pusat** —
   tiada langkah tambahan diperlukan. Ulang langkah 1-4 di setiap PC/site lain.

Untuk semak status bila-bila masa, lihat badge kecil di header (🟢 Disegerak /
🟡 Menyegerak / 🔴 Luar talian) atau kad Pelayan Pusat dalam Tetapan.

## Apa berlaku di sebalik tabir
- Klik **Simpan** pada mana-mana borang (Manhour, Report, Site Visit, Program,
  Reward) terus disimpan tempatan (localStorage) *dan* dihantar ke pusat.
- Jika tiada internet, data kekal tersimpan tempatan; sistem cuba semula
  secara automatik bila sambungan kembali (event `online` + setiap 60 saat).
- Fail PDF report & gambar Site Visit dimuat naik ke folder Google Drive
  bernama **"SR Safety Files"** (dicipta automatik dalam Drive akaun Langkah
  4) — bukan disimpan dalam Sheet (elak had saiz sel & localStorage penuh).
- Sheet ada 7 tab: `Manhours`, `Reports`, `Inspections`, `Programs`, `Users`,
  `Rewards`, `Settings` (+ `Tombstones` untuk jejak rekod yang dipadam).
  **Jangan edit tab ini secara manual** — biarkan sistem urus, sebab format
  lajur `id` mesti kekal teks (bukan nombor) supaya tidak rosak.

## Had & amaran
- Akaun Google percuma: had kuota Apps Script ~90 minit masa jalan skrip
  sehari & had panggilan URL Fetch/Drive — lebih dari cukup untuk penggunaan
  biasa sebuah jawatankuasa safety (bukan trafik tinggi).
- Setiap segerak hantar **keseluruhan snapshot data** (bukan hanya rekod
  berubah) — sesuai untuk skala ratusan/ribuan rekod. Jika data membesar
  sangat (puluhan ribu rekod), pertimbangkan sync inkremental pada masa depan.
- Jangan padam/tukar nama tab Sheet — sistem cipta semula secara automatik
  jika hilang, tetapi data lama dalam tab yang dipadam akan hilang.

## Troubleshooting
| Masalah | Punca biasa |
|---|---|
| "✘ Gagal sambung" | URL/Token salah, atau deployment bukan "Anyone" akses |
| Status kata "Bersambung" tapi **Sheet kekal kosong** | Tambah Script Property `SHEET_ID` (Langkah 3.5) — biasa berlaku bila projek Apps Script tak dibuka terus dari menu Extensions dalam Sheet |
| Data tak sampai ke PC lain | Pastikan semua PC guna URL & Token **sama persis** |
| Gambar/PDF tak papar di PC lain | Semak Google Drive: fail mesti share "Anyone with link" (patut auto-set oleh skrip) |
| Perlu tukar Token | Kemaskini Script Property `TOKEN`, deploy semula (Manage deployments → Edit → New version), kemaskini Token di setiap PC |
| Buka Web App URL papar ralat/kosong bukan sistem | Pastikan fail `Index.html` (Langkah 4) wujud dan namanya tepat `Index` |
| Banyak fail PDF report **duplicate** dalam folder Drive "Reports" | Pastikan `Code.gs` versi terkini (ada pembetulan tie-break `mergeD`) sudah dideploy — punca lama: PDF sama diupload semula setiap sync sebelum pembetulan. Jalankan fungsi `cleanupDuplicateReportFiles()` (Apps Script → pilih dari dropdown Run) sekali untuk buang fail yatim (dibuang ke Trash, boleh pulih). |
| Tab **Manhours**: data jam/lti/pic/remark nampak tersasar/salah lajur (cth. lajur "jam" jadi 0, lajur lain lain letak nombor besar/teks tak kena tempat) | Punca: kemaskini `COLS.manhours` yang letak lajur baharu (`hari`) di TENGAH skema, bukan di hujung — baris sedia ada tak "bergerak" ikut lajur baharu. Pastikan `Code.gs` versi terkini (lajur sentiasa ditambah di HUJUNG) sudah dideploy, lepas tu jalankan `repairManhoursHariShift()` (Apps Script → pilih dari dropdown Run) **sekali sahaja** untuk betulkan balik. Sahkan beberapa baris lepas jalan sebelum percaya sepenuhnya. |
