import { OmitType, PartialType } from '@nestjs/swagger';
import { UPDATE_DTO_PARTIAL_OPTS } from '../../../common/dto/partial-type.options';
import { CreateUserDto } from './create-user.dto';

/**
 * Atualização de usuário. Todos os campos opcionais; `profileIds` substitui o
 * conjunto inteiro.
 *
 * Fora do payload (OmitType): `password` — reset tem endpoint próprio
 * (`POST /users/:id/reset-password`) e a troca voluntária é via `auth` — e
 * `tenantIds` — vínculo tem endpoint próprio (`PUT /users/:id/tenants`).
 * Aceitá-los e ignorá-los em silêncio seria pior que o 400 do
 * `forbidNonWhitelisted`.
 */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'tenantIds'] as const),
  UPDATE_DTO_PARTIAL_OPTS,
) {}
