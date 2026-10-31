<script setup lang="ts">
import { playgroundCompanion } from '@playground/shared/app/companion-app'
import type { DemoScenario, DemoScenarioId } from '@playground/shared/demo/scenarios'
import PlaygroundIcon from './PlaygroundIcon.vue'

defineProps<{
  scenarios: DemoScenario[]
  activeId: DemoScenarioId
  expanded: boolean
}>()

defineEmits<{
  (event: 'select', id: DemoScenarioId): void
  (event: 'toggle'): void
}>()
</script>

<template>
  <aside
    class="app-shell__sidebar demo-sidebar"
    :class="{ 'demo-sidebar--collapsed': !expanded }"
    aria-label="场景"
    data-canvas-inset
  >
    <header class="demo-sidebar__header">
      <span class="demo-sidebar__logo" aria-hidden="true">
        <svg viewBox="0 0 20 20" focusable="false">
          <path class="demo-sidebar__logo-link" d="M6 7c4.5 0 3.5 6 8 6" />
          <circle class="demo-sidebar__logo-node" cx="5.5" cy="7" r="2.25" />
          <circle class="demo-sidebar__logo-node" cx="14.5" cy="13" r="2.25" />
        </svg>
      </span>
      <div class="demo-sidebar__brand">
        <strong>Node Wright</strong>
        <span>Playground</span>
      </div>
      <button
        type="button"
        class="pg-icon-button demo-sidebar__toggle"
        :aria-expanded="expanded"
        aria-controls="demo-scenarios"
        :aria-label="expanded ? '收起场景列表' : '展开场景列表'"
        :data-tooltip="expanded ? '收起' : '展开'"
        @click="$emit('toggle')"
      >
        <PlaygroundIcon :name="expanded ? 'chevronLeft' : 'chevronRight'" />
      </button>
    </header>

    <nav id="demo-scenarios" class="demo-sidebar__nav" aria-label="演示场景">
      <button
        v-for="scenario in scenarios"
        :key="scenario.id"
        class="demo-sidebar__item"
        :class="{ 'demo-sidebar__item--active': scenario.id === activeId }"
        type="button"
        :aria-current="scenario.id === activeId ? 'true' : undefined"
        :data-tooltip="scenario.title"
        :style="{ '--scenario-accent': scenario.accent }"
        @click="$emit('select', scenario.id)"
      >
        <span class="demo-sidebar__marker" aria-hidden="true" />
        <span class="demo-sidebar__text">
          <strong>{{ scenario.title }}</strong>
          <span>{{ scenario.eyebrow }}</span>
        </span>
      </button>
    </nav>

    <a v-if="playgroundCompanion" class="demo-sidebar__companion" :href="playgroundCompanion.href">
      <span>切换到 {{ playgroundCompanion.label }}</span>
      <PlaygroundIcon name="external" />
    </a>
  </aside>
</template>
