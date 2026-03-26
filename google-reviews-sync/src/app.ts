import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import googleReviewsRouter from './routes/google-reviews';
import { errorHandler } from './middleware/error-handler';
import { requestContext } from './middleware/request-context';

/**
 * Creates and configures the Express application.
 * Separated from server startup (index.ts) for testability with supertest.
 */
export function createApp(): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(requestContext);

  // Swagger documentation - resolve route files from both src and dist
  const isCompiled = __filename.endsWith('.js');
  const routeGlob = isCompiled
    ? path.join(__dirname, 'routes', '*.js')
    : path.join(__dirname, 'routes', '*.ts');

  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Google Reviews Sync API',
        version: '1.0.0',
        description:
          'Integration service that attempts to sync restaurant feedback to Google Reviews. ' +
          'Handles eligibility checks, provider limitations, idempotency, retries with exponential backoff, ' +
          'and fallback review-prompt paths.',
      },
      servers: [
        { url: 'http://localhost:3000', description: 'Local development' },
      ],
    },
    apis: [routeGlob],
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use('/integrations/google-reviews', googleReviewsRouter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Global error handler (must be registered last)
  app.use(errorHandler);

  return app;
}
