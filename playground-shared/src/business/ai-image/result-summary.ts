import type { GraphNode } from '@node-wright/core/protocol'

export type AiImageResultState = 'empty' | 'ready' | 'invalid'

export interface AiImageResultSummary {
  state: AiImageResultState
  label: string
}

/**
 * Summary badge of an image display node: waiting for a run, or the size and seed encoded in the
 * generated image URL.
 */
export function summarizeAiImageResult(node: GraphNode): AiImageResultSummary {
  const params = node.data?.params
  const imageUrl =
    params && typeof params === 'object' && !Array.isArray(params) ? params.imageUrl : undefined

  if (typeof imageUrl !== 'string' || !imageUrl) {
    return { state: 'empty', label: '等待运行' }
  }

  if (!URL.canParse(imageUrl)) {
    return { state: 'invalid', label: '图片地址无效' }
  }

  const query = new URL(imageUrl).searchParams
  const width = query.get('width')
  const height = query.get('height')
  const seed = query.get('seed')
  const size = width && height ? `${width} × ${height}` : '已生成'

  return { state: 'ready', label: seed ? `${size} · 种子 ${seed}` : size }
}
