
import { ClipboardItemType } from '../types';

export const categorizeContent = (content: string): ClipboardItemType => {
  const trimmedContent = content.trim();

  // URL check
  const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
  if (urlRegex.test(trimmedContent)) {
    return 'url';
  }

  // Code check (simple heuristics)
  const codeKeywords = ['function', 'const', 'let', 'var', 'import', 'export', '=>', 'class', 'public', 'private'];
  const codeSymbols = /[{};[\]()<>]/;

  const wordCount = trimmedContent.split(/\s+/).length;
  if (wordCount < 50 && (codeSymbols.test(trimmedContent) || codeKeywords.some(kw => trimmedContent.includes(kw)))) {
    return 'code';
  }

  return 'text';
};
