/**
 * Local RPC proxy server
 * Forwards JSON-RPC requests to BSC testnet through the HTTP proxy.
 *
 * Usage: node scripts/local-rpc-proxy.js
 * Then set BSC_TESTNET_RPC=http://127.0.0.1:8546 in .env
 */
const http = require('http');
const HttpsProxyAgent = require('https-proxy-agent');
const https = require('https');

const PROXY = process.env.HTTP_PROXY || 'http://127.0.0.1:59527';
const TARGET = 'https://bsc-testnet.bnbchain.org';
const PORT = 8546;

const agent = new HttpsProxyAgent(PROXY);

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const url = new URL(TARGET);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      agent: agent,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (e) => {
      console.error('Proxy error:', e.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: e.message }));
    });
    proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`RPC proxy listening on http://127.0.0.1:${PORT}`);
  console.log(`Forwarding to ${TARGET} via ${PROXY}`);
});
