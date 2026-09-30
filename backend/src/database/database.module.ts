import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPool } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../@core/application/adapters/database-connection.interface';
import {
  buildPoolOptions,
  MysqlAdapter,
} from '../@core/infra/adapters/mysql.adapter';
import { PrismaService } from './prisma.service';

/** Teto conservador do pool por instância (mesmo default do PrismaService). */
const DEFAULT_DB_POOL_MAX = 10;

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: DATABASE_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new MysqlAdapter(
          createPool(
            buildPoolOptions(
              config.getOrThrow<string>('DATABASE_URL'),
              Number(config.get<string>('DB_POOL_MAX') ?? DEFAULT_DB_POOL_MAX),
            ),
          ),
        ),
    },
  ],
  exports: [PrismaService, DATABASE_CONNECTION],
})
export class DatabaseModule {}
