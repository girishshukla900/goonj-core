// Posts membership revenue to the payments service using node:http (no deps).
import http from 'node:http';

export function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } },
      (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: out ? JSON.parse(out) : null }); }
          catch { resolve({ status: res.statusCode, body: out }); }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
