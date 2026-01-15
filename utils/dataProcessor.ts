import { Sheet, AppData } from '../types';

export const processHistoryData = (historyData: any, existingData: AppData): AppData => {
  const newSheets: { [key: string]: Sheet } = { ...existingData.sheets };
  const newSheetNames: string[] = [...existingData.sheetNames];

  // Robustly determine the raw sheet object
  let rawSheet: Sheet | null = null;
  
  if (historyData) {
      if (Array.isArray(historyData.rows) && Array.isArray(historyData.columns)) {
          // Case 1: history.json root is the sheet (Direct export)
          rawSheet = historyData;
      } else if (historyData['历次成绩']) {
          // Case 2: Nested under key (Standard structure)
          rawSheet = historyData['历次成绩'];
      }
  }

  if (rawSheet) {
    const rows = rawSheet.rows;
    
    // Find all indices where a new header row starts (Column 0 is '班级')
    const headerIndices: number[] = [];
    rows.forEach((row: any[], index: number) => {
      // Use loose check and trim to handle potential whitespace or type mismatches
      const firstCell = String(row[0] || '').trim();
      if (firstCell === '班级' || firstCell === 'Class') {
        headerIndices.push(index);
      }
    });

    // Fallback: If no "班级" header found but data exists, treat as single sheet starting at 0
    if (headerIndices.length === 0 && rows.length > 0) {
        headerIndices.push(0);
    }

    // Split into sub-sheets based on detected headers
    headerIndices.forEach((startIndex, i) => {
      // Determine end index (start of next table or end of file)
      const endIndex = headerIndices[i + 1] || rows.length;
      
      const sheetHeaderRow = rows[startIndex];
      // Extract data rows (skip header)
      const sheetRows = rows.slice(startIndex + 1, endIndex).filter((r: any[]) => {
          // Basic filtering: skip completely empty rows
          if (!r || r.length === 0) return false;
          // Ensure first cell isn't null/undefined if that's critical
          return true;
      });

      const sheetColumns = sheetHeaderRow.map((c: any) => String(c || '').trim());

      // Determine a smart name for this sub-sheet based on unique columns
      let sheetName = `历次-${i + 1}`;
      
      if (sheetColumns.some((c: string) => c.includes('12月总分') || c.includes('期中总分'))) sheetName = '历次-总分概览';
      else if (sheetColumns.some((c: string) => c.includes('12月语数英') || c.includes('语文'))) sheetName = '历次-语数英';
      else if (sheetColumns.some((c: string) => c.includes('12月物理') || c.includes('物理'))) sheetName = '历次-理化生';
      else if (sheetColumns.some((c: string) => c.includes('12月政治') || c.includes('政治'))) sheetName = '历次-政史地';

      // Ensure unique names in dataset
      let uniqueName = sheetName;
      let counter = 2;
      while (newSheetNames.includes(uniqueName) || newSheets[uniqueName]) {
          uniqueName = `${sheetName}-${counter}`;
          counter++;
      }
      sheetName = uniqueName;

      // Clean up rows: 
      // 1. Convert empty strings to null
      // 2. Round long decimals to 1 place for readability (e.g., 886.1888 -> 886.2)
      // 3. Preserve strings (Teacher names)
      const cleanedRows = sheetRows.map((row: any[]) => {
        return row.map((cell: any) => {
          if (cell === "" || cell === undefined) return null;
          
          // Check if it looks like a number
          const num = Number(cell);
          if (!isNaN(num) && cell !== '' && typeof cell !== 'boolean') {
             // If it has a decimal part, round it. 
             if (String(cell).includes('.')) {
                 // Convert to number with fixed precision (1 decimal is usually enough for overview)
                 return Number(num.toFixed(1)); 
             }
             return num;
          }

          if (typeof cell === 'string') {
             const trimmed = cell.trim();
             return trimmed === "" ? null : trimmed;
          }
          return cell;
        });
      });

      newSheets[sheetName] = {
        columns: sheetColumns,
        rows: cleanedRows
      };
      newSheetNames.push(sheetName);
    });
  }

  return {
    sheetNames: newSheetNames,
    sheets: newSheets
  };
};