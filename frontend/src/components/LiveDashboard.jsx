import React, { useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Import all 10 Widgets
import VideoWidget from './DashboardWidgets/VideoWidget';
import PipelineStatusWidget from './DashboardWidgets/PipelineStatusWidget';
import HeatmapWidget from './DashboardWidgets/HeatmapWidget';
import ActionButtonsWidget from './DashboardWidgets/ActionButtonsWidget';
import SnapshotsWidget from './DashboardWidgets/SnapshotsWidget';
import SystemResourceWidget from './DashboardWidgets/SystemResourceWidget';
// Generic Widgets
import MetricWidget from './DashboardWidgets/MetricWidget';
import TextWidget from './DashboardWidgets/TextWidget';
import TextFeedWidget from './DashboardWidgets/TextFeedWidget';
import ChartWidget from './DashboardWidgets/ChartWidget';
import WidgetSettingsModal from './DashboardWidgets/WidgetSettingsModal';

import { Lock, Unlock, Save, Plus } from 'lucide-react';

const ResponsiveGridLayout = WidthProvider(Responsive);

const WIDGET_TYPES = [
  { type: 'video', label: '📺 Video Stream', minW: 2, minH: 2 },
  { type: 'metric', label: '🔢 Metric (Number)', minW: 2, minH: 2 },
  { type: 'text', label: '📝 Text Value', minW: 2, minH: 2 },
  { type: 'textFeed', label: '📋 Log Feed', minW: 2, minH: 2 },
  { type: 'chart', label: '📈 Line Chart', minW: 2, minH: 2 },
  { type: 'actionButtons', label: '🎮 Action Buttons', minW: 2, minH: 2 },
  { type: 'imageGallery', label: '🖼️ Snapshots', minW: 2, minH: 2 },
  { type: 'heatmap', label: '🔥 Heatmap', minW: 2, minH: 2 },
  { type: 'pipelineStatus', label: '⚡ Pipeline Status', minW: 2, minH: 2 }
];

const defaultLayout = [
  { i: 'video', x: 0, y: 0, w: 6, h: 5, minW: 2, minH: 2, type: 'video' },
  { i: 'status', x: 10, y: 0, w: 2, h: 2, minW: 2, minH: 2, type: 'pipelineStatus' },
  { i: 'metric_count', x: 6, y: 0, w: 2, h: 2, minW: 2, minH: 2, type: 'metric', config: { title: 'Detections', dataPath: 'data.length', unit: 'objects' } },
  { i: 'metric_cpu', x: 8, y: 0, w: 2, h: 2, minW: 2, minH: 2, type: 'metric', config: { title: 'CPU Usage', dataPath: 'system.cpu_percent', unit: '%' } },
  { i: 'feed_alerts', x: 8, y: 2, w: 4, h: 3, minW: 2, minH: 2, type: 'textFeed', config: { title: 'Live Alerts', dataPath: 'alerts' } },
  { i: 'chart_history', x: 0, y: 5, w: 6, h: 3, minW: 2, minH: 2, type: 'chart', config: { title: 'Detections Trend', dataPath: 'history.data' } },
  { i: 'actions', x: 6, y: 2, w: 2, h: 3, minW: 2, minH: 2, type: 'actionButtons' },
  { i: 'snapshots', x: 0, y: 8, w: 6, h: 2, minW: 2, minH: 2, type: 'imageGallery' },
  { i: 'heatmap', x: 6, y: 8, w: 6, h: 2, minW: 2, minH: 2, type: 'heatmap' }
];

const getNestedValue = (obj, path) => {
  if (!path || !obj) return undefined;
  const keys = path.split('.');
  let current = obj;
  for (let key of keys) {
    if (current === undefined || current === null) return undefined;
    if (key === 'length' && Array.isArray(current)) {
      current = current.length;
    } else {
      current = current[key];
    }
  }
  return current;
};

export default function LiveDashboard({ metadata, connected, projectId }) {
  const [layouts, setLayouts] = useState({ lg: [] }); // start empty instead of defaultLayout to prevent flashing
  const [isEditMode, setIsEditMode] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    fetch('/api/projects')
      .then(res => res.json())
      .then(projects => {
        const project = projects.find(p => p.id === projectId);
        if (project && project.dashboard_layout) {
          // Backward compatibility check
          const updatedLayout = project.dashboard_layout.lg ? project.dashboard_layout.lg : project.dashboard_layout;
          const hasTypes = updatedLayout.length === 0 || updatedLayout.some(i => i.type);
          if (!hasTypes) {
             setLayouts({ lg: defaultLayout }); // Overwrite with new generic layout if old format
          } else {
             setLayouts({ lg: updatedLayout });
          }
        }
      })
      .catch(err => console.error("Failed to load dashboard layout", err))
      .finally(() => setIsLoading(false));
  }, [projectId]);

  const onLayoutChange = React.useCallback((layout, newLayouts) => {
    setLayouts(prev => {
      const mergedLayouts = { ...newLayouts };
      for (const bp in mergedLayouts) {
        mergedLayouts[bp] = mergedLayouts[bp].map(newItem => {
          const prevItems = prev[bp] || prev.lg || [];
          const oldItem = prevItems.find(i => i.i === newItem.i) || {};
          return {
            ...newItem,
            type: oldItem.type || newItem.i.split('_')[0],
            config: oldItem.config || {}
          };
        });
      }
      return mergedLayouts;
    });
  }, []);

  // Removed onDrop and droppingItem

  const handleAddWidgetClick = React.useCallback((type) => {
    const widgetDef = WIDGET_TYPES.find(w => w.type === type);
    if (!widgetDef) return;

    const newId = `${type}_${Date.now()}`;
    
    // Find bottom-most position
    const currentLg = layouts.lg || [];
    let maxY = 0;
    currentLg.forEach(item => {
      if (item.y + item.h > maxY) {
        maxY = item.y + item.h;
      }
    });

    const newWidget = {
      i: newId,
      x: 0,
      y: maxY,
      w: widgetDef.minW,
      h: widgetDef.minH,
      minW: widgetDef.minW,
      minH: widgetDef.minH,
      type: type,
      config: { title: `New ${widgetDef.label.split(' ')[1]}` }
    };

    setLayouts(prev => {
      const updated = { ...prev };
      for (const bp in updated) {
        updated[bp] = [...(updated[bp] || []), newWidget];
      }
      if (!updated.lg) updated.lg = [newWidget];
      return updated;
    });
  }, [layouts]);

  const saveLayout = async () => {
    try {
      const res = await fetch('/api/projects');
      const projects = await res.json();
      
      const updatedProjects = projects.map(p => {
        if (p.id === projectId) {
          return { ...p, dashboard_layout: layouts };
        }
        return p;
      });

      const saveRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProjects)
      });

      if (saveRes.ok) {
        setIsEditMode(false);
      } else {
        alert("Failed to save layout to server.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving layout.");
    }
  };

  const openSettings = (item) => {
    setEditingWidget(item);
    setSettingsModalOpen(true);
  };

  const handleSaveWidgetSettings = (id, newConfig) => {
    setLayouts(prev => {
      const updatedLg = prev.lg.map(item => {
        if (item.i === id) {
          return { ...item, config: newConfig };
        }
        return item;
      });
      return { ...prev, lg: updatedLg };
    });
    setSettingsModalOpen(false);
    setEditingWidget(null);
  };

  return (
    <div className="animate-in fade-in duration-500 flex flex-col h-full relative">
      
      {/* Floating Toolbar */}
      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-40 flex gap-2">
        {isEditMode ? (
          <button 
            onClick={saveLayout}
            className="bg-green-600 hover:bg-green-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-lg active:scale-95"
          >
            <Save size={15} /> <span>Save Layout</span>
          </button>
        ) : (
          <button 
            onClick={() => setIsEditMode(true)}
            className="bg-gray-800/90 hover:bg-gray-700 backdrop-blur-sm text-gray-300 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-colors border border-gray-700 shadow-lg active:scale-95"
          >
            <Unlock size={15} /> <span>Edit Layout</span>
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-950 rounded-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}
        
        {/* Grid Layout Canvas */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden p-1 sm:p-2 bg-gray-950 rounded-xl border ${isEditMode ? 'border-blue-500/50 border-dashed' : 'border-transparent'}`}>
          <ResponsiveGridLayout
            className="layout"
            style={{ minHeight: '100%' }}
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={75}
            onLayoutChange={onLayoutChange}
            isDraggable={isEditMode}
            isResizable={isEditMode}
            margin={[12, 12]}
          >
          {layouts.lg.map(item => {
            const config = item.config || {};
            const type = item.type || item.i; // fallback for older configs
            
            return (
              <div key={item.i} className="relative group h-full w-full">
                {/* Overlay to prevent widgets (like videos/iframes) from swallowing drag events */}
                {isEditMode && (
                  <div className="absolute inset-0 z-10 cursor-move" />
                )}
                
                {isEditMode && (
                  <React.Fragment>
                    <button 
                      onClick={() => openSettings(item)}
                      className="absolute top-2 right-2 z-20 bg-gray-800 p-1.5 rounded hover:bg-gray-700 hidden group-hover:block border border-gray-600 text-gray-300 shadow-md"
                      title="Widget Settings"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button 
                      onClick={() => {
                        setLayouts(prev => {
                          const updated = {};
                          for (const bp in prev) {
                            updated[bp] = prev[bp].filter(i => i.i !== item.i);
                          }
                          return updated;
                        });
                      }}
                      className="absolute top-2 right-10 z-20 bg-red-900/80 p-1.5 rounded hover:bg-red-800 hidden group-hover:block border border-red-700 text-red-100 shadow-md"
                      title="Remove Widget"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </React.Fragment>
                )}
                {type === 'video' && <VideoWidget metadata={config?.stream_id ? (metadata && metadata[config.stream_id]) : metadata} projectId={projectId} config={config} />}
                {type === 'pipelineStatus' && <PipelineStatusWidget connected={connected} metadata={metadata} config={config} />}
                {type === 'actionButtons' && <ActionButtonsWidget config={config} />}
                {type === 'heatmap' && <HeatmapWidget config={config} />}
                {type === 'imageGallery' && <SnapshotsWidget config={config} />}
                {type === 'systemResource' && <SystemResourceWidget config={config} />}
                
                {/* Generic Widgets */}
                {type === 'metric' && (
                  <MetricWidget 
                    title={config.title} 
                    value={getNestedValue(metadata, config.dataPath)} 
                    unit={config.unit} 
                  />
                )}
                {type === 'text' && (
                  <TextWidget 
                    title={config.title} 
                    value={getNestedValue(metadata, config.dataPath)} 
                    unit={config.unit} 
                  />
                )}
                {type === 'textFeed' && (
                  <TextFeedWidget 
                    title={config.title} 
                    feedData={getNestedValue(metadata, config.dataPath) || []} 
                  />
                )}
                {type === 'chart' && (
                  <ChartWidget 
                    title={config.title} 
                    data={getNestedValue(metadata, config.dataPath) || []} 
                  />
                )}
              </div>
            );
          })}
          </ResponsiveGridLayout>
        </div>

        {/* Edit Mode Slide-over Panel */}
        <div 
          className={`absolute top-0 right-0 h-full w-72 bg-gray-900/95 backdrop-blur-md border-l border-gray-800 p-4 shrink-0 flex flex-col gap-3 overflow-y-auto transition-transform duration-300 z-30 shadow-2xl ${isEditMode ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="text-gray-300 font-semibold text-sm uppercase tracking-wider mb-2 mt-14">
            Available Widgets
          </div>
          <div className="text-xs text-gray-500 mb-4 leading-relaxed">
            Click the + button to add a widget to the dashboard canvas.
          </div>
          
          {WIDGET_TYPES.map(widget => (
            <div 
              key={widget.type}
              className="bg-gray-800 border border-gray-700 p-3 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors shadow-sm flex items-center justify-between group"
              onClick={() => handleAddWidgetClick(widget.type)}
            >
              <span className="text-gray-200 text-sm font-medium select-none">{widget.label}</span>
              <button 
                className="p-1 rounded-md bg-gray-900 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm"
                title="Add to Dashboard"
              >
                <Plus size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <WidgetSettingsModal 
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onSave={handleSaveWidgetSettings}
        widgetItem={editingWidget}
        projectId={projectId}
      />
    </div>
  );
}
