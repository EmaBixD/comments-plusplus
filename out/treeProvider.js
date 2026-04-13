"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentTreeProvider = exports.CommentItem = exports.FileItem = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const parser_1 = require("./parser");
// ─── Tree Items ───────────────────────────────────────────────────────────────
class FileItem extends vscode.TreeItem {
    constructor(filePath, comments) {
        super(path.basename(filePath), vscode.TreeItemCollapsibleState.Expanded);
        this.filePath = filePath;
        this.comments = comments;
        this.description = `${comments.length} comment${comments.length !== 1 ? 's' : ''}`;
        this.iconPath = new vscode.ThemeIcon('file-code');
        this.tooltip = filePath;
        this.contextValue = 'fileItem';
    }
}
exports.FileItem = FileItem;
class CommentItem extends vscode.TreeItem {
    constructor(comment) {
        const label = `${comment.config.icon ?? ''} ${comment.tag}: ${comment.text}`.trim();
        super(label, vscode.TreeItemCollapsibleState.None);
        this.comment = comment;
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
    getIcon(imminence) {
        switch (imminence) {
            case 4: return 'error';
            case 3: return 'warning';
            case 2: return 'info';
            case 1: return 'circle-outline';
            default: return 'comment';
        }
    }
}
exports.CommentItem = CommentItem;
// ─── Tree Data Provider ───────────────────────────────────────────────────────
class CommentTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.fileFilter = 'openFiles';
        this.sortOrder = 'priority';
        this.sortDirection = 'asc';
        this.typeFilter = new Set();
        this.searchQuery = undefined;
        this.authorFilter = new Set();
        this.imageFilter = false;
        this.startDateFilter = undefined;
        this.endDateFilter = undefined;
        this.workspaceComments = [];
        const config = vscode.workspace.getConfiguration('commentsPlusPlus');
        this.fileFilter = config.get('sidebar.defaultFilter', 'entireWorkspace');
        this.sortOrder = 'priority';
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    setFileFilter(filter) {
        this.fileFilter = filter;
        this.refresh();
    }
    toggleTypeFilter(type) {
        if (this.typeFilter.has(type)) {
            this.typeFilter.delete(type);
        }
        else {
            this.typeFilter.add(type);
        }
        this.refresh();
    }
    clearTypeFilter() {
        this.typeFilter.clear();
        this.refresh();
    }
    setSortOrder(sort) {
        this.sortOrder = sort;
        this.refresh();
    }
    toggleSortDirection() {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        this.refresh();
    }
    setSearchQuery(query) {
        this.searchQuery = query;
        this.refresh();
    }
    toggleImageFilter() {
        this.imageFilter = !this.imageFilter;
        this.refresh();
    }
    toggleAuthorFilter(author) {
        if (this.authorFilter.has(author)) {
            this.authorFilter.delete(author);
        }
        else {
            this.authorFilter.add(author);
        }
        this.refresh();
    }
    clearAuthorFilter() {
        this.authorFilter.clear();
        this.refresh();
    }
    setStartDateFilter(date) {
        this.startDateFilter = date;
        this.refresh();
    }
    setEndDateFilter(date) {
        this.endDateFilter = date;
        this.refresh();
    }
    hasActiveFilters() {
        return (this.typeFilter.size > 0 ||
            this.authorFilter.size > 0 ||
            this.searchQuery !== undefined ||
            this.startDateFilter !== undefined ||
            this.endDateFilter !== undefined ||
            this.fileFilter !== vscode.workspace.getConfiguration('commentsPlusPlus').get('sidebar.defaultFilter', 'entireWorkspace'));
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element instanceof FileItem) {
            return element.comments.map(c => new CommentItem(c));
        }
        return this.buildRootItems();
    }
    getFilteredComments() {
        const tags = (0, parser_1.getTagConfigs)();
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
                if (!c.dueDates || c.dueDates.length === 0)
                    return false;
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
            comments = comments.filter(c => c.text.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q));
        }
        return comments;
    }
    buildRootItems() {
        let comments = this.getFilteredComments();
        // Group by file first
        const byFile = new Map();
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
    gatherComments(tags) {
        if (this.fileFilter === 'currentFile') {
            const editor = vscode.window.activeTextEditor;
            if (!editor)
                return [];
            return (0, parser_1.parseDocument)(editor.document, tags);
        }
        if (this.fileFilter === 'openFiles') {
            return (0, parser_1.parseAllOpenDocuments)(tags);
        }
        // 'entireWorkspace' — use cached workspace comments, but update the cache with live open documents
        const openComments = (0, parser_1.parseAllOpenDocuments)(tags);
        const openFiles = new Set(openComments.map(c => c.filePath));
        const cachedOthers = this.workspaceComments.filter(c => !openFiles.has(c.filePath));
        return [...cachedOthers, ...openComments];
    }
    async refreshWorkspaceComments() {
        const tags = (0, parser_1.getTagConfigs)();
        this.workspaceComments = await (0, parser_1.parseAllWorkspaceFiles)(tags);
        this.refresh();
    }
    sortComments(comments) {
        const sorted = [...comments].sort((a, b) => {
            switch (this.sortOrder) {
                case 'priority': return b.sortingScore - a.sortingScore;
                case 'line': return a.lineNumber - b.lineNumber;
                case 'dueDate': {
                    if ((!a.dueDates || a.dueDates.length === 0) && (!b.dueDates || b.dueDates.length === 0))
                        return 0;
                    if (!a.dueDates || a.dueDates.length === 0)
                        return 1;
                    if (!b.dueDates || b.dueDates.length === 0)
                        return -1;
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
exports.CommentTreeProvider = CommentTreeProvider;
