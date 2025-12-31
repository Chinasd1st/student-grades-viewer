import React, { useState, useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Sheet } from '../../types';
import { getNumericColumns, downsampleData } from '../../utils/statsUtils';

interface Props {
  sheet: Sheet;
  totalColName: string;
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#06b6d4', '#d946ef'];

const SubjectScatterChart: React.FC<Props> = ({ sheet, totalColName }) => {
  const numericColumns = useMemo(() => getNumericColumns(sheet), [sheet]);
  
  // Find key columns
  const totalCol = numericColumns.find(c => c.name === totalColName);
  const classColIndex = sheet.columns.findIndex(c => /班级|Class/i.test(c));
  const nameColIndex = sheet.columns.findIndex(c => /姓名|Name/i.test(c));

  // Default subject selection (first numeric that isn't Total)
  const initialSubject = numericColumns.find(c => c.name !== totalColName) || numericColumns[0];
  const [subjectIndex, setSubjectIndex] = useState<number>(initialSubject ? initialSubject.index : -1);

  const processedData = useMemo(() => {
    if (!totalCol || subjectIndex === -1) return [];

    const subjectCol = numericColumns.find(c => c.index === subjectIndex);
    if (!subjectCol) return [];

    const groups: { [key: string]: any[] } = {};
    const ungrouped: any[] = [];

    sheet.rows.forEach((row, i) => {
      const x = row[subjectIndex];
      const y = row[totalCol.index];
      
      if (typeof x === 'number' && typeof y === 'number') {
        const className = classColIndex !== -1 ? String(row[classColIndex]) : 'All';
        const name = nameColIndex !== -1 ? String(row[nameColIndex]) : `Student ${i+1}`;
        
        const point = { x, y, name, className };

        if (classColIndex !== -1) {
          if (!groups[className]) groups[className] = [];
          groups[className].push(point);
        } else {
          ungrouped.push(point);
        }
      }
    });

    // If grouped by class, sort classes naturally
    if (Object.keys(groups).length > 0) {
      return Object.keys(groups).sort().map(cls => ({
        name: cls,
        data: downsampleData(groups[cls], 500) // Downsample large classes
      }));
    }

    return [{ name: 'All Students', data: downsampleData(ungrouped, 1000) }];

  }, [sheet, numericColumns, totalCol, subjectIndex, classColIndex, nameColIndex, subjectIndex]);

  const subjectName = numericColumns.find(c => c.index === subjectIndex)?.name || 'Subject';

  if (!totalCol) return null;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">单科贡献分析 (Score Contribution)</h3>
        <div className="flex items-center gap-2">
           <span className="text-sm text-gray-500">Subject:</span>
           <select
            value={subjectIndex}
            onChange={(e) => setSubjectIndex(Number(e.target.value))}
            className="p-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[150px]"
           >
            {numericColumns.filter(c => c.name !== totalColName).map((col) => (
              <option key={col.index} value={col.index}>{col.name}</option>
            ))}
           </select>
        </div>
      </div>

      <div className="flex-1 min-h-[300px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis 
              type="number" 
              dataKey="x" 
              name={subjectName} 
              domain={['auto', 'auto']}
              label={{ value: subjectName, position: 'insideBottom', offset: -10 }} 
            />
            <YAxis 
              type="number" 
              dataKey="y" 
              name={totalColName} 
              domain={['auto', 'auto']}
              label={{ value: totalColName, angle: -90, position: 'insideLeft' }} 
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white/95 dark:bg-gray-800/95 p-2 rounded shadow border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-200">
                      <p className="font-bold mb-1">{data.name} <span className="text-gray-400 font-normal">({data.className})</span></p>
                      <p>{subjectName}: {data.x}</p>
                      <p>{totalColName}: {data.y}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend verticalAlign="top" height={36}/>
            {processedData.map((group, index) => (
              <Scatter 
                key={group.name} 
                name={group.name} 
                data={group.data} 
                fill={COLORS[index % COLORS.length]} 
                shape="circle"
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
       <div className="mt-2 text-xs text-center text-gray-500">
         * 展示该科目成绩与总分的相关性分布
      </div>
    </div>
  );
};

export default SubjectScatterChart;