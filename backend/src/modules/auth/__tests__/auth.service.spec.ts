import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type {
  IUserRepository,
  UserAggregate,
  UserCredentials,
} from '../../users/application/interface/repository/user.repository.interface';
import { AuthService } from '../auth.service';

jest.mock('argon2', () => ({
  hash: jest.fn(() => Promise.resolve('hash')),
  verify: jest.fn(),
}));

const verify = argon2.verify as jest.Mock;

function aggregate(overrides: Partial<UserAggregate> = {}): UserAggregate {
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
    profiles: [{ id: 'p1', name: 'Administrador' }],
    tenants: [{ id: 't1', name: 'GEDUC', slug: 'geduc' }],
    permissionKeys: ['user:read'],
    ...overrides,
  };
}

function credentials(
  overrides: Partial<UserCredentials> = {},
): UserCredentials {
  return {
    id: 'u1',
    email: 'admin@rag.local',
    passwordHash: 'h',
    active: true,
    ...overrides,
  };
}

type UserRepositoryMock = {
  [K in keyof IUserRepository]: jest.Mock;
};

function userRepositoryMock(): UserRepositoryMock {
  return {
    list: jest.fn(),
    findInScope: jest.fn(),
    findActiveById: jest.fn(),
    findById: jest.fn(() => Promise.resolve(aggregate())),
    findCredentialsByEmail: jest.fn(),
    findActiveCredentialsById: jest.fn(),
    findIdByEmail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    replaceTenants: jest.fn(),
    updatePassword: jest.fn(() => Promise.resolve()),
    touchLastLogin: jest.fn(() => Promise.resolve()),
    softDelete: jest.fn(),
  };
}

describe('AuthService', () => {
  let users: UserRepositoryMock;
  let jwt: { signAsync: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    verify.mockReset();
    users = userRepositoryMock();
    jwt = { signAsync: jest.fn(() => Promise.resolve('token')) };
    service = new AuthService(users, jwt as unknown as JwtService);
  });

  describe('login', () => {
    it('busca pelo e-mail normalizado', async () => {
      users.findCredentialsByEmail.mockResolvedValue(null);
      verify.mockResolvedValue(false);
      await expect(
        service.login({ email: ' Admin@RAG.local ', password: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(users.findCredentialsByEmail).toHaveBeenCalledWith(
        'admin@rag.local',
      );
    });

    it('verifica um hash mesmo sem conta (tempo constante)', async () => {
      users.findCredentialsByEmail.mockResolvedValue(null);
      verify.mockResolvedValue(false);
      await expect(
        service.login({ email: 'x@y.com', password: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verify).toHaveBeenCalledTimes(1);
      expect(users.touchLastLogin).not.toHaveBeenCalled();
    });

    it('401 ACCOUNT_DISABLED para conta inativa com senha correta', async () => {
      users.findCredentialsByEmail.mockResolvedValue(
        credentials({ active: false }),
      );
      verify.mockResolvedValue(true);
      const attempt = service.login({
        email: 'admin@rag.local',
        password: 'ok',
      });
      await expect(attempt).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(attempt).rejects.toMatchObject({
        response: { code: 'ACCOUNT_DISABLED' },
      });
      expect(users.touchLastLogin).not.toHaveBeenCalled();
    });

    it('registra o último login, emite o token e devolve a sessão', async () => {
      users.findCredentialsByEmail.mockResolvedValue(credentials());
      verify.mockResolvedValue(true);

      const result = await service.login({
        email: 'admin@rag.local',
        password: 'ok',
      });

      expect(users.touchLastLogin).toHaveBeenCalledWith('u1');
      expect(users.findById).toHaveBeenCalledWith('u1');
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        email: 'admin@rag.local',
        mustChangePassword: false,
      });
      expect(result).toMatchObject({
        accessToken: 'token',
        mustChangePassword: false,
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
      expect(users.findActiveCredentialsById).not.toHaveBeenCalled();
    });

    it('limpa mustChangePassword ao trocar', async () => {
      users.findActiveCredentialsById.mockResolvedValue(credentials());
      verify.mockResolvedValue(true);
      await service.changePassword('u1', {
        currentPassword: 'a',
        newPassword: 'NovaSenha1',
        confirmPassword: 'NovaSenha1',
      });
      expect(users.findActiveCredentialsById).toHaveBeenCalledWith('u1');
      expect(users.updatePassword).toHaveBeenCalledWith('u1', {
        passwordHash: 'hash',
        mustChangePassword: false,
      });
    });
  });

  describe('me', () => {
    it('401 quando o usuário não existe ou está inativo', async () => {
      users.findActiveById.mockResolvedValue(null);
      await expect(service.me('u1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(users.findActiveById).toHaveBeenCalledWith('u1');
    });

    it('devolve o usuário da sessão', async () => {
      users.findActiveById.mockResolvedValue(aggregate());
      await expect(service.me('u1')).resolves.toMatchObject({
        id: 'u1',
        profiles: ['Administrador'],
        permissions: ['user:read'],
      });
    });
  });
});
