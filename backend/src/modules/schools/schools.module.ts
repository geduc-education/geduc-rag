import { Module } from '@nestjs/common';
import {
  DATABASE_CONNECTION,
  type IDatabaseConnection,
} from '../../@core/application/adapters/database-connection.interface';
import { SCHOOL_REPOSITORY } from './application/interface/repository/school.repository.interface';
import { SchoolRepository } from './infra/database/repositories/school.repository';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';

@Module({
  controllers: [SchoolsController],
  providers: [
    {
      provide: SCHOOL_REPOSITORY,
      inject: [DATABASE_CONNECTION],
      useFactory: (db: IDatabaseConnection) => new SchoolRepository(db),
    },
    SchoolsService,
  ],
})
export class SchoolsModule {}
