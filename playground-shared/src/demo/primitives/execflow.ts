import type { GraphSnapshot } from '@node-wright/core/protocol'
import { EXEC_IN_PORT_ID, EXEC_THEN_PORT_ID } from '@node-wright/core/semantics'
import {
  PRESET_NODE_ACCENTS,
  EXEC_BRANCH_NODE_TYPE,
  EXEC_DELAY_NODE_TYPE,
  EXEC_EVENT_NODE_TYPE,
  EXEC_GET_VARIABLE_NODE_TYPE,
  EXEC_LOG_NODE_TYPE,
  EXEC_SEQUENCE_NODE_TYPE,
  EXEC_SET_VARIABLE_NODE_TYPE,
  createExecflowPreset,
} from '@node-wright/presets'
import type { DemoScenario } from '../scenarios'
import { dataEdge, execEdge, groupOf, primitiveNode, snapshotOf } from './graph'

const preset = createExecflowPreset()

/**
 * The sequence first waits and publishes the run's draft into a graph variable, then branches on
 * the run's approval and logs the published notes. Both inputs come from the initial variables.
 */
export const execflowScenario: DemoScenario = {
  id: 'execflow',
  title: '审批发布流程',
  eyebrow: '执行流原语',
  accent: PRESET_NODE_ACCENTS.execflow,
  summary:
    '事件、顺序、延迟、分支、日志与变量节点组成的执行流。执行连线决定运行顺序，读取变量在每次执行时取最新值。',
  graph: createExecflowGraph,
  preset,
  runtimeDefinitions: preset.runtimeDefinitions,
  runtimeEventId: 'exec-start',
  runtimeInitialVariables: {
    run: { draft: '测试版发布说明', approved: true },
  },
  outputs: [
    { nodeId: 'exec-log-approved', portId: 'message', label: '发布日志' },
    { nodeId: 'exec-log-rejected', portId: 'message', label: '驳回日志' },
  ],
}

function createExecflowGraph(): GraphSnapshot {
  const nodes = [
    primitiveNode('exec-start', EXEC_EVENT_NODE_TYPE, {
      title: '开始',
      position: { x: 40, y: 230 },
      width: 200,
      height: 112,
    }),
    primitiveNode('exec-sequence', EXEC_SEQUENCE_NODE_TYPE, {
      title: '顺序执行',
      position: { x: 290, y: 220 },
      width: 210,
      height: 130,
    }),
    primitiveNode('exec-delay', EXEC_DELAY_NODE_TYPE, {
      title: '等待',
      position: { x: 550, y: 40 },
      width: 230,
      height: 150,
      params: { durationMs: 20 },
    }),
    primitiveNode('exec-read-draft', EXEC_GET_VARIABLE_NODE_TYPE, {
      title: '读取草稿',
      position: { x: 550, y: 230 },
      width: 230,
      height: 180,
      params: { scope: 'run', name: 'draft' },
    }),
    primitiveNode('exec-publish', EXEC_SET_VARIABLE_NODE_TYPE, {
      title: '写入发布说明',
      position: { x: 830, y: 40 },
      width: 250,
      height: 210,
      params: { scope: 'graph', name: 'notes' },
    }),
    primitiveNode('exec-read-approved', EXEC_GET_VARIABLE_NODE_TYPE, {
      title: '读取审批',
      position: { x: 290, y: 450 },
      width: 230,
      height: 180,
      params: { scope: 'run', name: 'approved' },
    }),
    primitiveNode('exec-branch', EXEC_BRANCH_NODE_TYPE, {
      title: '审批分支',
      position: { x: 570, y: 460 },
      width: 210,
      height: 140,
    }),
    primitiveNode('exec-read-notes', EXEC_GET_VARIABLE_NODE_TYPE, {
      title: '读取发布说明',
      position: { x: 570, y: 650 },
      width: 230,
      height: 180,
      params: { scope: 'graph', name: 'notes' },
    }),
    primitiveNode('exec-log-approved', EXEC_LOG_NODE_TYPE, {
      title: '发布日志',
      position: { x: 850, y: 400 },
      width: 230,
      height: 150,
      params: { message: '' },
    }),
    primitiveNode('exec-log-rejected', EXEC_LOG_NODE_TYPE, {
      title: '驳回日志',
      position: { x: 850, y: 600 },
      width: 230,
      height: 150,
      params: { message: '审批未通过' },
    }),
  ]

  return snapshotOf(
    { scenario: 'execflow' },
    nodes,
    [
      execEdge(
        'exec-start-to-sequence',
        ['exec-start', EXEC_THEN_PORT_ID],
        ['exec-sequence', EXEC_IN_PORT_ID],
      ),
      execEdge(
        'exec-sequence-to-delay',
        ['exec-sequence', 'then:0'],
        ['exec-delay', EXEC_IN_PORT_ID],
      ),
      execEdge(
        'exec-delay-to-publish',
        ['exec-delay', EXEC_THEN_PORT_ID],
        ['exec-publish', EXEC_IN_PORT_ID],
      ),
      execEdge(
        'exec-sequence-to-branch',
        ['exec-sequence', 'then:1'],
        ['exec-branch', EXEC_IN_PORT_ID],
      ),
      execEdge(
        'exec-branch-to-approved',
        ['exec-branch', 'true'],
        ['exec-log-approved', EXEC_IN_PORT_ID],
      ),
      execEdge(
        'exec-branch-to-rejected',
        ['exec-branch', 'false'],
        ['exec-log-rejected', EXEC_IN_PORT_ID],
      ),
      dataEdge('exec-draft-to-publish', ['exec-read-draft', 'value'], ['exec-publish', 'value']),
      dataEdge(
        'exec-approved-to-branch',
        ['exec-read-approved', 'value'],
        ['exec-branch', 'condition'],
      ),
      dataEdge('exec-notes-to-log', ['exec-read-notes', 'value'], ['exec-log-approved', 'message']),
    ],
    [groupOf('exec-group', '审批发布', { x: 16, y: 0, width: 1100, height: 860 }, nodes)],
  )
}
