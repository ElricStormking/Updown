import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      service: 'hi-lo-admin',
      ok: true,
      timestamp: new Date().toISOString(),
    };
  }
}

