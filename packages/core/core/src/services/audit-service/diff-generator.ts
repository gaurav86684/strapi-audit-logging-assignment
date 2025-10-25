import { omit, isEqual } from 'lodash/fp';

export interface DiffGenerator {
  generateDiff(before: any, after: any): any;
  sanitizeData(data: any): any;
}

export const createDiffGenerator = (excludeFields: string[] = []): DiffGenerator => {
  const sanitizeData = (data: any): any => {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // Remove excluded fields (like passwords, tokens)
    return omit(excludeFields, data);
  };

  const generateDiff = (before: any, after: any): any => {
    const sanitizedBefore = sanitizeData(before);
    const sanitizedAfter = sanitizeData(after);

    if (isEqual(sanitizedBefore, sanitizedAfter)) {
      return null;
    }

    const changes: any = {};

    // For create operations, just return the new data
    if (!sanitizedBefore) {
      return { created: sanitizedAfter };
    }

    // For delete operations, return the deleted data
    if (!sanitizedAfter) {
      return { deleted: sanitizedBefore };
    }

    // For update operations, generate field-by-field diff
    const allKeys = new Set([
      ...Object.keys(sanitizedBefore || {}),
      ...Object.keys(sanitizedAfter || {}),
    ]);

    for (const key of allKeys) {
      const beforeValue = sanitizedBefore?.[key];
      const afterValue = sanitizedAfter?.[key];

      if (!isEqual(beforeValue, afterValue)) {
        changes[key] = {
          from: beforeValue,
          to: afterValue,
        };
      }
    }

    return Object.keys(changes).length > 0 ? changes : null;
  };

  return {
    generateDiff,
    sanitizeData,
  };
};
