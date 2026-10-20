"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Copy, Code2 } from "lucide-react";

interface CodeSnippetRendererProps {
  content: string;
  className?: string;
  onHashtagClick?: (tag: string) => void;
}

interface ParsedChunk {
  type: "text" | "code";
  content: string;
  language?: string;
}

export default function CodeSnippetRenderer({ content, className = "", onHashtagClick }: CodeSnippetRendererProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!content) return null;

  // Parsea el contenido buscando bloques de código con ``` o texto normal
  const chunks: ParsedChunk[] = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      chunks.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      });
    }
    chunks.push({
      type: "code",
      language: match[1]?.trim() || "code",
      content: match[2]?.trimEnd() || "",
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    chunks.push({
      type: "text",
      content: content.slice(lastIndex),
    });
  }

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex((prev) => (prev === index ? null : prev));
    }, 2000);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {chunks.map((chunk, idx) => {
        if (chunk.type === "code") {
          return (
            <div
              key={idx}
              className="my-3 rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950 text-slate-100 shadow-md font-mono text-xs"
            >
              {/* Barra superior de terminal/editor */}
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
                <div className="flex items-center gap-2 font-semibold uppercase tracking-wider text-emerald-400">
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{chunk.language || "Código"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(chunk.content, idx)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer text-xs"
                  title="Copiar código al portapapeles"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>

              {/* Contenido del código */}
              <div className="p-4 overflow-x-auto max-h-[360px] text-slate-200 text-xs leading-relaxed selection:bg-emerald-600/30">
                <pre>
                  <code>{chunk.content}</code>
                </pre>
              </div>
            </div>
          );
        }

        // Renderizado de texto regular preservando saltos de línea
        const renderTextWithHashtags = (text: string) => {
          const parts = text.split(/(#[\w\u00C0-\u017F]+)/g);
          return parts.map((part, i) => {
            if (part.startsWith('#')) {
              return onHashtagClick ? (
                <span key={i} onClick={() => onHashtagClick(part.replace('#', ''))} className="text-blue-500 dark:text-blue-400 font-medium hover:underline cursor-pointer">{part}</span>
              ) : (
                <Link key={i} href={`/comunidad?tag=${part.replace('#', '')}`} className="text-blue-500 dark:text-blue-400 font-medium hover:underline cursor-pointer">{part}</Link>
              );
            }
            return <React.Fragment key={i}>{part}</React.Fragment>;
          });
        };

        return (
          <p
            key={idx}
            className="text-gray-700 dark:text-slate-300 text-[15px] whitespace-pre-wrap leading-relaxed"
          >
            {renderTextWithHashtags(chunk.content)}
          </p>
        );
      })}
    </div>
  );
}
