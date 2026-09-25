import { ApiProperty } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ description: 'Perfil de seed (não removível).' })
  system!: boolean;

  @ApiProperty({ type: [String], description: 'Chaves de permissão.' })
  permissions!: string[];
}
