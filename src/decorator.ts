import * as vscode from 'vscode';
import { TagConfig, ParsedComment } from './types';
import { getTagConfigs, parseDocument } from './parser';

type DecorationMap = Map<string, vscode.TextEditorDecorationType>;

let decorationTypes: DecorationMap = new Map();

function disposeAll() {
  decorationTypes.forEach(d => d.dispose());
  decorationTypes.clear();
}

function buildDecorations(tags: TagConfig[]): DecorationMap {
  const map: DecorationMap = new Map();
  const config = vscode.workspace.getConfiguration('commentsPlusPlus');
  const showBg = config.get<boolean>('showBackground', true);
  const showIcons = config.get<boolean>('showInlineIcons', true);

  for (const tag of tags) {
    const decorationOptions: vscode.DecorationRenderOptions = {
      color: tag.color,
      backgroundColor: showBg ? (tag.backgroundColor ?? undefined) : undefined,
      fontStyle: tag.italic ? 'italic' : 'normal',
      fontWeight: tag.bold ? 'bold' : 'normal',
      textDecoration: tag.strikethrough ? 'line-through' : undefined,
      borderRadius: showBg ? '3px' : undefined,
    };

    if (showIcons && tag.icon) {
      decorationOptions.before = {
        contentText: tag.icon + ' ',
        color: tag.color,
      };
    }

    map.set(tag.tag.toUpperCase(), vscode.window.createTextEditorDecorationType(decorationOptions));
  }
  return map;
}

export function applyDecorations(editor: vscode.TextEditor) {
  const tags = getTagConfigs();
  const config = vscode.workspace.getConfiguration('commentsPlusPlus');
  const highlightScope = config.get<'comment' | 'line'>('highlightScope', 'comment');

  // Rebuild decoration types if needed
  if (decorationTypes.size === 0) {
    decorationTypes = buildDecorations(tags);
  }

  const comments = parseDocument(editor.document, tags);

  // Group ranges by tag
  const rangesByTag = new Map<string, vscode.Range[]>();
  for (const c of comments) {
    const ranges = rangesByTag.get(c.tag) ?? [];
    
    const line = editor.document.lineAt(c.lineNumber);
    const range = highlightScope === 'line' 
      ? line.range 
      : new vscode.Range(
          new vscode.Position(c.lineNumber, c.commentStartIndex),
          new vscode.Position(c.lineNumber, line.text.length)
        );
    
    ranges.push(range);
    rangesByTag.set(c.tag, ranges);
  }

  // Apply decorations per tag
  decorationTypes.forEach((decoration, tagKey) => {
    editor.setDecorations(decoration, rangesByTag.get(tagKey) ?? []);
  });
}

export function resetDecorations() {
  disposeAll();
}

export function applyDecorationsToAllEditors() {
  vscode.window.visibleTextEditors.forEach(applyDecorations);
}
