/**
 * Codec do embedding persistido em `document_chunk.embedding` (`Bytes @db.Blob`):
 * Float32 little-endian, 4 bytes por dimensão.
 */
export function encodeFloat32(vector: number[]): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(vector.length * 4);
  const view = new DataView(bytes.buffer);
  vector.forEach((value, i) => view.setFloat32(i * 4, value, true));
  return bytes;
}

export function decodeFloat32(bytes: Uint8Array): number[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = Math.floor(bytes.byteLength / 4);
  return Array.from({ length }, (_, i) => view.getFloat32(i * 4, true));
}
