import { Hono } from 'hono'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db, schema } from '../db/client.js'
import { errorResponse } from '../lib/http.js'
import { AppBindings } from '../lib/types.js'
import type { JwtPayload } from '../lib/jwt.js'

const skills = new Hono<AppBindings>()

const createSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, '名称需小写字母/数字/中划线'),
  description: z.string().max(512).default(''),
  content: z.string(), // SKILL.md 内容
  files: z.array(z.object({
    filename: z.string(),
    content: z.string(),
  })).optional(),
})

// 创建 Skill 模板
skills.post('/', async (c) => {
  const user = c.get('user') as JwtPayload
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return errorResponse(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误')
  }
  const { name, description, content, files } = parsed.data

  // SKILL.md 内容必须有 frontmatter
  const skillContent = content.startsWith('---')
    ? content
    : `---\nname: ${name}\ndescription: ${description || 'No description'}\n---\n\n${content}`

  const [row] = await db.insert(schema.skillTemplates).values({
    name,
    description,
    content: skillContent,
    files: files ? JSON.stringify(files) : null,
    ownerId: user.sub,
    source: 'custom',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  let id = row.insertId
  if (!id || id === 0) {
    const [fb] = await db.select().from(schema.skillTemplates)
      .where(and(eq(schema.skillTemplates.name, name), eq(schema.skillTemplates.ownerId, user.sub)))
      .orderBy(schema.skillTemplates.id).limit(1)
    id = fb?.id
  }
  const [inst] = id
    ? await db.select().from(schema.skillTemplates).where(eq(schema.skillTemplates.id, id)).limit(1)
    : []
  return c.json({ skill: inst ? toSkill(inst) : { name } }, 201)
})

// 列表
skills.get('/', async (c) => {
  const user = c.get('user') as JwtPayload
  const rows = await db.select().from(schema.skillTemplates)
    .where(and(eq(schema.skillTemplates.ownerId, user.sub), eq(schema.skillTemplates.status, 'active')))
    .orderBy(schema.skillTemplates.id)
  return c.json(rows.map((r) => toSkill(r)))
})

// 详情
skills.get('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = Number(c.req.param('id'))
  const [row] = await db.select().from(schema.skillTemplates)
    .where(and(eq(schema.skillTemplates.id, id), eq(schema.skillTemplates.ownerId, user.sub)))
    .limit(1)
  if (!row) return errorResponse(c, 'NOT_FOUND', 'Skill 不存在', 404)
  return c.json(toSkill(row, true))
})

// 删除
skills.delete('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = Number(c.req.param('id'))
  await db.update(schema.skillTemplates)
    .set({ status: 'deleted', updatedAt: new Date() })
    .where(and(eq(schema.skillTemplates.id, id), eq(schema.skillTemplates.ownerId, user.sub)))
  return c.json({ ok: true })
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSkill(row: any, includeContent = false) {
  const result: Record<string, unknown> = {
    id: row.id,
    name: row.name,
    description: row.description,
    source: row.source,
    status: row.status,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  }
  if (includeContent) {
    result.content = row.content
    result.files = row.files ? JSON.parse(row.files) : []
  }
  return result
}

export default skills
