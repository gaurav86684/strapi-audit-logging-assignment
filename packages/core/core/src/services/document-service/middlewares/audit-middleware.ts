import type { Core } from '@strapi/types';
import type { AuditLogEntry } from '../../audit-service/index.js';
import { createDiffGenerator } from '../../audit-service/diff-generator.js';

export interface AuditMiddlewareContext {
  uid: string;
  action: string;
  params: any;
  contentType: any;
}

export const createAuditMiddleware = (strapi: Core.Strapi) => {
  const auditService = strapi.service('audit-service');
  const diffGenerator = createDiffGenerator();

  return async (ctx: AuditMiddlewareContext, next: () => Promise<any>) => {
    // Skip if audit logging is disabled
    if (!auditService?.isEnabled()) {
      return next();
    }

    // Skip if content type is excluded
    if (auditService?.shouldExcludeContentType(ctx.uid)) {
      return next();
    }

    const { uid, action, params } = ctx;
    let beforeData: any = null;
    let result: any = null;

    // For update and delete operations, capture the before state
    if ((action === 'update' || action === 'delete') && params.documentId) {
      try {
        beforeData = await strapi.documents(uid).findOne({
          documentId: params.documentId,
          locale: params.locale,
          status: params.status || 'draft',
        });
      } catch (error) {
        // Continue if we can't fetch before state
        strapi.log.warn('Could not fetch before state for audit log:', error);
      }
    }

    // Execute the original operation
    result = await next();

    // Create audit log entry
    try {
      await createAuditLogEntry({
        strapi,
        auditService,
        diffGenerator,
        uid,
        action,
        params,
        beforeData,
        afterData: result,
      });
    } catch (error) {
      // Log audit error but don't fail the main operation
      strapi.log.error('Failed to create audit log entry:', error);
    }

    return result;
  };
};

const createAuditLogEntry = async ({
  strapi,
  auditService,
  diffGenerator,
  uid,
  action,
  params,
  beforeData,
  afterData,
}: {
  strapi: Core.Strapi;
  auditService: any;
  diffGenerator: any;
  uid: string;
  action: string;
  params: any;
  beforeData: any;
  afterData: any;
}) => {
  // Get current user context
  const user = strapi.requestContext?.get()?.state?.user;
  
  // Get request metadata
  const request = strapi.requestContext?.get()?.request;
  const userAgent = request?.headers?.['user-agent'];
  const ipAddress = request?.ip || request?.connection?.remoteAddress;

  // Determine the document and record IDs
  let documentId: string;
  let recordId: string;

  if (afterData) {
    documentId = afterData.documentId || afterData.id;
    recordId = afterData.id || afterData.documentId;
  } else if (beforeData) {
    documentId = beforeData.documentId || beforeData.id;
    recordId = beforeData.id || beforeData.documentId;
  } else if (params.documentId) {
    documentId = params.documentId;
    recordId = params.documentId; // fallback
  } else {
    // Skip if we can't determine the document/record ID
    return;
  }

  // Generate changes diff
  let changes: any = null;
  if (action === 'create') {
    changes = diffGenerator.generateDiff(null, afterData);
  } else if (action === 'update') {
    changes = diffGenerator.generateDiff(beforeData, afterData);
  } else if (action === 'delete') {
    changes = diffGenerator.generateDiff(beforeData, null);
  } else if (action === 'publish' || action === 'unpublish') {
    // For publish/unpublish, we mainly care about the status change
    changes = {
      publishedAt: {
        from: beforeData?.publishedAt || null,
        to: afterData?.publishedAt || null,
      },
    };
  }

  // Create the audit log entry
  const auditEntry: AuditLogEntry = {
    documentId,
    contentType: uid,
    recordId,
    action: mapActionToAuditAction(action),
    timestamp: new Date(),
    userId: user?.id,
    userInfo: user ? {
      username: user.username,
      email: user.email,
    } : undefined,
    changes,
    metadata: {
      locale: params.locale || afterData?.locale || beforeData?.locale,
      status: params.status || afterData?.publishedAt ? 'published' : 'draft',
      ipAddress,
      userAgent,
    },
  };

  // Log the audit entry
  await auditService.log(auditEntry);
};

const mapActionToAuditAction = (action: string): AuditLogEntry['action'] => {
  switch (action) {
    case 'create':
      return 'create';
    case 'update':
      return 'update';
    case 'delete':
      return 'delete';
    case 'publish':
      return 'publish';
    case 'unpublish':
      return 'unpublish';
    default:
      return 'update'; // fallback
  }
};
