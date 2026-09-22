import React, { useState, useEffect, useRef } from 'react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend 
} from 'recharts';
import { BarChart2 } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];

function getNestedValue(obj, path) {
    if (!path) return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

export default function ChartWidget({ title, config = {}, paths = [], metadata, icon: Icon = BarChart2 }) {
  const [historyData, setHistoryData] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [zoomDomain, setZoomDomain] = useState(null);
  
  const lastUpdateRef = useRef({});
  const chartWrapperRef = useRef(null);
  const boundsRef = useRef({ min: 0, max: 0 });

  const chartType = config.chartType || 'stepAfter'; // stepAfter, monotone, area, bar
  const baseColor = config.color || COLORS[0];
  const threshold = (config.threshold !== undefined && config.threshold !== '') ? parseFloat(config.threshold) : null;
  const yMin = (config.yMin !== undefined && config.yMin !== '') ? parseFloat(config.yMin) : 'auto';
  const yMax = (config.yMax !== undefined && config.yMax !== '') ? parseFloat(config.yMax) : 'auto';
  
  const timeframeMap = {
      '5m': { tf: 5, aggr: null },
      '15m': { tf: 15, aggr: null },
      '1h': { tf: 60, aggr: 1 },
      '24h': { tf: 1440, aggr: 10 }
  };
  const tfConfig = timeframeMap[config.timeframe] || timeframeMap['5m'];

  // Extract nodeIds
  const nodeIds = paths.map(p => {
    const match = p.match(/^dashboard\.(.+?)\.(?:value|history)$/);
    return match ? match[1] : null;
  }).filter(Boolean);

  // Fetch history on mount
  useEffect(() => {
    if (nodeIds.length === 0) {
      setIsLoaded(true);
      return;
    }

    let urlParams = `?limit=1000&timeframe_min=${tfConfig.tf}`;
    if (tfConfig.aggr) urlParams += `&aggregate_min=${tfConfig.aggr}`;

    Promise.all(nodeIds.map(id => 
        fetch(`/api/nodes/${id}/history${urlParams}`).then(r => r.json()).then(res => ({ id, data: res.data || [] }))
    ))
    .then(results => {
        let merged = [];
        results.forEach(({ id, data }) => {
            data.forEach(item => {
                merged.push({
                    timestamp_unix: item.timestamp_unix,
                    time: item.time,
                    [id]: item.value
                });
            });
        });
        
        // Sort by time
        merged.sort((a, b) => a.timestamp_unix - b.timestamp_unix);
        setHistoryData(merged);
        setIsLoaded(true);
    })
    .catch(err => {
        console.error("Failed to fetch TSDB history", err);
        setIsLoaded(true);
    });
  }, [config.dataPaths, config.dataPath, config.timeframe]);

  // Listen to live updates
  useEffect(() => {
    if (!isLoaded || nodeIds.length === 0 || !metadata) return;

    let newPoint = { timestamp_unix: Date.now() / 1000, time: new Date().toLocaleTimeString() };
    let hasChanges = false;

    nodeIds.forEach(id => {
        const livePath = `dashboard.${id}`;
        const nodeData = getNestedValue(metadata, livePath);
        if (nodeData && nodeData.value !== undefined) {
            
            let tsUnix = Date.now() / 1000;
            if (nodeData.msg?.metadata?.timestamp) {
                tsUnix = nodeData.msg.metadata.timestamp;
            }
            const tsUnixInt = Math.floor(tsUnix);
            
            // Check if value changed to throttle updates
            if (lastUpdateRef.current[id] !== nodeData.value) {
                newPoint[id] = nodeData.value;
                newPoint.timestamp_unix = tsUnixInt;
                newPoint.time = new Date(tsUnixInt * 1000).toLocaleTimeString();
                lastUpdateRef.current[id] = nodeData.value;
                hasChanges = true;
            }
        }
    });

    if (hasChanges) {
        setHistoryData(prev => {
            const newHistory = [...prev, newPoint];
            // Keep a reasonable number of points for live viewing if no aggregation
            if (!tfConfig.aggr && newHistory.length > 500) return newHistory.slice(-500);
            return newHistory;
        });
    }
  }, [metadata, isLoaded]);

  // Chart Component Selection
  const ChartComponent = chartType === 'bar' ? BarChart : (chartType === 'area' ? AreaChart : LineChart);
  const DataComponent = chartType === 'bar' ? Bar : (chartType === 'area' ? Area : Line);
  
  const lineType = chartType === 'stepAfter' ? 'stepAfter' : 'monotone';
  const lockTimeframe = config.lockTimeframe || false;
  
  // Track base bounds for zooming
  if (lockTimeframe) {
      boundsRef.current.max = Math.floor(Date.now() / 1000);
      boundsRef.current.min = boundsRef.current.max - (tfConfig.tf * 60);
  } else if (historyData.length > 0) {
      boundsRef.current.min = historyData[0].timestamp_unix;
      boundsRef.current.max = historyData[historyData.length - 1].timestamp_unix;
  }

  // Handle Wheel Zoom
  useEffect(() => {
    const el = chartWrapperRef.current;
    if (!el) return;
    
    const handleWheel = (e) => {
      e.preventDefault();
      
      setZoomDomain(prevZoom => {
          let currentMin = prevZoom ? prevZoom[0] : boundsRef.current.min;
          let currentMax = prevZoom ? prevZoom[1] : boundsRef.current.max;
          
          if (currentMin >= currentMax) return prevZoom;
          
          const range = currentMax - currentMin;
          const rect = el.getBoundingClientRect();
          const offsetX = e.clientX - rect.left;
          const plotLeft = 60; // Approx YAxis width
          const plotRight = rect.width - 20;
          const plotWidth = plotRight - plotLeft;
          
          let ratio = 0.5;
          if (offsetX >= plotLeft && offsetX <= plotRight) {
              ratio = (offsetX - plotLeft) / plotWidth;
          }
          
          const mouseTime = currentMin + ratio * range;
          const zoomFactor = e.deltaY < 0 ? 0.75 : 1.25; // 25% zoom
          let newRange = range * zoomFactor;
          
          if (newRange < 10) newRange = 10; // Max zoom limit (10 seconds)
          if (newRange > 86400 * 30) newRange = 86400 * 30; // Min zoom limit (30 days)
          
          return [mouseTime - newRange * ratio, mouseTime + newRange * (1 - ratio)];
      });
    };
    
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);
  
  let xDomain = zoomDomain || ['dataMin', 'dataMax'];
  let xAxisProps = {
      dataKey: "timestamp_unix",
      type: "number",
      domain: xDomain,
      tickFormatter: (unixTime) => new Date(unixTime * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: zoomDomain ? '2-digit' : undefined}),
      minTickGap: 30
  };
  
  if (lockTimeframe && !zoomDomain) {
      let now = Math.floor(Date.now() / 1000);
      if (historyData.length > 0) {
          now = historyData[historyData.length - 1].timestamp_unix;
      }
      
      const minTs = now - (tfConfig.tf * 60);
      
      xDomain = [minTs, now];
      
      // Calculate nice stable ticks based on timeframe
      const ticks = [];
      let tickInterval = 60; // default 1 min for 5m timeframe
      if (tfConfig.tf === 15) tickInterval = 300; // 5 min
      else if (tfConfig.tf === 60) tickInterval = 900; // 15 min
      else if (tfConfig.tf === 1440) tickInterval = 14400; // 4 hours
      
      const firstTick = Math.ceil(minTs / tickInterval) * tickInterval;
      for (let t = firstTick; t <= now; t += tickInterval) {
          ticks.push(t);
      }
      
      xAxisProps = {
          dataKey: "timestamp_unix",
          type: "number",
          domain: xDomain,
          ticks: ticks,
          tickFormatter: (unixTime) => new Date(unixTime * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          minTickGap: 30
      };
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl p-4">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Icon size={20} className="text-emerald-400" />
          <h3 className="text-gray-400 font-semibold text-sm uppercase tracking-wider">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {zoomDomain && (
            <button 
              onClick={() => setZoomDomain(null)}
              className="text-xs text-blue-400 bg-blue-900/30 hover:bg-blue-900/50 px-2 py-1 rounded transition-colors"
            >
              Reset Zoom
            </button>
          )}
          {config.timeframe && <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">{config.timeframe} {lockTimeframe && '(Locked)'}</span>}
        </div>
      </div>
      <div 
        className="flex-1 min-h-[150px] cursor-crosshair relative"
        ref={chartWrapperRef}
        onDoubleClick={() => setZoomDomain(null)}
      >
        {historyData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ChartComponent data={historyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis 
                {...xAxisProps}
                stroke="#9ca3af" 
                fontSize={12}
              />
              <YAxis 
                stroke="#9ca3af" 
                fontSize={12} 
                domain={[yMin, yMax]}
                allowDataOverflow={true}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
              />
              
              {nodeIds.length > 1 && <Legend wrapperStyle={{ fontSize: '12px' }} />}
              
              {threshold !== null && !isNaN(threshold) && (
                  <ReferenceLine y={threshold} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Threshold', fill: '#ef4444', fontSize: 10 }} />
              )}
              
              {nodeIds.map((id, index) => {
                  const color = index === 0 ? baseColor : COLORS[index % COLORS.length];
                  return (
                      <DataComponent 
                        key={id}
                        type={lineType}
                        dataKey={id}
                        name={`Node: ${id.split('_')[0]}`}
                        stroke={color} 
                        fill={chartType === 'area' ? color : color}
                        fillOpacity={0.2}
                        strokeWidth={2} 
                        dot={false}
                        activeDot={{ r: 6 }}
                        isAnimationActive={false}
                        connectNulls={true}
                      />
                  );
              })}
            </ChartComponent>
          </ResponsiveContainer>
        ) : (
          <div className="text-gray-500 text-sm italic flex items-center justify-center h-full">
            Waiting for data...
          </div>
        )}
      </div>
    </div>
  );
}
