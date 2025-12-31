import React from 'react';

interface SheetSelectorProps {
  sheets: string[];
  activeSheet: string;
  onSelect: (sheet: string) => void;
}

const SheetSelector: React.FC<SheetSelectorProps> = ({ sheets, activeSheet, onSelect }) => {
  return (
    <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10 scrollbar-hide">
      {sheets.map((sheet) => (
        <button
          key={sheet}
          onClick={() => onSelect(sheet)}
          className={`
            px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors duration-200
            ${
              activeSheet === sheet
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
            }
          `}
        >
          {sheet}
        </button>
      ))}
    </div>
  );
};

export default SheetSelector;
