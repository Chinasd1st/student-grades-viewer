import React, { useMemo } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { Sheet } from '../../types';
import { getNumericColumns, getGroupedByClass, getFullMark } from '../../utils/statsUtils';
import ChartTooltip from './ChartTooltip';

interface Props {
  sheet: Sheet;
}

const ClassRadarGrid: React.FC<Props> = ({ sheet }) => {
  const data = useMemo(() => {
    const numericCols = getNumericColumns(sheet).filter(
        c => !c.name.includes('总分') && !c.name.includes('Total') && !c.name.includes('Sum') && !/\+/.test(c.name)
    );
    const groups = getGroupedByClass(sheet, numericCols);
    if (!groups) return [];

    const classes = Object.keys(groups).sort();
    
    return classes.map(cls => {
        const subjects = numericCols.map(col => {
            const scores = groups[cls][col.name];
            if (!scores || scores.length === 0) return null;
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            const fullMark = getFullMark(col.name);
            return {
                subject: col.name,
                avg: Number(avg.toFixed(1)),
                normalized: fullMark > 0 ? (avg / fullMark) * 100 : 0
            };
        }).filter(Boolean);

        return {
            className: cls,
            subjects: subjects
        };
    });
  }, [sheet]);

  if (data.length === 0) return <div className="p-8 text-center text-gray-400">需包含“班级”列才能生成此图表</div>;

  return (
    <div className="flex flex-col h-full w-full">
      <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">班级学科均衡度对比 (Class Balance Radar)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-2" style={{ maxHeight: '600px' }}>
        {data.map((clsData) => (
            <div key={clsData.className} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center">
                <h4 className="font-bold text-sm text-gray-700 dark:text-gray-200 mb-2">{clsData.className}</h4>
                <div className="w-full h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={clsData.subjects}>
                            <PolarGrid stroke="#e5e7eb" strokeOpacity={0.5} />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#6b7280' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar
                                name="得分率%"
                                dataKey="normalized"
                                stroke="#3b82f6"
                                fill="#3b82f6"
                                fillOpacity={0.4}
                            />
                            <ChartTooltip formatter={(val, name, props) => [`${Number(val).toFixed(1)}%`, props.payload.subject]} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-center text-gray-500">
         * 统一刻度：各科平均分 / 满分 x 100%
      </div>
    </div>
  );
};

export default ClassRadarGrid;