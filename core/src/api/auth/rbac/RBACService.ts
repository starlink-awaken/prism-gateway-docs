/**
 * RBAC Service
 *
 * @description
 * Manages role-based access control including:
 * - Role definitions and permissions
 * - Permission checking
 * - Authorization logic
 *
 * @module api/auth/rbac/RBACService
 */

import {
  Role,
  Resource,
  Action,
  type Permission,
  type RoleDefinition,
  type UserWithRole,
  type AuthorizationResult
} from './types.js';

/**
 * Default role definitions
 *
 * @description
 * Defines the permission matrix for each role
 */
const DEFAULT_ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: Role.ADMIN,
    displayName: 'Administrator',
    description: 'Full system access',
    permissions: [
      { resource: Resource.GATEWAY, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.EXECUTE] },
      { resource: Resource.RETROSPECTIVE, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.EXECUTE] },
      { resource: Resource.ANALYTICS, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
      { resource: Resource.USERS, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
      { resource: Resource.SETTINGS, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
      { resource: Resource.API_KEYS, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] }
    ]
  },
  {
    role: Role.USER,
    displayName: 'User',
    description: 'Standard user access',
    permissions: [
      { resource: Resource.GATEWAY, actions: [Action.READ, Action.EXECUTE] },
      { resource: Resource.RETROSPECTIVE, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.EXECUTE] },
      { resource: Resource.ANALYTICS, actions: [Action.READ] },
      { resource: Resource.USERS, actions: [Action.READ] },
      { resource: Resource.API_KEYS, actions: [Action.CREATE, Action.READ, Action.DELETE] }
    ]
  },
  {
    role: Role.VIEWER,
    displayName: 'Viewer',
    description: 'Read-only access',
    permissions: [
      { resource: Resource.GATEWAY, actions: [Action.READ] },
      { resource: Resource.RETROSPECTIVE, actions: [Action.READ] },
      { resource: Resource.ANALYTICS, actions: [Action.READ] },
      { resource: Resource.USERS, actions: [Action.READ] }
    ]
  },
  {
    role: Role.GUEST,
    displayName: 'Guest',
    description: 'Minimal access',
    permissions: [
      { resource: Resource.GATEWAY, actions: [Action.READ] },
      { resource: Resource.RETROSPECTIVE, actions: [Action.READ] }
    ]
  }
];

/**
 * RBAC Service
 *
 * @description
 * Provides role-based access control functionality
 *
 * @example
 * ```typescript
 * const rbacService = new RBACService();
 *
 * // Check permission
 * const result = rbacService.authorize(
 *   { sub: 'user1', username: 'alice', role: Role.USER, jti: 'jti123' },
 *   Resource.ANALYTICS,
 *   Action.READ
 * );
 *
 * if (result.granted) {
 *   // Allow access
 * } else {
 *   // Deny access
 *   console.log(result.reason);
 * }
 * ```
 */
export class RBACService {
  private readonly roleDefinitions: Map<Role, RoleDefinition>;

  /**
   * Constructor
   *
   * @param customDefinitions - Custom role definitions (optional)
   */
  constructor(customDefinitions?: RoleDefinition[]) {
    this.roleDefinitions = new Map();

    // Load default definitions
    const definitions = customDefinitions || DEFAULT_ROLE_DEFINITIONS;
    for (const def of definitions) {
      this.roleDefinitions.set(def.role, def);
    }
  }

  /**
   * Authorize user action on resource
   *
   * @param user - User with role information
   * @param resource - Target resource
   * @param action - Action to perform
   * @returns Authorization result
   *
   * @example
   * ```typescript
   * const result = rbacService.authorize(user, Resource.ANALYTICS, Action.READ);
   * if (!result.granted) {
   *   throw new Error(result.reason);
   * }
   * ```
   */
  authorize(
    user: UserWithRole,
    resource: Resource,
    action: Action
  ): AuthorizationResult {
    const roleDef = this.roleDefinitions.get(user.role);

    if (!roleDef) {
      return {
        granted: false,
        reason: `Unknown role: ${user.role}`,
        role: user.role,
        required: { resource, action }
      };
    }

    // Find permission for this resource
    const permission = roleDef.permissions.find(p => p.resource === resource);

    if (!permission) {
      return {
        granted: false,
        reason: `Role '${user.role}' has no permissions for resource '${resource}'`,
        role: user.role,
        required: { resource, action }
      };
    }

    // Check if action is allowed
    if (!permission.actions.includes(action)) {
      return {
        granted: false,
        reason: `Role '${user.role}' cannot perform '${action}' on '${resource}'`,
        role: user.role,
        required: { resource, action }
      };
    }

    return {
      granted: true,
      role: user.role
    };
  }

  /**
   * Check if user has permission
   *
   * @param user - User with role
   * @param resource - Target resource
   * @param action - Action to check
   * @returns True if user has permission
   *
   * @example
   * ```typescript
   * if (rbacService.can(user, Resource.ANALYTICS, Action.DELETE)) {
   *   // User can delete analytics
   * }
   * ```
   */
  can(user: UserWithRole, resource: Resource, action: Action): boolean {
    const result = this.authorize(user, resource, action);
    return result.granted;
  }

  /**
   * Get all permissions for a role
   *
   * @param role - Role to query
   * @returns List of permissions or null if role not found
   *
   * @example
   * ```typescript
   * const permissions = rbacService.getRolePermissions(Role.USER);
   * console.log(permissions);
   * ```
   */
  getRolePermissions(role: Role): Permission[] | null {
    const roleDef = this.roleDefinitions.get(role);
    return roleDef ? roleDef.permissions : null;
  }

  /**
   * Get role definition
   *
   * @param role - Role to query
   * @returns Role definition or null if not found
   */
  getRoleDefinition(role: Role): RoleDefinition | null {
    return this.roleDefinitions.get(role) || null;
  }

  /**
   * List all roles
   *
   * @returns Array of role definitions
   *
   * @example
   * ```typescript
   * const roles = rbacService.listRoles();
   * roles.forEach(r => console.log(r.displayName));
   * ```
   */
  listRoles(): RoleDefinition[] {
    return Array.from(this.roleDefinitions.values());
  }

  /**
   * Check if role has any permission for resource
   *
   * @param role - Role to check
   * @param resource - Resource to check
   * @returns True if role has any permission
   */
  hasAccessTo(role: Role, resource: Resource): boolean {
    const roleDef = this.roleDefinitions.get(role);
    if (!roleDef) return false;

    return roleDef.permissions.some(p => p.resource === resource);
  }

  /**
   * Get allowed actions for user on resource
   *
   * @param user - User with role
   * @param resource - Resource to check
   * @returns Array of allowed actions
   *
   * @example
   * ```typescript
   * const actions = rbacService.getAllowedActions(user, Resource.ANALYTICS);
   * // ['read']
   * ```
   */
  getAllowedActions(user: UserWithRole, resource: Resource): Action[] {
    const roleDef = this.roleDefinitions.get(user.role);
    if (!roleDef) return [];

    const permission = roleDef.permissions.find(p => p.resource === resource);
    return permission ? permission.actions : [];
  }

  /**
   * Validate role exists
   *
   * @param role - Role to validate
   * @returns True if role exists
   */
  isValidRole(role: string): role is Role {
    return Object.values(Role).includes(role as Role);
  }
}

/**
 * Default RBAC service instance (singleton)
 */
export const defaultRBACService = new RBACService();
