import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, check } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  accountId: text('account_id').primaryKey(), userId: text('user_id').notNull().unique(),
  emailAtBinding: text('email_at_binding').notNull(), createdAt: text('created_at').notNull(),
}, table => [check('account_slot', sql`${table.accountId} IN ('gairo', 'ricardo')`)]);

export const workspaces = sqliteTable('workspaces', {
  accountId: text('account_id').primaryKey().references(() => accounts.accountId),
  schemaVersion: integer('schema_version').notNull().default(1), revision: integer('revision').notNull(),
  dataJson: text('data_json').notNull(), receiptsJson: text('receipts_json').notNull().default('[]'),
  migrationHash: text('migration_hash'), updatedAt: text('updated_at').notNull(),
}, table => [check('positive_revision', sql`${table.revision} > 0`)]);

export const aiLimits = sqliteTable('ai_limits', {
  accountId: text('account_id').primaryKey().references(() => accounts.accountId),
  windowStart: integer('window_start').notNull(), requestCount: integer('request_count').notNull(),
  leaseId: text('lease_id'), leaseUntil: integer('lease_until').notNull(),
});
