<script setup lang="ts">
import { computed } from 'vue'
import type { NodeWrightDomNodeProps } from '@node-wright/core/view'
import { DefaultDomNode } from '@node-wright/vue'
import { summarizeAiImageResult } from '@playground/shared/business/ai-image'

const props = defineProps<NodeWrightDomNodeProps>()
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
