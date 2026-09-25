export type MessageRole = 'user' | 'assistant';

/**
 * Formato de citação PRÓPRIO do `chat` — o gateway que consome `retrieval`
 * (`infra/gateways/retrieval-context.gateway.ts`) transforma o `CitationVO` de lá para este
 * shape antes de chegar aqui, então este módulo nunca importa `domain`/`application` de
 * `retrieval` fora do gateway.
 */
export interface MessageCitation {
  documentId: string;
  chunkId: string;
  filename: string;
  excerpt: string;
}

export interface MessageProps {
  role: MessageRole;
  content: string;
  citations?: MessageCitation[];
  createdAt?: Date;
}

export class MessageEntity {
  readonly role: MessageRole;
  readonly content: string;
  readonly citations: MessageCitation[];
  readonly createdAt: Date;

  private constructor(props: MessageProps) {
    this.role = props.role;
    this.content = props.content;
    this.citations = props.citations ?? [];
    this.createdAt = props.createdAt ?? new Date();
  }

  static create(props: MessageProps): MessageEntity {
    return new MessageEntity(props);
  }
}
