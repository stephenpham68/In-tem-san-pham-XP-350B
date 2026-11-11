import { useEffect, useRef } from 'react';

const MM_DOTS = 8; // 203 DPI (~8 dots/mm), matches App.jsx MM constant

/**
 * Copies one physical label region from the master 203-DPI print canvas onto a
 * display sticker canvas with safe bounds clamping.
 */
function drawStickerSlice(master, dest, sx, sy, width, height) {
  if (!dest) return;
  if (dest.width !== width) dest.width = width;
  if (dest.height !== height) dest.height = height;

  const ctx = dest.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  if (!master || master.width <= 0 || master.height <= 0) return;

  const safeSx = Math.max(0, Math.min(master.width, sx));
  const safeSy = Math.max(0, Math.min(master.height, sy));
  const copyW = Math.max(0, Math.min(width, master.width - safeSx));
  const copyH = Math.max(0, Math.min(height, master.height - safeSy));
  if (copyW <= 0 || copyH <= 0) return;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(master, safeSx, safeSy, copyW, copyH, 0, 0, copyW, copyH);
}

/**
 * Renders the 2-column decal roll emerging from a realistic Xprinter XP-350B
 * housing while keeping the underlying master print bitmap untouched.
 */
export default function XprinterRollPreview({
  sourceCanvasRef,
  renderTick,
  config,
  baselineOffsetY = 0,
  copies = 1,
  status = { kind: 'idle' },
}) {
  const leftRow1Ref = useRef(null);
  const rightRow1Ref = useRef(null);
  const leftRow2Ref = useRef(null);
  const rightRow2Ref = useRef(null);

  const labelWidth = Number(config?.labelWidth) || 35;
  const labelHeight = Number(config?.labelHeight) || 22;
  const paperWidth = Number(config?.paperWidth) || 76;
  const columnGap = Number(config?.columnGap ?? 0.4);
  const rowGap = Number(config?.gap ?? 3);
  const leftMargin = Number(config?.leftMargin ?? 1.5);
  const totalCopies = Math.max(1, Number(copies) || 1);

  useEffect(() => {
    const master = sourceCanvasRef?.current;
    if (!master) return;

    const w = Math.max(1, Math.round(labelWidth * MM_DOTS));
    const h = Math.max(1, Math.round(labelHeight * MM_DOTS));

    // Anchor left/right/top sticker windows to the calibrated hardware origin
    // (leftMargin=1.5 + offsetX=-1.5 => sx=0; hardware baselineOffsetY => sy).
    const nominalOriginX = Math.max(0, Math.round((leftMargin - 1.5) * MM_DOTS));
    const nominalOriginY = Math.max(0, Math.round((Number(baselineOffsetY) || 0) * MM_DOTS));
    const sxLeft = nominalOriginX;
    const sxRight = nominalOriginX + Math.round((labelWidth + columnGap) * MM_DOTS);

    const targets = [
      { canvas: leftRow1Ref.current, sx: sxLeft },
      { canvas: rightRow1Ref.current, sx: sxRight },
    ];
    if (totalCopies >= 2) {
      targets.push(
        { canvas: leftRow2Ref.current, sx: sxLeft },
        { canvas: rightRow2Ref.current, sx: sxRight }
      );
    }

    for (const target of targets) {
      drawStickerSlice(master, target.canvas, target.sx, nominalOriginY, w, h);
    }
  }, [sourceCanvasRef, renderTick, labelWidth, labelHeight, columnGap, leftMargin, baselineOffsetY, totalCopies]);

  // Visual proportions scaled comfortably for the preview strip (~406px roll width)
  const middleGapPx = Math.max(3, Math.round((columnGap / paperWidth) * 406));
  const rowGapPx = Math.max(9, Math.min(24, Math.round((rowGap / paperWidth) * 390)));
  const sideMarginPct = Math.max(2.2, Math.min(8, (((paperWidth - (labelWidth * 2 + columnGap)) / 2) / paperWidth) * 100));
  const stickerStyle = { aspectRatio: `${labelWidth} / ${labelHeight}` };
  const rowStyle = { gap: `${middleGapPx}px` };

  const ledStateClass =
    status?.kind === 'busy'
      ? 'is-busy'
      : status?.kind === 'error'
        ? 'is-error'
        : 'is-ready';

  return (
    <div className="xp-printer-unit" aria-label="Mô phỏng máy in Xprinter XP-350B đang in 2 tem">
      {/* Realistic Xprinter XP-350B dark top bezel + silver nameplate + paper mouth */}
      <div className="xp-printer-head">
        <div className="xp-printer-top-row">
          <div className="xp-printer-status-chip">
            <span className={`xp-status-led ${ledStateClass}`} />
            <span className="xp-model-text">XP-350B</span>
            <span className="xp-led-label">
              {status?.kind === 'busy' ? 'ĐANG IN…' : status?.kind === 'error' ? 'OFFLINE' : 'ONLINE'}
            </span>
          </div>

          <div className="xp-copies-chip">
            {totalCopies} hàng · {totalCopies * 2} tem
          </div>
        </div>

        <div className="xp-brand-plate-wrap">
          <div className="xp-brand-plate">Xprinter</div>
        </div>

        <div className="xp-slot-row">
          <div className="xp-printer-cheek" />
          <div className="xp-exit-slot">
            <div className="xp-tear-bar" />
          </div>
          <div className="xp-printer-cheek" />
        </div>
      </div>

      {/* Emerging translucent glassine decal strip */}
      <div className={`xp-roll-strip ${status?.kind === 'busy' ? 'is-printing' : ''}`}>
        <div
          className="xp-liner-sheet"
          style={{
            paddingLeft: `${sideMarginPct.toFixed(2)}%`,
            paddingRight: `${sideMarginPct.toFixed(2)}%`,
          }}
        >
          {/* Subtle stub peeking just inside the printer slot */}
          <div className="xp-slot-peek-row" style={{ ...rowStyle, marginBottom: `${Math.max(8, rowGapPx - 2)}px` }}>
            <div className="xp-slot-peek-sticker" />
            <div className="xp-slot-peek-sticker" />
          </div>

          {/* Row 1: Two crisp separated die-cut stickers */}
          <div className="xp-label-row" style={rowStyle}>
            <div className="xp-sticker-card" style={stickerStyle} title={`Tem Trái (${labelWidth}×${labelHeight}mm)`}>
              <canvas ref={leftRow1Ref} className="xp-sticker-canvas" />
            </div>
            <div className="xp-sticker-card" style={stickerStyle} title={`Tem Phải (${labelWidth}×${labelHeight}mm)`}>
              <canvas ref={rightRow1Ref} className="xp-sticker-canvas" />
            </div>
          </div>

          {/* Row 2: Next row on the continuous roll (printed if copies >= 2, blank die-cut if copies === 1) */}
          <div className="xp-label-row xp-label-row-next" style={{ ...rowStyle, marginTop: `${rowGapPx}px` }}>
            <div
              className={`xp-sticker-card ${totalCopies < 2 ? 'is-blank' : ''}`}
              style={stickerStyle}
              title={totalCopies >= 2 ? 'Hàng tem tiếp theo sẽ in' : 'Tem trắng kế tiếp trên cuộn'}
            >
              {totalCopies >= 2 && <canvas ref={leftRow2Ref} className="xp-sticker-canvas" />}
            </div>
            <div
              className={`xp-sticker-card ${totalCopies < 2 ? 'is-blank' : ''}`}
              style={stickerStyle}
              title={totalCopies >= 2 ? 'Hàng tem tiếp theo sẽ in' : 'Tem trắng kế tiếp trên cuộn'}
            >
              {totalCopies >= 2 && <canvas ref={rightRow2Ref} className="xp-sticker-canvas" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
