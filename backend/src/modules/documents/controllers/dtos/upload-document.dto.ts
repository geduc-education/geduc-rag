import { ApiProperty } from '@nestjs/swagger';

/** Corpo multipart de `POST /documents` — só para o Swagger (o arquivo vem do `FileInterceptor`). */
export class UploadDocumentDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Arquivo .md, .txt, .pdf ou .docx.',
  })
  file!: unknown;
}
