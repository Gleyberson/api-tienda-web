const { spawn } = require('child_process');
const http = require('http');

const PORT = 8080;
const BASE = `http://localhost:${PORT}`;

const child = spawn(process.execPath, ['app.js'], { stdio: ['ignore', 'pipe', 'pipe'] });

let started = false;
child.stdout.on('data', (d) => {
  const msg = d.toString();
  process.stdout.write(msg);
  if (msg.includes('Server running')) started = true;
});
child.stderr.on('data', (d) => process.stderr.write(d.toString()));

function shutdown(code = 0) {
  if (process.platform === 'win32') {
    const { exec } = require('child_process');
    exec(`taskkill /PID ${child.pid} /T /F`, () => process.exit(code));
  } else {
    child.kill('SIGTERM');
    process.exit(code);
  }
}

function req(method, path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const body = data ? JSON.stringify(data) : null;
    const r = http.request(url, { method, headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {} }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
        catch { resolve({ status: res.statusCode, body: text }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

(async () => {
  setTimeout(async () => {
    if (!started) {
      console.error('Server did not start in time');
      return shutdown(1);
    }
    try {
      // Ensure there is at least one product (id 1 assumed present in products.json)
      const cart = await req('POST', '/api/carts');
      console.log('\nPOST /api/carts ->', cart.status, cart.body);
      const cid = cart.body && cart.body.id;

      const add1 = await req('POST', `/api/carts/${cid}/product/1`);
      console.log('\nPOST /api/carts/:cid/product/1 ->', add1.status, add1.body);

      const add2 = await req('POST', `/api/carts/${cid}/product/1`);
      console.log('\nPOST again (increment) ->', add2.status, add2.body);

      const list = await req('GET', `/api/carts/${cid}`);
      console.log('\nGET /api/carts/:cid ->', list.status, list.body);

      shutdown(0);
    } catch (e) {
      console.error('Cart smoke failed:', e.message);
      shutdown(1);
    }
  }, 800);
})();
