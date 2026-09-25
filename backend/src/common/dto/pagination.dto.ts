import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Paginação das listagens. Base ÚNICA: o par `page`/`limit` estava copiado
 * byte a byte em cada DTO de lista, e com ele o teto de 100 — que o Swagger
 * então documentava por módulo, livre para divergir.
 *
 * `@Type(() => Number)` é obrigatório: query string chega como texto e o
 * `@IsInt()` reprovaria `"2"`.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
