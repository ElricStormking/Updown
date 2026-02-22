import http from 'node:http';
import httpProxy from 'http-proxy';

const gatewayPort = Number(process.env.GATEWAY_PORT ?? 4000);
const gameTarget = process.env.GAME_SERVER_URL ?? 'http://localhost:4001';
const adminTarget = process.env.ADMIN_SERVER_URL ?? 'http://localhost:4002';
const merchantTarget = process.env.MERCHANT_SERVER_URL ?? 'http://localhost:4003';

const gameProxy = httpProxy.createProxyServer({
  target: gameTarget,
  changeOrigin: true,
  ws: true,
  xfwd: true,
  timeout: 30000,
  proxyTimeout: 30000,
});

const adminProxy = httpProxy.createProxyServer({
  target: adminTarget,
  changeOrigin: true,
  ws: true,
  xfwd: true,
  timeout: 30000,
  proxyTimeout: 30000,
});

const merchantProxy = httpProxy.createProxyServer({
  target: merchantTarget,
  changeOrigin: true,
  ws: true,
  xfwd: true,
  timeout: 10000,
  proxyTimeout: 10000,
});

const proxies = [gameProxy, adminProxy, merchantProxy];

const getPathname = (url = '/') => {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return '/';
  }
};

const selectProxy = (url = '/') => {
  const pathname = getPathname(url);
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return { proxy: adminProxy, name: 'admin', target: adminTarget };
  }
  if (pathname === '/integration' || pathname.startsWith('/integration/')) {
    return { proxy: merchantProxy, name: 'merchant', target: merchantTarget };
  }
  return { proxy: gameProxy, name: 'game', target: gameTarget };
};

proxies.forEach((proxy) => {
  proxy.on('error', (error, req, res) => {
    const method = req?.method ?? 'GET';
    const url = req?.url ?? '/';
    console.error(`[gateway] proxy error ${method} ${url}: ${error.message}`);
    if (res && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
    }
    if (res) {
      res.end(
        JSON.stringify({
          error: 'bad_gateway',
          message: 'Upstream service unavailable',
        }),
      );
    }
  });
});

const server = http.createServer((req, res) => {
  const { proxy, name, target } = selectProxy(req.url);
  console.log(`[gateway] ${req.method} ${req.url} -> ${name} (${target})`);
  proxy.web(req, res);
});

server.on('upgrade', (req, socket, head) => {
  const { proxy, name, target } = selectProxy(req.url);
  console.log(`[gateway] WS ${req.url} -> ${name} (${target})`);
  proxy.ws(req, socket, head);
});

server.listen(gatewayPort, () => {
  console.log(`[gateway] listening on http://localhost:${gatewayPort}`);
  console.log(`[gateway] /admin* -> ${adminTarget}`);
  console.log(`[gateway] /integration/* -> ${merchantTarget}`);
  console.log(`[gateway] all other paths -> ${gameTarget}`);
});
