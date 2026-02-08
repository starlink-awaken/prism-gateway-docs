/**
 * RBAC Service 单元测试
 *
 * @description
 * 测试 RBACService 的角色和权限管理功能
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { RBACService } from '../../../src/api/auth/rbac/RBACService.js';
import { Role, Resource, Action, type UserWithRole } from '../../../src/api/auth/rbac/types.js';

describe('RBACService', () => {
  let rbacService: RBACService;
  let adminUser: UserWithRole;
  let regularUser: UserWithRole;
  let viewerUser: UserWithRole;
  let guestUser: UserWithRole;

  beforeEach(() => {
    rbacService = new RBACService();

    adminUser = {
      sub: 'admin1',
      username: 'admin',
      role: Role.ADMIN,
      jti: 'jti_admin'
    };

    regularUser = {
      sub: 'user1',
      username: 'alice',
      role: Role.USER,
      jti: 'jti_user'
    };

    viewerUser = {
      sub: 'viewer1',
      username: 'bob',
      role: Role.VIEWER,
      jti: 'jti_viewer'
    };

    guestUser = {
      sub: 'guest1',
      username: 'charlie',
      role: Role.GUEST,
      jti: 'jti_guest'
    };
  });

  describe('authorize()', () => {
    describe('ADMIN role', () => {
      it('should grant admin full access to all resources', () => {
        const resources = [
          Resource.GATEWAY,
          Resource.RETROSPECTIVE,
          Resource.ANALYTICS,
          Resource.USERS,
          Resource.SETTINGS,
          Resource.API_KEYS
        ];

        const actions = [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.EXECUTE];

        for (const resource of resources) {
          for (const action of actions) {
            // Skip EXECUTE on resources that don't support it
            if (action === Action.EXECUTE &&
                ![Resource.GATEWAY, Resource.RETROSPECTIVE].includes(resource)) {
              continue;
            }

            const result = rbacService.authorize(adminUser, resource, action);
            expect(result.granted).toBe(true);
            expect(result.role).toBe(Role.ADMIN);
          }
        }
      });

      it('should grant admin CREATE permission on ANALYTICS', () => {
        const result = rbacService.authorize(adminUser, Resource.ANALYTICS, Action.CREATE);
        expect(result.granted).toBe(true);
      });

      it('should grant admin DELETE permission on USERS', () => {
        const result = rbacService.authorize(adminUser, Resource.USERS, Action.DELETE);
        expect(result.granted).toBe(true);
      });
    });

    describe('USER role', () => {
      it('should grant user READ and EXECUTE on GATEWAY', () => {
        let result = rbacService.authorize(regularUser, Resource.GATEWAY, Action.READ);
        expect(result.granted).toBe(true);

        result = rbacService.authorize(regularUser, Resource.GATEWAY, Action.EXECUTE);
        expect(result.granted).toBe(true);
      });

      it('should deny user CREATE permission on GATEWAY', () => {
        const result = rbacService.authorize(regularUser, Resource.GATEWAY, Action.CREATE);
        expect(result.granted).toBe(false);
        expect(result.reason).toContain('cannot perform');
      });

      it('should grant user full access to RETROSPECTIVE', () => {
        const actions = [Action.CREATE, Action.READ, Action.UPDATE, Action.EXECUTE];

        for (const action of actions) {
          const result = rbacService.authorize(regularUser, Resource.RETROSPECTIVE, action);
          expect(result.granted).toBe(true);
        }
      });

      it('should deny user DELETE on RETROSPECTIVE', () => {
        const result = rbacService.authorize(regularUser, Resource.RETROSPECTIVE, Action.DELETE);
        expect(result.granted).toBe(false);
      });

      it('should grant user READ on ANALYTICS', () => {
        const result = rbacService.authorize(regularUser, Resource.ANALYTICS, Action.READ);
        expect(result.granted).toBe(true);
      });

      it('should deny user UPDATE on ANALYTICS', () => {
        const result = rbacService.authorize(regularUser, Resource.ANALYTICS, Action.UPDATE);
        expect(result.granted).toBe(false);
      });

      it('should deny user access to SETTINGS', () => {
        const result = rbacService.authorize(regularUser, Resource.SETTINGS, Action.READ);
        expect(result.granted).toBe(false);
        expect(result.reason).toContain('no permissions');
      });
    });

    describe('VIEWER role', () => {
      it('should grant viewer READ on all major resources', () => {
        const resources = [
          Resource.GATEWAY,
          Resource.RETROSPECTIVE,
          Resource.ANALYTICS,
          Resource.USERS
        ];

        for (const resource of resources) {
          const result = rbacService.authorize(viewerUser, resource, Action.READ);
          expect(result.granted).toBe(true);
        }
      });

      it('should deny viewer any write operations', () => {
        const result = rbacService.authorize(viewerUser, Resource.GATEWAY, Action.CREATE);
        expect(result.granted).toBe(false);
      });

      it('should deny viewer access to SETTINGS', () => {
        const result = rbacService.authorize(viewerUser, Resource.SETTINGS, Action.READ);
        expect(result.granted).toBe(false);
      });
    });

    describe('GUEST role', () => {
      it('should grant guest READ on GATEWAY', () => {
        const result = rbacService.authorize(guestUser, Resource.GATEWAY, Action.READ);
        expect(result.granted).toBe(true);
      });

      it('should grant guest READ on RETROSPECTIVE', () => {
        const result = rbacService.authorize(guestUser, Resource.RETROSPECTIVE, Action.READ);
        expect(result.granted).toBe(true);
      });

      it('should deny guest READ on ANALYTICS', () => {
        const result = rbacService.authorize(guestUser, Resource.ANALYTICS, Action.READ);
        expect(result.granted).toBe(false);
      });

      it('should deny guest any write operations', () => {
        const result = rbacService.authorize(guestUser, Resource.GATEWAY, Action.CREATE);
        expect(result.granted).toBe(false);
      });
    });

    describe('error handling', () => {
      it('should deny unknown role', () => {
        const unknownUser: UserWithRole = {
          sub: 'unknown1',
          username: 'unknown',
          role: 'superadmin' as any,
          jti: 'jti_unknown'
        };

        const result = rbacService.authorize(unknownUser, Resource.GATEWAY, Action.READ);
        expect(result.granted).toBe(false);
        expect(result.reason).toContain('Unknown role');
      });
    });
  });

  describe('can()', () => {
    it('should return true for admin on any permission', () => {
      expect(rbacService.can(adminUser, Resource.SETTINGS, Action.DELETE)).toBe(true);
    });

    it('should return false for user without permission', () => {
      expect(rbacService.can(regularUser, Resource.SETTINGS, Action.READ)).toBe(false);
    });

    it('should return true for user with permission', () => {
      expect(rbacService.can(regularUser, Resource.ANALYTICS, Action.READ)).toBe(true);
    });
  });

  describe('getRolePermissions()', () => {
    it('should return permissions for admin role', () => {
      const permissions = rbacService.getRolePermissions(Role.ADMIN);
      expect(permissions).not.toBeNull();
      expect(permissions!.length).toBeGreaterThan(0);
    });

    it('should return permissions for user role', () => {
      const permissions = rbacService.getRolePermissions(Role.USER);
      expect(permissions).not.toBeNull();
      expect(permissions!.length).toBeGreaterThan(0);
    });

    it('should return null for unknown role', () => {
      const permissions = rbacService.getRolePermissions('unknown' as any);
      expect(permissions).toBeNull();
    });
  });

  describe('getRoleDefinition()', () => {
    it('should return role definition', () => {
      const roleDef = rbacService.getRoleDefinition(Role.ADMIN);
      expect(roleDef).not.toBeNull();
      expect(roleDef!.role).toBe(Role.ADMIN);
      expect(roleDef!.displayName).toBe('Administrator');
      expect(roleDef!.description).toBeTruthy();
    });
  });

  describe('listRoles()', () => {
    it('should return all role definitions', () => {
      const roles = rbacService.listRoles();
      expect(roles.length).toBe(4);
      expect(roles.map(r => r.role)).toContain(Role.ADMIN);
      expect(roles.map(r => r.role)).toContain(Role.USER);
      expect(roles.map(r => r.role)).toContain(Role.VIEWER);
      expect(roles.map(r => r.role)).toContain(Role.GUEST);
    });
  });

  describe('hasAccessTo()', () => {
    it('should return true if role has any permission for resource', () => {
      expect(rbacService.hasAccessTo(Role.USER, Resource.ANALYTICS)).toBe(true);
      expect(rbacService.hasAccessTo(Role.ADMIN, Resource.SETTINGS)).toBe(true);
    });

    it('should return false if role has no permission for resource', () => {
      expect(rbacService.hasAccessTo(Role.GUEST, Resource.SETTINGS)).toBe(false);
      expect(rbacService.hasAccessTo(Role.VIEWER, Resource.SETTINGS)).toBe(false);
    });

    it('should return false for unknown role', () => {
      expect(rbacService.hasAccessTo('unknown' as any, Resource.GATEWAY)).toBe(false);
    });
  });

  describe('getAllowedActions()', () => {
    it('should return allowed actions for user on resource', () => {
      const actions = rbacService.getAllowedActions(regularUser, Resource.RETROSPECTIVE);
      expect(actions).toContain(Action.CREATE);
      expect(actions).toContain(Action.READ);
      expect(actions).toContain(Action.UPDATE);
      expect(actions).toContain(Action.EXECUTE);
      expect(actions).not.toContain(Action.DELETE);
    });

    it('should return empty array for resource without permissions', () => {
      const actions = rbacService.getAllowedActions(guestUser, Resource.SETTINGS);
      expect(actions.length).toBe(0);
    });

    it('should return empty array for unknown role', () => {
      const unknownUser: UserWithRole = {
        sub: 'unknown1',
        username: 'unknown',
        role: 'unknown' as any,
        jti: 'jti_unknown'
      };
      const actions = rbacService.getAllowedActions(unknownUser, Resource.GATEWAY);
      expect(actions.length).toBe(0);
    });
  });

  describe('isValidRole()', () => {
    it('should return true for valid roles', () => {
      expect(rbacService.isValidRole('admin')).toBe(true);
      expect(rbacService.isValidRole('user')).toBe(true);
      expect(rbacService.isValidRole('viewer')).toBe(true);
      expect(rbacService.isValidRole('guest')).toBe(true);
    });

    it('should return false for invalid roles', () => {
      expect(rbacService.isValidRole('superadmin')).toBe(false);
      expect(rbacService.isValidRole('moderator')).toBe(false);
      expect(rbacService.isValidRole('')).toBe(false);
    });
  });

  describe('custom role definitions', () => {
    it('should accept custom role definitions', () => {
      const customDefinitions = [
        {
          role: Role.ADMIN,
          displayName: 'Super Admin',
          description: 'Custom admin role',
          permissions: [
            { resource: Resource.GATEWAY, actions: [Action.READ] }
          ]
        }
      ];

      const customRBACService = new RBACService(customDefinitions);
      const result = customRBACService.authorize(adminUser, Resource.GATEWAY, Action.READ);
      expect(result.granted).toBe(true);

      // Should not have other permissions
      const result2 = customRBACService.authorize(adminUser, Resource.ANALYTICS, Action.READ);
      expect(result2.granted).toBe(false);
    });
  });
});
