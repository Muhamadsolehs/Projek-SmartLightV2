import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Cpu, Loader2, CheckCircle2 } from 'lucide-react';
import { SmartLightTrapDevice } from '../../types';
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
  }, [deviceToEdit, isOpen]);

  if (!isOpen) return null;

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
      } else {
        await createDevice({
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
        setSuccessMsg('Perangkat baru berhasil didaftarkan ke armada Supabase.');
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menyimpan perangkat ke database Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-[#90A955]/40 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#90A955]/30 bg-gradient-to-r from-white to-[#F6F9F5] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#31572C] text-[#ECF39E] flex items-center justify-center font-bold">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#132A13]">
                {isEditing ? `Edit Perangkat: ${deviceToEdit?.code}` : 'Tambah Unit Perangkat Baru'}
              </h2>
              <p className="text-xs text-[#52796F]">
                {isEditing
                  ? 'Perbarui parameter operasional armada perangkat'
                  : 'Registrasi unit IoT Smart Light Trap baru ke database Supabase'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#52796F] hover:bg-[#EAF4EE] hover:text-[#132A13] transition-colors cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
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
              onClick={onClose}
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
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{isEditing ? 'Simpan Perubahan' : 'Daftarkan Perangkat'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
