export interface Sheet {
  columns: string[];
  rows: (string | number | null)[][];
}

export interface AppData {
  sheetNames: string[];
  sheets: {
    [key: string]: Sheet;
  };
}
