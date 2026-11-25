/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self' http://localhost:8000; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' http://localhost:8000 http: data: https: blob:; media-src 'self' http://localhost:8000 http: blob: data:; connect-src 'self' http://localhost:8000 http: https://accounts.google.com https://www.googleapis.com;",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' }];
  },
};
module.exports = nextConfig;
