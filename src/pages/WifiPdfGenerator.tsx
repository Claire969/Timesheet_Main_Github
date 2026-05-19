import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, QrCode, Upload, X } from 'lucide-react';
import { useAppState } from '../App';

// ─── Types ───────────────────────────────────────────────────────────────────

type DocumentType = 'staff' | 'guest';
type Language = 'fr' | 'en';

interface WifiFormData {
  eventName: string;
  subtitle: string;
  venueClientId: string;
  documentType: DocumentType;
  ssid: string;
  password: string;
  footerNote: string;
  language: Language;
  manualLogoDataUrl: string | null;
}

// ─── QR code generation (pure canvas, no dependency) ────────────────────────
// Implements the Wi-Fi QR payload: WIFI:T:WPA;S:<ssid>;P:<password>;;

function generateWifiQrDataUrl(ssid: string, password: string): string {
  const payload = `WIFI:T:WPA;S:${escapeQr(ssid)};P:${escapeQr(password)};;`;
  return qrToDataUrl(payload, 280);
}

function escapeQr(s: string): string {
  return s.replace(/[\\;,":]/g, (c) => '\\' + c);
}

// Reed-Solomon QR code generator (Mode: byte, EC level M)
// This is a self-contained implementation to avoid any external package.
function qrToDataUrl(text: string, size: number): string {
  const modules = generateQrMatrix(text);
  const n = modules.length;
  const cellSize = Math.floor(size / (n + 8));
  const margin = Math.floor((size - cellSize * n) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (modules[r][c]) {
        ctx.fillRect(margin + c * cellSize, margin + r * cellSize, cellSize, cellSize);
      }
    }
  }
  return canvas.toDataURL('image/png');
}

// ── Minimal QR matrix generator (byte mode, EC=M) ───────────────────────────
// Based on the QR Code spec. Supports ASCII payloads up to ~50 chars.

function generateQrMatrix(text: string): boolean[][] {
  // Encode bytes
  const bytes = Array.from(text).map((c) => c.charCodeAt(0));
  // Use version 3 (29x29) which handles up to 32 bytes at EC=M
  // For longer payloads fall back to version 5 (37x37) — 64 bytes
  const version = bytes.length <= 32 ? 3 : bytes.length <= 64 ? 5 : 7;
  const size = 17 + version * 4;

  // Build data codewords
  const data = encodeBytes(bytes, version);

  // Build matrix with patterns
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null));
  addFinderPatterns(matrix, size);
  addTimingPatterns(matrix, size);
  addAlignmentPatterns(matrix, size, version);
  reserveFormatArea(matrix, size);

  // Place data
  placeData(matrix, data, size);

  // Best mask
  const masked = applyBestMask(matrix, size);

  // Write format info (mask pattern 0 for simplicity)
  writeFormatInfo(masked, size, 0);

  return masked.map((row) => row.map((v) => v === true));
}

function encodeBytes(bytes: number[], version: number): number[] {
  // EC codewords count per version at EC=M
  const ecCounts: Record<number, number> = { 3: 26, 5: 36, 7: 40 };
  const totalCodewords: Record<number, number> = { 3: 28, 5: 64, 7: 124 };
  const ecCount = ecCounts[version] ?? 26;
  const total = totalCodewords[version] ?? 28;
  const dataCapacity = total - ecCount;

  const bits: number[] = [];
  // Mode: byte = 0100
  pushBits(bits, 0b0100, 4);
  // Character count indicator (8 bits for version 1-9)
  pushBits(bits, bytes.length, 8);
  for (const b of bytes) pushBits(bits, b, 8);
  // Terminator
  for (let i = 0; i < 4 && bits.length < dataCapacity * 8; i++) bits.push(0);
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);
  // Pad codewords
  const padBytes = [0xec, 0x11];
  let pi = 0;
  while (bits.length < dataCapacity * 8) { pushBits(bits, padBytes[pi % 2], 8); pi++; }

  // Pack bits into codewords
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] ?? 0);
    codewords.push(b);
  }

  // EC codewords via Reed-Solomon
  const ec = rsEncode(codewords, ecCount);
  return [...codewords, ...ec];
}

function pushBits(arr: number[], val: number, len: number) {
  for (let i = len - 1; i >= 0; i--) arr.push((val >> i) & 1);
}

// Reed-Solomon encoder
function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGenerator(ecLen);
  const msg = [...data, ...new Array(ecLen).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 1; j <= ecLen; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(data.length);
}

const GF_EXP = new Array(512).fill(0);
const GF_LOG = new Array(256).fill(0);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGenerator(degree: number): number[] {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= gfMul(g[j], GF_EXP[i]);
    }
    g = next;
  }
  return g;
}

// Pattern helpers
function setRect(matrix: (boolean | null)[][], r: number, c: number, h: number, w: number, val: boolean) {
  for (let dr = 0; dr < h; dr++)
    for (let dc = 0; dc < w; dc++)
      if (r + dr >= 0 && r + dr < matrix.length && c + dc >= 0 && c + dc < matrix[0].length)
        matrix[r + dr][c + dc] = val;
}

function addFinder(matrix: (boolean | null)[][], r: number, c: number) {
  setRect(matrix, r, c, 7, 7, true);
  setRect(matrix, r + 1, c + 1, 5, 5, false);
  setRect(matrix, r + 2, c + 2, 3, 3, true);
}

function addFinderPatterns(matrix: (boolean | null)[][], size: number) {
  addFinder(matrix, 0, 0);
  addFinder(matrix, 0, size - 7);
  addFinder(matrix, size - 7, 0);
  // Separators (already white from null → false)
  // Horizontal separators
  for (let c = 0; c < 8; c++) { matrix[7][c] = false; matrix[size - 8][c] = false; matrix[7][size - 1 - c] = false; }
  for (let r = 0; r < 8; r++) { matrix[r][7] = false; matrix[r][size - 8] = false; matrix[size - 1 - r][7] = false; }
}

function addTimingPatterns(matrix: (boolean | null)[][], size: number) {
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }
}

const ALIGNMENT_POSITIONS: Record<number, number[]> = {
  3: [22],
  5: [26],
  7: [22, 34],
};

function addAlignmentPatterns(matrix: (boolean | null)[][], size: number, version: number) {
  const pos = ALIGNMENT_POSITIONS[version] ?? [];
  const centers = [6, ...pos];
  for (const r of centers) {
    for (const c of centers) {
      if (matrix[r][c] !== null) continue;
      setRect(matrix, r - 2, c - 2, 5, 5, true);
      setRect(matrix, r - 1, c - 1, 3, 3, false);
      matrix[r][c] = true;
    }
  }
}

function reserveFormatArea(matrix: (boolean | null)[][], size: number) {
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false;
    if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false;
  }
  matrix[size - 8][8] = true; // dark module
}

function placeData(matrix: (boolean | null)[][], data: number[], size: number) {
  const bits: number[] = [];
  for (const b of data) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);

  let idx = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let row = 0; row < size; row++) {
      const r = upward ? size - 1 - row : row;
      for (let col = 0; col < 2; col++) {
        const c = right - col;
        if (matrix[r][c] === null) {
          matrix[r][c] = idx < bits.length ? bits[idx++] === 1 : false;
        }
      }
    }
    upward = !upward;
  }
}

function applyBestMask(matrix: (boolean | null)[][], size: number): (boolean | null)[][] {
  // Use mask 0: (row + col) % 2 === 0
  return matrix.map((row, r) =>
    row.map((v, c) => (v === null ? false : v !== ((r + c) % 2 === 0)))
  );
}

function writeFormatInfo(matrix: (boolean | null)[][], size: number, maskPattern: number) {
  // EC level M = 0b00, mask 0 = 0b000 → format bits
  // Pre-computed format string for EC=M, mask=0: 101010000010010
  const formatBits = [1,0,1,0,1,0,0,0,0,0,1,0,0,1,0];
  const pos1: [number, number][] = [
    [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],
    [7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
  ];
  const pos2: [number, number][] = [
    [size-1,8],[size-2,8],[size-3,8],[size-4,8],[size-5,8],[size-6,8],[size-7,8],
    [8,size-8],[8,size-7],[8,size-6],[8,size-5],[8,size-4],[8,size-3],[8,size-2],[8,size-1],
  ];
  formatBits.forEach((b, i) => {
    if (i < pos1.length) matrix[pos1[i][0]][pos1[i][1]] = b === 1;
    if (i < pos2.length) matrix[pos2[i][0]][pos2[i][1]] = b === 1;
  });
  void maskPattern;
}

// ─── Labels ──────────────────────────────────────────────────────────────────

const LABELS = {
  fr: {
    staff: 'STAFF WI-FI',
    guest: 'GUEST WI-FI',
    network: 'Réseau',
    password: 'Mot de passe',
    scan: 'Scannez pour vous connecter',
    connect: 'ou connectez-vous manuellement',
  },
  en: {
    staff: 'STAFF WI-FI',
    guest: 'GUEST WI-FI',
    network: 'Network',
    password: 'Password',
    scan: 'Scan to connect',
    connect: 'or connect manually',
  },
};

// ─── Logo resolution ─────────────────────────────────────────────────────────
// Clients from the app state are used to resolve logos by name match.
// This allows new logos to be added in the client database without code changes.

function resolveLogoUrl(
  venueClientId: string,
  clients: { id: string; name: string; logoUrl?: string }[],
  manualLogoDataUrl: string | null
): string | null {
  if (venueClientId) {
    const client = clients.find((c) => c.id === venueClientId);
    if (client?.logoUrl) return client.logoUrl;
  }
  if (manualLogoDataUrl) return manualLogoDataUrl;
  return null;
}

// ─── Wi-Fi sheet preview ─────────────────────────────────────────────────────

interface SheetProps {
  form: WifiFormData;
  logoUrl: string | null;
  qrDataUrl: string;
}

function WifiSheet({ form, logoUrl, qrDataUrl }: SheetProps) {
  const labels = LABELS[form.language];
  const title = form.documentType === 'staff' ? labels.staff : labels.guest;
  const isStaff = form.documentType === 'staff';
  const accentColor = isStaff ? '#1e3a5f' : '#1a6b3c';
  const accentLight = isStaff ? '#e8f0fa' : '#e6f4ec';

  return (
    <div
      id="wifi-sheet"
      style={{
        width: 794,
        minHeight: 1123,
        background: '#ffffff',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <div style={{ background: accentColor, height: 8, width: '100%', flexShrink: 0 }} />

      {/* Header */}
      <div
        style={{
          padding: '36px 64px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            style={{ maxHeight: 56, maxWidth: 200, objectFit: 'contain' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div
            style={{
              width: 160,
              height: 48,
              background: '#f1f5f9',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: '#94a3b8',
              letterSpacing: '0.05em',
            }}
          >
            LOGO
          </div>
        )}

        <div style={{ textAlign: 'right' }}>
          {form.eventName && (
            <div style={{ fontSize: 18, fontWeight: 800, color: accentColor, letterSpacing: '-0.01em' }}>
              {form.eventName}
            </div>
          )}
          {form.subtitle && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{form.subtitle}</div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#e2e8f0', margin: '0 64px' }} />

      {/* Title band */}
      <div
        style={{
          background: accentColor,
          margin: '32px 64px 0',
          borderRadius: 10,
          padding: '20px 32px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </div>
      </div>

      {/* QR + credentials */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 64px',
          gap: 24,
        }}
      >
        {/* QR code */}
        <div
          style={{
            background: accentLight,
            borderRadius: 16,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: accentColor, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {labels.scan}
          </div>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" style={{ width: 200, height: 200, imageRendering: 'pixelated' }} />
          ) : (
            <div style={{ width: 200, height: 200, background: '#e2e8f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#94a3b8' }}>
              QR Code
            </div>
          )}
          <div style={{ fontSize: 11, color: '#64748b' }}>{labels.connect}</div>
        </div>

        {/* Credentials */}
        <div
          style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
          }}
        >
          {[
            { label: labels.network, value: form.ssid || '—' },
            { label: labels.password, value: form.password || '—' },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                border: `2px solid ${accentColor}`,
                borderRadius: 10,
                padding: '18px 24px',
                background: '#ffffff',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: accentColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  marginBottom: 8,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#1e293b',
                  letterSpacing: '0.04em',
                  wordBreak: 'break-all',
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      {form.footerNote && (
        <div
          style={{
            borderTop: `1px solid #e2e8f0`,
            margin: '0 64px',
            padding: '14px 0 20px',
            fontSize: 10,
            color: '#94a3b8',
            textAlign: 'center',
            letterSpacing: '0.03em',
          }}
        >
          {form.footerNote}
        </div>
      )}

      {/* Bottom bar */}
      <div style={{ background: accentColor, height: 8, width: '100%', flexShrink: 0 }} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_FORM: WifiFormData = {
  eventName: '',
  subtitle: '',
  venueClientId: '',
  documentType: 'staff',
  ssid: '',
  password: '',
  footerNote: '',
  language: 'fr',
  manualLogoDataUrl: null,
};

export function WifiPdfGenerator() {
  const navigate = useNavigate();
  const { clients } = useAppState();
  const [form, setForm] = useState<WifiFormData>(DEFAULT_FORM);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Recompute QR whenever ssid/password changes
  useEffect(() => {
    if (form.ssid || form.password) {
      setQrDataUrl(generateWifiQrDataUrl(form.ssid, form.password));
    } else {
      setQrDataUrl('');
    }
  }, [form.ssid, form.password]);

  const logoUrl = resolveLogoUrl(form.venueClientId, clients, form.manualLogoDataUrl);
  const selectedClient = clients.find((c) => c.id === form.venueClientId);
  const clientHasLogo = !!selectedClient?.logoUrl;

  const set = useCallback(<K extends keyof WifiFormData>(key: K, val: WifiFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => set('manualLogoDataUrl', ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handlePrint() {
    window.print();
  }

  const fieldClass = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide";

  return (
    <>
      {/* Print styles — hide everything except the sheet */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #wifi-sheet, #wifi-sheet * { visibility: visible !important; }
          #wifi-sheet {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 794px !important;
            transform: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {/* Page header */}
        <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="flex items-center gap-2">
                <QrCode size={18} className="text-blue-600 dark:text-blue-400" />
                <h1 className="text-base font-bold text-gray-900 dark:text-white">Wi-Fi PDF Generator</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
              >
                <Printer size={14} />
                Print / Export PDF
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="max-w-screen-xl mx-auto px-6 py-8 flex gap-8 items-start">

          {/* ── Form panel ── */}
          <div className="w-80 flex-shrink-0 space-y-5">

            {/* Event */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Événement</div>

              <div>
                <label className={labelClass}>Nom de l'événement</label>
                <input className={fieldClass} value={form.eventName} onChange={(e) => set('eventName', e.target.value)} placeholder="MIPIM 2025" />
              </div>

              <div>
                <label className={labelClass}>Sous-titre (optionnel)</label>
                <input className={fieldClass} value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="Palais des Festivals — Cannes" />
              </div>

              <div>
                <label className={labelClass}>Client / Venue</label>
                <select
                  className={fieldClass}
                  value={form.venueClientId}
                  onChange={(e) => { set('venueClientId', e.target.value); set('manualLogoDataUrl', null); }}
                >
                  <option value="">— Aucun —</option>
                  {clients.filter((c) => !c.isArchived).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Logo */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-3">
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Logo</div>

              {form.venueClientId && clientHasLogo ? (
                <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                  Logo récupéré depuis la base clients.
                </p>
              ) : (
                <>
                  {form.venueClientId && !clientHasLogo && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Ce client n'a pas de logo enregistré. Vous pouvez en uploader un manuellement.
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Upload size={13} />
                      Uploader un logo
                    </button>
                    {form.manualLogoDataUrl && (
                      <button
                        onClick={() => set('manualLogoDataUrl', null)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Supprimer le logo"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  {form.manualLogoDataUrl && (
                    <img src={form.manualLogoDataUrl} alt="Logo" className="h-10 object-contain rounded" />
                  )}
                </>
              )}
            </div>

            {/* Document */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Document</div>

              <div>
                <label className={labelClass}>Type de document</label>
                <div className="flex gap-2">
                  {(['staff', 'guest'] as DocumentType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => set('documentType', t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                        form.documentType === t
                          ? t === 'staff'
                            ? 'bg-blue-900 border-blue-900 text-white'
                            : 'bg-green-700 border-green-700 text-white'
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {t === 'staff' ? 'Staff' : 'Guest'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Langue</label>
                <div className="flex gap-2">
                  {(['fr', 'en'] as Language[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => set('language', l)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border uppercase transition-colors ${
                        form.language === l
                          ? 'bg-gray-900 dark:bg-gray-100 border-gray-900 dark:border-gray-100 text-white dark:text-gray-900'
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Credentials */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Connexion</div>

              <div>
                <label className={labelClass}>SSID (nom du réseau)</label>
                <input className={fieldClass} value={form.ssid} onChange={(e) => set('ssid', e.target.value)} placeholder="ClearComputing_Staff" />
              </div>

              <div>
                <label className={labelClass}>Mot de passe</label>
                <input className={fieldClass} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="••••••••" />
              </div>

              <div>
                <label className={labelClass}>Note de bas de page (optionnel)</label>
                <input className={fieldClass} value={form.footerNote} onChange={(e) => set('footerNote', e.target.value)} placeholder="Réseau fourni par Clear Computing · clearcomputing.be" />
              </div>
            </div>
          </div>

          {/* ── Preview panel ── */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Aperçu</span>
              <span className="text-xs text-gray-400">A4 · Portrait</span>
            </div>

            <div
              style={{
                background: '#e2e8f0',
                padding: 24,
                borderRadius: 12,
                display: 'flex',
                justifyContent: 'center',
                overflowX: 'auto',
              }}
            >
              <div
                style={{
                  transform: 'scale(0.72)',
                  transformOrigin: 'top center',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
                  borderRadius: 2,
                  marginBottom: `calc((1123px * 0.72 - 1123px))`,
                }}
              >
                <WifiSheet form={form} logoUrl={logoUrl} qrDataUrl={qrDataUrl} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
