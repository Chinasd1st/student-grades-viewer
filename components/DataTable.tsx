import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Sheet } from '../types';
import { exportToCSV } from '../utils/exportUtils';
import StudentDetailModal from './StudentDetailModal';
import { getGradeFromPercentile, getNumericColumns, getScoreRankStats } from '../utils/statsUtils';

interface DataTableProps {
  data: Sheet;
  sheetName?: string; // Add sheetName prop to detect context
}

type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  key: number;
  direction: SortDirection;
}

// Definition for grouped headers
interface ColumnGroup {
  name: string; // The main label (e.g. "语文")
  columns: {
    originalIndex: number;
    subName: string; // The sub label (e.g. "得分", "排名", "校次")
    isRank: boolean;
  }[];
}

const ITEMS_PER_PAGE = 50;

const DataTable: React.FC<DataTableProps> = ({ data, sheetName = '' }) => {
  // Detect if this is a "History" / "Aggregate" sheet based on name convention
  const isHistoryView = useMemo(() => sheetName.includes('历次'), [sheetName]);

  const [columnOrder, setColumnOrder] = useState<number[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: -1, direction: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [hiddenColumns, setHiddenColumns] = useState<Set<number>>(new Set());
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCompact, setIsCompact] = useState(isHistoryView); // Default to compact for history
  const [detailModalData, setDetailModalData] = useState<{columns: string[], row: any[], sheet: Sheet} | null>(null);
  
  // Freezing State
  const [frozenColCount, setFrozenColCount] = useState(1); 
  const [frozenRowCount, setFrozenRowCount] = useState(1); 

  const tableRef = useRef<HTMLTableElement>(null);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);

  // Initialize column order on data change
  useEffect(() => {
    setColumnOrder(data.columns.map((_, i) => i));
  }, [data.columns]);

  // Measure widths for sticky columns logic
  useEffect(() => {
    if (!tableRef.current) return;
    const measure = () => {
       const headerCells = tableRef.current?.querySelectorAll('thead th');
       if (headerCells) {
           const widths: number[] = [];
           headerCells.forEach((cell) => widths.push((cell as HTMLElement).offsetWidth));
           setColumnWidths(widths);
       }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => {
        window.removeEventListener('resize', measure);
        clearTimeout(timer);
    };
  }, [data, columnOrder, hiddenColumns, isCompact]);

  // --- 1. Smart Header Grouping Logic ---
  const columnGroups = useMemo(() => {
    const groups: ColumnGroup[] = [];
    const processed = new Set<number>();
    
    // Use the visual column order
    const visibleIndices = columnOrder.filter(idx => !hiddenColumns.has(idx));

    for (let i = 0; i < visibleIndices.length; i++) {
        const originalIndex = visibleIndices[i];
        if (processed.has(originalIndex)) continue;

        const colName = data.columns[originalIndex];
        
        // Metadata Columns: Exclude from "Subject" grouping blocks
        // Explicitly include "信息" (Info) and "通用" (General) here to prevent them being treated as score blocks or merged incorrectly
        if (/准考证|号|ID|姓名|Name|班级|Class|班主任|联系领导|信息|通用/.test(colName)) {
            groups.push({
                name: colName,
                columns: [{ originalIndex: originalIndex, subName: '', isRank: false }]
            });
            processed.add(originalIndex);
            continue;
        }

        // Start a new potential subject group (e.g., "12月总分", "12月技术")
        const group: ColumnGroup = {
            name: colName,
            columns: [{ originalIndex: originalIndex, subName: '得分', isRank: false }]
        };
        processed.add(originalIndex);

        // Look ahead for associated metric columns in the *visible* order
        // We only group implicit ranks ("排名", "校次") or explicit sub-ranks
        let nextVisualIdx = i + 1;
        while (nextVisualIdx < visibleIndices.length) {
            const nextOriginalIdx = visibleIndices[nextVisualIdx];
            const nextColName = data.columns[nextOriginalIdx];
            
            const isImplicitRank = ['排名', '校次', '班次', 'Rank'].includes(nextColName);
            const isExplicitRank = nextColName.includes(colName) && /次|Rank|排名/.test(nextColName);

            if (isImplicitRank || isExplicitRank) {
                let subName = nextColName;
                if (isExplicitRank) {
                    subName = nextColName.replace(colName, '').replace('+', '').trim();
                }
                
                group.columns.push({
                    originalIndex: nextOriginalIdx,
                    subName: subName,
                    isRank: true
                });
                processed.add(nextOriginalIdx);
                nextVisualIdx++;
            } else {
                break; // Stop grouping if next column is a new subject (e.g., "12月技术" after "通用")
            }
        }
        groups.push(group);
    }

    return groups;
  }, [data.columns, hiddenColumns, columnOrder]);

  // --- 2. Data Caching ---
  const columnValuesCache = useMemo(() => {
    // Exclude summary rows from stats
    const classIdx = data.columns.findIndex(c => c === '班级' || c === 'Class');
    
    const validRowsForStats = data.rows.filter(row => {
        if (classIdx === -1) return true;
        const clsVal = String(row[classIdx] || '');
        return !clsVal.includes('平均') && clsVal.length < 10;
    });

    const tempSheet = { ...data, rows: validRowsForStats };
    const numericCols = getNumericColumns(tempSheet);
    
    const cache = new Map<number, number[]>();
    numericCols.forEach(col => {
      cache.set(col.index, [...col.values].sort((a, b) => b - a));
    });
    return cache;
  }, [data]);

  // --- 3. Filtering & Sorting ---
  const classColIndex = useMemo(() => data.columns.findIndex(c => c === '班级' || c === 'Class'), [data.columns]);
  
  const classes = useMemo(() => {
      if (classColIndex === -1) return [];
      const s = new Set<string>();
      data.rows.forEach(r => {
          const val = String(r[classColIndex] || '');
          if (val && !val.includes('平均')) s.add(val);
      });
      return Array.from(s).sort();
  }, [data.rows, classColIndex]);

  const filteredRows = useMemo(() => {
    let res = data.rows;
    if (selectedClass !== 'all' && classColIndex !== -1) {
      res = res.filter(row => String(row[classColIndex]) === selectedClass);
    }
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      res = res.filter(row => row.some(cell => String(cell).toLowerCase().includes(lowerTerm)));
    }
    return res;
  }, [data.rows, searchTerm, selectedClass, classColIndex]);

  const sortedRows = useMemo(() => {
    if (sortConfig.direction === null || sortConfig.key === -1) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortConfig.direction === 'asc' 
        ? String(aVal).localeCompare(String(bVal), 'zh-CN')
        : String(bVal).localeCompare(String(aVal), 'zh-CN');
    });
  }, [filteredRows, sortConfig]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedRows.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedRows, currentPage]);

  // --- 4. Render Helpers ---
  const handleSort = (idx: number) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === idx && sortConfig.direction === 'asc') direction = 'desc';
    else if (sortConfig.key === idx && sortConfig.direction === 'desc') direction = null;
    setSortConfig({ key: idx, direction });
  };

  const toggleColumn = (idx: number) => {
    const newHidden = new Set(hiddenColumns);
    if (newHidden.has(idx)) newHidden.delete(idx);
    else newHidden.add(idx);
    setHiddenColumns(newHidden);
  };

  const getStickyStyle = (visualIndex: number) => {
    if (visualIndex < frozenColCount && columnWidths.length > 0) {
        const left = columnWidths.slice(0, visualIndex).reduce((a, b) => a + b, 0);
        return { 
            position: 'sticky' as const, 
            left: `${left}px`, 
            zIndex: 20 
        };
    }
    return {};
  };

  const getCellClass = (val: any, colIdx: number, isRank: boolean) => {
    if (val === null || val === undefined || val === '') return 'text-center text-gray-300';
    
    // String content (Names, Info, General teachers)
    if (typeof val !== 'number') return 'text-left text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap';
    
    let baseClass = 'font-mono text-right ';
    
    // Rank columns styling
    if (isRank) return baseClass + 'text-gray-400 dark:text-gray-500 italic text-xs';

    // Score coloring
    const sortedValues = columnValuesCache.get(colIdx);
    if (sortedValues) {
        const { percentile } = getScoreRankStats(val, sortedValues);
        const gradeAttr = getGradeFromPercentile(percentile);
        
        if (gradeAttr) {
            // Apply full color grading even for history views to maintain consistency
            switch (gradeAttr.label) {
                case 'A+': return baseClass + 'text-emerald-700 dark:text-emerald-400 font-extrabold';
                case 'A':  return baseClass + 'text-green-600 dark:text-green-400 font-bold';
                case 'A-': return baseClass + 'text-lime-600 dark:text-lime-400 font-semibold';
                case 'B+': return baseClass + 'text-blue-600 dark:text-blue-400 font-medium';
                case 'B':  return baseClass + 'text-sky-600 dark:text-sky-400';
                case 'B-': return baseClass + 'text-cyan-600 dark:text-cyan-400';
                case 'C':  return baseClass + 'text-yellow-600 dark:text-yellow-500';
                case 'D':  return baseClass + 'text-red-600 dark:text-red-400 font-bold';
                default:   return baseClass + 'text-gray-700 dark:text-gray-300';
            }
        }
    }
    return baseClass + 'text-gray-700 dark:text-gray-300';
  };

  const handleRowClick = (row: any[]) => {
      // Disable modal for History summary sheets
      if (isHistoryView) return; 
      
      const isSummaryRow = String(row[0]).includes('平均');
      if (!isSummaryRow) {
          setDetailModalData({ columns: data.columns, row, sheet: data });
      }
  };

  // Helper for tracking visual index during rendering
  let visualColIndexCounter = 0;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden w-full">
      <StudentDetailModal isOpen={!!detailModalData} onClose={() => setDetailModalData(null)} data={detailModalData} />

      {/* Toolbar */}
      <div className={`p-2 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-2 justify-between items-center text-sm
        ${isHistoryView ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'bg-gray-50/50 dark:bg-gray-800/50'}
      `}>
         <div className="flex gap-2 items-center flex-1">
            <input type="text" placeholder="搜索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm w-32 sm:w-48 text-gray-900 dark:text-white" />
            
            {classes.length > 0 && (
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white cursor-pointer">
                    <option value="all">全部班级</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            )}
            
            {isHistoryView && (
                <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-md font-medium border border-amber-200 dark:border-amber-800">
                    历史统计概览
                </span>
            )}
         </div>
         
         <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {/* Freeze Controls */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded hidden sm:flex">
                <span className="text-xs text-gray-500 dark:text-gray-400 px-1">冻结:</span>
                <input 
                    type="number" 
                    min="0" 
                    max="5"
                    value={frozenColCount}
                    onChange={(e) => setFrozenColCount(Math.min(5, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-10 p-0.5 text-center text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1 shadow-sm whitespace-nowrap"
              >
                <span>显示列</span>
                <span className="bg-gray-100 dark:bg-gray-600 px-1 rounded text-[10px]">{data.columns.length - hiddenColumns.size}</span>
              </button>
              {showColumnMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col overflow-hidden max-h-[300px] overflow-y-auto">
                   <div className="p-2">
                     {data.columns.map((col, idx) => (
                      <label key={idx} className="flex items-center px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!hiddenColumns.has(idx)}
                          onChange={() => toggleColumn(idx)}
                          className="rounded border-gray-300 text-blue-600 mr-2"
                        />
                        <span className="text-xs text-gray-700 dark:text-gray-200 truncate">{col}</span>
                      </label>
                    ))}
                   </div>
                   <div className="fixed inset-0 z-[-1]" onClick={() => setShowColumnMenu(false)}></div>
                </div>
              )}
            </div>

            <button onClick={() => exportToCSV(isHistoryView ? '历史成绩统计' : '成绩表', data.columns, sortedRows)} className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm whitespace-nowrap shadow-sm transition-colors">导出</button>
            <button onClick={() => setIsCompact(!isCompact)} className="p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
               {isCompact ? "舒适" : "紧凑"}
            </button>
         </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-auto w-full scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
        <table ref={tableRef} className="w-full border-separate border-spacing-0 text-sm">
          <thead className={`sticky top-0 z-30 shadow-sm ${isHistoryView ? 'bg-amber-50 dark:bg-gray-900' : 'bg-gray-100 dark:bg-gray-900'}`}>
            {/* Level 1: Subject Groups */}
            <tr>
              {columnGroups.map((group, gIdx) => {
                const colSpan = group.columns.length;
                // Calculate sticky positioning for the group if needed
                const firstColVisualIndex = visualColIndexCounter; 
                const stickyStyle = getStickyStyle(firstColVisualIndex);
                visualColIndexCounter += colSpan;

                return (
                  <th
                    key={`g-${gIdx}`}
                    colSpan={colSpan}
                    className={`
                      px-2 py-1.5 text-center font-bold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200 dark:border-gray-700
                      ${isHistoryView 
                          ? (gIdx % 2 === 0 ? 'bg-amber-50 dark:bg-gray-900' : 'bg-orange-100/50 dark:bg-orange-900/20') 
                          : (gIdx % 2 === 0 ? 'bg-gray-100 dark:bg-gray-900' : 'bg-blue-50/40 dark:bg-blue-900/20')
                      }
                    `}
                    style={stickyStyle.position ? { ...stickyStyle, zIndex: 25 } : {}}
                  >
                    {group.name}
                  </th>
                );
              })}
            </tr>
            {/* Level 2: Specific Metrics */}
            <tr className="bg-gray-50 dark:bg-gray-800">
              {(() => {
                  let subVisualIndex = 0;
                  return columnGroups.map((group, gIdx) => (
                    group.columns.map((col) => {
                      const stickyStyle = getStickyStyle(subVisualIndex);
                      subVisualIndex++;
                      
                      return (
                        <th
                            key={`c-${col.originalIndex}`}
                            onClick={() => handleSort(col.originalIndex)}
                            className={`
                            ${isCompact ? 'px-1 py-1 text-[10px]' : 'px-3 py-2 text-xs'}
                            cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-r border-gray-200 dark:border-gray-700 text-gray-500 whitespace-nowrap font-semibold
                            ${isHistoryView 
                                ? (gIdx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-orange-50/30 dark:bg-orange-900/10')
                                : (gIdx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-blue-50/20 dark:bg-blue-900/10')
                            }
                            `}
                            style={stickyStyle}
                        >
                            <div className="flex items-center justify-center gap-1">
                            <span>{col.subName || group.name}</span>
                            {sortConfig.key === col.originalIndex && (
                                <span className="text-blue-500 font-bold">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                            </div>
                        </th>
                      );
                    })
                  ));
              })()}
            </tr>
          </thead>
          
          <tbody className="bg-white dark:bg-gray-900">
            {paginatedRows.map((row, rowIdx) => {
              const prevRow = paginatedRows[rowIdx - 1];
              const showClassDivider = prevRow && classColIndex !== -1 && row[classColIndex] !== prevRow[classColIndex];
              const isSummaryRow = String(row[0]).includes('平均');

              return (
                <React.Fragment key={rowIdx}>
                  {showClassDivider && (
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      <td colSpan={data.columns.length} className="h-2 border-y border-gray-200 dark:border-gray-700"></td>
                    </tr>
                  )}
                  <tr 
                    onClick={() => handleRowClick(row)}
                    className={`
                        transition-colors group border-b border-gray-50 dark:border-gray-800
                        ${isSummaryRow 
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 font-bold hover:bg-yellow-100 dark:hover:bg-yellow-900/30' 
                            : isHistoryView 
                                ? 'hover:bg-amber-50/50 dark:hover:bg-amber-900/10' // No cursor-pointer for history to imply no click
                                : 'hover:bg-blue-50/50 dark:hover:bg-blue-900/20 cursor-pointer'
                        }
                    `}
                  >
                    {(() => {
                        let cellVisualIndex = 0;
                        return columnGroups.map((group, gIdx) => (
                            group.columns.map((col) => {
                                const cell = row[col.originalIndex];
                                const stickyStyle = getStickyStyle(cellVisualIndex);
                                const isSticky = !!stickyStyle.position;
                                cellVisualIndex++;

                                return (
                                <td
                                    key={col.originalIndex}
                                    className={`
                                    ${isCompact ? 'px-1 py-1' : 'px-3 py-2.5'}
                                    border-r border-gray-100 dark:border-gray-800 whitespace-nowrap
                                    ${getCellClass(cell, col.originalIndex, col.isRank)}
                                    ${isHistoryView 
                                        ? (gIdx % 2 === 0 ? '' : 'bg-orange-50/10 dark:bg-orange-900/5')
                                        : (gIdx % 2 === 0 ? '' : 'bg-blue-50/5 dark:bg-blue-900/5')
                                    }
                                    ${isSticky && !isSummaryRow ? 'bg-white dark:bg-gray-900' : ''}
                                    ${isSticky ? 'border-r-2 border-gray-200 dark:border-gray-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]' : ''}
                                    `}
                                    style={isSticky ? { ...stickyStyle, zIndex: 10 } : {}}
                                >
                                    {cell === null || cell === undefined || cell === '' ? <span className="text-gray-200">-</span> : cell}
                                </td>
                                );
                            })
                        ));
                    })()}
                  </tr>
                </React.Fragment>
              );
            })}
            {paginatedRows.length === 0 && (
                <tr>
                    <td colSpan={data.columns.length} className="p-8 text-center text-gray-400">无数据</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / Pagination */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
          <span>共 {sortedRows.length} 条记录 {selectedClass !== 'all' ? `(当前班级: ${selectedClass})` : ''}</span>
          <div className="flex gap-2 items-center">
             <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-2 py-1 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-gray-500">上一页</button>
             <span className="font-mono font-medium text-gray-700 dark:text-gray-200">{currentPage} / {Math.ceil(sortedRows.length / ITEMS_PER_PAGE) || 1}</span>
             <button disabled={paginatedRows.length < ITEMS_PER_PAGE} onClick={() => setCurrentPage(p => p + 1)} className="px-2 py-1 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-gray-500">下一页</button>
          </div>
      </div>
    </div>
  );
};

export default DataTable;