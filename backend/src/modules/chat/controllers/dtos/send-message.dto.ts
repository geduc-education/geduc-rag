import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    required: false,
    description: 'Conversa existente; ausente abre uma nova.',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiProperty({ example: 'Qual o horário de matrícula?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  question!: string;
}
