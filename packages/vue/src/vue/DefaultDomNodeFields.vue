<script setup lang="ts">
import {
  isDomFieldOptionSelected,
  isDomSelectOpen,
  resolveDomFieldControlClass,
  resolveDomFieldDisplayValue,
  resolveDomFieldImageAspectStyle,
  resolveDomFieldImageUrl,
  resolveDomFieldNumberValue,
  resolveDomFieldPortDotClass,
  resolveDomFieldRangeProgress,
  resolveDomFieldRowClass,
  resolveDomFieldRowStyle,
  resolveDomFieldsStyle,
  resolveDomFieldStringValue,
  resolveDomNumberDraft,
  resolveDomPortDotStyle,
  resolveDomSelectedOptionLabel,
  resolveDomTimeSegment,
  type DomNodeControls,
  type DomNodeControlsState,
  type NodeWrightResolvedDomNodeModel,
} from '@node-wright/core/view'

defineProps<{
  domModel: NodeWrightResolvedDomNodeModel
  controls: DomNodeControls
  state: DomNodeControlsState
}>()

function readValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function readChecked(event: Event): boolean {
  return (event.target as HTMLInputElement).checked
}
</script>

<template>
  <section class="nw-default-dom-node__fields" :style="resolveDomFieldsStyle(domModel)">
    <div
      v-for="field in domModel.fields"
      :key="field.key"
      class="nw-default-dom-node__field"
      :class="resolveDomFieldRowClass(field)"
      :style="resolveDomFieldRowStyle(field)"
    >
      <template v-if="field.kind === 'textarea'">
        <div v-if="field.inputPort" class="nw-default-dom-node__field-port-rail">
          <span
            class="nw-default-dom-node__field-port-hit"
            @pointerdown="controls.portPointerDown(field.inputPort.id, $event)"
            @pointerenter="controls.portPointerEnter(field.inputPort.id)"
            @pointerleave="controls.portPointerLeave()"
            @pointerup="controls.portPointerUp(field.inputPort.id, $event)"
          >
            <span
              class="nw-default-dom-node__field-port-dot"
              :class="resolveDomFieldPortDotClass(field.inputPort)"
              :style="resolveDomPortDotStyle(field.inputPort)"
            />
          </span>
        </div>

        <div class="nw-default-dom-node__field-stack">
          <span class="nw-default-dom-node__field-label nw-default-dom-node__field-label--stack">
            {{ field.label }}
          </span>

          <textarea
            class="nw-default-dom-node__field-textarea nw-default-dom-node__field-textarea--stack"
            :value="resolveDomFieldStringValue(field)"
            :placeholder="field.placeholder"
            :readonly="field.driven"
            rows="3"
            @pointerdown="controls.controlPointerDown"
            @click="controls.stopEvent"
            @input="controls.textInput(field, readValue($event))"
          />
        </div>
      </template>

      <template v-else-if="field.kind === 'image'">
        <div v-if="field.inputPort" class="nw-default-dom-node__field-port-rail">
          <span
            class="nw-default-dom-node__field-port-hit"
            @pointerdown="controls.portPointerDown(field.inputPort.id, $event)"
            @pointerenter="controls.portPointerEnter(field.inputPort.id)"
            @pointerleave="controls.portPointerLeave()"
            @pointerup="controls.portPointerUp(field.inputPort.id, $event)"
          >
            <span
              class="nw-default-dom-node__field-port-dot"
              :class="resolveDomFieldPortDotClass(field.inputPort)"
              :style="resolveDomPortDotStyle(field.inputPort)"
            />
          </span>
        </div>

        <div class="nw-default-dom-node__field-stack nw-default-dom-node__field-stack--image">
          <span class="nw-default-dom-node__field-label nw-default-dom-node__field-label--stack">
            {{ field.label }}
          </span>

          <div
            class="nw-default-dom-node__field-image"
            :class="{ 'nw-default-dom-node__field-image--contain': field.fit === 'contain' }"
            :style="resolveDomFieldImageAspectStyle(field)"
            @pointerdown="controls.controlPointerDown"
            @click="controls.stopEvent"
          >
            <img
              v-if="resolveDomFieldImageUrl(field)"
              class="nw-default-dom-node__field-image-img"
              :src="resolveDomFieldImageUrl(field) ?? ''"
              alt=""
              referrerpolicy="no-referrer"
              draggable="false"
            />
            <div v-else class="nw-default-dom-node__field-image-empty">
              {{ field.emptyHint ?? '暂无图片' }}
            </div>

            <div
              v-if="resolveDomFieldImageUrl(field) && (field.downloadable || field.openable)"
              class="nw-default-dom-node__field-image-actions"
            >
              <button
                v-if="field.downloadable"
                type="button"
                class="nw-default-dom-node__field-image-action"
                @pointerdown.stop
                @click.stop="controls.downloadImage(field)"
              >
                下载
              </button>
              <button
                v-if="field.openable"
                type="button"
                class="nw-default-dom-node__field-image-action"
                @pointerdown.stop
                @click.stop="controls.openImage(field)"
              >
                打开
              </button>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div
          class="nw-default-dom-node__field-label-wrap"
          @pointerdown="controls.fieldPortAreaPointerDown(field, $event)"
        >
          <span
            v-if="field.inputPort"
            class="nw-default-dom-node__field-port-hit"
            @pointerdown="controls.portPointerDown(field.inputPort.id, $event)"
            @pointerenter="controls.portPointerEnter(field.inputPort.id)"
            @pointerleave="controls.portPointerLeave()"
            @pointerup="controls.portPointerUp(field.inputPort.id, $event)"
          >
            <span
              class="nw-default-dom-node__field-port-dot"
              :class="resolveDomFieldPortDotClass(field.inputPort)"
              :style="resolveDomPortDotStyle(field.inputPort)"
            />
          </span>
          <span v-else class="nw-default-dom-node__field-port-placeholder" aria-hidden="true" />
          <span class="nw-default-dom-node__field-label">{{ field.label }}</span>
        </div>

        <div
          class="nw-default-dom-node__field-control"
          :class="resolveDomFieldControlClass(field)"
          @pointerdown="controls.controlPointerDown"
          @click="controls.stopEvent"
        >
          <template v-if="field.kind === 'range'">
            <div class="nw-default-dom-node__field-range">
              <span class="nw-default-dom-node__field-range-track" />
              <span
                class="nw-default-dom-node__field-range-fill"
                :style="{ width: `${resolveDomFieldRangeProgress(field)}%` }"
              />
              <input
                class="nw-default-dom-node__field-range-input"
                type="range"
                :value="resolveDomFieldNumberValue(field)"
                :min="field.min ?? 0"
                :max="field.max ?? 100"
                :step="field.step ?? 1"
                :disabled="field.driven"
                @pointerdown="controls.controlPointerDown"
                @click="controls.stopEvent"
                @input="controls.rangeInput(field, readValue($event))"
              />
            </div>
            <span class="nw-default-dom-node__field-range-value">
              {{ resolveDomFieldDisplayValue(field) }}
            </span>
          </template>

          <template v-else-if="field.kind === 'time'">
            <div class="nw-default-dom-node__field-time-group">
              <input
                class="nw-default-dom-node__field-time-segment"
                type="text"
                inputmode="numeric"
                maxlength="2"
                :value="resolveDomTimeSegment(state, field, 'hours')"
                :readonly="field.driven"
                @pointerdown="controls.controlPointerDown"
                @click="controls.stopEvent"
                @input="controls.timeSegmentInput(field, 'hours', readValue($event))"
                @blur="controls.timeSegmentCommit(field)"
              />
              <span class="nw-default-dom-node__field-time-separator">:</span>
              <input
                class="nw-default-dom-node__field-time-segment"
                type="text"
                inputmode="numeric"
                maxlength="2"
                :value="resolveDomTimeSegment(state, field, 'minutes')"
                :readonly="field.driven"
                @pointerdown="controls.controlPointerDown"
                @click="controls.stopEvent"
                @input="controls.timeSegmentInput(field, 'minutes', readValue($event))"
                @blur="controls.timeSegmentCommit(field)"
              />
            </div>
          </template>

          <template v-else-if="field.kind === 'select'">
            <button
              type="button"
              class="nw-default-dom-node__field-select-trigger"
              :disabled="field.driven"
              @pointerdown="controls.controlPointerDown"
              @click="controls.toggleSelect(field, $event)"
            >
              <span class="nw-default-dom-node__field-select-label">
                {{ resolveDomSelectedOptionLabel(field) }}
              </span>
              <span class="nw-default-dom-node__field-select-icon">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </span>
            </button>

            <div
              v-if="isDomSelectOpen(state, field)"
              class="nw-default-dom-node__field-select-menu"
              @pointerdown="controls.controlPointerDown"
              @click="controls.stopEvent"
            >
              <button
                v-for="option in field.options ?? []"
                :key="`${field.key}-${String(option.value ?? '')}`"
                type="button"
                class="nw-default-dom-node__field-select-option"
                :class="{
                  'nw-default-dom-node__field-select-option--selected': isDomFieldOptionSelected(
                    field,
                    option.value,
                  ),
                }"
                @click="controls.selectOption(field, String(option.value ?? ''), $event)"
              >
                {{ option.label }}
              </button>
            </div>
          </template>

          <template v-else-if="field.kind === 'boolean'">
            <span class="nw-default-dom-node__field-value nw-default-dom-node__field-value--left">
              {{ resolveDomFieldDisplayValue(field) }}
            </span>
            <label
              class="nw-default-dom-node__field-switch"
              :class="{ 'nw-default-dom-node__field-switch--on': field.resolvedValue === true }"
              @pointerdown="controls.controlPointerDown"
              @click="controls.stopEvent"
            >
              <input
                class="nw-default-dom-node__field-switch-input"
                type="checkbox"
                :checked="field.resolvedValue === true"
                :disabled="field.driven"
                @change="controls.booleanChange(field, readChecked($event))"
              />
              <span class="nw-default-dom-node__field-switch-knob" />
            </label>
          </template>

          <template v-else-if="field.kind === 'text'">
            <input
              class="nw-default-dom-node__field-input"
              type="text"
              :value="resolveDomFieldStringValue(field)"
              :placeholder="field.placeholder"
              :readonly="field.driven"
              @pointerdown="controls.controlPointerDown"
              @click="controls.stopEvent"
              @input="controls.textInput(field, readValue($event))"
            />
          </template>

          <template v-else-if="field.kind === 'number'">
            <button
              type="button"
              class="nw-default-dom-node__field-number-step"
              :disabled="field.driven"
              @pointerdown="controls.numberStep(field, -1, $event)"
            >
              <span class="nw-default-dom-node__field-number-step-icon">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </span>
            </button>
            <input
              class="nw-default-dom-node__field-input nw-default-dom-node__field-input--number"
              type="text"
              inputmode="decimal"
              :value="resolveDomNumberDraft(state, field)"
              :placeholder="field.placeholder"
              :readonly="field.driven"
              @pointerdown="controls.numberPointerDown(field, $event)"
              @click="controls.stopEvent"
              @input="controls.numberDraftInput(field, readValue($event))"
              @blur="controls.numberDraftCommit(field, readValue($event))"
            />
            <button
              type="button"
              class="nw-default-dom-node__field-number-step"
              :disabled="field.driven"
              @pointerdown="controls.numberStep(field, 1, $event)"
            >
              <span class="nw-default-dom-node__field-number-step-icon">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </span>
            </button>
          </template>

          <template v-else>
            <input
              class="nw-default-dom-node__field-input"
              type="text"
              :value="resolveDomFieldStringValue(field)"
              :placeholder="field.placeholder"
              :readonly="field.driven"
              @pointerdown="controls.controlPointerDown"
              @click="controls.stopEvent"
              @input="controls.textInput(field, readValue($event))"
            />
          </template>
        </div>
      </template>
    </div>
  </section>
</template>
