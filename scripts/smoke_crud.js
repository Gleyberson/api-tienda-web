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

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const body = data ? JSON.stringify(data) : null;
    const req = http.request(
      url,
      {
        method,
        headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          try {
            resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null });
          } catch {
            resolve({ status: res.statusCode, body: text });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  setTimeout(async () => {
    if (!started) {
      console.error('Server did not start in time');
      return shutdown(1);
    }
    try {
      const sample = {
        title: 'Zapatos',
        description: 'Zapatos de cuero',
        code: 'ZAP-001',
        price: 1200,
        status: true,
        stock: 15,
        category: 'calzado',
        thumbnails: ['/imgs/zap1.png', '/imgs/zap2.png']
      };

      const created = await request('POST', '/products', sample);
      console.log('\nPOST /products ->', created.status, created.body);
      const id = created.body && created.body.id;

      const fetched = await request('GET', `/products/${id}`);
      console.log('\nGET /products/:id ->', fetched.status, fetched.body);

      const updated = await request('PUT', `/products/${id}`, { price: 1100, stock: 20 });
      console.log('\nPUT /products/:id ->', updated.status, updated.body);

      const removed = await request('DELETE', `/products/${id}`);
      console.log('\nDELETE /products/:id ->', removed.status);

      shutdown(0);
    } catch (e) {
      console.error('CRUD smoke failed:', e.message);
      shutdown(1);
    }
  }, 800);
})();
