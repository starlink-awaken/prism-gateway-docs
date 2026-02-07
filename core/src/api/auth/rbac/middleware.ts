/**
 * RBAC Middleware
 *
 * @description
 * Hono middleware for enforcing role-based access control
 *
 * @module api/auth/rbac/middleware
 */

import type { Context, Next } from 'hono';
import type { RBACService } from './RBACService.js';
import { Resource, Action, type UserWithRole } from './types.js';
import { errorResponse, ApiErrorCode } from '../../utils/errorResponse.js';

/**
 * RBAC middleware options
 */
export interface RBACMiddlewareOptions {
  /** RBAC service instance */
  rbacService: RBACService;
  /** Resource to protect */
  resource: Resource;
  /** Required action */
  action: Action;
}

/**
 * Get authenticated user from Hono context
 *
 * @param c - Hono context
 * @returns User with role or null
 */
export function getUserWithRole(c: Context): UserWithRole | null {
  // Get user from auth middleware (jwtMiddleware sets this)
  const user = c.get('user');
  if (!user) return null;

  // Default role is USER if not specified
  const role = user.role || 'user';

  return {
    sub: user.sub,
    username: user.username,
    jti: user.jti,
    role
  };
}

/**
 * Create RBAC middleware
 *
 * @param options - Middleware options
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * import { rbacMiddleware } from './rbac/middleware.js';
 * import { defaultRBACService } from './rbac/RBACService.js';
 * import { Resource, Action } from './rbac/types.js';
 *
 * // Protect analytics endpoint
 * app.get('/api/v1/analytics',
 *   jwtMiddleware({ jwtService }),
 *   rbacMiddleware({
 *     rbacService: defaultRBACService,
 *     resource: Resource.ANALYTICS,
 *     action: Action.READ
 *   }),
 *   (c) => {
 *     // Only users with READ permission on ANALYTICS can access
 *     return c.json({ data: 'analytics data' });
 *   }
 * );
 * ```
 */
export function rbacMiddleware(options: RBACMiddlewareOptions) {
  const { rbacService, resource, action } = options;

  return async (c: Context, next: Next) => {
    // Get user from context
    const user = getUserWithRole(c);

    if (!user) {
      return errorResponse(
        c,
        ApiErrorCode.AUTHENTICATION_FAILED,
        'Authentication required'
      );
    }

    // Check authorization
    const authResult = rbacService.authorize(user, resource, action);

    if (!authResult.granted) {
      // Forbidden - user is authenticated but not authorized
      return c.json(
        {
          success: false,
          error: {
            code: ApiErrorCode.AUTHORIZATION_FAILED,
            message: 'Insufficient permissions',
            details: {
              reason: authResult.reason,
              userRole: authResult.role,
              required: authResult.required
            }
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        },
        403
      );
    }

    // Store authorization result in context for later use
    c.set('authResult', authResult);

    await next();
  };
}

/**
 * Create flexible RBAC middleware (checks multiple resource/action combinations)
 *
 * @param rbacService - RBAC service instance
 * @param checks - Array of resource/action checks (OR logic)
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * // Allow if user can READ analytics OR EXECUTE retrospective
 * app.get('/api/v1/dashboard',
 *   jwtMiddleware({ jwtService }),
 *   flexibleRBACMiddleware(defaultRBACService, [
 *     { resource: Resource.ANALYTICS, action: Action.READ },
 *     { resource: Resource.RETROSPECTIVE, action: Action.EXECUTE }
 *   ]),
 *   (c) => c.json({ data: 'dashboard' })
 * );
 * ```
 */
export function flexibleRBACMiddleware(
  rbacService: RBACService,
  checks: Array<{ resource: Resource; action: Action }>
) {
  return async (c: Context, next: Next) => {
    const user = getUserWithRole(c);

    if (!user) {
      return errorResponse(
        c,
        ApiErrorCode.AUTHENTICATION_FAILED,
        'Authentication required'
      );
    }

    // Check if user passes ANY of the checks (OR logic)
    let granted = false;
    let lastReason: string | undefined;

    for (const check of checks) {
      const authResult = rbacService.authorize(user, check.resource, check.action);
      if (authResult.granted) {
        granted = true;
        c.set('authResult', authResult);
        break;
      }
      lastReason = authResult.reason;
    }

    if (!granted) {
      return c.json(
        {
          success: false,
          error: {
            code: ApiErrorCode.AUTHORIZATION_FAILED,
            message: 'Insufficient permissions',
            details: {
              reason: lastReason,
              userRole: user.role,
              requiredAny: checks
            }
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        },
        403
      );
    }

    await next();
  };
}

/**
 * Require admin role middleware
 *
 * @param rbacService - RBAC service
 * @returns Hono middleware
 *
 * @example
 * ```typescript
 * app.delete('/api/v1/users/:id',
 *   jwtMiddleware({ jwtService }),
 *   requireAdmin(defaultRBACService),
 *   (c) => {
 *     // Only admins can access
 *   }
 * );
 * ```
 */
export function requireAdmin(rbacService: RBACService) {
  return async (c: Context, next: Next) => {
    const user = getUserWithRole(c);

    if (!user) {
      return errorResponse(
        c,
        ApiErrorCode.AUTHENTICATION_FAILED,
        'Authentication required'
      );
    }

    if (user.role !== 'admin') {
      return c.json(
        {
          success: false,
          error: {
            code: ApiErrorCode.AUTHORIZATION_FAILED,
            message: 'Admin access required',
            details: {
              userRole: user.role
            }
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        },
        403
      );
    }

    await next();
  };
}
