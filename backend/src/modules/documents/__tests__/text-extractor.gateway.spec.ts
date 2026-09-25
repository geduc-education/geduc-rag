import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { SUPPORTED_DOCUMENT_EXTENSIONS } from '../application/interface/gateways/text-extractor.gateway.interface';
import { TextExtractorGateway } from '../infra/gateways/text-extractor.gateway';

const fixture = (name: string): Buffer =>
  readFileSync(join(__dirname, 'fixtures', name));

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('era esperado que a extração falhasse');
}

describe('TextExtractorGateway', () => {
  const gateway = new TextExtractorGateway();

  it('declara as extensões suportadas', () => {
    expect(SUPPORTED_DOCUMENT_EXTENSIONS).toEqual([
      '.md',
      '.txt',
      '.pdf',
      '.docx',
    ]);
  });

  it('extrai texto de .md em UTF-8 com acentuação, sem BOM', async () => {
    const content = '# Título\n\nAção pedagógica e avaliação.';
    const buffer = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(content, 'utf8'),
    ]);

    const text = await gateway.extract({
      filename: 'regimento.md',
      mimeType: 'text/markdown',
      buffer,
    });

    expect(text).toBe(content);
  });

  it('extrai texto de .txt em UTF-8 com acentuação (extensão case-insensitive)', async () => {
    const text = await gateway.extract({
      filename: 'NOTAS.TXT',
      mimeType: 'text/plain',
      buffer: Buffer.from('Frequência mínima de 75%.', 'utf8'),
    });

    expect(text).toBe('Frequência mínima de 75%.');
  });

  it('extrai o texto conhecido da fixture .pdf', async () => {
    const text = await gateway.extract({
      filename: 'sample.pdf',
      mimeType: 'application/pdf',
      buffer: fixture('sample.pdf'),
    });

    expect(text).toContain('Regimento escolar de teste');
  });

  it('extrai o texto conhecido da fixture .docx', async () => {
    const text = await gateway.extract({
      filename: 'sample.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: fixture('sample.docx'),
    });

    expect(text).toContain('Regimento escolar de teste');
    expect(text).toContain('versão docx');
  });

  it('rejeita extensão fora da lista com 400 UNSUPPORTED_DOCUMENT_TYPE', async () => {
    const error = await captureError(
      gateway.extract({
        filename: 'programa.exe',
        mimeType: 'application/octet-stream',
        buffer: Buffer.from('MZ'),
      }),
    );

    expect(error).toBeInstanceOf(BadRequestException);
    const exception = error as BadRequestException;
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toMatchObject({
      code: ERROR_CODES.UNSUPPORTED_DOCUMENT_TYPE,
    });
  });

  it('rejeita .txt só com espaços com 400 DOCUMENT_TEXT_EMPTY', async () => {
    const error = await captureError(
      gateway.extract({
        filename: 'vazio.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('   \n\t  \n', 'utf8'),
      }),
    );

    expect(error).toBeInstanceOf(BadRequestException);
    const exception = error as BadRequestException;
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toMatchObject({
      code: ERROR_CODES.DOCUMENT_TEXT_EMPTY,
    });
  });
});
