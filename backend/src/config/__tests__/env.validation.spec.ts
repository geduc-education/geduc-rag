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

  it('aplica os defaults dos providers de embedding, LLM e storage', () => {
    const config = validateEnv({ ...BASE });
    expect(config.EMBEDDING_PROVIDER).toBe('mock');
    expect(config.EMBEDDING_MODEL).toBe('Xenova/multilingual-e5-small');
    expect(config.EMBEDDING_DIMENSIONS).toBe(384);
    expect(config.EMBEDDING_QUERY_PREFIX).toBe('query: ');
    expect(config.EMBEDDING_PASSAGE_PREFIX).toBe('passage: ');
    expect(config.EMBEDDING_CACHE_DIR).toBeUndefined();
    expect(config.LLM_PROVIDER).toBe('mock');
    expect(config.LLM_BASE_URL).toBe('http://localhost:11434');
    expect(config.LLM_MODEL).toBe('qwen2.5:7b');
    expect(config.LLM_TIMEOUT_MS).toBe(120000);
    expect(config.RAG_STORAGE).toBe('mysql');
    expect(config.DOCUMENT_MAX_UPLOAD_BYTES).toBe(10485760);
  });

  it('aceita LLM_PROVIDER=ollama, EMBEDDING_PROVIDER=local e RAG_STORAGE=memory', () => {
    const config = validateEnv({
      ...BASE,
      LLM_PROVIDER: 'ollama',
      EMBEDDING_PROVIDER: 'local',
      RAG_STORAGE: 'memory',
      LLM_TIMEOUT_MS: '30000',
      DOCUMENT_MAX_UPLOAD_BYTES: '2048',
    });
    expect(config.LLM_PROVIDER).toBe('ollama');
    expect(config.EMBEDDING_PROVIDER).toBe('local');
    expect(config.RAG_STORAGE).toBe('memory');
    expect(config.LLM_TIMEOUT_MS).toBe(30000);
    expect(config.DOCUMENT_MAX_UPLOAD_BYTES).toBe(2048);
  });

  it('rejeita LLM_PROVIDER=openai', () => {
    expect(() => validateEnv({ ...BASE, LLM_PROVIDER: 'openai' })).toThrow(
      /LLM_PROVIDER/,
    );
  });

  it('rejeita LLM_BASE_URL que não é URL', () => {
    expect(() => validateEnv({ ...BASE, LLM_BASE_URL: 'nao-e-url' })).toThrow(
      /LLM_BASE_URL/,
    );
  });
  it('aplica os defaults do changelog (GitHub) sem as envs', () => {
    const config = validateEnv({ ...BASE });
    expect(config.GITHUB_BASE_BRANCH).toBe('main');
    expect(config.GITHUB_TIMEOUT_MS).toBe(5000);
    expect(config.CHANGELOG_CACHE_TTL_SECONDS).toBe(600);
    expect(config.GITHUB_REPO).toBeUndefined();
    expect(config.GITHUB_TOKEN).toBeUndefined();
  });

  it('trata GITHUB_REPO e GITHUB_TOKEN vazios como não configurados', () => {
    const config = validateEnv({ ...BASE, GITHUB_REPO: '', GITHUB_TOKEN: '' });
    expect(config.GITHUB_REPO).toBeUndefined();
    expect(config.GITHUB_TOKEN).toBeUndefined();
  });

  it('aceita GITHUB_REPO no formato owner/nome e converte os números', () => {
    const config = validateEnv({
      ...BASE,
      GITHUB_REPO: 'genesis-tech/geduc-rag',
      GITHUB_TIMEOUT_MS: '3000',
      CHANGELOG_CACHE_TTL_SECONDS: '0',
    });
    expect(config.GITHUB_REPO).toBe('genesis-tech/geduc-rag');
    expect(config.GITHUB_TIMEOUT_MS).toBe(3000);
    expect(config.CHANGELOG_CACHE_TTL_SECONDS).toBe(0);
  });

  it('rejeita GITHUB_REPO sem barra', () => {
    expect(() => validateEnv({ ...BASE, GITHUB_REPO: 'sem-barra' })).toThrow(
      /GITHUB_REPO/,
    );
  });

  it('rejeita CHANGELOG_CACHE_TTL_SECONDS negativo', () => {
    expect(() =>
      validateEnv({ ...BASE, CHANGELOG_CACHE_TTL_SECONDS: '-1' }),
    ).toThrow(/CHANGELOG_CACHE_TTL_SECONDS/);
  });
});
