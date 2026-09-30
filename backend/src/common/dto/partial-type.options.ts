/**
 * Opções obrigatórias de todo `PartialType(CreateXDto, ...)` deste backend.
 *
 * Por padrão o `PartialType` marca cada campo herdado com um `@IsOptional()`
 * implícito, e `@IsOptional()` pula a validação para `undefined` **e** para
 * `null`. Sem `skipNullProperties: false`, um PATCH com `{ "name": null }`
 * atravessa o `ValidationPipe` intacto, o service repassa o `null` ao banco e
 * a coluna NOT NULL estoura em **500** — quando a resposta correta para um
 * payload inválido é **400**.
 *
 * Com estas opções, o `null` volta a ser validado pelos validadores do próprio
 * campo (`@IsString()`, `@IsBoolean()`, …) e é reprovado antes de chegar ao
 * banco. O contrato de "limpar campo" continua intacto: campo de coluna
 * NULLABLE segue usando `@IsOptional()` no DTO de criação e continua aceitando
 * `null` para apagar o valor; campo de coluna NOT NULL usa
 * `@IsOptionalNotNull()` (ver `common/decorators`).
 *
 * @example
 * export class UpdateXDto extends PartialType(CreateXDto, UPDATE_DTO_PARTIAL_OPTS) {}
 */
export const UPDATE_DTO_PARTIAL_OPTS = { skipNullProperties: false } as const;
