import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequireAnyPermission } from '../../common/decorators/require-any-permission.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { ProfilesService } from './profiles.service';

/**
 * Catálogo de perfis (somente leitura por enquanto — os perfis nascem do
 * seed). `user:manage` também lê: o formulário de usuário precisa das opções.
 */
@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  @RequireAnyPermission(PERMISSIONS.PROFILE_READ, PERMISSIONS.USER_MANAGE)
  @ApiResponse({ status: 200, type: [ProfileResponseDto] })
  list(): Promise<ProfileResponseDto[]> {
    return this.profilesService.list();
  }
}
