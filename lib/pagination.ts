/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import prisma from '@/database/db';
/**
 * ----------------------------------------------------
 * Pagination and Query Types
 * ----------------------------------------------------
 */

export const filterOperators = [
  '$eq',
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$ne',
  '$in',
  '$nin',
  '$contains',
  '$startsWith',
  '$endsWith',
  '$mode',
  '$not',
  '$is',
] as const;

export type FilterOperator = (typeof filterOperators)[number];

type FieldConfig<T> = {
  filterable?: {
    [K in keyof T]?: Array<FilterOperator> | Record<string, any>;
  };
  searchable?: Array<keyof T>;
  sortable?: {
    [K in keyof T]?: boolean | 'ASC' | 'DESC' | 'asc' | 'desc';
  };
};

export type QueryParams = {
  page?: string;
  itemsPerPage?: string;
  filters?: Record<string, any>;
  search?: string;
  sort?: Record<string, any>;
  totalItems?: string;
};

type Meta = {
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
  totalItems: number;
  filters: object;
  sorts: object;
  search?: string;
};

/**
 * ----------------------------------------------------
 * Parse and Santize the Query Parameters
 * ----------------------------------------------------
 */

/**
 * Parse flat filter parameters in the format filters[fieldName]=value
 */
function parseFilterParams(searchParams: URLSearchParams): Record<string, any> {
  const filters: Record<string, any> = {};

  for (const [key, value] of searchParams.entries()) {
    // Check if it's a filter parameter
    const filterMatch = key.match(/^filters\[(.*?)\]$/);
    if (filterMatch) {
      const field = filterMatch[1];

      // Parse the operator and value
      // Default to $eq if no operator is specified
      let operator = '$eq';
      let fieldValue = value;

      if (value.includes(':')) {
        const [op, val] = value.split(':', 2);
        if (filterOperators.includes(op as FilterOperator)) {
          operator = op;
          fieldValue = val;
        }
      }

      // Handle special value types
      let parsedValue: any = fieldValue;

      // Convert boolean strings
      if (fieldValue.toLowerCase() === 'true') parsedValue = true;
      else if (fieldValue.toLowerCase() === 'false') parsedValue = false;
      // Convert numeric strings
      else if (!isNaN(Number(fieldValue)) && fieldValue.trim() !== '')
        parsedValue = Number(fieldValue);
      // Handle arrays for $in and $nin
      else if (
        (operator === '$in' || operator === '$nin') &&
        fieldValue.includes(',')
      ) {
        parsedValue = fieldValue.split(',').map((v) => {
          const trimmed = v.trim();
          // Convert numbers in arrays
          return !isNaN(Number(trimmed)) && trimmed !== ''
            ? Number(trimmed)
            : trimmed;
        });
      }

      // Initialize field in filters if it doesn't exist
      if (!filters[field]) filters[field] = {};

      // Add condition
      filters[field][operator] = parsedValue;
    }
  }

  return filters;
}

/**
 * Parse sort parameters in the format sort[fieldName]=ASC or sort[fieldName]=DESC
 */
function parseSortParams(searchParams: URLSearchParams): Record<string, any> {
  const sortParams: Record<string, string> = {};

  for (const [key, value] of searchParams.entries()) {
    // Match pattern sort[fieldName]
    const sortMatch = key.match(/^sort\[(.*?)\]$/);
    if (sortMatch) {
      const field = sortMatch[1];
      // Normalize order to lowercase (asc/desc)
      const order = value.toLowerCase();
      sortParams[field] = order;
    }
  }

  return sortParams;
}

/**
 * Extract and parse pagination query parameters from NextRequest
 * Supports both JSON format and flat URL parameters
 */
export function getPaginationQuery(req: NextRequest): QueryParams {
  const searchParams = req.nextUrl.searchParams;

  // Try to parse JSON format first
  const jsonFilters = searchParams.get('filters');
  const jsonSort = searchParams.get('sort');

  // Default values
  let filters: Record<string, any> = {};
  let sort: Record<string, any> = {};

  // If JSON filters exist, use them
  if (jsonFilters) {
    try {
      filters = JSON.parse(jsonFilters);
    } catch (e) {
      filters = parseFilterParams(searchParams);
    }
  } else {
    // Check for flat filter parameters
    filters = parseFilterParams(searchParams);
  }

  // If JSON sort exists, use it
  if (jsonSort) {
    try {
      sort = JSON.parse(jsonSort);
    } catch (e) {
      sort = parseSortParams(searchParams);
    }
  } else {
    // Check for flat sort parameters
    sort = parseSortParams(searchParams);
  }

  return {
    page: searchParams.get('page') || undefined,
    itemsPerPage: searchParams.get('itemsPerPage') || undefined,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    search: searchParams.get('search') || undefined,
    sort: Object.keys(sort).length > 0 ? sort : undefined,
    totalItems: searchParams.get('totalItems') || undefined,
  };
}

/**
 * Checks if a value is a plain object
 */
function isPlainObject(val: any): val is Record<string, any> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

/**
 * Sanitizes filter query based on allowed filter rules
 */
function sanitizeFilterQuery<T>(
  filterable: FieldConfig<T>['filterable'] = {},
  clientQuery: Record<string, any>
): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [field, value] of Object.entries(clientQuery)) {
    if (!(field in filterable)) continue;

    const allowedOperators = filterable[field as keyof T];

    if (Array.isArray(allowedOperators)) {
      // Handle value as object with operators
      if (isPlainObject(value)) {
        const filteredValue: Record<string, any> = {};
        for (const [op, opVal] of Object.entries(value)) {
          if (allowedOperators.includes(op as FilterOperator)) {
            filteredValue[op] = opVal;
          }
        }

        if (Object.keys(filteredValue).length > 0) {
          sanitized[field] = filteredValue;
        }
      } else {
        // If the value is not an object, treat as $eq if allowed
        if (allowedOperators.includes('$eq')) {
          sanitized[field] = { $eq: value };
        }
      }
    } else if (isPlainObject(allowedOperators) && isPlainObject(value)) {
      // Handle nested fields (relations)
      const nestedSanitized = sanitizeFilterQuery(
        allowedOperators as any,
        value
      );
      if (Object.keys(nestedSanitized).length > 0) {
        sanitized[field] = nestedSanitized;
      }
    }
  }

  return sanitized;
}

/**
 * Transform filter object to Prisma compatible where conditions
 */
function transformFiltersToPrisma(
  filters: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = {};

  const operatorMap: Record<string, string> = {
    $eq: 'equals',
    $gt: 'gt',
    $gte: 'gte',
    $lt: 'lt',
    $lte: 'lte',
    $ne: 'not',
    $in: 'in',
    $nin: 'notIn',
    $contains: 'contains',
    $startsWith: 'startsWith',
    $endsWith: 'endsWith',
    $mode: 'mode',
    $not: 'not',
    $is: 'is',
  };

  for (const [field, conditions] of Object.entries(filters)) {
    if (!isPlainObject(conditions)) {
      // Simple equality
      result[field] = { equals: conditions };
      continue;
    }

    const prismaConditions: Record<string, any> = {};

    for (const [operator, value] of Object.entries(conditions)) {
      const prismaOperator = operatorMap[operator];

      if (!prismaOperator) continue;

      // Handle special case for $mode which is typically nested in contains
      if (operator === '$mode') {
        // Mode is usually applied to contains, startsWith, or endsWith
        continue;
      } else if (operator === '$not') {
        prismaConditions[prismaOperator] = transformFiltersToPrisma({
          equals: value,
        });
      } else {
        prismaConditions[prismaOperator] = value;
      }
    }

    // Handle $mode if it exists alongside $contains, $startsWith or $endsWith
    if (
      conditions.$mode &&
      (conditions.$contains || conditions.$startsWith || conditions.$endsWith)
    ) {
      if (conditions.$contains) {
        prismaConditions.contains = conditions.$contains;
        prismaConditions.mode = conditions.$mode;
      }
      if (conditions.$startsWith) {
        prismaConditions.startsWith = conditions.$startsWith;
        prismaConditions.mode = conditions.$mode;
      }
      if (conditions.$endsWith) {
        prismaConditions.endsWith = conditions.$endsWith;
        prismaConditions.mode = conditions.$mode;
      }
    }

    result[field] = prismaConditions;
  }

  return result;
}

/**
 * Sanitizes and transforms sort parameters against allowed sortable fields
 */
function sanitizeSortQuery<T>(
  sortable: FieldConfig<T>['sortable'] = {},
  clientSort: Record<string, any>
): Record<string, any> | undefined {
  if (!clientSort || Object.keys(clientSort).length === 0) return undefined;

  const result: Record<string, any> = {};

  // Process each sort field
  for (const [field, direction] of Object.entries(clientSort)) {
    // Check if the field is in the sortable configuration
    if (field in sortable) {
      const sortConfig = sortable[field as keyof T];

      // If sortable is true or a direction string, allow sorting
      if (sortConfig) {
        // Normalize client-provided direction (asc/desc)
        let normalizedDirection =
          typeof direction === 'string' ? direction.toLowerCase() : 'asc';

        // If a specific direction is enforced in config, override client direction
        if (sortConfig === 'ASC' || sortConfig === 'asc') {
          normalizedDirection = 'asc';
        } else if (sortConfig === 'DESC' || sortConfig === 'desc') {
          normalizedDirection = 'desc';
        }

        // Only accept valid directions
        if (normalizedDirection === 'asc' || normalizedDirection === 'desc') {
          result[field] = normalizedDirection;
        }
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * ------------------------------------------
 * Main Pagination Function
 * ------------------------------------------
 */

/**
 * @param model - The Prisma model name
 * @param findManyOptions - Prisma findMany options
 * @param fieldConfig - Configuration for filtering, searching, and sorting
 * @param queryParams - Query parameters for pagination, filtering, etc.
 * @returns a list which contains data and meta
 */
export async function findAndPaginate<T extends keyof typeof prisma>(
  model: T,
  findManyOptions: Prisma.Args<(typeof prisma)[T], 'findMany'>,
  fieldConfig: FieldConfig<
    Prisma.Payload<(typeof prisma)[T], 'findMany'>['scalars']
  >,
  queryParams: QueryParams
): Promise<[data: T[], Meta]> {
  const {
    page = '1',
    itemsPerPage = '10',
    filters = {},
    search = '',
    sort = {},
  } = queryParams;

  // Validate and sanitize inputs
  const currentPage = Math.max(1, parseInt(page as string, 10));
  const limit = Math.max(1, parseInt(itemsPerPage as string, 10));
  const offset = (currentPage - 1) * limit;

  // Sanitize filters based on field config
  const sanitizedFilters = sanitizeFilterQuery(fieldConfig.filterable, filters);
  const prismaFilters = transformFiltersToPrisma(sanitizedFilters);

  // Build where clause
  const where: Record<string, any> = {
    ...(findManyOptions.where || {}),
    ...prismaFilters,
  };

  // Apply search if provided and searchable fields exist
  if (search && fieldConfig.searchable && fieldConfig.searchable.length > 0) {
    where.OR = fieldConfig.searchable.map((field) => ({
      [field]: { contains: search, mode: 'insensitive' },
    }));
  }

  // Apply sorting - use client sort
  const clientSortOrder = sanitizeSortQuery(fieldConfig.sortable, sort);
  const orderBy = clientSortOrder;

  // Count total items
  const totalItems = await (prisma[model] as any).count({ where });

  // Fetch data
  const data = await (prisma[model] as any).findMany({
    ...findManyOptions,
    where,
    orderBy,
    skip: offset,
    take: limit,
  });

  const meta: Meta = {
    currentPage,
    itemsPerPage: limit,
    totalPages: Math.ceil(totalItems / limit),
    totalItems,
    filters: sanitizedFilters || {},
    sorts: clientSortOrder || {},
    search: search || '',
  };

  return [data as T[], meta];
}
