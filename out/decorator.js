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
exports.applyDecorations = applyDecorations;
exports.resetDecorations = resetDecorations;
exports.applyDecorationsToAllEditors = applyDecorationsToAllEditors;
const vscode = __importStar(require("vscode"));
const parser_1 = require("./parser");
let decorationTypes = new Map();
function disposeAll() {
    decorationTypes.forEach(d => d.dispose());
    decorationTypes.clear();
}
function buildDecorations(tags) {
    const map = new Map();
    const config = vscode.workspace.getConfiguration('commentsPlusPlus');
    const showBg = config.get('showBackground', true);
    const showIcons = config.get('showInlineIcons', true);
    for (const tag of tags) {
        const decorationOptions = {
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
function applyDecorations(editor) {
    const tags = (0, parser_1.getTagConfigs)();
    const config = vscode.workspace.getConfiguration('commentsPlusPlus');
    const highlightScope = config.get('highlightScope', 'comment');
    // Rebuild decoration types if needed
    if (decorationTypes.size === 0) {
        decorationTypes = buildDecorations(tags);
    }
    const comments = (0, parser_1.parseDocument)(editor.document, tags);
    // Group ranges by tag
    const rangesByTag = new Map();
    for (const c of comments) {
        const ranges = rangesByTag.get(c.tag) ?? [];
        const line = editor.document.lineAt(c.lineNumber);
        const range = highlightScope === 'line'
            ? line.range
            : new vscode.Range(new vscode.Position(c.lineNumber, c.commentStartIndex), new vscode.Position(c.lineNumber, line.text.length));
        ranges.push(range);
        rangesByTag.set(c.tag, ranges);
    }
    // Apply decorations per tag
    decorationTypes.forEach((decoration, tagKey) => {
        editor.setDecorations(decoration, rangesByTag.get(tagKey) ?? []);
    });
}
function resetDecorations() {
    disposeAll();
}
function applyDecorationsToAllEditors() {
    vscode.window.visibleTextEditors.forEach(applyDecorations);
}
