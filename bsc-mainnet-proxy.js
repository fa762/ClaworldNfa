// Local proxy: listens on 8547, forwards to BSC mainnet via HTTP proxy
const http = require("http");
const { HttpsProxyAgent } = require("https-proxy-agent");
const https = require("https");

const PROXY = process.env.HTTP_PROXY || "http://127.0.0.1:59527";
const TARGET = "https://bsc-dataseed1.bnbchain.org";
const PORT = 8547;

const agent = new HttpsProxyAgent(PROXY);

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const url = new URL(TARGET);
    const opts = {
      hostname: url.hostname,
      port: 443,
      path: "/",
      method: "POST",
      agent: agent,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    };
    const proxy = https.request(opts, (upstream) => {
      res.writeHead(upstream.statusCode, upstream.headers);
      upstream.pipe(res);
    });
    proxy.on("error", (e) => {
      res.writeHead(502);
      res.end(JSON.stringify({ error: e.message }));
    });
    proxy.write(body);
    proxy.end();
  });
});

server.listen(PORT, () => console.log(`BSC Mainnet proxy on http://127.0.0.1:${PORT}`));
