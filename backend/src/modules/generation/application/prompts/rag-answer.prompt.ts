export interface RagAnswerPromptContextChunk {
  documentId: string;
  content: string;
}

export interface RagAnswerPromptTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface RagAnswerPromptInput {
  question: string;
  contextChunks: RagAnswerPromptContextChunk[];
  history: RagAnswerPromptTurn[];
}

/**
 * Template do prompt de resposta com contexto (RAG). Versionado neste arquivo — revisão de
 * prompt fica isolada da lógica do use case.
 */
export function buildRagAnswerPrompt(input: RagAnswerPromptInput): string {
  const context = input.contextChunks.length
    ? input.contextChunks
        .map(
          (chunk, index) =>
            `[${index + 1}] (documento ${chunk.documentId}) ${chunk.content}`,
        )
        .join('\n')
    : '(nenhum trecho relevante encontrado)';

  const history = input.history
    .map(
      (turn) =>
        `${turn.role === 'user' ? 'Usuário' : 'Assistente'}: ${turn.content}`,
    )
    .join('\n');

  return [
    'Responda à pergunta do usuário usando APENAS o contexto abaixo. Cite os trechos usados',
    'pelo número entre colchetes. Se o contexto não for suficiente, diga isso explicitamente.',
    '',
    '### Contexto',
    context,
    ...(history ? ['', '### Histórico da conversa', history] : []),
    '',
    '### Pergunta',
    input.question,
  ].join('\n');
}
