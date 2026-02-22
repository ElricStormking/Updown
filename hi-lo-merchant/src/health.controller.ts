import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      service: 'hi-lo-merchant',
      ok: true,
      timestamp: new Date().toISOString(),
    };
  }
}

