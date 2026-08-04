<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { FolderOpened, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'

const router = useRouter()
const authStore = useAuthStore()
const store = useProjectStore()
const showAddDialog = ref(false)
const saving = ref(false)
const form = reactive({ name: '', description: '', member_ids: [] as number[] })

const selectableUsers = computed(() =>
  authStore.users.filter((user) => user.id !== authStore.user?.id),
)

async function openCreateDialog() {
  await authStore.fetchUsers()
  showAddDialog.value = true
}

async function handleAddProject() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入项目名称')
    return
  }
  saving.value = true
  try {
    const project = await store.createProject({ ...form })
    ElMessage.success('项目空间已创建')
    showAddDialog.value = false
    Object.assign(form, { name: '', description: '', member_ids: [] })
    router.push(`/projects/${project.id}`)
  } finally {
    saving.value = false
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN')
}

onMounted(store.fetchList)
</script>

<template>
  <div class="projects-page" v-loading="store.loading">
    <div class="page-heading">
      <div>
        <h1>项目空间</h1>
        <p>项目成员、代码仓库和需求的逻辑工作空间</p>
      </div>
      <el-button v-if="authStore.canManageProjects" type="primary" :icon="Plus" @click="openCreateDialog">
        新建项目
      </el-button>
    </div>

    <div v-if="store.projects.length" class="project-grid">
      <article
        v-for="project in store.projects"
        :key="project.id"
        class="project-item"
        tabindex="0"
        @click="router.push(`/projects/${project.id}`)"
        @keyup.enter="router.push(`/projects/${project.id}`)"
      >
        <div class="project-title-row">
        <el-icon><FolderOpened /></el-icon>
          <h2>{{ project.name }}</h2>
          <el-tag size="small" :type="project.status === 'active' ? 'success' : 'info'">
            {{ project.status === 'active' ? '活跃' : '已归档' }}
          </el-tag>
        </div>
        <p>{{ project.description || '暂无项目描述' }}</p>
        <div class="project-meta">
          <span>{{ project.repository_count }} 个仓库</span>
          <span>{{ project.requirement_count }} 个需求</span>
          <span>{{ formatDate(project.created_at) }}</span>
        </div>
      </article>
    </div>
    <el-empty v-else-if="!store.loading" description="暂无项目空间" />

    <el-dialog v-model="showAddDialog" title="新建项目空间" width="520px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="项目名称" required>
          <el-input v-model="form.name" maxlength="160" placeholder="例如：交易风控平台" />
        </el-form-item>
        <el-form-item label="项目描述">
          <el-input v-model="form.description" type="textarea" :rows="4" maxlength="5000" />
        </el-form-item>
        <el-form-item label="项目成员">
          <el-select v-model="form.member_ids" multiple filterable style="width: 100%" placeholder="选择开发、测试或其他成员">
            <el-option
              v-for="user in selectableUsers"
              :key="user.id"
              :label="`${user.username} (${user.roles.join(', ')})`"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleAddProject">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.projects-page { max-width: 1440px; margin: 0 auto; }
.page-heading { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 22px; }
.page-heading h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
.page-heading p { margin: 7px 0 0; color: #6b7280; font-size: 13px; }
.project-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.project-item { min-height: 164px; padding: 19px; background: #fff; border: 1px solid #dde2e8; border-radius: 6px; cursor: pointer; outline: none; display: flex; flex-direction: column; }
.project-item:hover, .project-item:focus { border-color: #df5559; box-shadow: 0 2px 10px rgb(210 10 16 / 8%); }
.project-title-row { display: grid; grid-template-columns: 24px 1fr auto; align-items: center; gap: 9px; }
.project-title-row .el-icon { color: #d20a10; font-size: 19px; }
.project-title-row h2 { margin: 0; font-size: 16px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0; }
.project-item > p { margin: 17px 0; color: #606a78; font-size: 13px; line-height: 1.65; flex: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.project-meta { display: flex; gap: 16px; color: #87909d; font-size: 12px; }
@media (max-width: 1000px) { .project-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .project-grid { grid-template-columns: 1fr; } .page-heading { align-items: flex-start; gap: 16px; } }
</style>
