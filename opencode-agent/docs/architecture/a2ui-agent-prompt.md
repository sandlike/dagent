# A2UI Agent 输出提示词

> 本文件定义 Agent（如 opencode）输出 A2UI 结构化 UI 的提示词规范。
> 将此提示词配置到 opencode 的 Skill 或 system prompt 中，Agent 即可输出 A2UI JSON。

## 使用方式

### 方式一：作为 Skill 配置

在 opencode 的 `opencode.json` 中添加一个 A2UI 输出 skill：

```jsonc
{
  "skills": {
    "paths": ["~/.config/opencode/skills/a2ui-output"]
  }
}
```

然后在 PVC 的 skills 目录创建 `a2ui-output/SKILL.md`，内容如下方的提示词。

### 方式二：作为 system prompt 注入

在 `opencode.json` 的 agent 配置中注入：

```jsonc
{
  "agent": {
    "build": {
      "instructions": ["docs/a2ui-instructions.md"]
    }
  }
}
```

---

## A2UI 输出提示词（SKILL.md 内容）

```markdown
---
name: a2ui-output
description: 输出结构化 UI（A2UI 协议），让回复不只是纯文本，而是卡片、列表、表单等可交互界面
license: MIT
compatibility: opencode
---

## What I do

把回复内容用 A2UI 协议的 JSON 格式输出，让前端渲染为丰富的可交互界面（卡片、列表、表格、表单等），而不只是纯文本。

## When to use me

当回复包含以下内容时，使用 A2UI 格式：
- 结构化数据（表格、列表、对比）
- 需要用户交互的表单或选择
- 卡片式信息展示（如天气、搜索结果）
- 图表或数据可视化
- 多步骤任务进度

纯文本对话（如简单问答）不需要用 A2UI。

## How to output A2UI

在回复中输出以下格式的 JSON 代码块（用 ```a2ui-json 标记）：

### 示例 1：信息卡片

\`\`\`a2ui-json
{
  "type": "a2ui",
  "surfaceId": "card-1",
  "data": {
    "type": "container",
    "children": [
      {
        "type": "text",
        "content": "🌤️ 北京天气",
        "style": { "fontSize": "20px", "fontWeight": "bold" }
      },
      {
        "type": "row",
        "children": [
          { "type": "text", "content": "温度：23°C" },
          { "type": "text", "content": "湿度：45%" },
          { "type": "text", "content": "风力：3级" }
        ]
      },
      {
        "type": "text",
        "content": "今天适合出门！",
        "style": { "color": "#22c55e" }
      }
    ]
  }
}
\`\`\`

### 示例 2：数据表格

\`\`\`a2ui-json
{
  "type": "a2ui",
  "surfaceId": "table-1",
  "data": {
    "type": "table",
    "columns": ["名称", "状态", "CPU", "内存"],
    "rows": [
      ["demo", "运行中", "120m", "256Mi"],
      ["test", "已停止", "0", "0"]
    ]
  }
}
\`\`\`

### 示例 3：操作按钮

\`\`\`a2ui-json
{
  "type": "a2ui",
  "surfaceId": "actions-1",
  "data": {
    "type": "row",
    "children": [
      {
        "type": "button",
        "label": "确认部署",
        "action": { "type": "submit", "value": "deploy" },
        "style": { "background": "#2563eb", "color": "#ffffff" }
      },
      {
        "type": "button",
        "label": "取消",
        "action": { "type": "cancel" }
      }
    ]
  }
}
\`\`\`

### 示例 4：进度条 + 步骤

\`\`\`a2ui-json
{
  "type": "a2ui",
  "surfaceId": "progress-1",
  "data": {
    "type": "container",
    "children": [
      { "type": "text", "content": "部署进度", "style": { "fontWeight": "bold" } },
      {
        "type": "progress",
        "value": 60,
        "max": 100,
        "label": "3/5 步骤完成"
      },
      {
        "type": "list",
        "items": [
          { "text": "✅ 创建 ConfigMap" },
          { "text": "✅ 创建 Secret" },
          { "text": "✅ 创建 PVC" },
          { "text": "⏳ 创建 Deployment" },
          { "text": "⏸ 等待 Pod 就绪" }
        ]
      }
    ]
  }
}
\`\`\`

## 支持的组件类型

| 类型 | 说明 | 关键属性 |
|------|------|---------|
| `container` | 容器（纵向排列子组件） | `children: []` |
| `row` | 行容器（横向排列） | `children: []` |
| `text` | 文本 | `content`, `style` |
| `button` | 按钮 | `label`, `action`, `style` |
| `table` | 表格 | `columns: []`, `rows: [[]]` |
| `list` | 列表 | `items: [{text}]` |
| `progress` | 进度条 | `value`, `max`, `label` |
| `input` | 输入框 | `label`, `placeholder`, `name` |
| `divider` | 分隔线 | — |
| `image` | 图片 | `src`, `alt` |

## 规则

1. **混合输出**：可以先输出一段纯文本说明，再输出 A2UI JSON 代码块
2. **唯一 surfaceId**：每次输出 A2UI 时用唯一的 surfaceId（如 `card-<时间戳>`）
3. **简洁**：JSON 尽量精简，不要嵌套太深
4. **容错**：JSON 必须是合法的（前端会 JSON.parse，格式错误会忽略）
5. **代码块标记**：必须用 ` ```a2ui-json ` 标记代码块（不是 ` ```json `）
```

---

## 注意事项

1. **不是所有回复都需要 A2UI**——简单问答用纯文本就好，复杂结构化信息才用 A2UI
2. **Agent 需要理解 A2UI 组件库**——提示词里列出了支持的组件类型和属性
3. **前端容错**——如果 JSON 解析失败，会静默忽略，不会影响正常文本对话
4. **可扩展**——a2ui-vue 支持自定义组件 Catalog，后续可添加 OMA 专属组件
