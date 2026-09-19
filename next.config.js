/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Если вы используете старые версии Next.js 14, это свойство может быть внутри experimental
  },
  allowedDevOrigins: ['172.20.10.2'],
};

module.exports = nextConfig;
