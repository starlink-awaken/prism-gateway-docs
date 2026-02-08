# 安装指南

本文档详细说明如何在不同平台上安装 ReflectGuard。

## 系统要求

### 运行时环境

| 环境 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Bun | 1.0.0 | 最新版 |
| Node.js | 20.0.0 | LTS 版本 |

### 操作系统

| 操作系统 | 支持状态 | 备注 |
|----------|----------|------|
| macOS | ✅ 完全支持 | 10.15+ |
| Linux | ✅ 完全支持 | 主流发行版 |
| Windows | ✅ 完全支持 | WSL2 推荐 |

### 磁盘空间

- **最小安装**: 50MB
- **完整安装**: 100MB
- **运行时空间**: 10MB（不含数据）

## 安装方法

### 方法 1: 从源码安装（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/your-org/prism-gateway.git ~/.prism-gateway
cd ~/.prism-gateway

# 2. 安装依赖
bun install

# 3. 运行测试验证
bun test

# 4. 构建项目
bun run build

# 5. 全局安装 CLI
bun link
```

### 方法 2: 使用 npm 安装

```bash
npm install -g @prism-gateway/cli
```

### 方法 3: 使用 Docker

```bash
# 拉取镜像
docker pull prism-gateway:latest

# 运行容器
docker run -d \
  -v ~/.prism-gateway:/data \
  -p 3000:3000 \
  prism-gateway:latest
```

## 验证安装

```bash
# 检查版本
prism --version

# 输出: ReflectGuard v1.1.0

# 运行健康检查
prism health

# 输出: ✓ System healthy
```

## 初始化配置

```bash
# 交互式初始化
prism init

# 这将创建以下目录结构:
# ~/.prism-gateway/
# ├── level-1-hot/
# ├── level-2-warm/
# └── level-3-cold/
```

## 升级

```bash
# 从源码升级
cd ~/.prism-gateway
git pull origin main
bun install
bun run build

# 使用 npm 升级
npm update -g @prism-gateway/cli

# 数据迁移（如需要）
prism migrate
```

## 卸载

```bash
# 取消链接
bun unlink prism-gateway

# 删除全局包
npm uninstall -g @prism-gateway/cli

# 删除数据目录（可选）
rm -rf ~/.prism-gateway
```

## 故障排查

### 问题: 找不到 prism 命令

**解决方案:**

```bash
# 确保 bun 全局安装路径在 PATH 中
echo $PATH | grep -o "$(bun pm bin -g)"

# 如不在，添加到 shell 配置:
export PATH="$(bun pm bin -g):$PATH"
```

### 问题: 测试失败

**解决方案:**

```bash
# 清理缓存
rm -rf node_modules bun.lockb
bun install

# 使用调试模式运行测试
bun test --debug
```

---

**最后更新:** 2026-02-07
