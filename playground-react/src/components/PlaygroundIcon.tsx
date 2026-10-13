import { playgroundIcons, type PlaygroundIconName } from '@playground/shared/app/icons'
import type { ReactElement } from 'react'

export function PlaygroundIcon(props: { name: PlaygroundIconName }): ReactElement {
  return (
    <svg className="pg-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {playgroundIcons[props.name].map((path, index) => (
        <path key={index} className={path.solid ? 'pg-icon__solid' : undefined} d={path.d} />
      ))}
    </svg>
  )
}
