import { ChunkingService } from '../application/services/chunking.service';

describe('ChunkingService', () => {
  describe('quando o texto é menor que o tamanho do chunk', () => {
    it('retorna um único chunk com o texto inteiro', () => {
      const sut = new ChunkingService(800, 100);
      expect(sut.chunk('texto curto')).toEqual(['texto curto']);
    });
  });

  describe('quando o texto é vazio', () => {
    it('retorna lista vazia', () => {
      const sut = new ChunkingService(800, 100);
      expect(sut.chunk('   ')).toEqual([]);
    });
  });

  describe('quando o texto excede o tamanho do chunk', () => {
    it('divide em janelas deslizantes com overlap', () => {
      const sut = new ChunkingService(10, 2);
      const text = '0123456789abcdefghij';

      const chunks = sut.chunk(text);

      expect(chunks[0]).toBe('0123456789');
      expect(chunks[1]).toBe(text.slice(8, 18));
      expect(chunks[chunks.length - 1].endsWith('ij')).toBe(true);
    });
  });
});
