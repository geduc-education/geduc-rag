import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ChangelogController } from './changelog.controller';
import { ChangelogService } from './changelog.service';
import { GithubPullsClient } from './github-pulls.client';

@Module({
  controllers: [ChangelogController],
  providers: [
    ChangelogService,
    {
      provide: GithubPullsClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new GithubPullsClient({
          baseBranch: config.getOrThrow<string>('GITHUB_BASE_BRANCH'),
          token: config.get<string>('GITHUB_TOKEN'),
          timeoutMs: config.getOrThrow<number>('GITHUB_TIMEOUT_MS'),
        }),
    },
  ],
})
export class ChangelogModule {}
