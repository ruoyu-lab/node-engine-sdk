import type { SemanticNodeDefinition } from '@node-engine-sdk/core/semantics'

export const AI_PROMPT_NODE_TYPE = 'ai:prompt'
export const AI_IMAGE_GENERATE_NODE_TYPE = 'ai:image-generate'
export const AI_IMAGE_DISPLAY_NODE_TYPE = 'ai:image-display'

export const aiImageNodeDefinitions: SemanticNodeDefinition[] = [
  {
    type: AI_PROMPT_NODE_TYPE,
    label: '提示词',
    category: 'AI 图片生成',
    description: '输入用于生成图片的自然语言描述。',
    width: 320,
    height: 220,
    ports: [
      {
        id: 'prompt',
        label: '提示词',
        direction: 'output',
        kind: 'data',
        dataType: 'string',
        capacity: 'many',
      },
    ],
    dataDefaults: {
      params: {
        text: 'a serene mountain lake at sunrise, photorealistic, cinematic lighting',
      },
    },
    parameters: [
      {
        key: 'text',
        kind: 'string',
        label: '内容',
        defaultValue: 'a serene mountain lake at sunrise, photorealistic, cinematic lighting',
        ui: {
          placeholder: '例如：a serene mountain lake at sunrise',
        },
      },
    ],
    capabilities: ['pure'],
    tags: ['ai', 'prompt', 'business'],
  },
  {
    type: AI_IMAGE_GENERATE_NODE_TYPE,
    label: '生成图片',
    category: 'AI 图片生成',
    description: '调用 AI 图片生成服务，根据提示词生成图片 URL。',
    width: 304,
    height: 256,
    ports: [
      {
        id: 'prompt',
        label: '提示词',
        direction: 'input',
        kind: 'data',
        dataType: 'string',
        accepts: ['string'],
        capacity: 1,
        required: true,
      },
      {
        id: 'imageUrl',
        label: '图片 URL',
        direction: 'output',
        kind: 'data',
        dataType: 'string',
        capacity: 'many',
      },
    ],
    dataDefaults: {
      params: {
        provider: 'pollinations',
        model: 'auto',
        width: 1024,
        height: 1024,
        seed: 0,
      },
    },
    parameters: [
      {
        key: 'model',
        kind: 'select',
        label: '模型',
        defaultValue: 'auto',
        options: [
          { label: '默认（免费）', value: 'auto' },
          { label: 'Turbo（需 token）', value: 'turbo' },
          { label: 'Flux（需 token）', value: 'flux' },
        ],
      },
      {
        key: 'width',
        kind: 'number',
        label: '宽',
        defaultValue: 1024,
      },
      {
        key: 'height',
        kind: 'number',
        label: '高',
        defaultValue: 1024,
      },
      {
        key: 'seed',
        kind: 'number',
        label: '种子 (0=随机)',
        defaultValue: 0,
        input: { portId: 'seed' },
      },
    ],
    capabilities: ['effect', 'async'],
    tags: ['ai', 'image', 'business'],
  },
  {
    type: AI_IMAGE_DISPLAY_NODE_TYPE,
    label: '图片预览',
    category: 'AI 图片生成',
    description: '显示生成的图片，并允许下载到本地。',
    width: 360,
    height: 384,
    ports: [
      {
        id: 'imageUrl',
        label: '输入',
        direction: 'input',
        kind: 'data',
        dataType: 'string',
        accepts: ['string'],
        capacity: 1,
        required: true,
      },
    ],
    capabilities: ['effect'],
    parameters: [
      {
        key: 'imageUrl',
        kind: 'file',
        label: '结果图片',
      },
    ],
    tags: ['ai', 'image', 'business'],
  },
]
