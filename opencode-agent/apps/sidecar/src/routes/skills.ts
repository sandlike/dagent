import { Hono } from 'hono'
import { logAudit } from '../lib/audit-log.js'
import {
  listSkills,
  getSkillDetail,
  uploadSkillZip,
  deleteSkill,
  packSkillZip,
  isValidSkillName,
} from '../services/skill-files.js'
import { errorResponse } from '../lib/http.js'

const skills = new Hono()

// 列表
skills.get('/', (c) => c.json(listSkills()))

// 详情
skills.get('/:name', (c) => {
  const name = c.req.param('name')
  const detail = getSkillDetail(name)
  if (!detail) return errorResponse(c, 'NOT_FOUND', `skill 不存在: ${name}`, 404)
  return c.json(detail)
})

// 下载（打包为 zip）
skills.get('/:name/download', (c) => {
  const name = c.req.param('name')
  try {
    const buf = packSkillZip(name)
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${name}.zip"`,
      },
    })
  } catch {
    return errorResponse(c, 'NOT_FOUND', `skill 不存在: ${name}`, 404)
  }
})

// 上传（multipart: name + file）
skills.post('/', async (c) => {
  const form = await c.req.formData()
  const name = String(form.get('name') ?? '')
  const file = form.get('file')
  if (!name) return errorResponse(c, 'INVALID_INPUT', '缺少 name 字段')
  if (!isValidSkillName(name)) {
    return errorResponse(c, 'INVALID_INPUT', 'skill 名称不合法')
  }
  if (!(file instanceof File)) {
    return errorResponse(c, 'INVALID_INPUT', '缺少 file 字段')
  }
  const buf = Buffer.from(await file.arrayBuffer())
  try {
    const { files, size } = uploadSkillZip(name, buf)
    logAudit('skill.upload', { name, files: files.length, size }, true)
    return c.json({ ok: true, name, files, size }, 201)
  } catch (e) {
    logAudit('skill.upload', { name }, false)
    return errorResponse(c, 'UPLOAD_FAILED', (e as Error).message)
  }
})

// 删除
skills.delete('/:name', (c) => {
  const name = c.req.param('name')
  try {
    const removed = deleteSkill(name)
    if (!removed) return errorResponse(c, 'NOT_FOUND', `skill 不存在: ${name}`, 404)
    logAudit('skill.delete', { name }, true)
    return c.json({ ok: true })
  } catch (e) {
    logAudit('skill.delete', { name }, false)
    return errorResponse(c, 'DELETE_FAILED', (e as Error).message)
  }
})

export default skills
