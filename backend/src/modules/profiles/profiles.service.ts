import { Inject, Injectable } from '@nestjs/common';
import {
  PROFILE_REPOSITORY,
  type IProfileRepository,
} from './application/interface/repository/profile.repository.interface';
import { ProfileResponseDto } from './dto/profile-response.dto';

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profiles: IProfileRepository,
  ) {}

  /** Perfis ativos, com as chaves de permissão (para o form de usuário). */
  async list(): Promise<ProfileResponseDto[]> {
    const profiles = await this.profiles.listActive();
    return profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      description: profile.description,
      system: profile.system,
      permissions: profile.permissionKeys,
    }));
  }
}
