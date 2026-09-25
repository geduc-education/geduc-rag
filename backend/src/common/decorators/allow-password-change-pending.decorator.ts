import { SetMetadata } from '@nestjs/common';

export const ALLOW_PWD_CHANGE_PENDING_KEY = 'allowPasswordChangePending';

/**
 * Libera uma rota mesmo quando o usuário está com `mustChangePassword=true`.
 * Aplicado nas rotas de troca de senha e logout — todas as demais ficam
 * bloqueadas pelo `MustChangePasswordGuard` até a troca ser feita.
 */
export const AllowPasswordChangePending = () =>
  SetMetadata(ALLOW_PWD_CHANGE_PENDING_KEY, true);
