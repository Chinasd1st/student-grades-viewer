import { Sheet } from '../types';

export const exportToCSV = (filename: string, columns: string[], rows: (string | number | null)[][]) => {
  // Construct CSV Content
  const csvContent = [
    columns.join(','), // Header
    ...rows.map(row => 
      row.map(cell => {
        if (cell === null || cell === undefined) return '';
        const str = String(cell);
        // Escape quotes and wrap in quotes if contains comma
        if (str.includes(',') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    )
  ].join('\n');

  // Create Blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};