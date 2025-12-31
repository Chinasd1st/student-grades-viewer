import React, { useMemo } from 'react';
import { NumericColumn, calculateCorrelation } from '../../utils/statsUtils';

interface Props {
  columns: NumericColumn[];
}

const CorrelationHeatmap: React.FC<Props> = ({ columns }) => {
  const matrix = useMemo(() => {
    return columns.map((colX) => {
      return columns.map((colY) => {
        if (colX.name === colY.name) return 1;
        return calculateCorrelation(colX.values, colY.values);
      });
    });
  }, [columns]);

  const getColor = (value: number) => {
    const intensity = Math.abs(value);
    // L goes from 95% (low) to 50% (high)
    const lightness = 95 - (intensity * 45);
    return `hsl(217, 91%, ${lightness}%)`;
  };

  const getTextColor = (value: number) => {
    return Math.abs(value) > 0.6 ? 'white' : '#1f2937';
  };

  if (columns.length === 0) return <div className="text-gray-500">No numeric data for correlation.</div>;

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full p-4">
        <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">学科关联度热力图 (Correlation Matrix)</h3>
        <div 
            className="grid gap-px bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700"
            style={{ 
                gridTemplateColumns: `auto repeat(${columns.length}, minmax(40px, 1fr))` 
            }}
        >
          {/* Header Row */}
          <div className="bg-gray-50 dark:bg-gray-800"></div>
          {columns.map((col, i) => (
            <div key={`head-${i}`} className="bg-gray-50 dark:bg-gray-800 p-2 flex items-end justify-center h-28 pb-2">
              <span className="whitespace-nowrap -rotate-90 text-xs font-semibold text-gray-600 dark:text-gray-300 w-4 block overflow-visible leading-none origin-bottom-left translate-x-3">
                {col.name}
              </span>
            </div>
          ))}

          {/* Data Rows */}
          {columns.map((rowCol, i) => (
            <React.Fragment key={`row-${i}`}>
              {/* Row Label */}
              <div className="bg-gray-50 dark:bg-gray-800 flex items-center justify-end px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap h-10">
                {rowCol.name}
              </div>
              {/* Cells */}
              {columns.map((colCol, j) => {
                const value = matrix[i][j];
                return (
                  <div
                    key={`cell-${i}-${j}`}
                    className="h-10 relative group transition-colors duration-150 hover:brightness-95"
                    style={{ backgroundColor: getColor(value), color: getTextColor(value) }}
                    title={`${rowCol.name} vs ${colCol.name}: ${value.toFixed(3)}`}
                  >
                    <div className="w-full h-full flex items-center justify-center text-xs">
                      {value.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CorrelationHeatmap;