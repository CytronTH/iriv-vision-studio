import React, { useRef, useCallback, useState } from 'react';
import { ReactFlow, Controls, Background, MiniMap, ReactFlowProvider } from '@xyflow/react';
import { MousePointer2, Hand, Play, ChevronRight, ChevronLeft, Plus } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import Sidebar from './Sidebar';
import DebugWebSocket from './DebugWebSocket';
import usePipelineStore from '../../store/usePipelineStore';

import { nodeTypes, edgeTypes } from './nodeTypes';

let id = 0;
const getId = () => `dndnode_${Date.now()}_${id++}`;

export default function PipelineBuilder({ projectId, onOpenWiki }) {
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = React.useState(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);
  
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
      
      if (type === 'debugOutputNode') {
        newNode.style = { width: 320, height: 350 };
      }

      addNode(newNode);
    },
    [reactFlowInstance, addNode],
  );

  // Tap-to-add node handler for mobile & desktop
  const handleTapAddNode = useCallback(
    (type) => {
      let position = { x: 100, y: 100 };
      if (reactFlowInstance) {
        const container = reactFlowWrapper.current?.getBoundingClientRect();
        const centerX = container ? container.width / 2 : 200;
        const centerY = container ? container.height / 2 : 200;
        const jitterX = (Math.random() - 0.5) * 40;
        const jitterY = (Math.random() - 0.5) * 40;
        position = reactFlowInstance.screenToFlowPosition({
          x: (container?.left || 0) + centerX + jitterX,
          y: (container?.top || 0) + centerY + jitterY,
        });
      }

      const newNode = {
        id: getId(),
        type,
        position,
        data: { label: `${type} node` },
      };

      if (type === 'debugOutputNode') {
        newNode.style = { width: 320, height: 350 };
      }

      addNode(newNode);
      setIsMobilePaletteOpen(false);
    },
    [reactFlowInstance, addNode]
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

  const styledNodes = React.useMemo(() => {
    return nodes
      .filter(node => !node.data?.isTutorialMock)
      .map(node => ({
        ...node,
        className: `${node.className || ''} ${node.data?.disabled ? 'node-disabled' : ''}`.trim()
      }));
  }, [nodes]);

  const mainEdges = React.useMemo(() => {
    return edges.filter(edge => !edge.data?.isTutorialMock);
  }, [edges]);

  return (
    <div className="flex h-full bg-gray-950 rounded-xl overflow-hidden border border-gray-800 shadow-2xl animate-in fade-in duration-500 relative">
      <ReactFlowProvider>
        <div className="flex-grow relative" ref={reactFlowWrapper}>
          
          {/* Mobile Floating "Add Node" Trigger Button */}
          <button
            onClick={() => setIsMobilePaletteOpen(true)}
            className="md:hidden absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-xl active:scale-95 transition-all"
          >
            <Plus size={16} />
            <span>Add Node</span>
          </button>

          {/* Floating Dock (Controls) */}
          <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 sm:gap-3 bg-gray-900/90 p-1.5 sm:p-2 rounded-2xl backdrop-blur-md border border-gray-700 shadow-2xl max-w-[95vw]">
            <div className="bg-gray-800 border border-gray-700 p-1 rounded-xl flex shadow-inner">
              <button 
                onClick={() => setIsSelectMode(false)}
                className={`p-1.5 sm:p-2 rounded-lg transition-all ${!isSelectMode ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                title="Pan Tool (Hand)"
              >
                <Hand size={18} className="sm:w-5 sm:h-5" />
              </button>
              <button 
                onClick={() => setIsSelectMode(true)}
                className={`p-1.5 sm:p-2 rounded-lg transition-all ${isSelectMode ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                title="Select Tool (Cursor)"
              >
                <MousePointer2 size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="w-px h-6 sm:h-8 bg-gray-700"></div>

            <button 
              onClick={handleDeploy}
              className="flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-lg shadow-green-900/50 transition-all active:scale-95 whitespace-nowrap"
            >
              <Play size={16} fill="currentColor" />
              <span>Deploy</span>
            </button>
          </div>

          <ReactFlow
            nodes={styledNodes}
            edges={mainEdges}
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
              className="hidden sm:block bg-gray-800 border-gray-700" 
            />
          </ReactFlow>
          <DebugWebSocket />
          
          {/* Desktop Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden md:flex absolute top-4 right-4 z-20 bg-gray-800 border border-gray-700 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
            title="Toggle Node Palette"
          >
            {isSidebarOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
        
        {/* Desktop Collapsible Sidebar Container */}
        <div className={`hidden md:flex transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${isSidebarOpen ? 'w-64' : 'w-0'}`}>
          <div className="w-64 shrink-0 flex h-full">
            <Sidebar onOpenWiki={onOpenWiki} onAddNode={handleTapAddNode} />
          </div>
        </div>

        {/* Mobile Node Palette Slide-in Drawer */}
        {isMobilePaletteOpen && (
          <div 
            className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobilePaletteOpen(false)}
          >
            <div 
              className="absolute right-0 top-0 bottom-0 w-72 max-w-[85vw] bg-gray-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <Sidebar 
                onOpenWiki={onOpenWiki} 
                onAddNode={handleTapAddNode} 
                onCloseMobile={() => setIsMobilePaletteOpen(false)} 
              />
            </div>
          </div>
        )}
      </ReactFlowProvider>
    </div>
  );
}
