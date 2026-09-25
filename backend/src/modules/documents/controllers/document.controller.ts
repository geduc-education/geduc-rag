import {
  BadRequestException,
  CallHandler,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  HttpCode,
  Injectable,
  NestInterceptor,
  Param,
  PayloadTooLargeException,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Observable, catchError, throwError } from 'rxjs';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { ERROR_CODES } from '../../../common/errors/error-codes';
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
import {
  ListDocumentsOutput,
  ListDocumentsUseCase,
} from '../application/usecase/document/list-documents.usecase';
import { DeleteDocumentUseCase } from '../application/usecase/document/delete-document.usecase';
import { UploadDocumentDto } from './dtos/upload-document.dto';
import { ListDocumentsDto } from './dtos/list-documents.dto';

/**
 * O `FileInterceptor` converte o `LIMIT_FILE_SIZE` do multer num
 * `PayloadTooLargeException` sem `code`. Este interceptor (externo ao
 * `FileInterceptor`) acrescenta o `ATTACHMENT_TOO_LARGE` do contrato, escopado
 * à rota de upload.
 */
@Injectable()
export class AttachmentTooLargeInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof PayloadTooLargeException
            ? new PayloadTooLargeException({
                code: ERROR_CODES.ATTACHMENT_TOO_LARGE,
                message: 'Arquivo excede o limite permitido.',
              })
            : error,
        ),
      ),
    );
  }
}

/**
 * O busboy decodifica o `filename` do multipart como latin1; o navegador envia
 * UTF-8. Reinterpreta os bytes para preservar acentos (`Relatório_ação.md`).
 */
function decodeOriginalName(originalname: string): string {
  return Buffer.from(originalname, 'latin1').toString('utf8');
}

/**
 * Rotas (autenticação global + `tenant-id` validado pelo `TenantGuard`):
 *   POST   /documents            — upload multipart; extrai o texto e enfileira a ingestão
 *   GET    /documents            — lista paginada dos documentos do tenant
 *   GET    /documents/:id/status — consulta o status da ingestão
 *   DELETE /documents/:id        — remove o documento e os vetores dele
 */
@ApiTags('documents')
@ApiBearerAuth()
@TenantScoped()
@Controller('documents')
export class DocumentController {
  constructor(
    private readonly uploadDocument: UploadDocumentUseCase,
    private readonly getDocumentStatus: GetDocumentStatusUseCase,
    private readonly listDocuments: ListDocumentsUseCase,
    private readonly deleteDocument: DeleteDocumentUseCase,
  ) {}

  @Post()
  @HttpCode(202)
  @RequirePermissions(PERMISSIONS.DOCUMENT_MANAGE)
  @UseInterceptors(AttachmentTooLargeInterceptor, FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadDocumentDto })
  @ApiPayloadTooLargeResponse({
    description: 'Arquivo acima de DOCUMENT_MAX_UPLOAD_BYTES.',
  })
  async upload(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UploadDocumentOutput> {
    if (!file) throw new BadRequestException('Campo file é obrigatório.');
    return await this.uploadDocument.execute({
      tenantId,
      userId,
      filename: decodeOriginalName(file.originalname),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      buffer: file.buffer,
    });
  }

  @Get()
  @RequirePermissions(PERMISSIONS.DOCUMENT_READ)
  async list(
    @TenantId() tenantId: string,
    @Query() query: ListDocumentsDto,
  ): Promise<ListDocumentsOutput> {
    return await this.listDocuments.execute({
      tenantId,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get(':id/status')
  @RequirePermissions(PERMISSIONS.DOCUMENT_READ)
  async status(
    @TenantId() tenantId: string,
    @Param('id') documentId: string,
  ): Promise<GetDocumentStatusOutput> {
    return await this.getDocumentStatus.execute({ tenantId, documentId });
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.DOCUMENT_MANAGE)
  @ApiNoContentResponse({ description: 'Documento removido.' })
  @ApiNotFoundResponse({ description: 'Documento inexistente no tenant.' })
  async remove(
    @TenantId() tenantId: string,
    @Param('id') documentId: string,
  ): Promise<void> {
    await this.deleteDocument.execute({ tenantId, documentId });
  }
}
