import React, { useState, useEffect } from 'react';
import { Cpu, MemoryStick, Thermometer } from 'lucide-react';

export default function ResourceMonitor() {
  const [metrics, setMetrics] = useState({ cpu_percent: 0, ram_percent: 0, temp_c: 0 });

  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:8000/ws/system_metrics`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("System metrics received:", data);
        setMetrics(data);
      } catch (err) {
        console.error("System metrics parse error:", err);
      }
    };
    
    ws.onerror = (error) => {
      console.error("System metrics WS error:", error);
    };

    return () => {
      ws.close();
    };
  }, []);

  const isRamHigh = metrics.ram_percent > 80;
  const isTempHigh = metrics.temp_c > 80;

  return (
    <div className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 shadow-lg">
      <div className="flex items-center gap-2" title="CPU Usage">
        <Cpu size={16} className="text-blue-400" />
        <span className="text-sm font-mono text-gray-300 w-12">{metrics.cpu_percent.toFixed(1)}%</span>
      </div>
      
      <div className="flex items-center gap-2" title="RAM Usage">
        <MemoryStick size={16} className={isRamHigh ? "text-red-500 animate-pulse" : "text-green-400"} />
        <span className={`text-sm font-mono w-12 ${isRamHigh ? "text-red-400 font-bold" : "text-gray-300"}`}>
          {metrics.ram_percent.toFixed(1)}%
        </span>
      </div>

      <div className="flex items-center gap-2" title="Temperature">
        <Thermometer size={16} className={isTempHigh ? "text-red-500 animate-pulse" : "text-orange-400"} />
        <span className={`text-sm font-mono w-12 ${isTempHigh ? "text-red-400 font-bold" : "text-gray-300"}`}>
          {metrics.temp_c.toFixed(1)}°C
        </span>
      </div>
    </div>
  );
}
