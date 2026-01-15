
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SystemMetrics } from '../types';

interface Props {
  data: SystemMetrics[];
  dataKey: keyof SystemMetrics;
  color: string;
  label: string;
}

export const MetricChart: React.FC<Props> = ({ data, dataKey, color, label }) => {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-4 h-64 rounded-sm">
      <h3 className="text-xs uppercase font-bold tracking-widest text-zinc-500 mb-4">{label}</h3>
      <ResponsiveContainer width="100%" height="80%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis dataKey="timestamp" hide />
          <YAxis hide />
          <Tooltip 
            contentStyle={{ backgroundColor: '#111', border: '1px solid #333', fontSize: '10px' }}
            itemStyle={{ color }}
          />
          <Area 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            fill={color} 
            fillOpacity={0.1} 
            isAnimationActive={false} 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
