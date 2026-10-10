import React, { useRef, useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { PenTool, Type, Trash2, Check, ShieldCheck, Lock } from 'lucide-react';

const SIGNATURE_FONTS = [
  { name: 'Dancing Script', css: "'Dancing Script', cursive" },
  { name: 'Great Vibes', css: "'Great Vibes', cursive" },
  { name: 'Sacramento', css: "'Sacramento', cursive" },
  { name: 'Pacifico', css: "'Pacifico', cursive" },
];

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Great+Vibes&family=Sacramento&family=Pacifico&display=swap';

export function SignaturePad({ open, onClose, onSign, signerName, signerRole }) {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [typedName, setTypedName] = useState(signerName || '');
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0].css);
  const [reason, setReason] = useState('Reviewed and approved');
  const [designation, setDesignation] = useState(signerRole || '');

  // Load Google Fonts
  useEffect(() => {
    if (!document.querySelector(`link[href*="Dancing+Script"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONT_LINK;
      document.head.appendChild(link);
    }
  }, []);

  // Initialize canvas
  useEffect(() => {
    if (mode !== 'draw' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#1B2A4A';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    clearCanvas();
  }, [mode, open]);

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const rect = canvasRef.current.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    // Draw guide line
    ctx.save();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, rect.height * 0.75);
    ctx.lineTo(rect.width - 20, rect.height * 0.75);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#1B2A4A';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasDrawn(false);
  };

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches?.[0];
    return {
      x: (touch ? touch.clientX : e.clientX) - rect.left,
      y: (touch ? touch.clientY : e.clientY) - rect.top,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDraw = () => setIsDrawing(false);

  const generateTypedSignature = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 600, 200);
    ctx.fillStyle = '#1B2A4A';
    ctx.font = `48px ${selectedFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedName, 300, 90);
    // Guide line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(40, 140);
    ctx.lineTo(560, 140);
    ctx.stroke();
    return canvas.toDataURL('image/png');
  };

  const handleSign = () => {
    let signatureImage;
    if (mode === 'draw') {
      if (!hasDrawn) return;
      signatureImage = canvasRef.current.toDataURL('image/png');
    } else {
      if (!typedName.trim()) return;
      signatureImage = generateTypedSignature();
    }
    onSign({
      signature_image: signatureImage,
      signature_type: mode,
      reason,
      designation,
      font: mode === 'type' ? selectedFont : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="w-5 h-5 text-[#2E6CC4]" /> Digital Signature
          </DialogTitle>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-3">
          <Button
            variant={mode === 'draw' ? 'default' : 'outline'}
            size="sm" className={`flex-1 rounded-lg text-xs ${mode === 'draw' ? 'bg-[#1B2A4A]' : ''}`}
            onClick={() => setMode('draw')}
            data-testid="sig-mode-draw"
          >
            <PenTool className="w-3.5 h-3.5 mr-1.5" /> Draw Signature
          </Button>
          <Button
            variant={mode === 'type' ? 'default' : 'outline'}
            size="sm" className={`flex-1 rounded-lg text-xs ${mode === 'type' ? 'bg-[#1B2A4A]' : ''}`}
            onClick={() => setMode('type')}
            data-testid="sig-mode-type"
          >
            <Type className="w-3.5 h-3.5 mr-1.5" /> Type Signature
          </Button>
        </div>

        {/* Draw Mode */}
        {mode === 'draw' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-500">Draw your signature below</Label>
              <Button variant="ghost" size="sm" onClick={clearCanvas} className="text-xs text-slate-400 h-7">
                <Trash2 className="w-3 h-3 mr-1" /> Clear
              </Button>
            </div>
            <div className="border-2 border-slate-200 rounded-lg bg-white overflow-hidden touch-none" data-testid="sig-canvas-wrapper">
              <canvas
                ref={canvasRef}
                className="w-full h-[150px] cursor-crosshair"
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                data-testid="sig-canvas"
              />
            </div>
            {!hasDrawn && <p className="text-[10px] text-slate-400 text-center">Use your mouse or finger to draw</p>}
          </div>
        )}

        {/* Type Mode */}
        {mode === 'type' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Your Name</Label>
              <Input
                value={typedName}
                onChange={e => setTypedName(e.target.value)}
                placeholder="Full name"
                className="rounded-lg"
                data-testid="sig-typed-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Font Style</Label>
              <div className="grid grid-cols-2 gap-2">
                {SIGNATURE_FONTS.map(f => (
                  <button
                    key={f.name}
                    onClick={() => setSelectedFont(f.css)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${selectedFont === f.css ? 'border-[#2E6CC4] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                    data-testid={`sig-font-${f.name.toLowerCase().replace(/ /g, '-')}`}
                  >
                    <span style={{ fontFamily: f.css, fontSize: '22px', color: '#1B2A4A' }}>
                      {typedName || 'Your Name'}
                    </span>
                    <p className="text-[9px] text-slate-400 mt-1">{f.name}</p>
                  </button>
                ))}
              </div>
            </div>
            {/* Preview */}
            {typedName && (
              <div className="border-2 border-slate-200 rounded-lg bg-white p-4 text-center">
                <p className="text-xs text-slate-400 mb-2">Preview</p>
                <div style={{ fontFamily: selectedFont, fontSize: '36px', color: '#1B2A4A', lineHeight: 1.2 }}>
                  {typedName}
                </div>
                <div className="border-t border-dashed border-slate-300 mt-2 pt-1">
                  <p className="text-[9px] text-slate-400">{designation || signerRole}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reason & Designation */}
        <div className="grid grid-cols-2 gap-3 mt-1">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-9 text-xs rounded-lg" data-testid="sig-reason"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Reviewed and approved">Reviewed and approved</SelectItem>
                <SelectItem value="Verified for accuracy">Verified for accuracy</SelectItem>
                <SelectItem value="Acknowledged receipt">Acknowledged receipt</SelectItem>
                <SelectItem value="Final approval granted">Final approval granted</SelectItem>
                <SelectItem value="Compliance check passed">Compliance check passed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Designation</Label>
            <Input
              value={designation}
              onChange={e => setDesignation(e.target.value)}
              placeholder="e.g. Head of Department"
              className="h-9 text-xs rounded-lg"
              data-testid="sig-designation"
            />
          </div>
        </div>

        {/* Legal notice */}
        <div className="flex items-start gap-2 p-3 bg-[#C5A55A]/10 rounded-lg border border-[#C5A55A]/20 mt-1">
          <ShieldCheck className="w-4 h-4 text-[#C5A55A] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-[#1B2A4A]">Legally binding digital signature</p>
            <p className="text-[10px] text-[#C5A55A]">A SHA-256 hash will be generated. The document will be <strong>locked from editing</strong> after signing.</p>
          </div>
        </div>

        <Button
          className="w-full rounded-lg bg-[#1B2A4A] h-11 text-sm font-semibold mt-1"
          onClick={handleSign}
          disabled={mode === 'draw' ? !hasDrawn : !typedName.trim()}
          data-testid="confirm-signature-btn"
        >
          <Lock className="w-4 h-4 mr-2" /> Apply Signature & Lock Document
        </Button>
      </DialogContent>
    </Dialog>
  );
}
