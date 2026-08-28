/**
 * SR Group Safety System — Backend Pusat (Google Apps Script + Sheets + Drive)
 * Lihat docs/apps-script/SETUP-PUSAT.md untuk cara deploy.
 *
 * Satu Web App, dua endpoint:
 *   GET  ?action=ping&token=X   -> {ok:true,time}          (test sambungan)
 *   POST {token, d:{...D...}}  -> {ok:true, d:{...D gabungan...}}
 *
 * POST sekali gus buat kerja push DAN pull: klien hantar snapshot D tempatan,
 * server gabung dengan D sedia ada dalam Sheet, upload fail base64 baru ke
 * Drive, simpan hasil gabungan, dan pulangkan D gabungan penuh kepada klien.
 */

var SHEET_NAMES = {
  manhours: 'Manhours', reports: 'Reports', inspections: 'Inspections',
  programs: 'Programs', users: 'Users', rewards: 'Rewards', attendance: 'Attendance'
};
var COLS = {
  manhours:    ['id','bulan','site','pekerja','jam','lti','pic','remark','hari','updatedAt'],
  reports:     ['id','bulan','site','pic','fname','fsize','driveFileId','driveUrl','tarikh','updatedAt'],
  programs:    ['id','nama','jenis','tarikh','site','pic','status','detail','updatedAt'],
  users:       ['id','uid','nama','pass','kats','updatedAt'],
  inspections: ['id','jenis','tarikh','co','branch','scope','lok','site','auditor','pic','findings','good','tot','dataJson','pdfFileId','pdfUrl','updatedAt'],
  rewards:     ['id','kat','nama','site','bulan','by','tot','scoresJson','tarikh','updatedAt','ynJson'],
  attendance:  ['id','kategori','bulan','tarikh','lokasi','nama','branch','updatedAt']
};
var ENTITIES = Object.keys(SHEET_NAMES);

/* ===== HTTP entry points ===== */
function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = params.action;
  // Tiada ?action= — buka terus dalam browser: papar sistem HTML penuh.
  if (!action) {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('SR Group Safety System')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  var token = getToken();
  if (action === 'ping') {
    if (!token || params.token !== token) return jsonOut({ ok: false, error: 'invalid token' });
    return jsonOut({ ok: true, time: Date.now() });
  }
  if (action === 'getfile') {
    // Relay baca fail Drive kembali ke klien (base64) — perlu sebab fetch() terus ke
    // drive.google.com daripada JS klien disekat CORS. Digunakan oleh ciri "Cantumkan PDF"
    // Site Visit untuk ambil PDF report yang dah disync (pdfData tempatan dah dibuang).
    if (!token || params.token !== token) return jsonOut({ ok: false, error: 'invalid token' });
    if (!params.id) return jsonOut({ ok: false, error: 'missing id' });
    try {
      var file = DriveApp.getFileById(params.id);
      var mime = file.getMimeType();
      var b64 = Utilities.base64Encode(file.getBlob().getBytes());
      return jsonOut({ ok: true, data: 'data:' + mime + ';base64,' + b64 });
    } catch (err) {
      return jsonOut({ ok: false, error: String(err) });
    }
  }
  return jsonOut({ ok: false, error: 'unknown action' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var body = JSON.parse(e.postData.contents);
    var token = getToken();
    if (!token || body.token !== token) return jsonOut({ ok: false, error: 'invalid token' });

    var incoming = body.d || {};
    resolveFiles(incoming);              // upload sebarang base64 baru ke Drive, strip raw data
    var serverD = readServerD();
    var merged = mergeD(serverD, incoming);
    writeServerD(merged);
    return jsonOut({ ok: true, d: merged });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function getToken() {
  return PropertiesService.getScriptProperties().getProperty('TOKEN');
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ===== Merge (sama logik dengan mergeD() sisi klien) ===== */
function mergeD(a, b) {
  a = a || {}; b = b || {};
  var out = {};
  var aSU = Number(a.settingsUpdatedAt) || 0, bSU = Number(b.settingsUpdatedAt) || 0;
  var newer = bSU >= aSU ? b : a;
  out.settingsUpdatedAt = Math.max(aSU, bSU);
  out.sites = newer.sites || a.sites || b.sites || ['OTN Next DC', 'OSBN'];
  out.target = newer.target || a.target || b.target || 1200000;
  out.pass = newer.pass || a.pass || b.pass || 'sradmin';
  out.siteTargets = newer.siteTargets || a.siteTargets || b.siteTargets || {};

  var tsMap = {};
  (a.tombstones || []).concat(b.tombstones || []).forEach(function (t) {
    var k = t.ent + ':' + t.id;
    if (!tsMap[k] || tsMap[k].ts < t.ts) tsMap[k] = t;
  });
  out.tombstones = Object.keys(tsMap).map(function (k) { return tsMap[k]; });

  function isDeleted(ent, id) {
    return out.tombstones.some(function (t) { return t.ent === ent && String(t.id) === String(id); });
  }
  function isResolved(ent, r) {
    if (ent === 'reports') return !!r.driveFileId;
    if (ent === 'inspections') return !!r.pdfFileId;
    if (ent === 'manhours') return !!(r.pic && String(r.pic).trim());
    return true;
  }
  ENTITIES.forEach(function (ent) {
    var map = {};
    (a[ent] || []).concat(b[ent] || []).forEach(function (r) {
      var ex = map[r.id];
      if (!ex) { map[r.id] = r; return; }
      var rT = Number(r.updatedAt) || 0, exT = Number(ex.updatedAt) || 0;
      if (rT > exT) map[r.id] = r;
      else if (rT === exT && isResolved(ent, r) && !isResolved(ent, ex)) map[r.id] = r;
    });
    out[ent] = Object.keys(map).map(function (k) { return map[k]; })
      .filter(function (r) { return !isDeleted(ent, r.id); });
  });
  return out;
}

/* ===== Fail: upload base64 baru ke Drive, gantikan dengan link =====
 * Nota: foto mentah Site Visit (field 'ph') SENGAJA tak pernah sampai sini —
 * klien strip 'ph' sebelum hantar (sebab dah dibenam terus ke dalam SATU PDF
 * gabungan borang+gambar, dijana sisi klien dan dihantar sebagai r.pdfData). */
function resolveFiles(d) {
  var root = getOrCreateFolder('SR Safety Files', null);
  var repFolder = getOrCreateFolder('Reports', root);
  (d.reports || []).forEach(function (r) {
    if (r.data && typeof r.data === 'string' && r.data.indexOf('data:') === 0 && !r.driveFileId) {
      var up = uploadBase64(r.data, r.fname || ('report_' + r.id + '.pdf'), repFolder);
      r.driveFileId = up.id; r.driveUrl = up.url;
    }
    delete r.data; // jangan simpan base64 mentah di server
  });
  var svFolder = getOrCreateFolder('SiteVisit', root);
  (d.inspections || []).forEach(function (r) {
    if (r.pdfData && typeof r.pdfData === 'string' && r.pdfData.indexOf('data:') === 0 && !r.pdfFileId) {
      var fname = 'SiteVisit_' + (r.site || '') + '_' + (r.tarikh || r.id) + '.pdf';
      var up = uploadBase64(r.pdfData, fname, svFolder);
      r.pdfFileId = up.id; r.pdfUrl = up.url;
    }
    delete r.pdfData; // jangan simpan base64 mentah di server
  });
}

function getOrCreateFolder(name, parent) {
  var iter = parent ? parent.getFoldersByName(name) : DriveApp.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parent ? parent.createFolder(name) : DriveApp.createFolder(name);
}

function uploadBase64(dataUrl, filename, folder) {
  var m = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  var mime = m ? m[1] : 'application/octet-stream';
  var b64 = m ? m[2] : dataUrl;
  var bytes = Utilities.base64Decode(b64);
  var blob = Utilities.newBlob(bytes, mime, filename);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { id: file.getId(), url: file.getUrl() };
}

/* ===== Baca/tulis Sheet ===== */
function getSS() {
  // Jika Script Property SHEET_ID ditetapkan, guna Sheet itu secara eksplisit
  // (perlu untuk projek Apps Script standalone / dibuka terus dari Drive).
  // Jika tidak, cuba guna Sheet yang "mengandungi" script ini (bound script).
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Tiada Google Sheet dikesan. Sila tambah Script Property "SHEET_ID" ' +
      '(Project Settings > Script Properties) dengan ID Sheet anda — lihat SETUP-PUSAT.md.');
  }
  return ss;
}
function getSheetFor(name) {
  var ss = getSS();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}
function ensureHeaders(sh, cols) {
  // Sentiasa tulis baris tajuk (bukan hanya bila kosong) supaya lajur baru
  // yang ditambah kemudian (schema berubah) tak jadi "yatim" tanpa tajuk.
  sh.getRange(1, 1, 1, cols.length).setValues([cols]);
}

function readEntity(ent) {
  var cols = COLS[ent];
  var sh = getSheetFor(SHEET_NAMES[ent]);
  ensureHeaders(sh, cols);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var vals = sh.getRange(2, 1, lastRow - 1, cols.length).getValues();
  return vals.map(function (row) {
    var o = {};
    cols.forEach(function (c, i) { o[c] = row[i]; });
    if (ent === 'users') o.kats = o.kats ? String(o.kats).split(',').filter(Boolean) : [];
    if (ent === 'inspections') { o.data = o.dataJson ? JSON.parse(o.dataJson) : []; delete o.dataJson; o.good = Number(o.good) || 0; o.tot = Number(o.tot) || 0; }
    if (ent === 'rewards') { o.scores = o.scoresJson ? JSON.parse(o.scoresJson) : []; delete o.scoresJson; o.yn = o.ynJson ? JSON.parse(o.ynJson) : []; delete o.ynJson; o.tot = Number(o.tot) || 0; }
    if (ent === 'manhours') { o.pekerja = Number(o.pekerja) || 0; o.hari = Number(o.hari) || 0; o.jam = Number(o.jam) || 0; o.lti = Number(o.lti) || 0; }
    if (ent === 'reports') { o.fsize = Number(o.fsize) || 0; }
    o.updatedAt = Number(o.updatedAt) || 0;
    o.id = String(o.id);
    return o;
  }).filter(function (o) { return o.id; });
}

function writeEntity(ent, records) {
  var cols = COLS[ent];
  var sh = getSheetFor(SHEET_NAMES[ent]);
  ensureHeaders(sh, cols);
  var lastRow = sh.getLastRow();
  if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, cols.length).clearContent();
  if (!records.length) return;
  // Format teks supaya id (nombor panjang) tak ditukar jadi float/scientific notation oleh Sheets.
  sh.getRange(2, 1, records.length, cols.length).setNumberFormat('@');
  var rows = records.map(function (r) {
    return cols.map(function (c) {
      if (ent === 'users' && c === 'kats') return (r.kats || []).join(',');
      if (ent === 'inspections' && c === 'dataJson') return JSON.stringify(r.data || []);
      if (ent === 'rewards' && c === 'scoresJson') return JSON.stringify(r.scores || []);
      if (ent === 'rewards' && c === 'ynJson') return JSON.stringify(r.yn || []);
      return r[c] !== undefined && r[c] !== null ? r[c] : '';
    });
  });
  sh.getRange(2, 1, rows.length, cols.length).setValues(rows);
}

function readSettings() {
  var cols = ['sites', 'target', 'pass', 'siteTargets', 'settingsUpdatedAt'];
  var sh = getSheetFor('Settings');
  ensureHeaders(sh, cols);
  if (sh.getLastRow() < 2) return { sites: ['OTN Next DC', 'OSBN'], target: 1200000, pass: 'sradmin', siteTargets: {}, settingsUpdatedAt: 0 };
  var row = sh.getRange(2, 1, 1, cols.length).getValues()[0];
  return {
    sites: row[0] ? JSON.parse(row[0]) : ['OTN Next DC', 'OSBN'],
    target: Number(row[1]) || 1200000,
    pass: row[2] || 'sradmin',
    siteTargets: row[3] ? JSON.parse(row[3]) : {},
    settingsUpdatedAt: Number(row[4]) || 0
  };
}
function writeSettings(s) {
  var cols = ['sites', 'target', 'pass', 'siteTargets', 'settingsUpdatedAt'];
  var sh = getSheetFor('Settings');
  ensureHeaders(sh, cols);
  if (sh.getLastRow() < 2) sh.appendRow(['', '', '', '', '']);
  sh.getRange(2, 1, 1, cols.length).setNumberFormat('@');
  sh.getRange(2, 1, 1, cols.length).setValues([[JSON.stringify(s.sites || []), s.target || 1200000, s.pass || 'sradmin', JSON.stringify(s.siteTargets || {}), s.settingsUpdatedAt || 0]]);
}

function readTombstones() {
  var cols = ['ent', 'id', 'ts'];
  var sh = getSheetFor('Tombstones');
  ensureHeaders(sh, cols);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  return sh.getRange(2, 1, lastRow - 1, cols.length).getValues()
    .map(function (row) { return { ent: row[0], id: String(row[1]), ts: Number(row[2]) || 0 }; })
    .filter(function (t) { return t.ent && t.id; });
}
function writeTombstones(list) {
  var cols = ['ent', 'id', 'ts'];
  var sh = getSheetFor('Tombstones');
  ensureHeaders(sh, cols);
  var lastRow = sh.getLastRow();
  if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, cols.length).clearContent();
  if (!list.length) return;
  sh.getRange(2, 1, list.length, cols.length).setNumberFormat('@');
  sh.getRange(2, 1, list.length, cols.length).setValues(list.map(function (t) { return [t.ent, t.id, t.ts]; }));
}

function readServerD() {
  var s = readSettings();
  var d = { sites: s.sites, target: s.target, pass: s.pass, siteTargets: s.siteTargets, settingsUpdatedAt: s.settingsUpdatedAt, tombstones: readTombstones() };
  ENTITIES.forEach(function (ent) { d[ent] = readEntity(ent); });
  return d;
}
function writeServerD(d) {
  writeSettings({ sites: d.sites, target: d.target, pass: d.pass, siteTargets: d.siteTargets, settingsUpdatedAt: d.settingsUpdatedAt });
  ENTITIES.forEach(function (ent) { writeEntity(ent, d[ent] || []); });
  writeTombstones(d.tombstones || []);
}

/* ===== UTILITI SEKALI-GUNA (bukan dipanggil oleh doGet/doPost) =====
 * Buang fail "yatim" dalam folder Drive Reports — fail yang tak dirujuk oleh
 * mana-mana driveFileId dalam tab Reports (terhasil drpd bug lama, sebelum
 * pembetulan mergeD, yang upload semula PDF sama setiap kali sync).
 * Cara guna: buka Apps Script, pilih fungsi ini dari dropdown sebelah "Run",
 * klik Run, benarkan kebenaran jika diminta, semak Execution log utk bilangan
 * dipadam. Fail dibuang ke Trash (bukan padam kekal) — boleh pulih 30 hari. */
function cleanupDuplicateReportFiles() {
  var valid = {};
  readEntity('reports').forEach(function (r) { if (r.driveFileId) valid[r.driveFileId] = true; });
  var root = getOrCreateFolder('SR Safety Files', null);
  var repFolder = getOrCreateFolder('Reports', root);
  var files = repFolder.getFiles();
  var deleted = 0, kept = 0;
  while (files.hasNext()) {
    var f = files.next();
    if (valid[f.getId()]) { kept++; continue; }
    f.setTrashed(true);
    deleted++;
  }
  Logger.log('Selesai. Fail dikekalkan: ' + kept + '. Fail yatim dibuang ke Trash: ' + deleted + '.');
}

/* Betulkan tab Manhours yang "tergeser" satu lajur — punca: versi awal COLS.manhours
 * pernah letak 'hari' di TENGAH (antara pekerja & jam) bukan di hujung. Baris sedia ada
 * tak bergerak ikut lajur baharu (cuma header berubah), jadi data lama jam/lti/pic/remark/
 * updatedAt semuanya "tersasar" satu lajur ke kanan, dilabel salah sebagai hari/jam/lti/
 * pic/remark. Fungsi ini baca semula lajur MENTAH ikut kedudukan fizikal (A-J, ikut bentuk
 * rosak semasa) dan tulis semula ikut skema betul (hari di hujung, nilai 0 sebab tiada
 * data sejarah hari — sama macam rekod baharu yang belum diisi). JALANKAN SEKALI SAHAJA,
 * selepas COLS.manhours dikemaskini (hari di hujung). Cara guna: Apps Script → pilih
 * fungsi ini dari dropdown sebelah "Run" → Run → semak Execution log.
 * PENTING: sahkan beberapa baris (cth. bandingkan lajur "jam"/"remark" selepas jalan
 * dengan apa yang anda ingat sepatutnya) sebelum percaya sepenuhnya kepada hasil ini. */
function repairManhoursHariShift() {
  var sh = getSheetFor('Manhours');
  var lastRow = sh.getLastRow();
  if (lastRow < 2) { Logger.log('Tiada data untuk dibetulkan.'); return; }
  var vals = sh.getRange(2, 1, lastRow - 1, 10).getValues();
  var fixed = vals.map(function (row) {
    var id = row[0], bulan = row[1], site = row[2], pekerja = row[3];
    var trueJam = row[4], trueLti = row[5], truePic = row[6], trueRemark = row[7], trueUpdatedAt = row[8];
    return [id, bulan, site, pekerja, trueJam, trueLti, truePic, trueRemark, 0, trueUpdatedAt || Date.now()];
  });
  sh.getRange(1, 1, 1, 10).setValues([COLS.manhours]);
  sh.getRange(2, 1, fixed.length, 10).setNumberFormat('@');
  sh.getRange(2, 1, fixed.length, 10).setValues(fixed);
  Logger.log('Selesai. ' + fixed.length + ' baris Manhours dibetulkan. Lajur "hari" ditetapkan 0 (tiada data sejarah) — isi semula ikut keperluan melalui Edit di sistem.');
}
