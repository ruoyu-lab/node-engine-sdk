<script setup lang="ts">
import { playgroundIcons, type PlaygroundIconName } from '@playground/shared/app/icons'

defineProps<{
  name: PlaygroundIconName
}>()
</script>

<template>
  <svg class="pg-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      v-for="(path, index) in playgroundIcons[name]"
      :key="index"
      :class="path.solid ? 'pg-icon__solid' : undefined"
      :d="path.d"
    />
  </svg>
</template>
