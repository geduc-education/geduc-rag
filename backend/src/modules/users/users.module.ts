import { Module } from '@nestjs/common';
import {
  DATABASE_CONNECTION,
  IDatabaseConnection,
} from '../../@core/application/adapters/database-connection.interface';
import { ProfilesModule } from '../profiles/profiles.module';
import { TenantsModule } from '../tenants/tenants.module';
import { USER_REPOSITORY } from './application/interface/repository/user.repository.interface';
import { UserRepository } from './infra/database/repositories/user.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [ProfilesModule, TenantsModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: USER_REPOSITORY,
      inject: [DATABASE_CONNECTION],
      useFactory: (db: IDatabaseConnection) => new UserRepository(db),
    },
  ],
  exports: [UsersService, USER_REPOSITORY],
})
export class UsersModule {}
