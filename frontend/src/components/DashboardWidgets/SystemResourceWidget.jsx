import React, { useState, useEffect } from 'react';
import { Activity, Cpu, MemoryStick, Thermometer } from 'lucide-react';

export default function SystemResourceWidget() {
  const [metrics, setMetrics] = useState({ cpu_percent: 0, ram_percent: 0, temp_c: 0 });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:8000/ws/system_metrics`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMetrics(data);
      } catch (err) {}
    };

    return () => {
      ws.close();
    };
  }, []);

  const isRamHigh = metrics.ram_percent > 80;
  const isTempHigh = metrics.temp_c > 80;

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
      <div className="bg-gray-800/80 px-3 py-2 flex items-center justify-between border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-orange-400" />
          <span className="text-sm font-semibold text-gray-200">System Resources</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
      </div>
      
      <div className="flex-1 p-4 flex flex-col justify-around">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-400">
            <Cpu size={18} /> <span className="text-sm">CPU</span>
          </div>
          <div className="w-1/2 bg-gray-800 rounded-full h-2 overflow-hidden">
            <div className="bg-blue-500 h-full" style={{ width: `${metrics.cpu_percent}%` }}></div>
          </div>
          <span className="text-sm font-mono text-white w-10 text-right">{metrics.cpu_percent.toFixed(0)}%</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-400">
            <MemoryStick size={18} /> <span className="text-sm">RAM</span>
          </div>
          <div className="w-1/2 bg-gray-800 rounded-full h-2 overflow-hidden">
            <div className={`h-full ${isRamHigh ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${metrics.ram_percent}%` }}></div>
          </div>
          <span className={`text-sm font-mono w-10 text-right ${isRamHigh ? 'text-red-400 font-bold' : 'text-white'}`}>
            {metrics.ram_percent.toFixed(0)}%
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-400">
            <Thermometer size={18} /> <span className="text-sm">TEMP</span>
          </div>
          <div className="w-1/2 bg-gray-800 rounded-full h-2 overflow-hidden">
            <div className={`h-full ${isTempHigh ? 'bg-red-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(100, (metrics.temp_c / 85) * 100)}%` }}></div>
          </div>
          <span className={`text-sm font-mono w-12 text-right ${isTempHigh ? 'text-red-400 font-bold' : 'text-white'}`}>
            {metrics.temp_c.toFixed(1)}°C
          </span>
        </div>

      </div>
    </div>
  );
}
