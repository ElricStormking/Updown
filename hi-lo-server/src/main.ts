import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = Number(
    configService.getOrThrow<number>('api.port', { infer: true }),
  );
  const frontendOrigin = configService.getOrThrow<string>('frontend.origin');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors({
    origin: frontendOrigin,
    credentials: true,
  });

  await app.listen(port);
}

void bootstrap();
