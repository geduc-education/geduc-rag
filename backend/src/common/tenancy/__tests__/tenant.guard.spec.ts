import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantAccessService } from '../tenant-access.service';
import { TENANT_SCOPED_KEY } from '../tenant-scoped.decorator';
import { TenantGuard } from '../tenant.guard';

const TENANT = '7f0b0a52-2d0a-4a6b-9a5e-2b1d9a1c3e11';

interface FakeRequest {
  user?: { id: string };
  headers: Record<string, string>;
  tenantId?: string;
}

function makeContext(req: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('TenantGuard', () => {
  let reflector: Reflector;
  let access: { canAccess: jest.Mock<Promise<boolean>, [string, string]> };
  let guard: TenantGuard;

  beforeEach(() => {
    reflector = new Reflector();
    access = { canAccess: jest.fn<Promise<boolean>, [string, string]>() };
    guard = new TenantGuard(
      reflector,
      access as unknown as TenantAccessService,
    );
  });

  function scoped(value: boolean): void {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: unknown) =>
        key === TENANT_SCOPED_KEY ? value : undefined,
      );
  }

  it('rota sem @TenantScoped é no-op (nem lê o header)', async () => {
    scoped(false);
    const req: FakeRequest = { user: { id: 'u1' }, headers: {} };
    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
    expect(access.canAccess).not.toHaveBeenCalled();
  });

  it('401 sem usuário autenticado', async () => {
    scoped(true);
    await expect(
      guard.canActivate(makeContext({ headers: { 'tenant-id': TENANT } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([[{}], [{ 'tenant-id': 'nao-e-uuid' }]])(
    '400 TENANT_REQUIRED com header ausente/malformado (%o)',
    async (headers) => {
      scoped(true);
      const req: FakeRequest = { user: { id: 'u1' }, headers };
      await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(access.canAccess).not.toHaveBeenCalled();
    },
  );

  it('403 TENANT_OUT_OF_SCOPE sem vínculo (e não popula req.tenantId)', async () => {
    scoped(true);
    access.canAccess.mockResolvedValue(false);
    const req: FakeRequest = {
      user: { id: 'u1' },
      headers: { 'tenant-id': TENANT },
    };
    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(req.tenantId).toBeUndefined();
  });

  it('libera com vínculo e popula req.tenantId', async () => {
    scoped(true);
    access.canAccess.mockResolvedValue(true);
    const req: FakeRequest = {
      user: { id: 'u1' },
      headers: { 'tenant-id': TENANT },
    };
    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
    expect(access.canAccess).toHaveBeenCalledWith('u1', TENANT);
    expect(req.tenantId).toBe(TENANT);
  });
});
