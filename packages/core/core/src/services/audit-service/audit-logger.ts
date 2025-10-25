import type { Core } from '@strapi/types';
import type { AuditLogEntry } from './index';

export interface AuditLogger {
  log(entry: AuditLogEntry): Promise<void>;
}

export const createAuditLogger = (strapi: Core.Strapi): AuditLogger => {
  return {
    async log(entry: AuditLogEntry) {
      // Convert the entry to database format
      const dbEntry = {
        document_id: entry.documentId,
        content_type: entry.contentType,
        record_id: entry.recordId,
        action: entry.action,
        timestamp: entry.timestamp || new Date(),
        user_id: entry.userId || null,
        user_info: entry.userInfo || null,
        changes: entry.changes || null,
        metadata: entry.metadata || null,
        locale: entry.metadata?.locale || null,
        status: entry.metadata?.status || null,
      };

      // Insert into audit_logs table
      await strapi.db.connection('audit_logs').insert(dbEntry);
    },
  };
};
