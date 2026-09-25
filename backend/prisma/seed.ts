/**
 * Seed da plataforma de RAG.
 *
 * RBAC (catálogo de permissões + perfis default), tenant default e usuário
 * bootstrap SUPERADMIN (protegido) vinculado ao perfil Administrador e ao
 * tenant default. Idempotente (upsert por chave natural). Guard
 * NODE_ENV=production: nunca semeia em produção.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as argon2 from 'argon2';
import {
  ALL_PERMISSION_KEYS,
  DEFAULT_PROFILES,
  PERMISSION_DESCRIPTIONS,
} from '../src/common/rbac/permissions';

// Prisma 7 exige driver adapter (mesmo padrão do PrismaService).
const adapter = new PrismaMariaDb(process.env.DATABASE_URL ?? '');
const prisma = new PrismaClient({ adapter });

const DEFAULT_TENANT = { name: 'GEDUC', slug: 'geduc' };

async function seedPermissions(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const key of ALL_PERMISSION_KEYS) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: { description: PERMISSION_DESCRIPTIONS[key] },
      create: { key, description: PERMISSION_DESCRIPTIONS[key] },
    });
    ids.set(key, permission.id);
  }
  return ids;
}

/** Perfis de seed: o conjunto de permissões é reescrito a cada execução. */
async function seedProfiles(
  permissionIds: Map<string, string>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const profile of DEFAULT_PROFILES) {
    const { id } = await prisma.profile.upsert({
      where: { name: profile.name },
      update: { description: profile.description, system: true },
      create: {
        name: profile.name,
        description: profile.description,
        system: true,
      },
    });
    await prisma.profilePermission.deleteMany({ where: { profileId: id } });
    await prisma.profilePermission.createMany({
      data: profile.permissions.map((key) => ({
        profileId: id,
        permissionId: permissionIds.get(key)!,
      })),
    });
    ids.set(profile.name, id);
  }
  return ids;
}

async function seedTenant(): Promise<string> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEFAULT_TENANT.slug },
    update: {},
    create: DEFAULT_TENANT,
  });
  return tenant.id;
}

/** SUPERADMIN só é criado se não existir (senha inicial temporária). */
async function seedSuperAdmin(profileId: string, tenantId: string) {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@rag.local')
    .trim()
    .toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] SUPERADMIN ${email} já existe — mantido.`);
    return;
  }
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!password) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD é obrigatória para o seed.');
  }
  await prisma.user.create({
    data: {
      name: process.env.BOOTSTRAP_ADMIN_NAME ?? 'Super Admin',
      email,
      passwordHash: await argon2.hash(password),
      isSuperAdmin: true,
      mustChangePassword: true,
      profiles: { create: { profileId } },
      tenants: { create: { tenantId } },
    },
  });
  console.log(
    `[seed] SUPERADMIN ${email} criado (troca de senha no 1º acesso).`,
  );
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('[seed] NODE_ENV=production — seed abortado (guard).');
    return;
  }
  const permissionIds = await seedPermissions();
  const profileIds = await seedProfiles(permissionIds);
  const tenantId = await seedTenant();
  await seedSuperAdmin(profileIds.get('Administrador')!, tenantId);
  console.log('[seed] concluído.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
