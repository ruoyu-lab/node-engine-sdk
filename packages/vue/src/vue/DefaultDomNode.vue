<script setup lang="ts">
import {
  resolveDomNodeAccentStyle,
  resolveDomNodeClass,
  resolveDomNodeHeaderStyle,
  resolveDomNodeStatusClass,
  type NodeWrightDomNodeProps,
} from '@node-wright/core/view'
import DefaultDomNodeFields from './DefaultDomNodeFields.vue'
import DefaultDomNodePort from './DefaultDomNodePort.vue'
import DefaultDomNodeResizeHandles from './DefaultDomNodeResizeHandles.vue'
import { useDomNodeControls } from './use-dom-node-controls'

const props = defineProps<NodeWrightDomNodeProps>()
const { controls, state } = useDomNodeControls(props)
</script>

<template>
  <article
    class="nw-default-dom-node"
    :class="resolveDomNodeClass(props)"
    :style="resolveDomNodeAccentStyle(domModel)"
    @pointerdown="controls.nodePointerDown"
  >
    <header class="nw-default-dom-node__header" :style="resolveDomNodeHeaderStyle(domModel)">
      <span class="nw-default-dom-node__accent" aria-hidden="true" />
      <div class="nw-default-dom-node__title-container">
        <strong class="nw-default-dom-node__title">{{ domModel.title }}</strong>
        <span v-if="domModel.subtitle" class="nw-default-dom-node__subtitle">
          {{ domModel.subtitle }}
        </span>
      </div>
      <span
        v-if="resolveDomNodeStatusClass(status)"
        :class="resolveDomNodeStatusClass(status)"
        aria-hidden="true"
      />
    </header>

    <div class="nw-default-dom-node__ports">
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
