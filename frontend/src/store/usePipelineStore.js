import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import dagre from 'dagre';

const initialNodes = [
  { id: 'start', type: 'inputNode', position: { x: 50, y: 150 }, data: { label: 'Camera Input' } },
];

const cleanNodeData = (data) => {
  if (!data || typeof data !== 'object') return {};
  const { selected, dragging, position, positionAbsolute, width, height, isPaused, positions, viewMode, isDirty, isInvalid, ...rest } = data;
  return rest;
};

const areDataEqual = (d1, d2) => {
  if (d1 === d2) return true;
  try {
    const c1 = cleanNodeData(d1);
    const c2 = cleanNodeData(d2);
    const keys1 = Object.keys(c1);
    const keys2 = Object.keys(c2);
    if (keys1.length !== keys2.length) return false;
    for (let i = 0; i < keys1.length; i++) {
      const key = keys1[i];
      const val1 = c1[key];
      const val2 = c2[key];
      if (val1 !== val2) {
        if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
          if (JSON.stringify(val1) !== JSON.stringify(val2)) return false;
        } else {
          return false;
        }
      }
    }
    return true;
  } catch (e) {
    return false;
  }
};

const getDirtyNodeIds = (currentNodes, currentEdges, deployedNodes, deployedEdges) => {
  if (!deployedNodes || deployedNodes.length === 0) {
    return currentNodes.filter(n => !n.data?.isTutorialMock).map(n => n.id);
  }
  
  const deployedMap = new Map(deployedNodes.map(n => [n.id, n]));
  const dirtyIds = new Set();

  // Edge sets comparison
  const edgeKey = (e) => `${e.source}->${e.target}:${e.sourceHandle || ''}:${e.targetHandle || ''}`;
  const deployedEdgeKeys = new Set(deployedEdges.map(edgeKey));
  const currentEdgeKeys = new Set(currentEdges.map(edgeKey));

  // If edges were added or removed, mark connected nodes as dirty
  currentEdges.forEach(e => {
    if (!deployedEdgeKeys.has(edgeKey(e))) {
      dirtyIds.add(e.target); // Only mark target as dirty for new incoming data
    }
  });
  deployedEdges.forEach(e => {
    if (!currentEdgeKeys.has(edgeKey(e))) {
      dirtyIds.add(e.target); // Only mark target as dirty for lost incoming data
    }
  });

  // Check nodes (additions and modifications)
  currentNodes.forEach(node => {
    if (node.data?.isTutorialMock) return;
    const depNode = deployedMap.get(node.id);
    if (!depNode) {
      dirtyIds.add(node.id);
    } else if (!areDataEqual(node.data, depNode.data)) {
      dirtyIds.add(node.id);
    }
  });

  // Check for deleted nodes
  deployedNodes.forEach(node => {
    if (!currentNodes.find(n => n.id === node.id)) {
      dirtyIds.add(node.id);
    }
  });

  return Array.from(dirtyIds);
};

let autoSaveTimer = null;
let autoSaveStatusTimer = null;

const getInitialViewMode = () => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('pipelineViewMode');
      if (saved === 'inline' || saved === 'compact') return saved;
    } catch (e) {}
  }
  return 'compact';
};

const usePipelineStore = create((set, get) => ({
      nodes: [],
      edges: [],
      lastDeployedNodes: [],
      lastDeployedEdges: [],
      dirtyNodeIds: [],
      deployMode: 'modified_nodes', // 'modified_nodes' | 'modified_flows' | 'full'
      pipelineViewMode: getInitialViewMode(), // 'inline' or 'compact'
      autoSaveStatus: 'idle', // 'idle' | 'saving' | 'saved'
      debugData: {},
      projectId: null,
      highlightedNodeIds: [],
      telemetryData: null,
      showMetricsOverlay: true,
      advancedDebugMode: false,
      activeSidebarNodeId: null,
      
      setActiveSidebarNodeId: (id) => set({ activeSidebarNodeId: id }),
      openNodeSettings: (id) => set({ activeSidebarNodeId: id }),
      closeNodeSettings: () => set({ activeSidebarNodeId: null }),
      setDeployMode: (mode) => set({ deployMode: mode }),
      setPipelineViewMode: (mode) => {
        const state = get();
        if (state.pipelineViewMode === mode) return;
        
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('pipelineViewMode', mode);
          } catch (e) {}
        }

        const currentMode = state.pipelineViewMode;
        const updatedNodes = state.nodes.map(node => {
          // 1. Save current position for the current mode
          const currentModePositions = {
            ...(node.data?.positions || {}),
            [currentMode]: { ...node.position }
          };
          
          // 2. Retrieve position for the new mode if it exists, otherwise keep current
          const targetPosition = currentModePositions[mode] 
            ? { ...currentModePositions[mode] } 
            : { ...node.position };

          currentModePositions[mode] = { ...targetPosition };

          return {
            ...node,
            position: targetPosition,
            data: {
              ...node.data,
              positions: currentModePositions
            }
          };
        });

        set({ 
          pipelineViewMode: mode,
          nodes: updatedNodes 
        });

        get().autoSavePositions();
      },

      syncCurrentPositions: () => {
        const mode = get().pipelineViewMode;
        const currentNodes = get().nodes;
        let hasChanges = false;

        const updatedNodes = currentNodes.map(node => {
          const currentPos = node.position;
          const savedPos = node.data?.positions?.[mode];
          if (!savedPos || savedPos.x !== currentPos.x || savedPos.y !== currentPos.y) {
            hasChanges = true;
            return {
              ...node,
              data: {
                ...node.data,
                positions: {
                  ...(node.data?.positions || {}),
                  [mode]: { ...currentPos }
                }
              }
            };
          }
          return node;
        });

        if (hasChanges) {
          set({ nodes: updatedNodes });
          get().autoSavePositions();
        }
      },

      autoSavePositions: () => {
        const projectId = get().projectId;
        if (!projectId) return;

        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer);
        }

        set({ autoSaveStatus: 'saving' });

        autoSaveTimer = setTimeout(async () => {
          const state = get();
          const nodes = state.nodes.filter(n => !n.data?.isTutorialMock);
          if (nodes.length === 0) {
            set({ autoSaveStatus: 'idle' });
            return;
          }

          const currentMode = state.pipelineViewMode;
          const payloadNodes = nodes.map(n => ({
            id: n.id,
            position: n.position,
            data: {
              label: n.data?.label,
              positions: {
                ...(n.data?.positions || {}),
                [currentMode]: { ...n.position }
              }
            }
          }));

          try {
            const res = await fetch(`/api/projects/${projectId}/pipeline-positions`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nodes: payloadNodes })
            });
            if (res.ok) {
              set({ autoSaveStatus: 'saved' });
              if (autoSaveStatusTimer) clearTimeout(autoSaveStatusTimer);
              autoSaveStatusTimer = setTimeout(() => {
                set({ autoSaveStatus: 'idle' });
              }, 2500);
            } else {
              set({ autoSaveStatus: 'idle' });
            }
          } catch (err) {
            console.warn('Auto-save pipeline positions failed:', err);
            set({ autoSaveStatus: 'idle' });
          }
        }, 400);
      },
      setHighlightedNodeIds: (ids) => set({ highlightedNodeIds: ids }),
      setProjectId: (id) => set({ projectId: id }),
      setTelemetryData: (data) => set({ telemetryData: data }),
      setShowMetricsOverlay: (show) => set({ showMetricsOverlay: show }),
      toggleMetricsOverlay: () => set((state) => ({ showMetricsOverlay: !state.showMetricsOverlay })),
      toggleAdvancedDebugMode: () => set((state) => ({ advancedDebugMode: !state.advancedDebugMode })),
      
      beautifyPipeline: () => {
        const state = get();
        const mainNodes = state.nodes.filter(n => !n.data?.isTutorialMock);
        const mainEdges = state.edges.filter(e => !e.data?.isTutorialMock);
        if (mainNodes.length === 0) return;
        
        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));
        // Use ranksep and nodesep to control spacing
        dagreGraph.setGraph({ rankdir: 'LR', ranksep: 120, nodesep: 100 });
        
        const mode = state.pipelineViewMode;
        
        mainNodes.forEach((node) => {
          const width = node.measured?.width ?? (mode === 'inline' ? 280 : 250);
          const height = node.measured?.height ?? (mode === 'inline' ? 250 : 100);
          dagreGraph.setNode(node.id, { width, height });
        });
        
        mainEdges.forEach((edge) => {
          dagreGraph.setEdge(edge.source, edge.target);
        });
        
        dagre.layout(dagreGraph);
        
        const newNodes = state.nodes.map((node) => {
          if (node.data?.isTutorialMock) return node;
          
          const nodeWithPosition = dagreGraph.node(node.id);
          if (!nodeWithPosition) return node;
          
          const width = node.measured?.width ?? (mode === 'inline' ? 280 : 250);
          const height = node.measured?.height ?? (mode === 'inline' ? 250 : 100);
          
          // dagre returns center point, react flow wants top-left
          const targetPosition = {
            x: nodeWithPosition.x - width / 2,
            y: nodeWithPosition.y - height / 2
          };
          
          return {
            ...node,
            position: targetPosition,
            data: {
              ...node.data,
              positions: {
                ...(node.data?.positions || {}),
                [mode]: { ...targetPosition }
              }
            }
          };
        });
        
        const dirtyIds = getDirtyNodeIds(newNodes, state.edges, state.lastDeployedNodes, state.lastDeployedEdges);
        
        set({
          nodes: newNodes,
          dirtyNodeIds: dirtyIds
        });
        get().autoSavePositions();
      },
      
      setDebugData: (nodeId, data) => {
        set((state) => ({
          debugData: { ...state.debugData, [nodeId]: data }
        }));
      },
      
      debugMessages: [],
      addDebugMessage: (msg) => {
        set((state) => {
          const newMessages = [...state.debugMessages, msg].slice(-100);
          return { debugMessages: newMessages };
        });
      },
      clearDebugMessages: () => set({ debugMessages: [] }),
      
      markAsDeployed: (nodes, edges) => {
        const processedEdges = (edges || get().edges).map(edge => ({
          ...edge,
          type: 'buttonEdge',
          animated: false,
          style: { stroke: '#3b82f6', strokeWidth: 2 }
        }));
        const targetNodes = nodes || get().nodes;
        set({
          lastDeployedNodes: JSON.parse(JSON.stringify(targetNodes)),
          lastDeployedEdges: JSON.parse(JSON.stringify(processedEdges)),
          dirtyNodeIds: []
        });
      },

      setPipeline: (nodes, edges) => {
        const currentMode = get().pipelineViewMode;
        const processedNodes = nodes.map(node => {
          const pos = node.position || { x: 50, y: 150 };
          const existingPositions = node.data?.positions || {};
          const currentModePos = existingPositions[currentMode] || pos;
          return {
            ...node,
            position: { ...currentModePos },
            data: {
              ...node.data,
              positions: {
                inline: existingPositions.inline || { ...pos },
                compact: existingPositions.compact || { ...pos },
                ...existingPositions,
                [currentMode]: { ...currentModePos }
              }
            }
          };
        });
        const processedEdges = edges.map(edge => ({
          ...edge,
          type: 'buttonEdge',
          animated: false,
          style: { stroke: '#3b82f6', strokeWidth: 2 }
        }));
        set({
          nodes: processedNodes,
          edges: processedEdges,
          lastDeployedNodes: JSON.parse(JSON.stringify(processedNodes)),
          lastDeployedEdges: JSON.parse(JSON.stringify(processedEdges)),
          dirtyNodeIds: []
        });
      },

      setMockPipeline: (mockNodes, mockEdges) => {
        set((state) => {
          const mainNodes = state.nodes.filter(n => !n.data?.isTutorialMock);
          const mainEdges = state.edges.filter(e => !e.data?.isTutorialMock);
          return {
            nodes: [...mainNodes, ...mockNodes],
            edges: [...mainEdges, ...mockEdges],
          };
        });
      },

      clearMockPipeline: () => {
        set((state) => ({
          nodes: state.nodes.filter(n => !n.data?.isTutorialMock),
          edges: state.edges.filter(e => !e.data?.isTutorialMock),
        }));
      },

      deployMockPipeline: () => {
        set((state) => {
          const mainNodes = state.nodes.filter(n => !n.data?.isTutorialMock);
          const mockNodes = state.nodes.filter(n => n.data?.isTutorialMock);
          
          if (mockNodes.length === 0) return state;

          const maxY = mainNodes.length > 0 ? Math.max(...mainNodes.map(n => n.position.y)) : 0;
          const offsetY = maxY > 0 ? maxY + 300 : 50;

          const deployedNodes = mockNodes.map(n => {
            const { isTutorialMock, ...restData } = n.data || {};
            return {
              ...n,
              position: { x: n.position.x, y: n.position.y + offsetY },
              data: restData
            };
          });

          const deployedEdges = state.edges.filter(e => e.data?.isTutorialMock).map(e => {
            const { isTutorialMock, ...restData } = e.data || {};
            return {
              ...e,
              data: restData
            };
          });
          
          const newNodes = [...mainNodes, ...deployedNodes];
          const newEdges = [...state.edges.filter(e => !e.data?.isTutorialMock), ...deployedEdges];
          const dirtyIds = getDirtyNodeIds(newNodes, newEdges, state.lastDeployedNodes, state.lastDeployedEdges);

          return {
            nodes: newNodes,
            edges: newEdges,
            dirtyNodeIds: dirtyIds
          };
        });
      },
      
      onNodesChange: (changes) => {
        const removedChanges = changes.filter(c => c.type === 'remove');
        let currentEdges = get().edges;
        if (removedChanges.length > 0) {
          const removedIds = new Set(removedChanges.map(c => c.id));
          currentEdges = currentEdges.filter(edge => !removedIds.has(edge.source) && !removedIds.has(edge.target));
        }
        const newNodes = applyNodeChanges(changes, get().nodes);
        const dirtyIds = getDirtyNodeIds(newNodes, currentEdges, get().lastDeployedNodes, get().lastDeployedEdges);
        
        // Check if any position change has completed (drag released or keyboard nudged)
        const hasFinishedPositionChange = changes.some(c => c.type === 'position' && c.dragging !== true);

        if (hasFinishedPositionChange) {
          const mode = get().pipelineViewMode;
          const syncedNodes = newNodes.map(node => {
            const currentPos = node.position;
            const savedPos = node.data?.positions?.[mode];
            if (!savedPos || savedPos.x !== currentPos.x || savedPos.y !== currentPos.y) {
              return {
                ...node,
                data: {
                  ...node.data,
                  positions: {
                    ...(node.data?.positions || {}),
                    [mode]: { ...currentPos }
                  }
                }
              };
            }
            return node;
          });

          set({
            nodes: syncedNodes,
            edges: currentEdges,
            dirtyNodeIds: dirtyIds,
          });
          get().autoSavePositions();
          return;
        }

        set({
          nodes: newNodes,
          edges: currentEdges,
          dirtyNodeIds: dirtyIds,
        });
      },
      
      onEdgesChange: (changes) => {
        const newEdges = applyEdgeChanges(changes, get().edges);
        const dirtyIds = getDirtyNodeIds(get().nodes, newEdges, get().lastDeployedNodes, get().lastDeployedEdges);
        set({
          edges: newEdges,
          dirtyNodeIds: dirtyIds,
        });
      },
      
      onConnect: (connection) => {
        const newEdges = addEdge({ ...connection, type: 'buttonEdge', animated: false, style: { stroke: '#3b82f6', strokeWidth: 2 } }, get().edges);
        const dirtyIds = getDirtyNodeIds(get().nodes, newEdges, get().lastDeployedNodes, get().lastDeployedEdges);
        set({
          edges: newEdges,
          dirtyNodeIds: dirtyIds,
        });
      },
      
      addNode: (node) => {
        const currentMode = get().pipelineViewMode;
        const initialPos = node.position || { x: 100, y: 100 };
        const nodeWithPositions = {
          ...node,
          position: { ...initialPos },
          data: {
            ...node.data,
            positions: {
              inline: { ...initialPos },
              compact: { ...initialPos },
              ...(node.data?.positions || {}),
              [currentMode]: { ...initialPos }
            }
          }
        };
        const newNodes = [...get().nodes, nodeWithPositions];
        const dirtyIds = getDirtyNodeIds(newNodes, get().edges, get().lastDeployedNodes, get().lastDeployedEdges);
        set({
          nodes: newNodes,
          dirtyNodeIds: dirtyIds,
        });
        get().autoSavePositions();
      },
      
      deleteNode: (id) => {
        const newNodes = get().nodes.filter((node) => node.id !== id);
        const newEdges = get().edges.filter((edge) => edge.source !== id && edge.target !== id);
        const dirtyIds = getDirtyNodeIds(newNodes, newEdges, get().lastDeployedNodes, get().lastDeployedEdges);
        set({
          nodes: newNodes,
          edges: newEdges,
          dirtyNodeIds: dirtyIds,
        });
      },

      deleteNodes: (ids) => {
        const idList = Array.isArray(ids) ? ids : [ids];
        if (idList.length === 0) return;
        const idSet = new Set(idList);
        const newNodes = get().nodes.filter((node) => !idSet.has(node.id));
        const newEdges = get().edges.filter((edge) => !idSet.has(edge.source) && !idSet.has(edge.target));
        const dirtyIds = getDirtyNodeIds(newNodes, newEdges, get().lastDeployedNodes, get().lastDeployedEdges);
        set({
          nodes: newNodes,
          edges: newEdges,
          dirtyNodeIds: dirtyIds,
        });
      },

      deleteEdge: (id) => {
        const newEdges = get().edges.filter((edge) => edge.id !== id);
        const dirtyIds = getDirtyNodeIds(get().nodes, newEdges, get().lastDeployedNodes, get().lastDeployedEdges);
        set({
          edges: newEdges,
          dirtyNodeIds: dirtyIds,
        });
      },

      updateNodeData: (id, data) => {
        const newNodes = get().nodes.map((node) => {
          if (node.id === id) {
            return { ...node, data: { ...node.data, ...data } };
          }
          return node;
        });
        const dirtyIds = getDirtyNodeIds(newNodes, get().edges, get().lastDeployedNodes, get().lastDeployedEdges);
        set({
          nodes: newNodes,
          dirtyNodeIds: dirtyIds,
        });
        
        // Auto-save just in case we changed non-dirty layout/UI fields like label
        get().autoSavePositions();
      },
    })
);

export default usePipelineStore;
