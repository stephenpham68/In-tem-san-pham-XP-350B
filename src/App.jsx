import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

const MM = 8; // 203 DPI: 8 dots/mm

const DEFAULT_CONFIG = {
  paperWidth: 76,   // Khổ cuộn giấy gồm cả đế backing (mm)
  labelWidth: 35,   // Chiều rộng con tem vật lý (mm)
  labelHeight: 22,  // Chiều cao con tem vật lý (mm) - TSPL SIZE
  frameWidth: 35,   // Chiều rộng khung viền test (mm)
  frameHeight: 22,  // Chiều cao khung viền test (mm) - Khung chuẩn đầy đủ 22 mm
  columnGap: 0.4,   // Khoảng cách giữa 2 tem trên cùng 1 hàng (mm) - KHÓA CHUẨN 0.4 mm
  leftMargin: 1.5,  // Lề đế bên trái (mm)
  gap: 3,           // Khoảng cách (gap) giữa các hàng tem (mm) - TSPL GAP
  offsetX: -1.5,    // Tinh chỉnh lệch ngang toàn cục (-1.5 mm) - KHÓA CHUẨN -1.5 mm
  offsetY: 1.5,     // Tinh chỉnh lệch dọc toàn cục (+1.5 mm) - KHÓA CHUẨN +1.5 mm
  inset: 1.0,       // Khoảng lùi an toàn vào trong mép tem (mm)
  lineWidth: 2,     // Độ dày nét viền khi in căn khung (dots)
};

const STORAGE_KEY = 'tien_uyen_printer_config_v7';

function barcodeCanvas(value) {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, value || '0', {
    format: 'CODE128',
    displayValue: false,
    margin: 0,
    width: 2,
    height: 52,
    background: '#ffffff',
    lineColor: '#000000',
  });
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

function drawLabel(ctx, x, y, config, data) {
  const scale = MM;
  const w = Math.round(config.labelWidth * scale);   // 35 * 8 = 280 dots
  const h = Math.round(config.labelHeight * scale);  // 22 * 8 = 176 dots
  const inset = Math.round(config.inset * scale);    // 1 * 8 = 8 dots

  // Vùng an toàn khả dụng bên trong mép tem
  const safeX = x + inset;
  const safeY = y + inset;
  const safeW = w - inset * 2; // 264 dots (~33 mm)
  const safeH = h - inset * 2; // 160 dots (~20 mm)

  ctx.save();
  // Giới hạn vùng vẽ trong phạm vi con tem (bo góc nhẹ 14px theo decal thực tế)
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = '#000000';

  // 1. Chữ thương hiệu xoay dọc bên trái (Tự động co giãn theo chiều dọc safeH, không tràn khung)
  const brandText = (data.brand || '').trim().toUpperCase();
  const hasBrand = Boolean(brandText);

  if (hasBrand) {
    ctx.save();
    ctx.translate(safeX + 18, safeY + safeH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const brandSize = fitText(ctx, brandText, safeH - 8, 22, 700, 9);
    ctx.font = `700 ${brandSize}px Arial, sans-serif`;

    let displayText = brandText;
    while (displayText.length > 4 && ctx.measureText(displayText).width > (safeH - 8)) {
      displayText = displayText.slice(0, -1);
    }
    if (displayText !== brandText) displayText = displayText.slice(0, -2) + '..';

    ctx.fillText(displayText, 0, 0);
    ctx.restore();
  }

  // 2. Cột thông tin sản phẩm và mã vạch (Tự động dàn đều full khung nếu không có brand)
  const contentX = hasBrand ? safeX + 40 : safeX + 8;
  const contentW = hasBrand ? safeW - 42 : safeW - 16;

  // Tên sản phẩm
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const productSize = fitText(ctx, data.product, contentW, 25, 600);
  ctx.font = `600 ${productSize}px Arial, sans-serif`;
  ctx.fillText(data.product, contentX, safeY + 24);

  // Giá bán
  const priceText = `GIÁ : ${data.price}`;
  const priceSize = fitText(ctx, priceText, contentW, 28, 700);
  ctx.font = `700 ${priceSize}px Arial, sans-serif`;
  ctx.fillText(priceText, contentX, safeY + 56);

  // Barcode
  const barcode = barcodeCanvas(data.barcode);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(barcode, contentX, safeY + 68, contentW, 48);

  // Mã số Barcode bên dưới
  ctx.textAlign = 'center';
  ctx.font = '400 20px Arial, sans-serif';
  ctx.fillText(data.barcode, contentX + contentW / 2, safeY + 144);

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

  // Tính tọa độ tem 1 và tem 2
  // Cả 2 tem cùng dịch theo offsetX và offsetY
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

  // Vẽ khung viền kiểm tra cho tem 1
  ctx.strokeRect(startX1, startY, frameW, frameH);
  // Vẽ khung viền kiểm tra cho tem 2
  ctx.strokeRect(startX2, startY, frameW, frameH);

  // Vẽ tâm chữ thập căn chỉnh chính xác
  ctx.beginPath();
  // Tem 1
  ctx.moveTo(startX1 + frameW / 2, startY);
  ctx.lineTo(startX1 + frameW / 2, startY + frameH);
  ctx.moveTo(startX1, startY + frameH / 2);
  ctx.lineTo(startX1 + frameW, startY + frameH / 2);
  // Tem 2
  ctx.moveTo(startX2 + frameW / 2, startY);
  ctx.lineTo(startX2 + frameW / 2, startY + frameH);
  ctx.moveTo(startX2, startY + frameH / 2);
  ctx.lineTo(startX2 + frameW, startY + frameH / 2);
  ctx.stroke();

  // Khung lùi an toàn nét đứt (inset 1.0 mm)
  const inset = Math.round(config.inset * scale);
  ctx.strokeStyle = '#98a2b3';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(startX1 + inset, startY + inset, frameW - inset * 2, frameH - inset * 2);
  ctx.strokeRect(startX2 + inset, startY + inset, frameW - inset * 2, frameH - inset * 2);
  ctx.setLineDash([]);
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
  const [product, setProduct] = useState('TRỐNG BÔNG 04');
  const [price, setPrice] = useState('320.000đ');
  const [barcode, setBarcode] = useState('893751041');
  const [copies, setCopies] = useState(1);
  const [showOffset, setShowOffset] = useState(false);
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

  const data = {
    brand: brand,
    product: product.trim() || 'SẢN PHẨM',
    price: price.trim() || '0đ',
    barcode: barcode.trim() || '0'
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
    } catch (_) {}
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function handleOpenTemplateFolder() {
    try {
      const res = await fetch('/api/templates/open-folder', { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        triggerToast('📁 Đã mở thư mục mẫu trên máy tính!');
      } else {
        alert('Không thể mở thư mục: ' + json.message);
      }
    } catch (e) {
      alert('Lỗi: ' + e.message);
    }
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
          price: price,
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
        body: JSON.stringify(editFormData),
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

  function applyTemplateToPrint(tpl) {
    if (tpl.brand !== undefined) setBrand(tpl.brand);
    if (tpl.product) setProduct(tpl.product);
    if (tpl.price) setPrice(tpl.price);
    if (tpl.barcode) setBarcode(tpl.barcode);
    if (tpl.copies) setCopies(tpl.copies);
    setSelectedTemplateId(tpl.id);
    setMode('label');
    triggerToast(`✓ Đã nạp mẫu "${tpl.name}" vào bản in!`);
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
      localStorage.removeItem('xprinter_store_brand');
    } catch (_) {}
    setConfig(DEFAULT_CONFIG);
    setBrand('TIẾN UYÊN');
  }

  // Lưu cấu hình vào localStorage khi thay đổi
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (_) {}
  }, [config]);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (mode === 'calibration') renderCalibrationCanvas(canvasRef.current, config);
    else renderCanvas(canvasRef.current, config, data);
  }, [brand, product, price, barcode, mode, config]);

  useEffect(() => {
    fetch('/api/status')
      .then((response) => response.json())
      .then((result) => setStatus({ kind: result.ready ? 'ok' : 'error', text: result.message }))
      .catch(() => setStatus({ kind: 'error', text: 'Local print agent chưa chạy' }));
  }, []);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return undefined;
    const lifecycle = new AbortController();
    const register = (tool) => Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
    register({
      name: 'get_label_printer_status',
      title: 'Kiểm tra XP-350B',
      description: 'Kiểm tra local print agent và máy in Xprinter XP-350B có sẵn sàng hay không.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      async execute() {
        const response = await fetch('/api/status');
        return response.json();
      },
    });
    register({
      name: 'stage_product_label',
      title: 'Điền nội dung tem',
      description: 'Điền tên sản phẩm, giá và barcode vào preview. Công cụ này không gửi lệnh in.',
      inputSchema: {
        type: 'object',
        properties: {
          brand: { type: 'string', maxLength: 40 },
          product: { type: 'string', minLength: 1, maxLength: 42 },
          price: { type: 'string', minLength: 1, maxLength: 24 },
          barcode: { type: 'string', minLength: 1, maxLength: 32, pattern: '^[0-9A-Za-z._-]+$' },
          copies: { type: 'integer', minimum: 1, maximum: 100 },
        },
        required: ['product', 'price', 'barcode'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input.product !== 'string' || typeof input.price !== 'string' || typeof input.barcode !== 'string') {
          throw new Error('Dữ liệu tem không hợp lệ');
        }
        if (typeof input.brand === 'string') setBrand(input.brand.slice(0, 40));
        setProduct(input.product.slice(0, 42));
        setPrice(input.price.slice(0, 24));
        setBarcode(input.barcode.replace(/[^0-9A-Za-z._-]/g, '').slice(0, 32));
        if (Number.isInteger(input.copies)) setCopies(Math.max(1, Math.min(100, input.copies)));
        return { staged: true, printed: false };
      },
    });
    return () => lifecycle.abort();
  }, []);

  async function printLabels() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStatus({ kind: 'busy', text: 'Đang gửi lệnh in…' });
    try {
      const response = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: canvas.toDataURL('image/png'),
          copies: Number(copies) || 1,
          settings: {
            paperWidth: config.paperWidth,
            paperHeight: config.labelHeight, // Giữ nguyên 22mm cho TSPL SIZE
            gap: config.gap,                 // Gap 3mm cho TSPL GAP
          },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || 'Lỗi in ấn');
      setStatus({ kind: 'ok', text: result.message || 'Đã gửi lệnh in tới XP-350B' });
    } catch (error) {
      setStatus({ kind: 'error', text: error.message });
    }
  }

  // Filter templates
  const filteredTemplates = templates.filter((tpl) => {
    const q = templateSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (tpl.name || '').toLowerCase().includes(q) ||
      (tpl.product || '').toLowerCase().includes(q) ||
      (tpl.barcode || '').toLowerCase().includes(q) ||
      (tpl.brand || '').toLowerCase().includes(q)
    );
  });

  // Tính toán vị trí phần trăm thực tế của 2 con tem trên bề rộng cuộn 76mm
  const totalDots = config.paperWidth * MM; // 608 dots
  const sX1 = (config.leftMargin + config.offsetX) * MM;
  const sX2 = sX1 + (config.labelWidth + config.columnGap) * MM;
  const lWidthDots = config.labelWidth * MM;

  const left1Pct = Math.max(0, (sX1 / totalDots) * 100);
  const w1Pct = Math.min(100 - left1Pct, (lWidthDots / totalDots) * 100);

  const left2Pct = Math.min(100, (sX2 / totalDots) * 100);
  const w2Pct = Math.min(100 - left2Pct, (lWidthDots / totalDots) * 100);

  // Vị trí rãnh khe giữa 2 tem chuẩn xác theo tọa độ
  const centerGapPct = ((sX1 + lWidthDots + sX2) / 2 / totalDots) * 100;

  return (
    <main className="app-shell">
      {/* Toast thông báo nổi */}
      {globalToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: '#0f172a',
          color: '#ffffff',
          padding: '11px 22px',
          borderRadius: '999px',
          boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
          fontWeight: 700,
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          {globalToast}
        </div>
      )}

      <header className="topbar">
        <div>
          <p className="eyebrow">{brand ? brand.toUpperCase() : 'IN TEM MÃ VẠCH'}</p>
          <h1>In tem sản phẩm 2 hàng (XP-350B)</h1>
        </div>
        <div className={`status status-${status.kind}`}><span />{status.text}</div>
      </header>

      <section className="workspace">
        <form noValidate className="controls" onSubmit={(event) => { event.preventDefault(); printLabels(); }}>
          <div className="mode-tabs" role="tablist" aria-label="Chế độ in">
            <button type="button" role="tab" aria-selected={mode === 'label'} className={mode === 'label' ? 'active' : ''} onClick={() => setMode('label')}>
              In tem
            </button>
            <button type="button" role="tab" aria-selected={mode === 'templates'} className={mode === 'templates' ? 'active' : ''} onClick={() => setMode('templates')}>
              Kho mẫu ({templates.length})
            </button>
            <button type="button" role="tab" aria-selected={mode === 'calibration'} className={mode === 'calibration' ? 'active' : ''} onClick={() => setMode('calibration')}>
              Căn khung
            </button>
          </div>

          <div className="section-heading">
            <span>{mode === 'templates' ? '★' : '01'}</span>
            <div>
              <h2>
                {mode === 'calibration' ? 'Căn chỉnh khung test' : mode === 'templates' ? `Kho mẫu tem (${templates.length})` : 'Nội dung tem'}
              </h2>
              <p>
                {mode === 'calibration'
                  ? 'Khung in test đã giảm 50% chiều cao (11 mm) để dễ quan sát vị trí dừng tem.'
                  : mode === 'templates'
                  ? 'Chọn mẫu để nạp in tức thì hoặc quản lý file template trong máy.'
                  : 'In 2 tem trên một hàng giấy khổ 35x22 mm.'}
              </p>
            </div>
          </div>

          {mode === 'label' && (
            <>
              <label>
                Tên thương hiệu / Cửa hàng
                <input
                  value={brand}
                  onChange={(event) => {
                    const val = event.target.value;
                    setBrand(val);
                    try { localStorage.setItem('xprinter_store_brand', val); } catch (_) {}
                  }}
                  placeholder="VD: TIẾN UYÊN (hoặc để trống)"
                  maxLength={40}
                />
              </label>
              <label>Tên sản phẩm<input value={product} onChange={(event) => setProduct(event.target.value)} maxLength={42} /></label>
              <label>Giá bán<input value={price} onChange={(event) => setPrice(event.target.value)} maxLength={24} /></label>
              <label>Mã barcode<input value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/[^0-9A-Za-z._-]/g, ''))} maxLength={32} inputMode="numeric" /></label>

              <div style={{ marginTop: '4px' }}>
                <button
                  type="button"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: showOffset ? '11px 11px 0 0' : '11px',
                    border: '1px solid #cbd5e1',
                    background: showOffset ? '#eff6ff' : '#f8fafc',
                    color: showOffset ? '#1d4ed8' : '#475467',
                    cursor: 'pointer',
                    fontWeight: 650,
                    fontSize: '13px',
                    transition: 'all .15s',
                  }}
                  onClick={() => setShowOffset(!showOffset)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⚙</span>
                    <span>Tùy chỉnh vị trí in (Offset)</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                      X: {config.offsetX} · Y: {config.offsetY} · Cách: {config.columnGap} mm
                    </span>
                    <span style={{ transform: showOffset ? 'rotate(180deg)' : 'none', transition: 'transform .2s', fontSize: '10px' }}>▼</span>
                  </span>
                </button>

                {showOffset && (
                  <div style={{ padding: '14px', background: '#f8fafc', border: '1px solid #cbd5e1', borderTop: '0', borderRadius: '0 0 11px 11px', display: 'grid', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>Căn chỉnh lề tem</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          style={{ padding: '4px 9px', border: '1px solid #16a34a', borderRadius: '6px', background: '#f0fdf4', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={handleSaveConfig}
                        >
                          💾 Lưu cấu hình
                        </button>
                        <button
                          type="button"
                          title="Khôi phục chuẩn mặc định hoàn hảo (-1.5, +1.5, 0.4 mm)"
                          style={{ padding: '4px 8px', border: '1px solid #d0d5dd', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: '#475467', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={resetDefaultConfig}
                        >
                          ↺ Mặc định
                        </button>
                      </div>
                    </div>

                    {saveToast && (
                      <div style={{ padding: '6px 10px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', color: '#065f46', fontSize: '11px', fontWeight: '600', textAlign: 'center' }}>
                        ✓ Đã lưu cấu hình riêng trên máy này!
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', color: '#475467' }}>
                          Dời ngang X ({config.offsetX > 0 ? `+${config.offsetX}` : config.offsetX} mm)
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            title="Dời sang trái 0.5 mm"
                            style={{ flex: 1, padding: '6px 2px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '11px', color: '#1e293b' }}
                            onClick={() => setConfig(c => ({ ...c, offsetX: Math.round((c.offsetX - 0.5) * 10) / 10 }))}
                          >
                            ◄ Trái
                          </button>
                          <input
                            type="number"
                            step={0.1}
                            value={config.offsetX}
                            onChange={(e) => setConfig(c => ({ ...c, offsetX: Number(e.target.value) }))}
                            style={{ width: '52px', padding: '5px 2px', fontSize: '13px', textAlign: 'center', borderRadius: '6px' }}
                          />
                          <button
                            type="button"
                            title="Dời sang phải 0.5 mm"
                            style={{ flex: 1, padding: '6px 2px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '11px', color: '#1e293b' }}
                            onClick={() => setConfig(c => ({ ...c, offsetX: Math.round((c.offsetX + 0.5) * 10) / 10 }))}
                          >
                            Phải ►
                          </button>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', color: '#475467' }}>
                          Dời dọc Y ({config.offsetY > 0 ? `+${config.offsetY}` : config.offsetY} mm)
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            title="Dời lên trên 0.5 mm"
                            style={{ flex: 1, padding: '6px 2px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '11px', color: '#1e293b' }}
                            onClick={() => setConfig(c => ({ ...c, offsetY: Math.round((c.offsetY - 0.5) * 10) / 10 }))}
                          >
                            ▲ Lên
                          </button>
                          <input
                            type="number"
                            step={0.1}
                            value={config.offsetY}
                            onChange={(e) => setConfig(c => ({ ...c, offsetY: Number(e.target.value) }))}
                            style={{ width: '52px', padding: '5px 2px', fontSize: '13px', textAlign: 'center', borderRadius: '6px' }}
                          />
                          <button
                            type="button"
                            title="Dời xuống dưới 0.5 mm"
                            style={{ flex: 1, padding: '6px 2px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '11px', color: '#1e293b' }}
                            onClick={() => setConfig(c => ({ ...c, offsetY: Math.round((c.offsetY + 0.5) * 10) / 10 }))}
                          >
                            Xuống ▼
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#334155' }}>
                          Khoảng cách 2 tem ({config.columnGap} mm)
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>Chỉ dịch Tem 2 (Tem 1 đứng yên)</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          title="Kéo Tem 2 dịch sang trái lại gần Tem 1"
                          style={{ flex: 1, padding: '6px 4px', border: '1px solid #94a3b8', borderRadius: '6px', background: '#eff6ff', cursor: 'pointer', fontWeight: 700, fontSize: '11px', color: '#1d4ed8' }}
                          onClick={() => setConfig(c => ({ ...c, columnGap: Math.max(0, Math.round((c.columnGap - 0.2) * 10) / 10) }))}
                        >
                          ◄ Kéo Tem 2 sang Trái (-0.2)
                        </button>
                        <input
                          type="number"
                          step={0.1}
                          min={0}
                          max={10}
                          value={config.columnGap}
                          onChange={(e) => setConfig(c => ({ ...c, columnGap: Number(e.target.value) }))}
                          style={{ width: '56px', padding: '5px 2px', fontSize: '13px', textAlign: 'center', borderRadius: '6px' }}
                        />
                        <button
                          type="button"
                          title="Đẩy Tem 2 dịch sang phải ra xa Tem 1"
                          style={{ flex: 1, padding: '6px 4px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '11px', color: '#475467' }}
                          onClick={() => setConfig(c => ({ ...c, columnGap: Math.round((c.columnGap + 0.2) * 10) / 10 }))}
                        >
                          Đẩy Tem 2 sang Phải (+0.2) ►
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {mode === 'templates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Search & Folder Bar */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="🔍 Tìm theo tên, mã barcode, giá..."
                  style={{ flex: 1, padding: '9px 12px', fontSize: '13px', borderRadius: '9px' }}
                />
                <button
                  type="button"
                  title="Mở thư mục file mẫu trên máy tính (để copy/chia sẻ)"
                  onClick={handleOpenTemplateFolder}
                  style={{
                    padding: '0 12px',
                    borderRadius: '9px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    fontSize: '15px',
                  }}
                >
                  📁
                </button>
                <button
                  type="button"
                  title="Tải lại danh sách mẫu"
                  onClick={loadTemplates}
                  style={{
                    padding: '0 12px',
                    borderRadius: '9px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    fontSize: '15px',
                  }}
                >
                  ↺
                </button>
              </div>

              {/* Add New Template */}
              <button
                type="button"
                onClick={() => {
                  setEditFormData({
                    id: '',
                    name: '',
                    brand: brand,
                    product: '',
                    price: '',
                    barcode: '',
                    copies: 1,
                  });
                  setShowEditModal(true);
                }}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px dashed #175cd3',
                  background: '#eff6ff',
                  color: '#175cd3',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>➕</span>
                <span>Thêm mẫu mới vào kho</span>
              </button>

              {/* Templates List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '480px', overflowY: 'auto', paddingRight: '2px' }}>
                {filteredTemplates.length === 0 ? (
                  <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748b', fontSize: '13px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    {templateSearch ? 'Không tìm thấy mẫu phù hợp.' : 'Chưa có mẫu nào trong kho.'}
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#94a3b8' }}>
                      Bấm "Thêm mẫu mới" hoặc copy file .json vào thư mục mẫu.
                    </div>
                  </div>
                ) : (
                  filteredTemplates.map((tpl) => {
                    const isSelected = selectedTemplateId === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => {
                          setSelectedTemplateId(tpl.id);
                          if (tpl.brand !== undefined) setBrand(tpl.brand);
                          if (tpl.product) setProduct(tpl.product);
                          if (tpl.price) setPrice(tpl.price);
                          if (tpl.barcode) setBarcode(tpl.barcode);
                          if (tpl.copies) setCopies(tpl.copies);
                        }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: isSelected ? '2px solid #175cd3' : '1px solid #e2e8f0',
                          background: isSelected ? '#f0f7ff' : '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                          transition: 'all .15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 750, fontSize: '14px', color: '#0f172a' }}>{tpl.name}</span>
                          <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              title="Sửa mẫu"
                              onClick={() => {
                                setEditFormData({ ...tpl });
                                setShowEditModal(true);
                              }}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', padding: '2px 4px' }}
                            >
                              ✏
                            </button>
                            <button
                              type="button"
                              title="Xóa mẫu"
                              onClick={() => handleDeleteTemplate(tpl.id, tpl.name)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', padding: '2px 4px', color: '#ef4444' }}
                            >
                              🗑
                            </button>
                          </div>
                        </div>

                        <div style={{ fontSize: '12px', color: '#475467', display: 'flex', justifyContent: 'space-between' }}>
                          <span>SP: <strong>{tpl.product}</strong></span>
                          <span style={{ color: '#16a34a', fontWeight: 700 }}>{tpl.price}</span>
                        </div>

                        <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Code: <code>{tpl.barcode}</code></span>
                          {tpl.brand && <span style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>{tpl.brand}</span>}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            applyTemplateToPrint(tpl);
                          }}
                          style={{
                            marginTop: '4px',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid #175cd3',
                            background: '#175cd3',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          📥 Nạp mẫu này vào tab in
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {mode === 'calibration' && (
            <>
              <div className="calibration-help">
                Khung test hiện tại: <strong>Cao {config.frameHeight} mm</strong> (Khung đầy đủ 100% khớp mép tem).<br />
                • Khung viền in theo vị trí khóa chuẩn: X = {config.offsetX} mm, Y = {config.offsetY} mm, Cách 2 tem = {config.columnGap} mm.<br />
                • Bấm nút <strong>Khung 50% (11 mm)</strong> nếu bạn muốn in thử khung ngắn.
              </div>
              <div className="test-grid">
                {[
                  ['frameHeight', 'Cao khung test (mm)', 2, 40, 0.1],
                  ['labelHeight', 'Cao tem gốc (mm)', 10, 40, 0.1],
                  ['frameWidth', 'Rộng khung test (mm)', 20, 40, 0.1],
                  ['labelWidth', 'Rộng tem gốc (mm)', 20, 40, 0.1],
                  ['gap', 'Gap dọc hàng (mm)', 0, 10, 0.1],
                  ['columnGap', 'Cách 2 tem (mm)', 0, 10, 0.1],
                  ['leftMargin', 'Lề đế trái (mm)', 0, 10, 0.1],
                  ['offsetX', 'Offset X (Lệch ngang)', -10, 10, 0.1],
                  ['offsetY', 'Offset Y (Lệch dọc)', -10, 10, 0.1],
                  ['lineWidth', 'Nét viền (dots)', 1, 6, 1],
                ].map(([key, label, min, max, step]) => (
                  <label key={key}>{label}
                    <input
                      type="number"
                      min={min}
                      max={max}
                      step={step}
                      value={config[key]}
                      onChange={(event) => setConfig((current) => ({ ...current, [key]: Number(event.target.value) }))}
                    />
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={{ padding: '7px 11px', border: '1px solid #d0d5dd', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                  onClick={() => setConfig(c => ({ ...c, frameHeight: 11 }))}
                >
                  Khung 50% (11 mm)
                </button>
                <button
                  type="button"
                  style={{ padding: '7px 11px', border: '1px solid #d0d5dd', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                  onClick={() => setConfig(c => ({ ...c, frameHeight: 22 }))}
                >
                  Khung 100% (22 mm)
                </button>
                <button
                  type="button"
                  style={{ padding: '7px 11px', border: '1px solid #d0d5dd', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                  onClick={resetDefaultConfig}
                >
                  ↺ Chuẩn 35 × 22 mm
                </button>
              </div>
            </>
          )}

          <label>Số hàng in<input type="number" min="1" max="100" value={copies} onChange={(event) => setCopies(event.target.value)} /></label>

          <div style={{ display: 'grid', gridTemplateColumns: mode === 'label' ? '1fr 1fr' : '1fr', gap: '8px' }}>
            {mode === 'label' && (
              <button
                type="button"
                onClick={() => {
                  setTemplateNameInput(product || 'Mẫu tem mới');
                  setShowSaveModal(true);
                }}
                style={{
                  padding: '12px 14px',
                  borderRadius: '13px',
                  border: '1px solid #16a34a',
                  background: '#f0fdf4',
                  color: '#15803d',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>💾</span>
                <span>Lưu vào kho mẫu</span>
              </button>
            )}

            <button className="print-button" type="submit" disabled={status.kind === 'busy'} style={{ marginTop: 0 }}>
              <span className="printer-icon" aria-hidden="true">▣</span>
              {status.kind === 'busy' ? 'Đang in…' : mode === 'calibration' ? 'In khung kiểm tra' : 'In XP-350B'}
            </button>
          </div>

          <p className="print-note">
            Khổ cuộn {config.paperWidth} mm · 2 tem {config.labelWidth} × {config.labelHeight} mm · Gap dọc {config.gap} mm · 203 DPI (8 dots/mm)
          </p>
        </form>

        <div className="preview-panel">
          <div className="section-heading preview-heading">
            <span>02</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
              <div>
                <h2>
                  {mode === 'calibration'
                    ? `Khung kiểm tra (Cao ${config.frameHeight} mm)`
                    : 'Xem trước bản in'}
                </h2>
                <p>
                  {mode === 'templates' && selectedTemplateId
                    ? `Đang xem mẫu: "${product}" · ${price}`
                    : `Hình ảnh bitmap kích thước ${Math.round(config.paperWidth * MM)} × ${Math.round(config.labelHeight * MM)} dots gửi tới máy in.`}
                </p>
              </div>

              {mode === 'templates' && (
                <button
                  type="button"
                  onClick={() => printLabels()}
                  disabled={status.kind === 'busy'}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#16a34a',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(22,163,74,0.25)',
                  }}
                >
                  🖨️ In ngay mẫu này
                </button>
              )}
            </div>
          </div>

          <div className="preview-stage" style={{ position: 'relative' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <canvas ref={canvasRef} aria-label="Xem trước hai tem sản phẩm" style={{ display: 'block', width: '100%', height: 'auto' }} />

              {/* Khung viền chỉ dẫn khuôn decal 35x22 mm theo vị trí thực tế */}
              <div
                style={{
                  position: 'absolute',
                  top: `${Math.max(0, (config.offsetY / config.labelHeight) * 100)}%`,
                  left: `${left1Pct}%`,
                  width: `${w1Pct}%`,
                  height: '100%',
                  border: '1.5px dashed rgba(37, 99, 235, 0.65)',
                  borderRadius: '10px',
                  pointerEvents: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '-20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '10px',
                    color: '#93c5fd',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                  }}
                >
                  Tem 1 ({config.labelWidth} × {config.labelHeight} mm)
                </span>
              </div>

              <div
                style={{
                  position: 'absolute',
                  top: `${Math.max(0, (config.offsetY / config.labelHeight) * 100)}%`,
                  left: `${left2Pct}%`,
                  width: `${w2Pct}%`,
                  height: '100%',
                  border: '1.5px dashed rgba(37, 99, 235, 0.65)',
                  borderRadius: '10px',
                  pointerEvents: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '-20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '10px',
                    color: '#93c5fd',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                  }}
                >
                  Tem 2 ({config.labelWidth} × {config.labelHeight} mm)
                </span>
              </div>

              {/* Đường kẻ ranh giới giữa 2 tem theo vị trí rãnh thực tế */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${centerGapPct}%`,
                  width: '1px',
                  background: 'rgba(59, 130, 246, 0.7)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>

          <div className="legend">
            <span><i className="dot-white" />Nền trắng</span>
            <span><i className="dot-black" />Phần đốt nhiệt</span>
            <span><i style={{ borderColor: '#2563eb', borderStyle: 'dashed' }} />Khuôn tem {config.labelWidth} × {config.labelHeight} mm</span>
            <span><i style={{ borderColor: '#3b82f6' }} />Rãnh giữa 2 tem ({config.columnGap} mm)</span>
          </div>
        </div>
      </section>

      {/* Modal: Lưu thành mẫu tem mới */}
      {showSaveModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '16px',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '24px',
            width: 'min(100%, 420px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>💾 Lưu vào kho mẫu tem</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
              Mẫu sẽ được lưu thành 1 file .json trong thư mục mẫu để bạn có thể tái dùng hoặc chia sẻ cho máy khác.
            </p>

            <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 700 }}>
              Tên gọi mẫu tem (gợi nhớ)
              <input
                type="text"
                autoFocus
                value={templateNameInput}
                onChange={(e) => setTemplateNameInput(e.target.value)}
                placeholder="VD: Trống Bông 04 - Size Lớn"
                style={{ padding: '10px 12px', fontSize: '14px', borderRadius: '8px' }}
              />
            </label>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', fontSize: '12px', color: '#334155', display: 'grid', gap: '4px' }}>
              <div>Thương hiệu: <strong>{brand || '(Không)'}</strong></div>
              <div>Sản phẩm: <strong>{product}</strong></div>
              <div>Giá bán: <strong>{price}</strong></div>
              <div>Barcode: <strong>{barcode}</strong></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '9px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveCurrentAsTemplate}
                style={{
                  padding: '9px 18px',
                  borderRadius: '9px',
                  border: 'none',
                  background: '#175cd3',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                Lưu vào kho
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Thêm / Sửa mẫu tem đầy đủ */}
      {showEditModal && editFormData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '16px',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '24px',
            width: 'min(100%, 460px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
              {editFormData.id ? '✏ Chỉnh sửa mẫu tem' : '➕ Thêm mẫu tem mới'}
            </h3>

            <label style={{ display: 'grid', gap: '4px', fontSize: '13px', fontWeight: 700 }}>
              Tên gọi mẫu
              <input
                type="text"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                placeholder="VD: Trống Bông 04"
                style={{ padding: '9px 12px', fontSize: '14px', borderRadius: '8px' }}
              />
            </label>

            <label style={{ display: 'grid', gap: '4px', fontSize: '13px', fontWeight: 700 }}>
              Tên thương hiệu (in dọc bên trái)
              <input
                type="text"
                value={editFormData.brand}
                onChange={(e) => setEditFormData({ ...editFormData, brand: e.target.value })}
                placeholder="VD: TIẾN UYÊN"
                style={{ padding: '9px 12px', fontSize: '14px', borderRadius: '8px' }}
              />
            </label>

            <label style={{ display: 'grid', gap: '4px', fontSize: '13px', fontWeight: 700 }}>
              Tên sản phẩm
              <input
                type="text"
                value={editFormData.product}
                onChange={(e) => setEditFormData({ ...editFormData, product: e.target.value })}
                placeholder="VD: TRỐNG BÔNG 04"
                style={{ padding: '9px 12px', fontSize: '14px', borderRadius: '8px' }}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label style={{ display: 'grid', gap: '4px', fontSize: '13px', fontWeight: 700 }}>
                Giá bán
                <input
                  type="text"
                  value={editFormData.price}
                  onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
                  placeholder="VD: 320.000đ"
                  style={{ padding: '9px 12px', fontSize: '14px', borderRadius: '8px' }}
                />
              </label>

              <label style={{ display: 'grid', gap: '4px', fontSize: '13px', fontWeight: 700 }}>
                Mã barcode
                <input
                  type="text"
                  value={editFormData.barcode}
                  onChange={(e) => setEditFormData({ ...editFormData, barcode: e.target.value.replace(/[^0-9A-Za-z._-]/g, '') })}
                  placeholder="VD: 893751041"
                  style={{ padding: '9px 12px', fontSize: '14px', borderRadius: '8px' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => { setShowEditModal(false); setEditFormData(null); }}
                style={{
                  padding: '9px 16px',
                  borderRadius: '9px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEditedTemplate}
                style={{
                  padding: '9px 18px',
                  borderRadius: '9px',
                  border: 'none',
                  background: '#175cd3',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
