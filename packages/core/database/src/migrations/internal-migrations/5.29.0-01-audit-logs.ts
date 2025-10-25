import type { Knex } from 'knex';
import type { Migration } from '../common';

const AUDIT_LOGS_TABLE = 'audit_logs';

const createAuditLogsTable = async (knex: Knex) => {
  const hasTable = await knex.schema.hasTable(AUDIT_LOGS_TABLE);
  
  if (hasTable) {
    return;
  }

  await knex.schema.createTable(AUDIT_LOGS_TABLE, (table) => {
    // Primary key
    table.increments('id').primary();
    
    // Document and content type information
    table.string('document_id').notNullable();
    table.string('content_type').notNullable();
    table.string('record_id').notNullable();
    
    // Action information
    table.enum('action', ['create', 'update', 'delete', 'publish', 'unpublish']).notNullable();
    table.timestamp('timestamp', { useTz: true }).defaultTo(knex.fn.now()).notNullable();
    
    // User information (nullable for anonymous operations)
    table.integer('user_id').unsigned().nullable();
    table.jsonb('user_info').nullable(); // Store username, email for historical record
    
    // Change tracking
    table.jsonb('changes').nullable(); // Store before/after states, diffs
    table.jsonb('metadata').nullable(); // Store IP, user agent, locale, status, etc.
    
    // Locale and status context
    table.string('locale').nullable();
    table.string('status').nullable(); // draft, published
    
    // Timestamps
    table.timestamps(true, true);
    
    // Indexes for efficient querying
    table.index(['content_type', 'timestamp'], 'audit_logs_content_type_timestamp_idx');
    table.index(['user_id', 'timestamp'], 'audit_logs_user_id_timestamp_idx');
    table.index(['record_id', 'content_type'], 'audit_logs_record_content_type_idx');
    table.index(['timestamp', 'action'], 'audit_logs_timestamp_action_idx');
    table.index(['document_id'], 'audit_logs_document_id_idx');
  });
};

const dropAuditLogsTable = async (knex: Knex) => {
  const hasTable = await knex.schema.hasTable(AUDIT_LOGS_TABLE);
  
  if (hasTable) {
    await knex.schema.dropTable(AUDIT_LOGS_TABLE);
  }
};

export const createAuditLogs: Migration = {
  name: '5.29.0-01-audit-logs',
  async up(knex: Knex) {
    await createAuditLogsTable(knex);
  },
  async down(knex: Knex) {
    await dropAuditLogsTable(knex);
  },
};
