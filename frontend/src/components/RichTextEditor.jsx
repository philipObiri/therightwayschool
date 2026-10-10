import React, { useRef, useCallback, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { Bold, Italic, Underline, List, ListOrdered, Link, Quote, Heading2, Minus, ImagePlus } from 'lucide-react';
import DiagramGenerator from './DiagramGenerator';

export default function RichTextEditor({ value, onChange, placeholder, subject }) {
  const editorRef = useRef(null);
  const initializedRef = useRef(false);
  const [diagramOpen, setDiagramOpen] = useState(false);

  useEffect(() => {
    if (editorRef.current && value && !initializedRef.current) {
      editorRef.current.innerHTML = value;
      initializedRef.current = true;
    }
  }, [value]);

  useEffect(() => {
    if (!value && editorRef.current && initializedRef.current) {
      editorRef.current.innerHTML = '';
      initializedRef.current = false;
    }
  }, [value]);

  const exec = useCallback((command, val = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    if (editorRef.current) {
      onChange(DOMPurify.sanitize(editorRef.current.innerHTML));
    }
  }, [onChange]);

  const handleInput = () => {
    if (editorRef.current) {
      initializedRef.current = true;
      onChange(DOMPurify.sanitize(editorRef.current.innerHTML));
    }
  };

  const handleLink = () => {
    const url = window.prompt('Enter URL:', 'https://');
    if (url) exec('createLink', url);
  };

  const handleDiagramInsert = (imageUrl, altText) => {
    if (editorRef.current) {
      editorRef.current.focus();
      const img = `<p><img src="${imageUrl}" alt="${altText}" style="max-width:100%;border-radius:8px;margin:12px 0;" /></p>`;
      document.execCommand('insertHTML', false, img);
      onChange(DOMPurify.sanitize(editorRef.current.innerHTML));
    }
    setDiagramOpen(false);
  };

  const btnClass = "p-1.5 rounded hover:bg-slate-200 transition-colors text-slate-600 hover:text-[#1B2A4A]";

  return (
    <div className="border border-slate-200 rounded-md overflow-hidden bg-white" data-testid="rich-text-editor">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50 flex-wrap">
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('formatBlock', 'H2')} className={btnClass} title="Heading"><Heading2 className="w-4 h-4" /></button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')} className={btnClass} title="Bold"><Bold className="w-4 h-4" /></button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('italic')} className={btnClass} title="Italic"><Italic className="w-4 h-4" /></button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('underline')} className={btnClass} title="Underline"><Underline className="w-4 h-4" /></button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('superscript')} className={btnClass} title="Superscript (x²)"><span className="text-xs font-bold">X<sup>2</sup></span></button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('subscript')} className={btnClass} title="Subscript (x₂)"><span className="text-xs font-bold">X<sub>2</sub></span></button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertUnorderedList')} className={btnClass} title="Bullet List"><List className="w-4 h-4" /></button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertOrderedList')} className={btnClass} title="Numbered List"><ListOrdered className="w-4 h-4" /></button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('formatBlock', 'BLOCKQUOTE')} className={btnClass} title="Quote"><Quote className="w-4 h-4" /></button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={handleLink} className={btnClass} title="Insert Link"><Link className="w-4 h-4" /></button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertHorizontalRule')} className={btnClass} title="Horizontal Rule"><Minus className="w-4 h-4" /></button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => setDiagramOpen(true)} className="p-1.5 rounded hover:bg-blue-100 transition-colors text-[#2E6CC4] hover:text-[#245299]" title="AI Diagram Generator" data-testid="open-diagram-generator"><ImagePlus className="w-4 h-4" /></button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="min-h-[180px] max-h-[400px] overflow-y-auto px-4 py-3 text-sm text-slate-700 outline-none prose prose-sm max-w-none [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2"
        style={{ wordBreak: 'break-word' }}
        data-placeholder={placeholder || 'Write your message...'}
        suppressContentEditableWarning
        data-testid="compose-editor-area"
      />
      <DiagramGenerator
        open={diagramOpen}
        onClose={() => setDiagramOpen(false)}
        onInsert={handleDiagramInsert}
        defaultSubject={subject}
      />
      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #94A3B8;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
