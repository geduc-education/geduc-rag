import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ProfileResponseDto } from './dto/profile-response.dto';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Perfis ativos, com as chaves de permissão (para o form de usuário). */
  async list(): Promise<ProfileResponseDto[]> {
    const profiles = await this.prisma.profile.findMany({
      where: { active: true, deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        system: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
    return profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      description: profile.description,
      system: profile.system,
      permissions: profile.permissions.map((g) => g.permission.key).sort(),
    }));
  }
}
