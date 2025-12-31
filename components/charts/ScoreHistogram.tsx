import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { NumericColumn, generateHistogramData } from '../../utils/statsUtils';
import ChartTooltip from './ChartTooltip';

interface Props {
  columns: NumericColumn[];
}

const ScoreHistogram: React.FC<Props> = ({ columns }) => {
  // Default to "总分" if available, else first column
  const initialCol = columns.find(c => c.name.includes('总分')) || columns[0];
  const [selectedColIndex, setSelectedColIndex] = useState<number>(initialCol ? columns.indexOf(initialCol) : 0);

  const selectedCol = columns[selectedColIndex];

  const chartData = useMemo(() => {
    if (!selectedCol) return [];
    return generateHistogramData(selectedCol.values, 15);
  }, [selectedCol]);

  if (!selectedCol) return null;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">成绩分布直方图 (Grade Distribution)</h3>
        <select
          value={selectedColIndex}
          onChange={(e) => setSelectedColIndex(Number(e.target.value))}
          className="p-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[150px]"
        >
          {columns.map((col, idx) => (
            <option key={col.name} value={idx}>{col.name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-h-[300px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
            <XAxis dataKey="range" tick={{fontSize: 10}} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="人数">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-center text-gray-500 flex-shrink-0">
        Stats: Avg {selectedCol.average.toFixed(1)} | Max {selectedCol.max} | Min {selectedCol.min}
      </div>
    </div>
  );
};

export default ScoreHistogram;