import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  AlertCircle,
  Cpu,
  Loader2,
  CheckCircle2,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { SmartLightTrapDevice, DeviceProvisioningCredentials } from '../../types';
import { useDevice } from '../../context/DeviceContext';

interface DeviceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceToEdit?: SmartLightTrapDevice | null;
}

export const DeviceFormModal: React.FC<DeviceFormModalProps> = ({
  isOpen,
  onClose,
  deviceToEdit,
}) => {
  const { createDevice, updateDevice } = useDevice();
  const isEditing = Boolean(deviceToEdit);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [farmSector, setFarmSector] = useState('');
  const [cropType, setCropType] = useState('Padi Varietas Ciherang');
  const [latitude, setLatitude] = useState('-6.5512000');
  const [longitude, setLongitude] = useState('107.7588000');
  const [batteryCutoff, setBatteryCutoff] = useState('11.8');
  const [pestThreshold, setPestThreshold] = useState('50');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Single-view credentials state for newly provisioned device
  const [provisionedCredentials, setProvisionedCredentials] = useState<DeviceProvisioningCredentials | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [hasConfirmedSaved, setHasConfirmedSaved] = useState(false);

  useEffect(() => {
    if (deviceToEdit) {
      setCode(deviceToEdit.code);
      setName(deviceToEdit.name);
      setLocationName(deviceToEdit.locationName);
      setFarmSector(deviceToEdit.farmSector);
      setCropType(deviceToEdit.cropType);
      setLatitude(deviceToEdit.latitude.toString());
      setLongitude(deviceToEdit.longitude.toString());
      setBatteryCutoff(deviceToEdit.batteryCutoffThresholdV.toString());
      setPestThreshold(deviceToEdit.pestThresholdPerNight.toString());
    } else {
      // Default new device values
      setCode('');
      setName('');
      setLocationName('Subang, Jawa Barat');
      setFarmSector('Sektor Sawah Mandiri Subang');
      setCropType('Padi Varietas Ciherang');
      setLatitude('-6.5500000');
      setLongitude('107.7600000');
      setBatteryCutoff('11.8');
      setPestThreshold('50');
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setProvisionedCredentials(null);
    setShowToken(false);
    setTokenCopied(false);
    setSnippetCopied(false);
    setHasConfirmedSaved(false);
  }, [deviceToEdit, isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setProvisionedCredentials(null);
    setShowToken(false);
    setTokenCopied(false);
    setSnippetCopied(false);
    setHasConfirmedSaved(false);
    onClose();
  };

  const handleCopyToken = () => {
    if (!provisionedCredentials) return;
    navigator.clipboard.writeText(provisionedCredentials.rawToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  const handleCopySnippet = () => {
    if (!provisionedCredentials) return;
    navigator.clipboard.writeText(provisionedCredentials.configHSnippet);
    setSnippetCopied(true);
    setTimeout(() => setSnippetCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validation
    if (!code.trim()) {
      setErrorMsg('Kode perangkat wajib diisi (contoh: SLT-SBG-05).');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('Nama perangkat wajib diisi.');
      return;
    }
    if (!locationName.trim() || !farmSector.trim()) {
      setErrorMsg('Lokasi dan sektor lahan wajib diisi.');
      return;
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (isNaN(latNum) || isNaN(lngNum)) {
      setErrorMsg('Koordinat latitude dan longitude harus berupa angka desimal yang valid.');
      return;
    }

    const cutoffNum = parseFloat(batteryCutoff);
    const thresholdNum = parseInt(pestThreshold, 10);
    if (isNaN(cutoffNum) || cutoffNum < 10.0 || cutoffNum > 13.0) {
      setErrorMsg('Batas cutoff baterai harus berada pada rentang 10.0V - 13.0V.');
      return;
    }
    if (isNaN(thresholdNum) || thresholdNum <= 0) {
      setErrorMsg('Ambang batas hama harus berupa angka positif (> 0).');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && deviceToEdit) {
        await updateDevice(deviceToEdit.id, {
          name,
          locationName,
          farmSector,
          cropType,
          batteryCutoffThresholdV: cutoffNum,
          pestThresholdPerNight: thresholdNum,
        });
        setSuccessMsg('Data perangkat berhasil diperbarui di Supabase.');
        setTimeout(() => {
          handleClose();
        }, 1000);
      } else {
        const result = await createDevice({
          code,
          name,
          locationName,
          farmSector,
          latitude: latNum,
          longitude: lngNum,
          cropType,
          batteryCutoffThresholdV: cutoffNum,
          pestThresholdPerNight: thresholdNum,
        });

        if (result && result.credentials) {
          setProvisionedCredentials(result.credentials);
        } else {
          setSuccessMsg('Perangkat baru berhasil didaftarkan ke armada Supabase.');
          setTimeout(() => {
            handleClose();
          }, 1200);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menyimpan perangkat ke database Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-[#90A955]/40 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#90A955]/30 bg-gradient-to-r from-white to-[#F6F9F5] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold ${
              provisionedCredentials
                ? 'bg-amber-600 text-amber-100'
                : 'bg-[#31572C] text-[#ECF39E]'
            }`}>
              {provisionedCredentials ? <Key className="h-5 w-5" /> : <Cpu className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#132A13]">
                {provisionedCredentials
                  ? `Kredensial API Baru: ${provisionedCredentials.deviceCode}`
                  : isEditing
                  ? `Edit Perangkat: ${deviceToEdit?.code}`
                  : 'Tambah Unit Perangkat Baru'}
              </h2>
              <p className="text-xs text-[#52796F]">
                {provisionedCredentials
                  ? 'Salin token rahasia sebelum menutup jendela ini'
                  : isEditing
                  ? 'Perbarui parameter operasional armada perangkat'
                  : 'Registrasi unit IoT Smart Light Trap baru ke database Supabase'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-[#52796F] hover:bg-[#EAF4EE] hover:text-[#132A13] transition-colors cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* View 1: Credentials Display Screen (Once Provisioned) */}
        {provisionedCredentials ? (
          <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
            {/* Warning Banner */}
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-amber-900 text-xs">PERHATIAN: SIMPAN KREDENSIAL INI SEKARANG</div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Token mentah ini <strong>hanya ditampilkan satu kali</strong> pada layar ini. Supabase hanya menyimpan hash SHA-256 dan tidak dapat merekonstruksi token ini kembali demi standar keamanan IoT.
                </p>
              </div>
            </div>

            {/* Device Code & Raw Token */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[#132A13] font-bold">X-Device-Token (Raw API Key)</label>
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="text-[11px] text-[#31572C] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  <span>{showToken ? 'Sembunyikan' : 'Tampilkan'}</span>
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type={showToken ? 'text' : 'password'}
                  readOnly
                  value={provisionedCredentials.rawToken}
                  className="flex-1 rounded-xl border border-[#90A955]/40 bg-[#F6F9F5] px-3 py-2 font-mono text-xs text-[#132A13] font-bold select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="px-3.5 py-2 rounded-xl bg-[#31572C] text-white font-semibold hover:bg-[#4F772D] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  {tokenCopied ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* config.h C/C++ Snippet */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[#132A13] font-bold">Konfigurasi Firmware (config.h)</label>
                <button
                  type="button"
                  onClick={handleCopySnippet}
                  className="text-[11px] text-[#31572C] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {snippetCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{snippetCopied ? 'Snippet Tersalin!' : 'Salin Snippet C'}</span>
                </button>
              </div>
              <pre className="p-3 bg-[#132A13] text-[#ECF39E] font-mono text-[11px] rounded-xl overflow-x-auto leading-relaxed border border-[#31572C]">
                <code>{provisionedCredentials.configHSnippet}</code>
              </pre>
              <p className="text-[10px] text-[#52796F]">
                Tempelkan snippet di atas ke file <code>firmware/esp32_smart_lightrap/config.h</code> pada baris konfigurasi autentikasi perangkat.
              </p>
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#90A955]/30 bg-[#F6F9F5] cursor-pointer hover:bg-[#EAF4EE] transition-colors">
              <input
                type="checkbox"
                checked={hasConfirmedSaved}
                onChange={(e) => setHasConfirmedSaved(e.target.checked)}
                className="mt-0.5 rounded text-[#31572C] focus:ring-[#31572C]"
              />
              <span className="text-[11px] text-[#132A13] leading-snug">
                Saya mengonfirmasi telah menyalin token ini dengan aman ke firmware ESP32 atau password manager terenkripsi. Saya memahami token ini tidak dapat dipulihkan kembali jika hilang.
              </span>
            </label>

            {/* Finish Button */}
            <div className="pt-2 border-t border-[#90A955]/20 flex items-center justify-end">
              <button
                type="button"
                onClick={handleClose}
                disabled={!hasConfirmedSaved}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#31572C] text-white font-bold hover:bg-[#4F772D] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Selesai & Tutup Modal</span>
              </button>
            </div>
          </div>
        ) : (
          /* View 2: Form Body */
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[#132A13] font-bold mb-1">
                  Kode Perangkat <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  disabled={isEditing}
                  placeholder="SLT-SBG-05"
                  className={`w-full rounded-xl border border-[#90A955]/40 bg-[#F6F9F5] px-3 py-2 font-mono text-xs text-[#132A13] font-bold ${
                    isEditing ? 'opacity-70 cursor-not-allowed' : 'focus:bg-white focus:border-[#31572C]'
                  }`}
                  required
                />
                <span className="text-[10px] text-[#52796F]">Harus unik (e.g. SLT-SBG-XX)</span>
              </div>

              <div>
                <label className="block text-[#132A13] font-bold mb-1">
                  Nama Perangkat <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Smart Trap Unit 5 (Pagaden)"
                  className="w-full rounded-xl border border-[#90A955]/40 bg-white px-3 py-2 text-xs text-[#132A13] focus:border-[#31572C]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[#132A13] font-bold mb-1">
                Nama Lokasi Penempatan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Kelompok Tani Sri Rejeki, Subang"
                className="w-full rounded-xl border border-[#90A955]/40 bg-white px-3 py-2 text-xs text-[#132A13] focus:border-[#31572C]"
                required
              />
            </div>

            <div>
              <label className="block text-[#132A13] font-bold mb-1">
                Sektor / Blok Lahan Sawah <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={farmSector}
                onChange={(e) => setFarmSector(e.target.value)}
                placeholder="Blok Sawah Irigasi Pagaden Timur"
                className="w-full rounded-xl border border-[#90A955]/40 bg-white px-3 py-2 text-xs text-[#132A13] focus:border-[#31572C]"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[#132A13] font-bold mb-1">Komoditas / Varietas Padi</label>
                <input
                  type="text"
                  value={cropType}
                  onChange={(e) => setCropType(e.target.value)}
                  placeholder="Padi Varietas Ciherang"
                  className="w-full rounded-xl border border-[#90A955]/40 bg-white px-3 py-2 text-xs text-[#132A13] focus:border-[#31572C]"
                />
              </div>

              <div>
                <label className="block text-[#132A13] font-bold mb-1">Ambang PHT (ekor/malam)</label>
                <input
                  type="number"
                  value={pestThreshold}
                  onChange={(e) => setPestThreshold(e.target.value)}
                  min="1"
                  className="w-full rounded-xl border border-[#90A955]/40 bg-white px-3 py-2 text-xs text-[#132A13] font-mono focus:border-[#31572C]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[#132A13] font-bold mb-1">Latitude</label>
                <input
                  type="text"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="-6.5512000"
                  className="w-full rounded-xl border border-[#90A955]/40 bg-white px-3 py-2 text-xs text-[#132A13] font-mono focus:border-[#31572C]"
                  required
                />
              </div>

              <div>
                <label className="block text-[#132A13] font-bold mb-1">Longitude</label>
                <input
                  type="text"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="107.7588000"
                  className="w-full rounded-xl border border-[#90A955]/40 bg-white px-3 py-2 text-xs text-[#132A13] font-mono focus:border-[#31572C]"
                  required
                />
              </div>

              <div>
                <label className="block text-[#132A13] font-bold mb-1">Cutoff Baterai (V)</label>
                <input
                  type="number"
                  step="0.1"
                  value={batteryCutoff}
                  onChange={(e) => setBatteryCutoff(e.target.value)}
                  min="10.0"
                  max="13.0"
                  className="w-full rounded-xl border border-[#90A955]/40 bg-white px-3 py-2 text-xs text-[#132A13] font-mono focus:border-[#31572C]"
                />
              </div>
            </div>

            {/* Form Actions Footer */}
            <div className="pt-4 border-t border-[#90A955]/20 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-[#90A955]/40 text-[#31572C] font-semibold hover:bg-[#F6F9F5] transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-[#31572C] text-white font-bold hover:bg-[#4F772D] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Memproses di Server...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>{isEditing ? 'Simpan Perubahan' : 'Daftarkan & Generate Token'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
