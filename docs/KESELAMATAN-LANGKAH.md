# Menutup pendedahan token dan kata sandi — SR Group Safety System

Dua masalah, dua pembetulan berasingan. Buat ikut turutan di bawah;
turutan itu penting supaya app tidak terhenti untuk kakitangan.

Ringkasan masalah:

1. **Token ada dalam klien.** `const API_DEFAULT={url:…,token:…}` dihantar
   ke setiap pelayar. Dengan token itu sesiapa boleh baca dan tulis
   ketujuh-tujuh helaian, dan muat naik fail ke Drive anda.
2. **Kata sandi teks biasa.** `rwLogin()` membandingkan `x.pass===p` pada
   `D.users` yang telah disegerakkan penuh ke pelayar. Jadi senarai
   pengguna berserta kata sandi boleh dimuat turun oleh sesiapa yang ada token.

---

## FASA 0 — hari ini, tanpa kod

Tukar setiap akaun yang masih menggunakan kata sandi lalai `sradmin`,
termasuk kata sandi admin dalam Tetapan. Ini tidak menyelesaikan masalah
struktur, tetapi ia menutup laluan paling mudah serta-merta.

---

## FASA 1 — sembunyikan token di sebalik proksi Vercel

Fail `api/sr.js` sudah disediakan dalam repo ini. Vercel mengesan folder
`api/` secara automatik; tiada konfigurasi tambahan diperlukan.

### 1.1 Set environment variable di Vercel

Project > Settings > Environment Variables, tandakan ketiga-tiga
persekitaran (Production, Preview, Development):

    SR_SCRIPT_URL = https://script.google.com/macros/s/XXXX/exec
    SR_TOKEN      = <token sedia ada, sama seperti Script Property 'TOKEN'>

### 1.2 Tukar klien supaya guna proksi

Dalam `index.html` (dan salinan lain — lihat nota di hujung), cari baris
berhampiran **701**:

    const API_DEFAULT={url:'https://script.google.com/...',token:'...'};

Ganti dengan:

    const API_DEFAULT={url:'/api/sr',token:'proksi'};

Nilai `'proksi'` hanyalah pengisi. Ia diperlukan kerana `syncConfigured()`
menyemak `API.token` tidak kosong; token sebenar tidak lagi wujud di klien.

### 1.3 Bersihkan tetapan lama pada peranti kakitangan

Ini langkah yang paling mudah terlepas pandang. Peranti yang pernah
digunakan menyimpan URL dan token lama dalam `localStorage['srg_api']`,
dan nilai itu **mengatasi** `API_DEFAULT`. Tanpa langkah ini, peranti lama
terus memanggil Apps Script secara terus dengan token lama, dan akan
terhenti sebaik sahaja token ditukar di Fasa 1.5.

Tepat selepas baris `try{const a=JSON.parse(...)}catch(e){}` (baris ~703),
tambah:

    /* Migrasi: peranti yang masih tersimpan URL Apps Script terus
       dialihkan ke proksi. */
    if(API.url && API.url.indexOf('script.google.com')>-1){
      API={...API_DEFAULT};
      saveAPI();
    }

### 1.4 Deploy dan uji

Buka app, pergi ke Tetapan > Pelayan Pusat, tekan simpan/uji. Lencana sync
patut bertukar hijau. Kemudian buka DevTools > Network dan sahkan
permintaan pergi ke `/api/sr`, bukan ke `script.google.com`.

Sahkan juga muat naik fail (Reports) masih berfungsi. Proksi ada had 4MB
setiap permintaan — lihat "Had yang perlu diketahui" di bawah.

### 1.5 Baru sekarang, tukar token

Selepas semua peranti berjaya melalui proksi: jana token baharu, kemas kini
Script Property `TOKEN` di Apps Script **dan** `SR_TOKEN` di Vercel, kemudian
redeploy. Token lama kekal dalam sejarah git public selama-lamanya, jadi ia
mesti ditukar — tetapi hanya selepas tiada lagi klien yang membawanya.

---

## FASA 2 — hentikan penghantaran kata sandi ke pelayar

Selepas Fasa 1, orang luar tidak lagi boleh memanggil API. Fasa 2 pula
memastikan kakitangan sendiri (dan sesiapa yang membuka Sheet) tidak nampak
kata sandi orang lain.

### 2.1 Tambah dalam `docs/apps-script/Code.gs`

    function hashPass_(plain, salt) {
      var bait = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256, salt + ':' + plain, Utilities.Charset.UTF_8);
      return bait.map(function (b) {
        return ('0' + (b & 0xFF).toString(16)).slice(-2);
      }).join('');
    }

    function buatHash_(plain) {
      var salt = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
      return 'sha256$' + salt + '$' + hashPass_(plain, salt);
    }

    function sahPass_(simpan, cuba) {
      if (!simpan) return false;
      var p = String(simpan).split('$');
      if (p.length === 3 && p[0] === 'sha256') return hashPass_(cuba, p[1]) === p[2];
      return String(simpan) === String(cuba);   // rekod lama, teks biasa
    }

### 2.2 Endpoint log masuk

Tambah dalam `doGet(e)`, selepas semakan `action === 'ping'`:

    if (action === 'login') {
      var senarai = readEntity('users');
      var uid = String(params.uid || '').toLowerCase();
      for (var i = 0; i < senarai.length; i++) {
        var u = senarai[i];
        if (String(u.uid || '').toLowerCase() !== uid) continue;
        if (!sahPass_(u.pass, params.pass || '')) break;
        // Naik taraf rekod lama kepada hash secara senyap
        if (String(u.pass).indexOf('sha256$') !== 0) {
          u.pass = buatHash_(params.pass || '');
          writeEntity('users', senarai);
        }
        var salinan = {};
        for (var k in u) if (k !== 'pass') salinan[k] = u[k];
        return jsonOut({ ok: true, user: salinan });
      }
      return jsonOut({ ok: false, error: 'invalid login' });
    }

Rekod lama dinaik taraf kepada hash pada kali pertama pengguna log masuk
dengan betul, jadi tiada siapa terkunci keluar dan tiada migrasi manual.

### 2.3 Jangan hantar `pass` dalam data segerak

Dalam `readServerD()` (atau di mana `users` dimasukkan ke dalam `d`),
tanggalkan medan `pass` sebelum dipulangkan kepada klien.

**AMARAN PENTING.** Selepas `pass` tidak lagi sampai ke klien, klien akan
menghantar balik rekod pengguna tanpa `pass`. Jika `writeEntity('users', …)`
menulis nilai kosong itu ke Sheet, **semua kata sandi akan terpadam**.
Jadi dalam `writeEntity`, khusus untuk `users`, kekalkan nilai lama apabila
nilai masuk kosong:

    // dalam writeEntity, sebelum menulis baris users:
    if (ent === 'users') {
      var lama = {};
      readEntity('users').forEach(function (u) { lama[u.id] = u.pass; });
      records.forEach(function (r) { if (!r.pass && lama[r.id]) r.pass = lama[r.id]; });
    }

Uji langkah ini pada salinan Sheet dahulu, bukan pada data sebenar.

### 2.4 Tukar `rwLogin()` di klien

Ganti perbandingan tempatan:

    const u=(D.users||[]).find(x=>x.uid.toLowerCase()===id.toLowerCase()&&x.pass===p);

dengan panggilan ke endpoint:

    const r = await fetch(API.url + '?action=login&uid=' + encodeURIComponent(id)
                          + '&pass=' + encodeURIComponent(p));
    const j = await r.json();
    if (!j.ok) return alert(T('a_rw_fail'));
    const u = j.user;

Ingat menjadikan `rwLogin` sebagai `async function`.

---

## Had yang perlu diketahui

**Had ~4.5MB proksi.** Fungsi serverless Vercel menerima maksimum ~4.5MB
setiap permintaan. `pushToServer()` menghantar keseluruhan set data, dan
lampiran Reports dihantar sebagai base64 yang membengkak ~33%. Kalau sync
mula gagal selepas Fasa 1 sedangkan ia berfungsi sebelum ini, periksa
puncanya di sini dahulu, bukan pada token. Penyelesaiannya: hantar fail
besar secara berasingan daripada snapshot data, bukan sekali gus.

**`api/sr.js` sengaja CommonJS.** Repo ini tiada `package.json`, jadi Vercel
memuatkan `api/*.js` sebagai CommonJS. Jangan tukar `module.exports` kepada
`export default` tanpa menambah `package.json` dengan `"type":"module"` —
fungsi itu akan gagal dimuatkan.

**Empat salinan HTML.** Fail app yang sama ada di empat laluan dalam repo:

    index.html                      <- dihidangkan Vercel (yang kakitangan guna)
    docs/apps-script/Index.html     <- dihidangkan Apps Script doGet()
    docs/vercel/index.html          <- salinan berlebihan
    SR-Group-Safety-System.html     <- salinan berlebihan

Setiap suntingan klien di atas mesti dibuat pada `index.html` sekurang-
kurangnya. Dua salinan berlebihan itu elok dipadam supaya tiada versi lama
tertinggal untuk mengelirukan sesiapa kemudian. `docs/apps-script/Index.html`
perlu dikekalkan hanya jika anda masih mahu app itu boleh dibuka terus
melalui URL Apps Script — kalau tidak, buang juga dan biarkan `doGet` tanpa
`action` memulangkan ralat ringkas.
