import { playgroundCompanion } from '@playground/shared/app/companion-app'
import type { DemoScenario, DemoScenarioId } from '@playground/shared/demo/scenarios'
import type { CSSProperties, ReactElement } from 'react'
import { PlaygroundIcon } from './PlaygroundIcon'

export function DemoSidebar(props: {
  scenarios: DemoScenario[]
  activeId: DemoScenarioId
  expanded: boolean
  onSelect: (id: DemoScenarioId) => void
  onToggle: () => void
}): ReactElement {
  const { expanded } = props

  return (
    <aside
      className={`app-shell__sidebar demo-sidebar${expanded ? '' : ' demo-sidebar--collapsed'}`}
      aria-label="场景"
      data-canvas-inset=""
    >
      <header className="demo-sidebar__header">
        <span className="demo-sidebar__logo" aria-hidden="true">
          <svg viewBox="0 0 20 20" focusable="false">
            <path className="demo-sidebar__logo-link" d="M6 7c4.5 0 3.5 6 8 6" />
            <circle className="demo-sidebar__logo-node" cx="5.5" cy="7" r="2.25" />
            <circle className="demo-sidebar__logo-node" cx="14.5" cy="13" r="2.25" />
          </svg>
        </span>
        <div className="demo-sidebar__brand">
          <strong>Node Wright</strong>
          <span>Playground</span>
        </div>
        <button
          type="button"
          className="pg-icon-button demo-sidebar__toggle"
          aria-expanded={expanded}
          aria-controls="demo-scenarios"
          aria-label={expanded ? '收起场景列表' : '展开场景列表'}
          data-tooltip={expanded ? '收起' : '展开'}
          onClick={props.onToggle}
        >
          <PlaygroundIcon name={expanded ? 'chevronLeft' : 'chevronRight'} />
        </button>
      </header>

      <nav id="demo-scenarios" className="demo-sidebar__nav" aria-label="演示场景">
        {props.scenarios.map((scenario) => {
          const active = scenario.id === props.activeId

          return (
            <button
              key={scenario.id}
              className={`demo-sidebar__item${active ? ' demo-sidebar__item--active' : ''}`}
              type="button"
              aria-current={active ? 'true' : undefined}
              data-tooltip={scenario.title}
              style={{ '--scenario-accent': scenario.accent } as CSSProperties}
              onClick={() => props.onSelect(scenario.id)}
            >
              <span className="demo-sidebar__marker" aria-hidden="true" />
              <span className="demo-sidebar__text">
                <strong>{scenario.title}</strong>
                <span>{scenario.eyebrow}</span>
              </span>
            </button>
          )
        })}
      </nav>

      {playgroundCompanion ? (
        <a className="demo-sidebar__companion" href={playgroundCompanion.href}>
          <span>{`切换到 ${playgroundCompanion.label}`}</span>
          <PlaygroundIcon name="external" />
        </a>
      ) : null}
    </aside>
  )
}
