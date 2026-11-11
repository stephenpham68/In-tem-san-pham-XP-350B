import { useEffect, useMemo, useRef, useState } from 'react';
import TextFormatToolbar from './TextFormatToolbar.jsx';
import { DEFAULT_TEXT_OPTIONS, computeAutoFitTextLayout, drawAutoFitTextBox, normalizeTextOptions } from '../utils/textAutoFit.js';

const MM = 8; // 203 DPI: 8 dots/mm
const A6_CONFIG_KEY = 'xp_a6_printer_config_v1';
const A6_DRAFT_KEY = 'xp_a6_text_draft_v1';
const A6_PRINTER_KEY = 'xp_a6_selected_printer_v1';

const PAPER_PRESETS = {
  '100x150': { label: '100 × 150 mm (Đơn A6 TMĐT)', paperWidth: 100, paperHeight: 150 },
  '105x148': { label: '105 × 148 mm (Khổ A6 chuẩn)', paperWidth: 105, paperHeight: 148 },
  '100x100': { label: '100 × 100 mm (Tem vuông lớn)', paperWidth: 100, paperHeight: 100 },
  custom: { label: 'Tùy chỉnh kích thước (mm)', paperWidth: 100, paperHeight: 150 },
};

const DEFAULT_A6_CONFIG = {
  paperPreset: '100x150',
  paperWidth: 100,
  paperHeight: 150,
  orientation: 'landscape', // 'landscape' | 'portrait'
  gap: 2,
  paddingMm: 5,
  offsetX: 0,
  offsetY: 0,
  density: 8,
  printMode: 'auto', // 'auto' | 'tspl' | 'gdi'
};

function getDesignDimensions(config) {
  const pw = Math.max(20, Math.min(120, Number(config.paperWidth) || 100));
  const ph = Math.max(20, Math.min(220, Number(config.paperHeight) || 150));
  if (config.orientation === 'landscape') {
    return {
      widthMm: Math.max(pw, ph),
      heightMm: Math.min(pw, ph),
      rotateForPrint: pw < ph ? 90 : 0,
    };
  }
  return {
    widthMm: Math.min(pw, ph),
    heightMm: Math.max(pw, ph),
    rotateForPrint: pw > ph ? 90 : 0,
  };
}

function renderA6Canvas(canvas, config, text, textOptions) {
  if (!canvas) return null;
  const { widthMm, heightMm } = getDesignDimensions(config);
  const w = Math.round(widthMm * MM);
  const h = Math.round(heightMm * MM);
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const pad = Math.round((Number(config.paddingMm) || 0) * MM);
  const offX = Math.round((Number(config.offsetX) || 0) * MM);
  const offY = Math.round((Number(config.offsetY) || 0) * MM);

  const safeX = Math.max(0, pad + offX);
  const safeY = Math.max(0, pad + offY);
  const safeW = Math.max(40, w - pad * 2);
  const safeH = Math.max(40, h - pad * 2);

  return drawAutoFitTextBox(ctx, safeX, safeY, safeW, safeH, text, textOptions);
}

export default function A6PrintTab({ onStatusChange, triggerToast }) {
  const canvasRef = useRef(null);
  const textareaRef = useRef(null);

  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(A6_CONFIG_KEY);
      if (saved) return { ...DEFAULT_A6_CONFIG, ...JSON.parse(saved) };
    } catch (_) {}
    return DEFAULT_A6_CONFIG;
  });

  const [draft, setDraft] = useState(() => {
    try {
      const saved = localStorage.getItem(A6_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          text: parsed.text ?? 'HỒNG LOAN\nKIÊN GIANG',
          textOptions: normalizeTextOptions(parsed.textOptions),
          batchMode: Boolean(parsed.batchMode),
        };
      }
    } catch (_) {}
    return {
      text: 'HỒNG LOAN\nKIÊN GIANG',
      textOptions: { ...DEFAULT_TEXT_OPTIONS },
      batchMode: false,
    };
  });

  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(() => {
    try {
      return localStorage.getItem(A6_PRINTER_KEY) || '';
    } catch (_) {}
    return '';
  });
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [copies, setCopies] = useState(1);
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [computedFontPx, setComputedFontPx] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(A6_CONFIG_KEY, JSON.stringify(config));
    } catch (_) {}
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem(A6_DRAFT_KEY, JSON.stringify(draft));
    } catch (_) {}
  }, [draft]);

  useEffect(() => {
    try {
      if (selectedPrinter) localStorage.setItem(A6_PRINTER_KEY, selectedPrinter);
    } catch (_) {}
  }, [selectedPrinter]);

  async function refreshPrinters() {
    setLoadingPrinters(true);
    try {
      const res = await fetch('/api/printers');
      const json = await res.json();
      if (json.ok && Array.isArray(json.printers)) {
        setPrinters(json.printers);
        setSelectedPrinter((prev) => {
          if (prev && json.printers.some((p) => p.name === prev)) return prev;
          return json.recommendedA6 || json.printers[0]?.name || '';
        });
      }
    } catch (_) {
      onStatusChange({ kind: 'error', text: 'Không kết nối được print agent' });
    } finally {
      setLoadingPrinters(false);
    }
  }

  useEffect(() => {
    refreshPrinters();
  }, []);

  useEffect(() => {
    if (!selectedPrinter) {
      onStatusChange({ kind: 'error', text: 'Chưa chọn máy in A6' });
      return;
    }
    fetch(`/api/status?printer=${encodeURIComponent(selectedPrinter)}`)
      .then((r) => r.json())
      .then((res) => onStatusChange({ kind: res.ready ? 'ok' : 'error', text: res.message }))
      .catch(() => onStatusChange({ kind: 'error', text: 'Local print agent chưa chạy' }));
  }, [selectedPrinter, printers]);

  const pages = useMemo(() => {
    if (!draft.batchMode) return [draft.text];
    const blocks = String(draft.text || '')
      .split(/^\s*---+\s*$/m)
      .map((b) => b.replace(/^\n+|\n+$/g, ''))
      .filter((b) => b.trim().length > 0);
    return blocks.length ? blocks : [''];
  }, [draft.text, draft.batchMode]);

  const safePageIdx = Math.min(activePageIdx, Math.max(0, pages.length - 1));
  const currentPageText = pages[safePageIdx] ?? '';
  const designDims = useMemo(() => getDesignDimensions(config), [config]);

  useEffect(() => {
    if (safePageIdx !== activePageIdx) {
      setActivePageIdx(safePageIdx);
    }
  }, [safePageIdx, activePageIdx]);

  useEffect(() => {
    const layout = renderA6Canvas(canvasRef.current, config, currentPageText, draft.textOptions);
    setComputedFontPx(layout ? layout.fontSize : 0);
  }, [config, currentPageText, draft.textOptions]);

  function handlePresetChange(presetKey) {
    const preset = PAPER_PRESETS[presetKey] || PAPER_PRESETS['100x150'];
    setConfig((prev) => ({
      ...prev,
      paperPreset: presetKey,
      ...(presetKey !== 'custom' ? { paperWidth: preset.paperWidth, paperHeight: preset.paperHeight } : {}),
    }));
  }

  function handleAddBatchPage() {
    setDraft((prev) => {
      const cleaned = String(prev.text || '').replace(/\s+$/, '');
      const nextText = cleaned ? `${cleaned}\n---\n` : '';
      return {
        ...prev,
        batchMode: true,
        text: nextText,
      };
    });
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
      }
      setActivePageIdx(pages.length);
    }, 30);
  }

  function renderPageToDataUrl(pageText) {
    const offscreen = document.createElement('canvas');
    renderA6Canvas(offscreen, config, pageText, draft.textOptions);
    return offscreen.toDataURL('image/png');
  }

  async function handlePrintA6() {
    if (!selectedPrinter) {
      alert('Vui lòng chọn máy in A6 trước khi in.');
      return;
    }
    const printablePages = pages.filter((p) => p.trim().length > 0);
    if (printablePages.length === 0) {
      alert('Vui lòng nhập nội dung text cần in.');
      return;
    }

    setPrinting(true);
    onStatusChange({ kind: 'busy', text: `Đang gửi lệnh in tới ${selectedPrinter}…` });
    try {
      const images = printablePages.map((p) => renderPageToDataUrl(p));
      const response = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printer: selectedPrinter,
          printMode: config.printMode,
          images,
          copies: Number(copies) || 1,
          settings: {
            paperWidth: Number(config.paperWidth) || 100,
            paperHeight: Number(config.paperHeight) || 150,
            gap: Number(config.gap) || 2,
            density: Number(config.density) || 8,
            rotate: config.printMode === 'gdi' ? 0 : designDims.rotateForPrint,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || 'Lỗi gửi lệnh in A6');
      onStatusChange({ kind: 'ok', text: result.message });
      triggerToast(`✓ ${result.message}`);
    } catch (error) {
      onStatusChange({ kind: 'error', text: error.message });
      alert('Lỗi in A6: ' + error.message);
    } finally {
      setPrinting(false);
    }
  }

  function handleDownloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `tem-a6-${safePageIdx + 1}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  const selectedPrinterObj = printers.find((p) => p.name === selectedPrinter);

  return (
    <div className="print-workspace-grid a6-workspace-grid">
      {/* LEFT: Input & Settings */}
      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">In Nội Dung Text — Đơn A6</span>
          <span className="badge-tag" style={{ background: '#ecfeff', color: '#0e7490', borderColor: '#a5f3fc' }}>
            Auto-fit to hết cỡ
          </span>
        </div>

        {/* Printer Selector */}
        <div className="form-group">
          <div className="form-label-row">
            <label className="form-label">Máy in A6</label>
            <button
              type="button"
              className="btn-link"
              onClick={refreshPrinters}
              disabled={loadingPrinters}
            >
              {loadingPrinters ? 'Đang quét…' : '↻ Quét lại máy in'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="form-control"
              value={selectedPrinter}
              onChange={(e) => setSelectedPrinter(e.target.value)}
            >
              <option value="">-- Chọn máy in A6 --</option>
              {printers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.online ? '🟢' : '⚪'} {p.name} {p.port ? `(${p.port})` : ''} {!p.online ? '— Offline' : ''}
                </option>
              ))}
            </select>
          </div>
          {selectedPrinterObj && !selectedPrinterObj.online && (
            <div className="a6-warn-note">
              ⚠️ Máy in <strong>{selectedPrinterObj.name}</strong> đang Offline. Kiểm tra nguồn điện hoặc cáp USB trước khi in.
            </div>
          )}
        </div>

        {/* Paper Size & Orientation */}
        <div className="form-row-2 form-group">
          <div>
            <label className="form-label">Khổ giấy cuộn / tệp</label>
            <select
              className="form-control"
              value={config.paperPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
            >
              {Object.entries(PAPER_PRESETS).map(([key, item]) => (
                <option key={key} value={key}>{item.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Hướng nội dung</label>
            <div className="layout-toggle-pill" style={{ marginTop: 0 }}>
              <button
                type="button"
                className={`btn-layout-pill ${config.orientation === 'landscape' ? 'active' : ''}`}
                onClick={() => setConfig((c) => ({ ...c, orientation: 'landscape' }))}
              >
                <span>Ngang ({Math.max(config.paperWidth, config.paperHeight)}×{Math.min(config.paperWidth, config.paperHeight)})</span>
              </button>
              <button
                type="button"
                className={`btn-layout-pill ${config.orientation === 'portrait' ? 'active' : ''}`}
                onClick={() => setConfig((c) => ({ ...c, orientation: 'portrait' }))}
              >
                <span>Dọc ({Math.min(config.paperWidth, config.paperHeight)}×{Math.max(config.paperWidth, config.paperHeight)})</span>
              </button>
            </div>
          </div>
        </div>

        {config.paperPreset === 'custom' && (
          <div className="form-row-2 form-group">
            <div>
              <label className="form-label">Chiều rộng đầu in (mm)</label>
              <input
                type="number"
                min={30}
                max={120}
                className="form-control"
                value={config.paperWidth}
                onChange={(e) => setConfig((c) => ({ ...c, paperWidth: Number(e.target.value) || 100 }))}
              />
            </div>
            <div>
              <label className="form-label">Chiều dài tờ giấy (mm)</label>
              <input
                type="number"
                min={30}
                max={220}
                className="form-control"
                value={config.paperHeight}
                onChange={(e) => setConfig((c) => ({ ...c, paperHeight: Number(e.target.value) || 150 }))}
              />
            </div>
          </div>
        )}

        {/* Text Editor + Formatting Toolbar */}
        <div className="form-group">
          <div className="form-label-row">
            <label className="form-label" style={{ color: '#0f172a' }}>
              Nội dung cần in (nhấn Enter để xuống hàng)
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-link"
                onClick={() => setDraft((d) => ({ ...d, text: '' }))}
              >
                Xóa chữ
              </button>
            </div>
          </div>

          <TextFormatToolbar
            value={draft.textOptions}
            onChange={(nextOpts) => setDraft((d) => ({ ...d, textOptions: nextOpts }))}
          />

          <textarea
            ref={textareaRef}
            className="form-control text-area-editor a6-textarea"
            rows={draft.batchMode ? 7 : 5}
            value={draft.text}
            onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
            placeholder={'Nhập nội dung bất kỳ...\nVí dụ:\nHỒNG LOAN\nKIÊN GIANG'}
          />

          <div className="a6-batch-bar">
            <label className="a6-checkbox-label">
              <input
                type="checkbox"
                checked={draft.batchMode}
                onChange={(e) => setDraft((d) => ({ ...d, batchMode: e.target.checked }))}
              />
              <span>In nhiều tờ liên tiếp (ngăn cách bằng <code>---</code>)</span>
            </label>

            <button
              type="button"
              className="btn-subtle"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              onClick={handleAddBatchPage}
            >
              + Thêm tờ mới (---)
            </button>
          </div>
        </div>

        {/* Collapsible Margin & Offset Settings */}
        <div className="a6-advanced-box">
          <button
            type="button"
            className="a6-advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <span>⚙️ Căn lề, Gap & Chế độ in ({config.paddingMm}mm lề · Gap {config.gap}mm)</span>
            <span>{showAdvanced ? '▲' : '▼'}</span>
          </button>

          {showAdvanced && (
            <div className="a6-advanced-body">
              <div className="form-row-2 form-group">
                <div>
                  <label className="form-label">Lề an toàn 4 phía (mm)</label>
                  <input
                    type="number"
                    min={0}
                    max={25}
                    step={0.5}
                    className="form-control"
                    value={config.paddingMm}
                    onChange={(e) => setConfig((c) => ({ ...c, paddingMm: Math.max(0, Number(e.target.value) || 0) }))}
                  />
                </div>
                <div>
                  <label className="form-label">Bước nhảy khe giấy Gap (mm)</label>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    step={0.5}
                    className="form-control"
                    value={config.gap}
                    onChange={(e) => setConfig((c) => ({ ...c, gap: Math.max(0, Number(e.target.value) || 0) }))}
                  />
                </div>
              </div>

              <div className="form-row-2 form-group">
                <div>
                  <label className="form-label">Dời ngang X (mm)</label>
                  <input
                    type="number"
                    step={0.5}
                    className="form-control"
                    value={config.offsetX}
                    onChange={(e) => setConfig((c) => ({ ...c, offsetX: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="form-label">Dời dọc Y (mm)</label>
                  <input
                    type="number"
                    step={0.5}
                    className="form-control"
                    value={config.offsetY}
                    onChange={(e) => setConfig((c) => ({ ...c, offsetY: Number(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="form-row-2 form-group" style={{ marginBottom: 0 }}>
                <div>
                  <label className="form-label">Độ đậm mực nhiệt (1–15)</label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    className="form-control"
                    value={config.density}
                    onChange={(e) => setConfig((c) => ({ ...c, density: Math.max(1, Math.min(15, parseInt(e.target.value) || 8)) }))}
                  />
                </div>
                <div>
                  <label className="form-label">Kiểu truyền lệnh in</label>
                  <select
                    className="form-control"
                    value={config.printMode}
                    onChange={(e) => setConfig((c) => ({ ...c, printMode: e.target.value }))}
                  >
                    <option value="auto">Tự động (TSPL cho máy in nhiệt)</option>
                    <option value="tspl">TSPL RAW (Nhanh & sắc nét)</option>
                    <option value="gdi">Windows Driver (PDF / Driver thường)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Copies & Print Button */}
        <div className="form-group" style={{ paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          <div className="form-label-row">
            <label className="form-label">Số bản in mỗi tờ</label>
            <span className="badge-tag" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
              {pages.length > 1 ? `${pages.length} tờ × ${copies} bản = ${pages.length * copies} tờ` : `${copies} tờ A6`}
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
              max={100}
              className="copies-input"
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
            />
            <button
              type="button"
              className="btn-step"
              onClick={() => setCopies(Math.min(100, (Number(copies) || 1) + 1))}
            >
              +
            </button>
            <button type="button" className="btn-preset" onClick={() => setCopies((Number(copies) || 0) + 2)}>+2</button>
            <button type="button" className="btn-preset" onClick={() => setCopies((Number(copies) || 0) + 5)}>+5</button>
            <button type="button" className="btn-preset" onClick={() => setCopies((Number(copies) || 0) + 10)}>+10</button>
          </div>
        </div>

        <button
          type="button"
          className="btn-primary-print"
          disabled={printing}
          onClick={handlePrintA6}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          <span>
            {printing
              ? 'Đang gửi lệnh in A6…'
              : pages.length > 1
                ? `In Tất Cả ${pages.length} Tờ A6 Ngay`
                : 'In Nhiệt A6 Ngay'}
          </span>
        </button>
      </div>

      {/* RIGHT: Live Preview */}
      <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="panel-header" style={{ width: '100%' }}>
          <span className="panel-title">Xem Trước Tờ A6 Thực Tế</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="tab-badge" style={{ background: '#f1f5f9', color: '#334155' }}>
              {designDims.widthMm}×{designDims.heightMm}mm · Font {computedFontPx}px
            </span>
            <button
              type="button"
              className="btn-subtle"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              onClick={handleDownloadPng}
              title="Tải ảnh PNG của tờ hiện tại"
            >
              💾 PNG
            </button>
          </div>
        </div>

        {pages.length > 1 && (
          <div className="a6-batch-nav">
            <button
              type="button"
              className="btn-subtle"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              disabled={safePageIdx <= 0}
              onClick={() => setActivePageIdx((i) => Math.max(0, i - 1))}
            >
              ◀ Trước
            </button>
            <div className="a6-page-pills">
              {pages.map((p, idx) => {
                const firstLine = (p.split('\n').find((l) => l.trim()) || `Tờ ${idx + 1}`).trim();
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`a6-page-pill ${idx === safePageIdx ? 'active' : ''}`}
                    onClick={() => setActivePageIdx(idx)}
                    title={p}
                  >
                    <strong>{idx + 1}.</strong> {firstLine.slice(0, 16)}{firstLine.length > 16 ? '…' : ''}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="btn-subtle"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              disabled={safePageIdx >= pages.length - 1}
              onClick={() => setActivePageIdx((i) => Math.min(pages.length - 1, i + 1))}
            >
              Sau ▶
            </button>
          </div>
        )}

        <div className="preview-canvas-box a6-preview-box" style={{ width: '100%' }}>
          <div className={`a6-canvas-wrapper ${config.orientation}`}>
            <canvas ref={canvasRef} className="a6-preview-canvas" />
            {!currentPageText.trim() && (
              <div className="a6-empty-overlay">Nhập nội dung bên trái để xem trước…</div>
            )}
          </div>

          <div className="preview-tags-row">
            <span>
              <i className="preview-tag-dot" style={{ background: '#0ea5e9' }}></i>
              Khổ in vật lý: {config.paperWidth}×{config.paperHeight}mm
            </span>
            <span>
              <i className="preview-tag-dot" style={{ background: '#10b981' }}></i>
              {config.orientation === 'landscape' ? 'Tự xoay 90° khi in Ngang' : 'In thẳng Dọc'}
            </span>
            <span>
              <i className="preview-tag-dot" style={{ background: '#6366f1' }}></i>
              Lề an toàn: {config.paddingMm}mm
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
