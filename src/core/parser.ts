import * as vscode from 'vscode';
import { TagConfig, ParsedComment } from '../models/types';

export function getTagConfigs(): TagConfig[] {
  const config = vscode.workspace.getConfiguration('commentsPlusPlus');
  return config.get<TagConfig[]>('tags') ?? [];
}

export function formatDisplayDate(internalDueDate: string | undefined): string {
  if (!internalDueDate) return '';
  return internalDueDate; // Always YYYY-MM-DD
}

/**
 * Build a tag regex
 * Supports basically every language
 */
function buildTagRegex(tags: TagConfig[]): RegExp {
  const escaped = tags.map(t => t.tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const tagAlts = escaped.join('|');
  return new RegExp(
    `(?:^|\\s|[\\{\\[\\(])(?://|#|\\*|/\\*|--|;+|<!--|%|!|'|\\{#|\\{-|REM|"""|'''|>)\\s*(${tagAlts})(?![A-Za-z0-9_])(.*)`,
    'i'
  );
}

export function parseRawText(text: string, filePath: string, tags: TagConfig[]): ParsedComment[] {
  const results: ParsedComment[] = [];
  const tagRegex = buildTagRegex(tags);
  const tagMap = new Map<string, TagConfig>(tags.map(t => [t.tag.toUpperCase(), t]));
  
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];

    const match = tagRegex.exec(lineText);
    if (match) {
      const [, tagRaw, afterTag] = match;
      const tagKey = tagRaw.toUpperCase();
      const config = tagMap.get(tagKey);
      if (!config) continue;
      
      const commentStartIndex = match.index;

      let textContent = afterTag.replace(/^[:\s]+/, '');

      // Parse priority override from bracket e.g. "HIGH @ema 13-04-2026"
      let categoryPriority = config.priority ?? 0;
      let imminence = 0; // Default to 0 if not specified
      let dueDates: string[] = [];
      let authors: string[] = [];
      let imagePaths: string[] = [];

      const pMap: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      
      // First pass to find the maximum imminence
      let maxImminence = 0;
      let maxImminenceStr = '';
      const bracketRegex = /\[([^\]]+)\]/g;
      let matchBracket;
      while ((matchBracket = bracketRegex.exec(textContent)) !== null) {
        const innerText = matchBracket[1];
        if (/\.(png|jpe?g|gif|svg|webp)(\?.*)?$/i.test(innerText.trim()) || /^https?:\/\//i.test(innerText.trim())) continue;
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
        const keptParts: string[] = [];

        for (const part of parts) {
          if (!part) continue;
          let isMetadata = false;

          if (part.startsWith('@')) {
            authors.push(part.substring(1).toLowerCase());
            isMetadata = true;
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
            dueDates.push(part);
            isMetadata = true;
          } else {
            const pUpper = part.toUpperCase();
            if (pMap[pUpper] !== undefined) {
              if (pUpper === maxImminenceStr && !foundMaxPriority) {
                 foundMaxPriority = true;
                 isMetadata = true;
              } else {
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
      
      // Clean trailing block comment closers (like */, -->, """, etc.) that might end up captured
      textContent = textContent.replace(/(?:\*\/|-->|"""|'''|\-\}|#\}|\]\])$/, '').trim();

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

export function parseDocument(document: vscode.TextDocument, tags: TagConfig[]): ParsedComment[] {
  return parseRawText(document.getText(), document.uri.fsPath, tags);
}

export function parseAllOpenDocuments(tags: TagConfig[]): ParsedComment[] {
  const all: ParsedComment[] = [];
  // Get all currently open text documents in the workspace that are not closed
  const openDocs = vscode.workspace.textDocuments.filter(d => !d.isClosed);
  
  for (const doc of openDocs) {
    if (doc.uri.scheme !== 'file') continue;
    all.push(...parseDocument(doc, tags));
  }
  
  return all;
}

export async function parseAllWorkspaceFiles(tags: TagConfig[]): Promise<ParsedComment[]> {
  const all: ParsedComment[] = [];
  const workspaceFolders = vscode.workspace.workspaceFolders;
  
  if (!workspaceFolders) return all;
  
  const config = vscode.workspace.getConfiguration('commentsPlusPlus');
  const searchIncludes = config.get<string>('searchIncludes') || '**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,py,pyw,pyx,java,cpp,hpp,cc,hh,cxx,hxx,c,h,cs,rb,erb,go,swift,php,phtml,html,htm,css,scss,sass,less,styl,json,jsonc,yaml,yml,md,markdown,sh,bash,zsh,command,adb,ads,al,cls,trigger,adoc,asciidoc,brs,cfm,cfc,clj,cljs,cljc,edn,cob,cbl,coffee,dart,dockerfile,ex,exs,elm,erl,hrl,fs,fsi,fsx,f,for,f90,f95,f03,gd,gen,graphql,gql,groovy,gvy,gy,gsh,hs,lhs,hx,hql,q,jl,kt,kts,tex,bib,lisp,lsp,cl,el,scm,lua,mk,mak,nim,m,mm,pas,pp,inc,pl,pm,p6,pl6,pm6,pig,puml,iuml,wsd,pls,sql,ps1,psm1,psd1,r,rkt,rs,sas,scala,sc,shader,do,ado,svelte,tcl,tf,tfvars,twig,v,vh,sv,svh,vb,bas,frm,vue,xml}';
  const searchExcludes = config.get<string>('searchExcludes') || '**/{node_modules,.git,dist,out,build,coverage}/**';
  
  for (const folder of workspaceFolders) {
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, searchIncludes),
      searchExcludes,
      20000
    );
    
    for (const fileUri of files) {
      try {
        const rawContent = await vscode.workspace.fs.readFile(fileUri);
        const text = new TextDecoder('utf-8').decode(rawContent);
        all.push(...parseRawText(text, fileUri.fsPath, tags));
      } catch (err) {
        console.warn(`Failed to read file ${fileUri.fsPath}:`, err);
      }
    }
  }
  
  return all;
}

