// Roda ANTES do import do AppModule (Jest `setupFiles`): o ConfigModule lê o
// ambiente no import de app.module.ts — `process.env` no topo do spec é tarde.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
process.env.JWT_SECRET = 'e2e-secret';
process.env.LOG_LEVEL = 'error';
