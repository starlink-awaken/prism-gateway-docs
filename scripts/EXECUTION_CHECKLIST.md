# ReflectGuard 重构执行清单

> 执行此清单前，请确保已阅读 `refactor-plan.md`

## 执行前准备

- [ ] 确认当前在 `prism-gateway-docs/` 目录
- [ ] 确认 `prism-gateway/` 子目录存在
- [ ] 确认有足够的磁盘空间（至少 2GB）
- [ ] 确认 bun、tsc、jq 已安装（可选）
- [ ] 通知团队成员即将进行重构

---

## 阶段 0: 准备和备份

```bash
bash scripts/00-prepare.sh
```

验证点:
- [ ] 备份目录已创建
- [ ] `test-before.log` 已生成
- [ ] `files-before.txt` 已生成
- [ ] 配置文件已备份

---

## 阶段 1: 配置文件整合

```bash
bash scripts/01-integrate-configs.sh
```

验证点:
- [ ] `config/tsconfig.json` 已创建
- [ ] `config/typedoc.json` 已创建
- [ ] `.prism/config/hooks.json` 已创建
- [ ] `tsconfig.json` 引用 `config/tsconfig.json`
- [ ] `package.json` 脚本已更新

---

## 阶段 2: 报告文件迁移

```bash
bash scripts/02-move-reports.sh
```

验证点:
- [ ] `reports/` 目录已创建
- [ ] 所有报告文件已复制到 `reports/`
- [ ] `reports/README.md` 已创建
- [ ] `REPORTS.md` 索引已创建

---

## 阶段 3: 数据目录重组

```bash
bash scripts/03-organize-data.sh
```

验证点:
- [ ] `.prism/` 目录结构已创建
- [ ] 现有数据已迁移到 `.prism/level-*`
- [ ] `.prism/README.md` 已创建
- [ ] `.prism/state/current.json` 已创建

---

## 阶段 4: 文档目录整合

```bash
bash scripts/04-integrate-docs.sh
```

验证点:
- [ ] `docs/guides/` 目录已创建
- [ ] `docs/reference/` 目录已创建
- [ ] 用户指南已复制到 `guides/`
- [ ] 参考文档已复制到 `reference/`
- [ ] `docs/README.md` 已创建
- [ ] 冗余 API 目录已标记废弃

---

## 阶段 5: Import 路径更新

```bash
bash scripts/05-update-imports.sh
```

验证点:
- [ ] Import 路径分析已完成
- [ ] `config/tsconfig.paths.json` 已创建
- [ ] TypeScript 编译检查通过

---

## 阶段 6: 验证和测试

```bash
bash scripts/06-verify.sh
```

验证点:
- [ ] 所有配置文件验证通过
- [ ] TypeScript 编译无错误
- [ ] 测试套件全部通过
- [ ] 文件完整性检查通过
- [ ] `REFACTOR_VERIFICATION.md` 已生成

---

## 阶段 7: 清理（可选）

```bash
bash scripts/07-cleanup.sh
```

验证点:
- [ ] 根目录报告文件已删除
- [ ] 冗余 API 目录已删除
- [ ] 旧配置文件已删除
- [ ] 临时文件已清理

---

## 执行后验证

- [ ] 运行 `bun test` 确认所有测试通过
- [ ] 运行 `tsc --noEmit` 确认无类型错误
- [ ] 检查 `REFACTOR_VERIFICATION.md` 报告
- [ ] 验证新目录结构可访问
- [ ] 通知团队成员重构完成

---

## 回滚步骤（如需要）

```bash
bash scripts/rollback.sh
```

---

## 完成标志

当所有上述验证点都通过后，重构即完成。新的目录结构已生效。

**预计总时间:** 65 分钟
**风险等级:** 低
**可回滚:** 是
