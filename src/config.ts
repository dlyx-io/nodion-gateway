import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODION_API_BASE_URL: z.string().url().default('https://api.nodion.com/v1'),
  PORT: z.coerce.number().int().positive().default(80),
  ADMIN_BOOTSTRAP_KEY: z.string().min(1, 'ADMIN_BOOTSTRAP_KEY is required'),
  DB_DIALECT: z.enum(['sqlite', 'pg']).default('sqlite'),
  DB_PATH: z.string().default('./data/gateway.db'),
  DATABASE_URL: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

export const config = envSchema.parse(process.env);
