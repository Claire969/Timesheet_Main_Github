import { useState } from 'react';
import { Plus, Trash2, Wifi } from 'lucide-react';
import { wifiApi } from '../lib/eventReportApi';
import type { EventReportWifiNetwork } from '../lib/eventReportTypes';

const inputCls = 'w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

type Props = {
  reportId: string;
  networks: EventReportWifiNetwork[];
  onNetworksChange: (networks: EventReportWifiNetwork[]) => void;
  disabled?: boolean;
  onError: (msg: string) => void;
};

export const WifiNetworksSection = ({ reportId, networks, onNetworksChange, disabled, onError }: Props) => {
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ ssid: '', password: '', speed: '' });

  const handleAdd = async () => {
    if (!newForm.ssid.trim()) return;
    try {
      const created = await wifiApi.create({
        report_id: reportId,
        ssid: newForm.ssid.trim(),
        password: newForm.password.trim() || null,
        speed: newForm.speed.trim(),
        sort_order: networks.length,
      });
      onNetworksChange([...networks, created]);
      setNewForm({ ssid: '', password: '', speed: '' });
      setAdding(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleUpdate = async (net: EventReportWifiNetwork, field: keyof Pick<EventReportWifiNetwork, 'ssid' | 'password' | 'speed'>, value: string) => {
    const updated = { ...net, [field]: field === 'password' ? (value || null) : value };
    onNetworksChange(networks.map((n) => (n.id === net.id ? updated : n)));
    try {
      await wifiApi.update(net.id, { [field]: field === 'password' ? (value || null) : value });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleDelete = async (id: string) => {
    onNetworksChange(networks.filter((n) => n.id !== id));
    try {
      await wifiApi.delete(id);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wifi size={15} className="text-gray-500" />
          <h2 className="text-base font-bold text-gray-900">Réseaux WiFi</h2>
        </div>
        {!disabled && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            <Plus size={15} />
            Ajouter
          </button>
        )}
      </div>

      {networks.length === 0 && !adding && (
        <p className="text-sm text-gray-400 py-4 text-center">Aucun réseau WiFi</p>
      )}

      {networks.length > 0 && (
        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden mb-3">
          {networks.map((net) => (
            <div key={net.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 py-2 items-center">
              <input
                type="text"
                value={net.ssid}
                onChange={(e) => handleUpdate(net, 'ssid', e.target.value)}
                disabled={disabled}
                placeholder="SSID"
                className={inputCls}
              />
              <input
                type="text"
                value={net.password ?? ''}
                onChange={(e) => handleUpdate(net, 'password', e.target.value)}
                disabled={disabled}
                placeholder="Mot de passe (optionnel)"
                className={inputCls}
              />
              <input
                type="text"
                value={net.speed}
                onChange={(e) => handleUpdate(net, 'speed', e.target.value)}
                disabled={disabled}
                placeholder="Débit (ex: 100 Mbps)"
                className={inputCls}
              />
              {!disabled && (
                <button onClick={() => handleDelete(net.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {networks.length > 0 && (
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 py-1.5 bg-gray-50">
              <span className="text-xs text-gray-400 font-medium">SSID</span>
              <span className="text-xs text-gray-400 font-medium">Mot de passe</span>
              <span className="text-xs text-gray-400 font-medium">Débit</span>
              {!disabled && <span />}
            </div>
          )}
        </div>
      )}

      {adding && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">SSID *</label>
              <input
                type="text"
                value={newForm.ssid}
                onChange={(e) => setNewForm({ ...newForm, ssid: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
                autoFocus
                className={inputCls}
                placeholder="NomDuRéseau"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mot de passe</label>
              <input
                type="text"
                value={newForm.password}
                onChange={(e) => setNewForm({ ...newForm, password: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
                className={inputCls}
                placeholder="Optionnel"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Débit</label>
              <input
                type="text"
                value={newForm.speed}
                onChange={(e) => setNewForm({ ...newForm, speed: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
                className={inputCls}
                placeholder="ex: 100 Mbps"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setAdding(false); setNewForm({ ssid: '', password: '', speed: '' }); }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleAdd}
              disabled={!newForm.ssid.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-medium transition-colors"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
