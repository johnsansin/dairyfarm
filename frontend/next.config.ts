import type { NextConfig } from 'next';
const config: NextConfig = {
  allowedDevOrigins: ['192.168.2.213'],
  async redirects() { return [{ source: '/', destination: '/dashboard', permanent: false }]; },
  async rewrites() { return [{ source: '/api/:path*', destination: `${process.env.API_URL || 'http://127.0.0.1:4000'}/api/:path*` }]; },
};
export default config;
