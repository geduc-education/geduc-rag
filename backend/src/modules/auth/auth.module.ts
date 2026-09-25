import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/** Login, troca de senha e sessão. O JwtModule é global (AppModule). */
@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
