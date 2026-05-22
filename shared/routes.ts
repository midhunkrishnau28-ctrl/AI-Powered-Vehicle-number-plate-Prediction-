import { z } from 'zod';
import { insertReportSchema, reports } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  reports: {
    list: {
      method: 'GET' as const,
      path: '/api/reports',
      responses: {
        200: z.array(z.custom<typeof reports.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/reports/:id',
      responses: {
        200: z.custom<typeof reports.$inferSelect>(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/reports',
      input: z.object({
        image: z.string(), // Base64
        filename: z.string(),
      }),
      responses: {
        201: z.custom<typeof reports.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/reports/:id',
      responses: {
        200: z.any(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
        500: errorSchemas.internal,
      },
    },
  },
  video: {
    create: {
      method: 'POST' as const,
      path: '/api/video-reports',
      input: z.object({
        video: z.string(), // Base64
        filename: z.string(),
        frameImage: z.string().optional(), // Optional: captured frame
      }),
      responses: {
        201: z.custom<typeof reports.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
  },
  user: {
    update: {
      method: 'PATCH' as const,
      path: '/api/user',
      input: z.object({
        username: z.string().optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        profileImageUrl: z.string().optional(), // Base64 or URL
      }),
      responses: {
        200: z.any(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
