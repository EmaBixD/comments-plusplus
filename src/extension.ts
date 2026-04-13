import * as vscode from 'vscode';
import { applyDecorations, applyDecorationsToAllEditors, resetDecorations } from './decorator';
import { CommentTreeProvider } from './treeProvider';
import { runExport } from './exporter';
import { getTagConfigs } from './parser';
import { ParsedComment, FileFilter, SortOrder } from './types';

export function activate(context: vscode.ExtensionContext) {
  console.log('Comments++ is active');

  // ─── Tree View ─────────────────────────────────────────────────────────────
  const treeProvider = new CommentTreeProvider();
  const config = vscode.workspace.getConfiguration('commentsPlusPlus');
  const defaultFilter = config.get<FileFilter>('sidebar.defaultFilter', 'entireWorkspace');
  if (defaultFilter === 'entireWorkspace') {
    treeProvider.refreshWorkspaceComments(); // Loads workspace files initially
  }
  const treeView = vscode.window.createTreeView('commentsPlusPlusTree', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  // ─── Apply decorations on start ────────────────────────────────────────────
  applyDecorationsToAllEditors();

  // ─── Event listeners ───────────────────────────────────────────────────────

  // Re-decorate when switching editors
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) applyDecorations(editor);
      treeProvider.refresh();
    })
  );

  // Re-decorate on document change (debounced)
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const editor = vscode.window.visibleTextEditors.find(
          e => e.document === event.document
        );
        if (editor) applyDecorations(editor);
        treeProvider.refresh();
      }, 300);
    })
  );

  // Re-apply when config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('commentsPlusPlus')) {
        resetDecorations();
        applyDecorationsToAllEditors();
        treeProvider.refresh();
      }
    })
  );

  // Refresh tree when files open/close
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(() => treeProvider.refresh()),
    vscode.workspace.onDidCloseTextDocument(() => treeProvider.refresh())
  );

  // ─── Commands ──────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('commentsPlusPlus.goToComment', async (comment: ParsedComment) => {
      const uri = vscode.Uri.file(comment.filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);
      const line = doc.lineAt(comment.lineNumber);
      editor.selection = new vscode.Selection(line.range.start, line.range.end);
      editor.revealRange(line.range, vscode.TextEditorRevealType.InCenter);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commentsPlusPlus.filterByType', async () => {
      const tags = getTagConfigs();
      const picks = [
        { label: '$(clear-all) Clear all type filters', value: undefined },
        ...tags.map(t => {
          const tagUpper = t.tag.toUpperCase();
          const isActive = treeProvider.typeFilter.has(tagUpper);
          return {
            label: `${t.icon ?? ''} ${t.tag} ${isActive ? '(ON)' : '(OFF)'}`,
            value: tagUpper,
          };
        }),
      ];
      const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: 'Toggle comment type filters (Select multiple one-by-one, or clear all)',
      });
      if (selected !== undefined) {
        if (selected.value === undefined) {
          treeProvider.clearTypeFilter();
        } else {
          treeProvider.toggleTypeFilter(selected.value);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commentsPlusPlus.filterByFile', async () => {
      const picks: { label: string; value: FileFilter }[] = [
        { label: '$(files) All open files', value: 'openFiles' },
        { label: '$(file) Current file only', value: 'currentFile' },
        { label: '$(folder) Entire workspace', value: 'entireWorkspace' },
      ];
      const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: 'Filter by file scope',
      });
      if (selected) {
        if (selected.value === 'entireWorkspace') {
          await treeProvider.refreshWorkspaceComments();
        }
        treeProvider.setFileFilter(selected.value);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commentsPlusPlus.clearFilters', async () => {
      treeProvider.clearTypeFilter();
      const config = vscode.workspace.getConfiguration('commentsPlusPlus');
      const defaultFileFilter = config.get<FileFilter>('sidebar.defaultFilter', 'entireWorkspace');
      if (defaultFileFilter === 'entireWorkspace') {
        await treeProvider.refreshWorkspaceComments();
      }
      treeProvider.setFileFilter(defaultFileFilter);
      treeProvider.setSearchQuery(undefined);
      treeProvider.clearAuthorFilter();
      treeProvider.setStartDateFilter(undefined);
      treeProvider.setEndDateFilter(undefined);
      treeProvider.imageFilter = false;
      vscode.window.showInformationMessage('Comments++: Filters cleared');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commentsPlusPlus.exportMarkdown', () =>
      runExport('markdown', treeProvider.getFilteredComments())
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commentsPlusPlus.exportJson', () =>
      runExport('json', treeProvider.getFilteredComments())
    )
  );

  // Author filter command
  context.subscriptions.push(
    vscode.commands.registerCommand('commentsPlusPlus.filterByAuthor', async () => {
      const tags = getTagConfigs();
      const allComments = vscode.workspace.textDocuments
        .filter(doc => doc.uri.scheme === 'file')
        .flatMap(doc => {
          const { parseDocument } = require('./parser');
          return parseDocument(doc, tags);
        });
      
      const allValidAuthors = allComments
        .flatMap(c => c.authors || [])
        .filter(Boolean);

      const authors = [...new Set(allValidAuthors)].sort() as string[];

      const picks = [
        { label: '$(clear-all) Clear all author filters', value: undefined },
        ...authors.map(a => {
          const isActive = treeProvider.authorFilter.has(a);
          return {
            label: `@${a} ${isActive ? '(ON)' : '(OFF)'}`,
            value: a,
          };
        }),
      ];

      const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: 'Toggle author filters (Select multiple one-by-one, or clear all)',
      });
      if (selected !== undefined) {
        if (selected.value === undefined) {
          treeProvider.clearAuthorFilter();
        } else {
          treeProvider.toggleAuthorFilter(selected.value);
        }
      }
    })
  );

  // Date Range filter command
  context.subscriptions.push(
    vscode.commands.registerCommand('commentsPlusPlus.filterByDateRange', async () => {
      const exampleDate = '2026-04-13';
      
      const startInput = await vscode.window.showInputBox({
        prompt: `1/2: Show comments due ON or AFTER this date (YYYY-MM-DD)`,
        placeHolder: `e.g. ${exampleDate} (leave empty to skip/avoid start date limit)`,
      });
      if (startInput === undefined) return; // User cancelled

      const endInput = await vscode.window.showInputBox({
        prompt: `2/2: Show comments due ON or BEFORE this date (YYYY-MM-DD)`,
        placeHolder: `e.g. ${exampleDate} (leave empty to skip/avoid end date limit)`,
      });
      if (endInput === undefined) return; // User cancelled

      let startDate: Date | undefined = undefined;
      let endDate: Date | undefined = undefined;

      if (startInput.trim() !== '') {
        const d = parseDateInput(startInput.trim());
        if (!d || isNaN(d.getTime())) {
          vscode.window.showErrorMessage(`Invalid start date format. Please use YYYY-MM-DD.`);
          return;
        }
        startDate = d;
      }

      if (endInput.trim() !== '') {
        const d = parseDateInput(endInput.trim());
        if (!d || isNaN(d.getTime())) {
          vscode.window.showErrorMessage(`Invalid end date format. Please use YYYY-MM-DD.`);
          return;
        }
        endDate = d;
      }

      if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
        vscode.window.showErrorMessage('Start date cannot be after end date.');
        return;
      }

      treeProvider.setStartDateFilter(startDate);
      treeProvider.setEndDateFilter(endDate);
    })
  );

function parseDateInput(input: string): Date | null {
  const parts = input.split('-');
  if (parts.length !== 3) return null;
  
  const [yyyy, mm, dd] = parts;
  
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
}

  // Unified filter command (accessible via command palette)
  context.subscriptions.push(
    vscode.commands.registerCommand('commentsPlusPlus.filterBy', async () => {
      const picks: {
        label: string;
        description: string;
        command:
          | 'commentsPlusPlus.filterByType'
          | 'commentsPlusPlus.filterByFile'
          | 'commentsPlusPlus.filterByAuthor'
          | 'commentsPlusPlus.filterByDateRange'
          | 'commentsPlusPlus.filterByImage'
          | 'commentsPlusPlus.clearFilters';
      }[] = [
        {
          label: '$(symbol-enum) Type',
          description: 'Filter by tag (TODO, FIXME, NOTE...)',
          command: 'commentsPlusPlus.filterByType',
        },
        {
          label: '$(file) File scope',
          description: 'Open files, current file, or entire workspace',
          command: 'commentsPlusPlus.filterByFile',
        },
        {
          label: '$(person) Author',
          description: 'Filter by author (@name)',
          command: 'commentsPlusPlus.filterByAuthor',
        },
        {
          label: '$(calendar) Date Range',
          description: 'Show comments within a specific date range',
          command: 'commentsPlusPlus.filterByDateRange',
        },
        {
          label: '$(device-camera) Images',
          description: `Filter by comments with images ${treeProvider.imageFilter ? '(ON)' : '(OFF)'}`,
          command: 'commentsPlusPlus.filterByImage',
        },
        {
          label: '$(clear-all) Clear filters',
          description: 'Reset all active filters',
          command: 'commentsPlusPlus.clearFilters',
        },
      ];

      const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: 'Choose a filter to apply',
      });

      if (selected) {
        await vscode.commands.executeCommand(selected.command);
      }
    })
  );

  // Sort order command (accessible via command palette)
  context.subscriptions.push(
    vscode.commands.registerCommand('commentsPlusPlus.sortBy', async () => {
      const picks: { label: string; description?: string; value: SortOrder | 'toggleDirection' }[] = [
        { label: '$(flame) Priority', description: 'Sort by priority configured in settings (default)', value: 'priority' },
        { label: '$(list-ordered) Line number', description: 'Sort by line number in file', value: 'line' },
        { label: '$(calendar) Due Date', description: 'Sort chronologically by date in bracket', value: 'dueDate' },
        { 
          label: `$(arrow-swap) Invert Results: ${treeProvider.sortDirection === 'asc' ? 'Off (Ascending)' : 'On (Descending)'}`,
          description: 'Change order from top-to-bottom to bottom-to-top',
          value: 'toggleDirection'
        }
      ];
      const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: 'Sort comments by',
      });
      if (selected) {
        if (selected.value === 'toggleDirection') {
          treeProvider.toggleSortDirection();
          vscode.window.showInformationMessage(`Comments++: Sort direction set to ${treeProvider.sortDirection === 'asc' ? 'Ascending' : 'Descending'}`);
        } else {
          treeProvider.setSortOrder(selected.value);
          vscode.window.showInformationMessage(`Comments++: Sorted by ${selected.label.split(') ')[1]}`);
        }
      }
    })
  );

  // Image filter command
  context.subscriptions.push(
    vscode.commands.registerCommand('commentsPlusPlus.filterByImage', () => {
      treeProvider.toggleImageFilter();
    })
  );

  // Register hover provider for images
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('*', {
      provideHover(document, position, token) {
        const config = vscode.workspace.getConfiguration('commentsPlusPlus');
        if (!config.get<boolean>('showImageHovers', true)) {
          return null;
        }

        const { parseDocument } = require('./parser');
        const tags = getTagConfigs();
        const comments = parseDocument(document, tags);
        
        for (const comment of comments) {
          if (comment.imagePaths && comment.imagePaths.length > 0 && comment.lineNumber === position.line) {
            const md = new vscode.MarkdownString();
            md.supportHtml = true;
            
            const scale = config.get<number>('imageScale', 1);
            const dim = Math.round(200 * scale);
            let htmlStr = '';

            for (const imagePath of comment.imagePaths) {
              let imgSrc = '';
              // Check if it's a URL
              if (/^https?:\/\//i.test(imagePath)) {
                imgSrc = imagePath;
              } else {
                const uri = vscode.Uri.file(comment.filePath);
                const dir = vscode.Uri.joinPath(uri, '..');
                
                // Resolve relative paths if needed
                let imgUri = vscode.Uri.file(imagePath);
                if (!imagePath.startsWith('/') && !imagePath.match(/^[a-zA-Z]:\\/)) {
                  imgUri = vscode.Uri.joinPath(dir, imagePath);
                }
                imgSrc = imgUri.toString();
              }
              // Metodo più semplice: carichiamo a dimensione nativa con l'uso stringente
              // della larghezza fissa. Accettiamo il comportamento di wrap naturale di VS Code.
              htmlStr += `<img src="${imgSrc}" width="${dim}" />\n`;
            }
            
            md.appendMarkdown(htmlStr.trimEnd());
            return new vscode.Hover(md);
          }
        }
        return null;
      }
    })
  );

  context.subscriptions.push(treeView);
}

export function deactivate() {
  resetDecorations();
}
