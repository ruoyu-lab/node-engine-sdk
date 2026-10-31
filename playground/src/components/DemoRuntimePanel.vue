<script setup lang="ts">
import { computed } from 'vue'
import type { GraphNode, GraphSnapshot, NodeDefinition } from '@node-wright/core/protocol'
import type { NodeWrightRunResult } from '@node-wright/core/runtime'
import type { DemoRuntimeLogEntry } from '@playground/shared/demo/runtime'
import {
  countRunOutputs,
  formatRunStatus,
  formatRuntimeEventType,
  formatRuntimeVariables,
  listNodeParams,
  listRunOutputs,
  listTraceRows,
} from '@playground/shared/demo/runtime-labels'
import type { DemoScenario } from '@playground/shared/demo/scenarios'
import PlaygroundIcon from './PlaygroundIcon.vue'

const props = defineProps<{
  scenario: DemoScenario
  graph: GraphSnapshot
  selectedNode: GraphNode | null
  selectedDefinition: NodeDefinition | null
  result: NodeWrightRunResult | null
  events: DemoRuntimeLogEntry[]
  error: string | null
  running: boolean
  canRun: boolean
  open: boolean
}>()

defineEmits<{
  (event: 'toggle'): void
}>()

const status = computed(() => (props.running ? 'running' : (props.result?.status ?? 'idle')))
const selectedParams = computed(() => listNodeParams(props.selectedNode?.data?.params))
const variables = computed(() => formatRuntimeVariables(props.result?.variables ?? {}))
const outputs = computed(() => listRunOutputs(props.scenario, props.result))
const outputCount = computed(() => countRunOutputs(props.scenario, props.result))
const traceRows = computed(() => listTraceRows(props.result))
</script>

<template>
  <aside
    class="app-shell__panel runtime-panel"
    :class="{ 'runtime-panel--collapsed': !open }"
    aria-label="运行面板"
    data-canvas-inset
  >
    <header class="runtime-panel__header">
      <span
        class="runtime-panel__marker"
        :style="{ '--scenario-accent': scenario.accent }"
        aria-hidden="true"
      />
      <div class="runtime-panel__heading">
        <span class="runtime-panel__eyebrow">{{ scenario.eyebrow }}</span>
        <h2>{{ scenario.title }}</h2>
      </div>
      <span class="runtime-panel__status" :class="`runtime-panel__status--${status}`">
        {{ formatRunStatus(status) }}
      </span>
      <button
        type="button"
        class="pg-icon-button runtime-panel__toggle"
        :aria-expanded="open"
        aria-controls="runtime-panel-body"
        :aria-label="open ? '收起运行面板' : '展开运行面板'"
        @click="$emit('toggle')"
      >
        <PlaygroundIcon name="chevronDown" />
      </button>
    </header>

    <div id="runtime-panel-body" class="runtime-panel__body">
      <p class="runtime-panel__summary">{{ scenario.summary }}</p>

      <section class="runtime-panel__stats" aria-label="图统计">
        <span>{{ graph.nodes.length }} 个节点</span>
        <span>{{ graph.edges.length }} 条连线</span>
        <span>{{ graph.groups.length }} 个分组</span>
      </section>

      <section v-if="error" class="runtime-panel__message runtime-panel__message--error">
        {{ error }}
      </section>
      <section v-else-if="!canRun" class="runtime-panel__message">
        当前场景只演示编辑器，不需要运行时入口。
      </section>

      <section class="runtime-panel__section">
        <div class="runtime-panel__section-header">
          <span class="runtime-panel__eyebrow">运行结果</span>
          <strong>{{ outputCount }}</strong>
        </div>

        <ol class="runtime-panel__outputs">
          <li v-for="output in outputs" :key="output.key">
            <strong>{{ output.label }}</strong>
            <span>{{ output.value }}</span>
          </li>
        </ol>
      </section>

      <section class="runtime-panel__section">
        <div class="runtime-panel__section-header">
          <span class="runtime-panel__eyebrow">执行轨迹</span>
          <strong>{{ traceRows.length }}</strong>
        </div>

        <ol v-if="traceRows.length" class="runtime-panel__trace">
          <li
            v-for="row in traceRows"
            :key="row.key"
            :class="`runtime-panel__trace-step--${row.status}`"
          >
            <strong>{{ row.title }}</strong>
            <span>{{ row.detail }}</span>
          </li>
        </ol>
        <p v-else class="runtime-panel__empty">运行后按执行顺序列出每一步。</p>
      </section>

      <section class="runtime-panel__section">
        <div class="runtime-panel__section-header">
          <span class="runtime-panel__eyebrow">事件</span>
          <strong>{{ events.length }}</strong>
        </div>

        <ol v-if="events.length" class="runtime-panel__events">
          <li v-for="event in events.slice(0, 8)" :key="event.id">
            <strong>{{ formatRuntimeEventType(event.type) }}</strong>
            <span>{{ event.detail }}</span>
          </li>
        </ol>
        <p v-else class="runtime-panel__empty">运行时事件会显示在这里。</p>
      </section>

      <section class="runtime-panel__section">
        <div class="runtime-panel__section-header">
          <span class="runtime-panel__eyebrow">选中项</span>
          <strong>{{ selectedNode?.id ?? '未选择' }}</strong>
        </div>

        <template v-if="selectedNode">
          <dl class="runtime-panel__definition">
            <dt>类型</dt>
            <dd>{{ selectedNode.type }}</dd>
            <dt>标签</dt>
            <dd>{{ selectedDefinition?.label ?? '-' }}</dd>
          </dl>

          <div v-if="selectedParams.length" class="runtime-panel__params">
            <span v-for="[key, value] in selectedParams" :key="key">{{ key }}: {{ value }}</span>
          </div>
        </template>
      </section>

      <section class="runtime-panel__section">
        <div class="runtime-panel__section-header">
          <span class="runtime-panel__eyebrow">运行时</span>
          <strong>{{ formatRunStatus(result?.status) }}</strong>
        </div>

        <pre class="runtime-panel__variables">{{ variables }}</pre>
      </section>
    </div>
  </aside>
</template>
