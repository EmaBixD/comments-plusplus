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
exports.getTagConfigs = getTagConfigs;
exports.formatDisplayDate = formatDisplayDate;
exports.parseRawText = parseRawText;
exports.parseDocument = parseDocument;
exports.parseAllOpenDocuments = parseAllOpenDocuments;
exports.parseAllWorkspaceFiles = parseAllWorkspaceFiles;
const vscode = __importStar(require("vscode"));
function getTagConfigs() {
    const config = vscode.workspace.getConfiguration('commentsPlusPlus');
    return config.get('tags') ?? [];
}
function formatDisplayDate(internalDueDate) {
    if (!internalDueDate)
        return '';
    return internalDueDate; // Always YYYY-MM-DD
}
/**
 * Build a regex that matches any configured tag inside a comment.
 * Supports: // TAG, # TAG, /* TAG, * TAG (inside block comments)
 */
function buildTagRegex(tags) {
    const escaped = tags.map(t => t.tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // Match single-line comment starters + optional whitespace + tag
    const tagAlts = escaped.join('|');
    // Capture tag (group 1) and the rest of the line (group 2)
    // Negative lookahead ensures we don't partially match words like "TODOS"
    return new RegExp(`(?://|#|\\*|/\\*)\\s*(${tagAlts})(?![A-Za-z0-9_])(.*)`, 'i');
}
function parseRawText(text, filePath, tags) {
    const results = [];
    const tagRegex = buildTagRegex(tags);
    const tagMap = new Map(tags.map(t => [t.tag.toUpperCase(), t]));
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        const match = tagRegex.exec(lineText);
        if (match) {
            const [, tagRaw, afterTag] = match;
            const tagKey = tagRaw.toUpperCase();
            const config = tagMap.get(tagKey);
            if (!config)
                continue;
            const commentStartIndex = match.index;
            let textContent = afterTag.replace(/^[:\s]+/, '');
            // Parse priority override from bracket e.g. "HIGH @ema 13-04-2026"
            let categoryPriority = config.priority ?? 0;
            let imminence = 0; // Default to 0 if not specified
            let dueDates = [];
            let authors = [];
            let imagePaths = [];
            const pMap = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
            // First pass to find the maximum imminence
            let maxImminence = 0;
            let maxImminenceStr = '';
            const bracketRegex = /\[([^\]]+)\]/g;
            let matchBracket;
            while ((matchBracket = bracketRegex.exec(textContent)) !== null) {
                const innerText = matchBracket[1];
                if (/\.(png|jpe?g|gif|svg|webp)(\?.*)?$/i.test(innerText.trim()) || /^https?:\/\//i.test(innerText.trim()))
                    continue;
                const parts = innerText.split(/[\s,]+/);
                for (const part of parts) {
                    const pUpper = part.toUpperCase();
                    if (pMap[pUpper] !== undefined && pMap[pUpper] > maxImminence) {
                        maxImminence = pMap[pUpper];
                        maxImminenceStr = pUpper;
                    }
                }
            }
            imminence = maxImminence;
            let foundMaxPriority = false;
            // Extract and process all bracket groups anywhere in the text e.g. [LOW] text [@dev-team] text [2025-03-30]
            textContent = textContent.replace(/\[([^\]]+)\]/g, (fullMatch, innerText) => {
                // Special case: if the entire bracket contents is a path to an image (may contain spaces)
                const innerTrimmed = innerText.trim();
                if (/\.(png|jpe?g|gif|svg|webp)(\?.*)?$/i.test(innerTrimmed) || /^https?:\/\//i.test(innerTrimmed)) {
                    imagePaths.push(innerTrimmed);
                    return ''; // Hide it from the text
                }
                const parts = innerText.split(/[\s,]+/);
                const keptParts = [];
                for (const part of parts) {
                    if (!part)
                        continue;
                    let isMetadata = false;
                    if (part.startsWith('@')) {
                        authors.push(part.substring(1).toLowerCase());
                        isMetadata = true;
                    }
                    else if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
                        dueDates.push(part);
                        isMetadata = true;
                    }
                    else {
                        const pUpper = part.toUpperCase();
                        if (pMap[pUpper] !== undefined) {
                            if (pUpper === maxImminenceStr && !foundMaxPriority) {
                                foundMaxPriority = true;
                                isMetadata = true;
                            }
                            else {
                                isMetadata = false; // leave it as normal text
                            }
                        }
                    }
                    if (!isMetadata) {
                        keptParts.push(part);
                    }
                }
                // If the entire bracket was metadata, remove it. Otherwise, keep the unparsed parts inside brackets.
                if (keptParts.length > 0) {
                    return `[${keptParts.join(' ')}]`;
                }
                return '';
            });
            // Cleanup spaces that might have been left over by removed brackets
            textContent = textContent.replace(/\s+/g, ' ').replace(/^[:\s]+/, '').trim();
            results.push({
                tag: tagRaw.toUpperCase(),
                text: textContent,
                fullLine: lineText.trim(),
                lineNumber: i,
                filePath: filePath,
                commentStartIndex,
                categoryPriority,
                imminence,
                sortingScore: categoryPriority + (imminence * 0.1),
                authors: authors.length > 0 ? authors : undefined,
                dueDates: dueDates.length > 0 ? dueDates : undefined,
                imagePaths: imagePaths.length > 0 ? imagePaths : undefined,
                config,
            });
        }
    }
    return results;
}
function parseDocument(document, tags) {
    return parseRawText(document.getText(), document.uri.fsPath, tags);
}
function parseAllOpenDocuments(tags) {
    const all = [];
    // Get all currently open text documents in the workspace that are not closed
    const openDocs = vscode.workspace.textDocuments.filter(d => !d.isClosed);
    for (const doc of openDocs) {
        if (doc.uri.scheme !== 'file')
            continue;
        all.push(...parseDocument(doc, tags));
    }
    return all;
}
async function parseAllWorkspaceFiles(tags) {
    const all = [];
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders)
        return all;
    const config = vscode.workspace.getConfiguration('commentsPlusPlus');
    const searchIncludes = config.get('searchIncludes') || '**/*.{ts,js,tsx,jsx,py,java,cpp,c,cs,rb,go,swift,php,html,css,scss,json,yaml,yml,md,sh}';
    const searchExcludes = config.get('searchExcludes') || '**/{node_modules,.git,dist,out,build,coverage}/**';
    for (const folder of workspaceFolders) {
        const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, searchIncludes), searchExcludes, 20000);
        for (const fileUri of files) {
            try {
                const rawContent = await vscode.workspace.fs.readFile(fileUri);
                const text = new TextDecoder('utf-8').decode(rawContent);
                all.push(...parseRawText(text, fileUri.fsPath, tags));
            }
            catch (err) {
                console.warn(`Failed to read file ${fileUri.fsPath}:`, err);
            }
        }
    }
    return all;
}
