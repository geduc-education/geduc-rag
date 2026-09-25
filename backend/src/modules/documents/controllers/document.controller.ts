import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions';
import {
  TenantId,
  TenantScoped,
} from '../../../common/tenancy/tenant-scoped.decorator';
import {
  UploadDocumentOutput,
  UploadDocumentUseCase,
} from '../application/usecase/document/upload-document.usecase';
import {
  GetDocumentStatusOutput,
  GetDocumentStatusUseCase,
} from '../application/usecase/document/get-document-status.usecase';
import { UploadDocumentDto } from './dtos/upload-document.dto';

/**
 * Rotas (autenticação global + `tenant-id` validado pelo `TenantGuard`):
 *   POST /documents            — cria o documento e enfileira a ingestão (assíncrona)
 *   GET  /documents/:id/status — consulta o status da ingestão
 */
@ApiTags('documents')
@ApiBearerAuth()
@TenantScoped()
@Controller('documents')
export class DocumentController {
  constructor(
    private readonly uploadDocument: UploadDocumentUseCase,
    private readonly getDocumentStatus: GetDocumentStatusUseCase,
  ) {}

  @Post()
  @HttpCode(202)
  @RequirePermissions(PERMISSIONS.DOCUMENT_MANAGE)
  async upload(
    @TenantId() tenantId: string,
    @Body() body: UploadDocumentDto,
  ): Promise<UploadDocumentOutput> {
    return await this.uploadDocument.execute({ tenantId, ...body });
  }

  @Get(':id/status')
  @RequirePermissions(PERMISSIONS.DOCUMENT_READ)
  async status(
    @TenantId() tenantId: string,
    @Param('id') documentId: string,
  ): Promise<GetDocumentStatusOutput> {
    return await this.getDocumentStatus.execute({ tenantId, documentId });
  }
}
