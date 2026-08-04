<script setup lang="ts">
import { ref } from 'vue'
import { Plus, Trash2, Upload, X } from 'lucide-vue-next'
import { useWizardStore } from '@/stores/wizard'
import Btn from '@/components/ui/Btn.vue'
import type { McpServer, McpServerRemote, McpServerLocal } from '@opencode/shared'

const wizard = useWizardStore()

// ===== MCP =====
function addMcpLocal() {
  const name = prompt('MCP 名称（小写字母/数字/中划线）')
  if (!name) return
  wizard.form.mcpServers[name] = { type: 'local', command: [''] }
}
function addMcpRemote() {
  const name = prompt('MCP 名称（小写字母/数字/中划线）')
  if (!name) return
  wizard.form.mcpServers[name] = { type: 'remote', url: '' }
}
function removeMcp(name: string) {
  delete wizard.form.mcpServers[name]
}

// local 命令以数组存储，这里给一个字符串输入框简化
function commandText(s: McpServerLocal, v: string) {
  s.command = v.split(' ')
}

// ===== headers / environment 键值对编辑器 =====
// 确保对象存在（Vue 响应式需要先声明）
function ensureHeaders(s: McpServerRemote) {
  if (!s.headers) s.headers = {}
  return s.headers
}
function addHeader(s: McpServerRemote) {
  const h = ensureHeaders(s)
  h['Authorization'] = 'Bearer {env:MCP_TOKEN}'
}
function removeHeader(s: McpServerRemote, key: string) {
  if (s.headers) delete s.headers[key]
}

function ensureEnv(s: McpServerLocal) {
  if (!s.env) s.env = {}
  return s.env
}
function addEnv(s: McpServerLocal) {
  const k = prompt('环境变量名（如 MY_VAR）')
  if (!k) return
  ensureEnv(s)[k] = ''
}
function removeEnv(s: McpServerLocal, key: string) {
  if (s.env) delete s.env[key]
}

// ===== Skills =====
const skillPathInput = ref('')
function addSkillPath() {
  if (skillPathInput.value.trim()) {
    wizard.form.skillPaths.push(skillPathInput.value.trim())
    skillPathInput.value = ''
  }
}

const files = ref<File[]>([])
function onFile(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files) {
    for (const f of Array.from(target.files)) {
      files.value.push(f)
      wizard.form.presetSkills.push({ type: 'upload', value: f.name })
    }
  }
}
function removeFile(i: number) {
  files.value.splice(i, 1)
  wizard.form.presetSkills.splice(i, 1)
}
</script>

<template>
  <!-- MCP -->
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">MCP 服务器</label>
      <div class="flex gap-2">
        <Btn size="sm" variant="ghost" @click="addMcpLocal"><Plus :size="14" /> Local</Btn>
        <Btn size="sm" variant="ghost" @click="addMcpRemote"><Plus :size="14" /> Remote</Btn>
      </div>
    </div>

    <div
      v-for="(s, name) in wizard.form.mcpServers"
      :key="name as string"
      class="rounded-xl p-4 flex flex-col gap-3"
      :style="{ background: 'var(--card)', border: '1px solid var(--border)' }"
    >
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold font-mono" :style="{ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }">{{ name }}</span>
        <div class="flex items-center gap-2">
          <span class="text-xs px-2 py-0.5 rounded-full" :style="{ background: 'var(--muted)', color: 'var(--muted-foreground)' }">{{ s.type }}</span>
          <button class="cursor-pointer p-1" :style="{ color: 'var(--destructive)' }" @click="removeMcp(name as string)"><Trash2 :size="14" /></button>
        </div>
      </div>

      <!-- Local MCP -->
      <template v-if="s.type === 'local'">
        <label class="text-xs" :style="{ color: 'var(--muted-foreground)' }">command</label>
        <input
          :value="s.command.join(' ')"
          placeholder="npx -y @modelcontextprotocol/server-filesystem /data"
          class="w-full"
          :style="{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--input)', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '12px', outline: 'none' }"
          @input="commandText(s as McpServerLocal, ($event.target as HTMLInputElement).value)"
        />

        <!-- 环境变量 -->
        <div class="flex items-center justify-between">
          <label class="text-xs" :style="{ color: 'var(--muted-foreground)' }">环境变量（environment）</label>
          <button
            class="text-xs cursor-pointer flex items-center gap-1"
            :style="{ color: 'var(--primary)' }"
            @click="addEnv(s as McpServerLocal)"
          >
            <Plus :size="12" /> 添加
          </button>
        </div>
        <div v-if="s.env && Object.keys(s.env).length > 0" class="flex flex-col gap-1.5">
          <div
            v-for="(v, k) in s.env"
            :key="k"
            class="flex items-center gap-2"
          >
            <span
              class="text-xs font-mono shrink-0 w-32 truncate"
              :style="{ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }"
            >{{ k }}</span>
            <input
              v-model="(s.env as Record<string,string>)[k as string]"
              class="flex-1"
              :style="{ height: '28px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--input)', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '11px', outline: 'none' }"
            />
            <button
              class="cursor-pointer p-1 shrink-0"
              :style="{ color: 'var(--destructive)' }"
              @click="removeEnv(s as McpServerLocal, k as string)"
            ><X :size="12" /></button>
          </div>
        </div>
      </template>

      <!-- Remote MCP -->
      <template v-else>
        <label class="text-xs" :style="{ color: 'var(--muted-foreground)' }">url</label>
        <input
          v-model="(s as McpServerRemote).url"
          placeholder="https://api.github.com/mcp"
          class="w-full"
          :style="{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--input)', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '12px', outline: 'none' }"
        />

        <!-- Headers（鉴权） -->
        <div class="flex items-center justify-between">
          <label class="text-xs" :style="{ color: 'var(--muted-foreground)' }">Headers（鉴权 / 自定义头）</label>
          <button
            class="text-xs cursor-pointer flex items-center gap-1"
            :style="{ color: 'var(--primary)' }"
            @click="addHeader(s as McpServerRemote)"
          >
            <Plus :size="12" /> 添加
          </button>
        </div>
        <div v-if="s.headers && Object.keys(s.headers).length > 0" class="flex flex-col gap-1.5">
          <div
            v-for="(v, k) in s.headers"
            :key="k"
            class="flex flex-col gap-1"
          >
            <div class="flex items-center gap-2">
              <input
                :value="k as string"
                placeholder="Header 名（如 Authorization）"
                class="flex-1"
                :style="{ height: '28px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--input)', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '11px', outline: 'none' }"
                @change="(e) => {
                  const newKey = (e.target as HTMLInputElement).value
                  const headers = (s as McpServerRemote).headers!
                  const oldVal = headers[k as string]
                  delete headers[k as string]
                  headers[newKey] = oldVal
                }"
              />
              <button
                class="cursor-pointer p-1 shrink-0"
                :style="{ color: 'var(--destructive)' }"
                @click="removeHeader(s as McpServerRemote, k as string)"
              ><X :size="12" /></button>
            </div>
            <input
              v-model="(s.headers as Record<string,string>)[k as string]"
              placeholder="值（如 Bearer {env:MCP_TOKEN}）"
              class="w-full"
              :style="{ height: '28px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--input)', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '11px', outline: 'none' }"
            />
          </div>
        </div>
        <p v-else class="text-[11px]" :style="{ color: 'var(--muted-foreground)' }">
          点击「添加」快速填入 Authorization Bearer（支持 {env:VAR} 占位符）
        </p>
      </template>
    </div>
    <p v-if="Object.keys(wizard.form.mcpServers).length === 0" class="text-xs" :style="{ color: 'var(--muted-foreground)' }">暂未添加 MCP 服务器</p>
  </div>

  <!-- Skills -->
  <div class="flex flex-col gap-3">
    <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">额外 Skill 路径</label>
    <div class="flex gap-2">
      <input
        v-model="skillPathInput"
        placeholder="如 ~/.opencode/skills/my-skill"
        class="flex-1"
        :style="{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--input)', background: 'var(--card)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '12px', outline: 'none' }"
        @keyup.enter="addSkillPath"
      />
      <Btn size="sm" @click="addSkillPath"><Plus :size="14" /> 添加</Btn>
    </div>
    <div v-for="(p, i) in wizard.form.skillPaths" :key="i" class="flex items-center gap-2 text-xs font-mono" :style="{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }">
      <span class="flex-1 truncate">{{ p }}</span>
      <button class="cursor-pointer p-1" :style="{ color: 'var(--destructive)' }" @click="wizard.form.skillPaths.splice(i, 1)"><X :size="12" /></button>
    </div>
  </div>

  <!-- 预置 Skill 上传 -->
  <div class="flex flex-col gap-2">
    <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">预置 Skill（部署时写入 PVC）</label>
    <label
      class="flex items-center justify-center gap-2 rounded-lg border border-dashed cursor-pointer py-6 text-sm"
      :style="{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--card)' }"
    >
      <Upload :size="16" /> 拖拽 zip 到此处，或点击选择
      <input type="file" accept=".zip" multiple class="hidden" @change="onFile" />
    </label>
    <div
      v-for="(f, i) in files"
      :key="i"
      class="flex items-center gap-2 text-xs"
      :style="{ color: 'var(--foreground)' }"
    >
      <span class="flex-1 truncate font-mono" :style="{ fontFamily: 'var(--font-mono)' }">{{ f.name }}</span>
      <span :style="{ color: 'var(--muted-foreground)' }">{{ (f.size / 1024).toFixed(1) }} KB</span>
      <button class="cursor-pointer p-1" :style="{ color: 'var(--destructive)' }" @click="removeFile(i)"><X :size="12" /></button>
    </div>
  </div>
</template>
