import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['avatars.githubusercontent.com', 'via.placeholder.com', 'react.semantic-ui.com'],
    formats: ['image/webp'], //  modern formats
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1536], //  responsive widths
    imageSizes: [16, 24, 32, 48, 64, 96, 128], //  icons/small imgs
  },
};

export default withNextIntl(nextConfig);
