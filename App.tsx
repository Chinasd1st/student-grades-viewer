import React, { useState, useEffect } from 'react';
import SheetSelector from './components/SheetSelector';
import DataTable from './components/DataTable';
import StatsDashboard from './components/StatsDashboard';
import { AppData } from './types';
import jsonData from './data.json';
import historyJson from './history.json'; // Import the new file
import { processHistoryData } from './utils/dataProcessor';

type ViewMode = 'table' | 'stats';

const App: React.FC = () => {
  // Initialize state merging both data sources
  const [data, setData] = useState<AppData | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Process and merge data
      const processedData = processHistoryData(historyJson, jsonData as unknown as AppData);
      setData(processedData);

      // Initialize active sheet
      if (processedData.sheetNames.length > 0) {
        setActiveSheet(processedData.sheetNames[0]);
      }
    } catch (e) {
      console.error("Failed to load data", e);
      setError("数据加载失败");
    }

    // Check system preference for dark mode
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []); 

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-red-500">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200 overflow-hidden">
      {/* Header / Nav */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0 z-30">
        <div className="w-full px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-1 rounded-md">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white tracking-tight hidden sm:block">
              学生成绩管理系统
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* View Switcher */}
            <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('table')}
                className={`
                  px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2
                  ${viewMode === 'table' 
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}
                `}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                数据表
              </button>
              <button
                onClick={() => setViewMode('stats')}
                className={`
                  px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2
                  ${viewMode === 'stats' 
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}
                `}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                统计图表
              </button>
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Toggle Dark Mode"
            >
              {darkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area - Full width, reduced padding */}
      <main className="flex-1 flex flex-col w-full mx-auto p-2 overflow-hidden">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden h-full">
          {/* Sheet Selector */}
          <SheetSelector 
            sheets={data.sheetNames} 
            activeSheet={activeSheet} 
            onSelect={setActiveSheet} 
          />
          
          {/* Content Container */}
          <div className="flex-1 overflow-hidden relative flex flex-col bg-gray-50 dark:bg-gray-900/50">
            {activeSheet && data.sheets[activeSheet] ? (
              viewMode === 'table' ? (
                <div className="flex-1 overflow-hidden p-0">
                   <DataTable 
                    key={activeSheet} 
                    data={data.sheets[activeSheet]} 
                    sheetName={activeSheet}
                  />
                </div>
              ) : (
                <StatsDashboard 
                  key={activeSheet} 
                  sheet={data.sheets[activeSheet]} 
                  sheetName={activeSheet} 
                />
              )
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                请选择一张表格查看数据
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;