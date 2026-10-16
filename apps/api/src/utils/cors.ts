type CorsEnvironment = {
  NODE_ENV?: string;
  CORS_ALLOWED_ORIGINS?: string;
};

const DEVELOPMENT_ORIGINS = ['http://localhost:3000', 'http://localhost:3002'];

export function corsOptions(env: CorsEnvironment = process.env) {
  const origins = env.CORS_ALLOWED_ORIGINS;
  const allowedOrigins = origins === undefined
    ? env.NODE_ENV === 'development' ? DEVELOPMENT_ORIGINS : []
    : origins.split(',').map((origin) => origin.trim()).filter(Boolean);

  return { origin: allowedOrigins, credentials: true };
}
