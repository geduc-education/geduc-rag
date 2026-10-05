import { Module } from '@nestjs/common';
import {
  DATABASE_CONNECTION,
  type IDatabaseConnection,
} from '../../@core/application/adapters/database-connection.interface';
import { SCHOOL_CLASS_REPOSITORY } from './application/interface/repository/school-class.repository.interface';
import { SchoolClassRepository } from './infra/database/repositories/school-class.repository';
import { SchoolClassesController } from './school-classes.controller';
import { SchoolClassesService } from './school-classes.service';

@Module({
  controllers: [SchoolClassesController],
  providers: [
    {
      provide: SCHOOL_CLASS_REPOSITORY,
      inject: [DATABASE_CONNECTION],
      useFactory: (db: IDatabaseConnection) => new SchoolClassRepository(db),
    },
    SchoolClassesService,
  ],
})
export class SchoolClassesModule {}
