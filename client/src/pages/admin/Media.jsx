import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { useSeo } from '../../hooks/useSeo';
import { Alert } from '../../components/FormField';

function formatBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function MediaAdmin() {
  useSeo({ title: 'Media — Dashboard' });

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/media?limit=120');
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(files) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setNotice(null);

    const results = [];
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post('/media', fd);
        results.push(res);
      } catch (err) {
        setNotice({ type: 'error', text: `${file.name}: ${err.message}` });
      }
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    if (results.length) {
      setNotice({ type: 'success', text: `Uploaded ${results.length} file${results.length === 1 ? '' : 's'}.` });
      await load();
    }
  }

  async function copyUrl(url) {
    try {
      await navigator.clipboard.writeText(url);
      setNotice({ type: 'success', text: 'URL copied to clipboard.' });
    } catch {
      setNotice({ type: 'info', text: url });
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete ${item.filename}? Anywhere it is used will lose the image.`)) return;
    try {
      await api.del(`/media/${item.id}`);
      setItems((prev) => prev.filter((m) => m.id !== item.id));
      setNotice({ type: 'success', text: 'File deleted.' });
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 20 }}>
        <div>
          <div className="eyebrow">Assets</div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 1.3rem + 1.2vw, 2.1rem)' }}>Media library</h1>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn"
            disabled={uploading}
            onClick={() => fileRef.current && fileRef.current.click()}
          >
            {uploading ? 'Uploading…' : '+ Upload images'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            multiple
            className="sr-only"
            onChange={(e) => upload(e.target.files)}
          />
        </div>
      </div>

      <Alert type="error">{error}</Alert>
      {notice && <Alert type={notice.type}>{notice.text}</Alert>}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
        style={{
          border: '2px dashed var(--line)',
          borderRadius: 'var(--radius)',
          padding: '1rem',
          background: '#fff',
        }}
      >
        {loading ? (
          <div className="grid grid--4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 130 }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="center" style={{ padding: '3rem 1rem' }}>
            <h3>No images yet</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Drag files here, or use the upload button above.
            </p>
          </div>
        ) : (
          <div className="grid grid--4">
            {items.map((m) => (
              <figure
                key={m.id}
                className="card"
                style={{ margin: 0 }}
              >
                <div className="card__media" style={{ aspectRatio: '4/3' }}>
                  <img src={m.url} alt={m.alt || m.filename} loading="lazy" />
                </div>
                <figcaption className="card__body" style={{ padding: '0.8rem' }}>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={m.filename}
                  >
                    {m.filename}
                  </div>
                  <div className="muted" style={{ fontSize: '0.75rem', marginBottom: '0.6rem' }}>
                    {formatBytes(m.size)} · {m.mime.replace('image/', '').toUpperCase()}
                  </div>
                  <div className="row" style={{ gap: '0.35rem' }}>
                    <button type="button" className="btn btn--outline btn--sm" onClick={() => copyUrl(m.url)}>
                      Copy URL
                    </button>
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => remove(m)}>
                      Delete
                    </button>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
