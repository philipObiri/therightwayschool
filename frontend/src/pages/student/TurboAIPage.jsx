import React, { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Zap, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';

export default function TurboAIPage() {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className={`${fullscreen ? 'fixed inset-0 z-50 bg-white' : 'space-y-4'}`} data-testid="turbo-ai-page">
      {/* Header */}
      <div className={`flex items-center justify-between ${fullscreen ? 'px-4 py-2 border-b border-slate-200 bg-[#F3F6FC]' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#2E6CC4]" />
          </div>
          <div>
            <h1 className={`font-bold text-[#1B2A4A] ${fullscreen ? 'text-sm' : 'text-2xl'}`}>Turbo AI</h1>
            {!fullscreen && <p className="text-slate-500 mt-0.5 text-sm">AI-powered notes, flashcards, quizzes & study tools</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setFullscreen(!fullscreen)} data-testid="toggle-fullscreen">
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <a href="https://www.turbo.ai" target="_blank" rel="noopener noreferrer" className="text-xs text-[#2E6CC4] hover:underline flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> Open in new tab
          </a>
        </div>
      </div>

      {/* Turbo.AI Embed */}
      <div className={`bg-white rounded-md border border-slate-200 overflow-hidden ${fullscreen ? 'h-[calc(100vh-50px)]' : ''}`} style={!fullscreen ? { height: 'calc(100vh - 14rem)' } : {}}>
        <iframe
          src="https://www.turbo.ai"
          className="w-full h-full border-0"
          title="Turbo AI - Study Tools"
          allow="camera; microphone; clipboard-read; clipboard-write"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-downloads"
          data-testid="turbo-ai-iframe"
        />
      </div>
    </div>
  );
}
