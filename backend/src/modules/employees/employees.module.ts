import { Module } from '@nestjs/common';
import {
  DATABASE_CONNECTION,
  type IDatabaseConnection,
} from '../../@core/application/adapters/database-connection.interface';
import { EMPLOYEE_REPOSITORY } from './application/interface/repository/employee.repository.interface';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmployeeRepository } from './infra/database/repositories/employee.repository';

@Module({
  controllers: [EmployeesController],
  providers: [
    {
      provide: EMPLOYEE_REPOSITORY,
      inject: [DATABASE_CONNECTION],
      useFactory: (db: IDatabaseConnection) => new EmployeeRepository(db),
    },
    EmployeesService,
  ],
})
export class EmployeesModule {}
