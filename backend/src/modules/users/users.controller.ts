import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions';
import { AssignUserTenantsDto } from './dto/assign-user-tenants.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListResponseDto, UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

/**
 * Cadastro de usuários. O `@RequirePermissions` é o gate de "pode ler/gerir
 * usuários"; o alcance (tenants compartilhados), a concessão de perfis e de
 * tenants e a proteção do SUPERADMIN ficam no service (`users.policy.ts`).
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiResponse({ status: 200, type: UserListResponseDto })
  list(
    @Query() query: ListUsersDto,
    @CurrentUser('id') actorId: string,
  ): Promise<UserListResponseDto> {
    return this.usersService.list(query, actorId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiResponse({ status: 200, type: UserResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.findOne(id, actorId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @ApiResponse({ status: 201, type: UserResponseDto })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser('id') actorId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.create(dto, actorId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @ApiResponse({ status: 200, type: UserResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') actorId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, dto, actorId);
  }

  /** Substitui o conjunto de vínculos usuário ↔ tenant. */
  @Put(':id/tenants')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @ApiResponse({ status: 200, type: UserResponseDto })
  assignTenants(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignUserTenantsDto,
    @CurrentUser('id') actorId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.assignTenants(id, dto, actorId);
  }

  @Post(':id/reset-password')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser('id') actorId: string,
  ): Promise<void> {
    return this.usersService.resetPassword(id, dto, actorId);
  }

  @Patch(':id/activate')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @ApiResponse({ status: 200, type: UserResponseDto })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.setActive(id, true, actorId);
  }

  @Patch(':id/deactivate')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @ApiResponse({ status: 200, type: UserResponseDto })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.setActive(id, false, actorId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
  ): Promise<void> {
    return this.usersService.remove(id, actorId);
  }
}
