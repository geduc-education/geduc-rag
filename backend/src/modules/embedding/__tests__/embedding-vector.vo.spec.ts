import { EmbeddingVectorVO } from '../domain/entities/value-objects/embedding-vector.vo';

describe('EmbeddingVectorVO', () => {
  describe('quando a dimensão do vetor bate com a esperada', () => {
    it('cria o VO normalmente', () => {
      const vo = EmbeddingVectorVO.create([0.1, 0.2, 0.3], 3);
      expect(vo.values).toEqual([0.1, 0.2, 0.3]);
      expect(vo.dimensions).toBe(3);
    });
  });

  describe('quando a dimensão do vetor não bate com a esperada', () => {
    it('lança BadRequest', () => {
      expect(() => EmbeddingVectorVO.create([0.1, 0.2], 1536)).toThrow(
        'Vetor de embedding com dimensão inválida: esperado 1536, recebido 2.',
      );
    });
  });
});
