import { useState } from 'react';

const DEV_HOST = 'timesheet-dev.clearcomputing.be';
const PROXY_BASE = import.meta.env.VITE_AI_PROXY_URL ?? 'http://127.0.0.1:3579';
const SESSION_KEY = 'deploy_token';

function getOrAskToken(): string | null {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) return stored;
  const entered = window.prompt('Deploy token:');
  if (!entered) return null;
  sessionStorage.setItem(SESSION_KEY, entered);
  return entered;
}

type Status = 'idle' | 'loading' | 'ok' | 'error';

function useDeployAction(endpoint: string) {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const trigger = async () => {
    const token = getOrAskToken();
    if (!token) return;
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch(`${PROXY_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'x-deploy-token': token },
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('ok');
        setMessage('Done');
      } else {
        if (res.status === 403) sessionStorage.removeItem(SESSION_KEY);
        setStatus('error');
        setMessage(data.error ?? 'Error');
      }
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Network error');
    }
    setTimeout(() => { setStatus('idle'); setMessage(''); }, 4000);
  };

  return { status, message, trigger };
}

export function DevDeployButtons() {
  if (typeof window !== 'undefined' && window.location.hostname !== DEV_HOST) return null;

  const dev = useDeployAction('/deploy/dev');
  const prod = useDeployAction('/deploy/prod');

  const btnStyle = (s: Status, color: string): React.CSSProperties => ({
    padding: '5px 11px',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 600,
    border: 'none',
    borderRadius: 5,
    cursor: s === 'loading' ? 'not-allowed' : 'pointer',
    opacity: s === 'loading' ? 0.6 : 1,
    background: s === 'ok' ? '#16a34a' : s === 'error' ? '#dc2626' : color,
    color: '#fff',
    transition: 'background 0.2s',
    whiteSpace: 'nowrap',
  });

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
      }}
    >
      {(dev.message || prod.message) && (
        <div
          style={{
            background: 'rgba(0,0,0,0.75)',
            color: '#fff',
            fontSize: 10,
            fontFamily: 'monospace',
            borderRadius: 4,
            padding: '3px 8px',
            maxWidth: 200,
          }}
        >
          {dev.message || prod.message}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          disabled={dev.status === 'loading' || prod.status === 'loading'}
          onClick={dev.trigger}
          style={btnStyle(dev.status, '#0369a1')}
        >
          {dev.status === 'loading' ? '...' : 'Update DEV'}
        </button>
        <button
          disabled={dev.status === 'loading' || prod.status === 'loading'}
          onClick={prod.trigger}
          style={btnStyle(prod.status, '#b45309')}
        >
          {prod.status === 'loading' ? '...' : 'Update PROD'}
        </button>
      </div>
    </div>
  );
}
