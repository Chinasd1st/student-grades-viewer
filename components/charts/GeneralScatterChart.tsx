import React, { useState, useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend } from 'recharts';
import { NumericColumn, calculateLinearRegression, downsampleData } from '../../utils/statsUtils';

interface Props {
  columns: NumericColumn[];
  rows: (string | number | null)[][];
  nameColIndex: number;
}

const GeneralScatterChart: React.FC<Props> = ({ columns, rows, nameColIndex }) => {
  // Defaults: X = First Subject, Y = Total Score (if exists) or Second Subject
  const totalCol = columns.find(c => c.name.includes('总分') || c.name.includes('Total'));
  const initialX = columns.find(c => c.name !== totalCol?.name) || columns[0];
  const initialY = totalCol || columns.find(c => c.name !== initialX?.name) || columns[1] || columns[0];

  const [xIndex, setXIndex] = useState<number>(initialX ? initialX.index : -1);
  const [yIndex, setYIndex] = useState<number>(initialY ? initialY.index : -1);

  const chartData = useMemo(() => {
    const defaultResult = { scatter: [], regression: [], rSquared: 0, xName: '', yName: '' };
    
    if (xIndex === -1 || yIndex === -1) return defaultResult;

    const xCol = columns.find(c => c.index === xIndex);
    const yCol = columns.find(c => c.index === yIndex);
    
    if (!xCol || !yCol) return defaultResult;

    // Collect Data Points
    const points = [];
    for (let i = 0; i < rows.length; i++) {
      const xVal = rows[i][xIndex];
      const yVal = rows[i][yIndex];
      const name = nameColIndex !== -1 ? rows[i][nameColIndex] : `Student ${i+1}`;
      
      if (typeof xVal === 'number' && typeof yVal === 'number') {
        points.push({ x: xVal, y: yVal, name });
      }
    }

    if (points.length === 0) return defaultResult;

    // Downsample only if extremely large, to preserve "raw data" visibility
    const scatterPoints = downsampleData(points, 2000); 

    // Calculate Regression
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

    return { 
      scatter: scatterPoints, 
      regression: regressionLine, 
      rSquared, 
      xName: xCol.name, 
      yName: yCol.name 
    };
  }, [columns, rows, xIndex, yIndex, nameColIndex]);

  if (columns.length < 2) return null;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-wrap gap-4 justify-between items-center mb-4 flex-shrink-0">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">散点分析 (Scatter Analysis)</h3>
        
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500">X:</label>
            <select
              value={xIndex}
              onChange={(e) => setXIndex(Number(e.target.value))}
              className="p-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[120px]"
            >
              {columns.map((col) => (
                <option key={`x-${col.index}`} value={col.index}>{col.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500">Y:</label>
            <select
              value={yIndex}
              onChange={(e) => setYIndex(Number(e.target.value))}
              className="p-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[120px]"
            >
              {columns.map((col) => (
                <option key={`y-${col.index}`} value={col.index}>{col.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[300px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis 
              dataKey="x" 
              type="number" 
              domain={['auto', 'auto']} 
              name={chartData.xName} 
              label={{ value: chartData.xName, position: 'insideBottom', offset: -10 }}
            />
            <YAxis 
              dataKey="y" 
              type="number" 
              domain={['auto', 'auto']} 
              name={chartData.yName}
              label={{ value: chartData.yName, angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white/95 dark:bg-gray-800/95 p-2 rounded shadow border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-200">
                      <p className="font-bold mb-1">{data.name}</p>
                      <p>{chartData.xName}: {data.x}</p>
                      <p>{chartData.yName}: {data.y}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend verticalAlign="top" height={36}/>
            <Scatter 
              name="学生 (Student)" 
              data={chartData.scatter} 
              fill="#3b82f6" 
              fillOpacity={0.6} 
              shape="circle" 
            />
            <Line 
              name={`Trend (R² = ${chartData.rSquared.toFixed(3)})`} 
              data={chartData.regression} 
              dataKey="lineY" 
              stroke="#ef4444" 
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

export default GeneralScatterChart;