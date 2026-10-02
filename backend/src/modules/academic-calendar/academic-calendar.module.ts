import { Module } from '@nestjs/common';
import {
  DATABASE_CONNECTION,
  type IDatabaseConnection,
} from '../../@core/application/adapters/database-connection.interface';
import { AcademicCalendarController } from './academic-calendar.controller';
import { AcademicCalendarService } from './academic-calendar.service';
import { ACADEMIC_CALENDAR_REPOSITORY } from './application/interface/repository/academic-calendar.repository.interface';
import { AcademicCalendarRepository } from './infra/database/repositories/academic-calendar.repository';

@Module({
  controllers: [AcademicCalendarController],
  providers: [
    {
      provide: ACADEMIC_CALENDAR_REPOSITORY,
      inject: [DATABASE_CONNECTION],
      useFactory: (db: IDatabaseConnection) =>
        new AcademicCalendarRepository(db),
    },
    AcademicCalendarService,
  ],
})
export class AcademicCalendarModule {}
