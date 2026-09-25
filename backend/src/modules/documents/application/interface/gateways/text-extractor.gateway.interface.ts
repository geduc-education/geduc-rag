/** Extensões aceitas no upload; o formato é decidido pela extensão (case-insensitive). */
export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  '.md',
  '.txt',
  '.pdf',
  '.docx',
] as const;

export type SupportedDocumentExtension =
  (typeof SUPPORTED_DOCUMENT_EXTENSIONS)[number];

export interface ExtractTextInput {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

/** Fronteira do `documents` com a extração de texto de arquivos enviados. */
export interface ITextExtractorGateway {
  /**
   * Devolve o texto do arquivo. Lança `BadRequestException` com
   * `UNSUPPORTED_DOCUMENT_TYPE` (extensão fora da lista) ou
   * `DOCUMENT_TEXT_EMPTY` (texto vazio depois de `trim`).
   */
  extract(input: ExtractTextInput): Promise<string>;
}

export const TEXT_EXTRACTOR_GATEWAY = 'ITextExtractorGateway';
