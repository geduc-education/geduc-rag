import { Global, Module } from '@nestjs/common';
import {
  DATABASE_CONNECTION,
  IDatabaseConnection,
} from '../../@core/application/adapters/database-connection.interface';
import { TENANT_ACCESS_REPOSITORY } from '../tenancy/application/interface/repository/tenant-access.repository.interface';
import { TenantAccessRepository } from '../tenancy/infra/database/repositories/tenant-access.repository';
import { TenantAccessService } from '../tenancy/tenant-access.service';
import { EFFECTIVE_PERMISSIONS_REPOSITORY } from './application/interface/repository/effective-permissions.repository.interface';
import { EffectivePermissionsService } from './effective-permissions.service';
import { EffectivePermissionsRepository } from './infra/database/repositories/effective-permissions.repository';

/**
 * Núcleo de autorização: permissão efetiva (RBAC) e alcance de tenant. Global
 * porque os guards globais (APP_GUARD) e os services de cadastro dependem dos
 * dois — uma instância só, sem import repetido por módulo.
 */
@Global()
@Module({
  providers: [
    {
      provide: EFFECTIVE_PERMISSIONS_REPOSITORY,
      inject: [DATABASE_CONNECTION],
      useFactory: (db: IDatabaseConnection) =>
        new EffectivePermissionsRepository(db),
    },
    {
      provide: TENANT_ACCESS_REPOSITORY,
      inject: [DATABASE_CONNECTION],
      useFactory: (db: IDatabaseConnection) => new TenantAccessRepository(db),
    },
    EffectivePermissionsService,
    TenantAccessService,
  ],
  exports: [EffectivePermissionsService, TenantAccessService],
})
export class RbacModule {}
