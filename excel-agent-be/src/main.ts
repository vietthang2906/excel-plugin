import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function bootstrap() {
  const homeDir = os.homedir();
  const httpsOptions = {
    key: fs.readFileSync(path.join(homeDir, '.office-addin-dev-certs', 'localhost.key')),
    cert: fs.readFileSync(path.join(homeDir, '.office-addin-dev-certs', 'localhost.crt')),
  };

  const app = await NestFactory.create(AppModule, {
    httpsOptions,
  });
  
  // Enable CORS for the Excel Add-in frontend
  app.enableCors();
  
  // Increase payload limit to handle large Excel contexts
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
