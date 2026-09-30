import { ValidateIf } from 'class-validator';

/**
 * Campo OPCIONAL cuja coluna é NOT NULL no banco: ausente (`undefined`) é
 * aceito, mas `null` explícito é validado — e reprovado pelos validadores do
 * campo (400) em vez de chegar ao banco e virar 500.
 *
 * Contraste com `@IsOptional()`, que pula a validação para `undefined` E para
 * `null`. Nos DTOs deste projeto a distinção é o contrato de "limpar campo" via
 * PATCH: coluna nullable usa `@IsOptional()` (enviar `null` grava null e limpa
 * o valor); coluna NOT NULL usa este decorator (enviar `null` é 400).
 */
export function IsOptionalNotNull(): PropertyDecorator {
  return ValidateIf((_object: unknown, value: unknown) => value !== undefined);
}
