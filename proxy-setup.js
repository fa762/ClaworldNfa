// Inject HTTP proxy into Node.js http/https modules
const { HttpsProxyAgent } = require('https-proxy-agent');
const https = require('https');
const http = require('http');

const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || 'http://127.0.0.1:59527';
const agent = new HttpsProxyAgent(proxyUrl);

// Monkey-patch https.request to use proxy
const origRequest = https.request;
https.request = function(options, callback) {
  if (typeof options === 'string') {
    options = new URL(options);
  }
  if (!options.agent) {
    options.agent = agent;
  }
  return origRequest.call(this, options, callback);
};

console.log(`[proxy] Using HTTP proxy: ${proxyUrl}`);
