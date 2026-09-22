import React, { memo } from 'react';
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
import DashboardChartNode from './nodes/DashboardChartNode';
import DebugNode from './nodes/DebugNode';
import DebugOutputNode from './nodes/DebugOutputNode';
import FunctionNode from './nodes/FunctionNode';
import CounterNode from './nodes/CounterNode';
import FlowCounterNode from './nodes/FlowCounterNode';
import ShelfSlotMonitorNode from './nodes/ShelfSlotMonitorNode';
import ForkliftZoneNode from './nodes/ForkliftZoneNode';
import SnapshotNode from './nodes/SnapshotNode';
import ButtonEdge from './edges/ButtonEdge';

export const edgeTypes = {
  buttonEdge: memo(ButtonEdge),
};

export const nodeTypes = {
  inputNode: memo(InputNode),
  aiNode: memo(AINode),
  logicNode: memo(LogicNode),
  actionNode: memo(ActionNode),
  digitalInputNode: memo(DigitalInputNode),
  digitalOutputNode: memo(DigitalOutputNode),
  ledNode: memo(LEDNode),
  buzzerNode: memo(BuzzerNode),
  rs485Node: memo(RS485Node),
  dashboardVideoNode: memo(DashboardVideoNode),
  dashboardMetricNode: memo(DashboardMetricNode),
  dashboardTextNode: memo(DashboardTextNode),
  dashboardLogNode: memo(DashboardLogNode),
  dashboardChartNode: memo(DashboardChartNode),
  debugNode: memo(DebugNode),
  debugOutputNode: memo(DebugOutputNode),
  functionNode: memo(FunctionNode),
  rateLimitNode: memo(RateLimitNode),
  counterNode: memo(CounterNode),
  flowCounterNode: memo(FlowCounterNode),
  shelfSlotMonitorNode: memo(ShelfSlotMonitorNode),
  forkliftZoneNode: memo(ForkliftZoneNode),
  snapshotNode: memo(SnapshotNode),
};
