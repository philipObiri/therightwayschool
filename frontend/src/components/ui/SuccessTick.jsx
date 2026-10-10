import React, { useEffect, useState } from 'react';

let showTickFn = null;

export function showSuccessTick() {
  if (showTickFn) showTickFn();
}

export default function SuccessTick() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    showTickFn = () => {
      setVisible(true);
      setTimeout(() => setVisible(false), 1200);
    };
    return () => { showTickFn = null; };
  }, []);

  if (!visible) return null;

  return (
    <div className="success-tick-overlay" data-testid="success-tick">
      <div className="success-tick-circle">
        <svg viewBox="0 0 24 24">
          <polyline points="4 12 10 18 20 6" />
        </svg>
      </div>
    </div>
  );
}
