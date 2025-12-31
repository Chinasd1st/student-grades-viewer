import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Sheet } from '../../types';
import ChartTooltip from './ChartTooltip';

interface Props {
  sheet: Sheet;
}

const SimpleBarChart: React.FC<Props> = ({ sheet }) => {
  // Transform sheet data for charting
  // Assuming Column 0 is the "Label" (e.g., Subject Name or Class Name)
  // And subsequent columns are values
  const data = React.useMemo(() => {
    if (sheet.rows.length === 0 || sheet.columns.length < 2) return [];

    const labelKey = sheet.columns[0];
    const valueKeys = sheet.columns.slice(1);

    return sheet.rows.map((row) => {
      const item: any = { name: row[0] };
      valueKeys.forEach((key, idx) => {
        // Try to parse as number
        const val = row[idx + 1];
        item[key] = typeof val === 'number' ? val : Number(val);
      });
      return item;
    });
  }, [sheet]);

  if (data.length === 0) return <div className="p-4 text-gray-500">无法生成图表</div>;

  const valueKeys = sheet.columns.slice(1);
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-[500px] flex flex-col">
      <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">数据概览 (Summary Visualization)</h3>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
            <Legend />
            {valueKeys.map((key, index) => (
              <Bar key={key} dataKey={key} fill={colors[index % colors.length]} radius={[4, 4, 0, 0]} maxBarSize={60} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SimpleBarChart;