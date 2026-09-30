import { IDatabaseConnection } from '../../../@core/application/adapters/database-connection.interface';
import { TenantAccessRepository } from '../infra/database/repositories/tenant-access.repository';

function fakeConnection(opts: {
  one?: Record<string, unknown> | null;
  rows?: Record<string, unknown>[];
}): { db: IDatabaseConnection; query: jest.Mock; queryOne: jest.Mock } {
  const queryOne = jest.fn().mockResolvedValue(opts.one ?? null);
  const query = jest.fn().mockResolvedValue(opts.rows ?? []);
  const db = { query, queryOne } as unknown as IDatabaseConnection;
  return { db, query, queryOne };
}

describe('TenantAccessRepository', () => {
  describe('findActiveUserTenants', () => {
    it('converte is_super_admin 0/1 em boolean e lista os tenants', async () => {
      const { db } = fakeConnection({
        one: { is_super_admin: 0 },
        rows: [{ tenant_id: 't1' }, { tenant_id: 't2' }],
      });
      const repo = new TenantAccessRepository(db);

      await expect(repo.findActiveUserTenants('u1')).resolves.toEqual({
        isSuperAdmin: false,
        tenantIds: ['t1', 't2'],
      });
    });

    it('SUPERADMIN vem como true', async () => {
      const { db } = fakeConnection({ one: { is_super_admin: 1 } });
      const repo = new TenantAccessRepository(db);

      await expect(repo.findActiveUserTenants('u1')).resolves.toMatchObject({
        isSuperAdmin: true,
      });
    });

    it('usuário ausente, inativo ou excluído devolve null', async () => {
      const { db, query } = fakeConnection({ one: null });
      const repo = new TenantAccessRepository(db);

      await expect(repo.findActiveUserTenants('u1')).resolves.toBeNull();
      expect(query).not.toHaveBeenCalled();
    });

    it('filtra usuário ativo e ignora tenant excluído', async () => {
      const { db, query, queryOne } = fakeConnection({
        one: { is_super_admin: 0 },
        rows: [],
      });
      await new TenantAccessRepository(db).findActiveUserTenants('u1');

      const userSql = String(queryOne.mock.calls[0][0]);
      expect(userSql).toContain('u.active = ?');
      expect(userSql).toContain('u.deleted_at IS NULL');
      expect(queryOne.mock.calls[0][1]).toEqual(['u1', 1]);

      const linkSql = String(query.mock.calls[0][0]);
      expect(linkSql).toContain('t.deleted_at IS NULL');
      expect(query.mock.calls[0][1]).toEqual(['u1']);
    });
  });

  describe('isTenantActive', () => {
    it('devolve false sem linha', async () => {
      const { db } = fakeConnection({ one: null });
      await expect(
        new TenantAccessRepository(db).isTenantActive('t1'),
      ).resolves.toBe(false);
    });

    it('devolve true com linha e exige ativo e não excluído', async () => {
      const { db, queryOne } = fakeConnection({ one: { id: 't1' } });
      await expect(
        new TenantAccessRepository(db).isTenantActive('t1'),
      ).resolves.toBe(true);

      const sql = String(queryOne.mock.calls[0][0]);
      expect(sql).toContain('active = ?');
      expect(sql).toContain('deleted_at IS NULL');
      expect(queryOne.mock.calls[0][1]).toEqual(['t1', 1]);
    });
  });
});
