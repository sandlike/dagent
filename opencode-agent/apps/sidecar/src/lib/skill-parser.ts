import matter from 'gray-matter'

export interface SkillMeta {
  name: string
  description: string
  version?: string
}

// 解析 SKILL.md frontmatter，提取 name/description/version
export function parseSkillMd(content: string): SkillMeta {
  try {
    const { data, content: body } = matter(content)
    const firstLine = body.trim().split('\n')[0]?.replace(/^#+\s*/, '') ?? ''
    return {
      name: data.name ?? '',
      description: data.description ?? firstLine,
      version: data.version,
    }
  } catch {
    // frontmatter 解析失败，退化处理
    const firstLine = content.trim().split('\n')[0]?.replace(/^#+\s*/, '') ?? ''
    return { name: '', description: firstLine, version: undefined }
  }
}
