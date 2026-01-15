import React, { useMemo } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { getGradeFromPercentile, getScoreRankStats, getNumericColumns } from '../utils/statsUtils';
import { Sheet } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: {
    columns: string[];
    row: (string | number | null)[];
    sheet: Sheet;
  } | null;
}

const StudentDetailModal: React.FC<Props> = ({ isOpen, onClose, data }) => {
  if (!isOpen || !data) return null;

  const { columns, row, sheet } = data;

  // 1. 提取基础信息
  const nameIdx = columns.findIndex(c => /姓名|Name/i.test(c));
  const classIdx = columns.findIndex(c => /班级|Class/i.test(c));
  const idIdx = columns.findIndex(c => /号|ID/i.test(c));
  
  // 提取总分和排名用于Header展示
  const totalIdx = columns.findIndex(c => /总分|Total/i.test(c));
  const mainRankIdx = columns.findIndex(c => c === '校次' || c === 'Rank' || c === '总分校次');

  const studentName = nameIdx !== -1 ? row[nameIdx] : '未命名';
  const className = classIdx !== -1 ? row[classIdx] : '';
  const studentId = idIdx !== -1 ? row[idIdx] : '';
  const totalScore = totalIdx !== -1 ? row[totalIdx] : null;
  const mainRank = mainRankIdx !== -1 ? row[mainRankIdx] : null;

  // Cache column values for ranking logic (Memoized inside modal is fine for single student view)
  const numericColumnsMap = useMemo(() => {
      const map = new Map<number, number[]>();
      const numericCols = getNumericColumns(sheet);
      numericCols.forEach(col => {
          map.set(col.index, [...col.values].sort((a, b) => b - a)); // Sort descending for ranking
      });
      return map;
  }, [sheet]);

  // 2. 智能解析科目数据
  const subjectData = useMemo(() => {
    return columns.map((col, idx) => {
      // 过滤非数值列
      const val = row[idx];
      if (typeof val !== 'number') return null;

      // 过滤不需要分析的列 (ID, Rank, Class)
      if (/号|ID|班级|Class|姓名|Name|Rank|次/.test(col)) return null;

      // 判断科目属性
      const isMainSubject = /语文|数学|英语|English|Chinese|Math/.test(col) && !/语数英/.test(col);
      const isComposite = /\+|语数英|总分|Total/.test(col); // 包含+号或特定组合名的视为组合科目

      // 计算排名和百分位
      const sortedValues = numericColumnsMap.get(idx);
      let rank = 0, total = 0, percentile = 0;
      
      if (sortedValues) {
          const stats = getScoreRankStats(val, sortedValues);
          rank = stats.rank;
          total = stats.total;
          percentile = stats.percentile;
      }

      // Radar Value: Percentile * 100 (High percentile = outer edge)
      // If no data, 0.
      const radarValue = percentile * 100;

      return {
        subject: col,
        score: val,
        rank,
        totalStudents: total,
        percentile,
        isMainSubject,
        isComposite, 
        radarValue 
      };
    }).filter((item): item is { subject: string; score: number; rank: number; totalStudents: number; percentile: number; isMainSubject: boolean; isComposite: boolean; radarValue: number } => item !== null);
  }, [columns, row, numericColumnsMap]);

  // 3. 雷达图数据：仅包含单科，且分数有效（非0）
  const radarData = useMemo(() => {
    return subjectData.filter(item => !item.isComposite && item.score > 0);
  }, [subjectData]);

  // 4. 提取组合排名 (Combination Ranks)
  const combinationRanks = useMemo(() => {
    const ranks: { name: string; rank: number; score?: number }[] = [];
    columns.forEach((col, idx) => {
        // Find columns ending with "校次" or "Rank" but ignore the main rank if needed
        if ((col.endsWith('校次') || col.endsWith('Rank')) && idx !== mainRankIdx) {
            // Extract base name (e.g., "语数英校次" -> "语数英")
            const baseName = col.replace(/校次|Rank/g, '');
            // Find corresponding score column if exists
            const scoreIdx = columns.findIndex(c => c === baseName);
            const scoreVal = scoreIdx !== -1 ? row[scoreIdx] : undefined;
            const rankVal = row[idx];

            if (typeof rankVal === 'number') {
                ranks.push({
                    name: baseName || '其他', // Fallback name
                    rank: rankVal,
                    score: typeof scoreVal === 'number' ? scoreVal : undefined
                });
            }
        }
    });
    return ranks;
  }, [columns, row, mainRankIdx]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-300" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-[fadeIn_0.25s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xl font-bold border-2 border-white dark:border-gray-700 shadow-sm">
              {String(studentName).charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                {studentName}
                {className && <span className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">{className}</span>}
              </h2>
              {studentId && <p className="text-sm text-gray-400 font-mono tracking-wide mt-0.5">#{studentId}</p>}
            </div>
          </div>

          <div className="flex gap-4">
            {totalScore !== null && (
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">总分</span>
                <span className="text-3xl font-black text-blue-600 dark:text-blue-400 leading-none">{totalScore}</span>
              </div>
            )}
            {mainRank !== null && (
              <div className="flex flex-col items-end pl-4 border-l border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">校次</span>
                <span className="text-3xl font-black text-gray-800 dark:text-white leading-none">#{mainRank}</span>
              </div>
            )}
            <button 
              onClick={onClose} 
              className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors self-start sm:self-center"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-auto bg-gray-50/50 dark:bg-gray-900/50 p-6 space-y-6">
          
          {/* Combination Ranks Section */}
          {combinationRanks.length > 0 && (
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {combinationRanks.map((item, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate font-medium mb-1" title={item.name}>{item.name}排名</span>
                        <div className="flex items-baseline justify-between">
                            <span className="text-lg font-bold text-gray-800 dark:text-gray-100">#{item.rank}</span>
                            {item.score !== undefined && <span className="text-xs text-gray-400 font-mono">{item.score}分</span>}
                        </div>
                    </div>
                ))}
             </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Radar Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col min-h-[300px]">
               <div className="mb-4 flex justify-between items-center">
                 <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide flex items-center gap-2">
                   <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                   单科排位分析
                 </h3>
                 <span className="text-xs text-gray-400">* 仅展示单科排名（面积越大排名越靠前）</span>
               </div>
               <div className="flex-1 w-full relative">
                {radarData.length > 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="#e5e7eb" strokeOpacity={0.5} />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar
                        name="排名击败率 (%)"
                        dataKey="radarValue"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="#3b82f6"
                        fillOpacity={0.3}
                      />
                      <Tooltip 
                        formatter={(value: number, name: string, props: any) => {
                            const item = props.payload;
                            return [`#${item.rank} / ${item.totalStudents}`, '校次'];
                        }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">有效单科数据不足以绘制图表</div>
                )}
               </div>
            </div>

            {/* Right: Detailed Table */}
            <div className="flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  详细成绩列表
                </h3>
              </div>
              <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-600">
                <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">科目</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">得分</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">排名</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">评级</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                    {subjectData.map((item, i) => (
                      <tr key={i} className={`
                        transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50
                        ${item.isComposite ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
                      `}>
                        <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {item.subject}
                          {item.isComposite && <span className="ml-2 text-[10px] text-blue-500 border border-blue-200 px-1 rounded bg-white">组合</span>}
                        </td>
                        <td className={`px-5 py-3 text-sm text-right font-mono font-bold ${item.isComposite ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                          {item.score}
                        </td>
                        <td className="px-5 py-3 text-sm text-right text-gray-400 font-mono">
                          {item.rank > 0 ? `#${item.rank}` : '-'}
                        </td>
                        <td className="px-5 py-3 text-sm text-center">
                          {(() => {
                              const grade = getGradeFromPercentile(item.percentile);
                              if (grade && item.score > 0) {
                                  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${grade.color}`}>{grade.label}</span>;
                              }
                              return <span className="text-gray-300">-</span>;
                            })()
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700 text-[10px] text-gray-400 text-center">
                * 评级标准基于全校排名: A+(前5%), A(前15%), B(前60%), C(前95%), D(后5%)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDetailModal;