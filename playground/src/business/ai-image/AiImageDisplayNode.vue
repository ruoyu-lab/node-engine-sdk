<script setup lang="ts">
import { computed } from 'vue'
import type { NodeEngineDomNodeProps } from '@node-engine-sdk/core/view'
import { DefaultDomNode } from '@node-engine-sdk/vue'
import { summarizeAiImageResult } from '@playground/shared/business/ai-image'

const props = defineProps<NodeEngineDomNodeProps>()
const summary = computed(() => summarizeAiImageResult(props.node))
</script>

<template>
  <div class="ai-image-display">
    <DefaultDomNode v-bind="props" />
    <span class="ai-image-display__badge" :class="`ai-image-display__badge--${summary.state}`">
      {{ summary.label }}
    </span>
  </div>
</template>
