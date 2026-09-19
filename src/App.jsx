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

function fitText(ctx, text, maxWidth, startSize, weight = 400) {
  let size = startSize;
  while (size > 11) {
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

  // 1. Chữ thương hiệu 'TIẾN UYÊN' xoay dọc bên trái
  // safeH = 160 dots (tương ứng 20 mm). Căn giữa dọc tại safeY + safeH / 2.
  ctx.save();
  ctx.translate(safeX + 18, safeY + safeH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 22px Arial, sans-serif';
  ctx.fillText('TIẾN UYÊN', 0, 0);
  ctx.restore();

  // 2. Cột thông tin sản phẩm và mã vạch
  const contentX = safeX + 40;
  const contentW = safeW - 42; // ~222 dots (~27.75 mm)

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
  const width = Math.round(config.paperWidth * scale);
  const height = Math.round(config.labelHeight * scale);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const startX1 = Math.round((config.leftMargin + config.offsetX) * scale);
  const startX2 = Math.round((config.leftMargin + config.labelWidth + config.columnGap + config.offsetX) * scale);
  const startY = Math.round(config.offsetY * scale);

  drawLabel(ctx, startX1, startY, config, data);
  drawLabel(ctx, startX2, startY, config, data);
}

function renderCalibrationCanvas(canvas, config) {
  const scale = MM;
  const width = Math.round(config.paperWidth * scale);
  const height = Math.round(config.labelHeight * scale); // Vẫn giữ 22mm = 176 dots để TSPL kéo đúng 1 bước tem
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const startX1 = Math.round((config.leftMargin + config.offsetX) * scale);
  const startX2 = Math.round((config.leftMargin + config.labelWidth + config.columnGap + config.offsetX) * scale);
  const startY = Math.round(config.offsetY * scale);

  const frameW = Math.round((config.frameWidth || config.labelWidth) * scale);
  const frameH = Math.round((config.frameHeight || config.labelHeight) * scale); // Chuẩn đầy đủ 22 mm (hoặc tùy chỉnh)
  const half = config.lineWidth / 2;

  // 1. Viền ngoài khung test (vẽ nét đen dày theo thông số khóa chuẩn để test mép decal)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = config.lineWidth;
  ctx.strokeRect(startX1 + half, startY + half, frameW - config.lineWidth, frameH - config.lineWidth);
  ctx.strokeRect(startX2 + half, startY + half, frameW - config.lineWidth, frameH - config.lineWidth);

  // 2. Viền trong: Vùng an toàn Safe Inset (lùi 1mm)
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
  const [mode, setMode] = useState('label');
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch (_) {}
    return DEFAULT_CONFIG;
  });

  const [product, setProduct] = useState('TRỐNG BÔNG 04');
  const [price, setPrice] = useState('320.000đ');
  const [barcode, setBarcode] = useState('893751041');
  const [copies, setCopies] = useState(1);
  const [showOffset, setShowOffset] = useState(false);
  const [status, setStatus] = useState({ kind: 'idle', text: 'Đang kiểm tra máy in…' });
  const data = { product: product.trim() || 'SẢN PHẨM', price: price.trim() || '0đ', barcode: barcode.trim() || '0' };

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
  }, [product, price, barcode, mode, config]);

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
      if (!response.ok) throw new Error(result.message || 'Không thể in');
      setStatus({ kind: 'ok', text: result.message });
    } catch (error) {
      setStatus({ kind: 'error', text: error.message });
    }
  }

  function resetDefaultConfig() {
    setConfig(DEFAULT_CONFIG);
  }

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
      <header className="topbar">
        <div>
          <p className="eyebrow">TIẾN UYÊN</p>
          <h1>In tem sản phẩm</h1>
        </div>
        <div className={`status status-${status.kind}`}><span />{status.text}</div>
      </header>

      <section className="workspace">
        <form noValidate className="controls" onSubmit={(event) => { event.preventDefault(); printLabels(); }}>
          <div className="mode-tabs" role="tablist" aria-label="Chế độ in">
            <button type="button" role="tab" aria-selected={mode === 'label'} className={mode === 'label' ? 'active' : ''} onClick={() => setMode('label')}>In tem</button>
            <button type="button" role="tab" aria-selected={mode === 'calibration'} className={mode === 'calibration' ? 'active' : ''} onClick={() => setMode('calibration')}>Căn khung</button>
          </div>
          <div className="section-heading">
            <span>01</span>
            <div>
              <h2>{mode === 'calibration' ? 'Căn chỉnh khung test' : 'Nội dung tem'}</h2>
              <p>{mode === 'calibration' ? 'Khung in test đã giảm 50% chiều cao (11 mm) để dễ quan sát vị trí dừng tem.' : 'In 2 tem trên một hàng giấy.'}</p>
            </div>
          </div>

          {mode === 'label' ? <>
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
                    <button
                      type="button"
                      title="Khôi phục chuẩn mặc định hoàn hảo (-1.5, +1.5, 0.4 mm)"
                      style={{ padding: '4px 8px', border: '1px solid #d0d5dd', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={resetDefaultConfig}
                    >
                      ↺ Mặc định
                    </button>
                  </div>
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
                        onChange={(e) => setConfig(c => ({ ...c, columnGap: Math.max(0, Number(e.target.value)) }))}
                        style={{ width: '52px', padding: '5px 2px', fontSize: '13px', textAlign: 'center', borderRadius: '6px' }}
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
          </> : <>
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
          </>}

          <label>Số hàng in<input type="number" min="1" max="100" value={copies} onChange={(event) => setCopies(event.target.value)} /></label>

          <button className="print-button" type="submit" disabled={status.kind === 'busy'}>
            <span className="printer-icon" aria-hidden="true">▣</span>
            {status.kind === 'busy' ? 'Đang in…' : mode === 'calibration' ? 'In khung kiểm tra' : 'In XP-350B'}
          </button>
          <p className="print-note">
            Khổ cuộn {config.paperWidth} mm · 2 tem {config.labelWidth} × {config.labelHeight} mm · Gap dọc {config.gap} mm · 203 DPI (8 dots/mm)
          </p>
        </form>

        <div className="preview-panel">
          <div className="section-heading preview-heading">
            <span>02</span>
            <div>
              <h2>{mode === 'calibration' ? `Khung kiểm tra (Cao ${config.frameHeight} mm)` : 'Xem trước bản in'}</h2>
              <p>Hình ảnh bitmap kích thước {Math.round(config.paperWidth * MM)} × {Math.round(config.labelHeight * MM)} dots gửi tới máy in.</p>
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
                  borderRadius: '8px',
                  pointerEvents: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: `${Math.max(0, (config.offsetY / config.labelHeight) * 100)}%`,
                  left: `${left2Pct}%`,
                  width: `${w2Pct}%`,
                  height: '100%',
                  border: '1.5px dashed rgba(37, 99, 235, 0.65)',
                  borderRadius: '8px',
                  pointerEvents: 'none',
                  boxSizing: 'border-box',
                }}
              />

              {/* Vạch rãnh chia giữa 2 tem chuẩn xác theo số đo */}
              <div
                style={{
                  position: 'absolute',
                  top: '-12px',
                  bottom: '-12px',
                  left: `${centerGapPct}%`,
                  width: '2px',
                  background: '#2563eb',
                  boxShadow: '0 0 8px rgba(37, 99, 235, 0.8)',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              />
            </div>

            <div className="measure measure-top" style={{ display: 'block', position: 'absolute', left: '28px', right: '28px', top: '18px' }}>
              <span style={{ position: 'absolute', left: `${left1Pct}%`, width: `${w1Pct}%`, borderTop: '2px solid #3b82f6', paddingTop: '4px', textAlign: 'center', color: '#93c5fd', fontSize: '12px' }}>
                Tem 1 (35 × 22 mm)
              </span>
              <span style={{ position: 'absolute', left: `${left2Pct}%`, width: `${w2Pct}%`, borderTop: '2px solid #3b82f6', paddingTop: '4px', textAlign: 'center', color: '#93c5fd', fontSize: '12px' }}>
                Tem 2 (35 × 22 mm)
              </span>
            </div>
          </div>
          <div className="legend">
            <span><i className="dot-white" />Nền trắng</span>
            <span><i className="dot-black" />Phần đốt nhiệt</span>
            <span><i style={{ border: '1.5px dashed #2563eb', background: '#eff6ff' }} />Khuôn tem 35 × 22 mm</span>
            <span><i style={{ width: '3px', height: '14px', background: '#2563eb' }} />Rãnh giữa 2 tem</span>
          </div>
        </div>
      </section>
    </main>
  );
}
