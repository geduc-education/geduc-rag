export interface CitationProps {
  documentId: string;
  chunkId: string;
  excerpt: string;
}

/**
 * Amarra um trecho de resposta ao(s) chunk(s)/documento(s) fonte que a sustentam —
 * grounding/citação modelado como domínio, não como string solta.
 */
export class CitationVO {
  private constructor(
    readonly documentId: string,
    readonly chunkId: string,
    readonly excerpt: string,
  ) {}

  static create(props: CitationProps): CitationVO {
    return new CitationVO(props.documentId, props.chunkId, props.excerpt);
  }
}
