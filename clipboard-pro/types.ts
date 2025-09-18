
export type ClipboardItemType = 'text' | 'url' | 'code';

export type FilterType = 'all' | ClipboardItemType;

export interface ClipboardItem {
  id: string;
  content: string;
  type: ClipboardItemType;
  timestamp: number;
  frequency: number;
}
