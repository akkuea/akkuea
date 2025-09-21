import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin()


/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['avatars.githubusercontent.com', 'via.placeholder.com', 'react.semantic-ui.com'],
  },
};

export default withNextIntl(nextConfig);
