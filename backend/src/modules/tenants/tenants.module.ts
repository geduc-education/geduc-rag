import { Module } from '@nestjs/common';
import {
  DATABASE_CONNECTION,
  type IDatabaseConnection,
} from '../../@core/application/adapters/database-connection.interface';
import { TENANT_REPOSITORY } from './application/interface/repository/tenant.repository.interface';
import { TenantRepository } from './infra/database/repositories/tenant.repository';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  controllers: [TenantsController],
  providers: [
    {
      provide: TENANT_REPOSITORY,
      inject: [DATABASE_CONNECTION],
      useFactory: (db: IDatabaseConnection) => new TenantRepository(db),
    },
    TenantsService,
  ],
  exports: [TENANT_REPOSITORY],
})
export class TenantsModule {}
