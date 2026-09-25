import { Global, Module } from '@nestjs/common';
import { TenantAccessService } from '../tenancy/tenant-access.service';
import { EffectivePermissionsService } from './effective-permissions.service';

/**
 * Núcleo de autorização: permissão efetiva (RBAC) e alcance de tenant. Global
 * porque os guards globais (APP_GUARD) e os services de cadastro dependem dos
 * dois — uma instância só, sem import repetido por módulo.
 */
@Global()
@Module({
  providers: [EffectivePermissionsService, TenantAccessService],
  exports: [EffectivePermissionsService, TenantAccessService],
})
export class RbacModule {}
