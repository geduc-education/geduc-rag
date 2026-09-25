import { extname } from 'node:path';
import { Worker } from 'node:worker_threads';
import { BadRequestException, Injectable } from '@nestjs/common';
import mammoth from 'mammoth';
import { ERROR_CODES } from '../../../../common/errors/error-codes';
import {
  ExtractTextInput,
  ITextExtractorGateway,
  SUPPORTED_DOCUMENT_EXTENSIONS,
  SupportedDocumentExtension,
} from '../../application/interface/gateways/text-extractor.gateway.interface';

const UTF8_BOM = '﻿';

type Extractor = (buffer: Buffer) => Promise<string>;

const decodeUtf8: Extractor = (buffer) => {
  const text = buffer.toString('utf8');
  return Promise.resolve(
    text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text,
  );
};

/**
 * Script CJS da thread de parse do PDF. O `pdf-parse` (pdfjs) carrega o worker
 * dele via `import()` dinâmico, o que só funciona num contexto Node real — não
 * dentro da VM do jest. Rodar numa `worker_thread` resolve os dois casos e
 * ainda tira o parse (CPU-bound) do event loop.
 */
const PDF_WORKER_SCRIPT = `
const { parentPort, workerData } = require('node:worker_threads');
const { PDFParse } = require(workerData.pdfParsePath);
(async () => {
  const parser = new PDFParse({ data: workerData.data });
  try {
    const result = await parser.getText({ pageJoiner: '' });
    parentPort.postMessage({ text: result.text });
  } catch (error) {
    parentPort.postMessage({ error: error instanceof Error ? error.message : String(error) });
  } finally {
    await parser.destroy();
  }
})();
`;

type PdfWorkerMessage = { text: string } | { error: string };

const extractPdf: Extractor = (buffer) =>
  new Promise<string>((resolve, reject) => {
    const worker = new Worker(PDF_WORKER_SCRIPT, {
      eval: true,
      workerData: {
        pdfParsePath: require.resolve('pdf-parse'),
        data: new Uint8Array(buffer),
      },
    });
    worker.once('message', (message: PdfWorkerMessage) => {
      if ('error' in message) reject(new Error(message.error));
      else resolve(message.text);
    });
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`PDF worker saiu com código ${code}`));
    });
  });

const extractDocx: Extractor = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
};

const EXTRACTORS: Record<SupportedDocumentExtension, Extractor> = {
  '.md': decodeUtf8,
  '.txt': decodeUtf8,
  '.pdf': extractPdf,
  '.docx': extractDocx,
};

function isSupported(ext: string): ext is SupportedDocumentExtension {
  return (SUPPORTED_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext);
}

@Injectable()
export class TextExtractorGateway implements ITextExtractorGateway {
  async extract(input: ExtractTextInput): Promise<string> {
    const ext = extname(input.filename).toLowerCase();
    if (!isSupported(ext)) {
      throw new BadRequestException({
        code: ERROR_CODES.UNSUPPORTED_DOCUMENT_TYPE,
        message: `Tipo de documento não suportado. Envie ${SUPPORTED_DOCUMENT_EXTENSIONS.join(', ')}.`,
      });
    }
    const text = await EXTRACTORS[ext](input.buffer);
    if (text.trim().length === 0) {
      throw new BadRequestException({
        code: ERROR_CODES.DOCUMENT_TEXT_EMPTY,
        message: 'O documento não contém texto extraível.',
      });
    }
    return text;
  }
}
