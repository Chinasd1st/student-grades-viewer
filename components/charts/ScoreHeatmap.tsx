import React, { useState, useMemo } from 'react';
import { Sheet } from '../../types';
import { getNumericColumns, getGroupedByClass, getFullMark, calculateScoreBuckets } from '../../utils/statsUtils';

interface Props {
  sheet: Sheet;
}

const ScoreHeatmap: React.FC<Props> = ({ sheet }) => {
  const numericCols = useMemo(() => getNumericColumns(sheet), [sheet]);
  // Default to Total Score or first column
  const initialCol = numericCols.find(c => c.name.includes('总分')) || numericCols[0];
  const [selectedColIndex, setSelectedColIndex] = useState<number>(initialCol ? initialCol.index : -1);

  const heatmapData = useMemo(() => {
    if (selectedColIndex === -1) return null;
    const selectedCol = numericCols.find(c => c.index === selectedColIndex);
    if (!selectedCol) return null;

    const groups = getGroupedByClass(sheet, [selectedCol]);
    if (!groups) return null;

    const fullMark = selectedCol.name.includes('总分') ? selectedCol.max : getFullMark(selectedCol.name);
    
    // Rows: Classes
    const rows = Object.keys(groups).sort().map(cls => {
        const scores = groups[cls][selectedCol.name] || [];
        const buckets = calculateScoreBuckets(scores, fullMark);
        return {
            name: cls,
            total: scores.length,
            avg: scores.reduce((a,b)=>a+b,0) / scores.length,
            ...buckets
        };
    });

    return { rows, fullMark };
  }, [sheet, numericCols, selectedColIndex]);

  const getHeatmapColor = (count: number, total: number) => {
      if (total === 0 || count === 0) return 'transparent';
      const ratio = count / total;
      // Blue intensity based on percentage within class
      const lightness = 95 - (ratio * 60); // 95 -> 35
      return `hsl(217, 91%, ${lightness}%)`;
  };

  const getTextColor = (count: number, total: number) => {
      if (total === 0 || count === 0) return '#9ca3af';
      return (count / total) > 0.4 ? 'white' : '#1f2937';
  };

  if (!heatmapData) return <div className="p-8 text-center text-gray-400">需包含“班级”列才能生成此图表</div>;

  const bucketKeys = ['90%~', '85%~90%', '80%~85%', '70%~80%', '60%~70%', '<60%'];

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">分数段分布热力图 (Score Heatmap)</h3>
        <select
          value={selectedColIndex}
          onChange={(e) => setSelectedColIndex(Number(e.target.value))}
          className="p-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[150px]"
        >
          {numericCols.map((col) => (
            <option key={col.index} value={col.index}>{col.name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 w-full overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="min-w-full text-sm text-center">
            <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 font-semibold sticky top-0 z-10">
                <tr>
                    <th className="p-3 text-left sticky left-0 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">班级</th>
                    <th className="p-3 w-20">平均分</th>
                    {bucketKeys.map(k => <th key={k} className="p-3 min-w-[80px]">{k}</th>)}
                </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800">
                {heatmapData.rows.map((row, idx) => (
                    <tr key={row.name} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="p-3 text-left font-bold text-gray-700 dark:text-gray-200 sticky left-0 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700">
                            {row.name}
                            <span className="block text-[10px] text-gray-400 font-normal">{row.total}人</span>
                        </td>
                        <td className="p-3 font-mono text-blue-600 dark:text-blue-400 font-bold bg-blue-50/30 dark:bg-blue-900/10">
                            {row.avg.toFixed(1)}
                        </td>
                        {bucketKeys.map(k => {
                            const count = (row as any)[k];
                            const bg = getHeatmapColor(count, row.total);
                            const color = getTextColor(count, row.total);
                            return (
                                <td key={k} className="p-1">
                                    <div 
                                        className="w-full h-full py-2 rounded flex items-center justify-center font-medium transition-all"
                                        style={{ backgroundColor: bg, color: color }}
                                    >
                                        {count > 0 ? count : '-'}
                                    </div>
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
      <div className="mt-2 text-xs text-center text-gray-500">
         * 颜色深浅表示该分数段人数占比
      </div>
    </div>
  );
};

export default ScoreHeatmap;