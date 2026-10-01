import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DATABASE_CONNECTION } from '../src/@core/application/adapters/database-connection.interface';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters';
import { buildValidationException } from '../src/common/pipes';
import {
  IEffectivePermissionsRepository,
  UserGrants,
} from '../src/common/rbac/application/interface/repository/effective-permissions.repository.interface';
import { PERMISSIONS } from '../src/common/rbac/permissions';
import {
  ITenantAccessRepository,
  UserTenantLinks,
} from '../src/common/tenancy/application/interface/repository/tenant-access.repository.interface';
import { GithubPullsClient } from '../src/modules/changelog/github-pulls.client';

const TENANT = '7f0b0a52-2d0a-4a6b-9a5e-2b1d9a1c3e11';
const OTHER_TENANT = '9e1c1b63-3e1b-4b7c-8b6f-3c2e0b2d4f22';

/**
 * Repositórios do núcleo de autorização em memória: o mesmo usuário atende o
 * `EffectivePermissionsService` (perfis) e o `TenantAccessService` (vínculos).
 * Prova o WIRING — ordem dos guards, DI dos módulos RAG e o fluxo documento →
 * chat — sem MySQL.
 */
const effectivePermissionsStub: IEffectivePermissionsRepository = {
  findActiveUserGrants: (): Promise<UserGrants> =>
    Promise.resolve({
      isSuperAdmin: false,
      permissionKeys: [
        PERMISSIONS.DOCUMENT_READ,
        PERMISSIONS.DOCUMENT_MANAGE,
        PERMISSIONS.CHAT_QUERY,
      ],
    }),
};

const tenantAccessStub: ITenantAccessRepository = {
  findActiveUserTenants: (): Promise<UserTenantLinks> =>
    Promise.resolve({ isSuperAdmin: false, tenantIds: [TENANT] }),
  isTenantActive: (tenantId: string) => Promise.resolve(tenantId === TENANT),
};

/** Nenhum caminho do e2e pode chegar ao banco: qualquer chamada rejeita. */
const rejectDatabase = (): Promise<never> =>
  Promise.reject(new Error('e2e sem banco: DATABASE_CONNECTION stubado'));
const databaseStub = {
  query: rejectDatabase,
  queryOne: rejectDatabase,
  insert: rejectDatabase,
  update: rejectDatabase,
  delete: rejectDatabase,
  runInTransaction: rejectDatabase,
};

describe('App (e2e, banco stubado)', () => {
  let app: INestApplication<App>;
  let token: string;
  const githubClient = { listMergedPulls: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE_CONNECTION)
      .useValue(databaseStub)
      .overrideProvider('IEffectivePermissionsRepository')
      .useValue(effectivePermissionsStub)
      .overrideProvider('ITenantAccessRepository')
      .useValue(tenantAccessStub)
      .overrideProvider(GithubPullsClient)
      .useValue(githubClient)
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

  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

  async function waitForReady(
    documentId: string,
    headers: Record<string, string>,
  ): Promise<string> {
    let status = '';
    for (let i = 0; i < 50 && status !== 'ready'; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      const res = await request(app.getHttpServer())
        .get(`/documents/${documentId}/status`)
        .set(headers);
      status = (res.body as { status: string }).status;
    }
    return status;
  }

  describe('documentos (multipart) e chat', () => {
    const headers = () => ({ ...auth(), 'tenant-id': TENANT });
    let documentId = '';

    it('POST /documents multipart .md → 202 e status chega a ready', async () => {
      const upload = await request(app.getHttpServer())
        .post('/documents')
        .set(headers())
        .attach(
          'file',
          Buffer.from(
            'A matrícula acontece em janeiro, na secretaria da escola.',
          ),
          { filename: 'matricula.md', contentType: 'text/markdown' },
        );
      expect(upload.status).toBe(202);
      documentId = (upload.body as { documentId: string }).documentId;
      expect(documentId).toEqual(expect.any(String));

      expect(await waitForReady(documentId, headers())).toBe('ready');
    });

    it('POST /chat/query devolve citação com o filename do upload', async () => {
      const answer = await request(app.getHttpServer())
        .post('/chat/query')
        .set(headers())
        .send({ question: 'Quando é a matrícula?' });
      expect(answer.status).toBe(200);
      expect(answer.body).toMatchObject({
        conversationId: expect.any(String) as string,
        citations: [
          expect.objectContaining({
            documentId,
            filename: 'matricula.md',
          }) as object,
        ],
      });
    });

    it('GET /documents lista o documento com total >= 1', async () => {
      const res = await request(app.getHttpServer())
        .get('/documents')
        .query({ page: 1, limit: 20 })
        .set(headers());
      expect(res.status).toBe(200);
      const body = res.body as {
        data: { documentId: string; filename: string }[];
        total: number;
      };
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ documentId, filename: 'matricula.md' }),
        ]),
      );
    });

    it('filename com acento sai intacto na listagem', async () => {
      const upload = await request(app.getHttpServer())
        .post('/documents')
        .set(headers())
        .attach('file', Buffer.from('Relatório das ações da escola.'), {
          filename: 'Relatório_ação.md',
          contentType: 'text/markdown',
        });
      expect(upload.status).toBe(202);

      const res = await request(app.getHttpServer())
        .get('/documents')
        .set(headers());
      const filenames = (res.body as { data: { filename: string }[] }).data.map(
        (item) => item.filename,
      );
      expect(filenames).toContain('Relatório_ação.md');
    });

    it('DELETE /documents/:id → 204 e o status passa a 404', async () => {
      const del = await request(app.getHttpServer())
        .delete(`/documents/${documentId}`)
        .set(headers());
      expect(del.status).toBe(204);

      const status = await request(app.getHttpServer())
        .get(`/documents/${documentId}/status`)
        .set(headers());
      expect(status.status).toBe(404);
    });

    it('upload .exe → 400 UNSUPPORTED_DOCUMENT_TYPE', async () => {
      const res = await request(app.getHttpServer())
        .post('/documents')
        .set(headers())
        .attach('file', Buffer.from('MZ binário'), {
          filename: 'programa.exe',
          contentType: 'application/octet-stream',
        });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'UNSUPPORTED_DOCUMENT_TYPE' });
    });

    it('arquivo acima de DOCUMENT_MAX_UPLOAD_BYTES → 413 ATTACHMENT_TOO_LARGE', async () => {
      const res = await request(app.getHttpServer())
        .post('/documents')
        .set(headers())
        .attach('file', Buffer.alloc(MAX_UPLOAD_BYTES + 1, 'a'), {
          filename: 'grande.txt',
          contentType: 'text/plain',
        });
      expect(res.status).toBe(413);
      expect(res.body).toMatchObject({ code: 'ATTACHMENT_TOO_LARGE' });
    });
  });

  describe('changelog', () => {
    it('GET /changelog sem token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/changelog');
      expect(res.status).toBe(401);
    });

    it('GET /changelog com token e GITHUB_REPO vazio → 200 não configurado', async () => {
      const res = await request(app.getHttpServer())
        .get('/changelog')
        .set(auth());
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        configured: false,
        repository: null,
        items: [],
        fetchedAt: null,
        stale: false,
      });
      expect(githubClient.listMergedPulls).not.toHaveBeenCalled();
    });

    it('GET /changelog?limit=0 → 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/changelog')
        .query({ limit: 0 })
        .set(auth());
      expect(res.status).toBe(400);
      expect(githubClient.listMergedPulls).not.toHaveBeenCalled();
    });
  });

  it('GET /employees sem employee:read → 403 FORBIDDEN_PERMISSION', async () => {
    const res = await request(app.getHttpServer())
      .get('/employees')
      .set({ ...auth(), 'tenant-id': TENANT });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'FORBIDDEN_PERMISSION' });
  });

  it('DELETE /employees/:id/permanent sem employee:purge → 403', async () => {
    const res = await request(app.getHttpServer())
      .delete('/employees/7f0b0a52-2d0a-4a6b-9a5e-2b1d9a1c3e11/permanent')
      .set({ ...auth(), 'tenant-id': TENANT });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'FORBIDDEN_PERMISSION' });
  });

  it('documento inexistente no tenant → 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/documents/qualquer/status')
      .set({ ...auth(), 'tenant-id': TENANT });
    expect(res.status).toBe(404);
  });
});
