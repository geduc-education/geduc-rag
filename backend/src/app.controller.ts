import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Liveness para probes/Nginx — público e fora do request log. */
  @Public()
  @Get('health')
  health(): { status: string } {
    return this.appService.health();
  }
}
