import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
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
import { ChatQueryResponseDto } from './dtos/chat-query-response.dto';
import { SendMessageDto } from './dtos/send-message.dto';

/**
 * POST /chat/query — pergunta em linguagem natural; RAG ponta a ponta
 * (retrieval + generation). A conversa pertence a (tenant, usuário): um
 * `conversationId` de outro usuário ou inexistente responde 404. Rate limit por IP (`rag-query`): protege o custo
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
  @ApiOkResponse({ type: ChatQueryResponseDto })
  @ApiNotFoundResponse({
    description: 'Conversa inexistente ou de outro usuário.',
  })
  async query(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() body: SendMessageDto,
  ): Promise<SendMessageOutput> {
    return await this.sendMessage.execute({ tenantId, userId, ...body });
  }
}
