import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../../database/prisma.service';
import { AuthService } from '../auth.service';

jest.mock('argon2', () => ({
  hash: jest.fn(() => Promise.resolve('hash')),
  verify: jest.fn(),
}));

const verify = argon2.verify as jest.Mock;

function sessionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'u1',
    name: 'Admin',
    email: 'admin@rag.local',
    active: true,
    mustChangePassword: false,
    isSuperAdmin: false,
    lastLoginAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    profiles: [
      {
        profile: {
          id: 'p1',
          name: 'Administrador',
          permissions: [{ permission: { key: 'user:read' } }],
        },
      },
    ],
    tenants: [{ tenant: { id: 't1', name: 'GEDUC', slug: 'geduc' } }],
    ...overrides,
  };
}

describe('AuthService', () => {
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwt: { signAsync: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    verify.mockReset();
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(() => Promise.resolve(sessionRow())),
        update: jest.fn(),
      },
    };
    jwt = { signAsync: jest.fn(() => Promise.resolve('token')) };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
    );
  });

  describe('login', () => {
    it('busca pelo e-mail normalizado', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      verify.mockResolvedValue(false);
      await expect(
        service.login({ email: ' Admin@RAG.local ', password: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'admin@rag.local', deletedAt: null },
        }),
      );
    });

    it('verifica um hash mesmo sem conta (tempo constante)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      verify.mockResolvedValue(false);
      await expect(
        service.login({ email: 'x@y.com', password: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verify).toHaveBeenCalledTimes(1);
    });

    it('401 ACCOUNT_DISABLED para conta inativa com senha correta', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'admin@rag.local',
        passwordHash: 'h',
        active: false,
      });
      verify.mockResolvedValue(true);
      await expect(
        service.login({ email: 'admin@rag.local', password: 'ok' }),
      ).rejects.toMatchObject({
        response: { code: 'ACCOUNT_DISABLED' },
      });
    });

    it('emite o token com as claims e devolve a sessão', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'admin@rag.local',
        passwordHash: 'h',
        active: true,
      });
      verify.mockResolvedValue(true);

      const result = await service.login({
        email: 'admin@rag.local',
        password: 'ok',
      });

      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        email: 'admin@rag.local',
        mustChangePassword: false,
      });
      expect(result).toMatchObject({
        accessToken: 'token',
        user: {
          profiles: ['Administrador'],
          permissions: ['user:read'],
          tenants: [{ id: 't1', name: 'GEDUC', slug: 'geduc' }],
        },
      });
    });
  });

  describe('changePassword', () => {
    it('400 quando a confirmação diverge (sem tocar o banco)', async () => {
      await expect(
        service.changePassword('u1', {
          currentPassword: 'a',
          newPassword: 'NovaSenha1',
          confirmPassword: 'Outra1234',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('limpa mustChangePassword ao trocar', async () => {
      prisma.user.findFirst.mockResolvedValue({ passwordHash: 'h' });
      verify.mockResolvedValue(true);
      await service.changePassword('u1', {
        currentPassword: 'a',
        newPassword: 'NovaSenha1',
        confirmPassword: 'NovaSenha1',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { passwordHash: 'hash', mustChangePassword: false },
      });
    });
  });
});
