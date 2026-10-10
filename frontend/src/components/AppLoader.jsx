import React from 'react';

// RightWay Centre of Learning — loading spinner
// Replace the SVG "R" with the actual school logo once assets are ready
export function AppLoader({ size = 'md', fullPage = false }) {
  const dims = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-20 h-20' : 'w-14 h-14';
  const logoDims = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-14 h-14' : 'w-9 h-9';
  const ringOuter = size === 'sm' ? 'inset-[-6px]' : size === 'lg' ? 'inset-[-14px]' : 'inset-[-10px]';
  const ringInner = size === 'sm' ? 'inset-[-12px]' : size === 'lg' ? 'inset-[-26px]' : 'inset-[-18px]';
  const orbitW = size === 'sm' ? 'w-16' : size === 'lg' ? 'w-36' : 'w-24';
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : size === 'lg' ? 'w-3 h-3' : 'w-2 h-2';

  const LogoPlaceholder = ({ className }) => (
    <img src="/main_logo.png" alt="RightWay Centre" className={`${className} object-contain rounded-lg`} />
  );

  const inner = (
    <div className="flex flex-col items-center" data-testid="rw-loader">
      <div className="relative mb-3">
        <div className={`absolute ${ringOuter} rounded-full border-2 border-[#2A7A5A]/20`}
          style={{ animation: 'rw-pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
        <div className={`absolute ${ringInner} rounded-full border border-[#84C4A0]/20`}
          style={{ animation: 'rw-pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite 0.5s' }} />
        <div className={`${dims} rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-[#2A7A5A]/10`}
          style={{ animation: 'rw-breathe 2.5s ease-in-out infinite' }}>
          <LogoPlaceholder className={logoDims} />
        </div>
      </div>
      <div className={`relative ${orbitW} h-4`}>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-px bg-gradient-to-r from-transparent via-[#2A7A5A]/20 to-transparent rounded-full" />
        {[0, 1, 2].map(i => (
          <div key={i} className={`absolute top-1/2 -translate-y-1/2 ${dotSize} rounded-full`}
            style={{
              background: i === 0 ? '#2A7A5A' : i === 1 ? '#F4A261' : '#84C4A0',
              animation: `rw-orbit 1.8s ease-in-out infinite ${i * 0.25}s`,
              boxShadow: `0 0 8px ${i === 0 ? '#2A7A5A' : i === 1 ? '#F4A261' : '#84C4A0'}60`
            }} />
        ))}
      </div>
      <style>{`
        @keyframes rw-pulse-ring{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.15);opacity:.3}}
        @keyframes rw-breathe{0%,100%{transform:scale(1);box-shadow:0 0 20px rgba(42,122,90,.1)}50%{transform:scale(1.03);box-shadow:0 0 35px rgba(42,122,90,.2)}}
        @keyframes rw-orbit{0%{left:0;opacity:0;transform:translateY(-50%) scale(.5)}20%{opacity:1;transform:translateY(-50%) scale(1)}50%{left:calc(50% - 5px);transform:translateY(-50%) scale(1.2)}80%{opacity:1;transform:translateY(-50%) scale(1)}100%{left:calc(100% - 10px);opacity:0;transform:translateY(-50%) scale(.5)}}
      `}</style>
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBF8F3] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, #2A7A5A 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-[#2A7A5A]/20"
            style={{
              left: `${15 + i * 14}%`, top: `${20 + ((i * 17) % 60)}%`,
              animation: `rw-float ${3 + i * 0.5}s ease-in-out infinite ${i * 0.3}s`
            }} />
        ))}
        <div className="relative flex flex-col items-center">
          {inner}
          <h2 className="text-lg font-bold text-[#2A7A5A] tracking-wide mt-3 mb-1 font-['Outfit']"
            style={{ animation: 'rw-fade 2s ease-in-out infinite' }}>
            RightWay Centre
          </h2>
          <p className="text-xs text-[#6B7280] tracking-widest uppercase"
            style={{ animation: 'rw-fade 2s ease-in-out infinite 0.3s' }}>
            Loading your workspace
          </p>
          <div className="mt-4 w-48 h-1 bg-[#E5E7EB] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#2A7A5A] via-[#F4A261] to-[#84C4A0] rounded-full"
              style={{ animation: 'rw-progress 2.5s ease-in-out infinite' }} />
          </div>
        </div>
        <style>{`
          @keyframes rw-float{0%,100%{transform:translateY(0) scale(1);opacity:.3}50%{transform:translateY(-20px) scale(1.5);opacity:.6}}
          @keyframes rw-fade{0%,100%{opacity:.9}50%{opacity:.5}}
          @keyframes rw-progress{0%{width:0;margin-left:0}50%{width:60%}100%{width:0;margin-left:100%}}
        `}</style>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {inner}
    </div>
  );
}
