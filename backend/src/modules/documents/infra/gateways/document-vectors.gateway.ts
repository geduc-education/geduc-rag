import { Inject, Injectable } from '@nestjs/common';
import { VECTOR_STORE_CLIENT } from '../../../../@core/infra/vector-store/vector-store.module';
import type { VectorStoreClient } from '../../../../@core/infra/vector-store/vector-store.client';
import { IDocumentVectorsGateway } from '../../application/interface/gateways/document-vectors.gateway.interface';

/** Encapsula o `VectorStoreClient` para a exclusão de documentos. */
@Injectable()
export class DocumentVectorsGateway implements IDocumentVectorsGateway {
  constructor(
    @Inject(VECTOR_STORE_CLIENT)
    private readonly vectorStore: VectorStoreClient,
  ) {}

  async deleteByDocument(tenantId: string, documentId: string): Promise<void> {
    await this.vectorStore.deleteByDocument(tenantId, documentId);
  }
}
