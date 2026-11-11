import { normalizeTextOptions } from '../utils/textAutoFit.js';

export default function TextFormatToolbar({ value, onChange }) {
  const opts = normalizeTextOptions(value);

  const update = (patch) => {
    onChange({ ...opts, ...patch });
  };

  return (
    <div className="text-format-toolbar">
      <div className="text-format-group">
        <button
          type="button"
          className={`btn-fmt-pill ${opts.wrapMode === 'explicit' ? 'active' : ''}`}
          onClick={() => update({ wrapMode: 'explicit' })}
          title="Giữ nguyên từng dòng bạn bấm Enter xuống hàng"
        >
          ↵ Giữ dòng Enter
        </button>
        <button
          type="button"
          className={`btn-fmt-pill ${opts.wrapMode === 'wrap' ? 'active' : ''}`}
          onClick={() => update({ wrapMode: 'wrap' })}
          title="Tự động xuống dòng khi câu dài"
        >
          ↩ Tự ngắt dòng
        </button>
      </div>

      <div className="text-format-group">
        <button
          type="button"
          className={`btn-fmt-pill ${opts.align === 'center' ? 'active' : ''}`}
          onClick={() => update({ align: 'center' })}
          title="Căn giữa ngang"
        >
          ≡ Căn giữa
        </button>
        <button
          type="button"
          className={`btn-fmt-pill ${opts.align === 'left' ? 'active' : ''}`}
          onClick={() => update({ align: 'left' })}
          title="Căn lề trái"
        >
          ⫷ Căn trái
        </button>
      </div>

      <div className="text-format-group">
        <button
          type="button"
          className={`btn-fmt-pill ${opts.bold ? 'active' : ''}`}
          onClick={() => update({ bold: !opts.bold })}
          title="Bật/tắt chữ in đậm"
        >
          <strong>B</strong> Đậm
        </button>
        <button
          type="button"
          className={`btn-fmt-pill ${opts.uppercase ? 'active' : ''}`}
          onClick={() => update({ uppercase: !opts.uppercase })}
          title="Tự động chuyển sang CHỮ IN HOA"
        >
          AA Hoa
        </button>
      </div>
    </div>
  );
}
