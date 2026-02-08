/**
 * WebSocket Security Tests
 *
 * @description
 * Comprehensive test suite for WebSocket security features
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  ConnectionRateLimiter,
  MessageRateLimiter,
  MessageValidator,
  WebSocketSecurityManager,
  extractIpFromRequest,
  extractTokenFromUrl
} from '../../../api/websocket/WebSocketSecurity.js';
import { JWTService } from '../../../api/auth/JWTService.js';
import { RBACService } from '../../../api/auth/rbac/RBACService.js';
import { Resource, Action } from '../../../api/auth/rbac/types.js';

describe('ConnectionRateLimiter', () => {
  let limiter: ConnectionRateLimiter;

  beforeEach(() => {
    limiter = new ConnectionRateLimiter(3, 1000); // 3 connections per second
  });

  it('should allow connections under limit', () => {
    expect(limiter.allowConnection('192.168.1.1')).toBe(true);
    expect(limiter.allowConnection('192.168.1.1')).toBe(true);
    expect(limiter.allowConnection('192.168.1.1')).toBe(true);
  });

  it('should block connections over limit', () => {
    limiter.allowConnection('192.168.1.1');
    limiter.allowConnection('192.168.1.1');
    limiter.allowConnection('192.168.1.1');

    expect(limiter.allowConnection('192.168.1.1')).toBe(false);
  });

  it('should track connections per IP separately', () => {
    limiter.allowConnection('192.168.1.1');
    limiter.allowConnection('192.168.1.1');
    limiter.allowConnection('192.168.1.1');

    // Different IP should still be allowed
    expect(limiter.allowConnection('192.168.1.2')).toBe(true);
  });

  it('should get connection count', () => {
    limiter.allowConnection('192.168.1.1');
    limiter.allowConnection('192.168.1.1');

    expect(limiter.getConnectionCount('192.168.1.1')).toBe(2);
  });

  it('should clear rate limit data', () => {
    limiter.allowConnection('192.168.1.1');
    limiter.clear();

    expect(limiter.getConnectionCount('192.168.1.1')).toBe(0);
  });

  it('should reset after window expires', async () => {
    const shortLimiter = new ConnectionRateLimiter(2, 100); // 100ms window

    shortLimiter.allowConnection('192.168.1.1');
    shortLimiter.allowConnection('192.168.1.1');
    expect(shortLimiter.allowConnection('192.168.1.1')).toBe(false);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should allow again
    expect(shortLimiter.allowConnection('192.168.1.1')).toBe(true);
  });
});

describe('MessageRateLimiter', () => {
  let limiter: MessageRateLimiter;

  beforeEach(() => {
    limiter = new MessageRateLimiter(5, 1000); // 5 messages per second
  });

  it('should allow messages under limit', () => {
    expect(limiter.allowMessage('conn1')).toBe(true);
    expect(limiter.allowMessage('conn1')).toBe(true);
    expect(limiter.allowMessage('conn1')).toBe(true);
  });

  it('should block messages over limit', () => {
    for (let i = 0; i < 5; i++) {
      limiter.allowMessage('conn1');
    }

    expect(limiter.allowMessage('conn1')).toBe(false);
  });

  it('should track messages per connection separately', () => {
    for (let i = 0; i < 5; i++) {
      limiter.allowMessage('conn1');
    }

    // Different connection should still be allowed
    expect(limiter.allowMessage('conn2')).toBe(true);
  });

  it('should get message count', () => {
    limiter.allowMessage('conn1');
    limiter.allowMessage('conn1');
    limiter.allowMessage('conn1');

    expect(limiter.getMessageCount('conn1')).toBe(3);
  });

  it('should remove connection', () => {
    limiter.allowMessage('conn1');
    limiter.removeConnection('conn1');

    expect(limiter.getMessageCount('conn1')).toBe(0);
  });

  it('should clear all rate limit data', () => {
    limiter.allowMessage('conn1');
    limiter.allowMessage('conn2');
    limiter.clear();

    expect(limiter.getMessageCount('conn1')).toBe(0);
    expect(limiter.getMessageCount('conn2')).toBe(0);
  });
});

describe('MessageValidator', () => {
  let validator: MessageValidator;

  beforeEach(() => {
    validator = new MessageValidator();
  });

  it('should validate correct subscribe message', () => {
    const message = { type: 'subscribe', event: 'gateway:check' };
    const result = validator.validate(message);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject non-object message', () => {
    const result = validator.validate('invalid');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be an object');
  });

  it('should reject message without type', () => {
    const message = { data: 'test' };
    const result = validator.validate(message);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('type is required');
  });

  it('should reject unknown message type', () => {
    const message = { type: 'unknown', data: 'test' };
    const result = validator.validate(message);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('should validate join message with room', () => {
    const message = { type: 'join', room: 'analytics' };
    const result = validator.validate(message);

    expect(result.valid).toBe(true);
  });

  it('should reject join message without room', () => {
    const message = { type: 'join' };
    const result = validator.validate(message);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Room name is required');
  });

  it('should reject message exceeding size limit', () => {
    const smallValidator = new MessageValidator(100);
    const largeMessage = {
      type: 'subscribe',
      event: 'test',
      data: 'x'.repeat(200)
    };
    const result = smallValidator.validate(largeMessage);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds limit');
  });

  it('should allow adding custom message types', () => {
    validator.addAllowedType('custom');
    const message = { type: 'custom', data: 'test' };
    const result = validator.validate(message);

    expect(result.valid).toBe(true);
  });

  it('should allow removing message types', () => {
    validator.removeAllowedType('subscribe');
    const message = { type: 'subscribe', event: 'test' };
    const result = validator.validate(message);

    expect(result.valid).toBe(false);
  });
});

describe('WebSocketSecurityManager', () => {
  let jwtService: JWTService;
  let rbacService: RBACService;
  let securityManager: WebSocketSecurityManager;

  beforeEach(() => {
    jwtService = new JWTService({
      secret: 'test-secret-for-websocket-security-tests-12345',
      accessTokenTTL: 3600,
      refreshTokenTTL: 604800,
      issuer: 'test',
      audience: 'test'
    });

    rbacService = new RBACService();

    securityManager = new WebSocketSecurityManager({
      jwtService,
      rbacService,
      maxConnectionsPerIp: 5,
      maxMessagesPerConnection: 100
    });
  });

  describe('authenticateConnection()', () => {
    it('should authenticate valid token', async () => {
      const tokens = jwtService.generateTokens({
        sub: 'user1',
        username: 'alice',
        role: 'user'
      });

      const result = await securityManager.authenticateConnection(tokens.accessToken);

      expect(result.authenticated).toBe(true);
      expect(result.userId).toBe('user1');
      expect(result.username).toBe('alice');
      expect(result.role).toBe('user');
    });

    it('should reject invalid token', async () => {
      const result = await securityManager.authenticateConnection('invalid-token');

      expect(result.authenticated).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject expired token', async () => {
      const expiredJwtService = new JWTService({
        secret: 'test-secret-for-websocket-security-tests-12345',
        accessTokenTTL: -1, // Already expired
        refreshTokenTTL: 604800,
        issuer: 'test',
        audience: 'test'
      });

      const tokens = expiredJwtService.generateTokens({
        sub: 'user1',
        username: 'alice'
      });

      // Wait a moment to ensure token is expired
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await securityManager.authenticateConnection(tokens.accessToken);

      expect(result.authenticated).toBe(false);
    });

    it('should allow connection when JWT not configured and not required', async () => {
      const noAuthManager = new WebSocketSecurityManager({ authRequired: false });
      const result = await noAuthManager.authenticateConnection('any-token');

      expect(result.authenticated).toBe(true);
    });

    it('should reject when JWT not configured but required', async () => {
      const strictManager = new WebSocketSecurityManager({ authRequired: true });
      const result = await strictManager.authenticateConnection('any-token');

      expect(result.authenticated).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('checkConnectionLimit()', () => {
    it('should allow connections under limit', () => {
      expect(securityManager.checkConnectionLimit('192.168.1.1')).toBe(true);
      expect(securityManager.checkConnectionLimit('192.168.1.1')).toBe(true);
    });

    it('should get connection stats', () => {
      securityManager.checkConnectionLimit('192.168.1.1');
      securityManager.checkConnectionLimit('192.168.1.1');

      const stats = securityManager.getConnectionStats('192.168.1.1');
      expect(stats).toBe(2);
    });
  });

  describe('checkMessageLimit()', () => {
    it('should allow messages under limit', () => {
      expect(securityManager.checkMessageLimit('conn1')).toBe(true);
      expect(securityManager.checkMessageLimit('conn1')).toBe(true);
    });

    it('should get message stats', () => {
      securityManager.checkMessageLimit('conn1');
      securityManager.checkMessageLimit('conn1');

      const stats = securityManager.getMessageStats('conn1');
      expect(stats).toBe(2);
    });
  });

  describe('validateMessage()', () => {
    it('should validate correct message', () => {
      const message = { type: 'subscribe', event: 'test' };
      const result = securityManager.validateMessage(message);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid message', () => {
      const message = { type: 'invalid' };
      const result = securityManager.validateMessage(message);

      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('checkPermission()', () => {
    it('should allow user with permission', () => {
      const hasPermission = securityManager.checkPermission(
        'user1',
        'alice',
        'user',
        Resource.ANALYTICS,
        Action.READ
      );

      expect(hasPermission).toBe(true);
    });

    it('should deny user without permission', () => {
      const hasPermission = securityManager.checkPermission(
        'user1',
        'alice',
        'guest',
        Resource.ANALYTICS,
        Action.READ
      );

      expect(hasPermission).toBe(false);
    });

    it('should allow when RBAC not configured', () => {
      const noRbacManager = new WebSocketSecurityManager({ jwtService });
      const hasPermission = noRbacManager.checkPermission(
        'user1',
        'alice',
        'user',
        Resource.ANALYTICS,
        Action.DELETE
      );

      expect(hasPermission).toBe(true);
    });
  });

  describe('onConnectionClosed()', () => {
    it('should clean up connection data', () => {
      securityManager.checkMessageLimit('conn1');
      securityManager.onConnectionClosed('conn1');

      const stats = securityManager.getMessageStats('conn1');
      expect(stats).toBe(0);
    });
  });

  describe('clear()', () => {
    it('should clear all security data', () => {
      securityManager.checkConnectionLimit('192.168.1.1');
      securityManager.checkMessageLimit('conn1');
      securityManager.clear();

      expect(securityManager.getConnectionStats('192.168.1.1')).toBe(0);
      expect(securityManager.getMessageStats('conn1')).toBe(0);
    });
  });
});

describe('extractIpFromRequest()', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const request = new Request('http://example.com', {
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' }
    });

    const ip = extractIpFromRequest(request);
    expect(ip).toBe('192.168.1.1');
  });

  it('should extract IP from cf-connecting-ip header', () => {
    const request = new Request('http://example.com', {
      headers: { 'cf-connecting-ip': '192.168.1.1' }
    });

    const ip = extractIpFromRequest(request);
    expect(ip).toBe('192.168.1.1');
  });

  it('should extract IP from x-real-ip header', () => {
    const request = new Request('http://example.com', {
      headers: { 'x-real-ip': '192.168.1.1' }
    });

    const ip = extractIpFromRequest(request);
    expect(ip).toBe('192.168.1.1');
  });

  it('should return unknown if no IP headers present', () => {
    const request = new Request('http://example.com');
    const ip = extractIpFromRequest(request);
    expect(ip).toBe('unknown');
  });
});

describe('extractTokenFromUrl()', () => {
  it('should extract token from query params', () => {
    const url = new URL('ws://example.com/ws?token=abc123');
    const token = extractTokenFromUrl(url);
    expect(token).toBe('abc123');
  });

  it('should return null if no token param', () => {
    const url = new URL('ws://example.com/ws');
    const token = extractTokenFromUrl(url);
    expect(token).toBeNull();
  });

  it('should handle multiple query params', () => {
    const url = new URL('ws://example.com/ws?foo=bar&token=xyz789&baz=qux');
    const token = extractTokenFromUrl(url);
    expect(token).toBe('xyz789');
  });
});
