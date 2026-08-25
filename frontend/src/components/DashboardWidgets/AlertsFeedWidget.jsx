import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';

export default function AlertsFeedWidget({ metadata }) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    // Simple mock logic: if metadata has more than 5 detections, trigger a mock alert
    if (metadata && metadata.detections && metadata.detections.length > 5) {
      const newAlert = {
        id: Date.now(),
        time: new Date().toLocaleTimeString(),
        message: 'High object density detected!',
        level: 'warning'
      };
      setAlerts(prev => [newAlert, ...prev].slice(0, 50));
    }
  }, [metadata]);

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
      <div className="bg-gray-800/80 px-3 py-2 flex items-center justify-between border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-red-400" />
          <span className="text-sm font-semibold text-gray-200">Alerts Feed</span>
        </div>
        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{alerts.length}</span>
      </div>
      
      <div className="flex-1 p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
        {alerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-2">
            <Bell size={24} className="opacity-20" />
            <span className="text-sm">No recent alerts</span>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map(alert => (
              <div key={alert.id} className="bg-gray-800/50 border border-red-900/30 p-2 rounded-lg text-sm flex gap-2 items-start">
                <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0 animate-pulse"></div>
                <div>
                  <div className="text-gray-400 text-xs">{alert.time}</div>
                  <div className="text-gray-200">{alert.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
