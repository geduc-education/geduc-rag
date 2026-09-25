/** Chunker por janela deslizante — puro, sem I/O, fácil de testar sem LLM/embedding real. */
export class ChunkingService {
  constructor(
    private readonly chunkSize: number,
    private readonly overlap: number,
  ) {}

  chunk(text: string): string[] {
    const normalized = text.trim();
    if (!normalized) return [];

    const chunks: string[] = [];
    const step = this.chunkSize - this.overlap;
    for (let start = 0; start < normalized.length; start += step) {
      chunks.push(normalized.slice(start, start + this.chunkSize));
      if (start + this.chunkSize >= normalized.length) break;
    }
    return chunks;
  }
}
