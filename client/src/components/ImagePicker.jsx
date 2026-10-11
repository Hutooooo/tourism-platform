import { useRef, useState } from 'react';
import { api, mediaUrl } from '../api/client';
import { FormField } from './FormField';

/**
 * Image field for admin forms.
 *
 * Supports three ways to set a value:
 *   1. Upload a file (goes through the server's magic-byte + type checks)
 *   2. Paste any URL
 *   3. Pick from the media library
 *
 * Emits the value the API expects — an absolute URL, an /api/media/... path,
 * or any external URL — via `onChange`.
 */
export default function ImagePicker({ id, label = 'Image', value, onChange, hint }) {
  const fileRef = useRef(null);
  const [mode, setMode] = useState('url');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [library, setLibrary] = useState(null); // null = not loaded

  async function uploadFile(file) {
    setError(null);
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setError('That file is larger than 6MB.');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/media', fd);
      onChange(res.url);
      setMode('url');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function openLibrary() {
    if (library === null) {
      try {
        const data = await api.get('/media?limit=60');
        setLibrary(data || []);
      } catch (err) {
        setError(err.message);
        return;
      }
    }
    setMode((m) => (m === 'library' ? 'url' : 'library'));
  }

  const preview = value ? mediaUrl(value) : '';

  return (
    <div className="field">
      <span className="field__label" id={`${id}-label`}>
        {label}
      </span>

      <div className="row" style={{ gap: '0.5rem', marginBottom: '0.7rem' }}>
        <button
          type="button"
          className={`btn btn--sm ${mode === 'url' ? '' : 'btn--outline'}`}
          onClick={() => setMode('url')}
          aria-pressed={mode === 'url'}
        >
          URL
        </button>
        <button
          type="button"
          className="btn btn--sm btn--outline"
          onClick={() => fileRef.current && fileRef.current.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : 'Upload file'}
        </button>
        <button
          type="button"
          className={`btn btn--sm ${mode === 'library' ? '' : 'btn--outline'}`}
          onClick={openLibrary}
          aria-pressed={mode === 'library'}
        >
          Media library
        </button>
        {value && (
          <button type="button" className="btn btn--sm btn--outline" onClick={() => onChange('')}>
            Clear
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => uploadFile(e.target.files && e.target.files[0])}
      />

      {mode === 'url' && (
        <input
          id={id}
          className="input"
          type="url"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or /api/media/…"
          aria-labelledby={`${id}-label`}
        />
      )}

      {mode === 'library' && (
        <div
          style={{
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.8rem',
            maxHeight: 260,
            overflow: 'auto',
            background: '#fff',
          }}
        >
          {!library || library.length === 0 ? (
            <p className="muted" style={{ fontSize: '0.9rem' }}>
              No uploads yet. Use “Upload file” to add one.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: '0.5rem' }}>
              {library.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChange(m.url);
                    setMode('url');
                  }}
                  title={m.filename}
                  style={{
                    padding: 0,
                    border: value === m.url ? '2px solid var(--teal-600)' : '1.5px solid var(--line)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: 'var(--paper-warm)',
                    aspectRatio: '4/3',
                  }}
                >
                  <img src={m.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}

      {preview && (
        <div style={{ marginTop: '0.7rem', display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <img
            src={preview}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            style={{ width: 110, height: 74, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }}
          />
          <span className="field__hint" style={{ margin: 0 }}>
            {hint || 'Preview of the current image.'}
          </span>
        </div>
      )}

      {!preview && hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}
