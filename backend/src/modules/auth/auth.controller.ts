import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AllowPasswordChangePending } from '../../common/decorators/allow-password-change-pending.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: AuthResponseDto })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  // Liberada mesmo com mustChangePassword=true (é justamente a rota da troca).
  @ApiBearerAuth()
  @AllowPasswordChangePending()
  @Post('change-password')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: AuthResponseDto })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<AuthResponseDto> {
    return this.authService.changePassword(userId, dto);
  }

  @ApiBearerAuth()
  @AllowPasswordChangePending()
  @Get('me')
  @ApiResponse({ status: 200, type: AuthUserDto })
  me(@CurrentUser('id') userId: string): Promise<AuthUserDto> {
    return this.authService.me(userId);
  }
}
