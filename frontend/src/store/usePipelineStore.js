import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';

const initialNodes = [
  { id: 'start', type: 'inputNode', position: { x: 50, y: 150 }, data: { label: 'Camera Input' } },
];

const cleanNodeData = (data) => {
  if (!data || typeof data !== 'object') return {};
  const { selected, dragging, position, positionAbsolute, width, height, isPaused, ...rest } = data;
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
    return [];
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
      dirtyIds.add(e.source);
      dirtyIds.add(e.target);
    }
  });
  deployedEdges.forEach(e => {
    if (!currentEdgeKeys.has(edgeKey(e))) {
      dirtyIds.add(e.source);
      dirtyIds.add(e.target);
    }
  });

  // Check nodes
  currentNodes.forEach(node => {
    if (node.data?.isTutorialMock) return;
    const depNode = deployedMap.get(node.id);
    if (!depNode) {
      dirtyIds.add(node.id);
    } else if (!areDataEqual(node.data, depNode.data)) {
      dirtyIds.add(node.id);
    }
  });

  return Array.from(dirtyIds);
};

const usePipelineStore = create((set, get) => ({
      nodes: [],
      edges: [],
      lastDeployedNodes: [],
      lastDeployedEdges: [],
      dirtyNodeIds: [],
      deployMode: 'modified_nodes', // 'modified_nodes' | 'modified_flows' | 'full'
      debugData: {},
      projectId: null,
      highlightedNodeIds: [],
      telemetryData: null,
      showMetricsOverlay: true,
      advancedDebugMode: false,
      
      setDeployMode: (mode) => set({ deployMode: mode }),
      setHighlightedNodeIds: (ids) => set({ highlightedNodeIds: ids }),
      setProjectId: (id) => set({ projectId: id }),
      setTelemetryData: (data) => set({ telemetryData: data }),
      setShowMetricsOverlay: (show) => set({ showMetricsOverlay: show }),
      toggleMetricsOverlay: () => set((state) => ({ showMetricsOverlay: !state.showMetricsOverlay })),
      toggleAdvancedDebugMode: () => set((state) => ({ advancedDebugMode: !state.advancedDebugMode })),
      
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
        const processedEdges = edges.map(edge => ({
          ...edge,
          type: 'buttonEdge',
          animated: false,
          style: { stroke: '#3b82f6', strokeWidth: 2 }
        }));
        set({
          nodes,
          edges: processedEdges,
          lastDeployedNodes: JSON.parse(JSON.stringify(nodes)),
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
        const newNodes = [...get().nodes, node];
        const dirtyIds = getDirtyNodeIds(newNodes, get().edges, get().lastDeployedNodes, get().lastDeployedEdges);
        set({
          nodes: newNodes,
          dirtyNodeIds: dirtyIds,
        });
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
      },
    })
);

export default usePipelineStore;
