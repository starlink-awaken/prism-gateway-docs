/**
 * RBAC (Role-Based Access Control) Type Definitions
 *
 * @description
 * Defines roles, permissions, and resources for access control
 *
 * @module api/auth/rbac/types
 */

/**
 * System roles
 *
 * @enum Role
 */
export enum Role {
  /** Administrator - full system access */
  ADMIN = 'admin',
  /** Regular user - standard access */
  USER = 'user',
  /** Read-only user - view-only access */
  VIEWER = 'viewer',
  /** Guest - minimal access */
  GUEST = 'guest'
}

/**
 * System resources
 *
 * @enum Resource
 */
export enum Resource {
  /** Gateway checks */
  GATEWAY = 'gateway',
  /** Retrospectives */
  RETROSPECTIVE = 'retrospective',
  /** Analytics */
  ANALYTICS = 'analytics',
  /** User management */
  USERS = 'users',
  /** System settings */
  SETTINGS = 'settings',
  /** API keys */
  API_KEYS = 'api_keys'
}

/**
 * Actions that can be performed on resources
 *
 * @enum Action
 */
export enum Action {
  /** Create new resource */
  CREATE = 'create',
  /** Read/view resource */
  READ = 'read',
  /** Update existing resource */
  UPDATE = 'update',
  /** Delete resource */
  DELETE = 'delete',
  /** Execute/run resource */
  EXECUTE = 'execute'
}

/**
 * Permission definition
 *
 * @interface Permission
 */
export interface Permission {
  /** Resource type */
  resource: Resource;
  /** Allowed actions */
  actions: Action[];
}

/**
 * Role definition with permissions
 *
 * @interface RoleDefinition
 */
export interface RoleDefinition {
  /** Role identifier */
  role: Role;
  /** Display name */
  displayName: string;
  /** Role description */
  description: string;
  /** List of permissions */
  permissions: Permission[];
}

/**
 * User with role information
 *
 * @interface UserWithRole
 */
export interface UserWithRole {
  /** User ID */
  sub: string;
  /** Username */
  username: string;
  /** User's role */
  role: Role;
  /** JWT ID */
  jti: string;
}

/**
 * Authorization check result
 *
 * @interface AuthorizationResult
 */
export interface AuthorizationResult {
  /** Whether access is granted */
  granted: boolean;
  /** Reason for denial (if not granted) */
  reason?: string;
  /** User's role */
  role: Role;
  /** Required permission */
  required?: {
    resource: Resource;
    action: Action;
  };
}
