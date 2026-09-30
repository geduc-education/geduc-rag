import { Module } from '@nestjs/common';
import {
  DATABASE_CONNECTION,
  IDatabaseConnection,
} from '../../@core/application/adapters/database-connection.interface';
import { PROFILE_REPOSITORY } from './application/interface/repository/profile.repository.interface';
import { ProfileRepository } from './infra/database/repositories/profile.repository';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  controllers: [ProfilesController],
  providers: [
    {
      provide: PROFILE_REPOSITORY,
      inject: [DATABASE_CONNECTION],
      useFactory: (db: IDatabaseConnection) => new ProfileRepository(db),
    },
    ProfilesService,
  ],
  exports: [PROFILE_REPOSITORY],
})
export class ProfilesModule {}
