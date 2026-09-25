import { ApiProperty } from '@nestjs/swagger';

export class ChatCitationDto {
  @ApiProperty({ description: 'Documento de onde veio o trecho citado.' })
  documentId!: string;

  @ApiProperty({ description: 'Chunk do documento usado como contexto.' })
  chunkId!: string;

  @ApiProperty({
    example: 'matricula.md',
    description: 'Nome do arquivo do documento citado.',
  })
  filename!: string;

  @ApiProperty({ description: 'Trecho do chunk exibido como citação.' })
  excerpt!: string;
}

/** Resposta de `POST /chat/query`. */
export class ChatQueryResponseDto {
  @ApiProperty({
    description:
      'Conversa do usuário no tenant; reenvie para continuar o histórico.',
  })
  conversationId!: string;

  @ApiProperty({ description: 'Resposta gerada a partir dos documentos.' })
  answer!: string;

  @ApiProperty({ type: [ChatCitationDto] })
  citations!: ChatCitationDto[];
}
