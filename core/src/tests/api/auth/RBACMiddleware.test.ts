/**
 * RBAC Middleware 单元测试
 *
 * @description
 * 测试 RBAC 中间件的访问控制功能
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { RBACService } from '../../../src/api/auth/rbac/RBACService.js';
import {
  rbacMiddleware,
  flexibleRBACMiddleware,
  requireAdmin,
  getUserWithRole
} from '../../../src/api/auth/rbac/middleware.js';
import { Role, Resource, Action } from '../../../src/api/auth/rbac/types.js';

describe('RBAC Middleware', () => {
  let app: Hono;
  let rbacService: RBACService;

  beforeEach(() => {
    app = new Hono();
    rbacService = new RBACService();
  });

  describe('rbacMiddleware()', () => {
    it('should allow admin to access protected resource', async () => {
      app.use('/admin/*',
        (c, next) => {
          // Mock authenticated admin user
          c.set('user', {
            sub: 'admin1',
            username: 'admin',
            role: 'admin',
            jti: 'jti_admin'
          });
          return next();
        },
        rbacMiddleware({
          rbacService,
          resource: Resource.SETTINGS,
          action: Action.DELETE
        })
      );

      app.get('/admin/settings', (c) => c.json({ success: true }));

      const res = await app.request('/admin/settings');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('should deny user without permission', async () => {
      app.use('/admin/*',
        (c, next) => {
          // Mock authenticated regular user
          c.set('user', {
            sub: 'user1',
            username: 'alice',
            role: 'user',
            jti: 'jti_user'
          });
          return next();
        },
        rbacMiddleware({
          rbacService,
          resource: Resource.SETTINGS,
          action: Action.READ
        })
      );

      app.get('/admin/settings', (c) => c.json({ success: true }));

      const res = await app.request('/admin/settings');
      expect(res.status).toBe(403);

      const body: any = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ERR_2002');
      expect(body.error.message).toBe('Insufficient permissions');
    });

    it('should deny unauthenticated user', async () => {
      app.use('/admin/*',
        rbacMiddleware({
          rbacService,
          resource: Resource.SETTINGS,
          action: Action.READ
        })
      );

      app.get('/admin/settings', (c) => c.json({ success: true }));

      const res = await app.request('/admin/settings');
      expect(res.status).toBe(401);

      const body: any = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ERR_2001');
    });

    it('should allow user with correct permission', async () => {
      app.use('/analytics/*',
        (c, next) => {
          // Mock authenticated user
          c.set('user', {
            sub: 'user1',
            username: 'alice',
            role: 'user',
            jti: 'jti_user'
          });
          return next();
        },
        rbacMiddleware({
          rbacService,
          resource: Resource.ANALYTICS,
          action: Action.READ
        })
      );

      app.get('/analytics/dashboard', (c) => c.json({ data: 'analytics' }));

      const res = await app.request('/analytics/dashboard');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toBe('analytics');
    });

    it('should store authorization result in context', async () => {
      let authResultStored: any = null;

      app.use('/test',
        (c, next) => {
          c.set('user', {
            sub: 'user1',
            username: 'alice',
            role: 'user',
            jti: 'jti_user'
          });
          return next();
        },
        rbacMiddleware({
          rbacService,
          resource: Resource.ANALYTICS,
          action: Action.READ
        })
      );

      app.get('/test', (c) => {
        authResultStored = c.get('authResult');
        return c.json({ success: true });
      });

      const res = await app.request('/test');
      expect(res.status).toBe(200);
      expect(authResultStored).not.toBeNull();
      expect(authResultStored.granted).toBe(true);
      expect(authResultStored.role).toBe('user');
    });
  });

  describe('flexibleRBACMiddleware()', () => {
    it('should allow if user passes any check (OR logic)', async () => {
      app.use('/flexible/*',
        (c, next) => {
          // Mock authenticated user
          c.set('user', {
            sub: 'user1',
            username: 'alice',
            role: 'user',
            jti: 'jti_user'
          });
          return next();
        },
        flexibleRBACMiddleware(rbacService, [
          { resource: Resource.ANALYTICS, action: Action.DELETE }, // User doesn't have this
          { resource: Resource.ANALYTICS, action: Action.READ }    // User has this
        ])
      );

      app.get('/flexible/data', (c) => c.json({ success: true }));

      const res = await app.request('/flexible/data');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('should deny if user fails all checks', async () => {
      app.use('/flexible/*',
        (c, next) => {
          // Mock authenticated viewer
          c.set('user', {
            sub: 'viewer1',
            username: 'bob',
            role: 'viewer',
            jti: 'jti_viewer'
          });
          return next();
        },
        flexibleRBACMiddleware(rbacService, [
          { resource: Resource.ANALYTICS, action: Action.CREATE },
          { resource: Resource.ANALYTICS, action: Action.DELETE }
        ])
      );

      app.get('/flexible/data', (c) => c.json({ success: true }));

      const res = await app.request('/flexible/data');
      expect(res.status).toBe(403);

      const body: any = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ERR_2002');
    });

    it('should work with single check', async () => {
      app.use('/flexible/*',
        (c, next) => {
          c.set('user', {
            sub: 'user1',
            username: 'alice',
            role: 'user',
            jti: 'jti_user'
          });
          return next();
        },
        flexibleRBACMiddleware(rbacService, [
          { resource: Resource.GATEWAY, action: Action.READ }
        ])
      );

      app.get('/flexible/data', (c) => c.json({ success: true }));

      const res = await app.request('/flexible/data');
      expect(res.status).toBe(200);
    });
  });

  describe('requireAdmin()', () => {
    it('should allow admin users', async () => {
      app.use('/admin/*',
        (c, next) => {
          // Mock authenticated admin
          c.set('user', {
            sub: 'admin1',
            username: 'admin',
            role: 'admin',
            jti: 'jti_admin'
          });
          return next();
        },
        requireAdmin(rbacService)
      );

      app.get('/admin/dashboard', (c) => c.json({ admin: true }));

      const res = await app.request('/admin/dashboard');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.admin).toBe(true);
    });

    it('should deny non-admin users', async () => {
      app.use('/admin/*',
        (c, next) => {
          // Mock authenticated regular user
          c.set('user', {
            sub: 'user1',
            username: 'alice',
            role: 'user',
            jti: 'jti_user'
          });
          return next();
        },
        requireAdmin(rbacService)
      );

      app.get('/admin/dashboard', (c) => c.json({ admin: true }));

      const res = await app.request('/admin/dashboard');
      expect(res.status).toBe(403);

      const body: any = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ERR_2002');
      expect(body.error.message).toBe('Admin access required');
    });

    it('should deny unauthenticated users', async () => {
      app.use('/admin/*', requireAdmin(rbacService));
      app.get('/admin/dashboard', (c) => c.json({ admin: true }));

      const res = await app.request('/admin/dashboard');
      expect(res.status).toBe(401);

      const body: any = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ERR_2001');
    });
  });

  describe('getUserWithRole()', () => {
    it('should return user with role from context', () => {
      const mockContext: any = {
        get: (key: string) => {
          if (key === 'user') {
            return {
              sub: 'user1',
              username: 'alice',
              role: 'user',
              jti: 'jti_user'
            };
          }
          return null;
        }
      };

      const user = getUserWithRole(mockContext);
      expect(user).not.toBeNull();
      expect(user!.sub).toBe('user1');
      expect(user!.username).toBe('alice');
      expect(user!.role).toBe('user');
      expect(user!.jti).toBe('jti_user');
    });

    it('should return null if no user in context', () => {
      const mockContext: any = {
        get: () => null
      };

      const user = getUserWithRole(mockContext);
      expect(user).toBeNull();
    });

    it('should default role to "user" if not specified', () => {
      const mockContext: any = {
        get: (key: string) => {
          if (key === 'user') {
            return {
              sub: 'user1',
              username: 'alice',
              jti: 'jti_user'
              // No role specified
            };
          }
          return null;
        }
      };

      const user = getUserWithRole(mockContext);
      expect(user).not.toBeNull();
      expect(user!.role).toBe('user');
    });
  });

  describe('integration tests', () => {
    it('should work in combination with other middleware', async () => {
      let middlewareOrder: string[] = [];

      app.use('/test',
        (c, next) => {
          middlewareOrder.push('auth');
          c.set('user', {
            sub: 'admin1',
            username: 'admin',
            role: 'admin',
            jti: 'jti_admin'
          });
          return next();
        },
        (c, next) => {
          middlewareOrder.push('logging');
          return next();
        },
        rbacMiddleware({
          rbacService,
          resource: Resource.SETTINGS,
          action: Action.READ
        }),
        (c, next) => {
          middlewareOrder.push('handler');
          return next();
        }
      );

      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
      expect(middlewareOrder).toEqual(['auth', 'logging', 'handler']);
    });

    it('should handle multiple RBAC checks on same route', async () => {
      app.use('/multi/*',
        (c, next) => {
          c.set('user', {
            sub: 'admin1',
            username: 'admin',
            role: 'admin',
            jti: 'jti_admin'
          });
          return next();
        }
      );

      app.get('/multi/data',
        rbacMiddleware({
          rbacService,
          resource: Resource.ANALYTICS,
          action: Action.READ
        }),
        rbacMiddleware({
          rbacService,
          resource: Resource.SETTINGS,
          action: Action.UPDATE
        }),
        (c) => c.json({ success: true })
      );

      const res = await app.request('/multi/data');
      expect(res.status).toBe(200);
    });
  });
});
