import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { NumericColumn, calculatePassStats } from '../../utils/statsUtils';
import ChartTooltip from './ChartTooltip';

interface Props {
  columns: NumericColumn[];
}

const COLORS = ['#10b981', '#3b82f6', '#ef4444']; // Green (Excellent), Blue (Pass), Red (Fail)

const PassRateChart: React.FC<Props> = ({ columns }) => {
  // Filter out Total columns as pass rate concepts are different there usually
  const subjectColumns = useMemo(() => 
    columns.filter(c => !c.name.includes('总分') && !c.name.includes('Total')), 
  [columns]);

  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const currentSubject = subjectColumns[selectedIndex];

  const chartData = useMemo(() => {
    if (!currentSubject) return [];
    const stats = calculatePassStats(currentSubject.values, currentSubject.name);
    return [
      { name: '优秀 (≥85%)', value: stats.excellent },
      { name: '合格 (60-84%)', value: stats.pass },
      { name: '不及格 (<60%)', value: stats.fail },
    ].filter(d => d.value > 0);
  }, [currentSubject]);

  if (!currentSubject) return null;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">等级分布 (Rate Analysis)</h3>
        <select
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
          className="p-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[120px]"
        >
          {subjectColumns.map((col, idx) => (
            <option key={col.index} value={idx}>{col.name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-h-[300px] w-full relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend verticalAlign="bottom" height={36}/>
          </PieChart>
        </ResponsiveContainer>
        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-sm text-gray-400">Total</span>
          <span className="text-2xl font-bold text-gray-700 dark:text-gray-200">
            {currentSubject.values.length}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PassRateChart;