import type { Core } from '@strapi/types';
import { createAuditLogger } from './audit-logger.js';
import { createDiffGenerator } from './diff-generator.js';

export interface AuditLogEntry {
  documentId: string;
  contentType: string;
  recordId: string;
  action: 'create' | 'update' | 'delete' | 'publish' | 'unpublish';
  timestamp: Date;
  userId?: number;
  userInfo?: {
    username?: string;
    email?: string;
  };
  changes?: any;
  metadata?: {
    locale?: string;
    status?: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface AuditServiceConfig {
  enabled: boolean;
  excludeContentTypes: string[];
  excludeFields: string[];
  retentionDays?: number;
  batchSize?: number;
  asyncProcessing?: boolean;
  includeMetadata?: {
    userAgent?: boolean;
    ipAddress?: boolean;
    locale?: boolean;
  };
}

export interface AuditService {
  log(entry: AuditLogEntry): Promise<void>;
  findMany(filters?: AuditLogFilters): Promise<AuditLogEntry[]>;
  findPage(filters?: AuditLogFilters & { page?: number; pageSize?: number }): Promise<{
    data: AuditLogEntry[];
    meta: {
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        pageCount: number;
      };
    };
  }>;
  isEnabled(): boolean;
  shouldExcludeContentType(contentType: string): boolean;
}

export interface AuditLogFilters {
  contentType?: string;
  userId?: number;
  action?: string | string[];
  startDate?: Date;
  endDate?: Date;
  recordId?: string;
  documentId?: string;
}

const createAuditService = (strapi: Core.Strapi): AuditService => {
  const config = strapi.config.get('auditLog', {
    enabled: true,
    excludeContentTypes: [],
    excludeFields: ['password', 'resetPasswordToken'],
    retentionDays: 365,
    batchSize: 100,
    asyncProcessing: true,
    includeMetadata: {
      userAgent: true,
      ipAddress: true,
      locale: true,
    },
  }) as AuditServiceConfig;

  const logger = createAuditLogger(strapi);
  const diffGenerator = createDiffGenerator(config.excludeFields);

  const service: AuditService = {
    async log(entry: AuditLogEntry) {
      if (!config.enabled) {
        return;
      }

      if (service.shouldExcludeContentType(entry.contentType)) {
        return;
      }

      try {
        await logger.log(entry);
      } catch (error) {
        // Log error but don't throw to avoid breaking main operations
        strapi.log.error('Audit logging failed:', error);
      }
    },

    async findMany(filters = {}) {
      const query = buildQuery(filters);
      const results = await strapi.db.query('audit-logs').findMany(query);
      return results.map(formatAuditLogEntry);
    },

    async findPage(filters = {}) {
      const { page = 1, pageSize = 25, ...queryFilters } = filters;
      const query = buildQuery(queryFilters);
      
      const results = await strapi.db.query('audit-logs').findPage({
        ...query,
        page,
        pageSize,
      });

      return {
        data: results.results.map(formatAuditLogEntry),
        meta: {
          pagination: results.pagination,
        },
      };
    },

    isEnabled() {
      return config.enabled;
    },

    shouldExcludeContentType(contentType: string) {
      return config.excludeContentTypes.includes(contentType);
    },
  };

  return service;
};

const buildQuery = (filters: AuditLogFilters) => {
  const where: any = {};
  const orderBy = { timestamp: 'desc' };

  if (filters.contentType) {
    where.content_type = filters.contentType;
  }

  if (filters.userId) {
    where.user_id = filters.userId;
  }

  if (filters.action) {
    if (Array.isArray(filters.action)) {
      where.action = { $in: filters.action };
    } else {
      where.action = filters.action;
    }
  }

  if (filters.recordId) {
    where.record_id = filters.recordId;
  }

  if (filters.documentId) {
    where.document_id = filters.documentId;
  }

  if (filters.startDate || filters.endDate) {
    where.timestamp = {};
    if (filters.startDate) {
      where.timestamp.$gte = filters.startDate;
    }
    if (filters.endDate) {
      where.timestamp.$lte = filters.endDate;
    }
  }

  return { where, orderBy };
};

const formatAuditLogEntry = (dbEntry: any): AuditLogEntry => ({
  documentId: dbEntry.document_id,
  contentType: dbEntry.content_type,
  recordId: dbEntry.record_id,
  action: dbEntry.action,
  timestamp: dbEntry.timestamp,
  userId: dbEntry.user_id,
  userInfo: dbEntry.user_info,
  changes: dbEntry.changes,
  metadata: dbEntry.metadata,
});

export { createAuditService, createDiffGenerator };
export default createAuditService;
