import React, { useRef, useCallback, useState, useEffect } from 'react';
import { ReactFlow, Controls, Background, MiniMap, ReactFlowProvider } from '@xyflow/react';
import { MousePointer2, Hand, Play, ChevronRight, ChevronLeft, Plus, Activity, ChevronDown, Zap, RefreshCw, Check, AlertTriangle, Loader2, Download, Trash2, Terminal, Network, History, Wand2 } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import Sidebar from './Sidebar';
import DebugPanel from './DebugPanel';
import DebugWebSocket from './DebugWebSocket';
import usePipelineStore from '../../store/usePipelineStore';
import { useShallow } from 'zustand/react/shallow';
import ExportProjectModal from '../Home/ExportProjectModal';
import NodeSettingsSidebar from './NodeSettingsSidebar';
import NodeSuggestionMenu from './NodeSuggestionMenu';
import ProjectRevisionsModal from '../ProjectRevisionsModal';

import { nodeTypes, edgeTypes } from './nodeTypes';

const DEFAULT_NODE_NAMES = {
  inputNode: 'Input Source',
  aiNode: 'AI Model',
  logicNode: 'Logic Filter',
  actionNode: 'Action / Alert',
  functionNode: 'Function',
  transformNode: 'Transform',
  counterNode: 'Event Counter',
  flowCounterNode: 'Flow Counter',
  unitThroughputNode: 'Unit Throughput',
  targetTrackerNode: 'Target Tracker',
  forkliftZoneNode: 'Forklift Zone Monitor',
  shelfSlotMonitorNode: 'Shelf Slot Monitor',
  snapshotNode: 'Snapshot Node',
  databaseWriterNode: 'Database Writer',
  collectionWriterNode: 'Collection Writer',
  dashboardChartNode: 'Time-Series Output',
  dashboardLogNode: 'Log Feed',
  dashboardMetricNode: 'Number Output',
  dashboardTextNode: 'Text Output',
  dashboardVideoNode: 'Video Stream',
};

let id = 0;
const getId = () => `dndnode_${Date.now()}_${id++}`;

export default React.memo(function PipelineBuilder({ projectId, onOpenWiki }) {
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = React.useState(null);
  const [isSelectMode, setIsSelectMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [suggestionMenu, setSuggestionMenu] = useState(null);
  
  const { 
    nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, 
    setPipeline, setProjectId, showMetricsOverlay, toggleMetricsOverlay,
    advancedDebugMode, toggleAdvancedDebugMode,
    dirtyNodeIds, deployMode, setDeployMode, markAsDeployed,
    deleteNodes, deleteEdge, pipelineViewMode, setPipelineViewMode,
    syncCurrentPositions, autoSaveStatus,
    activeSidebarNodeId, setActiveSidebarNodeId, beautifyPipeline
  } = usePipelineStore(useShallow((state) => ({
    nodes: state.nodes,
    edges: state.edges,
    onNodesChange: state.onNodesChange,
    onEdgesChange: state.onEdgesChange,
    onConnect: state.onConnect,
    addNode: state.addNode,
    setPipeline: state.setPipeline,
    setProjectId: state.setProjectId,
    showMetricsOverlay: state.showMetricsOverlay,
    toggleMetricsOverlay: state.toggleMetricsOverlay,
    advancedDebugMode: state.advancedDebugMode,
    toggleAdvancedDebugMode: state.toggleAdvancedDebugMode,
    dirtyNodeIds: state.dirtyNodeIds,
    deployMode: state.deployMode,
    setDeployMode: state.setDeployMode,
    markAsDeployed: state.markAsDeployed,
    deleteNodes: state.deleteNodes,
    deleteEdge: state.deleteEdge,
    pipelineViewMode: state.pipelineViewMode,
    setPipelineViewMode: state.setPipelineViewMode,
    syncCurrentPositions: state.syncCurrentPositions,
    autoSaveStatus: state.autoSaveStatus,
    activeSidebarNodeId: state.activeSidebarNodeId,
    setActiveSidebarNodeId: state.setActiveSidebarNodeId,
    beautifyPipeline: state.beautifyPipeline,
  })));

  React.useEffect(() => {
    if (!projectId) return;
    setProjectId(projectId);
    // Fetch project data and initialize store
    fetch('/api/projects')
      .then(res => res.json())
      .then(projects => {
        const project = projects.find(p => p.id === projectId);
        if (project) {
          setCurrentProject(project);
          if (project.pipeline) {
            setPipeline(project.pipeline.nodes || [], project.pipeline.edges || []);
          }
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
      if (typeof type === 'undefined' || !type || !reactFlowInstance) {
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
        data: { label: DEFAULT_NODE_NAMES[type] || `${type} node` },
      };
      
      if (type === 'debugOutputNode') {
        newNode.style = { width: 320, height: 350 };
      }

      addNode(newNode);
    },
    [reactFlowInstance, addNode],
  );

  const handleConnectEnd = useCallback(
    (event, connectionState) => {
      if (!connectionState.isValid) {
        if (reactFlowInstance && reactFlowWrapper.current) {
          const { clientX, clientY } = ('touches' in event ? event.touches[0] : event);
          const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
          
          const menuPosition = {
            top: clientY - reactFlowBounds.top,
            left: clientX - reactFlowBounds.left,
          };
          
          const flowPosition = reactFlowInstance.screenToFlowPosition({
            x: clientX,
            y: clientY,
          });

          setSuggestionMenu({
            position: menuPosition,
            flowPosition,
            sourceNodeId: connectionState.fromNode?.id,
            sourceNodeType: connectionState.fromNode?.type,
            sourceHandleId: connectionState.fromHandle?.id,
            sourceHandleType: connectionState.fromHandle?.type,
          });
        }
      }
    },
    [reactFlowInstance]
  );

  const handleSuggestionSelect = useCallback((type) => {
    if (!suggestionMenu) return;

    const newNodeId = getId();
    const newNode = {
      id: newNodeId,
      type,
      position: suggestionMenu.flowPosition,
      data: { label: DEFAULT_NODE_NAMES[type] || `${type} node` },
    };

    if (type === 'debugOutputNode') {
      newNode.style = { width: 320, height: 350 };
    }

    addNode(newNode);

    if (suggestionMenu.sourceNodeId) {
      // Connect to the new node based on what handle we dragged from
      const isFromSource = suggestionMenu.sourceHandleType === 'source';
      onConnect({
        source: isFromSource ? suggestionMenu.sourceNodeId : newNodeId,
        target: isFromSource ? newNodeId : suggestionMenu.sourceNodeId,
        sourceHandle: isFromSource ? suggestionMenu.sourceHandleId : null,
        targetHandle: isFromSource ? null : suggestionMenu.sourceHandleId,
      });
    }

    setSuggestionMenu(null);
  }, [suggestionMenu, addNode, onConnect]);

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
        data: { label: DEFAULT_NODE_NAMES[type] || `${type} node` },
      };

      if (type === 'debugOutputNode') {
        newNode.style = { width: 320, height: 350 };
      }

      addNode(newNode);
      setIsMobilePaletteOpen(false);
    },
    [reactFlowInstance, addNode]
  );

  const [isDeploying, setIsDeploying] = useState(false);
  const [deployMenuOpen, setDeployMenuOpen] = useState(false);
  const [isRevisionsModalOpen, setIsRevisionsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const deployMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (deployMenuRef.current && !deployMenuRef.current.contains(e.target)) {
        setDeployMenuOpen(false);
      }
    };
    if (deployMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [deployMenuOpen]);

  const handleDeploy = async (overrideMode = null) => {
    if (dirtyNodeIds.length === 0 || isDeploying) return;
    const activeMode = overrideMode || deployMode || 'modified_nodes';
    setIsDeploying(true);
    setDeployMenuOpen(false);
    try {
      const payload = {
        project_id: projectId,
        nodes,
        edges,
        deploy_mode: activeMode
      };
      const response = await fetch(`http://${window.location.hostname}:8000/api/pipeline/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        markAsDeployed(nodes, edges);
        const modeLabel = 
          data.mode === 'none' ? 'Already up to date' :
          data.mode === 'router_only' ? '⚡ Logic Hot-Reloaded (0s downtime)' :
          data.mode === 'ai_params_only' ? '⚡ AI Params Hot-Updated (0s downtime)' :
          data.mode === 'hybrid_hot' ? '⚡ Logic & AI Hot-Reloaded (0s downtime)' :
          data.mode === 'flow_restart' ? '🔄 Flow Restarted' :
          '✅ Full Pipeline Deployed';
        setToastMessage({ type: 'success', text: modeLabel });
      } else {
        setToastMessage({ type: 'error', text: data.message || 'Failed to deploy pipeline.' });
      }
    } catch (err) {
      console.error(err);
      setToastMessage({ type: 'error', text: 'Error connecting to backend.' });
    } finally {
      setIsDeploying(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const clipboardRef = useRef({ nodes: [], edges: [] });

  // Handle keyboard shortcuts (Delete / Backspace, v, h, copy, paste, cut)
  useEffect(() => {
    const handleKeyDown = (event) => {
      const activeEl = document.activeElement;
      const tag = activeEl?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        activeEl?.isContentEditable ||
        activeEl?.closest('.nodrag')
      ) {
        return;
      }

      if (event.key === 'Escape') {
        setSuggestionMenu(null);
        setActiveSidebarNodeId(null);
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedNodes = nodes.filter(n => n.selected && !n.data?.isTutorialMock);
        const selectedEdges = edges.filter(e => e.selected && !e.data?.isTutorialMock);

        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          event.preventDefault();
          if (selectedNodes.length > 0) {
            deleteNodes(selectedNodes.map(n => n.id));
          }
          if (selectedEdges.length > 0) {
            selectedEdges.forEach(e => deleteEdge(e.id));
          }
        }
      } else if ((event.key === 'c' || event.key === 'C') && (event.metaKey || event.ctrlKey)) {
        const selectedNodes = nodes.filter(n => n.selected && !n.data?.isTutorialMock);
        const selectedEdges = edges.filter(e => e.selected && !e.data?.isTutorialMock);
        if (selectedNodes.length > 0) {
          event.preventDefault();
          clipboardRef.current = { 
            nodes: selectedNodes.map(n => ({ ...n })),
            edges: selectedEdges.map(e => ({ ...e }))
          };
        }
      } else if ((event.key === 'x' || event.key === 'X') && (event.metaKey || event.ctrlKey)) {
        const selectedNodes = nodes.filter(n => n.selected && !n.data?.isTutorialMock);
        const selectedEdges = edges.filter(e => e.selected && !e.data?.isTutorialMock);
        if (selectedNodes.length > 0) {
          event.preventDefault();
          clipboardRef.current = { 
            nodes: selectedNodes.map(n => ({ ...n })),
            edges: selectedEdges.map(e => ({ ...e }))
          };
          deleteNodes(selectedNodes.map(n => n.id));
        }
      } else if (event.key === 'v' || event.key === 'V') {
        if (event.metaKey || event.ctrlKey) {
          if (clipboardRef.current.nodes.length > 0) {
            event.preventDefault();
            
            onNodesChange(nodes.filter(n => n.selected).map(n => ({ id: n.id, type: 'select', selected: false })));
            
            const idMap = {};
            const newNodes = clipboardRef.current.nodes.map(n => {
              const newId = getId();
              idMap[n.id] = newId;
              return {
                ...n,
                id: newId,
                position: { x: n.position.x + 30, y: n.position.y + 30 },
                selected: true,
              };
            });
            
            newNodes.forEach(n => addNode(n));
            
            if (clipboardRef.current.edges) {
              clipboardRef.current.edges.forEach(e => {
                if (idMap[e.source] && idMap[e.target]) {
                  onConnect({
                    source: idMap[e.source],
                    target: idMap[e.target],
                    sourceHandle: e.sourceHandle,
                    targetHandle: e.targetHandle
                  });
                }
              });
            }
            
            clipboardRef.current.nodes = clipboardRef.current.nodes.map(n => ({
              ...n,
              position: { x: n.position.x + 30, y: n.position.y + 30 }
            }));
          }
        } else {
          setIsSelectMode(true);
        }
      } else if (event.key === 'h' || event.key === 'H') {
        if (!event.metaKey && !event.ctrlKey) {
          setIsSelectMode(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, deleteNodes, deleteEdge, onNodesChange, addNode, onConnect]);

  const selectedNodesCount = React.useMemo(() => {
    return nodes.filter(n => n.selected && !n.data?.isTutorialMock).length;
  }, [nodes]);

  const activeSidebarNode = React.useMemo(() => {
    return nodes.find(n => n.id === activeSidebarNodeId && !n.data?.isTutorialMock);
  }, [nodes, activeSidebarNodeId]);

  const handleNodeClick = useCallback((event, node) => {
    // Single click only selects the node.
    // If clicking on a different node, close sidebar if open.
    if (activeSidebarNodeId && activeSidebarNodeId !== node.id) {
      setActiveSidebarNodeId(null);
    }
  }, [activeSidebarNodeId]);

  const handleNodeDoubleClick = useCallback((event, node) => {
    event?.stopPropagation?.();
    if (node.data?.isTutorialMock) return;
    
    if (node.type === 'debugNode') {
      setIsDebugPanelOpen(true);
      setActiveSidebarNodeId(null);
    } else {
      setActiveSidebarNodeId(node.id);
    }

    // Ensure the double-clicked node is exclusively selected
    onNodesChange(
      nodes.map(n => ({
        id: n.id,
        type: 'select',
        selected: n.id === node.id
      }))
    );
  }, [nodes, onNodesChange]);

  // Auto-close sidebar if active node was deleted or removed
  useEffect(() => {
    if (activeSidebarNodeId && !nodes.some(n => n.id === activeSidebarNodeId)) {
      setActiveSidebarNodeId(null);
    }
  }, [nodes, activeSidebarNodeId]);

  // Reset active sidebar on project or view mode change
  useEffect(() => {
    setActiveSidebarNodeId(null);
  }, [projectId, pipelineViewMode]);

  // Close sidebar if multi-selection occurs
  useEffect(() => {
    if (selectedNodesCount > 1 && activeSidebarNodeId) {
      setActiveSidebarNodeId(null);
    }
  }, [selectedNodesCount, activeSidebarNodeId]);

  const isNodeInvalid = useCallback((node) => {
    if (!node || !node.data) return false;
    const { type, data } = node;
    if (data.isTutorialMock) return false;
    
    switch (type) {
      case 'inputNode':
      case 'aiNode':
        return !data.entityId && !data.sourcePath;
      case 'actionNode':
      case 'dashboardMetricNode':
      case 'dashboardTextNode':
      case 'dashboardChartNode':
        return !data.sourcePath && !data.entityId;
      case 'logicNode':
        return (!data.expression || !data.expression.trim()) && !data.rule && !data.condition;
      case 'shelfSlotMonitorNode':
        return !data.slots || data.slots.length === 0;
      case 'forkliftZoneNode':
        return !data.zones || data.zones.length === 0;
      case 'rateLimitNode':
        return !data.interval;
      default:
        return false; // Assume valid by default
    }
  }, []);

  const styledNodes = React.useMemo(() => {
    return nodes.reduce((acc, node) => {
      if (node.data?.isTutorialMock) return acc;
      
      const isDirty = dirtyNodeIds.includes(node.id);
      const isInvalid = isNodeInvalid(node);
      const isDisabled = node.data?.disabled;
      
      let baseClassName = node.className || '';
      baseClassName = baseClassName.replace('node-disabled', '').replace('node-dirty', '').replace('node-invalid', '').trim();
      // Only keep a single space between classes
      baseClassName = baseClassName.replace(/\s+/g, ' ');
      
      const targetClassName = `${baseClassName} ${isDisabled ? 'node-disabled' : ''} ${isDirty ? 'node-dirty' : ''} ${isInvalid ? 'node-invalid' : ''}`.trim().replace(/\s+/g, ' ');
      
      // Prevent creating a new node object if nothing has actually changed
      if (node.className === targetClassName && node.data?.viewMode === pipelineViewMode && node.data?.isDirty === isDirty && node.data?.isInvalid === isInvalid) {
        acc.push(node);
      } else {
        acc.push({ 
          ...node, 
          className: targetClassName, 
          data: { ...node.data, viewMode: pipelineViewMode, isDirty, isInvalid } 
        });
      }
      return acc;
    }, []);
  }, [nodes, dirtyNodeIds, pipelineViewMode, isNodeInvalid]);

  const mainEdges = React.useMemo(() => {
    return edges.filter(edge => !edge.data?.isTutorialMock);
  }, [edges]);

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-950 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl animate-in fade-in duration-500 relative">
      <ReactFlowProvider>
        {/* Desktop Collapsible Sidebar Container (Moved to Left) */}
        <div className={`hidden md:flex transition-all duration-300 ease-in-out overflow-hidden shrink-0 border-r border-gray-200 dark:border-gray-800 ${isSidebarOpen ? 'w-64' : 'w-0'}`}>
          <div className="w-64 shrink-0 flex h-full">
            <Sidebar onOpenWiki={onOpenWiki} onAddNode={handleTapAddNode} />
          </div>
        </div>

        <div className="flex-grow relative" ref={reactFlowWrapper}>
          
          {/* Toast Notification Banner */}
          {toastMessage && (
            <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-200 border ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200 shadow-emerald-950/50'
                : 'bg-rose-950/90 border-rose-500 text-rose-200 shadow-rose-950/50'
            }`}>
              {toastMessage.type === 'success' ? <Check size={16} className="text-emerald-400" /> : <AlertTriangle size={16} className="text-rose-400" />}
              <span>{toastMessage.text}</span>
            </div>
          )}

          {/* Mobile Floating "Add Node" Trigger Button */}
          <button
            onClick={() => setIsMobilePaletteOpen(true)}
            className="md:hidden absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-xl active:scale-95 transition-all"
          >
            <Plus size={16} />
            <span>Add Node</span>
          </button>

          {/* Floating Dock (Controls) */}
          <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 sm:gap-3 bg-gray-100/90 dark:bg-gray-900/90 p-1.5 sm:p-2 rounded-2xl backdrop-blur-md border border-gray-300 dark:border-gray-700 shadow-2xl max-w-[95vw]">
            <div className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-1 rounded-xl flex shadow-inner">
              <button 
                onClick={() => setIsSelectMode(false)}
                className={`p-1.5 sm:p-2 rounded-lg transition-all ${!isSelectMode ? 'bg-gray-300 dark:bg-gray-700 text-white shadow' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
                title="Pan Tool (Hand)"
              >
                <Hand size={18} className="sm:w-5 sm:h-5" />
              </button>
              <button 
                onClick={() => setIsSelectMode(true)}
                className={`p-1.5 sm:p-2 rounded-lg transition-all ${isSelectMode ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
                title="Select Tool (Cursor)"
              >
                <MousePointer2 size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="w-px h-6 sm:h-8 bg-gray-300 dark:bg-gray-700"></div>

            {/* View Mode Toggle */}
            <div className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-1 rounded-xl flex shadow-inner">
              <button 
                onClick={() => setPipelineViewMode('inline')}
                className={`p-1.5 sm:p-2 rounded-lg transition-all text-xs font-semibold flex items-center gap-1 ${pipelineViewMode === 'inline' ? 'bg-gray-300 dark:bg-gray-700 text-white shadow' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
                title="Inline View: Show settings on the nodes"
              >
                <span className="hidden md:inline">Inline</span>
              </button>
              <button 
                onClick={() => setPipelineViewMode('compact')}
                className={`p-1.5 sm:p-2 rounded-lg transition-all text-xs font-semibold flex items-center gap-1 ${pipelineViewMode === 'compact' ? 'bg-gray-300 dark:bg-gray-700 text-white shadow' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
                title="Compact View: Settings in sidebar"
              >
                <span className="hidden md:inline">Sidebar</span>
              </button>
            </div>

            {/* Layout Auto-Save Indicator */}
            {autoSaveStatus !== 'idle' && (
              <div 
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-gray-200/80 dark:bg-gray-800/80 border border-gray-300/80 dark:border-gray-700/80 animate-in fade-in zoom-in-95 duration-150"
                title={autoSaveStatus === 'saving' ? 'Auto-saving node layout...' : 'Layout saved to device'}
              >
                {autoSaveStatus === 'saving' ? (
                  <>
                    <Loader2 size={13} className="animate-spin text-blue-400" />
                    <span className="hidden xl:inline text-gray-600 font-medium dark:text-gray-400">Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="hidden xl:inline text-emerald-400 font-medium">Saved</span>
                  </>
                )}
              </div>
            )}

            <div className="w-px h-6 sm:h-8 bg-gray-300 dark:bg-gray-700"></div>

            {/* Toggle Live Telemetry Overlay */}
            <button
              onClick={toggleMetricsOverlay}
              className={`p-1.5 sm:p-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all ${
                showMetricsOverlay 
                  ? 'bg-purple-950/80 border border-purple-600 text-purple-300 shadow-md shadow-purple-950/40' 
                  : 'bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
              title="Toggle Live CPU & NPU Performance Overlay on Nodes"
            >
              <Activity size={16} className={showMetricsOverlay ? 'text-purple-400 animate-pulse' : ''} />
              <span className="hidden md:inline">Telemetry</span>
            </button>

            {/* Toggle Advanced Debug Mode */}
            <button
              onClick={toggleAdvancedDebugMode}
              className={`p-1.5 sm:p-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all ${
                advancedDebugMode 
                  ? 'bg-blue-950/80 border border-blue-600 text-blue-300 shadow-md shadow-blue-950/40' 
                  : 'bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
              title="Toggle Advanced Debug Mode (Show payloads on edges)"
            >
              <Terminal size={16} className={advancedDebugMode ? 'text-blue-400' : ''} />
              <span className="hidden md:inline">Debug Flow</span>
            </button>

            {/* Auto-Layout (Beautify) */}
            <button
              onClick={beautifyPipeline}
              className="p-1.5 sm:p-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 hover:text-white hover:bg-gray-750 transition-all active:scale-95 dark:text-gray-300"
              title="Auto-Layout Nodes (Beautify)"
            >
              <Wand2 size={16} className="text-fuchsia-400" />
              <span className="hidden md:inline">Beautify</span>
            </button>

            {/* Export Project Quick Action */}
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="p-1.5 sm:p-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 hover:text-white hover:bg-gray-750 transition-all active:scale-95 dark:text-gray-300"
              title="Export / Backup this Project"
            >
              <Download size={16} className="text-blue-400" />
              <span className="hidden md:inline">Export</span>
            </button>

            {/* Revisions / History Button */}
            <button
              onClick={() => setIsRevisionsModalOpen(true)}
              className="p-1.5 sm:p-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 hover:text-white hover:bg-gray-750 transition-all active:scale-95 dark:text-gray-300"
              title="Version History / Restore"
            >
              <History size={16} className="text-amber-400" />
              <span className="hidden md:inline">History</span>
            </button>

            <div className="w-px h-6 sm:h-8 bg-gray-300 dark:bg-gray-700"></div>

            {/* Split Deploy Button (Node-RED Style) */}
            <div className="relative flex items-stretch" ref={deployMenuRef}>
              <button 
                onClick={() => handleDeploy()}
                disabled={isDeploying || dirtyNodeIds.length === 0}
                className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-l-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shadow-lg ${
                  dirtyNodeIds.length > 0 && !isDeploying
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white shadow-green-900/50 active:scale-95 cursor-pointer'
                    : 'bg-gray-200/80 dark:bg-gray-800/80 text-gray-500 border-y border-l border-gray-300/60 dark:border-gray-700/60 cursor-not-allowed opacity-50 shadow-none'
                } dark:text-gray-500`}
                title={
                  dirtyNodeIds.length === 0
                    ? 'No modified nodes to deploy'
                    : `Deploy: ${deployMode === 'modified_nodes' ? 'Modified Nodes (Hot Reload)' : deployMode === 'modified_flows' ? 'Modified Flows' : 'Full Restart'}`
                }
              >
                {isDeploying ? (
                  <Loader2 size={16} className="animate-spin text-gray-900 dark:text-white" />
                ) : deployMode === 'modified_nodes' ? (
                  <Zap size={16} className={dirtyNodeIds.length > 0 ? "fill-current text-white" : "text-gray-500 dark:text-gray-500"} />
                ) : deployMode === 'modified_flows' ? (
                  <RefreshCw size={16} className={dirtyNodeIds.length > 0 ? "text-amber-400" : "text-gray-500 dark:text-gray-500"} />
                ) : (
                  <Play size={16} fill="currentColor" className={dirtyNodeIds.length > 0 ? "" : "text-gray-500 dark:text-gray-500"} />
                )}
                <span>
                  {isDeploying ? 'Deploying...' : dirtyNodeIds.length > 0 ? `Deploy (${dirtyNodeIds.length})` : 'Deploy'}
                </span>
              </button>

              {/* Dropdown Menu Arrow */}
              <button
                onClick={() => setDeployMenuOpen(prev => !prev)}
                disabled={isDeploying || dirtyNodeIds.length === 0}
                className={`px-2 py-2 sm:py-2.5 rounded-r-xl border-l transition-all ${
                  dirtyNodeIds.length > 0 && !isDeploying
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-700/50 cursor-pointer'
                    : 'bg-gray-200/80 dark:bg-gray-800/80 text-gray-500 border-t border-b border-r border-l border-gray-300/60 dark:border-gray-700/60 cursor-not-allowed opacity-50 shadow-none'
                } dark:text-gray-500`}
                title={dirtyNodeIds.length === 0 ? "No modified nodes to deploy" : "Choose Deploy Mode (Node-RED Style)"}
              >
                <ChevronDown size={14} className={`transition-transform duration-200 ${deployMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Popup */}
              {deployMenuOpen && dirtyNodeIds.length > 0 && (
                <div 
                  className="absolute bottom-full mb-2 right-0 w-72 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
                >
                  <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider px-3 py-1.5 border-b border-gray-200 dark:border-gray-800 mb-1 dark:text-gray-400">
                    Deploy Options
                  </div>

                  {/* Option 1: Modified Nodes */}
                  <button
                    onClick={() => {
                      setDeployMode('modified_nodes');
                      handleDeploy('modified_nodes');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-start gap-2.5 transition-all ${
                      deployMode === 'modified_nodes' 
                        ? 'bg-emerald-950/70 border border-emerald-600/50 text-white' 
                        : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Zap size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                    <div className="flex-grow min-w-0">
                      <div className="text-xs font-semibold flex items-center justify-between">
                        <span>Modified Nodes</span>
                        {deployMode === 'modified_nodes' && <Check size={14} className="text-emerald-400" />}
                      </div>
                      <div className="text-[11px] text-gray-600 leading-tight mt-0.5 dark:text-gray-400">
                        Hot-reload changed logic & AI params (Zero video downtime)
                      </div>
                    </div>
                  </button>

                  {/* Option 2: Modified Flows */}
                  <button
                    onClick={() => {
                      setDeployMode('modified_flows');
                      handleDeploy('modified_flows');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-start gap-2.5 transition-all mt-1 ${
                      deployMode === 'modified_flows' 
                        ? 'bg-amber-950/70 border border-amber-600/50 text-white' 
                        : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <RefreshCw size={16} className="text-amber-400 mt-0.5 shrink-0" />
                    <div className="flex-grow min-w-0">
                      <div className="text-xs font-semibold flex items-center justify-between">
                        <span>Modified Flows</span>
                        {deployMode === 'modified_flows' && <Check size={14} className="text-amber-400" />}
                      </div>
                      <div className="text-[11px] text-gray-600 leading-tight mt-0.5 dark:text-gray-400">
                        Restart only changed camera stream flows
                      </div>
                    </div>
                  </button>

                  {/* Option 3: Full Deploy */}
                  <button
                    onClick={() => {
                      setDeployMode('full');
                      handleDeploy('full');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-start gap-2.5 transition-all mt-1 ${
                      deployMode === 'full' 
                        ? 'bg-rose-950/70 border border-rose-600/50 text-white' 
                        : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Play size={16} className="text-rose-400 mt-0.5 shrink-0" />
                    <div className="flex-grow min-w-0">
                      <div className="text-xs font-semibold flex items-center justify-between">
                        <span>Full Deploy</span>
                        {deployMode === 'full' && <Check size={14} className="text-rose-400" />}
                      </div>
                      <div className="text-[11px] text-gray-600 leading-tight mt-0.5 dark:text-gray-400">
                        Full restart of GStreamer & NPU engines
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Floating multi-node selection pill with quick delete */}
          {selectedNodesCount > 1 && (
            <div className="absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-gray-100/95 dark:bg-gray-900/95 border border-blue-500/70 text-blue-200 px-3.5 py-1.5 rounded-full text-xs font-medium shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0"></span>
              <span><strong>{selectedNodesCount}</strong> nodes selected</span>
              <span className="text-gray-400 dark:text-gray-600">•</span>
              <button
                onClick={() => {
                  const selectedIds = nodes.filter(n => n.selected && !n.data?.isTutorialMock).map(n => n.id);
                  deleteNodes(selectedIds);
                }}
                className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-semibold cursor-pointer transition-colors hover:underline"
                title="Delete selected nodes (Delete / Backspace)"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            </div>
          )}

          <ReactFlow
            nodes={styledNodes}
            edges={mainEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={() => syncCurrentPositions()}
            onSelectionDragStop={() => syncCurrentPositions()}
            onConnect={onConnect}
            onConnectEnd={handleConnectEnd}
            onPaneClick={() => {
              setSuggestionMenu(null);
              setActiveSidebarNodeId(null);
            }}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            zoomOnDoubleClick={false}
            onNodesDelete={(deleted) => {
              deleteNodes(deleted.map(n => n.id));
            }}
            onEdgesDelete={(deleted) => {
              deleted.forEach(e => deleteEdge(e.id));
            }}
            deleteKeyCode={['Backspace', 'Delete']}
            selectionKeyCode={['Shift']}
            multiSelectionKeyCode={['Control', 'Meta', 'Shift']}
            panOnDrag={isSelectMode ? [1, 2] : true}
            panActivationKeyCode="Space"
            selectionOnDrag={isSelectMode}
            selectionMode="partial"
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onlyRenderVisibleElements={false}
            fitView
            minZoom={0.05}
            className="bg-gray-100 dark:bg-gray-900"
          >
            <Background color="#374151" gap={16} />
            <Controls className="bg-gray-200 dark:bg-gray-800 border-gray-300 dark:border-gray-700 fill-white text-gray-900 dark:text-white" />
            <MiniMap 
              nodeColor="#3b82f6" 
              maskColor="rgba(17, 24, 39, 0.7)"
              className="hidden sm:block bg-gray-200 dark:bg-gray-800 border-gray-300 dark:border-gray-700" 
            />
          </ReactFlow>
          
          {suggestionMenu && (
            <NodeSuggestionMenu
              position={suggestionMenu.position}
              sourceNodeType={suggestionMenu.sourceNodeType}
              sourceHandleType={suggestionMenu.sourceHandleType}
              onSelect={handleSuggestionSelect}
              onClose={() => setSuggestionMenu(null)}
            />
          )}

          <DebugWebSocket />
          
          {/* Desktop Sidebar Toggle Button (Moved to Left) */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden md:flex absolute top-4 left-4 z-20 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 p-2 rounded-full shadow-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors dark:text-white"
            title="Toggle Node Palette"
          >
            {isSidebarOpen ? <ChevronLeft size={20} /> : <Network size={20} />}
          </button>

          {/* Desktop Debug Panel Toggle Button */}
          <button
            onClick={() => setIsDebugPanelOpen(!isDebugPanelOpen)}
            className="hidden md:flex absolute top-4 right-4 z-20 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 p-2 rounded-full shadow-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors dark:text-white"
            title="Toggle Debug Panel"
          >
            {isDebugPanelOpen ? <ChevronRight size={20} /> : <Terminal size={20} className={nodes.some(n => n.type === 'debugNode' && n.data?.outputType === 'text') ? 'text-purple-400' : ''} />}
          </button>
        </div>
        
        {/* Node Settings Sidebar */}
        <NodeSettingsSidebar 
          selectedNodeId={activeSidebarNodeId} 
          isOpen={!!activeSidebarNode && selectedNodesCount <= 1}
          onClose={() => {
            setActiveSidebarNodeId(null);
          }} 
        />

        {/* Debug Panel Container (Right) */}
        <DebugPanel isOpen={isDebugPanelOpen} onClose={() => setIsDebugPanelOpen(false)} />

        {/* Mobile Node Palette Slide-in Drawer */}
        {isMobilePaletteOpen && (
          <div 
            className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobilePaletteOpen(false)}
          >
            <div 
              className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-gray-100 dark:bg-gray-900 shadow-2xl flex flex-col animate-in slide-in-from-left duration-200"
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
        <ExportProjectModal 
          project={currentProject}
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
        />
        {/* Project Revisions / History Modal */}
        <ProjectRevisionsModal
          isOpen={isRevisionsModalOpen}
          onClose={() => setIsRevisionsModalOpen(false)}
          projectId={currentProject?.id}
          onRestoreSuccess={() => window.location.reload()}
        />
      </ReactFlowProvider>
    </div>
  );
});
