# Deploy Sistem HTML ke Server Linux Sendiri (Nginx)

Panduan ini hos `index.html` (+ `sw.js`) terus dari server Linux anda sendiri
menggunakan **Nginx**, diakses melalui alamat IP server (`http://IP-SERVER`).
Semua arahan di bawah dijalankan **dalam sesi SSH anda sendiri** ke server
tersebut — saya (Claude) tiada akses rangkaian ke server luar, jadi salin-
tampal setiap arahan satu-satu ke terminal SSH anda.

**Penting:** Ini cuma tambah **satu lagi cara akses** sistem (host fail
statik sahaja). Backend (database) tetap Google Apps Script + Sheets yang
sedia ada — TIDAK berubah, dan tak berkonflik dengan Vercel (boleh jalan
serentak, dua-dua URL akan capai data yang sama).

## Keperluan
- Server Linux (Ubuntu/Debian — arahan `apt` di bawah; kalau guna
  CentOS/RHEL/Rocky, ganti `apt` dengan `dnf` dan nama pakej mungkin sikit
  berbeza — beritahu saya kalau begitu, saya boleh sesuaikan).
- Akses `sudo` pada server tersebut.
- Repo GitHub anda (`hrsahrulsazly-bit/sr-safety-system`) — sudah **Public**,
  jadi boleh `git clone` terus tanpa log in/token.

## Langkah 1: Pasang Nginx & Git
```bash
sudo apt update
sudo apt install -y nginx git
```
Sahkan Nginx berjalan:
```bash
sudo systemctl status nginx
```
(Patut tertera "active (running)". Tekan `q` untuk keluar paparan status.)

## Langkah 2: Clone repo ke `/var/www/`
```bash
sudo git clone https://github.com/hrsahrulsazly-bit/sr-safety-system.git /var/www/sr-safety-system
```
Beri kebenaran baca kepada Nginx (user `www-data`):
```bash
sudo chown -R www-data:www-data /var/www/sr-safety-system
sudo chmod -R 755 /var/www/sr-safety-system
```

## Langkah 3: Cipta config Nginx untuk laman ni
```bash
sudo nano /etc/nginx/sites-available/sr-safety
```
Tampal kandungan ini (root **mesti** tunjuk terus ke fail `index.html` di
root repo — bukan dalam subfolder `docs/`):
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name _;

    root /var/www/sr-safety-system;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location = /sw.js {
        add_header Cache-Control "no-cache";
    }
}
```
Simpan (Ctrl+O, Enter) dan keluar (Ctrl+X).

Aktifkan config ni dan lumpuhkan default Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/sr-safety /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
```
Kalau `nginx -t` tunjuk "syntax is ok" dan "test is successful", muat semula:
```bash
sudo systemctl reload nginx
```

## Langkah 4: Buka port 80 di firewall (jika firewall aktif)
```bash
sudo ufw allow 'Nginx HTTP'
sudo ufw status
```
(Kalau `ufw` tak aktif/tak dipasang, langkah ni boleh skip — port 80 sudah
terbuka secara default.)

## Langkah 5: Uji
Dapatkan IP server (kalau tak tahu):
```bash
curl -4 ifconfig.me
```
Buka **`http://IP-SERVER`** (gantikan `IP-SERVER` dengan hasil arahan atas)
dalam pelayar mana-mana peranti — sistem sepatutnya terus terbuka dan
berfungsi sepenuhnya (sync ke Google Sheets sama seperti versi Vercel, sebab
guna backend/token yang sama).

## Bila anda ubah/tambah ciri pada sistem (masa depan)
Selepas commit perubahan `index.html`/`sw.js` ke GitHub (cara yang sama macam
untuk Vercel), kemas kini server Linux dengan:
```bash
cd /var/www/sr-safety-system
sudo git pull
sudo chown -R www-data:www-data /var/www/sr-safety-system
```
Tiada perlu restart Nginx — fail statik terus disajikan terkini. Buka semula
laman & **hard refresh** (Ctrl+Shift+R) di pelayar untuk elak cache lama.

## Tambah domain + HTTPS kemudian (pilihan)
Bila anda dah ada domain (cth. `safety.syarikat.com`) ditunjuk (rekod DNS A)
ke IP server ni, beritahu saya — saya sediakan langkah tambah:
1. Tukar `server_name _;` kepada `server_name safety.syarikat.com;` dalam
   config Nginx di atas.
2. Pasang sijil percuma guna **Certbot** (Let's Encrypt) — automatik urus
   HTTPS + renew.

## Troubleshooting
| Masalah | Punca biasa |
|---|---|
| "403 Forbidden" bila buka URL | Kebenaran fail salah — jalankan semula Langkah 2 (`chown`/`chmod`) |
| "This site can't be reached" | Firewall server/provider (cth. AWS Security Group, DigitalOcean Firewall) sekat port 80 dari luar — semak tetapan firewall di **panel provider**, bukan cuma `ufw` dalam server |
| Laman terbuka tapi papar versi lama lepas update | `git pull` tak dijalankan, atau cache pelayar — jalankan Langkah "Bila anda ubah/tambah ciri" & hard refresh |
| `nginx -t` tunjuk ralat sintaks | Semak semula config `/etc/nginx/sites-available/sr-safety` — pastikan setiap `{` ada padanan `}` |
