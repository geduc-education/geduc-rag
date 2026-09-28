import { ApiProperty } from '@nestjs/swagger';

import type {
  ChangelogFeed,
  ChangelogItem,
  ChangelogType,
} from '../changelog.types';

export class ChangelogItemDto implements ChangelogItem {
  @ApiProperty({
    enum: ['feat', 'fix', 'refactor'],
    description: 'Tipo Conventional Commits do título do PR.',
  })
  type!: ChangelogType;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Escopo do título.',
  })
  scope!: string | null;

  @ApiProperty({ description: 'Título marcado com `!` (breaking change).' })
  breaking!: boolean;

  @ApiProperty({ description: 'Descrição do título, sem tipo e escopo.' })
  title!: string;

  @ApiProperty({ description: 'Número do PR.' })
  number!: number;

  @ApiProperty({ description: 'URL do PR no GitHub.' })
  url!: string;

  @ApiProperty({ description: 'Data do merge (ISO 8601).' })
  mergedAt!: string;
}

export class ChangelogFeedDto implements ChangelogFeed {
  @ApiProperty({ description: 'Falso quando GITHUB_REPO não está definido.' })
  configured!: boolean;

  @ApiProperty({ nullable: true, type: String, description: 'owner/nome.' })
  repository!: string | null;

  @ApiProperty({
    type: [ChangelogItemDto],
    description: 'Itens por mergedAt decrescente.',
  })
  items!: ChangelogItemDto[];

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'ISO 8601 da última busca bem-sucedida.',
  })
  fetchedAt!: string | null;

  @ApiProperty({
    description:
      'Verdadeiro quando o GitHub falhou e o cache anterior foi servido.',
  })
  stale!: boolean;
}
