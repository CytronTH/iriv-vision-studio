import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Download, RefreshCw, Calendar, TrendingUp } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

const CLASS_COLORS = [
  '#38bdf8', // sky-400
  '#34d399', // emerald-400
  '#a78bfa', // violet-400
  '#fb923c', // orange-400
  '#f472b6', // pink-400
  '#facc15', // amber-400
  '#2dd4bf', // teal-400
  '#818cf8'  // indigo-400
];

export default function HistoricalChartWidget({ projectId = 'default', config = {} }) {
  const [data, setData] = useState([]);
  const [classes, setClasses] = useState([]);
  const [interval, setInterval] = useState('hour'); // 'minute', 'hour', 'day'
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const title = config?.title || 'Historical Flow Activity';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/counts/history?project_id=${encodeURIComponent(projectId)}&interval=${interval}`);
      const json = await res.json();
      if (json.status === 'success') {
        setData(json.data || []);
        setClasses(json.classes || []);
      }
    } catch (err) {
      console.error('Failed to load historical analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, interval]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const handleExportCSV = () => {
    setExporting(true);
    const downloadUrl = `/api/analytics/counts/export-csv?project_id=${encodeURIComponent(projectId)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setExporting(false), 1000);
  };

  const formatXAxis = (tickItem) => {
    if (!tickItem) return '';
    const parts = tickItem.split(' ');
    if (interval === 'day') return parts[0];
    if (interval === 'minute' || interval === 'hour') return parts[1] || tickItem;
    return tickItem;
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
      {/* Header Toolbar */}
      <div className="bg-gray-800/80 px-3.5 py-2.5 flex items-center justify-between border-b border-gray-700/80 shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-teal-400" />
          <span className="text-xs sm:text-sm font-semibold text-gray-200">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Interval Selector */}
          <div className="flex bg-gray-950 p-0.5 rounded-lg border border-gray-800 text-[11px]">
            <button
              onClick={() => setInterval('minute')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${interval === 'minute' ? 'bg-teal-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Min
            </button>
            <button
              onClick={() => setInterval('hour')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${interval === 'hour' ? 'bg-teal-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Hour
            </button>
            <button
              onClick={() => setInterval('day')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${interval === 'day' ? 'bg-teal-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Day
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center gap-1 bg-teal-950/70 hover:bg-teal-900 text-teal-300 border border-teal-700/60 px-2 py-1 rounded-lg text-xs font-medium transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Download CSV Report"
          >
            <Download size={13} />
            <span className="hidden sm:inline">CSV</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-teal-400' : ''} />
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="flex-1 p-3 min-h-[160px] relative">
        {loading && data.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500"></div>
          </div>
        ) : data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
              <XAxis 
                dataKey="time" 
                stroke="#9ca3af" 
                fontSize={11} 
                tickFormatter={formatXAxis} 
                tickLine={false} 
              />
              <YAxis 
                stroke="#9ca3af" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false} 
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} 
              />
              {classes.length > 0 ? (
                classes.map((cls, idx) => (
                  <Bar
                    key={cls}
                    dataKey={cls}
                    name={cls}
                    fill={CLASS_COLORS[idx % CLASS_COLORS.length]}
                    stackId="a"
                    radius={[2, 2, 0, 0]}
                  />
                ))
              ) : (
                <Bar dataKey="total" name="Total Count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-1.5 text-xs italic">
            <TrendingUp size={24} className="text-gray-600 mb-1" />
            <span>No historical count records logged yet.</span>
            <span className="text-[10px] text-gray-600">Ensure Flow Counter node has Auto-Save enabled.</span>
          </div>
        )}
      </div>
    </div>
  );
}
