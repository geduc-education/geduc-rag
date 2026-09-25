import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions';
import {
  TenantId,
  TenantScoped,
} from '../../../common/tenancy/tenant-scoped.decorator';
import {
  SendMessageOutput,
  SendMessageUseCase,
} from '../application/usecase/chat/send-message.usecase';
import { SendMessageDto } from './dtos/send-message.dto';

/**
 * POST /chat/query — pergunta em linguagem natural; RAG ponta a ponta
 * (retrieval + generation). Rate limit por IP (`rag-query`): protege o custo
 * de LLM.
 */
@ApiTags('chat')
@ApiBearerAuth()
@TenantScoped()
@Controller('chat')
export class ChatController {
  constructor(private readonly sendMessage: SendMessageUseCase) {}

  @Post('query')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @RequirePermissions(PERMISSIONS.CHAT_QUERY)
  async query(
    @TenantId() tenantId: string,
    @Body() body: SendMessageDto,
  ): Promise<SendMessageOutput> {
    return await this.sendMessage.execute({ tenantId, ...body });
  }
}
