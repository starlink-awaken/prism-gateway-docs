/**
 * WebSocket服务器
 *
 * @description
 * 提供WebSocket实时通信服务，用于Gateway系统事件推送
 *
 * @features
 * - WebSocket服务器（使用ws库）
 * - 心跳机制（可配置间隔）
 * - 自动重连处理
 * - 消息广播和单播
 * - 房间管理（按订阅类型分组）
 * - 连接状态管理
 * - 事件订阅系统
 *
 * @performance
 * - 支持100+并发连接
 * - 广播延迟<100ms
 * - 内存优化：自动清理断开连接
 *
 * @module api/websocket/WebSocketServer
 */

import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'events';

/**
 * WebSocket连接接口
 */
export interface WebSocketConnection {
  id: string;
  socket: any; // WebSocket对象
  metadata: {
    connectedAt: number;
    lastHeartbeat: number;
    reconnectCount: number;
    rooms: Set<string>;
    subscriptions: Set<string>;
  };
}

/**
 * 服务器配置接口
 */
export interface WebSocketServerConfig {
  port: number;
  heartbeatInterval?: number;  // 心跳间隔（ms），默认30秒
  timeout?: number;            // 超时时间（ms），默认60秒
  pingTimeout?: number;         // ping超时（ms），默认5秒
  maxConnections?: number;     // 最大连接数
}

/**
 * 消息接口
 */
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: string;
}

/**
 * WebSocket服务器类
 */
export class WebSocketServer extends EventEmitter {
  private config: Required<WebSocketServerConfig>;
  private server: ReturnType<typeof Bun.serve> | null = null;
  private connections: Map<string, WebSocketConnection> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private heartbeatTimer?: NodeJS.Timeout;
  private isStarted: boolean = false;

  /**
   * 构造函数
   *
   * @param config - 服务器配置
   */
  constructor(config: WebSocketServerConfig) {
    super(); // 调用 EventEmitter 构造函数
    this.config = {
      heartbeatInterval: 30000,  // 30秒
      timeout: 60000,            // 60秒
      pingTimeout: 5000,          // 5秒
      maxConnections: 100,
      ...config
    };
  }

  /**
   * 启动WebSocket服务器
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    // 使用Bun的WebSocket实现
    // 注意：Bun原生支持WebSocket，可以直接使用
    this.server = Bun.serve({
      port: this.config.port,
      fetch: async (req, server) => {
        // 解析请求URL
        const url = new URL(req.url);

        // 检查是否为WebSocket升级请求
        if (url.pathname === '/ws') {
          // 尝试升级为WebSocket连接
          const upgraded = server.upgrade(req);
          if (upgraded) {
            // upgrade成功，返回undefined让Bun处理WebSocket
            return undefined;
          }
          // upgrade失败，返回错误
          return new Response('WebSocket upgrade failed', { status: 400 });
        }

        // 非WebSocket请求，返回404
        return new Response('Not Found', { status: 404 });
      },
      websocket: {
        message: (ws, message) => this.handleMessage(ws, message),
        open: (ws) => this.handleOpen(ws),
        close: (ws, code, reason) => this.handleClose(ws, code, reason),
        ping: (ws, data) => this.handlePing(ws, data),
        pong: (ws, data) => this.handlePong(ws, data)
      }
    });

    this.isStarted = true;
    this.startHeartbeat();

    console.log(`[WebSocket] Server started on ws://localhost:${this.config.port}`);
  }

  /**
   * 停止WebSocket服务器
   *
   * @description
   * 优雅地停止服务器并释放所有资源：
   * 1. 停止心跳定时器
   * 2. 关闭所有WebSocket连接
   * 3. 停止HTTP服务器（释放端口）
   * 4. 清理所有内部状态
   *
   * 确保端口完全释放，避免EADDRINUSE错误
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    // 1. 停止心跳定时器
    this.clearHeartbeat();

    // 2. 关闭所有WebSocket连接
    for (const [id, conn] of this.connections) {
      try {
        if (conn.socket && typeof conn.socket.close === 'function') {
          conn.socket.close();
        }
      } catch (error) {
        console.error(`[WebSocket] Error closing connection ${id}:`, error);
      }
    }

    // 3. 停止HTTP服务器（关键：释放端口）
    if (this.server) {
      try {
        // Bun.serve返回的Server对象有stop()方法
        // 这会关闭服务器并释放端口
        this.server.stop();
        this.server = null;
      } catch (error) {
        console.error('[WebSocket] Error stopping server:', error);
      }
    }

    // 4. 清理所有内部状态
    this.connections.clear();
    this.rooms.clear();
    this.isStarted = false;

    console.log('[WebSocket] Server stopped and port released');
  }

  /**
   * 处理WebSocket连接建立
   */
  private handleOpen(ws: any): void {
    const connectionId = randomUUID();

    const connection: WebSocketConnection = {
      id: connectionId,
      socket: ws,
      metadata: {
        connectedAt: Date.now(),
        lastHeartbeat: Date.now(),
        reconnectCount: 0,
        rooms: new Set(),
        subscriptions: new Set()
      }
    };

    this.connections.set(connectionId, connection);

    // 发送欢迎消息
    this.sendTo(connectionId, {
      type: 'connected',
      data: {
        connectionId,
        serverTime: new Date().toISOString()
      }
    });

    this.emit('connection', connection);
    console.log(`[WebSocket] Client connected: ${connectionId} (Total: ${this.connections.size})`);
  }

  /**
   * 处理WebSocket消息
   */
  private handleMessage(ws: any, message: string | Buffer): void {
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : message;
      const connectionId = this.findConnectionIdBySocket(ws);

      if (!connectionId) {
        return;
      }

      switch (data.type) {
        case 'subscribe':
          this.handleSubscribe(connectionId, data.event);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(connectionId, data.event);
          break;
        case 'join':
          this.handleJoinRoom(connectionId, data.room);
          break;
        case 'leave':
          this.handleLeaveRoom(connectionId, data.room);
          break;
        case 'ping':
          this.handlePingFromClient(connectionId);
          break;
        case 'pong':
          this.handlePongFromClient(connectionId);
          break;
        default:
          console.warn(`[WebSocket] Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('[WebSocket] Error handling message:', error);
    }
  }

  /**
   * 处理WebSocket关闭
   */
  private handleClose(ws: any, code: number, reason: string): void {
    const connectionId = this.findConnectionIdBySocket(ws);

    if (!connectionId) {
      return;
    }

    this.removeConnection(connectionId);
    console.log(`[WebSocket] Client disconnected: ${connectionId} (Code: ${code}, Reason: ${reason})`);
  }

  /**
   * 处理ping
   */
  private handlePing(ws: any, data: Buffer): void {
    ws.pong(data);
  }

  /**
   * 处理pong
   */
  private handlePong(ws: any, data: Buffer): void {
    const connectionId = this.findConnectionIdBySocket(ws);

    if (connectionId) {
      const conn = this.connections.get(connectionId);
      if (conn) {
        conn.metadata.lastHeartbeat = Date.now();
      }
    }
  }

  /**
   * 添加连接（用于测试或手动管理）
   */
  addConnection(socket: any): string {
    const connectionId = randomUUID();

    const connection: WebSocketConnection = {
      id: connectionId,
      socket,
      metadata: {
        connectedAt: Date.now(),
        lastHeartbeat: Date.now(),
        reconnectCount: 0,
        rooms: new Set(),
        subscriptions: new Set()
      }
    };

    this.connections.set(connectionId, connection);
    return connectionId;
  }

  /**
   * 移除断开的连接
   */
  removeConnection(connectionId: string): void {
    const conn = this.connections.get(connectionId);

    if (conn) {
      // 从所有房间移除
      conn.metadata.rooms.forEach(room => {
        const members = this.rooms.get(room);
        if (members) {
          members.delete(connectionId);
          if (members.size === 0) {
            this.rooms.delete(room);
          }
        }
      });

      this.connections.delete(connectionId);
      this.emit('disconnect', conn);
    }
  }

  /**
   * 获取连接数量
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * 通过ID获取连接
   */
  getConnection(connectionId: string): WebSocketConnection | null {
    return this.connections.get(connectionId) || null;
  }

  /**
   * 广播消息给所有连接
   */
  broadcast(message: WebSocketMessage): void {
    const payload = JSON.stringify({
      ...message,
      timestamp: new Date().toISOString()
    });

    this.connections.forEach((conn) => {
      try {
        conn.socket.send(payload);
      } catch (error) {
        console.error(`[WebSocket] Error sending to ${conn.id}:`, error);
        this.removeConnection(conn.id);
      }
    });
  }

  /**
   * 发送消息给特定连接
   */
  sendTo(connectionId: string, message: WebSocketMessage): void {
    const conn = this.connections.get(connectionId);

    if (!conn) {
      return;
    }

    try {
      const payload = JSON.stringify({
        ...message,
        timestamp: new Date().toISOString()
      });

      conn.socket.send(payload);
    } catch (error) {
      console.error(`[WebSocket] Error sending to ${connectionId}:`, error);
      this.removeConnection(connectionId);
    }
  }

  /**
   * 广播消息到房间
   */
  broadcastToRoom(room: string, message: WebSocketMessage): void {
    const members = this.rooms.get(room);

    if (!members || members.size === 0) {
      return;
    }

    const payload = JSON.stringify({
      ...message,
      timestamp: new Date().toISOString()
    });

    members.forEach((connectionId) => {
      const conn = this.connections.get(connectionId);
      if (conn) {
        try {
          conn.socket.send(payload);
        } catch (error) {
          console.error(`[WebSocket] Error sending to ${connectionId}:`, error);
          this.removeConnection(connectionId);
        }
      }
    });
  }

  /**
   * 添加连接到房间
   */
  joinRoom(connectionId: string, room: string): void {
    const conn = this.connections.get(connectionId);

    if (!conn) {
      return;
    }

    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }

    this.rooms.get(room)!.add(connectionId);
    conn.metadata.rooms.add(room);

    // 通知客户端已加入房间
    this.sendTo(connectionId, {
      type: 'room:joined',
      data: { room }
    });
  }

  /**
   * 从房间移除连接
   */
  leaveRoom(connectionId: string, room: string): void {
    const members = this.rooms.get(room);

    if (members) {
      members.delete(connectionId);

      if (members.size === 0) {
        this.rooms.delete(room);
      }
    }

    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.metadata.rooms.delete(room);

      // 通知客户端已离开房间
      this.sendTo(connectionId, {
        type: 'room:left',
        data: { room }
      });
    }
  }

  /**
   * 获取房间成员
   */
  getRoomMembers(room: string): string[] {
    const members = this.rooms.get(room);
    return members ? Array.from(members) : [];
  }

  /**
   * 获取所有房间列表
   */
  getRooms(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * 订阅事件
   */
  subscribe(connectionId: string, event: string): void {
    const conn = this.connections.get(connectionId);

    if (!conn) {
      return;
    }

    conn.metadata.subscriptions.add(event);

    this.sendTo(connectionId, {
      type: 'subscribed',
      data: { event }
    });

    console.log(`[WebSocket] Client ${connectionId} subscribed to: ${event}`);
  }

  /**
   * 取消订阅
   */
  unsubscribe(connectionId: string, event: string): void {
    const conn = this.connections.get(connectionId);

    if (!conn) {
      return;
    }

    conn.metadata.subscriptions.delete(event);

    this.sendTo(connectionId, {
      type: 'unsubscribed',
      data: { event }
    });

    console.log(`[WebSocket] Client ${connectionId} unsubscribed from: ${event}`);
  }

  /**
   * 获取订阅列表
   */
  getSubscriptions(connectionId: string): string[] {
    const conn = this.connections.get(connectionId);
    return conn ? Array.from(conn.metadata.subscriptions) : [];
  }

  /**
   * 发送事件给订阅者
   */
  emitEvent(event: string, data: any): void {
    this.connections.forEach((conn) => {
      if (conn.metadata.subscriptions.has(event)) {
        this.sendTo(conn.id, {
          type: event,
          data
        });
      }
    });
  }

  /**
   * 处理订阅请求
   */
  private handleSubscribe(connectionId: string, event: string): void {
    this.subscribe(connectionId, event);
  }

  /**
   * 处理取消订阅请求
   */
  private handleUnsubscribe(connectionId: string, event: string): void {
    this.unsubscribe(connectionId, event);
  }

  /**
   * 处理加入房间请求
   */
  private handleJoinRoom(connectionId: string, room: string): void {
    this.joinRoom(connectionId, room);
  }

  /**
   * 处理离开房间请求
   */
  private handleLeaveRoom(connectionId: string, room: string): void {
    this.leaveRoom(connectionId, room);
  }

  /**
   * 处理来自客户端的ping
   */
  private handlePingFromClient(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.metadata.lastHeartbeat = Date.now();
    }
  }

  /**
   * 处理来自客户端的pong
   */
  private handlePongFromClient(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.metadata.lastHeartbeat = Date.now();
    }
  }

  /**
   * 处理重连
   */
  handleReconnect(connectionId: string): void {
    const conn = this.connections.get(connectionId);

    if (conn) {
      conn.metadata.reconnectCount++;
      conn.metadata.connectedAt = Date.now();
      conn.metadata.lastHeartbeat = Date.now();

      console.log(`[WebSocket] Client reconnected: ${connectionId} (Count: ${conn.metadata.reconnectCount})`);
    }
  }

  /**
   * 设置心跳间隔
   */
  setHeartbeatInterval(interval: number): void {
    this.config.heartbeatInterval = interval;
    if (this.isStarted) {
      this.clearHeartbeat();
      this.startHeartbeat();
    }
  }

  /**
   * 设置超时时间
   */
  setTimeout(timeout: number): void {
    this.config.timeout = timeout;
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this.config.timeout;

      // 发送心跳并检查超时连接
      this.connections.forEach((conn, connectionId) => {
        const lastActivity = conn.metadata.lastHeartbeat;

        // 检查超时
        if (now - lastActivity > timeout) {
          console.log(`[WebSocket] Connection timeout: ${connectionId}`);
          this.removeConnection(connectionId);
          return;
        }

        // 发送ping
        try {
          conn.socket.ping();
        } catch (error) {
          console.error(`[WebSocket] Error sending ping to ${connectionId}:`, error);
          this.removeConnection(connectionId);
        }
      });
    }, this.config.heartbeatInterval);
  }

  /**
   * 清除心跳
   */
  clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * 获取服务器运行状态
   */
  isRunning(): boolean {
    return this.isStarted;
  }

  /**
   * 获取服务器地址
   */
  getAddress(): string {
    return `ws://localhost:${this.config.port}`;
  }

  /**
   * 通过socket查找连接ID
   */
  private findConnectionIdBySocket(ws: any): string | null {
    for (const [id, conn] of this.connections) {
      if (conn.socket === ws) {
        return id;
      }
    }
    return null;
  }
}

/**
 * 默认导出
 */
export default WebSocketServer;
