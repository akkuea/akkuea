/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['avatars.githubusercontent.com', 'via.placeholder.com', 'react.semantic-ui.com'],
  },
  output: 'standalone',
  outputFileTracingRoot: '.',
};

export default nextConfig;
