import { useEffect, useMemo, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

const MM = 8; // 203 DPI: 8 dots/mm

const DEFAULT_CONFIG = {
  paperWidth: 76,   // Khổ cuộn giấy gồm cả đế backing (mm)
  labelWidth: 35,   // Chiều rộng con tem vật lý (mm)
  labelHeight: 22,  // Chiều cao con tem vật lý (mm) - TSPL SIZE
  frameWidth: 35,   // Chiều rộng khung viền test (mm)
  frameHeight: 22,  // Chiều cao khung viền test (mm)
  columnGap: 0.4,   // Khoảng cách giữa 2 tem trên cùng 1 hàng (mm) - KHÓA CHUẨN 0.4 mm
  leftMargin: 1.5,  // Lề đế bên trái (mm)
  gap: 3,           // Khoảng cách (gap) giữa các hàng tem (mm) - TSPL GAP
  offsetX: -1.5,    // Tinh chỉnh lệch ngang toàn cục (-1.5 mm) - KHÓA CHUẨN -1.5 mm
  offsetY: 2.0,     // Tinh chỉnh lệch dọc toàn cục (+2.0 mm) - KHÓA CHUẨN +2.0 mm
  inset: 1.0,       // Khoảng lùi an toàn vào trong mép tem (mm)
  lineWidth: 2,     // Độ dày nét viền khi in căn khung (dots)
  subTextOffsetY: -6, // ĐÃ KHÓA CHUẨN -6 DOT CHO DÒNG NHỎ THEO YÊU CẦU
};

export const LAYOUT_DEFAULTS = {
  single: {
    product: 'TRỐNG BÔNG 04',
    subText: '',
    price: '320,000',
    barcode: '893751041',
  },
  two_lines: {
    product: 'TRỐNG BÔNG 0315',
    subText: 'Túi Đeo Chéo Nhí 041 - dây kéo giữa',
    price: '320,000',
    barcode: '893751041',
  },
  two_lines_bottom_price: {
    product: 'Size 25x22x10',
    subText: 'Túi Đeo Chéo Nhí 041 - dây kéo giữa',
    price: '1,000,000',
    barcode: '893751041',
  },
};

const STORAGE_KEY = 'tien_uyen_printer_config_v9';

function barcodeCanvas(value, maxAllowedWidth = 220) {
  const canvas = document.createElement('canvas');
  const text = String(value || '0').trim();
  try {
    // Thử module 2 dot trước (độ tương phản và độ rộng vạch tối ưu nhất cho đầu in 203 DPI)
    JsBarcode(canvas, text, {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      width: 2,
      height: 50,
      background: '#ffffff',
      lineColor: '#000000',
    });

    // Nếu barcode quá dài vượt quá vùng in, tự động co về module 1 dot nguyên bản (không làm mờ vạch)
    if (canvas.width > maxAllowedWidth) {
      JsBarcode(canvas, text, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        width: 1,
        height: 50,
        background: '#ffffff',
        lineColor: '#000000',
      });
    }
  } catch (_) {
    try {
      JsBarcode(canvas, '0', {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        width: 2,
        height: 50,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch (_) {}
  }
  return canvas;
}

function fitText(ctx, text, maxWidth, startSize, weight = 400, minSize = 9) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

function drawPriceLine(ctx, priceVal, centerX, y, maxW, startSize = 26) {
  const label = 'GIÁ : ';
  let size = startSize;
  while (size > 10) {
    ctx.font = `400 ${size}px Arial, sans-serif`;
    const lw = ctx.measureText(label).width;
    ctx.font = `700 ${size}px Arial, sans-serif`;
    const vw = ctx.measureText(priceVal).width;
    if (lw + vw <= maxW) break;
    size -= 1;
  }
  ctx.font = `400 ${size}px Arial, sans-serif`;
  const labelW = ctx.measureText(label).width;
  ctx.font = `700 ${size}px Arial, sans-serif`;
  const valW = ctx.measureText(priceVal).width;
  const totalW = labelW + valW;
  const startX = centerX - totalW / 2;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${size}px Arial, sans-serif`;
  ctx.fillText(label, startX, y);
  ctx.font = `700 ${size}px Arial, sans-serif`;
  ctx.fillText(priceVal, startX + labelW, y);
}

export function formatPriceNumber(newRaw, prevVal = '') {
  if (newRaw === null || newRaw === undefined) return '';
  const str = String(newRaw).trim();
  if (!str) return '';

  const prevDigits = String(prevVal || '').replace(/\D/g, '');
  let newDigits = str.replace(/\D/g, '');

  // Nếu người dùng nhấn Backspace tại dấu phẩy/chấm, chuỗi ngắn đi nhưng số chưa giảm -> xóa chữ số liền trước
  if (str.length < String(prevVal || '').length && newDigits === prevDigits && newDigits.length > 0) {
    newDigits = newDigits.slice(0, -1);
  }

  if (!newDigits) return '';

  // Bỏ số 0 thừa ở đầu nếu nhiều chữ số (VD: 01254000 -> 1254000)
  if (newDigits.length > 1 && newDigits.startsWith('0')) {
    newDigits = newDigits.replace(/^0+/, '') || '0';
  }

  // Định dạng phân cách hàng ngàn bằng dấu phẩy (,) theo yêu cầu người dùng
  return newDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function getDisplayPrice(val) {
  const num = formatPriceNumber(val);
  return num ? `${num}₫` : '0₫';
}

export function formatVNCurrency(val) {
  return getDisplayPrice(val);
}

function drawLabel(ctx, x, y, config, data) {
  const scale = MM;
  const w = Math.round(config.labelWidth * scale);   // 35 * 8 = 280 dots
  const h = Math.round(config.labelHeight * scale);  // 22 * 8 = 176 dots
  const inset = Math.round(config.inset * scale);    // 1 * 8 = 8 dots

  const safeX = x + inset;
  const safeY = y + inset;
  const safeW = w - inset * 2; // 264 dots
  const safeH = h - inset * 2; // 160 dots

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = '#000000';

  const brandText = (data.brand || '').trim().toUpperCase();
  const hasBrand = Boolean(brandText);
  const subText = (data.subText || '').trim();
  const isTwoLines = data.nameLayout === 'two_lines';
  const subTextOffsetY = Number(config?.subTextOffsetY !== undefined ? config.subTextOffsetY : -6);

  if (data.nameLayout === 'two_lines_bottom_price') {
    // =========================================================================
    // BỐ CỤC 3: 2 DÒNG + GIÁ ĐÁY DƯỚI BARCODE (THEO BẢN THIẾT KẾ CANVA)
    // =========================================================================

    // 1. Dòng nhỏ phía trên: Căn giữa, mở rộng sát mép khung
    const subTextW = safeW - 4;
    const subTextCenterX = safeX + safeW / 2;
    const subTextY = Math.max(safeY + 2, Math.min(safeY + 24, safeY + 11 + subTextOffsetY));

    if (subText) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const subSize = fitText(ctx, subText, subTextW, 15.5, 500, 7);
      ctx.font = `500 ${subSize}px Arial, sans-serif`;
      ctx.fillText(subText, subTextCenterX, subTextY);
    }

    // 2. Thương hiệu xoay dọc bên trái (nằm dưới dòng nhỏ):
    if (hasBrand) {
      ctx.save();
      const brandTopLimit = safeY + 16;
      const brandBottomLimit = safeY + safeH - 2;
      const brandAvailableHeight = brandBottomLimit - brandTopLimit;
      const brandCenterY = brandTopLimit + brandAvailableHeight / 2;

      ctx.translate(safeX + 18, brandCenterY);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const brandSize = fitText(ctx, brandText, brandAvailableHeight - 4, 38, 400, 9);
      ctx.font = `400 ${brandSize}px Arial, sans-serif`;

      let displayText = brandText;
      while (displayText.length > 4 && ctx.measureText(displayText).width > (brandAvailableHeight - 4)) {
        displayText = displayText.slice(0, -1);
      }
      if (displayText !== brandText) displayText = displayText.slice(0, -2) + '..';

      ctx.fillText(displayText, 0, 0);
      ctx.restore();
    }

    // 3. Cụm bên phải: Căn giữa theo trục dọc thiết kế Canva
    const contentX = hasBrand ? safeX + 40 : safeX + 10;
    const contentW = hasBrand ? safeW - 44 : safeW - 20;
    const contentCenterX = contentX + contentW / 2;

    // 3.1 Dòng lớn Tên sản phẩm / Size: In đậm, to rõ, căn giữa
    const productSize = fitText(ctx, data.product, contentW, 35, 700, 9);
    ctx.font = `700 ${productSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(data.product, contentCenterX, safeY + 44);
    const prodW = Math.round(ctx.measureText(data.product).width);

    // 3.2 Barcode ở giữa: Bề ngang khớp bằng bề rộng của dòng Size
    const barcodeH = 44;
    const barcodeY = safeY + 52;
    const barcode = barcodeCanvas(data.barcode, contentW);
    const bcDrawW = Math.min(Math.max(barcode.width, prodW), contentW);
    const bcX = Math.round(contentCenterX - bcDrawW / 2);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(barcode, 0, 0, barcode.width, barcode.height, bcX, barcodeY, bcDrawW, barcodeH);

    // 3.3 Mã số Barcode bên dưới vạch
    ctx.textAlign = 'center';
    ctx.font = '400 18px Arial, sans-serif';
    ctx.fillText(data.barcode, contentCenterX, safeY + 114);

    // 3.4 Giá bán ở DƯỚI CÙNG: Căn giữa, chữ "GIÁ : " thường, số tiền in đậm
    drawPriceLine(ctx, data.price, contentCenterX, safeY + 146, contentW, 26);
  } else if (isTwoLines) {
    // =========================================================================
    // BỐ CỤC 2 DÒNG (GIÁ TRÊN BARCODE)
    // =========================================================================

    // 1. DÒNG NHỎ PHÍA TRÊN:
    // Căn giữa, mở rộng tối đa bề ngang sát mép khung (~260 dots)
    const subTextW = safeW - 4;
    const subTextCenterX = safeX + safeW / 2;
    const subTextY = Math.max(safeY + 2, Math.min(safeY + 24, safeY + 11 + subTextOffsetY));

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const subSize = fitText(ctx, subText, subTextW, 15.5, 500, 7);
    ctx.font = `500 ${subSize}px Arial, sans-serif`;
    ctx.fillText(subText, subTextCenterX, subTextY);

    // 2. THƯƠNG HIỆU XOAY DỌC BÊN TRÁI:
    // Nằm hoàn toàn bên dưới dòng nhỏ (từ safeY + 22 đến safeY + safeH - 4)
    // Canh giữa hoàn hảo trong khoảng chiều cao còn lại bên cạnh dòng lớn + giá + barcode
    if (hasBrand) {
      ctx.save();
      const brandTopLimit = safeY + 16;
      const brandBottomLimit = safeY + safeH - 2;
      const brandAvailableHeight = brandBottomLimit - brandTopLimit;
      const brandCenterY = brandTopLimit + brandAvailableHeight / 2;

      ctx.translate(safeX + 18, brandCenterY);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const brandSize = fitText(ctx, brandText, brandAvailableHeight - 4, 38, 400, 9);
      ctx.font = `400 ${brandSize}px Arial, sans-serif`;

      let displayText = brandText;
      while (displayText.length > 4 && ctx.measureText(displayText).width > (brandAvailableHeight - 4)) {
        displayText = displayText.slice(0, -1);
      }
      if (displayText !== brandText) displayText = displayText.slice(0, -2) + '..';

      ctx.fillText(displayText, 0, 0);
      ctx.restore();
    }

    // 3. CÁC NỘI DUNG DÒNG LỚN, GIÁ, BARCODE: Căn giữa cân đối theo trục dọc
    const contentX = hasBrand ? safeX + 40 : safeX + 10;
    const contentW = hasBrand ? safeW - 44 : safeW - 20;
    const contentCenterX = contentX + contentW / 2;

    // 3.1 Dòng lớn tên sản phẩm chính (Nổi bật, to rõ, căn giữa)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const productSize = fitText(ctx, data.product, contentW, 25, 700, 9);
    ctx.font = `700 ${productSize}px Arial, sans-serif`;
    ctx.fillText(data.product, contentCenterX, safeY + 36);

    // 3.2 Giá bán: Căn giữa, chữ "GIÁ : " thường, số tiền in đậm
    drawPriceLine(ctx, data.price, contentCenterX, safeY + 62, contentW, 26);

    // 3.3 Barcode (Chuẩn Code 128 tỷ lệ 1:1 module nguyên, căn giữa)
    const barcode = barcodeCanvas(data.barcode, contentW);
    const bcDrawW = Math.min(barcode.width, contentW);
    const bcX = Math.round(contentCenterX - bcDrawW / 2);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(barcode, 0, 0, barcode.width, barcode.height, bcX, safeY + 71, bcDrawW, 46);

    // 3.4 Mã số Barcode bên dưới: Căn giữa
    ctx.textAlign = 'center';
    ctx.font = '400 20px Arial, sans-serif';
    ctx.fillText(data.barcode, contentCenterX, safeY + 143);
  } else {
    // =========================================================================
    // BỐ CỤC 1 DÒNG CHUẨN (Option cũ giữ nguyên 100%)
    // =========================================================================
    if (hasBrand) {
      ctx.save();
      const brandTopLimit = safeY + 4;
      const brandBottomLimit = safeY + safeH - 4;
      const brandAvailableHeight = brandBottomLimit - brandTopLimit;
      const brandCenterY = brandTopLimit + brandAvailableHeight / 2;

      ctx.translate(safeX + 18, brandCenterY);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const brandSize = fitText(ctx, brandText, brandAvailableHeight - 4, 38, 400, 9);
      ctx.font = `400 ${brandSize}px Arial, sans-serif`;

      let displayText = brandText;
      while (displayText.length > 4 && ctx.measureText(displayText).width > (brandAvailableHeight - 4)) {
        displayText = displayText.slice(0, -1);
      }
      if (displayText !== brandText) displayText = displayText.slice(0, -2) + '..';

      ctx.fillText(displayText, 0, 0);
      ctx.restore();
    }

    const contentX = hasBrand ? safeX + 40 : safeX + 8;
    const contentW = hasBrand ? safeW - 42 : safeW - 16;
    const contentCenterX = contentX + contentW / 2;

    // 1. Dòng sản phẩm: Căn giữa theo contentCenterX
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const productSize = fitText(ctx, data.product, contentW, 26, 700, 9);
    ctx.font = `700 ${productSize}px Arial, sans-serif`;
    ctx.fillText(data.product, contentCenterX, safeY + 28);

    // 2. Giá bán: Căn giữa theo contentCenterX, chữ "GIÁ : " thường, số tiền in đậm
    drawPriceLine(ctx, data.price, contentCenterX, safeY + 60, contentW, 28);

    // 3. Barcode: Căn giữa theo contentCenterX
    const barcode = barcodeCanvas(data.barcode, contentW);
    const bcDrawW = Math.min(barcode.width, contentW);
    const bcX = Math.round(contentCenterX - bcDrawW / 2);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(barcode, 0, 0, barcode.width, barcode.height, bcX, safeY + 70, bcDrawW, 48);

    // 4. Mã số Barcode bên dưới: Căn giữa theo contentCenterX
    ctx.textAlign = 'center';
    ctx.font = '400 20px Arial, sans-serif';
    ctx.fillText(data.barcode, contentCenterX, safeY + 144);
  }

  ctx.restore();
}

function renderCanvas(canvas, config, data) {
  const scale = MM;
  const width = Math.round(config.paperWidth * scale);   // 76 * 8 = 608 dots
  const height = Math.round(config.labelHeight * scale); // 22 * 8 = 176 dots
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const startX1 = Math.round((config.leftMargin + config.offsetX) * scale);
  const startX2 = Math.round((config.leftMargin + config.offsetX + config.labelWidth + config.columnGap) * scale);
  const startY = Math.round(config.offsetY * scale);

  drawLabel(ctx, startX1, startY, config, data);
  drawLabel(ctx, startX2, startY, config, data);
}

function renderCalibrationCanvas(canvas, config) {
  const scale = MM;
  const width = Math.round(config.paperWidth * scale);
  const height = Math.round(config.labelHeight * scale);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const startX1 = Math.round((config.leftMargin + config.offsetX) * scale);
  const startX2 = Math.round((config.leftMargin + config.offsetX + config.labelWidth + config.columnGap) * scale);
  const startY = Math.round(config.offsetY * scale);

  const frameW = Math.round(config.frameWidth * scale);
  const frameH = Math.round(config.frameHeight * scale);

  ctx.fillStyle = '#000000';
  ctx.lineWidth = config.lineWidth;

  ctx.strokeRect(startX1, startY, frameW, frameH);
  ctx.strokeRect(startX2, startY, frameW, frameH);

  ctx.beginPath();
  ctx.moveTo(startX1 + frameW / 2, startY);
  ctx.lineTo(startX1 + frameW / 2, startY + frameH);
  ctx.moveTo(startX1, startY + frameH / 2);
  ctx.lineTo(startX1 + frameW, startY + frameH / 2);

  ctx.moveTo(startX2 + frameW / 2, startY);
  ctx.lineTo(startX2 + frameW / 2, startY + frameH);
  ctx.moveTo(startX2, startY + frameH / 2);
  ctx.lineTo(startX2 + frameW, startY + frameH / 2);
  ctx.stroke();

  const inset = Math.round(config.inset * scale);
  ctx.strokeStyle = '#98a2b3';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(startX1 + inset, startY + inset, frameW - inset * 2, frameH - inset * 2);
  ctx.strokeRect(startX2 + inset, startY + inset, frameW - inset * 2, frameH - inset * 2);
  ctx.setLineDash([]);
}


function TemplateSingleLabelPreview({ tpl, config, onClick, mini = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = MM;
    const w = 35 * scale;
    const h = 22 * scale;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    drawLabel(
      ctx,
      0,
      0,
      { labelWidth: 35, labelHeight: 22, inset: 1.0, subTextOffsetY: config?.subTextOffsetY !== undefined ? config.subTextOffsetY : -6 },
      {
        brand: tpl.brand || '',
        product: (tpl.product || '').trim() || 'SẢN PHẨM',
        subText: (tpl.subText || '').trim(),
        nameLayout: tpl.nameLayout || (tpl.subText ? 'two_lines' : 'single'),
        price: formatVNCurrency(tpl.price) || '0đ',
        barcode: (tpl.barcode || '').trim() || '0',
      }
    );
  }, [tpl, config?.subTextOffsetY]);

  if (mini) {
    return (
      <div
        className="tpl-mini-label-wrapper"
        onClick={onClick}
        title="Bấm để nạp mẫu này vào bàn in"
      >
        <canvas ref={canvasRef} className="tpl-mini-label-canvas" />
      </div>
    );
  }

  return (
    <div className="tpl-single-label-wrapper" onClick={onClick} title="Bấm để nạp mẫu này vào bàn in">
      <canvas ref={canvasRef} className="tpl-single-label-canvas" />
      <div className="tpl-single-label-tag">
        <span>🔍 Mẫu tem đơn (35×22mm)</span>
      </div>
    </div>
  );
}

function PaginationControls({ total, currentPage, pageSize, onPageChange, onPageSizeChange }) {
  if (total === 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (safePage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (safePage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="pagination-bar">
      <div className="pagination-info">
        Hiển thị <strong>{startIdx + 1} - {endIdx}</strong> trên tổng số <strong>{total}</strong> mẫu
      </div>

      <div className="pagination-actions">
        <div className="pagination-page-size">
          <span>Xem mỗi trang:</span>
          <div className="page-size-btns">
            {[30, 50, 100].map((size) => (
              <button
                key={size}
                type="button"
                className={`btn-size-toggle ${pageSize === size ? 'active' : ''}`}
                onClick={() => onPageSizeChange(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="pagination-nav">
          <button
            type="button"
            className="btn-page-nav"
            disabled={safePage <= 1}
            onClick={() => onPageChange(1)}
            title="Về trang đầu"
          >
            «
          </button>
          <button
            type="button"
            className="btn-page-nav"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            title="Trang trước"
          >
            ‹
          </button>

          {getPageNumbers().map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} className="page-ellipsis">...</span>
            ) : (
              <button
                key={p}
                type="button"
                className={`btn-page-num ${safePage === p ? 'active' : ''}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            className="btn-page-nav"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            title="Trang sau"
          >
            ›
          </button>
          <button
            type="button"
            className="btn-page-nav"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(totalPages)}
            title="Về trang cuối"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {

  const canvasRef = useRef(null);
  const [mode, setMode] = useState('label'); // 'label' | 'templates' | 'calibration'
  
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch (_) {}
    return DEFAULT_CONFIG;
  });

  const [brand, setBrand] = useState(() => {
    try {
      const saved = localStorage.getItem('xprinter_store_brand');
      if (saved !== null) return saved;
    } catch (_) {}
    return 'TIẾN UYÊN';
  });

  const [layoutCache, setLayoutCache] = useState(() => {
    try {
      const saved = localStorage.getItem('tien_uyen_layout_cache_v2');
      if (saved) return { ...LAYOUT_DEFAULTS, ...JSON.parse(saved) };
    } catch (_) {}
    return LAYOUT_DEFAULTS;
  });

  const [nameLayout, setNameLayout] = useState(() => {
    try {
      const saved = localStorage.getItem('tien_uyen_active_layout_v2');
      if (saved && LAYOUT_DEFAULTS[saved]) return saved;
    } catch (_) {}
    return 'two_lines_bottom_price';
  });

  const [product, setProduct] = useState(() => {
    const active = localStorage.getItem('tien_uyen_active_layout_v2') || 'two_lines_bottom_price';
    return (layoutCache[active] || LAYOUT_DEFAULTS[active] || LAYOUT_DEFAULTS.two_lines_bottom_price).product;
  });
  const [subText, setSubText] = useState(() => {
    const active = localStorage.getItem('tien_uyen_active_layout_v2') || 'two_lines_bottom_price';
    return (layoutCache[active] || LAYOUT_DEFAULTS[active] || LAYOUT_DEFAULTS.two_lines_bottom_price).subText;
  });
  const [price, setPrice] = useState(() => {
    const active = localStorage.getItem('tien_uyen_active_layout_v2') || 'two_lines_bottom_price';
    return (layoutCache[active] || LAYOUT_DEFAULTS[active] || LAYOUT_DEFAULTS.two_lines_bottom_price).price;
  });
  const [barcode, setBarcode] = useState(() => {
    const active = localStorage.getItem('tien_uyen_active_layout_v2') || 'two_lines_bottom_price';
    return (layoutCache[active] || LAYOUT_DEFAULTS[active] || LAYOUT_DEFAULTS.two_lines_bottom_price).barcode;
  });

  function updateLayoutField(field, val) {
    setLayoutCache((prev) => {
      const current = prev[nameLayout] || LAYOUT_DEFAULTS[nameLayout];
      const updated = {
        ...prev,
        [nameLayout]: {
          ...current,
          [field]: val,
        },
      };
      try {
        localStorage.setItem('tien_uyen_layout_cache_v2', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  }

  function handleProductChange(val) {
    setProduct(val);
    updateLayoutField('product', val);
  }

  function handleSubTextChange(val) {
    setSubText(val);
    updateLayoutField('subText', val);
  }

  function handlePriceChange(val) {
    setPrice(val);
    updateLayoutField('price', val);
  }

  function handleBarcodeChange(val) {
    setBarcode(val);
    updateLayoutField('barcode', val);
  }

  function handleSwitchLayout(newLayout) {
    if (newLayout === nameLayout) return;
    const currentData = { product, subText, price, barcode };
    const targetData = layoutCache[newLayout] || LAYOUT_DEFAULTS[newLayout];

    setLayoutCache((prev) => {
      const updated = {
        ...prev,
        [nameLayout]: currentData,
      };
      try {
        localStorage.setItem('tien_uyen_layout_cache_v2', JSON.stringify(updated));
        localStorage.setItem('tien_uyen_active_layout_v2', newLayout);
      } catch (_) {}
      return updated;
    });

    setNameLayout(newLayout);
    setProduct(targetData.product);
    setSubText(targetData.subText);
    setPrice(targetData.price);
    setBarcode(targetData.barcode);
    setSelectedTemplateId(null);
  }

  function handleResetCurrentLayout() {
    const d = LAYOUT_DEFAULTS[nameLayout] || LAYOUT_DEFAULTS.two_lines_bottom_price;
    setProduct(d.product);
    setSubText(d.subText);
    setPrice(d.price);
    setBarcode(d.barcode);
    setLayoutCache((prev) => {
      const updated = {
        ...prev,
        [nameLayout]: { ...d },
      };
      try {
        localStorage.setItem('tien_uyen_layout_cache_v2', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
    triggerToast(`↺ Đã nạp lại nội dung mặc định cho ${
      nameLayout === 'single' ? 'Mẫu 1: 1 Dòng (Chuẩn)' : nameLayout === 'two_lines' ? 'Mẫu 2: 2 Dòng (Giá trên)' : 'Mẫu 3: Mẫu Size (Giá đáy)'
    }!`);
  }
  const [copies, setCopies] = useState(1);
  const [showOffset, setShowOffset] = useState(false);
  const [showOffsetModal, setShowOffsetModal] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [globalToast, setGlobalToast] = useState('');
  const [status, setStatus] = useState({ kind: 'idle', text: 'Đang kiểm tra máy in…' });

  // Template states
  const [templates, setTemplates] = useState([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [templateFolder, setTemplateFolder] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [copiedFolder, setCopiedFolder] = useState(false);
  const [filterDuplicatesOnly, setFilterDuplicatesOnly] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState(false);

  // Chế độ hiển thị, số cột, sắp xếp và phân trang kho mẫu
  const [catalogViewMode, setCatalogViewMode] = useState('grid'); // 'grid' | 'list'
  const [gridCols, setGridCols] = useState(3); // 3 | 6
  const [templateSortBy, setTemplateSortBy] = useState('name_asc'); // 'name_asc' | 'name_desc' | 'updated_desc' | 'updated_asc'
  const [templatePageSize, setTemplatePageSize] = useState(30); // 30 | 50 | 100
  const [templateCurrentPage, setTemplateCurrentPage] = useState(1);

  // Phân nhóm và phát hiện mẫu trùng lặp theo Tên sản phẩm + Mã vạch
  const duplicateGroups = useMemo(() => {
    const map = new Map();
    templates.forEach((t) => {
      const prodKey = (t.product || t.name || '').trim().toLowerCase();
      const barKey = (t.barcode || '').trim().toLowerCase();
      const key = `${prodKey}____${barKey}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(t);
    });

    const groups = [];
    for (const [key, items] of map.entries()) {
      if (items.length > 1) {
        // Sắp xếp bản cũ nhất hoặc bản mẫu chuẩn gốc lên đầu (Index 0)
        const sorted = [...items].sort((a, b) => {
          if (a.id.includes('mau_') && !b.id.includes('mau_')) return -1;
          if (!a.id.includes('mau_') && b.id.includes('mau_')) return 1;
          return (a.updatedAt || a.id).localeCompare(b.updatedAt || b.id);
        });
        groups.push({
          key,
          label: sorted[0].product || sorted[0].name || 'Sản phẩm',
          barcode: sorted[0].barcode || 'Không barcode',
          items: sorted,
        });
      }
    }
    return groups;
  }, [templates]);

  const totalRedundantCount = useMemo(() => {
    return duplicateGroups.reduce((sum, g) => sum + (g.items.length - 1), 0);
  }, [duplicateGroups]);

  const allRedundantIds = useMemo(() => {
    const ids = [];
    duplicateGroups.forEach((g) => {
      for (let i = 1; i < g.items.length; i++) {
        ids.push(g.items[i].id);
      }
    });
    return ids;
  }, [duplicateGroups]);

  const data = {
    brand: brand,
    product: product.trim() || 'SẢN PHẨM',
    subText: subText.trim(),
    nameLayout: nameLayout,
    price: formatVNCurrency(price) || '0đ',
    barcode: barcode.trim() || '0',
  };

  function triggerToast(msg) {
    setGlobalToast(msg);
    setTimeout(() => setGlobalToast(''), 3500);
  }

  async function loadTemplates() {
    try {
      const res = await fetch('/api/templates');
      const json = await res.json();
      if (json.ok && Array.isArray(json.templates)) {
        setTemplates(json.templates);
      }
      if (json.folder) {
        setTemplateFolder(json.folder);
      }
    } catch (_) {}
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function triggerOpenFolder() {
    if (templateFolder) {
      try {
        navigator.clipboard.writeText(templateFolder);
      } catch (_) {}
    }
    triggerToast('⏳ Đang gọi mở File Explorer...');
    try {
      const res = await fetch('/api/templates/open-folder', { method: 'POST' });
      const json = await res.json();
      if (json.folder) {
        setTemplateFolder(json.folder);
        try {
          navigator.clipboard.writeText(json.folder);
        } catch (_) {}
      }
      if (json.ok && json.opened) {
        triggerToast('📂 File Explorer đã được mở thành công!');
      } else {
        triggerToast('⚠️ Hãy dùng Windows + E và dán đường dẫn');
      }
    } catch (e) {
      triggerToast('❌ Lỗi kết nối: ' + e.message);
    }
  }

  async function handleOpenTemplateFolder() {
    setShowFolderModal(true);
    triggerOpenFolder();
  }

  function handleCopyFolderPath() {
    if (!templateFolder) return;
    navigator.clipboard.writeText(templateFolder);
    setCopiedFolder(true);
    triggerToast('📋 Đã sao chép đường dẫn thư mục vào Clipboard!');
    setTimeout(() => setCopiedFolder(false), 3000);
  }

  async function handleSaveCurrentAsTemplate() {
    const name = templateNameInput.trim() || product.trim() || 'Mẫu tem mới';
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          brand: brand,
          product: product,
          subText: subText,
          nameLayout: nameLayout,
          price: formatVNCurrency(price) || '0₫',
          barcode: barcode,
          copies: copies,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setShowSaveModal(false);
        triggerToast(`✓ Đã lưu mẫu "${name}" vào kho!`);
        loadTemplates();
      } else {
        alert('Lỗi lưu mẫu: ' + json.message);
      }
    } catch (e) {
      alert('Lỗi kết nối: ' + e.message);
    }
  }

  async function handleSaveEditedTemplate() {
    if (!editFormData) return;
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editFormData,
          price: formatVNCurrency(editFormData.price) || '0₫',
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setShowEditModal(false);
        setEditFormData(null);
        triggerToast(`✓ Đã cập nhật mẫu "${editFormData.name}"!`);
        loadTemplates();
      } else {
        alert('Lỗi cập nhật: ' + json.message);
      }
    } catch (e) {
      alert('Lỗi kết nối: ' + e.message);
    }
  }

  async function handleDeleteTemplate(id, name) {
    if (!window.confirm(`Bạn có chắc muốn xóa mẫu "${name}" không?`)) return;
    try {
      const res = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.ok) {
        triggerToast(`🗑 Đã xóa mẫu "${name}"!`);
        if (selectedTemplateId === id) setSelectedTemplateId(null);
        loadTemplates();
      } else {
        alert('Lỗi xóa: ' + json.message);
      }
    } catch (e) {
      alert('Lỗi: ' + e.message);
    }
  }

  async function handleDeleteAllDuplicates() {
    if (allRedundantIds.length === 0) {
      triggerToast('ℹ️ Không có mẫu trùng nào cần xóa.');
      return;
    }

    const ok = window.confirm(
      `XÁC NHẬN XÓA TẤT CẢ BẢN TRÙNG THỪA?\n\n- Tìm thấy: ${duplicateGroups.length} nhóm mẫu bị trùng.\n- Số file trùng thừa sẽ xóa: ${allRedundantIds.length} file.\n- Hệ thống sẽ chỉ giữ lại 1 bản gốc duy nhất (viền xanh) cho mỗi nhóm và xóa sạch toàn bộ các bản viền đỏ trên ổ cứng.\n\nBấm OK để tiến hành xóa ngay!`
    );
    if (!ok) return;

    setDeletingBatch(true);
    triggerToast('⏳ Đang xóa toàn bộ các bản trùng thừa...');
    try {
      const res = await fetch('/api/templates/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: allRedundantIds }),
      });
      const json = await res.json();
      if (json.ok) {
        triggerToast(`✅ Đã xóa thành công ${json.count} mẫu trùng thừa!`);
        await loadTemplates();
        setFilterDuplicatesOnly(false);
      } else {
        alert('Lỗi: ' + json.message);
      }
    } catch (e) {
      alert('Lỗi kết nối: ' + e.message);
    } finally {
      setDeletingBatch(false);
    }
  }

  function applyTemplateToPrint(tpl) {
    if (tpl.brand !== undefined) setBrand(tpl.brand);
    if (tpl.product) setProduct(tpl.product);
    setSubText(tpl.subText || '');
    setNameLayout(tpl.nameLayout || (tpl.subText ? 'two_lines' : 'single'));
    if (tpl.price) setPrice(formatPriceNumber(tpl.price));
    if (tpl.barcode) setBarcode(tpl.barcode);
    if (tpl.copies) setCopies(tpl.copies);
    setSelectedTemplateId(tpl.id);
    setMode('label');
    triggerToast(`✓ Đã nạp mẫu "${tpl.name}" vào bàn in!`);
  }

  function handleSaveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      localStorage.setItem('xprinter_store_brand', brand);
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch (_) {}
  }

  function resetDefaultConfig() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('tien_uyen_printer_config_v8');
      localStorage.removeItem('xprinter_store_brand');
      localStorage.removeItem('tien_uyen_layout_cache_v2');
      localStorage.removeItem('tien_uyen_active_layout_v2');
    } catch (_) {}
    setConfig(DEFAULT_CONFIG);
    setBrand('TIẾN UYÊN');
    setNameLayout('two_lines_bottom_price');
    const d3 = LAYOUT_DEFAULTS.two_lines_bottom_price;
    setProduct(d3.product);
    setSubText(d3.subText);
    setPrice(d3.price);
    setBarcode(d3.barcode);
    setLayoutCache(LAYOUT_DEFAULTS);
    triggerToast('↺ Đã khôi phục cài đặt gốc & nạp Mẫu 3: Mẫu Size (Giá đáy)!');
  }

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (_) {}
  }, [config]);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (mode === 'calibration') renderCalibrationCanvas(canvasRef.current, config);
    else renderCanvas(canvasRef.current, config, data);
  }, [brand, product, subText, nameLayout, price, barcode, mode, config]);

  useEffect(() => {
    fetch('/api/status')
      .then((response) => response.json())
      .then((result) => setStatus({ kind: result.ready ? 'ok' : 'error', text: result.message }))
      .catch(() => setStatus({ kind: 'error', text: 'Local print agent chưa chạy' }));
  }, []);

  async function printLabels(customCopies = null) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStatus({ kind: 'busy', text: 'Đang gửi lệnh in…' });
    try {
      const response = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: canvas.toDataURL('image/png'),
          copies: Number(customCopies !== null ? customCopies : copies) || 1,
          settings: {
            paperWidth: config.paperWidth,
            paperHeight: config.labelHeight,
            gap: config.gap,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || 'Lỗi in ấn');
      setStatus({ kind: 'ok', text: result.message || 'Đã gửi lệnh in tới XP-350B' });
      triggerToast('✓ Đã gửi lệnh in thành công tới máy in XP-350B!');
    } catch (error) {
      setStatus({ kind: 'error', text: error.message });
      alert('Lỗi in ấn: ' + error.message);
    }
  }

  // Tự động chuyển về trang 1 khi thay đổi tìm kiếm, sort, kích thước trang hoặc bộ lọc
  useEffect(() => {
    setTemplateCurrentPage(1);
  }, [templateSearch, templateSortBy, templatePageSize, filterDuplicatesOnly]);

  const handlePageChange = (page) => {
    setTemplateCurrentPage(page);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // Lọc và sắp xếp danh sách mẫu theo từ khóa tìm kiếm và tùy chọn sort
  const sortedTemplates = useMemo(() => {
    const q = templateSearch.toLowerCase().trim();
    const list = templates.filter((tpl) => {
      if (!q) return true;
      return (
        (tpl.name || '').toLowerCase().includes(q) ||
        (tpl.product || '').toLowerCase().includes(q) ||
        (tpl.barcode || '').toLowerCase().includes(q) ||
        (tpl.brand || '').toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (templateSortBy === 'name_asc') {
        const nameA = (a.product || a.name || '').trim();
        const nameB = (b.product || b.name || '').trim();
        return nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
      }
      if (templateSortBy === 'name_desc') {
        const nameA = (a.product || a.name || '').trim();
        const nameB = (b.product || b.name || '').trim();
        return nameB.localeCompare(nameA, 'vi', { sensitivity: 'base' });
      }
      if (templateSortBy === 'updated_desc') {
        return (b.updatedAt || b.id || '').localeCompare(a.updatedAt || a.id || '');
      }
      if (templateSortBy === 'updated_asc') {
        return (a.updatedAt || a.id || '').localeCompare(b.updatedAt || b.id || '');
      }
      return 0;
    });
  }, [templates, templateSearch, templateSortBy]);

  // Phân trang danh sách mẫu thông thường
  const totalTemplatePages = Math.max(1, Math.ceil(sortedTemplates.length / templatePageSize));
  const safeCurrentPage = Math.min(Math.max(1, templateCurrentPage), totalTemplatePages);
  const pagedTemplates = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * templatePageSize;
    return sortedTemplates.slice(startIdx, startIdx + templatePageSize);
  }, [sortedTemplates, safeCurrentPage, templatePageSize]);

  // Sắp xếp và phân trang nhóm trùng lặp khi lọc trùng
  const sortedDuplicateGroups = useMemo(() => {
    return [...duplicateGroups].sort((a, b) => {
      if (templateSortBy === 'name_asc') {
        return (a.label || '').localeCompare(b.label || '', 'vi', { sensitivity: 'base' });
      }
      if (templateSortBy === 'name_desc') {
        return (b.label || '').localeCompare(a.label || '', 'vi', { sensitivity: 'base' });
      }
      return 0;
    });
  }, [duplicateGroups, templateSortBy]);

  const totalDuplicatePages = Math.max(1, Math.ceil(sortedDuplicateGroups.length / templatePageSize));
  const safeDuplicatePage = Math.min(Math.max(1, templateCurrentPage), totalDuplicatePages);
  const pagedDuplicateGroups = useMemo(() => {
    const startIdx = (safeDuplicatePage - 1) * templatePageSize;
    return sortedDuplicateGroups.slice(startIdx, startIdx + templatePageSize);
  }, [sortedDuplicateGroups, safeDuplicatePage, templatePageSize]);

  const activeTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="app-layout">
      {/* Toast Notification */}
      {globalToast && (
        <div className="app-toast">
          <span>✓</span>
          <span>{globalToast}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="app-header">
        <div className="header-container">
          <div className="brand-group">
            <div className="brand-icon">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </div>
            <div>
              <div className="brand-title-wrap">
                <span className="brand-title">In Tem Sản Phẩm 2 Hàng</span>
                <span className="badge-tag">XP-350B</span>
              </div>
              <div className="status-indicator">
                <span className={`status-dot ${status.kind === 'error' ? 'error' : status.kind === 'busy' ? 'busy' : ''}`} />
                <span>{status.text || 'Khổ 76mm · Sẵn sàng in'}</span>
              </div>
            </div>
          </div>

          {/* Navigation Pill Tabs */}
          <nav className="nav-tabs">
            <button
              type="button"
              className={`nav-tab-btn ${mode === 'label' ? 'active' : ''}`}
              onClick={() => setMode('label')}
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h10M7 11h10M7 15h6" />
              </svg>
              <span>Bàn In Tem</span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${mode === 'templates' ? 'active' : ''}`}
              onClick={() => setMode('templates')}
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Kho Mẫu Sản Phẩm</span>
              <span className="tab-badge">{templates.length}</span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${mode === 'calibration' ? 'active' : ''}`}
              onClick={() => setMode('calibration')}
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Căn Chỉnh Máy</span>
            </button>
          </nav>

          {/* Quick folder action */}
          <div className="header-actions">
            <button
              type="button"
              className="btn-subtle"
              onClick={handleOpenTemplateFolder}
              title="Mở thư mục lưu file .json trên máy tính"
            >
              <svg width="15" height="15" style={{ color: '#d97706' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>Thư Mục Mẫu</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN BODY VIEW */}
      <main className="main-content">
        {/* ============================================================== */}
        {/* TAB 1: BÀN IN TEM                                             */}
        {/* ============================================================== */}
        {mode === 'label' && (
          <div>
            {/* Quick Template Switcher Strip */}
            <div className="quick-template-bar">
              <div className="quick-tpl-left">
                <div className="quick-tpl-icon">⚡</div>
                <div>
                  <div className="quick-tpl-label">Mẫu sản phẩm đang chọn</div>
                  <div className="quick-tpl-name">
                    {activeTemplate ? activeTemplate.name : product || 'Chưa lưu mẫu'}
                  </div>
                </div>
              </div>

              <div className="quick-tpl-actions">
                <select
                  className="tpl-select"
                  value={selectedTemplateId || ''}
                  onChange={(e) => {
                    const found = templates.find((t) => t.id === e.target.value);
                    if (found) applyTemplateToPrint(found);
                  }}
                >
                  <option value="" disabled>-- Chọn mẫu nhanh --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                <button
                  type="button"
                  className="btn-subtle"
                  onClick={() => setMode('templates')}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  <span>Mở kho mẫu</span>
                </button>

                <button
                  type="button"
                  className="btn-subtle"
                  style={{ color: '#059669', borderColor: '#a7f3d0', background: '#ecfdf5' }}
                  onClick={() => {
                    setTemplateNameInput(product);
                    setShowSaveModal(true);
                  }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  <span>Lưu thành mẫu mới</span>
                </button>
              </div>
            </div>

            {/* Main 2-column Print Area */}
            <div className="print-workspace-grid">
              {/* Form Input Panel */}
              <div className="panel-card">
                <div className="panel-header">
                  <span className="panel-title">Thông Tin Con Tem</span>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={handleResetCurrentLayout}
                  >
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Điền lại mặc định</span>
                  </button>
                </div>

                {/* Brand input */}
                <div className="form-group">
                  <div className="form-label-row">
                    <label className="form-label">Tên thương hiệu / Cửa hàng</label>
                    <span className="form-hint">Tự động co chữ vừa khung</span>
                  </div>
                  <input
                    type="text"
                    className="form-control"
                    value={brand}
                    onChange={(e) => {
                      setBrand(e.target.value);
                      try { localStorage.setItem('xprinter_store_brand', e.target.value); } catch (_) {}
                    }}
                    placeholder="VD: TIẾN UYÊN (hoặc để trống)"
                    maxLength={40}
                  />
                </div>

                {/* Chế độ bố cục tem: Mẫu 1 (1 dòng chuẩn) vs Mẫu 2 (2 dòng giá trên) vs Mẫu 3 (Mẫu size giá đáy) */}
                <div className="form-group">
                  <div className="layout-toggle-pill">
                    <button
                      type="button"
                      className={`btn-layout-pill ${nameLayout === 'single' ? 'active' : ''}`}
                      onClick={() => handleSwitchLayout('single')}
                    >
                      <span>Mẫu 1: 1 Dòng</span>
                    </button>
                    <button
                      type="button"
                      className={`btn-layout-pill ${nameLayout === 'two_lines' ? 'active' : ''}`}
                      onClick={() => handleSwitchLayout('two_lines')}
                    >
                      <span>Mẫu 2: 2 Dòng</span>
                    </button>
                    <button
                      type="button"
                      className={`btn-layout-pill ${nameLayout === 'two_lines_bottom_price' ? 'active' : ''}`}
                      onClick={() => handleSwitchLayout('two_lines_bottom_price')}
                    >
                      <span>Mẫu 3: Mẫu Size</span>
                    </button>
                  </div>
                </div>

                {nameLayout === 'two_lines' || nameLayout === 'two_lines_bottom_price' ? (
                  <>
                    {/* Dòng nhỏ phía trên (subText) - Gọn gàng, kèm nút bánh răng mở popup */}
                    <div className="form-group">
                      <div className="form-label-row">
                        <label className="form-label" style={{ color: '#0284c7' }}>
                          Dòng nhỏ phía trên (Mô tả chi tiết)
                        </label>
                        <button
                          type="button"
                          className="btn-link"
                          style={{ fontSize: '11px', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '3px' }}
                          onClick={() => setShowOffsetModal(true)}
                          title="Bấm để mở popup căn chỉnh vị trí & lề in"
                        >
                          <span>⚙️ Căn lề Setting</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        className="form-control"
                        value={subText}
                        onChange={(e) => handleSubTextChange(e.target.value)}
                        placeholder="VD: Túi Đeo Chéo Nhí 041 - dây kéo giữa"
                        maxLength={120}
                        style={{ borderColor: '#7dd3fc', background: '#f0f9ff' }}
                      />
                    </div>

                    {/* Dòng lớn chính (product) hoặc Size */}
                    <div className="form-group">
                      <div className="form-label-row">
                        <label className="form-label" style={{ color: '#1d4ed8' }}>
                          {nameLayout === 'two_lines_bottom_price' ? 'Tên sản phẩm / Size nổi bật' : 'Dòng lớn chính (Tên nổi bật)'}
                        </label>
                        <span className="form-hint">
                          {nameLayout === 'two_lines_bottom_price' ? 'VD: Size 25x22x10 · Căn giữa to rõ' : '~15 ký tự · Chữ lớn in đậm rõ nét'}
                        </span>
                      </div>
                      <input
                        type="text"
                        className="form-control"
                        value={product}
                        onChange={(e) => handleProductChange(e.target.value)}
                        placeholder={nameLayout === 'two_lines_bottom_price' ? 'VD: Size 25x22x10' : 'VD: TRỐNG BÔNG 0315 hoặc Đeo Chéo Nhí'}
                        maxLength={32}
                        style={{ fontWeight: 700, borderColor: '#93c5fd' }}
                      />
                    </div>
                  </>
                ) : (
                  /* 1 Dòng Chuẩn */
                  <div className="form-group">
                    <div className="form-label-row">
                      <label className="form-label">Tên sản phẩm in trên tem</label>
                      <button
                        type="button"
                        className="btn-link"
                        style={{ fontSize: '11px', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '3px' }}
                        onClick={() => setShowOffsetModal(true)}
                        title="Bấm để mở popup căn chỉnh vị trí & lề in"
                      >
                        <span>⚙️ Căn lề Setting</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      className="form-control"
                      value={product}
                      onChange={(e) => handleProductChange(e.target.value)}
                      placeholder="Nhập tên sản phẩm..."
                      maxLength={42}
                    />
                  </div>
                )}

                {/* Price & Barcode in grid */}
                <div className="form-row-2 form-group">
                  <div>
                    <label className="form-label">Giá bán</label>
                    <div className="input-with-suffix">
                      <input
                        type="text"
                        className="form-control"
                        value={price}
                        onChange={(e) => handlePriceChange(formatPriceNumber(e.target.value, price))}
                        placeholder="1,000,000"
                        maxLength={18}
                      />
                      <span className="input-suffix-badge">₫</span>
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Mã barcode (CODE128)</label>
                    <input
                      type="text"
                      className="form-control mono"
                      value={barcode}
                      onChange={(e) => handleBarcodeChange(e.target.value.replace(/[^0-9A-Za-z._-]/g, ''))}
                      placeholder="893751041"
                      maxLength={32}
                    />
                  </div>
                </div>

                {/* Copies Counter & Quick Presets */}
                <div className="form-group" style={{ paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                  <div className="form-label-row">
                    <label className="form-label">Số hàng tem cần in</label>
                    <span className="badge-tag" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                      {copies} hàng = {copies * 2} con tem
                    </span>
                  </div>

                  <div className="copies-box">
                    <button
                      type="button"
                      className="btn-step"
                      onClick={() => setCopies(Math.max(1, (Number(copies) || 1) - 1))}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      className="copies-input"
                      value={copies}
                      onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    <button
                      type="button"
                      className="btn-step"
                      onClick={() => setCopies((Number(copies) || 1) + 1)}
                    >
                      +
                    </button>

                    <button type="button" className="btn-preset" onClick={() => setCopies((Number(copies) || 0) + 5)}>+5</button>
                    <button type="button" className="btn-preset" onClick={() => setCopies((Number(copies) || 0) + 10)}>+10</button>
                    <button type="button" className="btn-preset" onClick={() => setCopies((Number(copies) || 0) + 50)}>+50</button>
                  </div>
                </div>

                {/* Big Print Button */}
                <button
                  type="button"
                  className="btn-primary-print"
                  disabled={status.kind === 'busy'}
                  onClick={() => printLabels()}
                >
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>{status.kind === 'busy' ? 'Đang gửi lệnh in TSPL...' : 'In Nhiệt Ngay (TSPL RAW)'}</span>
                </button>
                <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                  Lệnh in truyền trực tiếp đến winspool máy in XP-350B không cần qua hộp thoại
                </div>
              </div>

              {/* Right Canvas Preview Panel */}
              <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="panel-header" style={{ width: '100%' }}>
                  <span className="panel-title">Xem Trước Decal Cuộn Thực Tế (1:1)</span>
                  <span className="tab-badge" style={{ background: '#f1f5f9', color: '#475467' }}>
                    Khổ 76mm × 22mm · 2 tem
                  </span>
                </div>

                <div className="preview-canvas-box" style={{ width: '100%' }}>
                  <div className="canvas-wrapper">
                    <canvas ref={canvasRef} />
                  </div>

                  <div className="preview-tags-row">
                    <span><i className="preview-tag-dot" style={{ background: '#3b82f6' }}></i> Tem Trái: 35×22mm</span>
                    <span><i className="preview-tag-dot" style={{ background: '#f59e0b' }}></i> Khe rãnh: {config.columnGap}mm</span>
                    <span><i className="preview-tag-dot" style={{ background: '#6366f1' }}></i> Tem Phải: 35×22mm</span>
                  </div>
                </div>

                <div style={{ width: '100%', marginTop: '16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '12px', fontSize: '12px', color: '#1e40af', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span>💡</span>
                  <div>
                    <strong>Mẹo thao tác:</strong> Bạn có thể lưu các sản phẩm hay in vào <strong>Kho mẫu</strong> để lần sau chỉ cần chọn từ thanh menu trên là in ngay, không cần gõ lại giá hay mã vạch.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: KHO MẪU SẢN PHẨM (Spacious Modern Catalog Grid)          */}
        {/* ============================================================== */}
        {/* ============================================================== */}
        {/* TAB 2: KHO MẪU SẢN PHẨM (Grid 3/6 cols, List view, Sort & Pagination) */}
        {/* ============================================================== */}
        {mode === 'templates' && (
          <div>
            {/* Catalog Toolbar with stable 2-Row Layout (Never shifts or jumps) */}
            <div className="catalog-toolbar">
              {/* ROW 1: Search and Primary Actions */}
              <div className="catalog-toolbar-row1">
                <div className="search-wrap">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Tìm kiếm theo tên sản phẩm, mã barcode, giá..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                  />
                </div>

                <div className="catalog-toolbar-actions">
                  <button
                    type="button"
                    className={`btn-subtle ${filterDuplicatesOnly ? 'active-filter' : ''}`}
                    style={filterDuplicatesOnly ? { background: '#fee2e2', borderColor: '#f87171', color: '#b91c1c', fontWeight: 700 } : {}}
                    onClick={() => setFilterDuplicatesOnly(!filterDuplicatesOnly)}
                    title="Tìm và hiển thị toàn bộ các mẫu bị trùng lặp"
                  >
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Lọc Trùng</span>
                    {totalRedundantCount > 0 ? (
                      <span className="tab-badge" style={{ background: '#ef4444', color: '#fff', marginLeft: '6px', fontWeight: 700 }}>
                        {totalRedundantCount}
                      </span>
                    ) : (
                      <span className="tab-badge" style={{ background: '#f1f5f9', color: '#64748b', marginLeft: '6px' }}>
                        0
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn-subtle"
                    onClick={handleOpenTemplateFolder}
                  >
                    <svg width="15" height="15" style={{ color: '#d97706' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span>Thư mục file .json</span>
                  </button>

                  <button
                    type="button"
                    className="btn-subtle"
                    onClick={loadTemplates}
                    title="Tải lại danh sách"
                  >
                    <span>↺ Tải lại</span>
                  </button>

                  <button
                    type="button"
                    className="btn-primary-print"
                    style={{ width: 'auto', padding: '8px 16px', margin: 0, fontSize: '13px' }}
                    onClick={() => {
                      setEditFormData({
                        id: '',
                        name: '',
                        brand: brand,
                        product: '',
                        subText: '',
                        nameLayout: 'single',
                        price: '',
                        barcode: '',
                        copies: 1,
                      });
                      setShowEditModal(true);
                    }}
                  >
                    <span>➕ Thêm Mẫu Mới</span>
                  </button>
                </div>
              </div>

              {/* ROW 2: Sort, View Modes, Columns, and Page Size */}
              <div className="catalog-toolbar-row2">
                <div className="catalog-row2-left">
                  {/* Sort Selector */}
                  <div className="sort-selector-wrap" title="Sắp xếp danh sách mẫu">
                    <span className="sort-label">⇅ Sắp xếp:</span>
                    <select
                      className="sort-select"
                      value={templateSortBy}
                      onChange={(e) => setTemplateSortBy(e.target.value)}
                    >
                      <option value="name_asc">Tên (A → Z)</option>
                      <option value="name_desc">Tên (Z → A)</option>
                      <option value="updated_desc">Mới lưu gần đây</option>
                      <option value="updated_asc">Lưu cũ nhất</option>
                    </select>
                  </div>

                  <div className="toolbar-divider" />

                  {/* View Mode: Grid vs List */}
                  <div className="view-mode-toggle-group">
                    <button
                      type="button"
                      className={`btn-view-toggle ${catalogViewMode === 'grid' ? 'active' : ''}`}
                      onClick={() => setCatalogViewMode('grid')}
                      title="Chế độ xem dạng lưới (Grid)"
                    >
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      <span>Lưới</span>
                    </button>

                    <button
                      type="button"
                      className={`btn-view-toggle ${catalogViewMode === 'list' ? 'active' : ''}`}
                      onClick={() => setCatalogViewMode('list')}
                      title="Chế độ xem danh sách hàng ngang (List)"
                    >
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      <span>Danh sách</span>
                    </button>
                  </div>

                  {/* Grid Column Selector: 3 mẫu/hàng vs 6 mẫu/hàng (Always positioned right after Lưới) */}
                  {catalogViewMode === 'grid' && (
                    <div className="grid-cols-pill">
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, padding: '0 4px' }}>Cột:</span>
                      <button
                        type="button"
                        className={`btn-grid-col ${gridCols === 3 ? 'active' : ''}`}
                        onClick={() => setGridCols(3)}
                        title="Xem 3 mẫu / 1 hàng (Mẫu lớn chi tiết)"
                      >
                        3 mẫu/hàng
                      </button>
                      <button
                        type="button"
                        className={`btn-grid-col ${gridCols === 6 ? 'active' : ''}`}
                        onClick={() => setGridCols(6)}
                        title="Xem 6 mẫu / 1 hàng (Gọn gàng, bao quát)"
                      >
                        6 mẫu/hàng
                      </button>
                    </div>
                  )}
                </div>

                <div className="catalog-row2-right">
                  <div className="pagination-page-size">
                    <span>Xem mỗi trang:</span>
                    <div className="page-size-btns">
                      {[30, 50, 100].map((size) => (
                        <button
                          key={size}
                          type="button"
                          className={`btn-size-toggle ${templatePageSize === size ? 'active' : ''}`}
                          onClick={() => setTemplatePageSize(size)}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <span className="catalog-count-pill">
                    Tổng số: <strong>{filterDuplicatesOnly ? sortedDuplicateGroups.length : sortedTemplates.length}</strong> {filterDuplicatesOnly ? 'nhóm' : 'mẫu'}
                  </span>
                </div>
              </div>
            </div>

            {/* Offline File Sharing Info Banner with full folder path & copy button */}
            <div className="info-banner" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>ℹ️</span>
                <div>
                  <strong>Cơ chế lưu trữ Offline & Chia sẻ đa máy:</strong> Mọi mẫu tem được lưu thành file chuẩn <code style={{ background: '#fef3c7', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 600 }}>.json</code> trên ổ cứng. Khi cần gửi cho máy nhân viên, bạn chỉ cần copy các file này qua Zalo/USB và dán vào thư mục mẫu của máy nhân viên là phần mềm sẽ tự nhận diện.
                </div>
              </div>

              {templateFolder && (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', background: '#ffffff', border: '1px solid #fed7aa', borderRadius: '8px', padding: '8px 12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#9a3412', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    📁 Đường dẫn thư mục:
                  </span>
                  <code style={{ fontSize: '12px', color: '#1e293b', background: '#f8fafc', padding: '3px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', flex: 1, minWidth: '220px', wordBreak: 'break-all', userSelect: 'all' }}>
                    {templateFolder}
                  </code>
                  <button
                    type="button"
                    className="btn-subtle"
                    style={{ padding: '4px 10px', fontSize: '12px', background: copiedFolder ? '#dcfce7' : '#fff', color: copiedFolder ? '#15803d' : '#1e293b', borderColor: copiedFolder ? '#86efac' : '#cbd5e1' }}
                    onClick={handleCopyFolderPath}
                  >
                    {copiedFolder ? '✓ Đã sao chép' : '📋 Sao chép đường dẫn'}
                  </button>
                  <button
                    type="button"
                    className="btn-subtle"
                    style={{ padding: '4px 10px', fontSize: '12px', background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}
                    onClick={handleOpenTemplateFolder}
                  >
                    📂 Mở File Explorer
                  </button>
                </div>
              )}
            </div>

            {/* When filterDuplicatesOnly is active */}
            {filterDuplicatesOnly ? (
              <div>
                <div className="duplicate-alert-banner">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '26px' }}>⚠️</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: '#991b1b' }}>
                        Phát hiện {duplicateGroups.length} nhóm mẫu trùng lặp ({totalRedundantCount} bản trùng thừa)
                      </div>
                      <div style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '3px' }}>
                        Mỗi nhóm giữ lại 1 bản gốc duy nhất (<span style={{ color: '#15803d', fontWeight: 700 }}>viền xanh lá</span>). Các bản trùng thừa (<span style={{ color: '#b91c1c', fontWeight: 700 }}>viền đỏ</span>) có thể bấm xóa cùng lúc.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {totalRedundantCount > 0 && (
                      <button
                        type="button"
                        className="btn-danger-bulk"
                        disabled={deletingBatch}
                        onClick={handleDeleteAllDuplicates}
                      >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>{deletingBatch ? 'Đang xóa...' : `Xóa Tất Cả ${totalRedundantCount} Mẫu Trùng`}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-subtle"
                      onClick={() => setFilterDuplicatesOnly(false)}
                    >
                      <span>✕ Xem Toàn Bộ Kho</span>
                    </button>
                  </div>
                </div>

                {/* Pagination bar for duplicate groups */}
                <PaginationControls
                  total={sortedDuplicateGroups.length}
                  currentPage={safeDuplicatePage}
                  pageSize={templatePageSize}
                  onPageChange={handlePageChange}
                  onPageSizeChange={setTemplatePageSize}
                />

                {sortedDuplicateGroups.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 20px', background: '#fff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                    <p style={{ color: '#10b981', fontSize: '18px', fontWeight: 700, margin: 0 }}>
                      🎉 Tuyệt vời! Kho mẫu của bạn không có mẫu nào bị trùng lặp.
                    </p>
                    <p style={{ color: '#64748b', fontSize: '13px', marginTop: '6px' }}>
                      Tất cả sản phẩm và barcode đều độc nhất.
                    </p>
                    <button
                      type="button"
                      className="btn-subtle"
                      style={{ margin: '14px auto 0' }}
                      onClick={() => setFilterDuplicatesOnly(false)}
                    >
                      Quay lại xem toàn bộ kho mẫu
                    </button>
                  </div>
                ) : (
                  <div>
                    {pagedDuplicateGroups.map((group, gIdx) => (
                      <div key={group.key} className="duplicate-group-box">
                        <div className="duplicate-group-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '16px' }}>🏷️</span>
                            <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                              Nhóm #{(safeDuplicatePage - 1) * templatePageSize + gIdx + 1}: {group.label}
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', background: '#e2e8f0', padding: '2px 8px', borderRadius: '4px' }}>
                              Mã vạch: {group.barcode}
                            </span>
                          </div>

                          <span className="tab-badge" style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>
                            {group.items.length} bản lưu (1 bản gốc + {group.items.length - 1} bản trùng thừa)
                          </span>
                        </div>

                        {/* Duplicate Items: Render in Grid or List mode */}
                        {catalogViewMode === 'grid' ? (
                          <div className={`catalog-grid cols-${gridCols}`}>
                            {group.items.map((tpl, idx) => {
                              const isKeep = idx === 0;
                              return (
                                <div
                                  key={tpl.id}
                                  className={`template-card ${isKeep ? 'card-duplicate-keep' : 'card-duplicate-remove'}`}
                                >
                                  <div>
                                    <div className="tpl-card-top">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                        {isKeep ? (
                                          <span className="badge-duplicate-keep">
                                            ✅ BẢN GỐC GIỮ LẠI
                                          </span>
                                        ) : (
                                          <span className="badge-duplicate-remove">
                                            ⚠️ BẢN TRÙNG THỪA
                                          </span>
                                        )}
                                        <h3 className="tpl-card-title" style={{ margin: 0 }}>{tpl.name}</h3>
                                      </div>
                                      <span className="tpl-copies-badge" style={{ fontSize: '10px' }}>
                                        {tpl.updatedAt ? tpl.updatedAt.split(' ')[0] : 'Gốc'}
                                      </span>
                                    </div>

                                    {/* Mẫu in 1 tem trực quan 35x22mm */}
                                    <TemplateSingleLabelPreview tpl={tpl} config={config} onClick={() => applyTemplateToPrint(tpl)} />
                                  </div>

                                  <div className="tpl-actions-row">
                                    <button
                                      type="button"
                                      className="btn-load-print"
                                      onClick={() => applyTemplateToPrint(tpl)}
                                    >
                                      <span>Nạp bàn in</span>
                                    </button>

                                    {isKeep ? (
                                      <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600, padding: '4px 8px' }}>
                                        ✓ Bản duy nhất được giữ lại
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn-subtle"
                                        style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fee2e2', fontWeight: 600, padding: '6px 12px', fontSize: '12px' }}
                                        onClick={() => handleDeleteTemplate(tpl.id, tpl.name)}
                                      >
                                        🗑 Xóa bản này
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          /* Duplicate Items in List View */
                          <div className="catalog-list-table-wrap" style={{ margin: 0 }}>
                            <table className="catalog-list-table">
                              <thead>
                                <tr>
                                  <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                                  <th style={{ width: '105px', textAlign: 'center' }}>Xem mẫu</th>
                                  <th>Phân loại & Tên mẫu</th>
                                  <th style={{ width: '130px' }}>Thương hiệu</th>
                                  <th style={{ width: '130px' }}>Mã vạch (Barcode)</th>
                                  <th style={{ width: '120px' }}>Giá niêm yết</th>
                                  <th style={{ width: '110px' }}>Cập nhật</th>
                                  <th style={{ width: '180px', textAlign: 'center' }}>Thao tác</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.items.map((tpl, idx) => {
                                  const isKeep = idx === 0;
                                  return (
                                    <tr key={tpl.id} className={isKeep ? 'row-duplicate-keep' : 'row-duplicate-remove'}>
                                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                                      <td style={{ textAlign: 'center' }}>
                                        <TemplateSingleLabelPreview tpl={tpl} config={config} mini onClick={() => applyTemplateToPrint(tpl)} />
                                      </td>
                                      <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                          {isKeep ? (
                                            <span className="badge-duplicate-keep">✅ BẢN GỐC (GIỮ LẠI)</span>
                                          ) : (
                                            <span className="badge-duplicate-remove">⚠️ BẢN TRÙNG THỪA</span>
                                          )}
                                        </div>
                                        <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)' }}>
                                          {tpl.name}
                                        </div>
                                      </td>
                                      <td>
                                        <span className="tpl-brand-badge">{tpl.brand || '—'}</span>
                                      </td>
                                      <td>
                                        <span className="tpl-barcode-num" style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
                                          {tpl.barcode || '—'}
                                        </span>
                                      </td>
                                      <td>
                                        <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '14px' }}>
                                          {formatVNCurrency(tpl.price) || '0₫'}
                                        </span>
                                      </td>
                                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {tpl.updatedAt ? tpl.updatedAt.split(' ')[0] : 'Gốc'}
                                      </td>
                                      <td>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                          <button
                                            type="button"
                                            className="btn-load-print"
                                            style={{ padding: '6px 10px', fontSize: '11px', flex: 'none' }}
                                            onClick={() => applyTemplateToPrint(tpl)}
                                          >
                                            <span>Nạp bàn in</span>
                                          </button>
                                          {isKeep ? (
                                            <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700, padding: '4px 6px' }}>
                                              ✓ Duy nhất
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              className="btn-subtle"
                                              style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fee2e2', fontWeight: 600, padding: '4px 8px', fontSize: '11px' }}
                                              onClick={() => handleDeleteTemplate(tpl.id, tpl.name)}
                                            >
                                              🗑 Xóa bản này
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom pagination for duplicate groups */}
                {sortedDuplicateGroups.length > 0 && (
                  <PaginationControls
                    total={sortedDuplicateGroups.length}
                    currentPage={safeDuplicatePage}
                    pageSize={templatePageSize}
                    onPageChange={handlePageChange}
                    onPageSizeChange={setTemplatePageSize}
                  />
                )}
              </div>
            ) : (
              /* Regular Catalog Section */
              sortedTemplates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', background: '#fff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                  <p style={{ color: '#64748b', fontSize: '15px', fontWeight: 600 }}>Không tìm thấy mẫu tem nào phù hợp.</p>
                  <button
                    type="button"
                    className="btn-subtle"
                    style={{ margin: '14px auto 0' }}
                    onClick={() => setTemplateSearch('')}
                  >
                    Xóa bộ lọc tìm kiếm
                  </button>
                </div>
              ) : (
                <div>
                  {/* Top Pagination bar */}
                  <PaginationControls
                    total={sortedTemplates.length}
                    currentPage={safeCurrentPage}
                    pageSize={templatePageSize}
                    onPageChange={handlePageChange}
                    onPageSizeChange={setTemplatePageSize}
                  />

                  {/* Mode 1: GRID VIEW (3 cols / 6 cols) */}
                  {catalogViewMode === 'grid' ? (
                    <div className={`catalog-grid cols-${gridCols}`}>
                      {pagedTemplates.map((tpl) => (
                        <div
                          key={tpl.id}
                          className={`template-card ${selectedTemplateId === tpl.id ? 'active' : ''}`}
                        >
                          <div>
                            <div className="tpl-card-top">
                              <h3 className="tpl-card-title">{tpl.name}</h3>
                              <span className="tpl-copies-badge">
                                {gridCols === 6 ? `${tpl.copies || 1} hàng` : `Mặc định: ${tpl.copies || 1} hàng (${(tpl.copies || 1) * 2} tem)`}
                              </span>
                            </div>

                            {/* Mẫu in 1 tem trực quan 35x22mm */}
                            <TemplateSingleLabelPreview tpl={tpl} config={config} onClick={() => applyTemplateToPrint(tpl)} />
                          </div>

                          <div className="tpl-actions-row">
                            <button
                              type="button"
                              className="btn-load-print"
                              onClick={() => applyTemplateToPrint(tpl)}
                            >
                              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                              <span>{gridCols === 6 ? 'Nạp in' : 'Nạp vào bàn in'}</span>
                            </button>

                            <button
                              type="button"
                              className="btn-icon-action"
                              title="In nhanh mẫu này"
                              onClick={() => {
                                applyTemplateToPrint(tpl);
                                setTimeout(() => printLabels(tpl.copies || 1), 200);
                              }}
                            >
                              🖨️
                            </button>

                            <button
                              type="button"
                              className="btn-icon-action"
                              title="Chỉnh sửa mẫu"
                              onClick={() => {
                                setEditFormData({ ...tpl, price: formatPriceNumber(tpl.price) });
                                setShowEditModal(true);
                              }}
                            >
                              ✏️
                            </button>

                            <button
                              type="button"
                              className="btn-icon-action delete"
                              title="Xóa mẫu"
                              onClick={() => handleDeleteTemplate(tpl.id, tpl.name)}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Mode 2: LIST VIEW (Clean Table) */
                    <div className="catalog-list-table-wrap">
                      <table className="catalog-list-table">
                        <thead>
                          <tr>
                            <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                            <th style={{ width: '105px', textAlign: 'center' }}>Xem mẫu</th>
                            <th
                              style={{ cursor: 'pointer', userSelect: 'none' }}
                              onClick={() => setTemplateSortBy(templateSortBy === 'name_asc' ? 'name_desc' : 'name_asc')}
                              title="Bấm để sắp xếp theo tên A-Z / Z-A"
                            >
                              Tên sản phẩm / Mẫu {templateSortBy === 'name_asc' ? '▲ (A-Z)' : templateSortBy === 'name_desc' ? '▼ (Z-A)' : '⇅'}
                            </th>
                            <th style={{ width: '130px' }}>Thương hiệu</th>
                            <th style={{ width: '130px' }}>Mã vạch (Barcode)</th>
                            <th style={{ width: '120px' }}>Giá niêm yết</th>
                            <th style={{ width: '110px' }}>Mặc định in</th>
                            <th style={{ width: '110px' }}>Cập nhật</th>
                            <th style={{ width: '190px', textAlign: 'center' }}>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedTemplates.map((tpl, idx) => {
                            const itemNumber = (safeCurrentPage - 1) * templatePageSize + idx + 1;
                            return (
                              <tr key={tpl.id} className={selectedTemplateId === tpl.id ? 'active-row' : ''}>
                                <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                                  {itemNumber}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <TemplateSingleLabelPreview tpl={tpl} config={config} mini onClick={() => applyTemplateToPrint(tpl)} />
                                </td>
                                <td>
                                  {tpl.subText && (
                                    <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, marginBottom: '2px' }}>
                                      {tpl.subText}
                                    </div>
                                  )}
                                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>
                                    {tpl.product || tpl.name}
                                  </div>
                                  {tpl.product && tpl.name !== tpl.product && (
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      Mẫu: {tpl.name}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  {tpl.brand ? (
                                    <span className="tpl-brand-badge">{tpl.brand}</span>
                                  ) : (
                                    <span style={{ color: 'var(--text-sub)', fontSize: '12px' }}>—</span>
                                  )}
                                </td>
                                <td>
                                  <span className="tpl-barcode-num" style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
                                    {tpl.barcode || '—'}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '14px' }}>
                                    {formatVNCurrency(tpl.price) || '0₫'}
                                  </span>
                                </td>
                                <td>
                                  <span className="tpl-copies-badge">
                                    {tpl.copies || 1} hàng ({(tpl.copies || 1) * 2} tem)
                                  </span>
                                </td>
                                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                  {tpl.updatedAt ? tpl.updatedAt.split(' ')[0] : '—'}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    <button
                                      type="button"
                                      className="btn-load-print"
                                      style={{ padding: '6px 10px', fontSize: '11px', flex: 'none' }}
                                      onClick={() => applyTemplateToPrint(tpl)}
                                      title="Nạp vào bàn in"
                                    >
                                      <span>Nạp in</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-icon-action"
                                      style={{ width: '28px', height: '28px', fontSize: '12px' }}
                                      title="In nhanh mẫu này"
                                      onClick={() => {
                                        applyTemplateToPrint(tpl);
                                        setTimeout(() => printLabels(tpl.copies || 1), 200);
                                      }}
                                    >
                                      🖨️
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-icon-action"
                                      style={{ width: '28px', height: '28px', fontSize: '12px' }}
                                      title="Chỉnh sửa mẫu"
                                      onClick={() => {
                                        setEditFormData({ ...tpl, price: formatPriceNumber(tpl.price) });
                                        setShowEditModal(true);
                                      }}
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-icon-action delete"
                                      style={{ width: '28px', height: '28px', fontSize: '12px' }}
                                      title="Xóa mẫu"
                                      onClick={() => handleDeleteTemplate(tpl.id, tpl.name)}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Bottom Pagination Bar */}
                  <PaginationControls
                    total={sortedTemplates.length}
                    currentPage={safeCurrentPage}
                    pageSize={templatePageSize}
                    onPageChange={handlePageChange}
                    onPageSizeChange={setTemplatePageSize}
                  />
                </div>
              )
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: CĂN CHỈNH MÁY IN (Settings & Calibration)                */}
        {/* ============================================================== */}
        {mode === 'calibration' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="panel-card" style={{ marginBottom: '24px' }}>
              <div className="panel-header">
                <span className="panel-title">Tọa Độ Căn Khung & Bù Sai Số Cơ Học</span>
                <span className="tab-badge" style={{ background: '#fef3c7', color: '#92400e' }}>Căn chỉnh XP-350B</span>
              </div>

              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
                Mỗi máy in XP-350B có thể có độ xê dịch bánh lăn khác nhau. Bạn có thể điều chỉnh các thông số này và bấm <strong>"Lưu Cấu Hình Máy Này"</strong> để lưu lại trên chính máy tính.
              </p>

              <div className="form-row-2 form-group">
                <div>
                  <label className="form-label">Dời ngang X (mm)</label>
                  <span className="form-hint" style={{ display: 'block', marginBottom: '6px' }}>Âm = sang trái, Dương = sang phải</span>
                  <input
                    type="number"
                    step={0.1}
                    className="form-control"
                    value={config.offsetX}
                    onChange={(e) => setConfig(c => ({ ...c, offsetX: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="form-label">Dời dọc Y (mm)</label>
                  <span className="form-hint" style={{ display: 'block', marginBottom: '6px' }}>Âm = lên trên, Dương = xuống dưới</span>
                  <input
                    type="number"
                    step={0.1}
                    className="form-control"
                    value={config.offsetY}
                    onChange={(e) => setConfig(c => ({ ...c, offsetY: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="form-row-2 form-group">
                <div>
                  <label className="form-label">Khoảng cách rãnh giữa 2 tem (mm)</label>
                  <span className="form-hint" style={{ display: 'block', marginBottom: '6px' }}>Tiêu chuẩn thực tế là 0.4 mm</span>
                  <input
                    type="number"
                    step={0.1}
                    className="form-control"
                    value={config.columnGap}
                    onChange={(e) => setConfig(c => ({ ...c, columnGap: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="form-label">Bước nhảy hàng Gap (mm)</label>
                  <span className="form-hint" style={{ display: 'block', marginBottom: '6px' }}>Tiêu chuẩn decal là 3.0 mm</span>
                  <input
                    type="number"
                    step={0.1}
                    className="form-control"
                    value={config.gap}
                    onChange={(e) => setConfig(c => ({ ...c, gap: Number(e.target.value) }))}
                  />
                </div>
              </div>

              {/* Tinh chỉnh độ cao dòng nhỏ (Mẫu 2 dòng) */}
              <div className="form-group" style={{ marginTop: '16px', padding: '14px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                <div className="form-label-row">
                  <label className="form-label" style={{ color: '#0369a1' }}>
                    ↕ Tinh chỉnh độ cao dòng nhỏ (mẫu in 2 dòng)
                  </label>
                  <span className="form-hint">Đơn vị: dots (Âm = xích lên trên, Dương = xích xuống dưới)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                  <input
                    type="number"
                    step={1}
                    min={-10}
                    max={10}
                    className="form-control"
                    style={{ maxWidth: '110px', fontWeight: 700 }}
                    value={config.subTextOffsetY || 0}
                    onChange={(e) => setConfig(c => ({ ...c, subTextOffsetY: parseInt(e.target.value) || 0 }))}
                  />
                  <span style={{ fontSize: '13px', color: '#475467' }}>
                    (Mặc định: 0 dot. Ví dụ: -2 dot sẽ xích dòng nhỏ lên cao hơn sát mép tem)
                  </span>
                </div>
              </div>

              {/* Preview canvas calibration */}
              <div className="preview-canvas-box" style={{ margin: '20px 0' }}>
                <div className="canvas-wrapper">
                  <canvas ref={canvasRef} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  className="btn-subtle"
                  onClick={resetDefaultConfig}
                >
                  ↺ Khôi phục chuẩn gốc (-1.5, +2.0)
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-subtle"
                    onClick={() => printLabels(1)}
                  >
                    🖨️ In Khung Test (1 Hàng)
                  </button>
                  <button
                    type="button"
                    className="btn-primary-print"
                    style={{ width: 'auto', padding: '8px 18px', margin: 0 }}
                    onClick={handleSaveConfig}
                  >
                    💾 Lưu Cấu Hình Máy Này
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: LƯU MẪU MỚI */}
      {showSaveModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <span className="modal-title">💾 Lưu Mẫu Mới Vào Kho</span>
              <button type="button" className="modal-close" onClick={() => setShowSaveModal(false)}>✕</button>
            </div>

            <div>
              <div className="form-group">
                <label className="form-label">Tên gợi nhớ mẫu (Hiển thị trong kho)</label>
                <input
                  type="text"
                  className="form-control"
                  value={templateNameInput}
                  onChange={(e) => setTemplateNameInput(e.target.value)}
                  placeholder="Ví dụ: Trống Bông 04, Khô Bò Sợi..."
                  autoFocus
                />
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#475467', lineHeight: 1.6 }}>
                <div><strong>Thương hiệu:</strong> {brand || '(Trống)'}</div>
                <div><strong>Bố cục:</strong> {nameLayout === 'two_lines_bottom_price' ? 'Mẫu 3: Mẫu Size' : nameLayout === 'two_lines' ? 'Mẫu 2: 2 Dòng' : 'Mẫu 1: 1 Dòng'}</div>
                {(nameLayout === 'two_lines' || nameLayout === 'two_lines_bottom_price') && subText && (
                  <div><strong>Dòng nhỏ trên:</strong> {subText}</div>
                )}
                <div><strong>Tên tem:</strong> {product}</div>
                <div><strong>Giá:</strong> {getDisplayPrice(price)} | <strong>Barcode:</strong> {barcode}</div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-subtle" onClick={() => setShowSaveModal(false)}>Hủy</button>
              <button
                type="button"
                className="btn-primary-print"
                style={{ width: 'auto', padding: '8px 18px', margin: 0 }}
                onClick={handleSaveCurrentAsTemplate}
              >
                Lưu Vào Kho Mẫu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SỬA / TẠO MẪU ĐẦY ĐỦ */}
      {showEditModal && editFormData && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <span className="modal-title">{editFormData.id ? '✏ Chỉnh Sửa Mẫu Tem' : '➕ Thêm Mẫu Mới'}</span>
              <button type="button" className="modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>

            <div>
              <div className="form-group">
                <label className="form-label">Tên gợi nhớ của mẫu</label>
                <input
                  type="text"
                  className="form-control"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="Ví dụ: Hạt Điều Rang Muối A+..."
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Thương hiệu</label>
                <input
                  type="text"
                  className="form-control"
                  value={editFormData.brand || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, brand: e.target.value })}
                  placeholder="TIẾN UYÊN"
                />
              </div>

              {/* Layout mode toggle */}
              <div className="form-group">
                <label className="form-label">Kiểu bố cục tem in</label>
                <div className="layout-toggle-pill">
                  <button
                    type="button"
                    className={`btn-layout-pill ${editFormData.nameLayout === 'single' || (!editFormData.nameLayout && !editFormData.subText) ? 'active' : ''}`}
                    onClick={() => setEditFormData({ ...editFormData, nameLayout: 'single' })}
                  >
                    <span>Mẫu 1: 1 Dòng</span>
                  </button>
                  <button
                    type="button"
                    className={`btn-layout-pill ${editFormData.nameLayout === 'two_lines' ? 'active' : ''}`}
                    onClick={() => setEditFormData({ ...editFormData, nameLayout: 'two_lines' })}
                  >
                    <span>Mẫu 2: 2 Dòng</span>
                  </button>
                  <button
                    type="button"
                    className={`btn-layout-pill ${editFormData.nameLayout === 'two_lines_bottom_price' ? 'active' : ''}`}
                    onClick={() => setEditFormData({ ...editFormData, nameLayout: 'two_lines_bottom_price' })}
                  >
                    <span>Mẫu 3: Mẫu Size</span>
                  </button>
                </div>
              </div>

              {editFormData.nameLayout === 'two_lines' || editFormData.nameLayout === 'two_lines_bottom_price' ? (
                <>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#0284c7' }}>
                      Dòng nhỏ phía trên (Mô tả chi tiết, ~35-60+ ký tự)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.subText || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, subText: e.target.value })}
                      placeholder="VD: Túi Đeo Chéo Nhí 04 - dây kéo giữa"
                      maxLength={120}
                      style={{ borderColor: '#7dd3fc', background: '#f0f9ff' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#1d4ed8' }}>
                      {editFormData.nameLayout === 'two_lines_bottom_price' ? 'Tên sản phẩm / Size nổi bật' : 'Dòng lớn chính (Tên nổi bật, ~15 ký tự)'}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.product || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, product: e.target.value })}
                      placeholder={editFormData.nameLayout === 'two_lines_bottom_price' ? 'VD: Size 25x22x10' : 'VD: TRỐNG BÔNG 0315 hoặc Đeo Chéo Nhí'}
                      maxLength={32}
                      style={{ fontWeight: 700, borderColor: '#93c5fd' }}
                    />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label className="form-label">Tên sản phẩm in trên tem</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editFormData.product || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, product: e.target.value })}
                    placeholder="TRỐNG BÔNG 04"
                    maxLength={42}
                  />
                </div>
              )}

              <div className="form-row-2 form-group">
                <div>
                  <label className="form-label">Giá bán</label>
                  <div className="input-with-suffix">
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.price || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, price: formatPriceNumber(e.target.value, editFormData.price) })}
                      placeholder="1,000,000"
                      maxLength={18}
                    />
                    <span className="input-suffix-badge">₫</span>
                  </div>
                </div>
                <div>
                  <label className="form-label">Mã vạch Barcode</label>
                  <input
                    type="text"
                    className="form-control mono"
                    value={editFormData.barcode}
                    onChange={(e) => setEditFormData({ ...editFormData, barcode: e.target.value.replace(/[^0-9A-Za-z._-]/g, '') })}
                    placeholder="8938503890045"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Số hàng in mặc định</label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  className="form-control"
                  value={editFormData.copies || 1}
                  onChange={(e) => setEditFormData({ ...editFormData, copies: Math.max(1, parseInt(e.target.value) || 1) })}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-subtle" onClick={() => setShowEditModal(false)}>Hủy</button>
              <button
                type="button"
                className="btn-primary-print"
                style={{ width: 'auto', padding: '8px 18px', margin: 0 }}
                onClick={handleSaveEditedTemplate}
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: THƯ MỤC LƯU MẪU .JSON & HƯỚNG DẪN CHIA SẺ */}
      {showFolderModal && (
        <div className="modal-overlay" onClick={() => setShowFolderModal(false)}>
          <div className="modal-card" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                📁 Thư Mục Lưu Trữ Mẫu In (.json)
              </span>
              <button type="button" className="modal-close" onClick={() => setShowFolderModal(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
              <p style={{ margin: 0 }}>
                Hệ thống lưu các mẫu tem dưới dạng file <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>.json</code> tại đường dẫn sau trên máy tính của bạn:
              </p>

              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>
                  Đường dẫn thư mục:
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#0f172a', wordBreak: 'break-all', userSelect: 'all', fontWeight: 600, background: '#fff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  {templateFolder || 'Đang tải đường dẫn...'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary-print"
                  style={{ width: 'auto', padding: '9px 18px', margin: 0, fontSize: '13px', background: copiedFolder ? '#10b981' : undefined }}
                  onClick={handleCopyFolderPath}
                >
                  {copiedFolder ? '✓ Đã sao chép đường dẫn' : '📋 Sao chép đường dẫn này'}
                </button>
                <button
                  type="button"
                  className="btn-subtle"
                  style={{ padding: '9px 18px', fontSize: '13px', background: '#f8fafc' }}
                  onClick={triggerOpenFolder}
                >
                  📂 Mở File Explorer
                </button>
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#166534' }}>
                <strong>💡 Cách tự mở thủ công nếu File Explorer không tự hiện lên:</strong>
                <ol style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  <li>Bấm nút <strong>"Sao chép đường dẫn này"</strong> ở trên.</li>
                  <li>Nhấn tổ hợp phím <strong>Windows + E</strong> trên bàn phím (hoặc mở This PC).</li>
                  <li>Dán (<strong>Ctrl + V</strong>) vào thanh địa chỉ của File Explorer rồi nhấn <strong>Enter</strong>.</li>
                </ol>
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#1e40af' }}>
                <strong>🚀 Chia sẻ mẫu sang máy nhân viên khác:</strong>
                <div style={{ marginTop: '4px' }}>
                  Chỉ cần copy file <code style={{ fontFamily: 'monospace' }}>.json</code> gửi qua Zalo / USB, rồi dán vào thư mục tương ứng trên máy nhân viên là xong!
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: '16px' }}>
              <button
                type="button"
                className="btn-primary-print"
                style={{ width: 'auto', padding: '8px 24px', margin: 0 }}
                onClick={() => setShowFolderModal(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TÙY CHỈNH VỊ TRÍ IN & CĂN LỀ CON TEM */}
      {showOffsetModal && (
        <div className="modal-overlay" onClick={() => setShowOffsetModal(false)}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚙️ Tùy Chỉnh Vị Trí In & Lề Tem
              </span>
              <button type="button" className="modal-close" onClick={() => setShowOffsetModal(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
              {/* SECTION 1: Dòng nhỏ phía trên (Mẫu 2 dòng) */}
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, color: '#0369a1', fontSize: '13px' }}>
                    ↕ Vị Trí Dòng Nhỏ (Mẫu 2 Dòng)
                  </span>
                  <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    Đã khóa chuẩn: -6 dot
                  </span>
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#475467', lineHeight: 1.5 }}>
                  Tinh chỉnh xê dịch lên/xuống của dòng mô tả nhỏ phía trên mép tem.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div className="offset-stepper">
                    <button
                      type="button"
                      className="btn-stepper"
                      title="Xích dòng nhỏ lên trên"
                      onClick={() => {
                        const nextVal = Math.max(-10, (config.subTextOffsetY ?? -6) - 1);
                        setConfig(c => ({ ...c, subTextOffsetY: nextVal }));
                      }}
                    >
                      ▲ Lên
                    </button>
                    <span className="offset-value-badge" title="Độ lệch so với chuẩn">
                      {(config.subTextOffsetY ?? -6) > 0 ? `+${config.subTextOffsetY ?? -6}` : (config.subTextOffsetY ?? -6)} dot
                    </span>
                    <button
                      type="button"
                      className="btn-stepper"
                      title="Xích dòng nhỏ xuống dưới"
                      onClick={() => {
                        const nextVal = Math.min(10, (config.subTextOffsetY ?? -6) + 1);
                        setConfig(c => ({ ...c, subTextOffsetY: nextVal }));
                      }}
                    >
                      ▼ Xuống
                    </button>
                  </div>

                  {(config.subTextOffsetY ?? -6) !== -6 && (
                    <button
                      type="button"
                      className="btn-reset-offset"
                      onClick={() => {
                        setConfig(c => ({ ...c, subTextOffsetY: -6 }));
                        triggerToast('↺ Đã đặt lại vị trí dòng nhỏ về chuẩn (-6 dot)');
                      }}
                      title="Đặt lại về thông số chuẩn đã khóa"
                    >
                      ↺ Về chuẩn -6 dot
                    </button>
                  )}
                </div>
              </div>

              {/* SECTION 2: Tọa độ bù lệch cơ học máy in (Offsets toàn cục) */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '13px' }}>
                    🎯 Tọa Độ Căn Khung & Bù Lệch Cơ Học (Toàn Cục)
                  </span>
                </div>

                <div className="form-row-2 form-group" style={{ marginBottom: '10px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '12px' }}>
                      Dời ngang X ({config.offsetX > 0 ? `+${config.offsetX}` : config.offsetX} mm)
                    </label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        className="btn-preset"
                        style={{ flex: 1, padding: '5px' }}
                        onClick={() => setConfig(c => ({ ...c, offsetX: Math.round((c.offsetX - 0.5) * 10) / 10 }))}
                      >
                        ◄ Trái
                      </button>
                      <input
                        type="number"
                        step={0.1}
                        value={config.offsetX}
                        onChange={(e) => setConfig(c => ({ ...c, offsetX: Number(e.target.value) }))}
                        style={{ width: '50px', textAlign: 'center', fontSize: '12px', padding: '4px' }}
                      />
                      <button
                        type="button"
                        className="btn-preset"
                        style={{ flex: 1, padding: '5px' }}
                        onClick={() => setConfig(c => ({ ...c, offsetX: Math.round((c.offsetX + 0.5) * 10) / 10 }))}
                      >
                        Phải ►
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '12px' }}>
                      Dời dọc Y ({config.offsetY > 0 ? `+${config.offsetY}` : config.offsetY} mm)
                    </label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        className="btn-preset"
                        style={{ flex: 1, padding: '5px' }}
                        onClick={() => setConfig(c => ({ ...c, offsetY: Math.round((c.offsetY - 0.5) * 10) / 10 }))}
                      >
                        ▲ Lên
                      </button>
                      <input
                        type="number"
                        step={0.1}
                        value={config.offsetY}
                        onChange={(e) => setConfig(c => ({ ...c, offsetY: Number(e.target.value) }))}
                        style={{ width: '50px', textAlign: 'center', fontSize: '12px', padding: '4px' }}
                      />
                      <button
                        type="button"
                        className="btn-preset"
                        style={{ flex: 1, padding: '5px' }}
                        onClick={() => setConfig(c => ({ ...c, offsetY: Math.round((c.offsetY + 0.5) * 10) / 10 }))}
                      >
                        Xuống ▼
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-row-2 form-group" style={{ margin: 0 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '12px' }}>Khoảng cách rãnh 2 tem: {config.columnGap} mm</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        className="btn-preset"
                        style={{ flex: 1 }}
                        onClick={() => setConfig(c => ({ ...c, columnGap: Math.max(0, Math.round((c.columnGap - 0.2) * 10) / 10) }))}
                      >
                        ◄ Kéo sát (-0.2)
                      </button>
                      <input
                        type="number"
                        step={0.1}
                        value={config.columnGap}
                        onChange={(e) => setConfig(c => ({ ...c, columnGap: Number(e.target.value) }))}
                        style={{ width: '50px', textAlign: 'center', fontSize: '12px', padding: '4px' }}
                      />
                      <button
                        type="button"
                        className="btn-preset"
                        style={{ flex: 1 }}
                        onClick={() => setConfig(c => ({ ...c, columnGap: Math.round((c.columnGap + 0.2) * 10) / 10 }))}
                      >
                        Rộng (+0.2) ►
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '12px' }}>Bước nhảy hàng Gap (mm)</label>
                    <input
                      type="number"
                      step={0.1}
                      className="form-control"
                      value={config.gap}
                      onChange={(e) => setConfig(c => ({ ...c, gap: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn-subtle"
                onClick={() => {
                  resetDefaultConfig();
                  setShowOffsetModal(false);
                }}
              >
                ↺ Khôi Phục Mặc Định
              </button>

              <button
                type="button"
                className="btn-primary-print"
                style={{ width: 'auto', padding: '8px 20px', margin: 0 }}
                onClick={() => {
                  handleSaveConfig();
                  setShowOffsetModal(false);
                  triggerToast('🔒 Đã lưu và khóa cấu hình vào máy tính!');
                }}
              >
                💾 Lưu & Khóa Cấu Hình
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
