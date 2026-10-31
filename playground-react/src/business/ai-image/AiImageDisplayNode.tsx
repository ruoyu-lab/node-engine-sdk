import type { NodeWrightDomNodeProps } from '@node-wright/core/view'
import { DefaultDomNode } from '@node-wright/react'
import { summarizeAiImageResult } from '@playground/shared/business/ai-image'
import type { ReactElement } from 'react'

/** The image display node: the default DOM node with its generation result as a header badge. */
export function AiImageDisplayNode(props: NodeWrightDomNodeProps): ReactElement {
  const summary = summarizeAiImageResult(props.node)

  return (
    <div className="ai-image-display">
      <DefaultDomNode {...props} />
      <span className={`ai-image-display__badge ai-image-display__badge--${summary.state}`}>
        {summary.label}
      </span>
    </div>
  )
}
