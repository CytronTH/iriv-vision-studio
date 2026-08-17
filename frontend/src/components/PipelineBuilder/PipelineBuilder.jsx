import React, { useRef, useCallback, useState } from 'react';
import { ReactFlow, Controls, Background, MiniMap, ReactFlowProvider } from '@xyflow/react';
import { MousePointer2, Hand, Play } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import Sidebar from './Sidebar';
import DebugPanel from './DebugPanel';
import usePipelineStore from '../../store/usePipelineStore';

// Import custom nodes
import InputNode from './nodes/InputNode';
import AINode from './nodes/AINode';
import LogicNode from './nodes/LogicNode';
import ActionNode from './nodes/ActionNode';
import DigitalInputNode from './nodes/DigitalInputNode';
import DigitalOutputNode from './nodes/DigitalOutputNode';
import LEDNode from './nodes/LEDNode';
import BuzzerNode from './nodes/BuzzerNode';
import RS485Node from './nodes/RS485Node';
import DashboardVideoNode from './nodes/DashboardVideoNode';
import DashboardMetricNode from './nodes/DashboardMetricNode';
import DashboardTextNode from './nodes/DashboardTextNode';
import DebugNode from './nodes/DebugNode';
import ButtonEdge from './edges/ButtonEdge';

const edgeTypes = {
  buttonEdge: ButtonEdge,
};

const nodeTypes = {
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
  debugNode: DebugNode,
};

let id = 0;
const getId = () => `dndnode_${Date.now()}_${id++}`;

export default function PipelineBuilder({ projectId }) {
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = React.useState(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setPipeline, setProjectId } = usePipelineStore();

  React.useEffect(() => {
    if (!projectId) return;
    setProjectId(projectId);
    // Fetch project data and initialize store
    fetch('/api/projects')
      .then(res => res.json())
      .then(projects => {
        const project = projects.find(p => p.id === projectId);
        if (project && project.pipeline) {
          setPipeline(project.pipeline.nodes || [], project.pipeline.edges || []);
        } else {
          setPipeline([
            { id: 'start', type: 'inputNode', position: { x: 50, y: 150 }, data: { label: 'Camera Input' } }
          ], []);
        }
      });
  }, [projectId, setPipeline]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const newNode = {
        id: getId(),
        type,
        position,
        data: { label: `${type} node` },
      };

      addNode(newNode);
    },
    [reactFlowInstance, addNode],
  );

  const handleDeploy = async () => {
    try {
      const payload = { project_id: projectId, nodes, edges };
      const response = await fetch(`http://${window.location.hostname}:8000/api/pipeline/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        alert('Pipeline deployed successfully!');
      } else {
        alert('Failed to deploy pipeline.');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend.');
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] bg-gray-950 rounded-xl overflow-hidden border border-gray-800 shadow-2xl animate-in fade-in duration-500">
      <ReactFlowProvider>
        <div className="flex-grow relative" ref={reactFlowWrapper}>
          
          {/* Top Bar overlays */}
          <div className="absolute top-4 right-4 z-10 flex gap-3">
            <div className="bg-gray-800 border border-gray-700 p-1 rounded-lg flex shadow-lg">
              <button 
                onClick={() => setIsSelectMode(false)}
                className={`p-1.5 rounded transition-colors ${!isSelectMode ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                title="Pan Tool (Hand)"
              >
                <Hand size={18} />
              </button>
              <button 
                onClick={() => setIsSelectMode(true)}
                className={`p-1.5 rounded transition-colors ${isSelectMode ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                title="Select Tool (Cursor)"
              >
                <MousePointer2 size={18} />
              </button>
            </div>

            <button 
              onClick={handleDeploy}
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white px-4 py-2 rounded-lg font-semibold shadow-lg shadow-green-900/50 transition-all active:scale-95"
            >
              <Play size={18} fill="currentColor" />
              Deploy Pipeline
            </button>
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            panOnDrag={!isSelectMode}
            selectionOnDrag={isSelectMode}
            selectionMode="partial"
            fitView
            className="bg-gray-900"
          >
            <Background color="#374151" gap={16} />
            <Controls className="bg-gray-800 border-gray-700 fill-white text-white" />
            <MiniMap 
              nodeColor="#3b82f6" 
              maskColor="rgba(17, 24, 39, 0.7)"
              className="bg-gray-800 border-gray-700" 
            />
          </ReactFlow>
          <DebugPanel projectId={projectId} />
        </div>
        <Sidebar />
      </ReactFlowProvider>
    </div>
  );
}
