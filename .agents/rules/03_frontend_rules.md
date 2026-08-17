---
name: Frontend Standards
description: Enforces React/Vue and state management best practices.
trigger: always_on
---

# Frontend Coding Standards

1. **Component Style**: Use Functional Components exclusively. Avoid Class-based components.
2. **State Management**: For complex states (e.g., the Pipeline Builder drag-and-drop nodes), use a robust state manager (like Zustand for React or Pinia for Vue) instead of deeply nested Prop Drilling or overwhelming a single component's local state.
3. **Performance**: Prevent unnecessary re-renders when dealing with high-frequency WebSocket updates (like 30FPS AI bounding boxes). Use refs or HTML5 Canvas overlays for drawing bounding boxes instead of updating React DOM elements 30 times a second.
