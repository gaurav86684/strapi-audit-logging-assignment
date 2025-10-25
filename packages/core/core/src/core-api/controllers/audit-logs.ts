import type { Core } from '@strapi/types';

export interface AuditLogsController {
  find(ctx: any): Promise<void>;
  findOne(ctx: any): Promise<void>;
}

const createAuditLogsController = (strapi: Core.Strapi): AuditLogsController => {
  const auditService = strapi.service('audit-service');

  return {
    async find(ctx) {
      const { query } = ctx.request;
      
      // Parse query parameters
      const filters: any = {};
      
      if (query.contentType) {
        filters.contentType = query.contentType;
      }
      
      if (query.userId) {
        filters.userId = parseInt(query.userId, 10);
      }
      
      if (query.action) {
        filters.action = Array.isArray(query.action) ? query.action : [query.action];
      }
      
      if (query.recordId) {
        filters.recordId = query.recordId;
      }
      
      if (query.documentId) {
        filters.documentId = query.documentId;
      }
      
      if (query.startDate) {
        filters.startDate = new Date(query.startDate);
      }
      
      if (query.endDate) {
        filters.endDate = new Date(query.endDate);
      }

      // Parse pagination
      const page = query.page ? parseInt(query.page, 10) : 1;
      const pageSize = Math.min(
        query.pageSize ? parseInt(query.pageSize, 10) : 25,
        100 // Max page size
      );

      try {
        const result = await auditService.findPage({
          ...filters,
          page,
          pageSize,
        });

        ctx.body = {
          data: result.data,
          meta: result.meta,
        };
      } catch (error) {
        strapi.log.error('Error fetching audit logs:', error);
        ctx.throw(500, 'Internal server error');
      }
    },

    async findOne(ctx) {
      const { id } = ctx.params;

      try {
        // Find the specific audit log entry
        const results = await auditService.findMany({});
        const auditLog = results.find((log: any) => log.id === parseInt(id, 10));

        if (!auditLog) {
          ctx.throw(404, 'Audit log not found');
        }

        ctx.body = {
          data: auditLog,
        };
      } catch (error: any) {
        if (error.status === 404) {
          throw error;
        }
        
        strapi.log.error('Error fetching audit log:', error);
        ctx.throw(500, 'Internal server error');
      }
    },
  };
};

export default createAuditLogsController;
