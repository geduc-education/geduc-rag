import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Troca de senha do usuário autenticado. Serve tanto para a troca obrigatória
 * do 1º acesso (mustChangePassword) quanto para troca voluntária. Exige a senha
 * atual para evitar troca por sessão sequestrada.
 */
export class ChangePasswordDto {
  @ApiProperty({ description: 'Senha atual (para reautenticar a troca).' })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;

  @ApiProperty({ minLength: 8, description: 'Confirmação da nova senha.' })
  @IsString()
  @MinLength(8)
  confirmPassword!: string;
}
