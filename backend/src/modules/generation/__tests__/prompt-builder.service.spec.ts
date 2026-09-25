import { PromptBuilderService } from '../application/services/prompt-builder.service';

describe('PromptBuilderService', () => {
  const sut = new PromptBuilderService();

  describe('quando há chunks de contexto e histórico', () => {
    it('monta o prompt determinístico com contexto numerado e histórico', () => {
      const prompt = sut.build({
        question: 'Qual o prazo de matrícula?',
        contextChunks: [
          { documentId: 'doc-1', content: 'O prazo é até 30/03.' },
        ],
        history: [{ role: 'user', content: 'Oi' }],
      });

      expect(prompt).toContain('[1] (documento doc-1) O prazo é até 30/03.');
      expect(prompt).toContain('Usuário: Oi');
      expect(prompt).toContain('Qual o prazo de matrícula?');
    });
  });

  describe('quando não há chunks de contexto', () => {
    it('indica explicitamente a ausência de contexto', () => {
      const prompt = sut.build({
        question: 'Pergunta',
        contextChunks: [],
        history: [],
      });
      expect(prompt).toContain('(nenhum trecho relevante encontrado)');
    });
  });
});
