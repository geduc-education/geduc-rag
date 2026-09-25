import 'reflect-metadata';
import { validateEnv } from '../env.validation';

const BASE = {
  DATABASE_URL: 'mysql://u:p@localhost:3306/db',
  JWT_SECRET: 'segredo',
};

describe('validateEnv', () => {
  it('aplica os defaults do RAG já convertidos em número/boolean', () => {
    const config = validateEnv({ ...BASE });
    expect(config.CHUNK_SIZE).toBe(800);
    expect(config.RETRIEVAL_TOP_K).toBe(5);
    expect(config.RERANK_ENABLED).toBe(false);
  });

  it('converte valores vindos do .env (texto)', () => {
    const config = validateEnv({
      ...BASE,
      CHUNK_SIZE: '1000',
      RERANK_ENABLED: 'true',
    });
    expect(config.CHUNK_SIZE).toBe(1000);
    expect(config.RERANK_ENABLED).toBe(true);
  });

  it('falha sem DATABASE_URL/JWT_SECRET', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET/);
  });

  it('exige JWT_SECRET ≥ 32 chars em produção', () => {
    expect(() => validateEnv({ ...BASE, NODE_ENV: 'production' })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('recusa overlap maior ou igual ao chunk', () => {
    expect(() =>
      validateEnv({ ...BASE, CHUNK_SIZE: '100', CHUNK_OVERLAP: '100' }),
    ).toThrow(/CHUNK_OVERLAP/);
  });
});
