import * as vscode from 'vscode';
import * as path from 'path';
import { ParsedComment, FileFilter, SortOrder } from '../models/types';
import { getTagConfigs, parseDocument, parseAllOpenDocuments, parseAllWorkspaceFiles, formatDisplayDate } from '../core/parser';

// ─── Tree Items ───────────────────────────────────────────────────────────────

export class FileItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly comments: ParsedComment[]
  ) {
    super(path.basename(filePath), vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${comments.length} comment${comments.length !== 1 ? 's' : ''}`;
    this.iconPath = new vscode.ThemeIcon('file-code');
    this.tooltip = filePath;
    this.contextValue = 'fileItem';
  }
}

export class CommentItem extends vscode.TreeItem {
  constructor(public readonly comment: ParsedComment) {
    const label = `${comment.config.icon ?? ''} ${comment.tag}: ${comment.text}`.trim();
    super(label, vscode.TreeItemCollapsibleState.None);

    const displayDate = comment.dueDates ? comment.dueDates.join(', ') : '';
    this.description = `Line ${comment.lineNumber + 1}${comment.authors && comment.authors.length ? ` @${comment.authors.join(' @')}` : ''}${displayDate ? ` 📅${displayDate}` : ''}`;
    this.tooltip = comment.fullLine;
    this.iconPath = new vscode.ThemeIcon(this.getIcon(comment.imminence));

    this.command = {
      command: 'commentsPlusPlus.goToComment',
      title: 'Go to Comment',
      arguments: [comment],
    };

    this.contextValue = 'commentItem';
  }

  private getIcon(imminence: number): string {
    switch (imminence) {
      case 4: return 'error';
      case 3: return 'warning';
      case 2: return 'info';
      case 1: return 'circle-outline';
      default: return 'comment';
    }
  }
}

// ─── Tree Data Provider ───────────────────────────────────────────────────────

export class CommentTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private fileFilter: FileFilter = 'openFiles';
  private sortOrder: SortOrder = 'priority';
  public sortDirection: 'asc' | 'desc' = 'asc';
  public typeFilter: Set<string> = new Set();
  private searchQuery: string | undefined = undefined;
  public authorFilter: Set<string> = new Set();
  public imageFilter: boolean = false;
  private startDateFilter: Date | undefined = undefined;
  private endDateFilter: Date | undefined = undefined;
  private workspaceComments: ParsedComment[] = [];

  constructor() {
    const config = vscode.workspace.getConfiguration('commentsPlusPlus');
    this.fileFilter = config.get<FileFilter>('sidebar.defaultFilter', 'entireWorkspace');
    this.sortOrder = 'priority';
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  setFileFilter(filter: FileFilter) {
    this.fileFilter = filter;
    this.refresh();
  }

  toggleTypeFilter(type: string) {
    if (this.typeFilter.has(type)) {
      this.typeFilter.delete(type);
    } else {
      this.typeFilter.add(type);
    }
    this.refresh();
  }

  clearTypeFilter() {
    this.typeFilter.clear();
    this.refresh();
  }

  setSortOrder(sort: SortOrder) {
    this.sortOrder = sort;
    this.refresh();
  }

  toggleSortDirection() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.refresh();
  }

  setSearchQuery(query: string | undefined) {
    this.searchQuery = query;
    this.refresh();
  }

  toggleImageFilter() {
    this.imageFilter = !this.imageFilter;
    this.refresh();
  }

  toggleAuthorFilter(author: string) {
    if (this.authorFilter.has(author)) {
      this.authorFilter.delete(author);
    } else {
      this.authorFilter.add(author);
    }
    this.refresh();
  }

  clearAuthorFilter() {
    this.authorFilter.clear();
    this.refresh();
  }

  setStartDateFilter(date: Date | undefined) {
    this.startDateFilter = date;
    this.refresh();
  }

  setEndDateFilter(date: Date | undefined) {
    this.endDateFilter = date;
    this.refresh();
  }

  hasActiveFilters(): boolean {
    return (
      this.typeFilter.size > 0 ||
      this.authorFilter.size > 0 ||
      this.searchQuery !== undefined ||
      this.startDateFilter !== undefined ||
      this.endDateFilter !== undefined ||
      this.fileFilter !== vscode.workspace.getConfiguration('commentsPlusPlus').get<FileFilter>('sidebar.defaultFilter', 'entireWorkspace')
    );
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (element instanceof FileItem) {
      return element.comments.map(c => new CommentItem(c));
    }
    return this.buildRootItems();
  }

  getFilteredComments(): ParsedComment[] {
    const tags = getTagConfigs();
    let comments = this.gatherComments(tags);

    // Filter by type
    if (this.typeFilter.size > 0) {
      comments = comments.filter(c => this.typeFilter.has(c.tag));
    }

    // Filter by author
    if (this.authorFilter.size > 0) {
      comments = comments.filter(c => c.authors && c.authors.some(a => this.authorFilter.has(a.toLowerCase())));
    }
    
    // Filter by date range
    if (this.startDateFilter || this.endDateFilter) {
      comments = comments.filter(c => {
        if (!c.dueDates || c.dueDates.length === 0) return false;
        
        // Return true if AT LEAST ONE date fits the range
        return c.dueDates.some(dueDate => {
            const d = new Date(dueDate).getTime();
            const startOk = this.startDateFilter ? d >= this.startDateFilter.getTime() : true;
            const endOk = this.endDateFilter ? d <= this.endDateFilter.getTime() : true;
            return startOk && endOk;
        });
      });
    }

    // Filter by image
    if (this.imageFilter) {
      comments = comments.filter(c => c.imagePaths && c.imagePaths.length > 0);
    }

    // Filter by search
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      comments = comments.filter(
        c => c.text.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q)
      );
    }

    return comments;
  }

  private buildRootItems(): vscode.TreeItem[] {
    let comments = this.getFilteredComments();

    // Group by file first
    const byFile = new Map<string, ParsedComment[]>();
    for (const c of comments) {
      const arr = byFile.get(c.filePath) ?? [];
      arr.push(c);
      byFile.set(c.filePath, arr);
    }

    if (byFile.size === 0) {
      const empty = new vscode.TreeItem('No comments found');
      empty.iconPath = new vscode.ThemeIcon('info');
      return [empty];
    }

    // Sort files alphabetically, and sort comments inside each file by sortOrder
    return Array.from(byFile.entries())
      .sort(([fpA], [fpB]) => fpA.localeCompare(fpB))
      .map(([fp, cs]) => new FileItem(fp, this.sortComments(cs)));
  }

  private gatherComments(tags: ReturnType<typeof getTagConfigs>): ParsedComment[] {
    if (this.fileFilter === 'currentFile') {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return [];
      return parseDocument(editor.document, tags);
    }

    if (this.fileFilter === 'openFiles') {
      return parseAllOpenDocuments(tags);
    }

    // 'entireWorkspace' — use cached workspace comments, but update the cache with live open documents
    const openComments = parseAllOpenDocuments(tags);
    const openFiles = new Set(openComments.map(c => c.filePath));
    const cachedOthers = this.workspaceComments.filter(c => !openFiles.has(c.filePath));
    return [...cachedOthers, ...openComments];
  }

  async refreshWorkspaceComments() {
    const tags = getTagConfigs();
    this.workspaceComments = await parseAllWorkspaceFiles(tags);
    this.refresh();
  }

  private sortComments(comments: ParsedComment[]): ParsedComment[] {
    const sorted = [...comments].sort((a, b) => {
      switch (this.sortOrder) {
        case 'priority': return b.sortingScore - a.sortingScore;
        case 'line': return a.lineNumber - b.lineNumber;
        case 'dueDate': {
          if ((!a.dueDates || a.dueDates.length === 0) && (!b.dueDates || b.dueDates.length === 0)) return 0;
          if (!a.dueDates || a.dueDates.length === 0) return 1;
          if (!b.dueDates || b.dueDates.length === 0) return -1;
          
          // Get the earliest (most critical) date from each comment
          const minA = Math.min(...a.dueDates.map(d => new Date(d).getTime()));
          const minB = Math.min(...b.dueDates.map(d => new Date(d).getTime()));
          return minA - minB;
        }
        default: return 0;
      }
    });

    return this.sortDirection === 'desc' ? sorted.reverse() : sorted;
  }
}
