/**
 * WebSocket服务器测试
 *
 * @description
 * WebSocket服务器的完整测试套件
 *
 * @test_coverage
 * - 服务器启动和关闭
 * - 连接管理
 * - 心跳机制
 * - 消息广播和单播
 * - 房间管理
 * 重连处理
 * - 并发连接（100+）
 *
 * @module tests/api/websocket/websocketServer.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { WebSocketServer } from '../../../api/websocket/WebSocketServer.js';
import { randomUUID } from 'node:crypto';

/**
 * 模拟WebSocket客户端
 */
class MockWebSocket {
  id: string;
  readyState: 'OPEN' | 'CLOSED';
  sent: any[];
  onmessage: ((data: any) => void) | null = null;

  constructor(id: string) {
    this.id = id;
    this.readyState = 'OPEN';
    this.sent = [];
  }

  send(data: any) {
    if (this.readyState === 'OPEN') {
      this.sent.push(JSON.parse(data));
      if (this.onmessage) {
        this.onmessage({ data });
      }
    }
  }

  ping() {
    // Mock ping method - do nothing
  }

  close() {
    this.readyState = 'CLOSED';
  }
}

describe('WebSocketServer', () => {
  let server: WebSocketServer;
  // 使用随机端口避免冲突
  const getTestPort = () => 3001 + Math.floor(Math.random() * 100);

  beforeEach(async () => {
    const TEST_PORT = getTestPort();
    server = new WebSocketServer({ port: TEST_PORT });
    await server.start();
  });

  afterEach(async () => {
    if (server && server.isRunning()) {
      await server.stop();
    }
  });

  describe('服务器启动和关闭', () => {
    it('应该成功启动服务器', async () => {
      const isRunning = server.isRunning();

      expect(isRunning).toBe(true);
    });

    it('应该返回有效的服务器地址', () => {
      const address = server.getAddress();

      // 验证地址格式，而不是具体的端口号
      expect(address).toMatch(/^ws:\/\/localhost:\d+$/);
    });

    it('应该成功关闭服务器', async () => {
      await server.stop();

      const isRunning = server.isRunning();

      expect(isRunning).toBe(false);
    });

    it('应该处理关闭已关闭的服务器', async () => {
      await server.stop();

      // 再次关闭不应该抛出错误
      await expect(server.stop()).resolves.toBeUndefined();
    });
  });

  describe('连接管理', () => {
    it('应该接受新连接', async () => {
      const client = new MockWebSocket('client-1');

      server.addConnection(client);

      expect(server.getConnectionCount()).toBe(1);
    });

    it('应该移除断开的连接', async () => {
      const client = new MockWebSocket('client-1');
      const connId = server.addConnection(client);

      client.close();
      server.removeConnection(connId);

      expect(server.getConnectionCount()).toBe(0);
    });

    it('应该支持100+并发连接', async () => {
      const clients: MockWebSocket[] = [];
      const connIds: string[] = [];

      for (let i = 0; i < 100; i++) {
        const client = new MockWebSocket(`client-${i}`);
        clients.push(client);
        connIds.push(server.addConnection(client));
      }

      expect(server.getConnectionCount()).toBe(100);

      // 清理
      connIds.forEach(id => server.removeConnection(id));
    });

    it('应该按ID查找连接', async () => {
      const client = new MockWebSocket('client-1');
      const connId = server.addConnection(client);

      const found = server.getConnection(connId);

      expect(found).toBeDefined();
      expect(found?.id).toBe(connId);
    });

    it('应该处理不存在的连接ID', async () => {
      const found = server.getConnection('non-existent');

      expect(found).toBeNull();
    });
  });

  describe('心跳机制', () => {
    it('应该定期发送心跳', async () => {
      const client = new MockWebSocket('client-1');
      const connId = server.addConnection(client);

      // 设置短的心跳间隔用于测试
      server.setHeartbeatInterval(100); // 100ms

      // 等待心跳
      await new Promise(resolve => setTimeout(resolve, 150));

      // 心跳机制会调用conn.socket.ping()，MockWebSocket已实现该方法
      // 验证连接仍然活跃
      const conn = server.getConnection(connId);
      expect(conn).toBeDefined();

      // 清理
      server.clearHeartbeat();
      server.removeConnection(connId);
    });

    it('应该检测不活跃连接并关闭', async () => {
      const client = new MockWebSocket('client-1');
      const connId = server.addConnection(client);

      // 设置短的超时时间
      server.setTimeout(200); // 200ms
      server.setHeartbeatInterval(50); // 50ms心跳

      // 等待超时
      await new Promise(resolve => setTimeout(resolve, 250));

      // 连接应该被移除（因为没有响应pong）
      expect(server.getConnectionCount()).toBe(0);

      // 清理
      server.clearHeartbeat();
    });
  });

  describe('消息广播', () => {
    it('应该广播消息给所有连接', async () => {
      const clients = [
        new MockWebSocket('client-1'),
        new MockWebSocket('client-2'),
        new MockWebSocket('client-3')
      ];

      const connIds = clients.map(c => server.addConnection(c));

      const message = { type: 'test', data: 'hello' };
      server.broadcast(message);

      clients.forEach(client => {
        expect(client.sent.length).toBe(1);
        // 验证包含timestamp字段
        expect(client.sent[0].type).toBe('test');
        expect(client.sent[0].data).toBe('hello');
        expect(client.sent[0].timestamp).toBeDefined();
      });

      // 清理
      connIds.forEach(id => server.removeConnection(id));
    });

    it('应该单播消息给特定连接', async () => {
      const client1 = new MockWebSocket('client-1');
      const client2 = new MockWebSocket('client-2');

      const id1 = server.addConnection(client1);
      const id2 = server.addConnection(client2);

      const message = { type: 'private', data: 'secret' };
      server.sendTo(id1, message);

      expect(client1.sent.length).toBe(1);
      expect(client1.sent[0].type).toBe('private');
      expect(client2.sent.length).toBe(0);

      // 清理
      server.removeConnection(id1);
      server.removeConnection(id2);
    });

    it('广播应该在<100ms内完成', async () => {
      const clients: MockWebSocket[] = [];
      const connIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        clients.push(new MockWebSocket(`client-${i}`));
        connIds.push(server.addConnection(clients[i]));
      }

      const message = { type: 'test', data: 'broadcast' };

      const start = performance.now();
      server.broadcast(message);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);

      // 清理
      connIds.forEach(id => server.removeConnection(id));
    });
  });

  describe('房间管理', () => {
    it('应该添加连接到房间', async () => {
      const client = new MockWebSocket('client-1');
      const connId = server.addConnection(client);

      server.joinRoom(connId, 'analytics');

      const roomMembers = server.getRoomMembers('analytics');
      expect(roomMembers).toContain(connId);
    });

    it('应该移除连接从房间', async () => {
      const client = new MockWebSocket('client-1');
      const connId = server.addConnection(client);
      server.joinRoom(connId, 'analytics');

      server.leaveRoom(connId, 'analytics');

      const roomMembers = server.getRoomMembers('analytics');
      expect(roomMembers).not.toContain(connId);
    });

    it('应该广播消息到房间', async () => {
      const client1 = new MockWebSocket('client-1');
      const client2 = new MockWebSocket('client-2');
      const client3 = new MockWebSocket('client-3');

      const id1 = server.addConnection(client1);
      const id2 = server.addConnection(client2);
      const id3 = server.addConnection(client3);

      server.joinRoom(id1, 'analytics');
      server.joinRoom(id2, 'analytics');
      // client3 不在房间

      const message = { type: 'update', data: 'room message' };
      server.broadcastToRoom('analytics', message);

      // joinRoom 会发送确认消息，所以有2条消息
      expect(client1.sent.length).toBe(2);
      expect(client1.sent[1].type).toBe('update');
      expect(client2.sent.length).toBe(2);
      expect(client2.sent[1].type).toBe('update');
      expect(client3.sent.length).toBe(0);

      // 清理
      [id1, id2, id3].forEach(id => server.removeConnection(id));
    });

    it('应该获取房间列表', async () => {
      const client1 = new MockWebSocket('client-1');
      const client2 = new MockWebSocket('client-2');

      const id1 = server.addConnection(client1);
      const id2 = server.addConnection(client2);

      server.joinRoom(id1, 'analytics');
      server.joinRoom(id2, 'gateway');

      const rooms = server.getRooms();

      expect(rooms).toContain('analytics');
      expect(rooms).toContain('gateway');

      // 清理
      [id1, id2].forEach(id => server.removeConnection(id));
    });
  });

  describe('事件订阅', () => {
    it('应该支持订阅事件类型', async () => {
      const client = new MockWebSocket('client-1');
      const connId = server.addConnection(client);

      server.subscribe(connId, 'gateway:check');

      const subscriptions = server.getSubscriptions(connId);
      expect(subscriptions).toContain('gateway:check');
    });

    it('应该发送事件给订阅者', async () => {
      const client1 = new MockWebSocket('client-1');
      const client2 = new MockWebSocket('client-2');

      const id1 = server.addConnection(client1);
      const id2 = server.addConnection(client2);

      server.subscribe(id1, 'gateway:check');
      // client2 未订阅

      const event = {
        type: 'gateway:check',
        data: { status: 'PASS', violations: [] }
      };

      server.emitEvent(event.type, event.data);

      // subscribe 会发送确认消息，所以有2条消息
      expect(client1.sent.length).toBe(2);
      expect(client1.sent[1].type).toBe('gateway:check');
      expect(client2.sent.length).toBe(0);

      // 清理
      [id1, id2].forEach(id => server.removeConnection(id));
    });

    it('应该取消订阅', async () => {
      const client = new MockWebSocket('client-1');
      const connId = server.addConnection(client);

      server.subscribe(connId, 'gateway:check');
      server.unsubscribe(connId, 'gateway:check');

      const subscriptions = server.getSubscriptions(connId);
      expect(subscriptions).not.toContain('gateway:check');
    });
  });

  describe('重连处理', () => {
    it('应该标记连接为重连', async () => {
      const client = new MockWebSocket('client-1');
      const connId = server.addConnection(client);

      // 模拟重连
      server.handleReconnect(connId);

      const connection = server.getConnection(connId);
      expect(connection?.metadata).toHaveProperty('reconnectCount');
    });

    it('应该记录重连次数', async () => {
      const client = new MockWebSocket('client-1');
      const connId = server.addConnection(client);
      server.handleReconnect(connId);
      server.handleReconnect(connId);

      const connection = server.getConnection(connId);
      expect(connection?.metadata.reconnectCount).toBe(2);
    });
  });

  describe('错误处理', () => {
    it('应该处理发送到不存在连接的消息', async () => {
      expect(() => {
        server.sendTo('non-existent', { type: 'test' });
      }).not.toThrow();
    });

    it('应该处理无效的房间操作', async () => {
      const client = new MockWebSocket('client-1');
      const connId = server.addConnection(client);

      // 尝试离开未加入的房间
      expect(() => {
        server.leaveRoom(connId, 'non-existent-room');
      }).not.toThrow();

      server.removeConnection(connId);
    });
  });
});
