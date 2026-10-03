import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function SystemClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 text-gray-600 bg-gray-100/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 px-3 py-1.5 rounded-lg text-sm font-medium shadow-inner hidden sm:flex dark:text-gray-400">
      <Clock size={16} className="text-teal-500" />
      <span>{time.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
    </div>
  );
}
