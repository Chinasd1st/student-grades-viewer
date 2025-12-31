import React, { useState, useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend } from 'recharts';
import { NumericColumn, calculateLinearRegression, downsampleData } from '../../utils/statsUtils';
import ChartTooltip from './ChartTooltip';

interface Props {
  columns: NumericColumn[];
  rows: (string | number | null)[][];
  totalColName: string;
}

const RegressionChart: React.FC<Props> = ({ columns, rows, totalColName }) => {
  const totalCol = columns.find(c => c.name === totalColName);
  
  // Default to first numeric column that isn't the total
  const initialSubject = columns.find(c => c.name !== totalColName) || columns[0];
  const [subjectIndex, setSubjectIndex] = useState<number>(initialSubject ? initialSubject.index : -1);

  const chartData = useMemo(() => {
    // Default return object structure must match usage
    const defaultResult = { scatter: [], regression: [], rSquared: 0, subjectName: '' };

    if (!totalCol || subjectIndex === -1) return defaultResult;

    const subjectCol = columns.find(c => c.index === subjectIndex);
    if (!subjectCol) return defaultResult;

    // Pair up the data
    const points = [];
    for (let i = 0; i < rows.length; i++) {
      const x = rows[i][subjectIndex];
      const y = rows[i][totalCol.index];
      
      if (typeof x === 'number' && typeof y === 'number') {
        points.push({ x, y });
      }
    }

    if (points.length === 0) return defaultResult;

    // Downsample for rendering performance if too many points
    const scatterPoints = downsampleData(points, 400);

    // Calculate Regression on FULL dataset for accuracy
    const xVals = points.map(p => p.x);
    const yVals = points.map(p => p.y);
    const reg = calculateLinearRegression(xVals, yVals);

    let regressionLine = [];
    let rSquared = 0;
    if (reg) {
      const minX = Math.min(...xVals);
      const maxX = Math.max(...xVals);
      regressionLine = [
        { x: minX, lineY: reg.slope * minX + reg.intercept },
        { x: maxX, lineY: reg.slope * maxX + reg.intercept }
      ];
      rSquared = reg.rSquared;
    }

    return { scatter: scatterPoints, regression: regressionLine, rSquared, subjectName: subjectCol.name };
  }, [columns, rows, totalCol, subjectIndex]);

  if (!totalCol) return null;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">回归分析 (Regression)</h3>
        <select
          value={subjectIndex}
          onChange={(e) => setSubjectIndex(Number(e.target.value))}
          className="p-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[150px]"
        >
          {columns.filter(c => c.name !== totalColName).map((col) => (
            <option key={col.index} value={col.index}>{col.name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-h-[300px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis 
              dataKey="x" 
              type="number" 
              domain={['dataMin', 'dataMax']} 
              name={chartData.subjectName} 
              label={{ value: chartData.subjectName, position: 'insideBottom', offset: -10 }}
            />
            <YAxis 
              dataKey="y" 
              type="number" 
              domain={['auto', 'auto']} 
              name="总分"
              label={{ value: '总分', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<ChartTooltip />} />
            <Legend />
            <Scatter name="学生成绩" data={chartData.scatter} fill="#8884d8" fillOpacity={0.6} shape="circle" />
            <Line 
              name={`R² = ${chartData.rSquared.toFixed(3)}`} 
              data={chartData.regression} 
              dataKey="lineY" 
              stroke="#ff7300" 
              strokeWidth={2} 
              dot={false} 
              activeDot={false} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RegressionChart;