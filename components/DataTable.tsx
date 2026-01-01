import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Sheet } from '../types';
import { exportToCSV } from '../utils/exportUtils';
import StudentDetailModal from './StudentDetailModal';
import { getGradeAttributes, getFullMark } from '../utils/statsUtils';

interface DataTableProps {
  data: Sheet;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  key: number; // Column Index relative to ORIGINAL data
  direction: SortDirection;
}

const ITEMS_PER_PAGE = 50;

const DataTable: React.FC<DataTableProps> = ({ data }) => {
  // State for Reordering
  const [columnOrder, setColumnOrder] = useState<number[]>([]);

  // State for Sorting & Filtering
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: -1, direction: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  
  // State for UI Config
  const [hiddenColumns, setHiddenColumns] = useState<Set<number>>(new Set());
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCompact, setIsCompact] = useState(false);
  const [detailModalData, setDetailModalData] = useState<{columns: string[], row: any[]} | null>(null);

  // Freezing State
  const [frozenColCount, setFrozenColCount] = useState(1); // Default freeze first column
  const [frozenRowCount, setFrozenRowCount] = useState(1); // 1 = Header only, 0 = None

  // Drag & Drop State
  const [draggingColIndex, setDraggingColIndex] = useState<number | null>(null);

  // Ref to measure column widths for sticky calculation
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
    // Measure initially and after a short timeout for layout settle
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => {
        window.removeEventListener('resize', measure);
        clearTimeout(timer);
    };
  }, [data, columnOrder, hiddenColumns, isCompact]);

  // --- 0. Helpers ---
  const isExcludedColumn = (colName: string) => /排名|Rank|号|ID|次|班级|Class|姓名|Name/.test(colName);
  const isCompositeColumn = (colName: string) => /\+|语数英|总分|Total|Sum/.test(colName);

  // --- 1. Class List ---
  const classColIndex = useMemo(() => data.columns.findIndex(c => c === '班级' || c === 'Class'), [data.columns]);
  const classes = useMemo(() => {
    if (classColIndex === -1) return [];
    const clsSet = new Set<string>();
    data.rows.forEach(r => {
      const val = r[classColIndex];
      if (val !== null && val !== undefined) clsSet.add(String(val));
    });
    return Array.from(clsSet).sort();
  }, [data.rows, classColIndex]);

  // --- 2. Filtering ---
  const filteredRows = useMemo(() => {
    let res = data.rows;
    if (selectedClass !== 'all' && classColIndex !== -1) {
      res = res.filter(row => String(row[classColIndex]) === selectedClass);
    }
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      res = res.filter(row => 
        row.some(cell => String(cell).toLowerCase().includes(lowerTerm))
      );
    }
    return res;
  }, [data.rows, searchTerm, selectedClass, classColIndex]);

  // --- 3. Sorting ---
  const sortedRows = useMemo(() => {
    if (sortConfig.direction === null || sortConfig.key === -1) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortConfig.direction === 'asc' 
        ? String(aVal).localeCompare(String(bVal), 'zh-CN')
        : String(bVal).localeCompare(String(aVal), 'zh-CN');
    });
  }, [filteredRows, sortConfig]);

  // --- 4. Pagination ---
  const totalPages = Math.ceil(sortedRows.length / ITEMS_PER_PAGE);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedRows.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedRows, currentPage]);

  // --- 5. Stats ---
  const summaryStats = useMemo(() => {
    const stats: { [key: number]: { avg: number; max: number; min: number; passRate: number | null } | null } = {};
    
    data.columns.forEach((colName, idx) => {
      if (hiddenColumns.has(idx) || isExcludedColumn(colName)) return;
      let sum = 0, count = 0, max = -Infinity, min = Infinity, passCount = 0;
      let isNumeric = true;
      const isComposite = isCompositeColumn(colName);
      const isMainSubject = /语文|数学|英语|English|Chinese|Math/.test(colName) && !isComposite;
      const passScore = isMainSubject ? 90 : 60; 

      for (const row of filteredRows) { 
        const val = row[idx];
        if (typeof val === 'number') {
          sum += val;
          count++;
          if (val > max) max = val;
          if (val < min) min = val;
          if (!isComposite && val >= passScore) passCount++;
        } else if (val !== null && val !== undefined && val !== '') {
           isNumeric = false;
           break;
        }
      }

      if (isNumeric && count > 0) {
        stats[idx] = { 
          avg: sum / count, 
          max: max,
          min: min,
          passRate: isComposite ? null : (passCount / count) * 100
        };
      } else {
        stats[idx] = null;
      }
    });
    return stats;
  }, [data.columns, filteredRows, hiddenColumns]);

  // --- Drag & Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggingColIndex(index); // Index within columnOrder array
    e.dataTransfer.effectAllowed = "move";
    // Set a transparent ghost image if possible, or just let default happen
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggingColIndex === null || draggingColIndex === targetIndex) return;

    const newOrder = [...columnOrder];
    const item = newOrder.splice(draggingColIndex, 1)[0];
    newOrder.splice(targetIndex, 0, item);
    
    setColumnOrder(newOrder);
    setDraggingColIndex(null);
  };

  // --- Column Styling & Sticky Logic ---
  const getStickyStyle = (visualIndex: number) => {
    if (visualIndex < frozenColCount && columnWidths.length > 0) {
        // Calculate accumulated left position
        const left = columnWidths.slice(0, visualIndex).reduce((a, b) => a + b, 0);
        return { 
            position: 'sticky' as const, 
            left: `${left}px`, 
            zIndex: 20 
        };
    }
    return {};
  };

  // --- Render Helpers ---
  const handleSort = (originalIndex: number) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === originalIndex && sortConfig.direction === 'asc') direction = 'desc';
    else if (sortConfig.key === originalIndex && sortConfig.direction === 'desc') direction = null;
    setSortConfig({ key: originalIndex, direction });
  };

  const toggleColumn = (idx: number) => {
    const newHidden = new Set(hiddenColumns);
    if (newHidden.has(idx)) newHidden.delete(idx);
    else newHidden.add(idx);
    setHiddenColumns(newHidden);
  };

  const handleExport = () => {
    // Use columnOrder to export in current visual order
    const visibleVisualIndices = columnOrder.map((_, i) => i).filter(i => !hiddenColumns.has(columnOrder[i]));
    const visibleCols = visibleVisualIndices.map(i => data.columns[columnOrder[i]]);
    const visibleRows = sortedRows.map(row => visibleVisualIndices.map(i => row[columnOrder[i]]));
    exportToCSV('学生成绩表', visibleCols, visibleRows);
  };

  const getCellClass = (val: any, colName: string) => {
    if (typeof val !== 'number') return 'text-left text-gray-700 dark:text-gray-300';
    let baseClass = 'font-mono text-right ';
    
    if (isExcludedColumn(colName)) return baseClass + 'text-gray-600 dark:text-gray-400';

    if (isCompositeColumn(colName)) {
        if (/总分|Total/.test(colName)) return baseClass + 'font-extrabold text-indigo-700 dark:text-indigo-400 text-base';
        return baseClass + 'font-bold text-blue-600 dark:text-blue-400';
    }

    // Use refined grading coloring with NO background for table alignment
    const fullMark = getFullMark(colName);
    const gradeAttr = getGradeAttributes(val, fullMark);
    
    if (gradeAttr) {
        // Map labels to strict text colors
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

    return baseClass + 'text-gray-700 dark:text-gray-300';
  };

  const visibleColumnOrder = columnOrder.filter(idx => !hiddenColumns.has(idx));

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden w-full">
      
      <StudentDetailModal 
        isOpen={!!detailModalData} 
        onClose={() => setDetailModalData(null)} 
        data={detailModalData} 
      />

      {/* --- 工具栏 --- */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-2 justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 text-sm">
        
        {/* Filter Section */}
        <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center flex-1">
            <div className="relative w-full sm:w-48 group">
                <input
                    type="text"
                    placeholder="搜索..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-8 pr-2 py-1.5 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            
            {classes.length > 0 && (
                <div className="relative w-full sm:w-32">
                    <select
                        value={selectedClass}
                        onChange={(e) => { setSelectedClass(e.target.value); setCurrentPage(1); }}
                        className="w-full pl-2 pr-6 py-1.5 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none cursor-pointer"
                    >
                        <option value="all">全部班级</option>
                        {classes.map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>

        {/* View Settings Section */}
        <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap shrink-0 ml-auto">
          {/* Freeze Controls */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded">
             <span className="text-xs text-gray-500 dark:text-gray-400 px-1">冻结列:</span>
             <input 
                type="number" 
                min="0" 
                max="5"
                value={frozenColCount}
                onChange={(e) => setFrozenColCount(Math.min(5, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-10 p-0.5 text-center text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
             />
          </div>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded">
             <label className="flex items-center gap-1 cursor-pointer">
                 <input 
                    type="checkbox" 
                    checked={frozenRowCount > 0} 
                    onChange={(e) => setFrozenRowCount(e.target.checked ? 1 : 0)}
                    className="rounded text-blue-600 focus:ring-0 w-3 h-3"
                 />
                 <span className="text-xs text-gray-500 dark:text-gray-400">冻结表头</span>
             </label>
          </div>

          <button 
             onClick={() => setIsCompact(!isCompact)}
             title={isCompact ? "舒适视图" : "紧凑视图"}
             className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
          >
             {isCompact ? (
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
             ) : (
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
             )}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              className="px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1 shadow-sm whitespace-nowrap"
            >
              <span>显示列</span>
              <span className="bg-gray-100 dark:bg-gray-600 px-1 rounded text-[10px]">
                {data.columns.length - hiddenColumns.size}
              </span>
            </button>
            {showColumnMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col overflow-hidden animate-[fadeIn_0.1s_ease-out]">
                <div className="max-h-[300px] overflow-y-auto p-2 scrollbar-thin">
                   {data.columns.map((col, idx) => (
                    <label key={idx} className="flex items-center px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!hiddenColumns.has(idx)}
                        onChange={() => toggleColumn(idx)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2 h-3.5 w-3.5"
                      />
                      <span className="text-xs text-gray-700 dark:text-gray-200 truncate">{col}</span>
                    </label>
                  ))}
                </div>
                <div className="fixed inset-0 z-[-1]" onClick={() => setShowColumnMenu(false)}></div>
              </div>
            )}
          </div>

          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-xs sm:text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 flex items-center gap-1 shadow-sm whitespace-nowrap"
          >
            <span>导出</span>
          </button>
        </div>
      </div>

      {/* --- 表格主体 --- */}
      <div className="flex-1 overflow-auto w-full relative scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
        <table ref={tableRef} className="w-full border-separate border-spacing-0 text-sm">
          <thead className={`${frozenRowCount > 0 ? 'sticky top-0 z-[25]' : ''} bg-gray-50 dark:bg-gray-800 shadow-sm`}>
            <tr>
              {visibleColumnOrder.map((originalIdx, visualIdx) => {
                const colName = data.columns[originalIdx];
                const minWidth = colName.length > 4 ? 'min-w-[100px]' : 'min-w-[80px]';
                const stickyStyle = getStickyStyle(visualIdx);
                const isSticky = !!stickyStyle.position;

                return (
                  <th
                    key={originalIdx}
                    draggable
                    onDragStart={(e) => handleDragStart(e, visualIdx)}
                    onDragOver={(e) => handleDragOver(e, visualIdx)}
                    onDrop={(e) => handleDrop(e, visualIdx)}
                    onClick={() => handleSort(originalIdx)}
                    className={`
                      ${isCompact ? 'px-2 py-1.5 text-xs' : 'px-4 py-3'}
                      font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 
                      whitespace-nowrap cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none group text-left
                      ${minWidth}
                      ${isSticky ? 'bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]' : ''}
                      ${draggingColIndex === visualIdx ? 'opacity-50 border-dashed border-2 border-blue-400' : ''}
                    `}
                    style={stickyStyle}
                  >
                    <div className="flex items-center gap-1 justify-between">
                      <span className="truncate cursor-move" title={colName}>{colName}</span>
                      <span className="text-gray-400 w-4 flex justify-center flex-shrink-0">
                        {sortConfig.key === originalIdx ? (
                          <span className="text-blue-500 font-bold">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        ) : (
                          <span className="opacity-0 group-hover:opacity-50 text-xs transition-opacity">⇅</span>
                        )}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900">
            {paginatedRows.map((row, rowIdx) => (
              <tr 
                key={rowIdx} 
                onClick={() => setDetailModalData({ columns: data.columns, row })}
                className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors duration-75 group cursor-pointer"
              >
                {visibleColumnOrder.map((originalIdx, visualIdx) => {
                  const cell = row[originalIdx];
                  const colName = data.columns[originalIdx];
                  const stickyStyle = getStickyStyle(visualIdx);
                  const isSticky = !!stickyStyle.position;

                  return (
                    <td
                      key={originalIdx}
                      className={`
                        ${isCompact ? 'px-2 py-1' : 'px-4 py-3'}
                        whitespace-nowrap border-b border-gray-100 dark:border-gray-800
                        ${getCellClass(cell, colName)}
                        ${isSticky ? 'bg-white dark:bg-gray-900 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/10 border-r border-gray-200 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]' : ''}
                      `}
                      style={{ ...stickyStyle, zIndex: isSticky ? 10 : 'auto' }}
                    >
                      {cell === null || cell === undefined ? <span className="text-gray-300">-</span> : cell}
                    </td>
                  );
                })}
              </tr>
            ))}
            {paginatedRows.length === 0 && (
              <tr>
                <td colSpan={visibleColumnOrder.length} className="p-16 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <span>未找到匹配的数据</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          
          {paginatedRows.length > 0 && (
             <tfoot className="sticky bottom-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)] border-t border-gray-300 dark:border-gray-600">
                <tr>
                  {visibleColumnOrder.map((originalIdx, visualIdx) => {
                     const stat = summaryStats[originalIdx];
                     const stickyStyle = getStickyStyle(visualIdx);
                     const isSticky = !!stickyStyle.position;

                     return (
                       <td 
                        key={originalIdx} 
                        className={`
                          ${isCompact ? 'px-2 py-1' : 'px-4 py-2'}
                          whitespace-nowrap text-xs bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600
                          ${isSticky ? 'border-r border-gray-200 dark:border-gray-600 font-bold text-gray-600 dark:text-gray-300 z-40' : ''}
                        `}
                        style={stickyStyle}
                       >
                          {stat ? (
                             <div className="flex flex-col items-end gap-0.5 leading-tight">
                               <span title="平均分" className="text-blue-600 dark:text-blue-400 font-bold">Avg: {stat.avg.toFixed(1)}</span>
                               {!isCompact && (
                                   <div className="flex gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                                      <span title="最高分">Max: {stat.max}</span>
                                      {stat.passRate !== null && <span title="及格率" className={stat.passRate < 60 ? 'text-red-500' : ''}>及: {stat.passRate.toFixed(0)}%</span>}
                                   </div>
                               )}
                             </div>
                          ) : (
                             visualIdx === 0 ? "本页统计:" : "-"
                          )}
                       </td>
                     );
                  })}
                </tr>
             </tfoot>
          )}
        </table>
      </div>

      {/* --- 分页栏 --- */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-gray-800 flex justify-between items-center text-xs sm:text-sm">
        <span className="text-gray-500 dark:text-gray-400 pl-2">
          {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, sortedRows.length)} / {sortedRows.length}
        </span>
        <div className="flex gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
          >
            上一页
          </button>
          <div className="px-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-200 font-medium">
            {currentPage} / {totalPages || 1}
          </div>
          <button
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(p => p + 1)}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataTable;