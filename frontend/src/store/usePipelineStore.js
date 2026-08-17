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
      
      setPipeline: (nodes, edges) => {
        const processedEdges = edges.map(edge => ({
          ...edge,
          type: 'buttonEdge',
          animated: true,
          style: { stroke: '#3b82f6', strokeWidth: 2 }
        }));
        set({ nodes, edges: processedEdges });
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
