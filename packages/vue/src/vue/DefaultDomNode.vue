<script setup lang="ts">
import {
  resolveDomNodeAccentStyle,
  resolveDomNodeClass,
  resolveDomNodeHeaderStyle,
  resolveDomNodeStatusClass,
  type NodeEngineDomNodeProps,
} from '@node-engine-sdk/core/view'
import DefaultDomNodeFields from './DefaultDomNodeFields.vue'
import DefaultDomNodePort from './DefaultDomNodePort.vue'
import DefaultDomNodeResizeHandles from './DefaultDomNodeResizeHandles.vue'
import { useDomNodeControls } from './use-dom-node-controls'

const props = defineProps<NodeEngineDomNodeProps>()
const { controls, state } = useDomNodeControls(props)
</script>

<template>
  <article
    class="ne-default-dom-node"
    :class="resolveDomNodeClass(props)"
    :style="resolveDomNodeAccentStyle(domModel)"
    @pointerdown="controls.nodePointerDown"
  >
    <header class="ne-default-dom-node__header" :style="resolveDomNodeHeaderStyle(domModel)">
      <span class="ne-default-dom-node__accent" aria-hidden="true" />
      <div class="ne-default-dom-node__title-container">
        <strong class="ne-default-dom-node__title">{{ domModel.title }}</strong>
        <span v-if="domModel.subtitle" class="ne-default-dom-node__subtitle">
          {{ domModel.subtitle }}
        </span>
      </div>
      <span
        v-if="resolveDomNodeStatusClass(status)"
        :class="resolveDomNodeStatusClass(status)"
        aria-hidden="true"
      />
    </header>

    <div class="ne-default-dom-node__ports">
      <DefaultDomNodePort
        v-for="port in domModel.inputs"
        :key="port.key"
        :port="port"
        side="left"
        :controls="controls"
      />
      <DefaultDomNodePort
        v-for="port in domModel.outputs"
        :key="port.key"
        :port="port"
        side="right"
        :controls="controls"
      />
    </div>

    <DefaultDomNodeFields
      v-if="domModel.fields.length"
      :dom-model="domModel"
      :controls="controls"
      :state="state"
    />

    <DefaultDomNodeResizeHandles :controls="controls" />
  </article>
</template>
