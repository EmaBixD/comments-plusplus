import * as vscode from 'vscode';
import { ParsedComment } from '../models/types';
import { getTagConfigs, parseAllOpenDocuments, formatDisplayDate } from '../core/parser';

function priorityLabel(p: number): string {
  return { 4: 'CRITICAL', 3: 'HIGH', 2: 'MEDIUM', 1: 'LOW', 0: 'NONE' }[p] ?? 'NONE';
}

export function exportMarkdown(comments: ParsedComment[]): string {
  const byFile = new Map<string, ParsedComment[]>();
  for (const c of comments) {
    const arr = byFile.get(c.filePath) ?? [];
    arr.push(c);
    byFile.set(c.filePath, arr);
  }

  let md = `# Comments++ Export\n\n_Generated: ${new Date().toLocaleString()}_\n\n`;
  byFile.forEach((cs, fp) => {
    md += `## 📄 ${fp.split(/[\\/]/).pop() || fp}\n\n`;
    for (const c of cs) {
      const icon = c.config.icon ?? '';
      const priority = priorityLabel(c.imminence);
      const author = c.authors && c.authors.length ? ` • @${c.authors.join(' @')}` : '';
      const displayDate = c.dueDates ? c.dueDates.join(', ') : '';
      const due = displayDate ? ` • 📅 ${displayDate}` : '';
      md += `- ${icon} **${c.tag}** \`L${c.lineNumber + 1}\` [${priority}]${author}${due}\n`;
      md += `  > ${c.text}\n\n`;
    }
  });
  return md;
}

export function exportJson(comments: ParsedComment[]): string {
  return JSON.stringify(
    comments.map(c => ({
      tag: c.tag,
      text: c.text,
      file: c.filePath,
      line: c.lineNumber + 1,
      priority: priorityLabel(c.imminence),
      authors: c.authors,
      dueDates: c.dueDates,
    })),
    null,
    2
  );
}

export async function runExport(format: 'markdown' | 'json', comments: ParsedComment[]) {
  if (comments.length === 0) {
    vscode.window.showInformationMessage('Comments++: No comments found to export.');
    return;
  }

  const content = format === 'markdown' ? exportMarkdown(comments) : exportJson(comments);
  const ext = format === 'markdown' ? 'md' : 'json';

  const uri = await vscode.window.showSaveDialog({
    filters: { [format === 'markdown' ? 'Markdown' : 'JSON']: [ext] },
    defaultUri: vscode.Uri.file(`comments-export.${ext}`)
  });

  if (!uri) return;

  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
  vscode.window.showInformationMessage(`Comments++ exported to ${uri.path.split(/[\\/]/).pop() || uri.path}`);
}
