export const DEFAULT_TEXT_OPTIONS = {
  wrapMode: 'explicit', // 'explicit' (giữ đúng dòng Enter) | 'wrap' (tự xuống dòng khi dài)
  align: 'center',      // 'center' | 'left'
  bold: true,           // true | false
  uppercase: false,     // true | false
};

export function normalizeTextOptions(opts) {
  return {
    ...DEFAULT_TEXT_OPTIONS,
    ...(opts || {}),
  };
}

function splitLongWordByChars(ctx, word, maxW) {
  const chunks = [];
  let current = '';
  for (const ch of word) {
    const next = current + ch;
    if (current && ctx.measureText(next).width > maxW) {
      chunks.push(current);
      current = ch;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [''];
}

function buildWrappedLines(ctx, paragraphs, maxW, wrapMode, allowCharBreak) {
  const lines = [];
  for (const para of paragraphs) {
    if (!para) {
      lines.push('');
      continue;
    }
    if (wrapMode === 'explicit') {
      if (ctx.measureText(para).width <= maxW) {
        lines.push(para);
      } else if (allowCharBreak) {
        lines.push(...splitLongWordByChars(ctx, para, maxW));
      } else {
        return null;
      }
      continue;
    }

    // wrapMode === 'wrap'
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let currentLine = '';
    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxW) {
        currentLine = candidate;
        continue;
      }
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      if (ctx.measureText(word).width <= maxW) {
        currentLine = word;
      } else if (allowCharBreak) {
        const parts = splitLongWordByChars(ctx, word, maxW);
        for (let i = 0; i < parts.length - 1; i++) {
          lines.push(parts[i]);
        }
        currentLine = parts[parts.length - 1];
      } else {
        return null;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }
  return lines;
}

function measureLineMetrics(ctx, line, fontSize) {
  const sample = line && line.trim() ? line : 'ẮỘĐg';
  const m = ctx.measureText(sample);
  const ascent = typeof m.actualBoundingBoxAscent === 'number' && m.actualBoundingBoxAscent > 0
    ? m.actualBoundingBoxAscent
    : fontSize * 0.82;
  const descent = typeof m.actualBoundingBoxDescent === 'number' && m.actualBoundingBoxDescent >= 0
    ? m.actualBoundingBoxDescent
    : fontSize * 0.22;
  return {
    width: line ? ctx.measureText(line).width : 0,
    ascent,
    descent,
  };
}

function measureLayoutAtSize(ctx, paragraphs, boxW, boxH, fontSize, options, allowCharBreak = false) {
  const weight = options.bold ? 700 : 400;
  const fontStr = `${weight} ${fontSize}px Arial, "Segoe UI", sans-serif`;
  ctx.font = fontStr;

  const lines = buildWrappedLines(ctx, paragraphs, boxW, options.wrapMode, allowCharBreak);
  if (!lines || lines.length === 0) return null;

  const lineStep = Math.round(fontSize * 1.18);
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) || lines[0];
  let lastNonEmpty = lines[lines.length - 1];
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().length > 0) {
      lastNonEmpty = lines[i];
      break;
    }
  }

  const firstMetrics = measureLineMetrics(ctx, firstNonEmpty, fontSize);
  const lastMetrics = measureLineMetrics(ctx, lastNonEmpty, fontSize);
  const totalHeight = (lines.length - 1) * lineStep + firstMetrics.ascent + lastMetrics.descent;

  if (!allowCharBreak) {
    if (totalHeight > boxH) return null;
    for (const line of lines) {
      if (line && ctx.measureText(line).width > boxW) return null;
    }
  }

  return {
    fontSize,
    fontStr,
    lines,
    lineStep,
    firstAscent: firstMetrics.ascent,
    lastDescent: lastMetrics.descent,
    totalHeight,
  };
}

/**
 * Tính cỡ chữ lớn nhất có thể để toàn bộ văn bản vừa khít khung (boxW x boxH).
 * Hỗ trợ nhiều dòng xuống hàng và tự động thu nhỏ khi văn bản dài hơn.
 */
export function computeAutoFitTextLayout(ctx, rawText, boxW, boxH, rawOptions = {}) {
  const options = normalizeTextOptions(rawOptions);
  const normalized = String(rawText || '').replace(/\r\n/g, '\n');
  const displayRaw = options.uppercase ? normalized.toUpperCase() : normalized;

  if (!displayRaw.trim()) {
    return {
      fontSize: 0,
      fontStr: '700 16px Arial, sans-serif',
      lines: [],
      lineStep: 0,
      firstAscent: 0,
      lastDescent: 0,
      totalHeight: 0,
      options,
    };
  }

  // Bỏ dòng trống thừa ở đầu/cuối nếu user vô tình nhấn Enter dư, nhưng giữ dòng trống ở giữa
  const rawLines = displayRaw.split('\n');
  while (rawLines.length > 1 && rawLines[0].trim() === '') rawLines.shift();
  while (rawLines.length > 1 && rawLines[rawLines.length - 1].trim() === '') rawLines.pop();

  const minSize = 8;
  const maxSize = Math.max(minSize, Math.min(Math.floor(boxH * 0.92), 700));

  let low = minSize;
  let high = maxSize;
  let best = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const attempt = measureLayoutAtSize(ctx, rawLines, boxW, boxH, mid, options, false);
    if (attempt) {
      best = attempt;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (!best) {
    best = measureLayoutAtSize(ctx, rawLines, boxW, boxH, minSize, options, true);
  }

  return {
    ...best,
    options,
  };
}

export function drawAutoFitTextBox(ctx, x, y, w, h, rawText, rawOptions = {}) {
  const layout = computeAutoFitTextLayout(ctx, rawText, w, h, rawOptions);
  if (!layout.lines.length) return layout;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = '#000000';
  ctx.font = layout.fontStr;
  ctx.textBaseline = 'alphabetic';

  const align = layout.options.align === 'left' ? 'left' : 'center';
  ctx.textAlign = align;
  const drawX = align === 'left' ? x : x + w / 2;
  const startBaselineY = y + (h - layout.totalHeight) / 2 + layout.firstAscent;

  layout.lines.forEach((line, idx) => {
    if (!line) return;
    const lineY = startBaselineY + idx * layout.lineStep;
    ctx.fillText(line, drawX, lineY);
  });

  ctx.restore();
  return layout;
}
