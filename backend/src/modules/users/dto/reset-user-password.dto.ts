import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Redefinição de senha pelo administrador: grava uma nova senha TEMPORÁRIA e
 * religa `mustChangePassword` — o usuário troca no próximo acesso.
 */
export class ResetUserPasswordDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
