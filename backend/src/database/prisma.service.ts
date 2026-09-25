import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

/** Teto conservador do pool por instância (valor efetivo herdado hoje). */
const DEFAULT_DB_POOL_MAX = 10;

/**
 * Com driver adapter, quem gerencia o pool é o driver `mariadb` (compatível
 * com MySQL) — o teto vai em `connectionLimit`, aplicado aqui sobre a
 * `DATABASE_URL` (nunca configurado direto na variável de ambiente).
 * Dimensionamento para escala horizontal:
 * `N_instâncias × DB_POOL_MAX + ~20 ≤ max_connections`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  private readonly poolMax: number;

  constructor(config: ConfigService) {
    // DB_POOL_MAX já validada no boot (inteiro ≥ 1) por env.validation.ts.
    const poolMax = Number(
      config.get<string>('DB_POOL_MAX') ?? DEFAULT_DB_POOL_MAX,
    );
    const url = new URL(config.getOrThrow<string>('DATABASE_URL'));
    url.searchParams.set('connectionLimit', String(poolMax));
    super({ adapter: new PrismaMariaDb(url.toString()) });
    this.poolMax = poolMax;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log(`Pool de conexões do MySQL: DB_POOL_MAX=${this.poolMax}`);
  }
}
