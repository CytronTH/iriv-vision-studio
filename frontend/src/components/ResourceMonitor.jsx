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

  const [showMobileDetails, setShowMobileDetails] = useState(false);

  return (
    <>
      {/* Desktop / Tablet View */}
      <div className="hidden sm:flex items-center gap-3 md:gap-4 bg-gray-900 border border-gray-800 rounded-lg px-3 md:px-4 py-2 shadow-lg">
        <div className="flex items-center gap-1.5 md:gap-2" title="CPU Usage">
          <Cpu size={16} className="text-blue-400 shrink-0" />
          <span className="text-xs md:text-sm font-mono text-gray-300 w-11 md:w-12">{metrics.cpu_percent.toFixed(1)}%</span>
        </div>
        
        <div className="flex items-center gap-1.5 md:gap-2" title="RAM Usage">
          <MemoryStick size={16} className={isRamHigh ? "text-red-500 animate-pulse shrink-0" : "text-green-400 shrink-0"} />
          <span className={`text-xs md:text-sm font-mono w-11 md:w-12 ${isRamHigh ? "text-red-400 font-bold" : "text-gray-300"}`}>
            {metrics.ram_percent.toFixed(1)}%
          </span>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2" title="Temperature">
          <Thermometer size={16} className={isTempHigh ? "text-red-500 animate-pulse shrink-0" : "text-orange-400 shrink-0"} />
          <span className={`text-xs md:text-sm font-mono w-11 md:w-12 ${isTempHigh ? "text-red-400 font-bold" : "text-gray-300"}`}>
            {metrics.temp_c.toFixed(1)}°C
          </span>
        </div>
      </div>

      {/* Mobile Compact View (< sm) */}
      <div className="sm:hidden relative">
        <button
          type="button"
          onClick={() => setShowMobileDetails(prev => !prev)}
          className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs font-mono shadow-md text-gray-300 active:scale-95 transition-transform"
          title="Tap to see system resources"
        >
          <Cpu size={14} className="text-blue-400" />
          <span>{metrics.cpu_percent.toFixed(0)}%</span>
          <span className={`w-2 h-2 rounded-full ${isRamHigh || isTempHigh ? 'bg-red-500 animate-ping' : 'bg-green-500'}`} />
        </button>

        {showMobileDetails && (
          <div 
            className="fixed inset-0 z-40 bg-black/20" 
            onClick={() => setShowMobileDetails(false)}
          />
        )}

        {showMobileDetails && (
          <div className="absolute right-0 mt-2 z-50 w-48 bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-2xl flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800 pb-1 flex justify-between">
              <span>System Status</span>
              <span className="text-green-400 font-medium">Online</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-gray-300">
                <Cpu size={14} className="text-blue-400" /> CPU
              </span>
              <span className="text-gray-200">{metrics.cpu_percent.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-gray-300">
                <MemoryStick size={14} className={isRamHigh ? "text-red-400" : "text-green-400"} /> RAM
              </span>
              <span className={isRamHigh ? "text-red-400 font-bold" : "text-gray-200"}>
                {metrics.ram_percent.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-gray-300">
                <Thermometer size={14} className={isTempHigh ? "text-red-400" : "text-orange-400"} /> Temp
              </span>
              <span className={isTempHigh ? "text-red-400 font-bold" : "text-gray-200"}>
                {metrics.temp_c.toFixed(1)}°C
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
