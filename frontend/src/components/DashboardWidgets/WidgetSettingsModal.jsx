import React, { useState, useEffect } from 'react';
import { useTheme } from '../../utils/theme';
import { X, Save, Settings, Palette, Bell, Sliders, Activity } from 'lucide-react';
import GaugeWidget from './GaugeWidget';
import CapacityBarWidget from './CapacityBarWidget';
import RadialDonutWidget from './RadialDonutWidget';
import TrafficLightWidget from './TrafficLightWidget';
import MetricWidget from './MetricWidget';
import ChartWidget from './ChartWidget';
import TextWidget from './TextWidget';
import HistoricalChartWidget from './HistoricalChartWidget';

const ToggleSwitch = ({ label, checked, onChange, className = "mb-3" }) => (
  <div className={`flex items-center justify-between gap-4 ${className}`}>
    <h4 className="text-sm font-semibold text-gray-300">{label}</h4>
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
      <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
    </label>
  </div>
);

export default function WidgetSettingsModal({ isOpen, onClose, onSave, widgetItem, projectId, metadata = {} }) {
  const isDark = useTheme();
  const getNestedValue = (obj, path) => {
    if (!obj || !path) return null;
    const parts = path.split('.');
    let current = obj;
    for (let part of parts) {
      if (current[part] === undefined) return null;
      current = current[part];
    }
    return current;
  };
  const [formData, setFormData] = useState({ title: '', dataPath: '', unit: '', nodeId: '' });
  const [dataSources, setDataSources] = useState([]);
  const [pipelineNodes, setPipelineNodes] = useState([]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/data-sources?project_id=${projectId}`)
      .then(res => res.json())
      .then(data => setDataSources(data))
      .catch(err => console.error("Failed to load data sources:", err));

    fetch(`/api/projects`)
      .then(res => res.json())
      .then(projects => {
        const p = projects.find(proj => proj.id === projectId);
        if (p && p.pipeline && p.pipeline.nodes) {
           setPipelineNodes(p.pipeline.nodes.filter(n => ['counter', 'flowCounter'].includes(n.type)));
        }
      })
      .catch(err => console.error("Failed to load projects:", err));
  }, [projectId]);

  useEffect(() => {
    if (widgetItem && widgetItem.config) {
      setFormData({
        title: widgetItem.config.title || '',
        showTitle: widgetItem.config.showTitle ?? true,
        dataPath: widgetItem.config.dataPath || '',
        dataPaths: widgetItem.config.dataPaths || (widgetItem.config.dataPath ? [widgetItem.config.dataPath] : []),
        nodeId: widgetItem.config.nodeId || '',
        unit: widgetItem.config.unit || '',
        chartType: widgetItem.config.chartType || 'stepAfter',
        color: widgetItem.config.color || '#10b981',
        threshold: widgetItem.config.threshold || '',
        thresholdMin: widgetItem.config.thresholdMin || '',
        thresholdCondition: widgetItem.config.thresholdCondition || '>',
        iconName: widgetItem.config.iconName || 'Activity',
        decimals: widgetItem.config.decimals !== undefined ? widgetItem.config.decimals : '',
        timeframe: widgetItem.config.timeframe || '5m',
        lockTimeframe: widgetItem.config.lockTimeframe || false,
        yMin: widgetItem.config.yMin || '',
        yMax: widgetItem.config.yMax || '',
        maxDataPoints: widgetItem.config.maxDataPoints || 600,
        strokeWidth: widgetItem.config.strokeWidth !== undefined ? widgetItem.config.strokeWidth : 2,
        showDots: widgetItem.config.showDots || false,
        fillOpacity: widgetItem.config.fillOpacity !== undefined ? widgetItem.config.fillOpacity : 20,
        showGrid: widgetItem.config.showGrid !== undefined ? widgetItem.config.showGrid : true,
        gridStyle: widgetItem.config.gridStyle || '3 3',
        useGradient: widgetItem.config.useGradient !== undefined ? widgetItem.config.useGradient : true,
        thresholdColor: widgetItem.config.thresholdColor || '#ef4444',
        thresholdLabel: widgetItem.config.thresholdLabel || 'Threshold',
        thresholdMin: widgetItem.config.thresholdMin || '',
        thresholdMinColor: widgetItem.config.thresholdMinColor || '#3b82f6',
        thresholdMinLabel: widgetItem.config.thresholdMinLabel || 'Lower Limit',
        unit: widgetItem.config.unit || '',
        yAxisMargin: widgetItem.config.yAxisMargin || '',
        yAxisLogScale: widgetItem.config.yAxisLogScale || false,
        thickness: widgetItem.config.thickness || 16,
        gaugeStyle: widgetItem.config.gaugeStyle || 'half-circle',
        orientation: widgetItem.config.orientation || 'vertical',
        colorStops: widgetItem.config.colorStops || [],
        colorMode: widgetItem.config.colorMode || 'segmented',
        min: widgetItem.config.min !== undefined ? widgetItem.config.min : '',
        max: widgetItem.config.max !== undefined ? widgetItem.config.max : '',
        enableDynamicColors: widgetItem.config.enableDynamicColors ?? (widgetItem.config.colorStops && widgetItem.config.colorStops.length > 0),
        enableDisplayScale: widgetItem.config.enableDisplayScale ?? true,
        enableUpperLimit: widgetItem.config.enableUpperLimit ?? (widgetItem.config.threshold !== '' && widgetItem.config.threshold !== undefined),
        enableLowerLimit: widgetItem.config.enableLowerLimit ?? (widgetItem.config.thresholdMin !== '' && widgetItem.config.thresholdMin !== undefined),
        enableYAxisConstraints: widgetItem.config.enableYAxisConstraints ?? (widgetItem.config.yMin !== '' || widgetItem.config.yMax !== ''),
        enableVisualTweaks: widgetItem.config.enableVisualTweaks ?? true,
        fontColorMode: widgetItem.config.fontColorMode || 'dynamic',
        fontColor: widgetItem.config.fontColor || '#FFFFFF',
        valueFontSize: widgetItem.config.valueFontSize || 1,
        unitFontSize: widgetItem.config.unitFontSize || 1
      });
    }
  }, [widgetItem]);


  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddColorStop = () => {
    const newStops = [...(formData.colorStops || [])];
    newStops.push({ limit: 100, color: '#10b981' });
    setFormData({ ...formData, colorStops: newStops });
  };

  const handleRemoveColorStop = (index) => {
    const newStops = [...(formData.colorStops || [])];
    newStops.splice(index, 1);
    setFormData({ ...formData, colorStops: newStops });
  };

  const handleUpdateColorStop = (index, field, value) => {
    const newStops = [...(formData.colorStops || [])];
    newStops[index] = { ...newStops[index], [field]: value };
    setFormData({ ...formData, colorStops: newStops });
  };

  const handleSave = () => {
    const selectedSource = dataSources.find(ds => ds.id === formData.dataPath);
    const extraConfig = {};
    if (selectedSource) {
      if (selectedSource.stream_id !== undefined) extraConfig.stream_id = selectedSource.stream_id;
      if (selectedSource.has_ai !== undefined) extraConfig.has_ai = selectedSource.has_ai;
      if (selectedSource.nodeId !== undefined) extraConfig.nodeId = selectedSource.nodeId;
    }
    
    // Also save friendly names for chart data paths
    if (formData.dataPaths && formData.dataPaths.length > 0) {
      const names = {};
      formData.dataPaths.forEach(id => {
        const ds = dataSources.find(d => d.id === id);
        if (ds) names[id] = ds.name;
      });
      extraConfig.dataPathNames = names;
    }
    
    onSave(widgetItem.i, { ...widgetItem.config, ...formData, ...extraConfig });
  };

  const getSupportedTypes = (type) => {
    switch(type) {
      case 'metric': return ['number'];
      case 'gauge': return ['number'];
      case 'capacityBar': return ['number'];
      case 'trafficLight': return ['number', 'boolean', 'text'];
      case 'radialDonut': return ['number'];
      case 'text': return ['text', 'boolean'];
      case 'textFeed': return ['array_text'];
      case 'chart': return ['number', 'array_number'];
      case 'video': return ['video'];
      case 'imageGallery': return ['image'];
      case 'targetTracker': return ['target_tracker'];
      default: return []; // Specific widgets like heatmap, status, actions might not need data binding here
    }
  };

  const supportedTypes = widgetItem ? getSupportedTypes(widgetItem.type) : [];
  const filteredSources = dataSources.filter(ds => {
    if (!supportedTypes.includes(ds.dataType)) return false;
    if (ds.widgetType) {
      const metricCompatible = ['metric', 'gauge', 'capacityBar', 'radialDonut', 'trafficLight'];
      if (ds.widgetType === 'metric' && metricCompatible.includes(widgetItem?.type)) {
        return true;
      }
      if (ds.widgetType !== widgetItem?.type) return false;
    }
    return true;
  });

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
  ];
  
  if (['chart', 'metric', 'gauge', 'capacityBar', 'radialDonut'].includes(widgetItem?.type)) {
    tabs.push({ id: 'appearance', label: 'Appearance', icon: Palette });
    tabs.push({ id: 'limits', label: 'Limits & Alerts', icon: Bell });
  }
  
  if (['chart'].includes(widgetItem?.type)) {
    tabs.push({ id: 'advanced', label: 'Advanced', icon: Sliders });
  }

  const [activeTab, setActiveTab] = useState('general');

  // Ensure active tab is valid if widget type changes (rare but safe)
  useEffect(() => {
    if (widgetItem && !tabs.find(t => t.id === activeTab)) {
      setActiveTab('general');
    }
  }, [widgetItem?.type]);

  if (!isOpen || !widgetItem) return null;

  const renderPreview = () => {
    const previewProps = {
      title: formData.title || 'Preview Title',
      config: formData,
    };
    
    // Retrieve real value if dataPath exists, else fallback to dummy
    const dsId = formData.dataPath || (formData.dataPaths && formData.dataPaths[0]) || widgetItem?.dataSourceId;
    let realValue = getNestedValue(metadata, dsId);
    
    switch(widgetItem?.type) {
      case 'gauge':
        return <GaugeWidget {...previewProps} value={realValue !== null ? realValue : 65} unit={formData.unit || ''} />;
      case 'capacityBar':
        return <CapacityBarWidget {...previewProps} value={realValue !== null ? realValue : 142} unit={formData.unit || ''} />;
      case 'radialDonut':
        return <RadialDonutWidget {...previewProps} value={realValue !== null ? realValue : 75} unit={formData.unit || ''} />;
      case 'trafficLight':
        return <TrafficLightWidget {...previewProps} value={realValue !== null ? realValue : 1} />; // 1 is warning state
      case 'metric':
        return <MetricWidget {...previewProps} value={realValue !== null ? realValue : 1024} unit={formData.unit || ''} />;
      case 'text':
        return <TextWidget {...previewProps} value={realValue !== null ? realValue : "System Nominal"} />;
      case 'chart':
        return <div className="w-full h-full bg-gray-900 rounded-xl flex items-center justify-center border border-gray-700 shadow-inner"><span className="text-gray-500 font-mono text-sm">Chart Preview</span></div>;
      default:
        return <div className="text-gray-500 text-sm">Preview not available</div>;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl w-[900px] h-[650px] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-gray-900 px-6 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-100 text-lg leading-tight">Widget Settings</h3>
              <p className="text-xs text-gray-400">Configure "{widgetItem.type}" widget properties</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-[400px]">
          {/* Left Side: Form */}
          <div className="flex-1 flex flex-col border-r border-gray-800">
            {/* Tab Navigation */}
            <div className="flex px-6 border-b border-gray-800 bg-gray-900/50 shrink-0">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      isActive 
                        ? 'border-blue-500 text-blue-400' 
                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                )
              })}
            </div>
            
            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-900">
          
          {/* ================= GENERAL TAB ================= */}
          <div className={activeTab === 'general' ? 'block animate-in fade-in slide-in-from-right-4 duration-300' : 'hidden'}>
            <div className="space-y-5">
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Widget Title</label>
                  <input 
                    type="text" 
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none shadow-inner"
                    placeholder="e.g. People Count"
                  />
                </div>
                <div className="pt-7 shrink-0">
                  <ToggleSwitch 
                    label="Show Title" 
                    checked={formData.showTitle !== false} 
                    onChange={(e) => setFormData({ ...formData, showTitle: e.target.checked })} 
                    className="mb-0"
                  />
                </div>
              </div>

              {widgetItem.type === 'historicalChart' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Target Counter Node</label>
                  <select 
                    name="nodeId"
                    value={formData.nodeId}
                    onChange={handleChange}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-blue-500 outline-none shadow-inner cursor-pointer"
                  >
                    <option value="">-- All Project Counters --</option>
                    {pipelineNodes.map(n => (
                      <option key={n.id} value={n.id}>{n.data?.label || n.type} ({n.id})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Data Source Binding</label>
                  {widgetItem.type === 'chart' ? (
                    <div className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white text-sm max-h-40 overflow-y-auto shadow-inner custom-scrollbar">
                      {(() => {
                        const danglingPaths = (formData.dataPaths || []).filter(p => !filteredSources.some(ds => ds.id === p));
                        const allToRender = [
                          ...filteredSources, 
                          ...danglingPaths.map(p => ({ id: p, name: '⚠️ Deleted Source', isDangling: true }))
                        ];
                        
                        if (allToRender.length === 0) {
                          return <div className="text-gray-500 italic p-2 text-center text-xs">No supported sources available in this project.</div>;
                        }
                        return allToRender.map(ds => {
                          const val = getNestedValue(metadata, ds.id);
                          const displayVal = val !== null && val !== undefined ? (typeof val === 'number' && val % 1 !== 0 ? val.toFixed(2) : String(val)) : 'N/A';
                          return (
                          <label key={ds.id} className={`flex items-center gap-3 p-2 rounded-md hover:bg-gray-800 cursor-pointer transition-colors ${ds.isDangling ? 'text-red-400/80' : ''}`}>
                            <input 
                              type="checkbox" 
                              checked={formData.dataPaths?.includes(ds.id)}
                              onChange={(e) => {
                                const paths = formData.dataPaths || [];
                                if (e.target.checked) setFormData({ ...formData, dataPaths: [...paths, ds.id] });
                                else setFormData({ ...formData, dataPaths: paths.filter(p => p !== ds.id) });
                              }}
                              className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900 cursor-pointer"
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{ds.name}</span>
                              <span className={`${ds.isDangling ? 'text-red-500/50' : 'text-gray-500'} font-mono text-[10px]`}>{displayVal}</span>
                            </div>
                          </label>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <select 
                      name="dataPath"
                      value={formData.dataPath}
                      onChange={handleChange}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-blue-500 outline-none shadow-inner cursor-pointer"
                    >
                      <option value="">-- Select Data Source --</option>
                      {filteredSources.map(ds => {
                        const val = getNestedValue(metadata, ds.id);
                        const displayVal = val !== null && val !== undefined ? (typeof val === 'number' && val % 1 !== 0 ? val.toFixed(2) : String(val)) : 'N/A';
                        return (
                          <option key={ds.id} value={ds.id}>{ds.name} [{displayVal}]</option>
                        );
                      })}
                    </select>
                  )}
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                    <Activity size={12} />
                    {supportedTypes.length > 0 
                      ? `Supported types: ${supportedTypes.join(', ')}` 
                      : "No data binding required."}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Unit Suffix / Label</label>
                  <input 
                    type="text" 
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-blue-500 outline-none shadow-inner"
                    placeholder="e.g. %, kg, pcs"
                  />
                </div>
                {['metric', 'gauge', 'capacityBar', 'radialDonut'].includes(widgetItem.type) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Decimal Places</label>
                    <input 
                      type="number" 
                      name="decimals"
                      value={formData.decimals}
                      onChange={handleChange}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-blue-500 outline-none shadow-inner"
                      placeholder="e.g. 0, 1, 2"
                      min="0" max="10"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ================= APPEARANCE TAB ================= */}
          <div className={activeTab === 'appearance' ? 'block animate-in fade-in slide-in-from-right-4 duration-300' : 'hidden'}>
            <div className="space-y-5">
              
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Widget Icon</label>
                  <select 
                    name="iconName"
                    value={formData.iconName}
                    onChange={handleChange}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-blue-500 outline-none shadow-inner cursor-pointer"
                  >
                    <option value="">No Icon / Default</option>
                    <option value="Activity">Activity</option>
                    <option value="Users">Users</option>
                    <option value="Thermometer">Thermometer</option>
                    <option value="Car">Car</option>
                    <option value="Cpu">CPU</option>
                    <option value="Droplets">Droplets</option>
                    <option value="Zap">Zap / Energy</option>
                    <option value="Camera">Camera</option>
                    <option value="Eye">Eye</option>
                    <option value="BarChart2">Bar Chart</option>
                  </select>
                </div>

              {widgetItem.type === 'gauge' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Gauge Style</label>
                    <select 
                      name="gaugeStyle"
                      value={formData.gaugeStyle || 'half-circle'}
                      onChange={(e) => setFormData({ ...formData, gaugeStyle: e.target.value })}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-blue-500 outline-none shadow-inner cursor-pointer"
                    >
                      <option value="half-circle">Modern Half-Circle</option>
                      <option value="horseshoe">Horseshoe with Needle</option>
                    </select>
                  </div>
                  {formData.gaugeStyle !== 'horseshoe' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5 flex justify-between">
                        <span>Tube Thickness</span>
                        <span className="text-blue-400">{formData.thickness || 16}%</span>
                      </label>
                      <input 
                        type="range" 
                        name="thickness"
                        min="4" 
                        max="40" 
                        value={formData.thickness || 16}
                        onChange={(e) => setFormData({ ...formData, thickness: parseInt(e.target.value) })}
                        className="w-full accent-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Adjust the thickness of the gauge donut tube.</p>
                    </div>
                  )}
                </div>
              )}

              {widgetItem.type === 'capacityBar' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Bar Orientation</label>
                    <select 
                      name="orientation"
                      value={formData.orientation || 'vertical'}
                      onChange={(e) => setFormData({ ...formData, orientation: e.target.value })}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-blue-500 outline-none shadow-inner cursor-pointer"
                    >
                      <option value="vertical">Vertical</option>
                      <option value="horizontal">Horizontal</option>
                    </select>
                  </div>
                </div>
              )}

              {(widgetItem.type === 'gauge' || widgetItem.type === 'capacityBar') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Base Theme Color</label>
                      <div className="flex gap-2">
                        <input 
                          type="color" 
                          name="color"
                          value={formData.color || '#10B981'}
                          onChange={handleChange}
                          className="h-9 w-10 bg-gray-950 border border-gray-700 rounded cursor-pointer"
                        />
                        <input 
                          type="text" 
                          name="color"
                          value={formData.color || '#10B981'}
                          onChange={handleChange}
                          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white text-sm outline-none uppercase font-mono"
                          placeholder="#10B981"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5 flex justify-between">
                        <span>Value Font Scale</span>
                        <span className="text-blue-400">{formData.valueFontSize || 1}x</span>
                      </label>
                      <input 
                        type="range" 
                        name="valueFontSize"
                        min="0.5" 
                        max="3" 
                        step="0.1"
                        value={formData.valueFontSize || 1}
                        onChange={handleChange}
                        className="w-full accent-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5 flex justify-between">
                        <span>Unit / Label Scale</span>
                        <span className="text-blue-400">{formData.unitFontSize || 1}x</span>
                      </label>
                      <input 
                        type="range" 
                        name="unitFontSize"
                        min="0.5" 
                        max="3" 
                        step="0.1"
                        value={formData.unitFontSize || 1}
                        onChange={handleChange}
                        className="w-full accent-blue-500"
                      />
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border transition-colors ${formData.enableDynamicColors ? 'bg-gray-950/50 border-gray-800' : 'bg-transparent border-transparent'}`}>
                    <ToggleSwitch 
                      label="Dynamic Colors & Ranges" 
                      checked={formData.enableDynamicColors} 
                      onChange={(e) => setFormData({ ...formData, enableDynamicColors: e.target.checked })} 
                    />
                    
                    {formData.enableDynamicColors && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 mt-4">

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Color Display Mode</label>
                      <select 
                        name="colorMode"
                        value={formData.colorMode || 'segmented'}
                        onChange={(e) => setFormData({ ...formData, colorMode: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:border-blue-500 outline-none h-9"
                      >
                        <option value="segmented">Segmented</option>
                        <option value="solid">Solid Thresholds</option>
                      </select>
                    </div>

                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-medium text-gray-400">Color Stops (Up to %)</label>
                    {(formData.colorStops || []).map((stop, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="number"
                          value={stop.limit}
                          onChange={(e) => handleUpdateColorStop(index, 'limit', e.target.value)}
                          className="w-20 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white text-sm text-center"
                          placeholder="%"
                        />
                        <input
                          type="color"
                          value={stop.color}
                          onChange={(e) => handleUpdateColorStop(index, 'color', e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border border-gray-700"
                        />
                        <input
                          type="text"
                          value={stop.color}
                          onChange={(e) => handleUpdateColorStop(index, 'color', e.target.value)}
                          className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white text-sm uppercase font-mono"
                        />
                        <button
                          onClick={() => handleRemoveColorStop(index)}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          title="Remove Stop"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={handleAddColorStop}
                      className="w-full mt-2 py-2 border border-dashed border-gray-700 rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-500 hover:bg-gray-800/50 transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="text-lg leading-none mb-0.5">+</span> Add Color Stop
                    </button>
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                      Define the upper percentage limits (0-100) and their colors.<br/>
                      E.g., <span className="text-green-400">25% Green</span>, <span className="text-yellow-400">50% Yellow</span>, <span className="text-red-400">100% Red</span>.
                    </p>
                  </div>
                    </div>
                  )}
                  </div>
                </>
              )}

              {widgetItem.type === 'chart' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Chart Type</label>
                      <select 
                        name="chartType"
                        value={formData.chartType}
                        onChange={handleChange}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-blue-500 outline-none shadow-inner cursor-pointer"
                      >
                        <option value="stepAfter">Step Line (Digital)</option>
                        <option value="monotone">Smooth Line (Analog)</option>
                        <option value="area">Area Chart</option>
                        <option value="bar">Bar Chart</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Base Theme Color</label>
                      <div className="flex gap-2">
                        <input 
                          type="color" 
                          name="color"
                          value={formData.color}
                          onChange={handleChange}
                          className="h-10 w-12 bg-gray-950 border border-gray-700 rounded-lg cursor-pointer"
                        />
                        <input 
                          type="text" 
                          name="color"
                          value={formData.color}
                          onChange={handleChange}
                          className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none shadow-inner uppercase font-mono"
                          placeholder="#10B981"
                        />
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border transition-colors ${formData.enableVisualTweaks ? 'bg-gray-950/50 border-gray-800' : 'bg-transparent border-transparent'}`}>
                    <ToggleSwitch 
                      label="Visual Tweaks" 
                      checked={formData.enableVisualTweaks} 
                      onChange={(e) => setFormData({ ...formData, enableVisualTweaks: e.target.checked })} 
                    />
                    
                    {formData.enableVisualTweaks && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Line Thickness (px)</label>
                        <input 
                          type="number" 
                          name="strokeWidth"
                          value={formData.strokeWidth}
                          onChange={handleChange}
                          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-white text-sm focus:border-blue-500 outline-none"
                          min="1" max="10"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Fill Opacity (%)</label>
                        <input 
                          type="number" 
                          name="fillOpacity"
                          value={formData.fillOpacity}
                          onChange={handleChange}
                          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-white text-sm focus:border-blue-500 outline-none"
                          min="0" max="100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-800 p-2 rounded-lg transition-colors">
                        <input 
                          type="checkbox"
                          checked={formData.showDots}
                          onChange={(e) => setFormData({ ...formData, showDots: e.target.checked })}
                          className="rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-0"
                        />
                        <span className="text-sm text-gray-300">Show Data Points</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-800 p-2 rounded-lg transition-colors">
                        <input 
                          type="checkbox"
                          checked={formData.useGradient}
                          onChange={(e) => setFormData({ ...formData, useGradient: e.target.checked })}
                          className="rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-0"
                        />
                        <span className="text-sm text-gray-300">Gradient Area Fill</span>
                      </label>
                    </div>

                    <div className="border-t border-gray-800 pt-3">
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-800 p-2 rounded-lg transition-colors mb-2">
                        <input 
                          type="checkbox"
                          checked={formData.showGrid}
                          onChange={(e) => setFormData({ ...formData, showGrid: e.target.checked })}
                          className="rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-0"
                        />
                        <span className="text-sm text-gray-300">Show Background Grid</span>
                      </label>
                      
                      {formData.showGrid && (
                        <div className="pl-8 pr-2">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Grid Style</label>
                          <select
                            name="gridStyle"
                            value={formData.gridStyle}
                            onChange={handleChange}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-gray-300 text-sm focus:border-blue-500 outline-none"
                          >
                            <option value="3 3">Dashed (3 3)</option>
                            <option value="5 5">Large Dashed (5 5)</option>
                            <option value="0">Solid Line</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </div>
                </>
              )}
            </div>
          </div>

          {/* ================= LIMITS & ALERTS TAB ================= */}
          <div className={activeTab === 'limits' ? 'block animate-in fade-in slide-in-from-right-4 duration-300' : 'hidden'}>
            <div className="space-y-4">
              
              <div className={`p-4 rounded-xl border relative overflow-hidden transition-colors ${formData.enableUpperLimit ? 'bg-red-950/20 border-red-900/30' : 'bg-transparent border-transparent'}`}>
                {formData.enableUpperLimit && <div className="absolute top-0 left-0 w-1 h-full bg-red-500/50"></div>}
                <div className="mb-2">
                  <ToggleSwitch 
                    label={<span className="text-red-400 flex items-center gap-2">Upper Limit (Max)</span>}
                    checked={formData.enableUpperLimit} 
                    onChange={(e) => setFormData({ ...formData, enableUpperLimit: e.target.checked })} 
                  />
                </div>
                {formData.enableUpperLimit && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Value Trigger</label>
                    <div className="flex gap-0 overflow-hidden rounded-lg border border-gray-700 shadow-inner">
                      {widgetItem.type === 'metric' && (
                        <select 
                          name="thresholdCondition"
                          value={formData.thresholdCondition}
                          onChange={handleChange}
                          className="w-12 bg-gray-900 px-2 py-2 text-white text-sm border-r border-gray-700 outline-none"
                        >
                          <option value=">">&gt;</option>
                          <option value="<">&lt;</option>
                          <option value="==">=</option>
                        </select>
                      )}
                      <input 
                        type="number" 
                        name="threshold"
                        value={formData.threshold}
                        onChange={handleChange}
                        className="w-full bg-gray-950 px-3 py-2 text-white text-sm focus:bg-gray-900 outline-none transition-colors"
                        placeholder="e.g. 5000"
                      />
                    </div>
                  </div>
                  
                  {widgetItem.type === 'chart' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Display Label</label>
                        <input 
                          type="text" 
                          name="thresholdLabel"
                          value={formData.thresholdLabel}
                          onChange={handleChange}
                          className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none"
                          placeholder="e.g. Overheating"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Line Color</label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            name="thresholdColor"
                            value={formData.thresholdColor}
                            onChange={handleChange}
                            className="h-8 w-12 bg-gray-950 border border-gray-700 rounded cursor-pointer"
                          />
                          <div className="flex-1 text-xs text-gray-500 py-2 border border-gray-800 rounded bg-gray-900/50 px-2 text-center pointer-events-none uppercase">{formData.thresholdColor}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                </div>
                )}
              </div>

              <div className={`p-4 rounded-xl border relative overflow-hidden transition-colors ${formData.enableLowerLimit ? 'bg-blue-950/20 border-blue-900/30' : 'bg-transparent border-transparent'}`}>
                {formData.enableLowerLimit && <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50"></div>}
                <div className="mb-2">
                  <ToggleSwitch 
                    label={<span className="text-blue-400 flex items-center gap-2">Lower Limit (Min)</span>}
                    checked={formData.enableLowerLimit} 
                    onChange={(e) => setFormData({ ...formData, enableLowerLimit: e.target.checked })} 
                  />
                </div>
                {formData.enableLowerLimit && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Value Trigger (&lt;)</label>
                    <input 
                      type="number" 
                      name="thresholdMin"
                      value={formData.thresholdMin}
                      onChange={handleChange}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none shadow-inner"
                      placeholder="e.g. 10"
                    />
                  </div>
                  
                  {widgetItem.type === 'chart' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Display Label</label>
                        <input 
                          type="text" 
                          name="thresholdMinLabel"
                          value={formData.thresholdMinLabel}
                          onChange={handleChange}
                          className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none"
                          placeholder="e.g. Low Stock"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Line Color</label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            name="thresholdMinColor"
                            value={formData.thresholdMinColor}
                            onChange={handleChange}
                            className="h-8 w-12 bg-gray-950 border border-gray-700 rounded cursor-pointer"
                          />
                          <div className="flex-1 text-xs text-gray-500 py-2 border border-gray-800 rounded bg-gray-900/50 px-2 text-center pointer-events-none uppercase">{formData.thresholdMinColor}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                </div>
                )}
              </div>
              
              {(widgetItem.type === 'gauge' || widgetItem.type === 'capacityBar') && (
                <div className={`p-4 rounded-xl border transition-colors ${formData.enableDisplayScale ? 'bg-gray-950/50 border-gray-800' : 'bg-transparent border-transparent'}`}>
                  <ToggleSwitch 
                    label="Display Scale Range" 
                    checked={formData.enableDisplayScale} 
                    onChange={(e) => setFormData({ ...formData, enableDisplayScale: e.target.checked })} 
                  />
                  {formData.enableDisplayScale && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Minimum Value (0%)</label>
                      <input 
                        type="number" 
                        name="min"
                        value={formData.min !== undefined ? formData.min : ''}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm outline-none"
                        placeholder="Default: 0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Maximum Value (100%)</label>
                      <input 
                        type="number" 
                        name="max"
                        value={formData.max !== undefined ? formData.max : ''}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm outline-none"
                        placeholder="Default: 100"
                      />
                    </div>
                  </div>
                    </div>
                  )}
                </div>
              )}
              
              {widgetItem.type === 'chart' && (
                <div className={`p-4 rounded-xl border transition-colors ${formData.enableYAxisConstraints ? 'bg-gray-950/50 border-gray-800' : 'bg-transparent border-transparent'}`}>
                  <ToggleSwitch 
                    label="Y-Axis Constraints" 
                    checked={formData.enableYAxisConstraints} 
                    onChange={(e) => setFormData({ ...formData, enableYAxisConstraints: e.target.checked })} 
                  />
                  {formData.enableYAxisConstraints && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Fixed Min Value</label>
                      <input 
                        type="number" 
                        name="yMin"
                        value={formData.yMin}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm outline-none"
                        placeholder="Auto"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Fixed Max Value</label>
                      <input 
                        type="number" 
                        name="yMax"
                        value={formData.yMax}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm outline-none"
                        placeholder="Auto"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Auto Top Margin (%)</label>
                      <input 
                        type="number" 
                        name="yAxisMargin"
                        value={formData.yAxisMargin}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm outline-none"
                        placeholder="e.g. 20 (adds 20% space above highest peak)"
                        min="0" max="200"
                      />
                    </div>
                  </div>
                  </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ================= ADVANCED TAB ================= */}
          <div className={activeTab === 'advanced' ? 'block animate-in fade-in slide-in-from-right-4 duration-300' : 'hidden'}>
            <div className="space-y-5">

              {widgetItem.type === 'chart' && (
                <>
                  <div className="p-4 bg-gray-950/50 border border-gray-800 rounded-xl space-y-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Engine Settings</h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">X-Axis Timeframe Behavior</label>
                      <select 
                        name="lockTimeframe"
                        value={formData.lockTimeframe ? 'true' : 'false'}
                        onChange={(e) => setFormData({ ...formData, lockTimeframe: e.target.value === 'true' })}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none cursor-pointer"
                      >
                        <option value="false">Dynamic Auto-Fit (Zoom to actual data)</option>
                        <option value="true">Strict Locked Timeframe (Crop overflow)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Data Points Render Limit</label>
                      <input 
                        type="number" 
                        name="maxDataPoints"
                        value={formData.maxDataPoints}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none"
                        placeholder="e.g. 600"
                        min="100" max="5000"
                      />
                      <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                        Reduces browser memory usage by capping the number of SVG nodes drawn simultaneously. Default is 600.
                      </p>
                    </div>
                  </div>

                  <div className="border border-gray-800 bg-gray-950 rounded-xl p-4">
                     <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={formData.yAxisLogScale}
                          onChange={(e) => setFormData({ ...formData, yAxisLogScale: e.target.checked })}
                          className="w-5 h-5 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-0 cursor-pointer"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-300 block">Logarithmic Scale (Y-Axis)</span>
                          <span className="text-xs text-gray-500">Best for displaying exponentially growing data or datasets with massive variance.</span>
                        </div>
                      </label>
                  </div>
                </>
              )}

            </div>
          </div>

            </div>
          </div>

          {/* Right Side: Preview */}
          <div className={`w-[360px] flex flex-col p-6 shrink-0 relative ${isDark ? 'bg-[#0b0e14]' : 'bg-[#f1f5f9]'}`}>
             <h4 className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Live Preview</h4>
             <div className="flex-1 flex items-center justify-center">
                <div 
                   className="w-full relative flex items-center justify-center"
                   style={{ 
                     aspectRatio: `${(widgetItem?.w || 4) * 100 + ((widgetItem?.w || 4) - 1) * 12} / ${(widgetItem?.h || 3) * 75 + ((widgetItem?.h || 3) - 1) * 12}`,
                     maxHeight: '350px'
                   }}
                >
                   {/* Wrapping in an absolute container ensures the inner widget treats this as its fixed boundary, perfectly mimicking the grid item */}
                   <div className="absolute inset-0 w-full h-full overflow-hidden rounded-xl">
                      {renderPreview()}
                   </div>
                </div>
             </div>
             
             <div className={`mt-auto text-[10px] italic text-center px-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
               Note: The preview shows sample data to help you style the widget.
             </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-900 p-5 border-t border-gray-800 flex justify-end gap-3 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.5)] z-10 shrink-0">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 bg-transparent hover:bg-gray-800 text-gray-300 rounded-lg text-sm font-medium transition-colors border border-gray-700"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
          >
            <Save size={16} /> Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
