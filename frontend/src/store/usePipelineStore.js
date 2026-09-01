import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';

const initialNodes = [
  { id: 'start', type: 'inputNode', position: { x: 50, y: 150 }, data: { label: 'Camera Input' } },
];

const usePipelineStore = create((set, get) => ({
      nodes: [],
      edges: [],
      debugData: {},
      projectId: null,
      highlightedNodeIds: [],
      
      setHighlightedNodeIds: (ids) => set({ highlightedNodeIds: ids }),
      
      setProjectId: (id) => set({ projectId: id }),
      
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
      
      setPipeline: (nodes, edges) => {
        const processedEdges = edges.map(edge => ({
          ...edge,
          type: 'buttonEdge',
          animated: true,
          style: { stroke: '#3b82f6', strokeWidth: 2 }
        }));
        set({ nodes, edges: processedEdges });
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
          
          return {
            nodes: [...mainNodes, ...deployedNodes],
            edges: [...state.edges.filter(e => !e.data?.isTutorialMock), ...deployedEdges]
          };
        });
      },
      
      onNodesChange: (changes) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes),
        });
      },
      
      onEdgesChange: (changes) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
      },
      
      onConnect: (connection) => {
        set({
          edges: addEdge({ ...connection, type: 'buttonEdge', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }, get().edges),
        });
      },
      
      addNode: (node) => {
        set({ nodes: [...get().nodes, node] });
      },
      
      deleteNode: (id) => {
        set({
          nodes: get().nodes.filter((node) => node.id !== id),
          edges: get().edges.filter((edge) => edge.source !== id && edge.target !== id),
        });
      },

      deleteEdge: (id) => {
        set({
          edges: get().edges.filter((edge) => edge.id !== id),
        });
      },

      updateNodeData: (id, data) => {
        set({
          nodes: get().nodes.map((node) => {
            if (node.id === id) {
              return { ...node, data: { ...node.data, ...data } };
            }
            return node;
          }),
        });
      },
    })
);

export default usePipelineStore;
