import {
  existsSync,
  readdirSync,
  statSync,
  readFileSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs'
import { resolve, join, relative, sep } from 'node:path'
import AdmZip from 'adm-zip'
import { env } from '../env.js'
import { parseSkillMd } from '../lib/skill-parser.js'
import type { Skill } from '@opencode/shared'

// 安全解析：确保目标路径在 skills 目录内，防止 ../ 路径穿越
export function safeSkillPath(name: string): string {
  const skillsDir = resolve(env.skillsDir)
  const target = resolve(join(skillsDir, name))
  const rel = relative(skillsDir, target)
  if (rel.startsWith('..') || rel.includes(`..${sep}`)) {
    throw new Error(`非法 skill 名称: ${name}`)
  }
  return target
}

// 校验 skill 名（K8s 友好的目录名）
export function isValidSkillName(name: string): boolean {
  return /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/i.test(name) && name.length <= 63
}

// 列出所有 skill
export function listSkills(): Skill[] {
  if (!existsSync(env.skillsDir)) return []
  const result: Skill[] = []
  for (const name of readdirSync(env.skillsDir)) {
    const dir = join(env.skillsDir, name)
    if (!statSync(dir).isDirectory()) continue
    const skill = readSkillMeta(name)
    result.push(skill)
  }
  return result
}

// 读取单个 skill 元信息
export function readSkillMeta(name: string): Skill {
  const dir = safeSkillPath(name)
  const skillMdPath = join(dir, 'SKILL.md')
  let meta = { name, description: '', version: undefined as string | undefined }
  if (existsSync(skillMdPath)) {
    meta = { ...meta, ...parseSkillMd(readFileSync(skillMdPath, 'utf8')) }
  }
  return {
    name: meta.name || name,
    description: meta.description,
    version: meta.version,
    size: dirSize(dir),
    status: 'running',
    updatedAt: statSync(dir).mtime.toISOString(),
  }
}

// 递归计算目录大小（字节）
function dirSize(dir: string): number {
  let total = 0
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    total += st.isDirectory() ? dirSize(p) : st.size
  }
  return total
}

// 获取 skill 详情（含 SKILL.md 原文）
export function getSkillDetail(name: string): { meta: Skill; content: string } | null {
  const dir = safeSkillPath(name)
  if (!existsSync(dir)) return null
  const skillMdPath = join(dir, 'SKILL.md')
  const content = existsSync(skillMdPath) ? readFileSync(skillMdPath, 'utf8') : ''
  return { meta: readSkillMeta(name), content }
}

// 解压上传的 zip 到 skills/<name>/
// 自动剥离 zip 内的公共顶层目录（如 my-skill/）；校验：解压后必须含 SKILL.md
export function uploadSkillZip(name: string, zipBuffer: Buffer): { files: string[]; size: number } {
  if (!isValidSkillName(name)) {
    throw new Error(`skill 名称不合法（仅允许小写字母/数字/中划线，≤63 字符）`)
  }
  const target = safeSkillPath(name)

  const zip = new AdmZip(zipBuffer)
  const fileEntries = zip.getEntries().filter((e) => !e.isDirectory)
  if (fileEntries.length === 0) {
    throw new Error('zip 包为空')
  }

  // 推断公共顶层目录：若所有文件都以同一个 "xxx/" 开头，则剥离
  const firstSegs = fileEntries.map((e) => e.entryName.split('/')[0])
  const allSameTopDir =
    firstSegs.every((s) => s === firstSegs[0]) &&
    fileEntries.every((e) => e.entryName.includes('/'))
  const stripPrefix = allSameTopDir ? `${firstSegs[0]}/` : ''

  // 计算解压后的相对路径，并校验 SKILL.md 存在
  const relPaths = fileEntries.map((e) =>
    stripPrefix && e.entryName.startsWith(stripPrefix)
      ? e.entryName.slice(stripPrefix.length)
      : e.entryName,
  )
  const hasSkillMd = relPaths.includes('SKILL.md')
  if (!hasSkillMd) {
    throw new Error('zip 包内必须包含 SKILL.md（根目录或顶层目录下）')
  }

  // 清空旧目录（覆盖安装）
  if (existsSync(target)) rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })

  const files: string[] = []
  for (const entry of fileEntries) {
    const relPath = stripPrefix && entry.entryName.startsWith(stripPrefix)
      ? entry.entryName.slice(stripPrefix.length)
      : entry.entryName
    const dest = resolve(join(target, relPath))
    const rel = relative(target, dest)
    if (rel.startsWith('..') || rel.includes(`..${sep}`)) {
      throw new Error(`zip 内含非法路径: ${entry.entryName}`)
    }
    mkdirSync(join(dest, '..'), { recursive: true })
    writeFileSync(dest, entry.getData())
    files.push(relPath)
  }

  return { files, size: dirSize(target) }
}

// 删除 skill 目录
export function deleteSkill(name: string): boolean {
  const target = safeSkillPath(name)
  if (!existsSync(target)) return false
  rmSync(target, { recursive: true, force: true })
  return true
}

// 打包 skill 目录为 zip（Buffer）
export function packSkillZip(name: string): Buffer {
  const dir = safeSkillPath(name)
  if (!existsSync(dir)) throw new Error(`skill 不存在: ${name}`)
  const zip = new AdmZip()
  zip.addLocalFolder(dir)
  return zip.toBuffer()
}
