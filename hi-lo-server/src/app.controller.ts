import { Controller, Get, Redirect } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('admin')
  @Redirect(undefined, 302)
  redirectAdmin() {
    const url =
      this.configService.get<string>('routing.adminUiUrl') ??
      'http://localhost:4002/admin';
    return { url };
  }

  @Get('health')
  getHealth() {
    return {
      service: 'hi-lo-server',
      ok: true,
      timestamp: new Date().toISOString(),
    };
  }
}
