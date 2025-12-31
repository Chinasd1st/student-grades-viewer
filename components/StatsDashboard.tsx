import React, { useMemo, useState } from 'react';
import { Sheet } from '../types';
import { getNumericColumns, downsampleData } from '../utils/statsUtils';
import CorrelationHeatmap from './charts/CorrelationHeatmap';
import ScoreHistogram from './charts/ScoreHistogram';
import RegressionChart from './charts/RegressionChart';
import ClassBoxPlot from './charts/ClassBoxPlot';
import GeneralScatterChart from './charts/GeneralScatterChart';
import PassRateChart from './charts/PassRateChart';
import SimpleBarChart from './charts/SimpleBarChart';
import SubjectScatterChart from './charts/SubjectScatterChart';
import ClassRadarGrid from './charts/ClassRadarGrid';
import ScoreHeatmap from './charts/ScoreHeatmap';
import ChartTooltip from './charts/ChartTooltip';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface StatsDashboardProps {
  sheet: Sheet;
  sheetName: string;
}

const StatsDashboard: React.FC<StatsDashboardProps> = ({ sheet, sheetName }) => {
  // --- 1. Logic to detect Summary Sheets vs Student Grade Sheets ---
  const isSummarySheet = useMemo(() => {
    // Explicitly check for "成绩" (Grades) to force student view
    if (sheetName.includes('成绩')) return false;
    
    // Fallback heuristic: small row counts usually mean summary data
    return sheet.rows.length < 15;
  }, [sheet.rows.length, sheetName]);

  // --- 2. Customization State ---
  const [visibleCharts, setVisibleCharts] = useState({
    histogram: true,
    passRate: true,
    boxPlot: true,
    radarGrid: true, // New
    scoreHeatmap: true, // New
    regression: true,
    subjectScatter: true, 
    sCurve: true,
    scatter: true,
    heatmap: true,
  });
  const [showSettings, setShowSettings] = useState(false);

  const numericColumns = useMemo(() => getNumericColumns(sheet), [sheet]);

  // Identify Columns
  const totalScoreCol = useMemo(() => sheet.columns.find(c => /总分|Total/i.test(c)), [sheet.columns]);
  const rankCol = useMemo(() => sheet.columns.find(c => /校次|Rank/i.test(c)), [sheet.columns]);
  const nameColIndex = useMemo(() => sheet.columns.findIndex(c => /姓名|Name/i.test(c)), [sheet.columns]);

  // --- 3. Key Metrics (Strictly Student Logic) ---
  const keyMetrics = useMemo(() => {
    if (isSummarySheet) return null;

    const studentCount = sheet.rows.length;
    
    // Calculate Total Score Stats
    let avgTotal = '-';
    let maxTotal = '-';
    
    if (totalScoreCol && numericColumns) {
        const stats = numericColumns.find(c => c.name === totalScoreCol);
        if (stats) {
            avgTotal = stats.average.toFixed(1);
            maxTotal = String(stats.max);
        }
    }

    return { studentCount, avgTotal, maxTotal };
  }, [sheet, totalScoreCol, numericColumns, isSummarySheet]);

  // S-Curve Data
  const scoreVsRankData = useMemo(() => {
    if (isSummarySheet || !totalScoreCol || !rankCol) return null;

    const totalScoreIdx = sheet.columns.indexOf(totalScoreCol);
    const rankIdx = sheet.columns.indexOf(rankCol);
    
    const data = sheet.rows.map(row => ({
      score: Number(row[totalScoreIdx]),
      rank: Number(row[rankIdx]),
    })).filter(d => !isNaN(d.score) && !isNaN(d.rank))
      .sort((a, b) => a.rank - b.rank);

    return downsampleData(data, 1000);
  }, [sheet, totalScoreCol, rankCol, isSummarySheet]);


  // --- RENDER: Summary Sheet Mode ---
  if (isSummarySheet) {
    return (
      <div className="p-4 space-y-6 animate-[fadeIn_0.3s_ease-out]">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-sm">
          <span className="font-bold">提示：</span> 检测到此表格为统计汇总数据（非原始学生成绩），已自动切换至简易图表模式。
        </div>
        <SimpleBarChart sheet={sheet} />
      </div>
    );
  }

  // --- RENDER: Student Data Mode ---
  if (numericColumns.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <p>数据不足，无法生成分析图表。</p>
      </div>
    );
  }

  const showScoreDependentCharts = !!totalScoreCol;
  const showRankDependentCharts = !!(totalScoreCol && rankCol && scoreVsRankData && scoreVsRankData.length > 0);

  const toggleChart = (key: keyof typeof visibleCharts) => {
    setVisibleCharts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-20 space-y-6">
      
      {/* 1. Control Bar & Key Metrics */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
         
         {/* Key Metrics */}
         <div className="flex gap-8 px-2">
            <div>
               <p className="text-xs text-gray-500 uppercase tracking-wider">考生总数</p>
               <p className="text-2xl font-black text-gray-800 dark:text-white mt-1">{keyMetrics?.studentCount}</p>
            </div>
            <div>
               <p className="text-xs text-gray-500 uppercase tracking-wider">平均总分</p>
               <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{keyMetrics?.avgTotal}</p>
            </div>
            <div>
               <p className="text-xs text-gray-500 uppercase tracking-wider">最高总分</p>
               <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{keyMetrics?.maxTotal}</p>
            </div>
         </div>

         {/* Settings Toggle */}
         <div className="relative z-20">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border ${showSettings ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300' : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 hover:bg-gray-100'}`}
            >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
               显示设置
            </button>
            {showSettings && (
               <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-3 flex flex-col gap-2 animate-[fadeIn_0.1s_ease-out] z-30 max-h-[80vh] overflow-y-auto">
                  <p className="text-xs font-bold text-gray-400 px-1">图表开关</p>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1.5 rounded">
                     <input type="checkbox" checked={visibleCharts.histogram} onChange={() => toggleChart('histogram')} className="rounded text-blue-600 focus:ring-blue-500"/> 直方图
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1.5 rounded">
                     <input type="checkbox" checked={visibleCharts.passRate} onChange={() => toggleChart('passRate')} className="rounded text-blue-600 focus:ring-blue-500"/> 等级饼图
                  </label>
                  {showScoreDependentCharts && (
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1.5 rounded">
                        <input type="checkbox" checked={visibleCharts.boxPlot} onChange={() => toggleChart('boxPlot')} className="rounded text-blue-600 focus:ring-blue-500"/> 班级箱线图
                      </label>
                  )}
                  {/* New Chart Toggles */}
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1.5 rounded">
                     <input type="checkbox" checked={visibleCharts.radarGrid} onChange={() => toggleChart('radarGrid')} className="rounded text-blue-600 focus:ring-blue-500"/> 班级雷达图矩阵
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1.5 rounded">
                     <input type="checkbox" checked={visibleCharts.scoreHeatmap} onChange={() => toggleChart('scoreHeatmap')} className="rounded text-blue-600 focus:ring-blue-500"/> 分数段热力图
                  </label>

                   {showScoreDependentCharts && (
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1.5 rounded">
                        <input type="checkbox" checked={visibleCharts.subjectScatter} onChange={() => toggleChart('subjectScatter')} className="rounded text-blue-600 focus:ring-blue-500"/> 单科贡献分析
                      </label>
                  )}
                  {showScoreDependentCharts && (
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1.5 rounded">
                        <input type="checkbox" checked={visibleCharts.regression} onChange={() => toggleChart('regression')} className="rounded text-blue-600 focus:ring-blue-500"/> 回归分析
                      </label>
                  )}
                  {showRankDependentCharts && (
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1.5 rounded">
                        <input type="checkbox" checked={visibleCharts.sCurve} onChange={() => toggleChart('sCurve')} className="rounded text-blue-600 focus:ring-blue-500"/> 排名曲线
                      </label>
                  )}
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1.5 rounded">
                     <input type="checkbox" checked={visibleCharts.scatter} onChange={() => toggleChart('scatter')} className="rounded text-blue-600 focus:ring-blue-500"/> 散点分析
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1.5 rounded">
                     <input type="checkbox" checked={visibleCharts.heatmap} onChange={() => toggleChart('heatmap')} className="rounded text-blue-600 focus:ring-blue-500"/> 热力图
                  </label>
                  <div className="fixed inset-0 z-[-1]" onClick={() => setShowSettings(false)}></div>
               </div>
            )}
         </div>
      </div>

      {/* 2. Distributions Row */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6`}>
        {visibleCharts.histogram && (
            <div className={`lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-[350px] flex flex-col min-w-0`}>
                <ScoreHistogram columns={numericColumns} />
            </div>
        )}
        {visibleCharts.passRate && (
            <div className={`${visibleCharts.histogram ? '' : 'lg:col-span-3'} bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-[350px] flex flex-col min-w-0`}>
                <PassRateChart columns={numericColumns} />
            </div>
        )}
      </div>

      {/* NEW: Radar Grid */}
      {visibleCharts.radarGrid && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 min-h-[300px]">
           <ClassRadarGrid sheet={sheet} />
        </div>
      )}

      {/* NEW: Score Heatmap */}
      {visibleCharts.scoreHeatmap && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-[500px] flex flex-col">
           <ScoreHeatmap sheet={sheet} />
        </div>
      )}

      {/* 3. Class Boxes & Subject Scatter */}
      {showScoreDependentCharts && (visibleCharts.boxPlot || visibleCharts.subjectScatter) && (
        <div className={`grid grid-cols-1 ${visibleCharts.boxPlot && visibleCharts.subjectScatter ? 'lg:grid-cols-2' : ''} gap-6`}>
           {visibleCharts.boxPlot && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-[400px] flex flex-col min-w-0">
                 <ClassBoxPlot sheet={sheet} totalColName={totalScoreCol!} />
              </div>
           )}
           {visibleCharts.subjectScatter && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-[400px] flex flex-col min-w-0">
                 <SubjectScatterChart sheet={sheet} totalColName={totalScoreCol!} />
              </div>
           )}
        </div>
      )}

      {/* 4. Regression & S-Curve */}
      {showScoreDependentCharts && (visibleCharts.regression || visibleCharts.sCurve) && (
        <div className={`grid grid-cols-1 ${visibleCharts.regression && visibleCharts.sCurve && showRankDependentCharts ? 'lg:grid-cols-2' : ''} gap-6`}>
           {visibleCharts.regression && (
               <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-[400px] flex flex-col min-w-0">
                  <RegressionChart columns={numericColumns} rows={sheet.rows} totalColName={totalScoreCol!} />
               </div>
           )}

          {showRankDependentCharts && visibleCharts.sCurve && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-[400px] flex flex-col min-w-0">
              <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">排名分布曲线 (S-Curve)</h3>
              <div className="flex-1 w-full relative min-h-0 min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scoreVsRankData!} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="rank" 
                      label={{ value: '排名', position: 'insideBottomRight', offset: -5 }} 
                      type="number" 
                      domain={['dataMin', 'dataMax']} 
                      allowDecimals={false}
                    />
                    <YAxis 
                      label={{ value: '总分', angle: -90, position: 'insideLeft' }} 
                      domain={['auto', 'auto']} 
                    />
                    <Tooltip content={<ChartTooltip />} formatter={(value: any) => [value, '总分']} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#10b981" 
                      strokeWidth={2} 
                      dot={false} 
                      name="总分" 
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Scatter Analysis */}
      {numericColumns.length > 1 && visibleCharts.scatter && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-[500px] flex flex-col min-w-0">
          <GeneralScatterChart 
            columns={numericColumns} 
            rows={sheet.rows} 
            nameColIndex={nameColIndex} 
          />
        </div>
      )}

      {/* 6. Heatmap */}
      {numericColumns.length > 1 && visibleCharts.heatmap && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden min-w-0">
          <CorrelationHeatmap columns={numericColumns} />
        </div>
      )}

    </div>
  );
};

export default StatsDashboard;