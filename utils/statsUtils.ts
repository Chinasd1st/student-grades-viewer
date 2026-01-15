import { Sheet } from '../types';

export interface NumericColumn {
  name: string;
  index: number;
  values: number[];
  average: number;
  max: number;
  min: number;
}

// Check if a column name suggests it is a rank or ID column to exclude from correlation
const isExcludedColumn = (name: string): boolean => {
  const lower = name.toLowerCase();
  return (
    lower.includes('号') || 
    lower.includes('id') || 
    lower.includes('次') || // Rank (校次, 班次)
    lower.includes('rank') ||
    lower.includes('班级') || // Class name
    lower.includes('姓名') ||
    lower.includes('name')
  );
};

export const getNumericColumns = (sheet: Sheet): NumericColumn[] => {
  const numericCols: NumericColumn[] = [];

  sheet.columns.forEach((colName, idx) => {
    // Basic heuristic to skip non-score columns for the main stats
    if (isExcludedColumn(colName)) return;

    const values: number[] = [];
    let validCount = 0;

    sheet.rows.forEach(row => {
      const val = row[idx];
      if (typeof val === 'number') {
        values.push(val);
        validCount++;
      } else if (typeof val === 'string' && !isNaN(parseFloat(val))) {
        values.push(parseFloat(val));
        validCount++;
      }
    });

    // If more than 50% of the rows have valid numbers, consider it a numeric column
    if (validCount > sheet.rows.length * 0.5 && values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0);
      numericCols.push({
        name: colName,
        index: idx,
        values,
        average: sum / values.length,
        max: Math.max(...values),
        min: Math.min(...values)
      });
    }
  });

  return numericCols;
};

// Helper to guess full mark (Used only for pass stats now mostly)
export const getFullMark = (colName: string): number => {
    if (/总分|Total/.test(colName)) return 0;
    if (/语数英/.test(colName)) return 450;
    if (/语文|数学|英语|English|Chinese|Math/.test(colName)) return 150;
    return 100;
};

/**
 * Calculates the rank of a score within a dataset.
 * Higher score = Rank 1.
 * Returns { rank, total, percentile }
 * Percentile is 0.0 to 1.0 (1.0 means top rank, 0.0 means bottom)
 */
export const getScoreRankStats = (score: number, sortedValues: number[]) => {
    if (sortedValues.length === 0) return { rank: 0, total: 0, percentile: 0 };
    
    // Find first index where value <= score (since sorted descending)
    // Actually simpler: standard rank is 1 + index in descending list
    // Handling ties: The student gets the best rank (e.g. if 3 people tied for 1st, they are all 1st)
    let rank = 1;
    for (let i = 0; i < sortedValues.length; i++) {
        if (score >= sortedValues[i]) {
            rank = i + 1;
            break;
        }
        // Fallback for lowest
        if (i === sortedValues.length - 1) rank = sortedValues.length;
    }

    // Percentile Calculation:
    // Top 1 (Rank 1) should be close to 100%. Last place should be close to 0%.
    // Formula: (Total - Rank) / (Total - 1). If Total=1, return 1.
    const total = sortedValues.length;
    const percentile = total > 1 ? (total - rank) / (total - 1) : 1;

    return { rank, total, percentile };
};

/**
 * Get Grade Attributes based on RELATIVE RANKING (Percentile)
 * percentile: 0.0 to 1.0 (1.0 is best)
 */
export const getGradeFromPercentile = (percentile: number) => {
  // A+: Top 5%
  if (percentile >= 0.95) return { label: 'A+', color: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200' };
  // A: Top 15% (Next 10%)
  if (percentile >= 0.85) return { label: 'A',  color: 'text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300 border-green-200' };
  // A-: Top 30% (Next 15%)
  if (percentile >= 0.70) return { label: 'A-', color: 'text-lime-700 bg-lime-100 dark:bg-lime-900/40 dark:text-lime-300 border-lime-200' };
  // B+: Top 50% (Next 20%)
  if (percentile >= 0.50) return { label: 'B+', color: 'text-blue-700 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200' };
  // B: Top 70% (Next 20%)
  if (percentile >= 0.30) return { label: 'B',  color: 'text-sky-700 bg-sky-100 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200' };
  // B-: Top 85% (Next 15%)
  if (percentile >= 0.15) return { label: 'B-', color: 'text-cyan-700 bg-cyan-100 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200' };
  // C: Top 95% (Next 10%)
  if (percentile >= 0.05) return { label: 'C',  color: 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200' };
  // D: Bottom 5%
  return { label: 'D', color: 'text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300 border-red-200' };
};

// Deprecated wrapper for backward compatibility if needed, but we prefer getGradeFromPercentile now
export const getGradeAttributes = (score: number, fullMark: number) => {
    // Fallback: Estimate percentile linearly if we don't have the full set
    if (fullMark <= 0) return null;
    return getGradeFromPercentile(score / fullMark);
};

// Calculate Pass/Excellence Stats
export interface PassStats {
  excellent: number; // >= 85%
  pass: number;      // 60% - 84%
  fail: number;      // < 60%
  total: number;
}

export const calculatePassStats = (values: number[], colName: string): PassStats => {
  const fullMark = getFullMark(colName);
  const excellentThreshold = fullMark * 0.85;
  const passThreshold = fullMark * 0.6;

  let excellent = 0;
  let pass = 0;
  let fail = 0;

  values.forEach(v => {
    if (v >= excellentThreshold) excellent++;
    else if (v >= passThreshold) pass++;
    else fail++;
  });

  return { excellent, pass, fail, total: values.length };
};

// Calculate Score Distribution for Heatmap
export const calculateScoreBuckets = (values: number[], fullMark: number) => {
    const buckets = {
        '90%~': 0,
        '85%~90%': 0,
        '80%~85%': 0,
        '70%~80%': 0,
        '60%~70%': 0,
        '<60%': 0
    };

    values.forEach(v => {
        const ratio = v / fullMark;
        if (ratio >= 0.9) buckets['90%~']++;
        else if (ratio >= 0.85) buckets['85%~90%']++;
        else if (ratio >= 0.80) buckets['80%~85%']++;
        else if (ratio >= 0.70) buckets['70%~80%']++;
        else if (ratio >= 0.60) buckets['60%~70%']++;
        else buckets['<60%']++;
    });
    return buckets;
};

// Group Data By Class
export const getGroupedByClass = (sheet: Sheet, numericCols: NumericColumn[]) => {
    const classIdx = sheet.columns.findIndex(c => c.includes('班') || c.toLowerCase() === 'class');
    if (classIdx === -1) return null;

    const classGroups: Record<string, { [key: string]: number[] }> = {};

    sheet.rows.forEach(row => {
        const cls = String(row[classIdx]);
        if (!classGroups[cls]) classGroups[cls] = {};
        
        numericCols.forEach(col => {
            const val = row[col.index];
            if (typeof val === 'number') {
                if (!classGroups[cls][col.name]) classGroups[cls][col.name] = [];
                classGroups[cls][col.name].push(val);
            }
        });
    });

    return classGroups;
};


// Calculate Pearson Correlation Coefficient
export const calculateCorrelation = (x: number[], y: number[]): number => {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
};

export const generateHistogramData = (values: number[], binCount = 10) => {
  if (values.length === 0) return [];
  
  const min = Math.floor(Math.min(...values));
  const max = Math.ceil(Math.max(...values));
  const range = max - min;
  const binSize = Math.max(range / binCount, 1); // Ensure at least size 1

  const bins = Array(binCount).fill(0).map((_, i) => ({
    range: `${Math.floor(min + i * binSize)}-${Math.floor(min + (i + 1) * binSize)}`,
    min: min + i * binSize,
    max: min + (i + 1) * binSize,
    count: 0
  }));

  values.forEach(v => {
    const binIndex = Math.min(
      Math.floor((v - min) / binSize),
      binCount - 1
    );
    if (binIndex >= 0) bins[binIndex].count++;
  });

  return bins;
};

// Linear Regression: y = mx + b
export const calculateLinearRegression = (x: number[], y: number[]) => {
  const n = Math.min(x.length, y.length);
  if (n < 2) return null;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R-Squared calculation
  const yMean = sumY / n;
  let totalSS = 0;
  let resSS = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * x[i] + intercept;
    totalSS += (y[i] - yMean) ** 2;
    resSS += (y[i] - predicted) ** 2;
  }
  const rSquared = 1 - (resSS / totalSS);

  return { slope, intercept, rSquared };
};

// Calculate Box Plot Quartiles
export interface BoxPlotStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: number[];
}

export const calculateBoxPlotStats = (values: number[]): BoxPlotStats => {
  const sorted = [...values].sort((a, b) => a - b);
  const q1Pos = Math.floor(sorted.length * 0.25);
  const medianPos = Math.floor(sorted.length * 0.5);
  const q3Pos = Math.floor(sorted.length * 0.75);

  const q1 = sorted[q1Pos];
  const median = sorted[medianPos];
  const q3 = sorted[q3Pos];
  
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const validValues = sorted.filter(v => v >= lowerBound && v <= upperBound);
  const outliers = sorted.filter(v => v < lowerBound || v > upperBound);

  return {
    min: validValues[0] || q1, // Fallback if no valid values
    q1,
    median,
    q3,
    max: validValues[validValues.length - 1] || q3,
    outliers
  };
};

// Downsample large datasets for scatter plots to improve performance
export const downsampleData = (data: any[], limit: number = 500) => {
  if (data.length <= limit) return data;
  const step = Math.ceil(data.length / limit);
  return data.filter((_, index) => index % step === 0);
};