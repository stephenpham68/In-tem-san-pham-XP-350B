import { useEffect, useRef, useState } from 'react';
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

  // 1. Chữ thương hiệu xoay dọc bên trái
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

  // 2. Cột thông tin sản phẩm và mã vạch
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


function TemplateSingleLabelPreview({ tpl, onClick }) {
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
      { labelWidth: 35, labelHeight: 22, inset: 1.0 },
      {
        brand: tpl.brand || '',
        product: (tpl.product || '').trim() || 'SẢN PHẨM',
        price: (tpl.price || '').trim() || '0đ',
        barcode: (tpl.barcode || '').trim() || '0',
      }
    );
  }, [tpl]);

  return (
    <div className="tpl-single-label-wrapper" onClick={onClick} title="Bấm để nạp mẫu này vào bàn in">
      <canvas ref={canvasRef} className="tpl-single-label-canvas" />
      <div className="tpl-single-label-tag">
        <span>🔍 Mẫu tem đơn (35×22mm)</span>
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
  const [templateFolder, setTemplateFolder] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [copiedFolder, setCopiedFolder] = useState(false);

  const data = {
    brand: brand,
    product: product.trim() || 'SẢN PHẨM',
    price: price.trim() || '0đ',
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

  async function handleOpenTemplateFolder() {
    setShowFolderModal(true);
    try {
      const res = await fetch('/api/templates/open-folder', { method: 'POST' });
      const json = await res.json();
      if (json.folder) {
        setTemplateFolder(json.folder);
      }
      if (json.ok && json.opened) {
        triggerToast('📁 Đã mở thư mục mẫu trong File Explorer!');
      } else {
        triggerToast('📁 Đã định vị thư mục mẫu!');
      }
    } catch (e) {
      triggerToast('📁 Thư mục lưu mẫu tem');
    }
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
      localStorage.removeItem('xprinter_store_brand');
    } catch (_) {}
    setConfig(DEFAULT_CONFIG);
    setBrand('TIẾN UYÊN');
    triggerToast('↺ Đã khôi phục cài đặt gốc (-1.5, +1.5, 0.4 mm)!');
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
  }, [brand, product, price, barcode, mode, config]);

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
                    onClick={() => {
                      const sample = templates[0];
                      if (sample) applyTemplateToPrint(sample);
                      else {
                        setBrand('TIẾN UYÊN');
                        setProduct('TRỐNG BÔNG 04');
                        setPrice('320.000đ');
                        setBarcode('893751041');
                      }
                    }}
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

                {/* Product Name */}
                <div className="form-group">
                  <label className="form-label">Tên sản phẩm in trên tem</label>
                  <input
                    type="text"
                    className="form-control"
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    placeholder="Nhập tên sản phẩm..."
                    maxLength={42}
                  />
                </div>

                {/* Price & Barcode in grid */}
                <div className="form-row-2 form-group">
                  <div>
                    <label className="form-label">Giá bán</label>
                    <input
                      type="text"
                      className="form-control"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="320.000đ"
                      maxLength={24}
                    />
                  </div>
                  <div>
                    <label className="form-label">Mã barcode (CODE128)</label>
                    <input
                      type="text"
                      className="form-control mono"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value.replace(/[^0-9A-Za-z._-]/g, ''))}
                      placeholder="893751041"
                      maxLength={32}
                    />
                  </div>
                </div>

                {/* Offset Tinh Chỉnh Nhanh */}
                <div className="form-group">
                  <button
                    type="button"
                    className={`offset-toggle-btn ${showOffset ? 'open' : ''}`}
                    onClick={() => setShowOffset(!showOffset)}
                  >
                    <span>⚙ Tùy chỉnh vị trí in (Offset)</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      X: {config.offsetX} · Y: {config.offsetY} · Rãnh: {config.columnGap}mm {showOffset ? '▲' : '▼'}
                    </span>
                  </button>

                  {showOffset && (
                    <div className="offset-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700 }}>Bù sai số cơ học</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-subtle"
                            style={{ padding: '4px 8px', fontSize: '11px', color: '#16a34a' }}
                            onClick={handleSaveConfig}
                          >
                            💾 Lưu máy này
                          </button>
                          <button
                            type="button"
                            className="btn-subtle"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={resetDefaultConfig}
                          >
                            ↺ Mặc định
                          </button>
                        </div>
                      </div>

                      {saveToast && (
                        <div style={{ padding: '4px 8px', background: '#ecfdf5', borderRadius: '6px', color: '#065f46', fontSize: '11px', textAlign: 'center' }}>
                          ✓ Đã lưu cấu hình riêng cho máy tính này!
                        </div>
                      )}

                      <div className="form-row-2">
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '4px', color: '#475467' }}>
                            Dời X ({config.offsetX > 0 ? `+${config.offsetX}` : config.offsetX} mm)
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              className="btn-preset"
                              style={{ flex: 1, padding: '4px' }}
                              onClick={() => setConfig(c => ({ ...c, offsetX: Math.round((c.offsetX - 0.5) * 10) / 10 }))}
                            >
                              ◄ Trái
                            </button>
                            <input
                              type="number"
                              step={0.1}
                              value={config.offsetX}
                              onChange={(e) => setConfig(c => ({ ...c, offsetX: Number(e.target.value) }))}
                              style={{ width: '48px', textAlign: 'center', fontSize: '12px', padding: '4px' }}
                            />
                            <button
                              type="button"
                              className="btn-preset"
                              style={{ flex: 1, padding: '4px' }}
                              onClick={() => setConfig(c => ({ ...c, offsetX: Math.round((c.offsetX + 0.5) * 10) / 10 }))}
                            >
                              Phải ►
                            </button>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '4px', color: '#475467' }}>
                            Dời Y ({config.offsetY > 0 ? `+${config.offsetY}` : config.offsetY} mm)
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              className="btn-preset"
                              style={{ flex: 1, padding: '4px' }}
                              onClick={() => setConfig(c => ({ ...c, offsetY: Math.round((c.offsetY - 0.5) * 10) / 10 }))}
                            >
                              ▲ Lên
                            </button>
                            <input
                              type="number"
                              step={0.1}
                              value={config.offsetY}
                              onChange={(e) => setConfig(c => ({ ...c, offsetY: Number(e.target.value) }))}
                              style={{ width: '48px', textAlign: 'center', fontSize: '12px', padding: '4px' }}
                            />
                            <button
                              type="button"
                              className="btn-preset"
                              style={{ flex: 1, padding: '4px' }}
                              onClick={() => setConfig(c => ({ ...c, offsetY: Math.round((c.offsetY + 0.5) * 10) / 10 }))}
                            >
                              Xuống ▼
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '4px', color: '#475467' }}>
                          Khoảng cách rãnh giữa 2 tem: {config.columnGap} mm
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
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
                            style={{ width: '52px', textAlign: 'center', fontSize: '12px', padding: '4px' }}
                          />
                          <button
                            type="button"
                            className="btn-preset"
                            style={{ flex: 1 }}
                            onClick={() => setConfig(c => ({ ...c, columnGap: Math.round((c.columnGap + 0.2) * 10) / 10 }))}
                          >
                            Đẩy rộng (+0.2) ►
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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
        {mode === 'templates' && (
          <div>
            {/* Catalog Toolbar */}
            <div className="catalog-toolbar">
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

            {/* Catalog Grid Cards */}
            {filteredTemplates.length === 0 ? (
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
              <div className="catalog-grid">
                {filteredTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className={`template-card ${selectedTemplateId === tpl.id ? 'active' : ''}`}
                  >
                    <div>
                      <div className="tpl-card-top">
                        <h3 className="tpl-card-title">{tpl.name}</h3>
                        <span className="tpl-copies-badge">Mặc định: {tpl.copies || 1} hàng ({ (tpl.copies || 1) * 2 } tem)</span>
                      </div>

                      {/* Mẫu in 1 tem trực quan 35x22mm */}
                      <TemplateSingleLabelPreview tpl={tpl} onClick={() => applyTemplateToPrint(tpl)} />
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
                        <span>Nạp vào bàn in</span>
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
                          setEditFormData({ ...tpl });
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
                  ↺ Khôi phục chuẩn gốc (-1.5, +1.5)
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
                <div><strong>Tên tem:</strong> {product}</div>
                <div><strong>Giá:</strong> {price} | <strong>Barcode:</strong> {barcode}</div>
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

              <div className="form-row-2 form-group">
                <div>
                  <label className="form-label">Thương hiệu</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editFormData.brand || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, brand: e.target.value })}
                    placeholder="TIẾN UYÊN"
                  />
                </div>
                <div>
                  <label className="form-label">Tên in trên tem</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editFormData.product}
                    onChange={(e) => setEditFormData({ ...editFormData, product: e.target.value })}
                    placeholder="TRỐNG BÔNG 04"
                  />
                </div>
              </div>

              <div className="form-row-2 form-group">
                <div>
                  <label className="form-label">Giá bán</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editFormData.price}
                    onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
                    placeholder="320.000đ"
                  />
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
                  onClick={() => {
                    fetch('/api/templates/open-folder', { method: 'POST' });
                    triggerToast('📁 Đang gọi mở File Explorer...');
                  }}
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
    </div>
  );
}
