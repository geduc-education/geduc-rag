import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Validação das variáveis de ambiente carregadas pelo `ConfigModule` (mesmo
 * padrão do geduc-suporte): falhar rápido no boot quando algo crítico está
 * ausente, em vez de descobrir na primeira request. Todas as envs ficam aqui.
 *
 * As envs do pipeline de RAG (herdadas do rag-api) são tipadas e têm default:
 * os providers dos módulos leem `config.get<number>(...)` direto, então o
 * valor precisa chegar convertido.
 */
export class EnvironmentVariables {
  // --- Banco / app --------------------------------------------------------
  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsOptional()
  @IsString()
  PORT?: string;

  // Teto do pool do driver `mariadb` por instância (PrismaMariaDb). Inteiro ≥ 1.
  @IsOptional()
  @Matches(/^[1-9]\d*$/, {
    message: 'DB_POOL_MAX deve ser um inteiro maior ou igual a 1',
  })
  DB_POOL_MAX?: string;

  // --- JWT (segredo próprio da plataforma) --------------------------------
  // Piso de 32 chars exigido só em produção (checado em `validateEnv`).
  @IsString()
  @MinLength(1, { message: 'JWT_SECRET é obrigatório' })
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRATION_TIME?: string;

  // --- HTTP hardening -----------------------------------------------------
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @IsOptional()
  @IsBooleanString()
  TRUST_PROXY?: string;

  // --- Observabilidade ----------------------------------------------------
  @IsOptional()
  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
  LOG_LEVEL?: string;

  // --- Rate limit do chat (protege custo de LLM, não só infra) ------------
  @Type(() => Number)
  @IsInt()
  @Min(1)
  RAG_QUERY_THROTTLE_TTL: number = 60;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  RAG_QUERY_THROTTLE_LIMIT: number = 10;

  // --- Embedding provider (mock enquanto não há provider real) ------------
  @IsIn(['mock'])
  EMBEDDING_PROVIDER: string = 'mock';

  @IsOptional()
  @IsString()
  EMBEDDING_API_KEY?: string;

  @IsString()
  EMBEDDING_MODEL: string = 'text-embedding-3-small';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  EMBEDDING_DIMENSIONS: number = 1536;

  // --- LLM provider (mock enquanto não há provider real) ------------------
  @IsIn(['mock'])
  LLM_PROVIDER: string = 'mock';

  @IsOptional()
  @IsString()
  LLM_API_KEY?: string;

  @IsOptional()
  @IsString()
  LLM_MODEL?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  LLM_MAX_OUTPUT_TOKENS: number = 1024;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  LLM_CONTEXT_WINDOW_TOKENS: number = 8192;

  // --- Ingestão -----------------------------------------------------------
  @Type(() => Number)
  @IsInt()
  @Min(1)
  CHUNK_SIZE: number = 800;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  CHUNK_OVERLAP: number = 100;

  // --- Consulta -----------------------------------------------------------
  @Type(() => Number)
  @IsInt()
  @Min(1)
  RETRIEVAL_TOP_K: number = 5;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  RERANK_ENABLED: boolean = false;
}

/**
 * Regras que dependem de mais de uma env (não expressáveis por decorator).
 */
function crossFieldIssues(config: EnvironmentVariables): string[] {
  const issues: string[] = [];
  if (config.NODE_ENV === 'production' && config.JWT_SECRET.length < 32) {
    issues.push(
      '  - JWT_SECRET: deve ter pelo menos 32 caracteres em produção',
    );
  }
  if (config.CHUNK_OVERLAP >= config.CHUNK_SIZE) {
    issues.push('  - CHUNK_OVERLAP: deve ser menor que CHUNK_SIZE');
  }
  return issues;
}

/**
 * Função usada como `validate` no `ConfigModule.forRoot`. Lança erro
 * detalhado caso alguma env obrigatória esteja ausente/inválida.
 */
export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  const formatted = errors
    .map(
      (e) =>
        `  - ${e.property}: ${Object.values(e.constraints ?? {}).join('; ')}`,
    )
    .join('\n');
  const allErrors = [
    formatted,
    ...(errors.length === 0 ? crossFieldIssues(validatedConfig) : []),
  ]
    .filter(Boolean)
    .join('\n');

  if (allErrors) {
    throw new Error(
      `Configuração de ambiente inválida:\n${allErrors}\n` +
        `Confira o arquivo .env.example.`,
    );
  }

  return validatedConfig;
}
