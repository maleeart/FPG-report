'use client';

import { useEffect, useRef, useState } from 'react';

export default function SignaturePad({ label, value, onChange }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef(null);
  const [hasDrawing, setHasDrawing] = useState(Boolean(value));

  // วาด signature เดิม (จาก draft ที่กู้คืนมา) กลับขึ้น canvas ตอน mount
  useEffect(() => {
    if (!value) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = e.touches && e.touches[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const start = (e) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPoint.current = getPoint(e);
  };

  const move = (e) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const point = getPoint(e);
    ctx.strokeStyle = '#1a3fbf';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
    setHasDrawing(true);
  };

  const end = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
    onChange('');
  };

  return (
    <div className="sigpad">
      <div className="sigpad__header">
        <span className="sigpad__label">{label}</span>
        {hasDrawing && (
          <button type="button" className="sigpad__clear" onClick={clear}>
            ล้าง
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={500}
        height={180}
        className="sigpad__canvas"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      {!hasDrawing && <p className="sigpad__hint">ลงชื่อด้วยนิ้วในกรอบด้านบน</p>}

      <style jsx>{`
        .sigpad__header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 6px;
        }
        .sigpad__label {
          font-size: 13px;
          color: var(--ink-secondary);
        }
        .sigpad__clear {
          background: none;
          border: none;
          color: var(--accent-strong);
          font-size: 13px;
          cursor: pointer;
          padding: 4px;
        }
        .sigpad__canvas {
          width: 100%;
          height: 140px;
          background: var(--bg-input);
          border: 1px solid var(--border-hairline);
          border-radius: var(--radius-sm);
          touch-action: none;
          display: block;
        }
        .sigpad__hint {
          margin: 6px 0 0;
          font-size: 12px;
          color: var(--ink-muted);
          text-align: center;
        }
      `}</style>
    </div>
  );
}
