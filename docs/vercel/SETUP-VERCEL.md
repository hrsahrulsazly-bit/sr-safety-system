# Deploy Sistem HTML ke Vercel (hosting percuma)

Panduan ini letak `SR-Group-Safety-System.html` di satu URL awam
(`https://nama-anda.vercel.app`) supaya semua site boleh terus buka sistem
dari mana-mana peranti — tanpa perlu fail tempatan, dan tanpa masalah
"wrapper" Google Apps Script yang kita hadapi tadi.

**Penting:** Vercel di sini **hanya hos fail HTML/JS statik** (paparan &
logik sistem). Backend (database) masih Google Apps Script + Sheets yang
anda dah setup — TIDAK berubah. Selepas deploy, anda cuma perlu configure
Tetapan → Pelayan Pusat dengan URL + Token Apps Script yang sama seperti
sebelum ini.

## Langkah 1: Cipta akaun Vercel
1. Buka [vercel.com](https://vercel.com) → **Sign Up**.
2. Paling senang: daftar guna akaun **GitHub** (klik "Continue with GitHub").
   Kalau tiada akaun GitHub, cipta dulu di [github.com](https://github.com)
   (percuma, ambil masa 2 minit).

## Langkah 2: Cipta repo GitHub untuk fail HTML
1. Buka [github.com/new](https://github.com/new).
2. **Repository name**: cth. `sr-safety-system`.
3. Pilih **Public** atau **Private** (kedua-dua boleh, Private pun percuma).
4. Klik **Create repository**.
5. Dalam halaman repo kosong tu, klik **"uploading an existing file"**
   (link kecil di tengah halaman).
6. Drag & drop fail `SR-Group-Safety-System.html` dari PC anda.
7. **PENTING**: Sebelum commit, tukar nama fail kepada **`index.html`**
   (klik pada nama fail dalam kotak upload, edit terus) — Vercel perlukan
   nama ini untuk paparkan sebagai halaman utama.
8. Klik **Commit changes**.

## Langkah 3: Import ke Vercel & Deploy
1. Balik ke [vercel.com/new](https://vercel.com/new).
2. Klik **Import** di sebelah repo `sr-safety-system` yang baru dicipta.
   (Vercel mungkin minta kebenaran akses GitHub — benarkan.)
3. Biarkan semua tetapan default (tiada "Build Command" diperlukan — ini
   fail statik semata-mata).
4. Klik **Deploy**.
5. Selepas ~10-20 saat, Vercel papar URL siap, bentuk:
   ```
   https://sr-safety-system.vercel.app
   ```
6. Klik URL tu — sistem sepatutnya terus terbuka dan **berfungsi 100%**
   (semua butang, tab, carta — tiada isu "wrapper" macam Apps Script tadi).

## Langkah 4: Sambungkan ke Pelayan Pusat (sama seperti biasa)
1. Buka URL Vercel anda.
2. Footer → **⚙ Tetapan Sistem (Admin)** → kata laluan admin.
3. Kad **☁ Pelayan Pusat** → masukkan **URL Web App** & **Token** Apps
   Script yang sama seperti sebelum ini.
4. **Simpan & Sambung**.

Semua site kini boleh kongsi **satu URL Vercel** (untuk buka sistem) +
**satu backend Apps Script** (untuk data) — tiada fail tempatan diperlukan
langsung.

## Bila anda ubah/tambah ciri pada sistem (masa depan)
Fail dah semakin besar (300+ KB) — **jangan** guna cara "salin-tampal dalam
editor GitHub" lagi (senang tersilap/terpotong). Guna cara **upload fail**
(sama macam setup asal):
1. Buka repo GitHub anda → klik **Add file → Upload files**.
2. Drag & drop fail `index.html` dan `sw.js` terus dari folder
   `docs/vercel/` pada PC anda (kedua-dua fail, sekali gus) — GitHub akan
   **gantikan** `index.html` sedia ada (nama sama) dan tambah `sw.js` baru.
3. **Commit changes**.
4. Vercel **auto-deploy** dalam beberapa saat — URL sama, tiada langkah
   tambahan. Selepas deploy, buka laman & **hard refresh** (Ctrl+Shift+R)
   supaya browser tak guna salinan lama yang tersimpan cache.

**Nota `sw.js`**: fail ini baru (Service Worker, untuk "Add to Home Screen"
jadi app penuh tanpa lencana Chrome). Kali pertama je perlu upload — lepas
itu, setiap kemaskini akan datang consistent sebagai `index.html` sahaja
(kecuali saya nyatakan `sw.js` turut berubah).

## Kenapa Vercel lebih stabil dari hosting Apps Script?
Google Apps Script (`HtmlService`) bungkus kandungan kita dalam iframe
"wrapper" dengan skrip dalaman Google sendiri (untuk OAuth/keizinan) — ini
kadang bercanggah dengan extension browser (Google Translate, ad-blocker,
dll) dan menyebabkan ralat JavaScript yang bukan datang dari kod kita.
Vercel pula hos fail HTML terus tanpa sebarang bungkusan — persis macam
buka fail tempatan, tapi boleh diakses dari mana-mana peranti.
