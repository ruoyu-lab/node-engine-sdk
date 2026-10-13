import type { NodeParameterOption } from '@node-engine-sdk/core/protocol'
import {
  isDomFieldOptionSelected,
  isDomSelectOpen,
  resolveDomFieldControlClass,
  resolveDomFieldDisplayValue,
  resolveDomFieldImageAspectStyle,
  resolveDomFieldImageUrl,
  resolveDomFieldNumberValue,
  resolveDomFieldRangeProgress,
  resolveDomFieldRowClass,
  resolveDomFieldRowStyle,
  resolveDomFieldsStyle,
  resolveDomFieldStringValue,
  resolveDomNumberDraft,
  resolveDomSelectedOptionLabel,
  resolveDomTimeSegment,
  type DomNodeControls,
  type DomNodeControlsState,
  type DomTimeSegment,
  type NodeEngineResolvedDomNodeField,
  type NodeEngineResolvedDomNodeModel,
} from '@node-engine-sdk/core/view'
import type { ReactElement } from 'react'
import { DefaultDomNodeFieldPort } from './DefaultDomNodePort.js'
import { toClassName } from './class-names.js'
import { useDomEvents } from './use-dom-events.js'

interface FieldProps {
  field: NodeEngineResolvedDomNodeField
  controls: DomNodeControls
  state: DomNodeControlsState
}

export function DefaultDomNodeFields(props: {
  domModel: NodeEngineResolvedDomNodeModel
  controls: DomNodeControls
  state: DomNodeControlsState
}): ReactElement {
  const { domModel, controls, state } = props

  return (
    <section className="ne-default-dom-node__fields" style={resolveDomFieldsStyle(domModel)}>
      {domModel.fields.map((field) => (
        <div
          key={field.key}
          className={toClassName(['ne-default-dom-node__field', resolveDomFieldRowClass(field)])}
          style={resolveDomFieldRowStyle(field)}
        >
          {field.kind === 'textarea' ? (
            <TextareaField field={field} controls={controls} state={state} />
          ) : field.kind === 'image' ? (
            <ImageField field={field} controls={controls} state={state} />
          ) : (
            <InlineField field={field} controls={controls} state={state} />
          )}
        </div>
      ))}
    </section>
  )
}

function FieldPortRail({ field, controls }: FieldProps): ReactElement | null {
  return field.inputPort ? (
    <div className="ne-default-dom-node__field-port-rail">
      <DefaultDomNodeFieldPort port={field.inputPort} controls={controls} />
    </div>
  ) : null
}

function TextareaField(props: FieldProps): ReactElement {
  const { field, controls } = props
  const textareaRef = useDomEvents<HTMLTextAreaElement>({
    pointerdown: controls.controlPointerDown,
    click: controls.stopEvent,
  })

  return (
    <>
      <FieldPortRail {...props} />
      <div className="ne-default-dom-node__field-stack">
        <span className="ne-default-dom-node__field-label ne-default-dom-node__field-label--stack">
          {field.label}
        </span>
        <textarea
          ref={textareaRef}
          className="ne-default-dom-node__field-textarea ne-default-dom-node__field-textarea--stack"
          value={resolveDomFieldStringValue(field)}
          placeholder={field.placeholder}
          readOnly={field.driven}
          rows={3}
          onChange={(event) => controls.textInput(field, event.currentTarget.value)}
        />
      </div>
    </>
  )
}

function ImageField(props: FieldProps): ReactElement {
  const { field, controls } = props
  const url = resolveDomFieldImageUrl(field)
  const frameRef = useDomEvents<HTMLDivElement>({
    pointerdown: controls.controlPointerDown,
    click: controls.stopEvent,
  })

  return (
    <>
      <FieldPortRail {...props} />
      <div className="ne-default-dom-node__field-stack ne-default-dom-node__field-stack--image">
        <span className="ne-default-dom-node__field-label ne-default-dom-node__field-label--stack">
          {field.label}
        </span>
        <div
          ref={frameRef}
          className={toClassName([
            'ne-default-dom-node__field-image',
            { 'ne-default-dom-node__field-image--contain': field.fit === 'contain' },
          ])}
          style={resolveDomFieldImageAspectStyle(field)}
        >
          {url ? (
            <img
              className="ne-default-dom-node__field-image-img"
              src={url}
              alt=""
              referrerPolicy="no-referrer"
              draggable={false}
            />
          ) : (
            <div className="ne-default-dom-node__field-image-empty">
              {field.emptyHint ?? '暂无图片'}
            </div>
          )}

          {url && (field.downloadable || field.openable) ? (
            <div className="ne-default-dom-node__field-image-actions">
              {field.downloadable ? (
                <ImageAction
                  label="下载"
                  controls={controls}
                  run={() => controls.downloadImage(field)}
                />
              ) : null}
              {field.openable ? (
                <ImageAction
                  label="打开"
                  controls={controls}
                  run={() => controls.openImage(field)}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}

function ImageAction(props: {
  label: string
  controls: DomNodeControls
  run: () => void
}): ReactElement {
  const { controls, run } = props
  const buttonRef = useDomEvents<HTMLButtonElement>({
    pointerdown: controls.stopEvent,
    click: (event) => {
      controls.stopEvent(event)
      run()
    },
  })

  return (
    <button ref={buttonRef} type="button" className="ne-default-dom-node__field-image-action">
      {props.label}
    </button>
  )
}

function InlineField(props: FieldProps): ReactElement {
  const { field, controls } = props
  const labelRef = useDomEvents<HTMLDivElement>({
    pointerdown: (event) => controls.fieldPortAreaPointerDown(field, event),
  })
  const controlRef = useDomEvents<HTMLDivElement>({
    pointerdown: controls.controlPointerDown,
    click: controls.stopEvent,
  })

  return (
    <>
      <div ref={labelRef} className="ne-default-dom-node__field-label-wrap">
        {field.inputPort ? (
          <DefaultDomNodeFieldPort port={field.inputPort} controls={controls} />
        ) : (
          <span className="ne-default-dom-node__field-port-placeholder" aria-hidden="true" />
        )}
        <span className="ne-default-dom-node__field-label">{field.label}</span>
      </div>

      <div
        ref={controlRef}
        className={toClassName([
          'ne-default-dom-node__field-control',
          resolveDomFieldControlClass(field),
        ])}
      >
        <FieldControl {...props} />
      </div>
    </>
  )
}

function FieldControl(props: FieldProps): ReactElement {
  switch (props.field.kind) {
    case 'range':
      return <RangeControl {...props} />
    case 'time':
      return <TimeControl {...props} />
    case 'select':
      return <SelectControl {...props} />
    case 'boolean':
      return <BooleanControl {...props} />
    case 'number':
      return <NumberControl {...props} />
    default:
      return <TextControl {...props} />
  }
}

function RangeControl({ field, controls }: FieldProps): ReactElement {
  const inputRef = useDomEvents<HTMLInputElement>({
    pointerdown: controls.controlPointerDown,
    click: controls.stopEvent,
  })

  return (
    <>
      <div className="ne-default-dom-node__field-range">
        <span className="ne-default-dom-node__field-range-track" />
        <span
          className="ne-default-dom-node__field-range-fill"
          style={{ width: `${resolveDomFieldRangeProgress(field)}%` }}
        />
        <input
          ref={inputRef}
          className="ne-default-dom-node__field-range-input"
          type="range"
          value={resolveDomFieldNumberValue(field)}
          min={field.min ?? 0}
          max={field.max ?? 100}
          step={field.step ?? 1}
          disabled={field.driven}
          onChange={(event) => controls.rangeInput(field, event.currentTarget.value)}
        />
      </div>
      <span className="ne-default-dom-node__field-range-value">
        {resolveDomFieldDisplayValue(field)}
      </span>
    </>
  )
}

function TimeControl(props: FieldProps): ReactElement {
  return (
    <div className="ne-default-dom-node__field-time-group">
      <TimeSegmentInput {...props} segment="hours" />
      <span className="ne-default-dom-node__field-time-separator">:</span>
      <TimeSegmentInput {...props} segment="minutes" />
    </div>
  )
}

function TimeSegmentInput({
  field,
  controls,
  state,
  segment,
}: FieldProps & { segment: DomTimeSegment }): ReactElement {
  const inputRef = useDomEvents<HTMLInputElement>({
    pointerdown: controls.controlPointerDown,
    click: controls.stopEvent,
  })

  return (
    <input
      ref={inputRef}
      className="ne-default-dom-node__field-time-segment"
      type="text"
      inputMode="numeric"
      maxLength={2}
      value={resolveDomTimeSegment(state, field, segment)}
      readOnly={field.driven}
      onChange={(event) => controls.timeSegmentInput(field, segment, event.currentTarget.value)}
      onBlur={() => controls.timeSegmentCommit(field)}
    />
  )
}

function SelectControl(props: FieldProps): ReactElement {
  const { field, controls, state } = props
  const triggerRef = useDomEvents<HTMLButtonElement>({
    pointerdown: controls.controlPointerDown,
    click: (event) => controls.toggleSelect(field, event),
  })

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="ne-default-dom-node__field-select-trigger"
        disabled={field.driven}
      >
        <span className="ne-default-dom-node__field-select-label">
          {resolveDomSelectedOptionLabel(field)}
        </span>
        <span className="ne-default-dom-node__field-select-icon">
          <Chevron points="6 9 12 15 18 9" strokeWidth={2.5} />
        </span>
      </button>

      {isDomSelectOpen(state, field) ? <SelectMenu {...props} /> : null}
    </>
  )
}

function SelectMenu({ field, controls }: FieldProps): ReactElement {
  const menuRef = useDomEvents<HTMLDivElement>({
    pointerdown: controls.controlPointerDown,
    click: controls.stopEvent,
  })

  return (
    <div ref={menuRef} className="ne-default-dom-node__field-select-menu">
      {(field.options ?? []).map((option) => (
        <SelectOption
          key={`${field.key}-${String(option.value ?? '')}`}
          field={field}
          option={option}
          controls={controls}
        />
      ))}
    </div>
  )
}

function SelectOption(props: {
  field: NodeEngineResolvedDomNodeField
  option: NodeParameterOption
  controls: DomNodeControls
}): ReactElement {
  const { field, option, controls } = props
  const optionRef = useDomEvents<HTMLButtonElement>({
    click: (event) => controls.selectOption(field, String(option.value ?? ''), event),
  })

  return (
    <button
      ref={optionRef}
      type="button"
      className={toClassName([
        'ne-default-dom-node__field-select-option',
        {
          'ne-default-dom-node__field-select-option--selected': isDomFieldOptionSelected(
            field,
            option.value,
          ),
        },
      ])}
    >
      {option.label}
    </button>
  )
}

function BooleanControl({ field, controls }: FieldProps): ReactElement {
  const checked = field.resolvedValue === true
  const switchRef = useDomEvents<HTMLLabelElement>({
    pointerdown: controls.controlPointerDown,
    click: controls.stopEvent,
  })
  // React derives a checkbox's `onChange` from `click`, which the switch stops natively like
  // every field control. The change is therefore bound natively and React only renders
  // `checked`; `readOnly` declares that the element has no React change handler.
  const inputRef = useDomEvents<HTMLInputElement>({
    change: (event) => controls.booleanChange(field, (event.target as HTMLInputElement).checked),
  })

  return (
    <>
      <span className="ne-default-dom-node__field-value ne-default-dom-node__field-value--left">
        {resolveDomFieldDisplayValue(field)}
      </span>
      <label
        ref={switchRef}
        className={toClassName([
          'ne-default-dom-node__field-switch',
          { 'ne-default-dom-node__field-switch--on': checked },
        ])}
      >
        <input
          ref={inputRef}
          className="ne-default-dom-node__field-switch-input"
          type="checkbox"
          checked={checked}
          readOnly
          disabled={field.driven}
        />
        <span className="ne-default-dom-node__field-switch-knob" />
      </label>
    </>
  )
}

function TextControl({ field, controls }: FieldProps): ReactElement {
  const inputRef = useDomEvents<HTMLInputElement>({
    pointerdown: controls.controlPointerDown,
    click: controls.stopEvent,
  })

  return (
    <input
      ref={inputRef}
      className="ne-default-dom-node__field-input"
      type="text"
      value={resolveDomFieldStringValue(field)}
      placeholder={field.placeholder}
      readOnly={field.driven}
      onChange={(event) => controls.textInput(field, event.currentTarget.value)}
    />
  )
}

function NumberControl(props: FieldProps): ReactElement {
  const { field, controls, state } = props
  const inputRef = useDomEvents<HTMLInputElement>({
    pointerdown: (event) => controls.numberPointerDown(field, event),
    click: controls.stopEvent,
  })

  return (
    <>
      <NumberStep {...props} direction={-1} />
      <input
        ref={inputRef}
        className="ne-default-dom-node__field-input ne-default-dom-node__field-input--number"
        type="text"
        inputMode="decimal"
        value={resolveDomNumberDraft(state, field)}
        placeholder={field.placeholder}
        readOnly={field.driven}
        onChange={(event) => controls.numberDraftInput(field, event.currentTarget.value)}
        onBlur={(event) => controls.numberDraftCommit(field, event.currentTarget.value)}
      />
      <NumberStep {...props} direction={1} />
    </>
  )
}

function NumberStep({
  field,
  controls,
  direction,
}: FieldProps & { direction: -1 | 1 }): ReactElement {
  const stepRef = useDomEvents<HTMLButtonElement>({
    pointerdown: (event) => controls.numberStep(field, direction, event),
  })

  return (
    <button
      ref={stepRef}
      type="button"
      className="ne-default-dom-node__field-number-step"
      disabled={field.driven}
    >
      <span className="ne-default-dom-node__field-number-step-icon">
        <Chevron points={direction < 0 ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} strokeWidth={3} />
      </span>
    </button>
  )
}

function Chevron(props: { points: string; strokeWidth: number }): ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={props.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points={props.points} />
    </svg>
  )
}
