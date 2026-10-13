import type { NodeEngineDomNodeProps } from '@node-engine-sdk/core/view'
import { DefaultDomNode } from '@node-engine-sdk/react'
import { summarizeAiImageResult } from '@playground/shared/business/ai-image'
import type { ReactElement } from 'react'

/** The image display node: the default DOM node with its generation result as a header badge. */
export function AiImageDisplayNode(props: NodeEngineDomNodeProps): ReactElement {
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
