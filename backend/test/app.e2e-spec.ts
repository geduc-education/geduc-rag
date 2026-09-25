import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters';
import { buildValidationException } from '../src/common/pipes';
import { PERMISSIONS } from '../src/common/rbac/permissions';
import { PrismaService } from '../src/database/prisma.service';

const TENANT = '7f0b0a52-2d0a-4a6b-9a5e-2b1d9a1c3e11';
const OTHER_TENANT = '9e1c1b63-3e1b-4b7c-8b6f-3c2e0b2d4f22';

/**
 * Prisma em memória, só com o que os guards globais consultam: o mesmo
 * usuário atende o `EffectivePermissionsService` (perfis) e o
 * `TenantAccessService` (vínculos). Prova o WIRING — ordem dos guards, DI dos
 * módulos RAG e o fluxo documento → chat — sem MySQL.
 */
const prismaStub = {
  $connect: () => Promise.resolve(),
  $disconnect: () => Promise.resolve(),
  user: {
    findFirst: () =>
      Promise.resolve({
        isSuperAdmin: false,
        profiles: [
          {
            profile: {
              permissions: [
                PERMISSIONS.DOCUMENT_READ,
                PERMISSIONS.DOCUMENT_MANAGE,
                PERMISSIONS.CHAT_QUERY,
              ].map((key) => ({ permission: { key } })),
            },
          },
        ],
        tenants: [{ tenantId: TENANT }],
      }),
  },
  tenant: {
    findFirst: ({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === TENANT ? { id: TENANT } : null),
  },
};

describe('App (e2e, Prisma stubado)', () => {
  let app: INestApplication<App>;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: buildValidationException,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    token = await app
      .get(JwtService)
      .signAsync({ sub: 'u1', email: 'u1@rag.local' });
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('GET /health é público', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('rota protegida sem token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/users');
    expect(res.status).toBe(401);
  });

  it('sem a permissão da rota → 403 FORBIDDEN_PERMISSION', async () => {
    const res = await request(app.getHttpServer()).get('/users').set(auth());
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'FORBIDDEN_PERMISSION' });
  });

  it('rota do RAG sem tenant-id → 400 TENANT_REQUIRED', async () => {
    const res = await request(app.getHttpServer())
      .post('/chat/query')
      .set(auth())
      .send({ question: 'oi' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'TENANT_REQUIRED' });
  });

  it('tenant sem vínculo → 403 TENANT_OUT_OF_SCOPE', async () => {
    const res = await request(app.getHttpServer())
      .post('/chat/query')
      .set({ ...auth(), 'tenant-id': OTHER_TENANT })
      .send({ question: 'oi' });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'TENANT_OUT_OF_SCOPE' });
  });

  it('fluxo ponta a ponta: ingestão → status ready → resposta com citação', async () => {
    const headers = { ...auth(), 'tenant-id': TENANT };
    const upload = await request(app.getHttpServer())
      .post('/documents')
      .set(headers)
      .send({
        filename: 'matricula.md',
        content: 'A matrícula acontece em janeiro, na secretaria da escola.',
      });
    expect(upload.status).toBe(202);
    const { documentId } = upload.body as { documentId: string };

    let status = '';
    for (let i = 0; i < 50 && status !== 'ready'; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      const res = await request(app.getHttpServer())
        .get(`/documents/${documentId}/status`)
        .set(headers);
      status = (res.body as { status: string }).status;
    }
    expect(status).toBe('ready');

    const answer = await request(app.getHttpServer())
      .post('/chat/query')
      .set(headers)
      .send({ question: 'Quando é a matrícula?' });
    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({
      conversationId: expect.any(String) as string,
      citations: [expect.objectContaining({ documentId }) as object],
    });
  });

  it('documento inexistente no tenant → 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/documents/qualquer/status')
      .set({ ...auth(), 'tenant-id': TENANT });
    expect(res.status).toBe(404);
  });
});
