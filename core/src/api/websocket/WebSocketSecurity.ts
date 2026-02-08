/**
 * WebSocket Security Module
 *
 * @description
 * Provides security enhancements for WebSocket connections:
 * - JWT authentication
 * - Connection rate limiting
 * - Message validation
 * - DDoS protection
 *
 * @module api/websocket/WebSocketSecurity
 */

import type { JWTService } from '../auth/JWTService.js';
import type { RBACService } from '../auth/rbac/RBACService.js';
import { Role, Resource, Action } from '../auth/rbac/types.js';

/**
 * WebSocket authentication result
 */
export interface WSAuthResult {
  authenticated: boolean;
  userId?: string;
  username?: string;
  role?: string;
  error?: string;
}

/**
 * Connection rate limiter
 */
export class ConnectionRateLimiter {
  private connections: Map<string, number[]> = new Map();
  private maxConnections: number;
  private windowMs: number;

  /**
   * Constructor
   *
   * @param maxConnections - Maximum connections per IP in window
   * @param windowMs - Time window in milliseconds
   */
  constructor(maxConnections: number = 5, windowMs: number = 60000) {
    this.maxConnections = maxConnections;
    this.windowMs = windowMs;
  }

  /**
   * Check if connection is allowed
   *
   * @param ip - Client IP address
   * @returns True if connection is allowed
   */
  allowConnection(ip: string): boolean {
    const now = Date.now();
    const timestamps = this.connections.get(ip) || [];

    // Remove expired timestamps
    const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);

    // Check if under limit
    if (validTimestamps.length >= this.maxConnections) {
      return false;
    }

    // Add new timestamp
    validTimestamps.push(now);
    this.connections.set(ip, validTimestamps);

    return true;
  }

  /**
   * Get current connection count for IP
   *
   * @param ip - Client IP address
   * @returns Connection count
   */
  getConnectionCount(ip: string): number {
    const now = Date.now();
    const timestamps = this.connections.get(ip) || [];
    return timestamps.filter(ts => now - ts < this.windowMs).length;
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.connections.clear();
  }
}

/**
 * Message rate limiter
 */
export class MessageRateLimiter {
  private messages: Map<string, number[]> = new Map();
  private maxMessages: number;
  private windowMs: number;

  /**
   * Constructor
   *
   * @param maxMessages - Maximum messages per connection in window
   * @param windowMs - Time window in milliseconds
   */
  constructor(maxMessages: number = 100, windowMs: number = 60000) {
    this.maxMessages = maxMessages;
    this.windowMs = windowMs;
  }

  /**
   * Check if message is allowed
   *
   * @param connectionId - Connection ID
   * @returns True if message is allowed
   */
  allowMessage(connectionId: string): boolean {
    const now = Date.now();
    const timestamps = this.messages.get(connectionId) || [];

    // Remove expired timestamps
    const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);

    // Check if under limit
    if (validTimestamps.length >= this.maxMessages) {
      return false;
    }

    // Add new timestamp
    validTimestamps.push(now);
    this.messages.set(connectionId, validTimestamps);

    return true;
  }

  /**
   * Get current message count for connection
   *
   * @param connectionId - Connection ID
   * @returns Message count
   */
  getMessageCount(connectionId: string): number {
    const now = Date.now();
    const timestamps = this.messages.get(connectionId) || [];
    return timestamps.filter(ts => now - ts < this.windowMs).length;
  }

  /**
   * Remove connection from limiter
   *
   * @param connectionId - Connection ID
   */
  removeConnection(connectionId: string): void {
    this.messages.delete(connectionId);
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.messages.clear();
  }
}

/**
 * Message validator
 */
export class MessageValidator {
  private maxMessageSize: number;
  private allowedTypes: Set<string>;

  /**
   * Constructor
   *
   * @param maxMessageSize - Maximum message size in bytes
   * @param allowedTypes - Allowed message types
   */
  constructor(
    maxMessageSize: number = 65536,
    allowedTypes: string[] = ['subscribe', 'unsubscribe', 'join', 'leave', 'ping', 'pong']
  ) {
    this.maxMessageSize = maxMessageSize;
    this.allowedTypes = new Set(allowedTypes);
  }

  /**
   * Validate message
   *
   * @param message - Message to validate
   * @returns Validation result
   */
  validate(message: any): { valid: boolean; error?: string } {
    // Check if message is object
    if (typeof message !== 'object' || message === null) {
      return { valid: false, error: 'Message must be an object' };
    }

    // Check if type exists
    if (!message.type || typeof message.type !== 'string') {
      return { valid: false, error: 'Message type is required' };
    }

    // Check if type is allowed
    if (!this.allowedTypes.has(message.type)) {
      return { valid: false, error: `Message type '${message.type}' is not allowed` };
    }

    // Check message size (approximate)
    const messageSize = JSON.stringify(message).length;
    if (messageSize > this.maxMessageSize) {
      return { valid: false, error: `Message size ${messageSize} exceeds limit ${this.maxMessageSize}` };
    }

    // Validate specific message types
    switch (message.type) {
      case 'subscribe':
      case 'unsubscribe':
        if (!message.event || typeof message.event !== 'string') {
          return { valid: false, error: 'Event name is required for subscribe/unsubscribe' };
        }
        break;
      case 'join':
      case 'leave':
        if (!message.room || typeof message.room !== 'string') {
          return { valid: false, error: 'Room name is required for join/leave' };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Add allowed message type
   *
   * @param type - Message type to allow
   */
  addAllowedType(type: string): void {
    this.allowedTypes.add(type);
  }

  /**
   * Remove allowed message type
   *
   * @param type - Message type to disallow
   */
  removeAllowedType(type: string): void {
    this.allowedTypes.delete(type);
  }
}

/**
 * WebSocket security manager
 */
export class WebSocketSecurityManager {
  private jwtService?: JWTService;
  private rbacService?: RBACService;
  private connectionLimiter: ConnectionRateLimiter;
  private messageLimiter: MessageRateLimiter;
  private messageValidator: MessageValidator;
  private authRequired: boolean;

  /**
   * Constructor
   *
   * @param config - Security configuration
   */
  constructor(config: {
    jwtService?: JWTService;
    rbacService?: RBACService;
    maxConnectionsPerIp?: number;
    connectionWindowMs?: number;
    maxMessagesPerConnection?: number;
    messageWindowMs?: number;
    maxMessageSize?: number;
    allowedMessageTypes?: string[];
    authRequired?: boolean;
  } = {}) {
    this.jwtService = config.jwtService;
    this.rbacService = config.rbacService;
    this.authRequired = config.authRequired ?? false;

    this.connectionLimiter = new ConnectionRateLimiter(
      config.maxConnectionsPerIp,
      config.connectionWindowMs
    );

    this.messageLimiter = new MessageRateLimiter(
      config.maxMessagesPerConnection,
      config.messageWindowMs
    );

    this.messageValidator = new MessageValidator(
      config.maxMessageSize,
      config.allowedMessageTypes
    );
  }

  /**
   * Authenticate WebSocket connection
   *
   * @param token - JWT token
   * @returns Authentication result
   */
  async authenticateConnection(token: string): Promise<WSAuthResult> {
    if (!this.jwtService) {
      if (this.authRequired) {
        return {
          authenticated: false,
          error: 'JWT service not configured'
        };
      }
      return { authenticated: true };
    }

    try {
      const result = this.jwtService.verifyToken(token, 'access');

      if (!result.valid || !result.payload) {
        return {
          authenticated: false,
          error: result.error || 'Invalid token'
        };
      }

      return {
        authenticated: true,
        userId: result.payload.sub,
        username: result.payload.username,
        role: result.payload.role
      };
    } catch (error) {
      return {
        authenticated: false,
        error: 'Authentication failed'
      };
    }
  }

  /**
   * Check if connection is allowed for IP
   *
   * @param ip - Client IP address
   * @returns True if connection is allowed
   */
  checkConnectionLimit(ip: string): boolean {
    return this.connectionLimiter.allowConnection(ip);
  }

  /**
   * Check if message is allowed for connection
   *
   * @param connectionId - Connection ID
   * @returns True if message is allowed
   */
  checkMessageLimit(connectionId: string): boolean {
    return this.messageLimiter.allowMessage(connectionId);
  }

  /**
   * Validate message
   *
   * @param message - Message to validate
   * @returns Validation result
   */
  validateMessage(message: any): { valid: boolean; error?: string } {
    return this.messageValidator.validate(message);
  }

  /**
   * Check if user has permission for action
   *
   * @param userId - User ID
   * @param username - Username
   * @param role - User role
   * @param resource - Resource to access
   * @param action - Action to perform
   * @returns True if user has permission
   */
  checkPermission(
    userId: string,
    username: string,
    role: string,
    resource: Resource,
    action: Action
  ): boolean {
    if (!this.rbacService) {
      return true; // No RBAC configured, allow all
    }

    const result = this.rbacService.authorize(
      { sub: userId, username, role: role as Role, jti: 'ws' },
      resource,
      action
    );

    return result.granted;
  }

  /**
   * Handle connection closed
   *
   * @param connectionId - Connection ID
   */
  onConnectionClosed(connectionId: string): void {
    this.messageLimiter.removeConnection(connectionId);
  }

  /**
   * Get connection stats for IP
   *
   * @param ip - Client IP address
   * @returns Connection count
   */
  getConnectionStats(ip: string): number {
    return this.connectionLimiter.getConnectionCount(ip);
  }

  /**
   * Get message stats for connection
   *
   * @param connectionId - Connection ID
   * @returns Message count
   */
  getMessageStats(connectionId: string): number {
    return this.messageLimiter.getMessageCount(connectionId);
  }

  /**
   * Clear all security data
   */
  clear(): void {
    this.connectionLimiter.clear();
    this.messageLimiter.clear();
  }
}

/**
 * Extract IP address from request
 *
 * @param request - HTTP request
 * @returns IP address
 */
export function extractIpFromRequest(request: Request): string {
  // Try x-forwarded-for
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    if (ips[0]) {
      return ips[0];
    }
  }

  // Try cf-connecting-ip (Cloudflare)
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp;
  }

  // Try x-real-ip
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

/**
 * Extract token from URL query params
 *
 * @param url - Request URL
 * @returns JWT token or null
 */
export function extractTokenFromUrl(url: URL): string | null {
  return url.searchParams.get('token');
}

/**
 * Export types
 */
export type { WSAuthResult };
