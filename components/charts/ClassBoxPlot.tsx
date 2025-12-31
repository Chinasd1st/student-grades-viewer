import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Rectangle } from 'recharts';
import { calculateBoxPlotStats, BoxPlotStats } from '../../utils/statsUtils';
import { Sheet } from '../../types';

interface Props {
  sheet: Sheet;
  totalColName: string;
}

const ClassBoxPlot: React.FC<Props> = ({ sheet, totalColName }) => {
  const stats = useMemo(() => {
    // 1. Find columns
    const totalIdx = sheet.columns.findIndex(c => c === totalColName);
    const classIdx = sheet.columns.findIndex(c => c.includes('班') || c.toLowerCase() === 'class');

    if (totalIdx === -1 || classIdx === -1) return [];

    // 2. Group data
    const groups: Record<string, number[]> = {};
    sheet.rows.forEach(row => {
        const cls = row[classIdx] as string;
        const score = Number(row[totalIdx]);
        if (cls && !isNaN(score)) {
            if (!groups[cls]) groups[cls] = [];
            groups[cls].push(score);
        }
    });

    // 3. Calculate Stats
    const result = Object.keys(groups).map(cls => {
        const values = groups[cls];
        const stat = calculateBoxPlotStats(values);
        return {
            name: cls,
            min: stat.min,
            q1: stat.q1,
            median: stat.median,
            q3: stat.q3,
            max: stat.max,
            // Construct a range for the "Box" (Q1 to Q3)
            boxBottom: stat.q1,
            boxHeight: stat.q3 - stat.q1,
        };
    }).sort((a, b) => b.median - a.median); // Sort by median score

    return result;
  }, [sheet, totalColName]);

  if (stats.length === 0) return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
          No class grouping data found.
      </div>
  );

  return (
    <div className="flex flex-col h-full w-full">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
             <h3 className="text-lg font-bold text-gray-800 dark:text-white">各班总分分布 (Class Distribution)</h3>
        </div>
        <div className="flex-1 min-h-[300px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                    <XAxis dataKey="name" tick={{fontSize: 12}} />
                    <YAxis domain={['dataMin - 20', 'dataMax + 20']} />
                    <Tooltip 
                        cursor={{fill: 'transparent'}}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="bg-white/95 dark:bg-gray-800/95 p-3 rounded shadow-lg border border-gray-100 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200">
                                        <p className="font-bold mb-1">{data.name}</p>
                                        <p>Max: {data.max}</p>
                                        <p>Q3: {data.q3}</p>
                                        <p className="font-bold text-blue-600 dark:text-blue-400">Median: {data.median}</p>
                                        <p>Q1: {data.q1}</p>
                                        <p>Min: {data.min}</p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    
                    <Bar dataKey="q1" stackId="a" fill="transparent" />
                    <Bar name="IQR" dataKey="boxHeight" stackId="a" fill="#8884d8" fillOpacity={0.6} radius={[4,4,4,4]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
        <div className="mt-2 text-xs text-center text-gray-500">
            * Showing Interquartile Range (25% - 75%). Sort by Median.
        </div>
    </div>
  );
};

export default ClassBoxPlot;