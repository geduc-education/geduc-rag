import { Module } from '@nestjs/common';
import {
  DATABASE_CONNECTION,
  type IDatabaseConnection,
} from '../../@core/application/adapters/database-connection.interface';
import { WEEKLY_SCHEDULE_REPOSITORY } from './application/interface/repository/weekly-schedule.repository.interface';
import { WeeklyScheduleRepository } from './infra/database/repositories/weekly-schedule.repository';
import { WeeklySchedulesController } from './weekly-schedules.controller';
import { WeeklySchedulesService } from './weekly-schedules.service';

@Module({
  controllers: [WeeklySchedulesController],
  providers: [
    {
      provide: WEEKLY_SCHEDULE_REPOSITORY,
      inject: [DATABASE_CONNECTION],
      useFactory: (db: IDatabaseConnection) => new WeeklyScheduleRepository(db),
    },
    WeeklySchedulesService,
  ],
})
export class WeeklySchedulesModule {}
