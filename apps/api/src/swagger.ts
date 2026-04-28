import { swagger } from '@elysiajs/swagger';

export const swaggerPlugin = swagger({
  path: process.env.NODE_ENV !== 'production' ? '/docs' : undefined,
  documentation: {
    info: {
      title: 'Real Estate DeFi API',
      version: '1.0.0',
    },
  },
  excludeStaticFile: false,
});
