/** Below this width the scenario list starts as a rail and the run panel starts collapsed. */
const WIDE_LAYOUT_MIN_WIDTH = 1100

export interface ShellLayout {
  /** The scenario list shows titles; otherwise it is a rail of scenario markers. */
  navExpanded: boolean
  /** The run panel (a bottom drawer on phones) shows its content. */
  panelOpen: boolean
}

/** Panels start open on wide screens and out of the canvas's way on narrow ones. */
export function resolveInitialShellLayout(
  view: Pick<Window, 'innerWidth'> | undefined,
): ShellLayout {
  const wide = (view?.innerWidth ?? WIDE_LAYOUT_MIN_WIDTH) >= WIDE_LAYOUT_MIN_WIDTH

  return { navExpanded: wide, panelOpen: wide }
}
