import React, { useState, useEffect } from 'react';
import { Cpu, Zap, MemoryStick, Thermometer, ChevronRight } from 'lucide-react';
import ResourceMonitorModal from './ResourceMonitorModal';
import usePipelineStore from '../store/usePipelineStore';

export default function ResourceMonitor() {
  const [telemetry, setTelemetry] = useState(null);
  const [history, setHistory] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showMobileDetails, setShowMobileDetails] = useState(false);

  const setStoreTelemetry = usePipelineStore((state) => state.setTelemetryData);

  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:8000/ws/system_metrics`;
    let ws = null;
    let reconnectTimeout = null;

    const connectWs = () => {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setTelemetry(data);
          if (setStoreTelemetry) {
            setStoreTelemetry(data);
          }

          const cpuVal = data.system?.cpu_percent ?? data.cpu_percent ?? 0;
          const npuVal = data.system?.npu_percent ?? data.npu_percent ?? 0;
          const tempVal = data.system?.temp_c ?? data.temp_c ?? 0;

          setHistory((prev) => {
            const now = new Date();
            const timeStr = `${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
            const next = [...prev, { time: timeStr, cpu: cpuVal, npu: npuVal, temp: tempVal }];
            return next.slice(-40);
          });
        } catch (err) {
          console.error("System metrics parse error:", err);
        }
      };

      ws.onerror = (error) => {
        console.error("System metrics WS error:", error);
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWs, 3000);
      };
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [setStoreTelemetry]);

  const cpuPercent = telemetry?.system?.cpu_percent ?? telemetry?.cpu_percent ?? 0;
  const npuPercent = telemetry?.system?.npu_percent ?? telemetry?.npu_percent ?? 0;
  const ramPercent = telemetry?.system?.ram_percent ?? telemetry?.ram_percent ?? 0;
  const tempC = telemetry?.system?.temp_c ?? telemetry?.temp_c ?? 0;

  const isRamHigh = ramPercent > 80;
  const isTempHigh = tempC > 75;
  const isCpuHigh = cpuPercent > 80;
  const isNpuHigh = npuPercent > 85;

  return (
    <>
      {/* Desktop / Tablet Bar - Clickable to open deep telemetry modal */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="hidden sm:flex items-center gap-3 md:gap-4 bg-gray-900/90 hover:bg-gray-850 border border-gray-800 hover:border-gray-700 rounded-xl px-3.5 py-1.5 shadow-lg transition-all cursor-pointer group"
        title="Click to view detailed CPU & NPU breakdown by Process, Pipeline, and Node"
      >
        {/* CPU */}
        <div className="flex items-center gap-1.5" title="CPU Usage (Click for details)">
          <Cpu size={15} className="text-blue-400 shrink-0 group-hover:scale-110 transition-transform" />
          <span className={`text-xs font-mono w-11 ${isCpuHigh ? 'text-red-400 font-bold' : 'text-gray-300'}`}>
            {cpuPercent.toFixed(1)}%
          </span>
        </div>

        {/* NPU (Hailo) */}
        <div className="flex items-center gap-1.5 pl-1 border-l border-gray-800" title="Hailo-8L NPU Usage (Click for details)">
          <Zap size={15} className={`shrink-0 transition-transform group-hover:scale-110 ${npuPercent > 0 ? 'text-purple-400 animate-pulse' : 'text-purple-400/60'}`} />
          <span className={`text-xs font-mono w-11 ${isNpuHigh ? 'text-red-400 font-bold' : npuPercent > 0 ? 'text-purple-300 font-medium' : 'text-gray-400'}`}>
            {npuPercent.toFixed(1)}%
          </span>
        </div>

        {/* RAM */}
        <div className="flex items-center gap-1.5 pl-1 border-l border-gray-800" title="RAM Usage">
          <MemoryStick size={15} className={isRamHigh ? "text-red-500 animate-pulse shrink-0" : "text-emerald-400 shrink-0"} />
          <span className={`text-xs font-mono w-11 ${isRamHigh ? "text-red-400 font-bold" : "text-gray-300"}`}>
            {ramPercent.toFixed(1)}%
          </span>
        </div>

        {/* Temperature */}
        <div className="flex items-center gap-1.5 pl-1 border-l border-gray-800" title="SoC Temperature">
          <Thermometer size={15} className={isTempHigh ? "text-red-500 animate-pulse shrink-0" : "text-orange-400 shrink-0"} />
          <span className={`text-xs font-mono w-11 ${isTempHigh ? "text-red-400 font-bold" : "text-gray-300"}`}>
            {tempC ? `${tempC.toFixed(0)}°C` : 'N/A'}
          </span>
        </div>

        <div className="text-[10px] text-gray-500 group-hover:text-blue-400 flex items-center pl-1 border-l border-gray-800">
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </button>

      {/* Mobile Compact View (< sm) */}
      <div className="sm:hidden relative">
        <button
          type="button"
          onClick={() => setShowMobileDetails(prev => !prev)}
          className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs font-mono shadow-md text-gray-300 active:scale-95 transition-transform"
          title="Tap to see system resources"
        >
          <Cpu size={14} className="text-blue-400" />
          <span>{cpuPercent.toFixed(0)}%</span>
          <Zap size={14} className="text-purple-400 ml-0.5" />
          <span>{npuPercent.toFixed(0)}%</span>
          <span className={`w-2 h-2 rounded-full ${isRamHigh || isTempHigh ? 'bg-red-500 animate-ping' : 'bg-green-500'}`} />
        </button>

        {showMobileDetails && (
          <div 
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs" 
            onClick={() => setShowMobileDetails(false)}
          />
        )}

        {showMobileDetails && (
          <div className="absolute right-0 mt-2 z-50 w-56 bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-2xl flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800 pb-1 flex justify-between">
              <span>System &amp; NPU</span>
              <span className="text-green-400 font-medium">Online</span>
            </div>
            
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-gray-300">
                <Cpu size={14} className="text-blue-400" /> CPU
              </span>
              <span className="text-gray-200">{cpuPercent.toFixed(1)}%</span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-purple-300">
                <Zap size={14} className="text-purple-400" /> NPU Hailo
              </span>
              <span className="text-purple-200 font-medium">{npuPercent.toFixed(1)}%</span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-gray-300">
                <MemoryStick size={14} className={isRamHigh ? "text-red-400" : "text-green-400"} /> RAM
              </span>
              <span className={isRamHigh ? "text-red-400 font-bold" : "text-gray-200"}>
                {ramPercent.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-gray-300">
                <Thermometer size={14} className={isTempHigh ? "text-red-400" : "text-orange-400"} /> Temp
              </span>
              <span className={isTempHigh ? "text-red-400 font-bold" : "text-gray-200"}>
                {tempC.toFixed(1)}°C
              </span>
            </div>

            <button
              onClick={() => {
                setShowMobileDetails(false);
                setIsModalOpen(true);
              }}
              className="mt-1 w-full py-1.5 px-2 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 text-[11px] font-medium text-center hover:bg-blue-600/30 transition-colors"
            >
              Open Full Telemetry Breakdown
            </button>
          </div>
        )}
      </div>

      {/* Detailed Modal */}
      <ResourceMonitorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        telemetry={telemetry}
        history={history}
      />
    </>
  );
}
