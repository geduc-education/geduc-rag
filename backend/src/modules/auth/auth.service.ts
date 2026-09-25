import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { normalizeEmail } from '../users/users.policy';
import { toUserResponse, USER_SELECT } from '../users/users.select';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

/**
 * Hash fixo verificado quando o e-mail não existe: iguala o tempo de resposta
 * do login com e sem conta (sem isso a latência do argon2 enumera e-mails).
 */
const DUMMY_HASH_PROMISE = argon2.hash('geduc-rag-dummy-password');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Login e-mail/senha: hash argon2, conta ativa e JWT HS256 (assinado pelo
   * JwtModule global — mesmo segredo/algoritmo que o JwtAuthGuard verifica).
   * Mensagem genérica em falha de credencial para não revelar se o e-mail
   * existe.
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { email: normalizeEmail(dto.email), deletedAt: null },
      select: { id: true, email: true, passwordHash: true, active: true },
    });
    const valid = await argon2.verify(
      user?.passwordHash ?? (await DUMMY_HASH_PROMISE),
      dto.password,
    );
    if (!user || !valid) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    if (!user.active) {
      throw new UnauthorizedException({
        code: ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Conta desativada.',
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.buildAuthResponse(user.id);
  }

  /**
   * Troca de senha do usuário autenticado (obrigatória no 1º acesso ou
   * voluntária). Exige a senha atual, grava o novo hash, limpa
   * `mustChangePassword` e devolve um token novo com a flag zerada.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<AuthResponseDto> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException({
        code: ERROR_CODES.PASSWORD_MISMATCH,
        message: 'A confirmação de senha não confere.',
      });
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, active: true, deletedAt: null },
      select: { passwordHash: true },
    });
    if (!user) throw new UnauthorizedException('Sessão inválida.');

    if (!(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_CURRENT_PASSWORD,
        message: 'A senha atual está incorreta.',
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await argon2.hash(dto.newPassword),
        mustChangePassword: false,
      },
    });
    return this.buildAuthResponse(userId);
  }

  /** Usuário da sessão (o front hidrata perfis, permissões e tenants). */
  async me(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, active: true, deletedAt: null },
      select: USER_SELECT,
    });
    if (!user) throw new UnauthorizedException('Sessão inválida.');
    return toAuthUser(user);
  }

  private async buildAuthResponse(userId: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: USER_SELECT,
    });
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
    };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      mustChangePassword: user.mustChangePassword,
      user: toAuthUser(user),
    };
  }
}

/**
 * Montagem ÚNICA do usuário da sessão — login, troca de senha e `me` passam
 * por aqui, e a permissão vem da mesma projeção das respostas de usuário.
 */
function toAuthUser(user: Parameters<typeof toUserResponse>[0]): AuthUserDto {
  const view = toUserResponse(user);
  return {
    id: view.id,
    name: view.name,
    email: view.email,
    profiles: view.profiles.map((profile) => profile.name),
    permissions: view.permissions,
    tenants: view.tenants,
    mustChangePassword: view.mustChangePassword,
    isSuperAdmin: view.isSuperAdmin,
  };
}
