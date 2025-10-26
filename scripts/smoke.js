const { spawn } = require('child_process');
const http = require('http');

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

setTimeout(() => {
  if (!started) {
    console.error('Server did not start in time');
    return shutdown(1);
  }
  http.get('http://localhost:8080/products', (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      console.log('\nGET /products ->', body);
      shutdown(0);
    });
  }).on('error', (err) => {
    console.error('Request failed:', err.message);
    shutdown(1);
  });
}, 800);
