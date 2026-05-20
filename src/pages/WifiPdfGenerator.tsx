import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, QrCode, Upload, X } from 'lucide-react';
import QRCode from 'qrcode';
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
  speed: string;
  footerNote: string;
  language: Language;
  manualLogoDataUrl: string | null;
}

// ─── QR code generation via `qrcode` package ────────────────────────────────

async function generateWifiQrDataUrl(ssid: string, password: string): Promise<string> {
  const escaped = (s: string) => s.replace(/[\\;,":]/g, (c) => '\\' + c);
  const payload = `WIFI:T:WPA;S:${escaped(ssid)};P:${escaped(password)};;`;
  return QRCode.toDataURL(payload, {
    width: 400,
    margin: 3,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}

// ─── Labels ──────────────────────────────────────────────────────────────────

const LABELS = {
  fr: {
    staff: 'STAFF WI-FI',
    guest: 'GUEST WI-FI',
    network: 'Réseau',
    password: 'Mot de passe',
    speed: 'Débit',
    scan: 'Scannez pour vous connecter',
    connect: 'ou connectez-vous manuellement',
  },
  en: {
    staff: 'STAFF WI-FI',
    guest: 'GUEST WI-FI',
    network: 'Network',
    password: 'Password',
    speed: 'Speed',
    scan: 'Scan to connect',
    connect: 'or connect manually',
  },
};

// ─── Logo resolution ─────────────────────────────────────────────────────────

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

// ─── Wi-Fi sheet ─────────────────────────────────────────────────────────────

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

  const credentialCols = form.speed ? '1fr 1fr 1fr' : '1fr 1fr';

  const credentialItems = [
    { label: labels.network, value: form.ssid || '—' },
    { label: labels.password, value: form.password || '—' },
    ...(form.speed ? [{ label: labels.speed, value: form.speed }] : []),
  ];

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
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      } as React.CSSProperties}
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
        {/* QR code block */}
        <div
          style={{
            background: accentLight,
            borderRadius: 16,
            padding: '24px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: accentColor, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {labels.scan}
          </div>

          <div
            style={{
              background: '#ffffff',
              padding: 12,
              borderRadius: 10,
              lineHeight: 0,
            }}
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code Wi-Fi"
                width={240}
                height={240}
                style={{ display: 'block', imageRendering: 'pixelated' }}
              />
            ) : (
              <div
                style={{
                  width: 240,
                  height: 240,
                  background: '#f1f5f9',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: '#94a3b8',
                }}
              >
                Entrez SSID + mot de passe
              </div>
            )}
          </div>

          <div style={{ fontSize: 11, color: '#64748b' }}>{labels.connect}</div>
        </div>

        {/* Credentials */}
        <div
          style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: credentialCols,
            gap: 20,
          }}
        >
          {credentialItems.map(({ label, value }) => (
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
  speed: '',
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
      generateWifiQrDataUrl(form.ssid, form.password).then(setQrDataUrl);
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
      {/*
        ─── FIX PDF BLANC ────────────────────────────────────────────────────────
        Stratégie :
        - Le print root est positionné hors écran (left: -9999px) au lieu de
          display:none — ainsi le navigateur rend bien le contenu et charge
          les images (QR, logo) AVANT l'impression.
        - En mode print, on utilise visibility:hidden/visible plutôt que
          display:none pour masquer l'UI sans empêcher le rendu du sheet.
        ─────────────────────────────────────────────────────────────────────────
      */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }

          /* Masque toute l'UI sans empêcher le rendu */
          body > * { visibility: hidden !important; }

          /* Rend le print root visible et bien positionné */
          #wifi-sheet-print-root {
            visibility: visible !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 794px !important;
            z-index: 9999 !important;
          }

          /* Rend tous les enfants du sheet visibles */
          #wifi-sheet-print-root * {
            visibility: visible !important;
          }

          #wifi-sheet {
            width: 794px !important;
            min-height: 1123px !important;
            box-shadow: none !important;
            position: relative !important;
            transform: none !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/*
        ─── Print root hors écran (PAS display:none) ───────────────────────────
        Positionné à left:-9999px → invisible à l'écran mais rendu par le
        navigateur → QR code et logo sont bien chargés au moment de l'impression.
      */}
      <div
        id="wifi-sheet-print-root"
        style={{
          position: 'fixed',
          top: 0,
          left: '-9999px',
          width: 794,
          zIndex: -1,
          pointerEvents: 'none',
        }}
      >
        <WifiSheet form={form} logoUrl={logoUrl} qrDataUrl={qrDataUrl} />
      </div>

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
                <label className={labelClass}>Débit / vitesse (optionnel)</label>
                <input className={fieldClass} value={form.speed} onChange={(e) => set('speed', e.target.value)} placeholder="ex: 500 Mbps" />
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
