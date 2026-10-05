import { Module } from '@nestjs/common';
import {
  DATABASE_CONNECTION,
  type IDatabaseConnection,
} from '../../@core/application/adapters/database-connection.interface';
import { SCHOOL_LESSON_SLOT_REPOSITORY } from './application/interface/repository/school-lesson-slot.repository.interface';
import { SCHOOL_REPOSITORY } from './application/interface/repository/school.repository.interface';
import { SchoolLessonSlotRepository } from './infra/database/repositories/school-lesson-slot.repository';
import { SchoolRepository } from './infra/database/repositories/school.repository';
import { SchoolLessonSlotsController } from './school-lesson-slots.controller';
import { SchoolLessonSlotsService } from './school-lesson-slots.service';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';

@Module({
  controllers: [SchoolsController, SchoolLessonSlotsController],
  providers: [
    {
      provide: SCHOOL_REPOSITORY,
      inject: [DATABASE_CONNECTION],
      useFactory: (db: IDatabaseConnection) => new SchoolRepository(db),
    },
    {
      provide: SCHOOL_LESSON_SLOT_REPOSITORY,
      inject: [DATABASE_CONNECTION],
      useFactory: (db: IDatabaseConnection) =>
        new SchoolLessonSlotRepository(db),
    },
    SchoolsService,
    SchoolLessonSlotsService,
  ],
})
export class SchoolsModule {}
