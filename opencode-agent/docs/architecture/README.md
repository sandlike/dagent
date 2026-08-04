# OMA 架构文档目录

本目录存放 OMA（Oh-My-Agent）平台的架构设计文档。

## 文档索引

| 文档 | 说明 |
|------|------|
| [总体架构](./overview.md) | OMA 平台的定位、组件关系、数据流 |
| [分阶段路线图](./roadmap.md) | Phase 0-5 的演进计划 |
| [配置流向](./config-flow.md) | LLM/MCP/Skill 配置从用户到 opencode 的流转路径 |
| [A2A + A2UI 协议](./a2a-a2ui-protocol.md) | 标准对话协议（A2A）+ 生成式 UI 协议（A2UI）集成 |
| [A2UI Agent 提示词](./a2ui-agent-prompt.md) | Agent 输出 A2UI 结构化 UI 的提示词规范（SKILL.md） |
| [开发经验与踩坑记录](./development-notes.md) | opencode API/A2UI v0.9/版本管理/部署等实测经验（必读） |
| [测试方案](./test-plan.md) | 10 个端到端测试步骤（浏览器 + curl 验证） |
| [公司级记忆库设计](./memory-store.md) | Mem0 + memory-gateway 方案：ID 强制注入、per-user/per-agent 隔离、跨 agent 授权 |

## 相关文档

- [开发文档](../development/) — 开发规范、环境配置
- [AGENTS.md](../../AGENTS.md) — 项目交接与环境信息
- [PRD.md](../../PRD.md) — 产品需求文档
