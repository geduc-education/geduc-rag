import { Module } from '@nestjs/common';
import {
  DATABASE_CONNECTION,
  type IDatabaseConnection,
} from '../../@core/application/adapters/database-connection.interface';
import { SUBJECT_REPOSITORY } from './application/interface/repository/subject.repository.interface';
import { SubjectRepository } from './infra/database/repositories/subject.repository';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';

@Module({
  controllers: [SubjectsController],
  providers: [
    {
      provide: SUBJECT_REPOSITORY,
      inject: [DATABASE_CONNECTION],
      useFactory: (db: IDatabaseConnection) => new SubjectRepository(db),
    },
    SubjectsService,
  ],
})
export class SubjectsModule {}
