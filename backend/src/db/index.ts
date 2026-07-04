import { drizzle } from 'drizzle-orm/d1';
import * as coreSchema from './schema';
import * as serviceSchema from './services-schema';

const schema = { ...coreSchema, ...serviceSchema };

export type Database = ReturnType<typeof createDb>;

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema, logger: false });
}

export { schema };
export * from './schema';
export * from './services-schema';
