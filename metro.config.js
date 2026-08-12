const { getDefaultConfig } = require('expo/metro-config');
const { createProxyMiddleware } = require('http-proxy-middleware');

const config = getDefaultConfig(__dirname);

const API_TARGET =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ||
  'https://guardianangelapp-nnw.pages.dev';

config.server.enhanceMiddleware = (middleware) => {
  const proxy = createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    secure: true,
    onProxyReq: (proxyReq, req) => {
      const authorization = req.headers.authorization;
      if (authorization) {
        proxyReq.setHeader('Authorization', authorization);
      }
    },
  });

  return (req, res, next) => {
    const url = req.url?.split('?')[0] ?? '';
    if (url.startsWith('/api/')) {
      return proxy(req, res, next);
    }
    return middleware(req, res, next);
  };
};

module.exports = config;
