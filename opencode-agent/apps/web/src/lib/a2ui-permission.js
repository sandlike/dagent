// 把 opencode permission 请求转成 A2UI v0.9 消息
// 用于在 ChatView 里用 a2ui-vue 渲染审批卡片
//
// === A2UI v0.9 正确格式（来自 shawnwang15/a2ui-vue 官方文档/samples）===
// 组件结构（扁平，adjacency list）：
//   { id: 'root', component: 'Card', child: 'content' }
//   ↑ component 是字符串类型名；属性（child/children/text/action）直接平铺
// Text: { component: 'Text', text: '你好' }   ← text 直接字符串，不是 {literalString}
// Button: { component: 'Button', child: '<textId>', action: { event: { name, context } } }
//   ↑ action 包在 event 里！context 是 { key: {path} | 字面值 }
// Row/Column: { component: 'Column', children: ['id1','id2'] }  ← 直接 id 数组
// Card: { component: 'Card', child: '<id>' }
// catalogId 用 'default'；root 必须叫 'root'；无需 beginRendering
// 构造一组 A2UI v0.9 消息（createSurface + updateComponents）
export function buildPermissionA2UIMessages(perm) {
    const sid = `perm-${perm.permissionId}`;
    const inputText = typeof perm.input === 'string'
        ? perm.input
        : perm.input
            ? JSON.stringify(perm.input, null, 2)
            : '(无详情)';
    return {
        surfaceId: sid,
        messages: [
            {
                version: 'v0.9',
                createSurface: { surfaceId: sid, catalogId: 'default' },
            },
            {
                version: 'v0.9',
                updateComponents: {
                    surfaceId: sid,
                    components: [
                        // root: Card
                        { id: 'root', component: 'Card', child: 'content' },
                        // content: Column（标题 + 工具行 + 命令行 + 按钮行）
                        { id: 'content', component: 'Column', children: ['title', 'tool_line', 'cmd_line', 'buttons'] },
                        // title
                        { id: 'title', component: 'Text', text: '权限确认', variant: 'h4' },
                        // tool_line
                        { id: 'tool_line', component: 'Text', text: `工具：${perm.tool}` },
                        // cmd_line
                        { id: 'cmd_line', component: 'Text', text: `操作：${inputText}` },
                        // buttons: Row
                        { id: 'buttons', component: 'Row', align: 'end', children: ['btn_deny', 'btn_allow'] },
                        // btn_deny
                        {
                            id: 'btn_deny',
                            component: 'Button',
                            child: 'btn_deny_text',
                            action: {
                                event: {
                                    name: 'deny',
                                    context: {
                                        permissionId: perm.permissionId,
                                        sessionId: perm.sessionId,
                                    },
                                },
                            },
                        },
                        { id: 'btn_deny_text', component: 'Text', text: '拒绝' },
                        // btn_allow
                        {
                            id: 'btn_allow',
                            component: 'Button',
                            child: 'btn_allow_text',
                            action: {
                                event: {
                                    name: 'allow',
                                    context: {
                                        permissionId: perm.permissionId,
                                        sessionId: perm.sessionId,
                                    },
                                },
                            },
                        },
                        { id: 'btn_allow_text', component: 'Text', text: '允许' },
                    ],
                },
            },
        ],
    };
}
// 删除 surface 的消息
export function buildDeleteSurfaceMessage(surfaceId) {
    return { version: 'v0.9', deleteSurface: { surfaceId } };
}
