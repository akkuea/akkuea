import app from './src';

const port = process.env.PORT || 3001;
app.listen(port);

// eslint-disable-next-line no-console
console.log(`🚀 Real Estate DeFi API is running on port ${port}`);
// eslint-disable-next-line no-console
console.log(`📚 Swagger docs available at http://localhost:${port}/swagger`);

