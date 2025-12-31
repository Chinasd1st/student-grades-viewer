import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { NumericColumn } from '../../utils/statsUtils';
import ChartTooltip from './ChartTooltip';

interface Props {
  columns: NumericColumn[];
}

const SubjectAverageChart: React.FC<Props> = ({ columns }) => {
  const chartData = useMemo(() => {
    // Filter out "Total" columns for this specific chart to avoid skewing the scale
    return columns
      .filter(c => !c.name.includes('总分') && !c.name.includes('Total') && !c.name.includes('Sum'))
      .map(col => ({
        name: col.name,
        average: Number(col.average.toFixed(1)),
        max: col.max
      }))
      .sort((a, b) => b.average - a.average);
  }, [columns]);

  return (
    <div className="flex flex-col h-full w-full">
      <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">各科平均分对比 (Average Comparison)</h3>
      <div className="flex-1 min-h-[300px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
            <XAxis 
              dataKey="name" 
              tick={{fontSize: 11}} 
              interval={0} 
              angle={-30} 
              textAnchor="end" 
            />
            <YAxis label={{ value: '分数', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={<ChartTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
            <Bar dataKey="average" name="平均分" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#60a5fa'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SubjectAverageChart;