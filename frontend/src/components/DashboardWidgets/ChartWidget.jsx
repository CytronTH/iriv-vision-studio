import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart2 } from 'lucide-react';

export default function ChartWidget({ title, data = [], dataKey = "value", icon: Icon = BarChart2 }) {
  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl p-4">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-800">
        <Icon size={20} className="text-emerald-400" />
        <h3 className="text-gray-400 font-semibold text-sm uppercase tracking-wider">{title}</h3>
      </div>
      <div className="flex-1 min-h-[150px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }}
                itemStyle={{ color: '#10b981' }}
              />
              <Line 
                type="monotone" 
                dataKey={dataKey} 
                stroke="#10b981" 
                strokeWidth={3} 
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-gray-500 text-sm italic flex items-center justify-center h-full">
            Not enough data points
          </div>
        )}
      </div>
    </div>
  );
}
