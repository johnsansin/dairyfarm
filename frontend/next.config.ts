import type { NextConfig } from 'next';
const isDevelopment = process.env.NODE_ENV === 'development';const contentSecurityPolicy = [  "default-src 'self'",  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",  "font-src 'self' https://fonts.gstatic.com data:",  "img-src 'self' data: blob:",  `connect-src 'self'${isDevelopment ? ' ws: wss:' : ''}`,  "object-src 'none'",  "base-uri 'self'",  "form-action 'self'",  "frame-ancestors 'none'",  "frame-src 'none'",  "manifest-src 'self'",  "worker-src 'self' blob:",].join('; ');
const config: NextConfig = {
  allowedDevOrigins: ['192.168.2.213'],
  async rewrites() { return [{ source: '/api/:path*', destination: `${process.env.API_URL || 'http://127.0.0.1:4000'}/api/:path*` }]; },
  async headers() { return [{ source: '/(.*)', headers: [{ key: 'Content-Security-Policy', value: contentSecurityPolicy }] }]; },
};
export default config;
