import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ChangelogService } from './changelog.service';
import { ChangelogQueryDto } from './dto/changelog-query.dto';
import { ChangelogFeedDto } from './dto/changelog-response.dto';

/**
 * Feed de novidades do produto. Basta estar autenticado (`JwtAuthGuard`
 * global): sem permissão específica e sem escopo de tenant.
 */
@ApiTags('changelog')
@ApiBearerAuth()
@Controller('changelog')
export class ChangelogController {
  constructor(private readonly changelogService: ChangelogService) {}

  @Get()
  @ApiResponse({ status: 200, type: ChangelogFeedDto })
  @ApiResponse({
    status: 502,
    description:
      'CHANGELOG_SOURCE_UNAVAILABLE — GitHub indisponível e sem cache.',
  })
  list(@Query() query: ChangelogQueryDto): Promise<ChangelogFeedDto> {
    return this.changelogService.list(query.limit);
  }
}
