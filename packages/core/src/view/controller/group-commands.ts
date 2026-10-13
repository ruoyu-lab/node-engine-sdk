import {
  cloneValue,
  type GraphGroup,
  type GraphGroupPatch,
  type GraphSnapshot,
  type XYPosition,
} from '../../protocol/index.js'
import type { GraphStore } from '../../store/index.js'
import { snap } from '../rendering/geometry.js'
import { isGroupCollapsed, resolveGroupNodeIds, syncGroupMembership } from './groups.js'
import type { GridSnapping } from './interactions/drag.js'

/** Group mutations; moving a group moves its member nodes unless disabled. */
export interface GroupCommands {
  add: (group: Omit<GraphGroup, 'id'> & { id?: string }) => GraphGroup
  update: (groupId: string, patch: GraphGroupPatch) => GraphSnapshot
  move: (groupIds: string[], delta: XYPosition, options?: { moveNodes?: boolean }) => GraphSnapshot
  resize: (groupId: string, size: { width?: number; height?: number }) => GraphSnapshot
  setCollapsed: (groupId: string, collapsed: boolean) => GraphSnapshot
  toggleCollapsed: (groupId: string) => GraphSnapshot
  remove: (groupId: string) => GraphSnapshot
}

export function createGroupCommands(options: {
  getStore: () => GraphStore
  getSnapping: () => GridSnapping
  getMinimumSize: () => { width: number; height: number }
}): GroupCommands {
  const store = options.getStore

  function setCollapsed(groupId: string, collapsed: boolean): GraphSnapshot {
    return store().updateGroup(
      groupId,
      { data: { ...store().getGroup(groupId)?.data, collapsed } },
      { source: collapsed ? 'api.collapse-group' : 'api.expand-group' },
    )
  }

  return {
    add(group) {
      const next: GraphGroup = {
        ...group,
        id: group.id ?? store().createId('group'),
        nodeIds: cloneValue(group.nodeIds),
        data: cloneValue(group.data),
      }

      store().mutate(
        'Add group',
        (draft) => {
          draft.groups = [...draft.groups, next]
          syncGroupMembership(draft)
        },
        { source: 'api.add-group' },
      )
      return next
    },
    update(groupId, patch) {
      return store().mutate(
        'Update group',
        (draft) => {
          draft.groups = draft.groups.map((group) =>
            group.id === groupId ? { ...group, ...patch } : group,
          )
          syncGroupMembership(draft)
        },
        { source: 'api.update-group' },
      )
    },
    move(groupIds, delta, config) {
      const uniqueGroupIds = [...new Set(groupIds)]

      if (!uniqueGroupIds.length || (delta.x === 0 && delta.y === 0)) {
        return store().getSnapshot()
      }

      const graph = store().getSnapshot()
      const moving = new Set(uniqueGroupIds)
      const nodeIds = new Set(
        config?.moveNodes === false
          ? []
          : graph.groups
              .filter((group) => moving.has(group.id))
              .flatMap((group) => resolveGroupNodeIds(graph, group)),
      )

      return store().mutate(
        `Move ${uniqueGroupIds.length} group(s)`,
        (draft) => {
          draft.groups = draft.groups.map((group) =>
            moving.has(group.id) ? { ...group, x: group.x + delta.x, y: group.y + delta.y } : group,
          )

          if (!nodeIds.size) {
            return
          }

          draft.nodes = draft.nodes.map((node) =>
            nodeIds.has(node.id) ? { ...node, x: node.x + delta.x, y: node.y + delta.y } : node,
          )
          syncGroupMembership(draft)
        },
        { source: 'api.move-groups' },
      )
    },
    resize(groupId, size) {
      const snapping = options.getSnapping()
      const minimum = options.getMinimumSize()
      const resolve = (value: number) => (snapping.enabled ? snap(value, snapping.size) : value)

      return store().mutate(
        'Resize group',
        (draft) => {
          draft.groups = draft.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  width: Math.max(minimum.width, resolve(size.width ?? group.width)),
                  height: Math.max(minimum.height, resolve(size.height ?? group.height)),
                }
              : group,
          )
          syncGroupMembership(draft)
        },
        { source: 'api.resize-group' },
      )
    },
    setCollapsed,
    toggleCollapsed: (groupId) =>
      setCollapsed(groupId, !isGroupCollapsed(store().getGroup(groupId))),
    remove: (groupId) => store().removeGroup(groupId, { source: 'api.remove-group' }),
  }
}
