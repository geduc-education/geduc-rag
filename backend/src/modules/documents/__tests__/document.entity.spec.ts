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

  describe('metadados do arquivo', () => {
    it('usa text/plain e os bytes UTF-8 de content como default', () => {
      const document = DocumentEntity.create(makeInput({ content: 'ação' }));
      expect(document.mimeType).toBe('text/plain');
      expect(document.sizeBytes).toBe(Buffer.byteLength('ação', 'utf8'));
      expect(document.createdById).toBeNull();
      expect(document.errorMessage).toBeNull();
    });

    it('respeita mimeType, sizeBytes e createdById informados', () => {
      const document = DocumentEntity.create(
        makeInput({
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          createdById: 'user-1',
        }),
      );
      expect(document.mimeType).toBe('application/pdf');
      expect(document.sizeBytes).toBe(2048);
      expect(document.createdById).toBe('user-1');
    });
  });

  describe('motivo de falha', () => {
    it('markFailed grava errorMessage e markReady o limpa', () => {
      const document = DocumentEntity.create(makeInput());
      document.markFailed('x');
      expect(document.status).toBe('failed');
      expect(document.errorMessage).toBe('x');

      document.markReady('mock-model', 'v1');
      expect(document.errorMessage).toBeNull();
    });

    it('markProcessing limpa errorMessage', () => {
      const document = DocumentEntity.create(makeInput());
      document.markFailed('falhou');
      document.markProcessing();
      expect(document.errorMessage).toBeNull();
    });

    it('markFailed sem motivo deixa errorMessage nulo', () => {
      const document = DocumentEntity.create(makeInput());
      document.markFailed();
      expect(document.errorMessage).toBeNull();
    });

    it('trunca errorMessage em 500 caracteres', () => {
      const document = DocumentEntity.create(makeInput());
      document.markFailed('a'.repeat(800));
      expect(document.errorMessage).toHaveLength(500);
    });
  });
});
