/**
 * 识别阶段启发式（TC-012）
 * 只做「一段文本像哪种组件」的关键词判断，供 import-docx / import-pdf
 * 的识别管线给块定类型用（给的是语义名，如 work / project）。
 *
 * 本文件不再产出组件：RecognizedBlock → AnyComponent 的映射（别名归一、
 * defaultFields 打底、未知块进 UnknownComponent 保原文）统一走
 * `import-bridge.ts`，那是进文档的唯一映射入口。早先这里的粗映射函数
 * （blockToComponent / mapReportToComponents）与 bridge 语义重复且丢
 * pending 数据，已在收敛任务中删除。
 */

/** 组件类型关键词映射（启发式识别） */
const TYPE_KEYWORDS: Record<string, string[]> = {
  basics: ['姓名', '电话', '邮箱', '地址', '求职', '意向', 'name', 'phone', 'email', 'contact', 'summary', 'profile'],
  education: ['教育', '学校', '大学', '学历', '专业', 'education', 'university', 'college', 'degree', 'gpa'],
  work: ['工作', '实习', '经历', '公司', '职位', 'experience', 'work', 'employment', 'company', 'intern'],
  project: ['项目', '作品', 'project', 'portfolio', 'achievement'],
  skills: ['技能', '能力', '证书', '语言', 'skill', 'certification', 'language'],
}

/** 根据文本内容启发式推断组件类型 */
export function inferComponentType(text: string): string | null {
  const lower = text.toLowerCase()
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return type
  }
  return null
}
