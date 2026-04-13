export interface TagConfig {
  tag: string;
  color: string;
  backgroundColor?: string;
  icon?: string;
  priority?: number; // 0 = CRITICAL, 1 = HIGH, 2 = MEDIUM, 3 = LOW
  strikethrough?: boolean;
  bold?: boolean;
  italic?: boolean;
}

export interface ParsedComment {
  tag: string;
  text: string;
  fullLine: string;
  lineNumber: number; // 0-based
  filePath: string;
  commentStartIndex: number; // The exact starting column of the comment
  categoryPriority: number; // From TagConfig
  imminence: number; // 0 = CRITICAL, 1 = HIGH, 2 = MEDIUM, 3 = LOW
  sortingScore: number; // categoryPriority + imminence
  authors?: string[];   // @name
  dueDates?: string[];  // [YYYY-MM-DD]
  imagePaths?: string[]; // array of image paths
  config: TagConfig;
}

export type FileFilter = 'entireWorkspace' | 'openFiles' | 'currentFile';
export type SortOrder = 'priority' | 'line' | 'dueDate';