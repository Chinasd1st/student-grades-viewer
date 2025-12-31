import React from 'react';

interface Props {
  active?: boolean;
  payload?: any[];
  label?: string;
  formatter?: (value: any, name: string, props: any) => [string, string] | string;
}

const ChartTooltip: React.FC<Props> = ({ active, payload, label, formatter }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 dark:bg-gray-800/95 p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 backdrop-blur-sm transition-all">
        {label && <p className="font-bold text-gray-700 dark:text-gray-200 mb-2 border-b border-gray-100 dark:border-gray-700 pb-1 text-sm">{label}</p>}
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => {
            const name = entry.name;
            const value = entry.value;
            const formatted = formatter ? formatter(value, name, entry) : [value, name];
            const displayValue = Array.isArray(formatted) ? formatted[0] : formatted;
            const displayName = Array.isArray(formatted) ? formatted[1] : name;

            return (
              <div key={index} className="flex items-center gap-3 text-xs sm:text-sm">
                <span 
                  className="w-2 h-2 rounded-full shadow-sm" 
                  style={{ backgroundColor: entry.color || entry.fill }}
                />
                <span className="text-gray-500 dark:text-gray-400 font-medium">{displayName}:</span>
                <span className="font-mono font-bold text-gray-700 dark:text-gray-200">{displayValue}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

export default ChartTooltip;