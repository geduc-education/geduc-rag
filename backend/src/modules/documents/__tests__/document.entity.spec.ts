import { DocumentEntity } from '../domain/entities/document.entity';

function makeInput(
  overrides: Partial<Parameters<typeof DocumentEntity.create>[0]> = {},
) {
  return {
    documentId: 'doc-1',
    tenantId: 'tenant-1',
    filename: 'apostila.pdf',
    content: 'conteúdo do documento',
    ...overrides,
  };
}

describe('DocumentEntity', () => {
  describe('quando filename ou content estão vazios', () => {
    it('lança BadRequest para filename vazio', () => {
      expect(() => DocumentEntity.create(makeInput({ filename: '' }))).toThrow(
        'Campo filename é obrigatório.',
      );
    });

    it('lança BadRequest para content vazio', () => {
      expect(() => DocumentEntity.create(makeInput({ content: '  ' }))).toThrow(
        'Campo content é obrigatório.',
      );
    });
  });

  describe('ciclo de vida do status', () => {
    it('começa pending e transiciona processing → ready', () => {
      const document = DocumentEntity.create(makeInput());
      expect(document.status).toBe('pending');

      document.markProcessing();
      expect(document.status).toBe('processing');

      document.markReady('mock-model', 'v1');
      expect(document.status).toBe('ready');
      expect(document.embeddingModel).toBe('mock-model');
      expect(document.embeddingVersion).toBe('v1');
    });

    it('marca failed a partir de qualquer estado', () => {
      const document = DocumentEntity.create(makeInput());
      document.markFailed();
      expect(document.status).toBe('failed');
    });
  });
});
