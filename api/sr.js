/**
 * Proksi Apps Script — SR Group Safety System
 *
 * Tujuan: token TIDAK LAGI dihantar ke pelayar. Klien memanggil /api/sr,
 * fungsi ini yang menyimpan token dan meneruskan permintaan ke Apps Script.
 *
 * Environment variable di Vercel (Settings > Environment Variables),
 * tandakan Production + Preview + Development:
 *   SR_SCRIPT_URL = https://script.google.com/macros/s/XXXX/exec
 *   SR_TOKEN      = token yang sama seperti Script Property 'TOKEN'
 *
 * Nota: sengaja CommonJS. Repo ini tiada package.json, jadi runtime Node
 * Vercel memuatkan api/*.js sebagai CommonJS. Jangan tukar ke "export"
 * tanpa menambah package.json dengan "type":"module".
 */

var ACTION_DIBENARKAN = ['ping', 'getfile', 'login'];

function bacaRaw(req) {
  // Vercel biasanya sudah mengisi req.body. Kalau tidak, baca strim sendiri.
  if (typeof req.body === 'string') return Promise.resolve(req.body);
  if (req.body && typeof req.body === 'object') return Promise.resolve(JSON.stringify(req.body));
  return new Promise(function (resolve, reject) {
    var bahagian = [];
    req.on('data', function (c) { bahagian.push(c); });
    req.on('end', function () { resolve(Buffer.concat(bahagian).toString('utf8')); });
    req.on('error', reject);
  });
}

function hantarJson(res, status, teks) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(teks);
}

module.exports = async function handler(req, res) {
  var SCRIPT_URL = process.env.SR_SCRIPT_URL;
  var TOKEN = process.env.SR_TOKEN;

  if (!SCRIPT_URL || !TOKEN) {
    return hantarJson(res, 500, JSON.stringify({
      ok: false, error: 'Proksi belum dikonfigurasi: SR_SCRIPT_URL / SR_TOKEN tiada.'
    }));
  }

  try {
    if (req.method === 'GET') {
      var action = String((req.query && req.query.action) || '');
      if (ACTION_DIBENARKAN.indexOf(action) === -1) {
        return hantarJson(res, 400, JSON.stringify({ ok: false, error: 'action tidak dibenarkan' }));
      }
      var u = new URL(SCRIPT_URL);
      u.searchParams.set('action', action);
      u.searchParams.set('token', TOKEN);                 // token disuntik di sini
      ['id', 'uid', 'pass'].forEach(function (k) {
        if (req.query && req.query[k] != null) u.searchParams.set(k, String(req.query[k]));
      });

      var rg = await fetch(u.toString(), { redirect: 'follow' });
      return hantarJson(res, rg.status, await rg.text());
    }

    if (req.method === 'POST') {
      var raw = await bacaRaw(req);
      var body;
      try {
        body = JSON.parse(raw || '{}');
      } catch (e) {
        return hantarJson(res, 400, JSON.stringify({ ok: false, error: 'JSON tidak sah' }));
      }
      body.token = TOKEN;                                  // token disuntik di sini

      var rp = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow'
      });
      return hantarJson(res, rp.status, await rp.text());
    }

    res.setHeader('Allow', 'GET, POST');
    return hantarJson(res, 405, JSON.stringify({ ok: false, error: 'Method tidak dibenarkan' }));
  } catch (e) {
    return hantarJson(res, 502, JSON.stringify({ ok: false, error: (e && e.message) || 'Ralat proksi' }));
  }
};
