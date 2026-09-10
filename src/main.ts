import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api', {
    exclude: [
      { path: '', method: RequestMethod.GET },
      { path: '/', method: RequestMethod.GET },
      { path: 'health', method: RequestMethod.GET },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    process.env.CLIENT_URL,
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser requests (Postman, curl, server-to-server)
      if (!origin) return callback(null, true);

      try {
        const hostname = new URL(origin).hostname;
        const isVercel =
          /\.vercel\.app$/.test(hostname) ||
          hostname === 'localhost' ||
          hostname === '127.0.0.1';

        if (isVercel || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
      } catch {
        // Fallback check
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.PORT || 5000;
  await app.listen(port);
  logger.log(`🚀 Weekly Report Server running on: http://localhost:${port}/api`);
}
bootstrap();
