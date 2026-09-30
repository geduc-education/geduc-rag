import { ForbiddenException } from '@nestjs/common';
import { EffectivePermissions } from '../../../common/rbac/effective-permissions.service';
import { TenantReach } from '../../../common/tenancy/tenant-access.service';
import {
  assertCanDisable,
  assertCanModify,
  assertPermissionsGrantable,
  assertTenantsGrantable,
  changedIds,
  mergeTenantAssignment,
  normalizeEmail,
  UserActor,
} from '../users.policy';

const SUPER: TenantReach = { superAdmin: true, tenantIds: null };
const ADMIN_A: TenantReach = { superAdmin: false, tenantIds: ['A'] };

function actor(reach: TenantReach, id = 'actor'): UserActor {
  return {
    id,
    reach,
    permissions: new EffectivePermissions(reach.superAdmin, new Set()),
  };
}

function errorCode(fn: () => void): string | undefined {
  try {
    fn();
  } catch (error) {
    if (!(error instanceof ForbiddenException)) throw error;
    return (error.getResponse() as { code?: string }).code;
  }
  return undefined;
}

describe('users.policy', () => {
  it('changedIds devolve o que entra e o que sai', () => {
    expect(changedIds(['A', 'B'], ['B', 'C']).sort()).toEqual(['A', 'C']);
  });

  describe('assertTenantsGrantable', () => {
    it('permite mexer só em tenants do próprio alcance', () => {
      expect(() => assertTenantsGrantable(ADMIN_A, [], ['A'])).not.toThrow();
    });

    it('nega vincular tenant fora do alcance (escalada entre tenants)', () => {
      expect(errorCode(() => assertTenantsGrantable(ADMIN_A, [], ['B']))).toBe(
        'TENANT_NOT_GRANTABLE',
      );
    });

    it('nega desvincular tenant fora do alcance', () => {
      expect(
        errorCode(() => assertTenantsGrantable(ADMIN_A, ['A', 'B'], ['A'])),
      ).toBe('TENANT_NOT_GRANTABLE');
    });

    it('SUPERADMIN mexe em qualquer tenant', () => {
      expect(() => assertTenantsGrantable(SUPER, ['X'], ['Y'])).not.toThrow();
    });
  });

  it('mergeTenantAssignment preserva vínculos fora do alcance do ator', () => {
    expect(mergeTenantAssignment(ADMIN_A, ['A', 'B'], []).sort()).toEqual([
      'B',
    ]);
    expect(mergeTenantAssignment(SUPER, ['A', 'B'], [])).toEqual([]);
  });

  describe('assertPermissionsGrantable', () => {
    const has = new EffectivePermissions(false, new Set(['user:read']));

    it('permite conceder o que o ator tem', () => {
      expect(() =>
        assertPermissionsGrantable(has, ['user:read']),
      ).not.toThrow();
    });

    it('nega conceder o que o ator não tem', () => {
      expect(
        errorCode(() =>
          assertPermissionsGrantable(has, ['user:read', 'tenant:manage']),
        ),
      ).toBe('PERMISSION_NOT_GRANTABLE');
    });

    it('SUPERADMIN concede tudo', () => {
      const superPerms = new EffectivePermissions(true, new Set());
      expect(() =>
        assertPermissionsGrantable(superPerms, ['tenant:manage']),
      ).not.toThrow();
    });
  });

  describe('proteções', () => {
    const superTarget = { id: 'root', isSuperAdmin: true };
    const plainTarget = { id: 'u2', isSuperAdmin: false };

    it('só SUPERADMIN altera o SUPERADMIN', () => {
      expect(
        errorCode(() => assertCanModify(actor(ADMIN_A), superTarget)),
      ).toBe('USER_PROTECTED');
      expect(() => assertCanModify(actor(SUPER), superTarget)).not.toThrow();
    });

    it('ninguém inativa o SUPERADMIN', () => {
      expect(errorCode(() => assertCanDisable(actor(SUPER), superTarget))).toBe(
        'USER_PROTECTED',
      );
    });

    it('ninguém inativa a si mesmo', () => {
      expect(
        errorCode(() => assertCanDisable(actor(ADMIN_A, 'u2'), plainTarget)),
      ).toBe('USER_SELF_ACTION');
    });
  });

  it('normalizeEmail apara e baixa a caixa', () => {
    expect(normalizeEmail('  Maria@Empresa.COM ')).toBe('maria@empresa.com');
  });
});
