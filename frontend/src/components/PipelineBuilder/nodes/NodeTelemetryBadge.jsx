import React from 'react';
import { Cpu, Zap, Activity } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';

export default function NodeTelemetryBadge({ nodeId }) {
  const telemetryData = usePipelineStore((state) => state.telemetryData);
  const showMetricsOverlay = usePipelineStore((state) => state.showMetricsOverlay);

  if (!showMetricsOverlay || !telemetryData?.pipelines) {
    return null;
  }

  // Find node metric across all running pipelines
  let nodeStat = null;
  for (const pipe of telemetryData.pipelines) {
    const found = pipe.nodes?.find((n) => n.node_id === nodeId);
    if (found) {
      nodeStat = found;
      break;
    }
  }

  if (!nodeStat) return null;

  const isAi = nodeStat.node_type === 'aiNode';
  const cpuVal = nodeStat.cpu_percent || 0;
  const npuVal = nodeStat.npu_percent || 0;
  const latency = isAi ? nodeStat.npu_latency_ms : nodeStat.latency_ms;
  const rate = nodeStat.fps > 0 ? `${nodeStat.fps.toFixed(0)} FPS` : nodeStat.freq_hz > 0 ? `${nodeStat.freq_hz.toFixed(0)} Hz` : null;

  const isHighLoad = cpuVal > 50 || npuVal > 80;

  return (
    <div className="mt-2 pt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px] font-mono select-none">
      <div className="flex items-center gap-1.5 text-gray-300">
        <span className="flex items-center gap-0.5 text-blue-400">
          <Cpu size={11} />
          <span>{cpuVal.toFixed(1)}%</span>
        </span>

        {isAi && (
          <span className="flex items-center gap-0.5 text-purple-400 font-semibold pl-1 border-l border-gray-800">
            <Zap size={11} className={npuVal > 0 ? 'text-purple-400 animate-pulse' : ''} />
            <span>{npuVal.toFixed(0)}%</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 text-[10px]">
        {latency > 0 && (
          <span className={latency > 35 ? 'text-amber-400 font-bold' : 'text-gray-400'}>
            {latency.toFixed(1)}ms
          </span>
        )}
        {rate && (
          <span className="text-gray-500 font-medium pl-1 border-l border-gray-800">
            {rate}
          </span>
        )}
      </div>
    </div>
  );
}
