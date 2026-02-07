/**
 * RBAC Module
 *
 * @description
 * Role-Based Access Control (RBAC) system for PRISM-Gateway
 *
 * @module api/auth/rbac
 */

export { RBACService, defaultRBACService } from './RBACService.js';
export {
  rbacMiddleware,
  flexibleRBACMiddleware,
  requireAdmin,
  getUserWithRole,
  type RBACMiddlewareOptions
} from './middleware.js';
export {
  Role,
  Resource,
  Action,
  type Permission,
  type RoleDefinition,
  type UserWithRole,
  type AuthorizationResult
} from './types.js';
