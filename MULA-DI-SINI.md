# Cara guna Claude Code dengan projek ini

## 1. Letak fail sistem dalam folder ini
Salin fail **SR-Group-Safety-System.html** (yang anda download dari Cowork)
ke dalam folder ini:

```
Desktop\AI 2026\SAFETY REPORT\SR-Safety-System\
├── SR-Group-Safety-System.html   ← letak di sini
├── CLAUDE.md                     ← dokumentasi projek (Claude Code baca automatik)
└── MULA-DI-SINI.md               ← fail ini
```

## 2. Install Claude Code (sekali sahaja)
Buka **PowerShell** dan jalankan:

```
irm https://claude.ai/install.ps1 | iex
```

(Perlu log masuk dengan akaun Claude anda selepas install.)

## 3. Buka projek
Dalam PowerShell:

```
cd "C:\Users\user\Desktop\AI 2026\SAFETY REPORT\SR-Safety-System"
claude
```

## 4. Mula bekerja
Claude Code akan baca CLAUDE.md secara automatik dan faham keseluruhan sistem.
Contoh arahan yang boleh terus diberi:

- "tambah carta pie untuk status program dalam dashboard"
- "tukar warna tema kepada biru"
- "tambah field nombor telefon dalam ID penilai"
- "bina versi Google Apps Script supaya data berpusat"

Setiap perubahan boleh disemak dengan buka fail HTML dalam browser.

## Nota
- Backup data anda dahulu (Tetapan → Muat Turun Backup) sebelum menukar kod.
- Data berada dalam browser (localStorage), bukan dalam fail HTML — edit kod tidak memadam data.
