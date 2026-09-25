import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VectorStoreModule } from './@core/infra/vector-store/vector-store.module';
import { QueueModule } from './@core/infra/queue/queue.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { MustChangePasswordGuard } from './common/guards/must-change-password.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { RbacModule } from './common/rbac/rbac.module';
import { TenantGuard } from './common/tenancy/tenant.guard';
import { validateEnv } from './config/env.validation';
import { buildLoggerOptions } from './config/logger.config';
import { buildThrottlerOptions } from './config/throttler.config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { EmbeddingModule } from './modules/embedding/embedding.module';
import { RetrievalModule } from './modules/retrieval/retrieval.module';
import { GenerationModule } from './modules/generation/generation.module';
import { ChatModule } from './modules/chat/chat.module';

/**
 * Módulo raiz. Duas famílias de módulo convivem (ver CLAUDE.md):
 *
 * - **Plataforma** (auth, users, profiles, tenants) — padrão geduc-suporte:
 *   Controller → Service → PrismaService.
 * - **RAG** (documents, ingestion, embedding, retrieval, generation, chat) —
 *   Clean Architecture herdada do rag-api: use cases puros + gateways, com a
 *   infra `@core` (vector store e fila) ainda in-memory.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildLoggerOptions,
    }),
    // JwtModule global: o JwtAuthGuard verifica e o AuthService assina com o
    // mesmo segredo/algoritmo (envs já validadas por validateEnv).
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresIn = (config.get<string>('JWT_EXPIRATION_TIME') ??
          '3600s') as JwtSignOptions['expiresIn'];
        const signOptions: JwtSignOptions = { expiresIn, algorithm: 'HS256' };
        return { secret: config.getOrThrow<string>('JWT_SECRET'), signOptions };
      },
    }),
    // Throttlers nomeados, SEM guard global (config/throttler.config.ts).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildThrottlerOptions,
    }),
    DatabaseModule,
    RbacModule,
    // Infra do RAG (@core) — globais, in-memory por enquanto.
    VectorStoreModule,
    QueueModule,
    // Plataforma
    AuthModule,
    UsersModule,
    ProfilesModule,
    TenantsModule,
    // RAG — write path (assíncrono) e read path
    DocumentsModule,
    IngestionModule,
    EmbeddingModule,
    RetrievalModule,
    GenerationModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    // Ordem importa: autenticação → troca de senha pendente → permissão →
    // tenant. Cada guard consome o que o anterior populou em `req`.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
  ],
})
export class AppModule {}
