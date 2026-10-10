import React, { useMemo, useState, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import DiagramGenerator from './DiagramGenerator';
import { ImagePlus } from 'lucide-react';

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ script: 'super' }, { script: 'sub' }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  ['blockquote', 'link', 'image'],
  ['clean'],
];

export function SchemeEditor({ value, onChange, placeholder, subject }) {
  const [diagramOpen, setDiagramOpen] = useState(false);
  const quillRef = useRef(null);

  const modules = useMemo(() => ({
    toolbar: TOOLBAR_OPTIONS,
  }), []);

  const handleDiagramInsert = (imageUrl, altText) => {
    const imgHtml = `<p><img src="${imageUrl}" alt="${altText}" style="max-width:100%;border-radius:8px;margin:12px 0;" /></p>`;
    const current = value || '';
    onChange(current + imgHtml);
    setDiagramOpen(false);
  };

  return (
    <div className="scheme-editor" data-testid="scheme-editor">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value || ''}
        onChange={onChange}
        modules={modules}
        placeholder={placeholder || 'Type your scheme of work content here — use headings, lists, and formatting...'}
      />
      <div className="flex items-center gap-2 px-3 py-1.5 border border-t-0 border-slate-200 bg-slate-50 rounded-b-md">
        <button
          type="button"
          onClick={() => setDiagramOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2E6CC4] bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
          data-testid="open-diagram-generator"
        >
          <ImagePlus className="w-3.5 h-3.5" /> AI Diagram
        </button>
        <span className="text-[10px] text-slate-400">Generate diagrams for math, science, economics & more</span>
      </div>
      <DiagramGenerator
        open={diagramOpen}
        onClose={() => setDiagramOpen(false)}
        onInsert={handleDiagramInsert}
        defaultSubject={subject}
      />
      <style>{`
        .scheme-editor .ql-container { min-height: 240px; font-size: 14px; font-family: 'Manrope', sans-serif; }
        .scheme-editor .ql-editor { min-height: 240px; line-height: 1.7; }
        .scheme-editor .ql-toolbar { border-top-left-radius: 6px; border-top-right-radius: 6px; border-color: #e2e8f0; background: #f8fafc; }
        .scheme-editor .ql-container { border-bottom-left-radius: 6px; border-bottom-right-radius: 6px; border-color: #e2e8f0; border-radius: 0; }
        .scheme-editor .ql-editor h1 { font-size: 1.5em; font-weight: 700; margin-bottom: 0.5em; }
        .scheme-editor .ql-editor h2 { font-size: 1.25em; font-weight: 600; margin-bottom: 0.4em; }
        .scheme-editor .ql-editor h3 { font-size: 1.1em; font-weight: 600; margin-bottom: 0.3em; }
        .scheme-editor .ql-editor ul, .scheme-editor .ql-editor ol { padding-left: 1.5em; }
        .scheme-editor .ql-editor blockquote { border-left: 3px solid #2E6CC4; padding-left: 1em; color: #475569; }
        .scheme-editor .ql-editor img { max-width: 100%; border-radius: 8px; margin: 8px 0; }
      `}</style>
    </div>
  );
}
