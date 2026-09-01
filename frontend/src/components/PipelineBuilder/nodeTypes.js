import InputNode from './nodes/InputNode';
import AINode from './nodes/AINode';
import LogicNode from './nodes/LogicNode';
import RateLimitNode from './nodes/RateLimitNode';
import ActionNode from './nodes/ActionNode';
import DigitalInputNode from './nodes/DigitalInputNode';
import DigitalOutputNode from './nodes/DigitalOutputNode';
import LEDNode from './nodes/LEDNode';
import BuzzerNode from './nodes/BuzzerNode';
import RS485Node from './nodes/RS485Node';
import DashboardVideoNode from './nodes/DashboardVideoNode';
import DashboardMetricNode from './nodes/DashboardMetricNode';
import DashboardTextNode from './nodes/DashboardTextNode';
import DashboardLogNode from './nodes/DashboardLogNode';
import DebugNode from './nodes/DebugNode';
import DebugOutputNode from './nodes/DebugOutputNode';
import FunctionNode from './nodes/FunctionNode';
import CounterNode from './nodes/CounterNode';
import SnapshotNode from './nodes/SnapshotNode';
import ButtonEdge from './edges/ButtonEdge';

export const edgeTypes = {
  buttonEdge: ButtonEdge,
};

export const nodeTypes = {
  inputNode: InputNode,
  aiNode: AINode,
  logicNode: LogicNode,
  actionNode: ActionNode,
  digitalInputNode: DigitalInputNode,
  digitalOutputNode: DigitalOutputNode,
  ledNode: LEDNode,
  buzzerNode: BuzzerNode,
  rs485Node: RS485Node,
  dashboardVideoNode: DashboardVideoNode,
  dashboardMetricNode: DashboardMetricNode,
  dashboardTextNode: DashboardTextNode,
  dashboardLogNode: DashboardLogNode,
  debugNode: DebugNode,
  debugOutputNode: DebugOutputNode,
  functionNode: FunctionNode,
  rateLimitNode: RateLimitNode,
  counterNode: CounterNode,
  snapshotNode: SnapshotNode,
};
