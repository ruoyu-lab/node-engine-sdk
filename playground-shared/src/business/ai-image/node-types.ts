import type { NodeTypeRegistry } from '@node-engine-sdk/core/view'
import {
  AI_IMAGE_DISPLAY_NODE_TYPE,
  AI_IMAGE_GENERATE_NODE_TYPE,
  AI_PROMPT_NODE_TYPE,
} from './definitions'

/**
 * Key of the image display DOM component. Each playground app registers its own framework
 * component under this key through `domComponents`.
 */
export const AI_IMAGE_DISPLAY_DOM_COMPONENT = 'ai-image.display'

/** Accent of the AI image nodes, next to the preset families' `PRESET_NODE_ACCENTS`. */
export const AI_IMAGE_ACCENT = '#e0508a'

export const aiImageNodeTypes: NodeTypeRegistry = {
  [AI_PROMPT_NODE_TYPE]: {
    accent: AI_IMAGE_ACCENT,
    width: 320,
    height: 220,
    dom: {
      defaults: {
        title: '提示词',
        subtitle: '描述你想要的图片',
        fieldSource: 'params',
        maxVisibleFields: 1,
        fields: [
          {
            key: 'text',
            label: '内容',
            kind: 'textarea',
            placeholder: '例如：a serene mountain lake at sunrise',
          },
        ],
        layout: {
          minWidth: 280,
          minHeight: 200,
          headerHeight: 40,
        },
      },
    },
  },
  [AI_IMAGE_GENERATE_NODE_TYPE]: {
    accent: AI_IMAGE_ACCENT,
    width: 304,
    height: 256,
    dom: {
      defaults: {
        title: '生成图片',
        subtitle: 'Pollinations.ai',
        fieldSource: 'params',
        maxVisibleFields: 4,
        fields: [
          { key: 'model', label: '模型', kind: 'select' },
          { key: 'width', label: '宽', kind: 'number', min: 256, max: 2048, step: 64 },
          { key: 'height', label: '高', kind: 'number', min: 256, max: 2048, step: 64 },
          { key: 'seed', label: '种子 (0=随机)', kind: 'number', min: 0, max: 999999, step: 1 },
        ],
        layout: {
          minWidth: 280,
          minHeight: 240,
          headerHeight: 40,
        },
      },
    },
  },
  [AI_IMAGE_DISPLAY_NODE_TYPE]: {
    accent: AI_IMAGE_ACCENT,
    width: 360,
    height: 384,
    dom: {
      component: AI_IMAGE_DISPLAY_DOM_COMPONENT,
      defaults: {
        title: '图片预览',
        subtitle: 'AI 生成结果',
        fieldSource: 'params',
        maxVisibleFields: 1,
        fields: [
          {
            key: 'imageUrl',
            label: '结果图片',
            kind: 'image',
            fit: 'cover',
            downloadable: true,
            openable: true,
            emptyHint: '点击工具栏中的“运行”后\n图片会显示在这里',
          },
        ],
        layout: {
          minWidth: 280,
          minHeight: 300,
          headerHeight: 40,
        },
      },
    },
  },
}
