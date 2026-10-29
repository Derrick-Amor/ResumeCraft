/**
 * 文档校验（TC-003）
 * 契约 §2 四入口之一：`validate(input)`。任何模块不得自行 JSON.parse 后直接用。
 *
 * 设计约束：
 *  - **不抛异常**，返回 Result（契约 §11.1）
 *  - **收集全部问题**，不在第一个错误处短路（否则用户要改 N 次才知道有 N 个问题）
 *  - 未知组件不报错，标记 unknown 并原样保留（契约 §2 不变量 2）
 *  - 未知顶层字段进 `extra`，不删（契约 §2 不变量 3）
 */

import {
  ISSUE_CODES,
  LANGUAGE_TRACKS,
  SUPPORTED_SCHEMA_VERSION,
  fail,
  issue,
  ok,
  type AnyComponent,
  type DocumentMeta,
  type LanguageTrack,
  type ModelIssue,
  type Orientation,
  type PageSettings,
  type PaperKind,
  type ResumeComponent,
  type ResumeDocument,
  type Result,
  type UnknownComponent,
} from './types'

const KNOWN_TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'documentId',
  'languageTrack',
  'pageSettings',
  'components',
  'meta',
  // extra 是模型自己的字段。不列进来，validate(validate(x)) 会把它当成新的未知字段，
  // 包成 { extra: {...} }（TC-003 首轮测试就是在这里挂的）
  'extra',
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** 校验 A4 页面设置；收集问题后给出可用值（缺项走 A4 纵向 + 设计稿页边距兜底，与 DEFAULT_PAGE_SETTINGS 一致）。 */
function readPageSettings(
  input: unknown,
  errors: ModelIssue[],
): PageSettings {
  // 兜底与 DEFAULT_PAGE_SETTINGS 必须一致：否则缺项文档会被"修"成另一套边距。
  // 设计稿真值：docs/design/mockups/figma/app.css:552 `.paper { padding: 54px 60px 44px; }`，
  // 794px = 210mm 换算保留 2 位小数（Amor 2026-10-30 的 1:1 裁决）。
  const fallback: PageSettings = {
    paper: 'A4',
    orientation: 'portrait',
    widthMm: 210,
    heightMm: 297,
    marginTopMm: 14.28,
    marginRightMm: 15.87,
    marginBottomMm: 11.64,
    marginLeftMm: 15.87,
  }

  if (!isPlainObject(input)) {
    errors.push(issue('pageSettings', ISSUE_CODES.wrongType, '页面设置必须是对象'))
    return fallback
  }

  const paper = input.paper
  if (paper !== 'A4') {
    errors.push(
      issue('pageSettings.paper', ISSUE_CODES.unexpected, '纸张只支持 A4', paper),
    )
  }

  const orientation = input.orientation
  if (orientation !== 'portrait' && orientation !== 'landscape') {
    errors.push(
      issue(
        'pageSettings.orientation',
        ISSUE_CODES.unexpected,
        '纸张方向必须是 portrait 或 landscape',
        orientation,
      ),
    )
  }

  const result: PageSettings = {
    paper: 'A4' as PaperKind,
    orientation: (orientation === 'landscape' ? 'landscape' : 'portrait') as Orientation,
    widthMm: fallback.widthMm,
    heightMm: fallback.heightMm,
    marginTopMm: fallback.marginTopMm,
    marginRightMm: fallback.marginRightMm,
    marginBottomMm: fallback.marginBottomMm,
    marginLeftMm: fallback.marginLeftMm,
  }

  const sizeKeys = ['widthMm', 'heightMm'] as const
  for (const key of sizeKeys) {
    const value = input[key]
    if (!isFiniteNumber(value)) {
      errors.push(issue(`pageSettings.${key}`, ISSUE_CODES.wrongType, `${key} 必须是数字`, value))
      continue
    }
    if (value <= 0) {
      errors.push(issue(`pageSettings.${key}`, ISSUE_CODES.negative, `${key} 必须大于 0`, value))
      continue
    }
    result[key] = value
  }

  const marginKeys = [
    'marginTopMm',
    'marginRightMm',
    'marginBottomMm',
    'marginLeftMm',
  ] as const
  for (const key of marginKeys) {
    const value = input[key]
    if (!isFiniteNumber(value)) {
      errors.push(issue(`pageSettings.${key}`, ISSUE_CODES.wrongType, `${key} 必须是数字`, value))
      continue
    }
    if (value < 0) {
      errors.push(issue(`pageSettings.${key}`, ISSUE_CODES.negative, `${key} 不能为负`, value))
      continue
    }
    result[key] = value
  }

  return result
}

function readMeta(input: unknown, errors: ModelIssue[], now: string): DocumentMeta {
  const fallback: DocumentMeta = { title: '未命名简历', createdAt: now, updatedAt: now }
  if (!isPlainObject(input)) {
    errors.push(issue('meta', ISSUE_CODES.wrongType, 'meta 必须是对象'))
    return fallback
  }

  const result: DocumentMeta = { ...fallback }

  if (isNonEmptyString(input.title)) {
    result.title = input.title
  } else {
    errors.push(issue('meta.title', ISSUE_CODES.wrongType, '标题必须是非空字符串'))
  }

  for (const key of ['createdAt', 'updatedAt'] as const) {
    const value = input[key]
    if (typeof value === 'string') {
      result[key] = value
    } else {
      errors.push(issue(`meta.${key}`, ISSUE_CODES.wrongType, `${key} 必须是 ISO 字符串`))
    }
  }

  return result
}

/** 未知组件：把必要的定位字段补全进 raw，保证 serialize 往返稳定。 */
function readUnknownComponent(
  input: Record<string, unknown>,
  index: number,
  errors: ModelIssue[],
): UnknownComponent {
  // 两种入参都要认：
  //   ① 来自 JSON 的扁平对象（{...raw}），字段直接在顶层
  //   ② 内存里已经规范化过的 UnknownComponent（字段在 input.raw 里）
  // 只认 ① 的话，validate 对自己的输出就不幂等，会把 raw 再包一层。
  const base = isPlainObject(input.raw) ? input.raw : input
  const raw: Record<string, unknown> = { ...base }

  const rawType = isNonEmptyString(raw.originalType)
    ? raw.originalType
    : isNonEmptyString(raw.type)
      ? raw.type
      : ''
  if (rawType === '') {
    errors.push(
      issue(`components[${index}].type`, ISSUE_CODES.missing, '未知组件必须带 type 或 originalType'),
    )
  }

  const id = isNonEmptyString(raw.id) ? raw.id : `unknown_${index}`
  raw.id = id
  raw.type = isNonEmptyString(raw.type) ? raw.type : rawType
  raw.originalType = rawType
  raw.unknown = true
  if (!isFiniteNumber(raw.order)) raw.order = index
  if (typeof raw.visible !== 'boolean') raw.visible = true

  return {
    id,
    type: raw.type as string,
    order: raw.order as number,
    visible: raw.visible as boolean,
    unknown: true,
    originalType: rawType,
    raw,
  }
}

function readComponent(
  input: unknown,
  index: number,
  errors: ModelIssue[],
): AnyComponent | null {
  const path = `components[${index}]`
  if (!isPlainObject(input)) {
    errors.push(issue(path, ISSUE_CODES.wrongType, '组件必须是对象'))
    return null
  }

  // 显式标记 unknown 的，一律按未知组件保留
  if (input.unknown === true) return readUnknownComponent(input, index, errors)

  if (!isNonEmptyString(input.id)) {
    errors.push(issue(`${path}.id`, ISSUE_CODES.emptyString, '组件 id 必须是非空字符串'))
  }
  if (!isNonEmptyString(input.type)) {
    errors.push(issue(`${path}.type`, ISSUE_CODES.emptyString, '组件 type 必须是非空字符串'))
  }
  if (!isFiniteNumber(input.order)) {
    errors.push(issue(`${path}.order`, ISSUE_CODES.wrongType, 'order 必须是数字'))
  }
  if (typeof input.visible !== 'boolean') {
    errors.push(issue(`${path}.visible`, ISSUE_CODES.wrongType, 'visible 必须是布尔值'))
  }
  if (!isPlainObject(input.fields)) {
    errors.push(issue(`${path}.fields`, ISSUE_CODES.wrongType, 'fields 必须是对象'))
  }
  if (input.style !== undefined && !isPlainObject(input.style)) {
    errors.push(issue(`${path}.style`, ISSUE_CODES.wrongType, 'style 必须是对象'))
  }

  const component: ResumeComponent = {
    id: typeof input.id === 'string' ? input.id : '',
    type: typeof input.type === 'string' ? input.type : '',
    order: isFiniteNumber(input.order) ? input.order : index,
    visible: typeof input.visible === 'boolean' ? input.visible : true,
    fields: isPlainObject(input.fields) ? input.fields : {},
  }
  if (isPlainObject(input.style)) component.style = input.style

  return component
}

/**
 * 校验任意输入，成功时返回**规范化后的文档**（不是原样 cast）。
 * 失败时不返回部分结果——避免调用方拿着半残文档继续跑。
 */
export function validate(input: unknown): Result<ResumeDocument> {
  const errors: ModelIssue[] = []

  if (!isPlainObject(input)) {
    return fail([issue('', ISSUE_CODES.notObject, '文档必须是对象')])
  }

  // ---- schemaVersion ----
  const rawVersion = input.schemaVersion
  if (!isFiniteNumber(rawVersion) || !Number.isInteger(rawVersion)) {
    errors.push(
      issue('schemaVersion', ISSUE_CODES.notInteger, 'schemaVersion 必须是整数', rawVersion),
    )
  } else if (rawVersion > SUPPORTED_SCHEMA_VERSION) {
    errors.push(
      issue(
        'schemaVersion',
        ISSUE_CODES.unsupportedVersion,
        `文档版本 ${rawVersion} 高于本版本支持的 ${SUPPORTED_SCHEMA_VERSION}，请升级后再打开`,
        rawVersion,
      ),
    )
  } else if (rawVersion < 1) {
    errors.push(issue('schemaVersion', ISSUE_CODES.notInteger, 'schemaVersion 必须 ≥ 1', rawVersion))
  }

  // ---- documentId ----
  if (!isNonEmptyString(input.documentId)) {
    errors.push(
      issue('documentId', ISSUE_CODES.emptyString, 'documentId 必须是非空字符串'),
    )
  }

  // ---- languageTrack ----
  const track = input.languageTrack
  if (!LANGUAGE_TRACKS.includes(track as LanguageTrack)) {
    errors.push(
      issue(
        'languageTrack',
        ISSUE_CODES.unexpected,
        'languageTrack 只能是 zh 或 en',
        track,
      ),
    )
  }

  // ---- pageSettings / meta ----
  const now = new Date().toISOString()
  const pageSettings = readPageSettings(input.pageSettings, errors)
  const meta = readMeta(input.meta, errors, now)

  // ---- components ----
  const components: AnyComponent[] = []
  const rawComponents = input.components
  if (!Array.isArray(rawComponents)) {
    errors.push(issue('components', ISSUE_CODES.notArray, 'components 必须是数组'))
  } else {
    rawComponents.forEach((item, index) => {
      const parsed = readComponent(item, index, errors)
      if (parsed) components.push(parsed)
    })
  }

  // ---- 组件 id 唯一 ----
  const seen = new Set<string>()
  for (let i = 0; i < components.length; i += 1) {
    const component = components[i]
    if (!component) continue
    if (seen.has(component.id)) {
      errors.push(
        issue(
          `components[${i}].id`,
          ISSUE_CODES.duplicateId,
          `组件 id 重复：${component.id}`,
          component.id,
        ),
      )
    }
    seen.add(component.id)
  }

  if (errors.length > 0) return fail(errors)

  // ---- 未知顶层字段原样保留 ----
  // 先收模型自带的 extra（已经被规范化过的那份），再收真正未知的顶层键。
  // 这样 validate 对自己的输出幂等：过一次和过两次结果一致。
  const extra: Record<string, unknown> = {}
  if (isPlainObject(input.extra)) {
    for (const [key, value] of Object.entries(input.extra)) extra[key] = value
  }
  for (const [key, value] of Object.entries(input)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) extra[key] = value
  }

  const document: ResumeDocument = {
    schemaVersion: rawVersion as number,
    documentId: input.documentId as string,
    languageTrack: track as LanguageTrack,
    pageSettings,
    components,
    meta,
  }
  if (Object.keys(extra).length > 0) document.extra = extra

  return ok(document)
}

/** 便捷断言：只想知道"能不能用"。 */
export function isValid(input: unknown): boolean {
  return validate(input).ok
}

/** 把问题列表拼成一行，用于日志与测试断言。 */
export function formatIssues(errors: readonly ModelIssue[]): string {
  return errors.map((e) => `${e.path || '<root>'}: ${e.message}`).join('; ')
}
