import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({ example: 'regimento-escolar.md' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename!: string;

  @ApiProperty({
    description: 'Texto puro do documento (sem parsing de PDF/DOCX ainda).',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
