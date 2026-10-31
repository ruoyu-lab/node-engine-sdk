import type { NodeWrightRuntimeNodeDefinition } from '@node-wright/core/runtime'
import {
  AI_IMAGE_DISPLAY_NODE_TYPE,
  AI_IMAGE_GENERATE_NODE_TYPE,
  AI_PROMPT_NODE_TYPE,
} from './definitions'

function readParam(node: { data?: unknown }, key: string): unknown {
  const data = node.data
  if (!data || typeof data !== 'object') return undefined
  const params = (data as { params?: unknown }).params
  if (params && typeof params === 'object') {
    const record = params as Record<string, unknown>
    if (key in record) return record[key]
  }
  return (data as Record<string, unknown>)[key]
}

function buildPollinationsUrl(input: {
  prompt: string
  width: number
  height: number
  model: string
  seed: number
}): string {
  const params = new URLSearchParams({
    width: String(input.width),
    height: String(input.height),
  })
  if (input.model && input.model !== 'auto') {
    params.set('model', input.model)
  }
  if (input.seed > 0) {
    params.set('seed', String(input.seed))
  }
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(input.prompt)}?${params.toString()}`
}

export const aiImageRuntimeDefinitions: NodeWrightRuntimeNodeDefinition[] = [
  {
    type: AI_PROMPT_NODE_TYPE,
    handler: ({ node, params }) => {
      const text = String(params.text ?? readParam(node, 'text') ?? '').trim()
      if (!text) {
        throw new Error('提示词不能为空。请在节点参数中填写描述。')
      }
      return {
        values: { prompt: text },
      }
    },
  },
  {
    type: AI_IMAGE_GENERATE_NODE_TYPE,
    cacheable: false,
    handler: async ({ node, values, params, signal }) => {
      const prompt = String(values.prompt ?? '').trim()
      if (!prompt) {
        throw new Error('生成图片节点没有收到提示词输入。')
      }

      const provider = String(params.provider ?? readParam(node, 'provider') ?? 'pollinations')
      const width = Math.max(
        64,
        Math.min(2048, Number(params.width ?? readParam(node, 'width')) || 1024),
      )
      const height = Math.max(
        64,
        Math.min(2048, Number(params.height ?? readParam(node, 'height')) || 1024),
      )
      const model = String(params.model ?? readParam(node, 'model') ?? 'auto')
      const rawSeed = Number(params.seed ?? readParam(node, 'seed'))
      const seed =
        Number.isFinite(rawSeed) && rawSeed > 0 ? rawSeed : Math.floor(Math.random() * 1_000_000)

      if (provider !== 'pollinations') {
        throw new Error(`暂不支持 provider="${provider}"，请选择 "pollinations"。`)
      }

      const url = buildPollinationsUrl({ prompt, width, height, model, seed })

      const response = await fetch(url, { method: 'GET', signal })
      if (!response.ok) {
        const hint =
          response.status === 403 && model !== 'auto'
            ? `\n\n模型 "${model}" 可能需要访问凭据，请将模型改为 "auto" 后重试。`
            : ''
        throw new Error(`生成图片失败：HTTP ${response.status} ${response.statusText}${hint}`)
      }

      return {
        values: { imageUrl: url },
        data: {
          provider,
          model,
          width,
          height,
          seed,
          generatedAt: new Date().toISOString(),
        },
      }
    },
  },
  {
    type: AI_IMAGE_DISPLAY_NODE_TYPE,
    handler: ({ values }) => ({
      data: { imageUrl: values.imageUrl ?? null },
    }),
  },
]
