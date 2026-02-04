# PRISM-Gateway 快速开始指南

> 5分钟上手，10分钟第一次复盘，30分钟掌握核心功能

---

## 第一步: 了解核心概念（2分钟）

### 什么是PRISM-Gateway？
一个融合了**Gateway行为准则检查**和**Retrospective复盘系统**的统一工具，帮助你：
- ✅ **预防错误**: 事前检查，避免重复失败
- ✅ **持续提升**: 事后复盘，提炼最佳实践
- ✅ **知识积累**: 自动沉淀，形成组织智慧

### 核心机制：双循环
```
任务开始 → Gateway检查（<1秒）→ 执行任务
                ↓
            违规阻断？
                ↓ 是
          复盘分析（3-5分钟）
                ↓
          更新规则库
                ↓
          下次检查更智能（自进化）
```

### 7维度复盘
不要被7个维度吓到！实际上是分层实现：
- **基础层（必做）**: 原则、模式、数据
- **增强层（选做）**: 基准、陷阱、成功、工具
- **应用层（输出）**: SOP、检查清单、模板

---

## 第二步: 初始化系统（3分钟）

### 2.1 安装依赖
```bash
# 克隆项目（假设已存在）
cd prism-gateway

# 安装Python依赖
pip install -r requirements.txt

# 验证安装
python -c "import prism; print('安装成功!')"
```

### 2.2 初始化MEMORY库
```bash
# 运行初始化脚本
python init_memory.py

# 检查目录结构
ls -la memory/
# 应该看到:
# level-1-hot/   (热数据)
# level-2-warm/  (温数据)
# level-3-cold/  (冷数据)
```

### 2.3 配置Gateway规则
```bash
# 编辑配置文件
vim memory/level-1-hot/principles.json

# 查看默认的5大准则
cat memory/level-1-hot/principles.json | python -m json.tool
```

### 2.4 启动Gateway服务
```bash
# 启动Gateway守护进程
python gateway_server.py &

# 验证Gateway运行
curl http://localhost:8000/health
# 应该返回: {"status": "ok"}
```

---

## 第三步: 第一次Gateway检查（2分钟）

### 3.1 使用CLI命令
```bash
# 检查一个简单的任务
prism check "请搜索Python性能优化最佳实践"

# 查看结果
# 状态: PASS ✅
# 置信度: 0.9
# 检查时间: 0.5秒
```

### 3.2 测试违规检测
```bash
# 测试一个会触发警告的任务
prism check "我觉得应该这样做，肯定是正确的"

# 查看结果
# 状态: WARNING ⚠️
# 违规详情:
#   - 过度自信: "肯定"是绝对化语言
#   - 信息不足: "我觉得"缺乏数据支撑
#
# 建议:
#   - 使用概率性语言
#   - 先搜索数据支撑
```

### 3.3 测试阻断功能
```bash
# 测试一个会被阻断的任务
prism check "直接执行，不需要验证"

# 查看结果
# 状态: BLOCKED 🚫
# 违规详情:
#   - 验证真实: 未提及验证信息
#   - 不重复失败: 未检查失败模式库
#
# 必须修正:
#   1. 添加信息验证步骤
#   2. 查阅失败模式库
```

---

## 第四步: 第一次复盘（10分钟）

### 4.1 触发复盘
```bash
# 方法1: 自动触发（Gateway违规后）
prism retro --auto

# 方法2: 手动触发（任务完成后）
prism retro create --task-id=task-001
```

### 4.2 使用交互式清单
```bash
# 启动交互式复盘
prism retro interactive

# 系统会引导你完成7维度检查:
# ------------------------------------------------
# 维度1: 原则检查（Principles）
# ================================================
# Q1: 搜索优先 - 是否有足够的数据支撑？
#    [1] 是  [2] 否  [3] 部分
# 你的选择: 1

# Q2: 验证真实 - 信息来源是否可靠？
#    [1] 已验证  [2] 未验证  [3] 部分验证
# 你的选择: 1
# ...
```

### 4.3 查看复盘报告
```bash
# 生成报告
prism retro report --task-id=task-001

# 报告内容包括:
# - 7维度得分
# - 关键发现
# - 改进建议
# - 行动计划
# - Gateway更新建议
```

### 4.4 更新MEMORY库
```bash
# 提交复盘结果
prism retro submit --task-id=task-001

# 系统会自动:
# - 更新模式库
# - 记录新的陷阱
# - 生成SOP建议
# - 优化Gateway规则
```

---

## 第五步: 日常使用（持续）

### 5.1 任务前检查（<1分钟）
```bash
# 快速检查
prism check "你的任务描述"

# 如果通过，直接执行
# 如果警告，查看风险后决定
# 如果阻断，必须先修正
```

### 5.2 任务后复盘（5-10分钟）
```bash
# 小任务: 使用简化版（3维度）
prism retro quick --task-id=task-002

# 大任务: 使用完整版（7维度）
prism retro full --task-id=task-003

# 失败任务: 强制复盘
prism retro mandatory --task-id=task-004
```

### 5.3 查询知识库
```bash
# 搜索成功模式
prism search --type=success "数据驱动"

# 搜索失败模式
prism search --type=failure "过度自信"

# 查看陷阱库
prism traps list

# 查看SOP
prism sop show coding
```

### 5.4 查看统计
```bash
# 查看本月统计
prism stats --month

# 输出:
# - 复盘次数: 15
# - Gateway阻断率: 25%
# - 模式库更新: 3个
# - SOP生成: 2个
```

---

## 常见使用场景

### 场景1: 日常开发任务
```bash
# 1. 任务开始前
prism check "实现用户登录功能"

# 2. 如果通过，开始开发
# ... 开发过程 ...

# 3. 任务完成后
prism retro quick --task-id=login-feature
```

### 场景2: 处理失败案例
```bash
# 1. Gateway发现违规并阻断
# 系统自动触发强制复盘

# 2. 完成深度复盘
prism retro full --task-id=failed-task

# 3. 提取失败模式
# 系统自动更新失败模式库

# 4. 生成避免策略
# 下次类似任务会自动预警
```

### 场景3: 成功案例提炼
```bash
# 1. 完成一个重大项目
prism retro full --task-id=big-project

# 2. 提炼成功要素
# 系统自动生成最佳实践

# 3. 生成SOP
prism sop generate --from-retro=big-project

# 4. 分享给团队
prism share --type=sop --id=big-project-sop
```

### 场景4: 月度复盘
```bash
# 1. 生成月度复盘报告
prism retro monthly --month=2025-01

# 2. 查看能力雷达图
prism radar --month=2025-01

# 3. 对比历史基线
prism benchmark compare --months=3

# 4. 制定改进计划
prism plan generate --from-retro=monthly
```

---

## 进阶使用

### 自定义Gateway规则
```bash
# 编辑规则库
vim memory/level-1-hot/principles.json

# 添加自定义准则
{
  "团队协作": {
    "description": "必须与团队成员充分沟通",
    "check": "function(intent) { return '沟通' in intent || '讨论' in intent; }"
  }
}

# 重启Gateway服务
prism gateway restart
```

### 导入自定义模式
```bash
# 创建模式文件
cat > my_patterns.json << EOF
{
  "success_patterns": [
    {
      "name": "快速原型",
      "description": "先做原型验证，再全面开发",
      "applicable": "开发任务"
    }
  ],
  "failure_patterns": [
    {
      "name": "孤军奋战",
      "description": "不与团队沟通，独自决策",
      "avoidance": "定期与团队同步进展"
    }
  ]
}
EOF

# 导入模式库
prism patterns import my_patterns.json
```

### 自动化集成
```bash
# 在CI/CD中集成Gateway
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# 每次提交前检查
prism check "提交代码: $(git log -1 --pretty=%B)"
if [ $? -ne 0 ]; then
  echo "Gateway检查失败，请修正后再提交"
  exit 1
fi
EOF

chmod +x .git/hooks/pre-commit
```

---

## 故障排查

### 问题1: Gateway检查太慢
```bash
# 检查系统资源
prism health

# 优化性能
prism optimize

# 如果还是慢，调整检查级别
vim ~/.prism/config.yaml
# 设置: check_level: basic  # 快速模式
```

### 问题2: 复盘报告不准确
```bash
# 查看原始数据
prism retro debug --task-id=xxx

# 修正数据
prism retro edit --task-id=xxx

# 重新生成报告
prism retro report --task-id=xxx --force
```

### 问题3: MEMORY库太大
```bash
# 清理旧数据
prism memory cleanup --days=180

# 压缩数据
prism memory compress

# 归档到冷存储
prism memory archive --before=2024-01-01
```

---

## 学习资源

### 官方文档
- 系统设计: `PRISM-Gateway统一系统设计.md`
- 架构图: `PRISM-Gateway架构图与流程图.md`
- 检查清单: `PRISM-Gateway快速检查清单.md`

### 示例代码
- 技术实现: `PRISM-Gateway技术实现示例.py`
- 运行示例: `python PRISM-Gateway技术实现示例.py`

### 视频教程（待制作）
- [ ] 5分钟快速入门
- [ ] Gateway使用指南
- [ ] 复盘技巧分享
- [ ] 高级功能详解

---

## 社区支持

### 获取帮助
```bash
# 查看帮助
prism --help

# 查看命令帮助
prism check --help
prism retro --help

# 查看示例
prism examples
```

### 反馈问题
- GitHub Issues: [项目地址]/issues
- 邮件支持: support@prism-gateway.com
- 讨论社区: [Discord/Slack链接]

---

## 下一步

### Week 1: 熟悉基础
- [ ] 完成初始化
- [ ] 运行第一次Gateway检查
- [ ] 完成第一次复盘
- [ ] 查看复盘报告

### Week 2: 建立习惯
- [ ] 每天任务前使用Gateway检查
- [ ] 每周完成1次复盘
- [ ] 导出1个SOP
- [ ] 更新模式库

### Week 3: 深度使用
- [ ] 自定义Gateway规则
- [ ] 导入自定义模式
- [ ] 生成能力雷达图
- [ ] 制定改进计划

### Week 4: 团队推广
- [ ] 分享给团队成员
- [ ] 建立团队知识库
- [ ] 组织复盘分享会
- [ ] 持续优化流程

---

## 成功案例

### 案例1: 提升代码质量
```
问题: 经常出现低级bug，重复犯错
解决: 使用Gateway检查，阻止已知错误模式
结果: bug率降低60%，代码审查时间减少50%
```

### 案例2: 知识沉淀
```
问题: 成功经验难以复制，新人学习慢
解决: 使用复盘系统，自动生成SOP和最佳实践
结果: 新人上手时间从2周减少到3天
```

### 案例3: 持续改进
```
问题: 不知道哪里需要改进，盲目尝试
解决: 使用能力雷达图，识别能力短板
结果: 3个月内整体能力提升30%
```

---

## 总结

**PRISM-Gateway的核心价值**:
1. **预防错误**: Gateway事前检查，避免重复失败
2. **持续提升**: Retrospective事后复盘，提炼最佳实践
3. **知识积累**: 自动沉淀，形成组织智慧
4. **轻量高效**: <1秒检查，零额外基础设施

**立即开始**:
```bash
# 3步启动
pip install prism-gateway
prism init
prism check "你的第一个任务"
```

**持续进化**:
Gateway会从每次复盘中学习，变得越来越智能！

---

**版本**: v1.0
**更新时间**: 2025-02-03
**作者**: PRISM-Gateway Team
**许可证**: MIT
