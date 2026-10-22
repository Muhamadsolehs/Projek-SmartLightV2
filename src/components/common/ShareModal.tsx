import React, { useState } from 'react';
import { X, Share2, Copy, Check, MessageSquare, Send, Globe, Sparkles } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareTitle = 'Smart Light Trap IoT - Perangkap Serangga Otomatis Subang';
  const shareText = 'Sistem perangkap serangga otomatis berbasis IoT & Computer Vision mandiri tenaga surya untuk perlindungan padi di Subang:';

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${shareText}\n${currentUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleShareWhatsApp = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareTitle}\n\n${shareText}\n${currentUrl}`)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareTelegram = () => {
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(shareTitle)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white border border-[#90A955]/40 shadow-2xl overflow-hidden text-[#132A13]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#132A13] via-[#31572C] to-[#4F772D] p-5 sm:p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#ECF39E]/20 text-[#ECF39E] border border-[#ECF39E]/30">
              <Sparkles className="h-3 w-3 text-[#ECF39E]" />
              Kartu Berbagi Media Sosial
            </span>
          </div>
          <h3 className="text-lg font-bold text-white leading-tight">
            Bagikan Tautan & Poster Sistem
          </h3>
          <p className="text-xs text-[#ECF39E]/90 mt-1">
            Ketika tautan dibagikan ke WhatsApp, Telegram, atau media sosial, kartu pratinjau poster di bawah akan otomatis muncul.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Social Card Poster Live Preview */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#4F772D] block mb-2">
              Pratinjau Poster Link (OpenGraph & Twitter Card)
            </span>

            {/* Mock Social Card */}
            <div className="rounded-2xl border-2 border-[#90A955]/30 overflow-hidden bg-[#132A13] shadow-md group">
              {/* Poster Image */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#132A13]">
                <img
                  src="/og-image.png"
                  alt="Poster Smart Light Trap Subang"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-3 left-3 bg-[#132A13]/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#90A955]/40 text-[10px] text-[#ECF39E] font-bold">
                  IoT Agritech Subang
                </div>
                <div className="absolute bottom-3 right-3 bg-[#132A13]/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#90A955]/40 text-[10px] text-white font-mono">
                  1200 x 675 px (HD)
                </div>
              </div>

              {/* Card Meta Content */}
              <div className="p-3.5 bg-white border-t border-[#90A955]/20">
                <span className="text-[10px] font-mono text-[#90A955] uppercase block">
                  {currentUrl.replace(/^https?:\/\//, '') || 'smart-trap.agritech.id'}
                </span>
                <h4 className="text-xs sm:text-sm font-extrabold text-[#132A13] mt-0.5 truncate">
                  Smart Light Trap IoT - Perangkap Serangga Otomatis Subang
                </h4>
                <p className="text-[11px] text-[#52796F] line-clamp-2 mt-1 leading-snug">
                  Perangkat lapangan mandiri surya dengan lampu penarik fototaxis nokturnal, kamera makro AI YOLOv8, dan siklus pembersihan baki otomatis.
                </p>
              </div>
            </div>
          </div>

          {/* Direct Share Channels */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#4F772D] block mb-2">
              Kirim Langsung
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleShareWhatsApp}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#25D366] text-white font-bold text-xs shadow-xs hover:brightness-105 transition-all cursor-pointer"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Kirim ke WhatsApp</span>
              </button>
              <button
                onClick={handleShareTelegram}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#229ED9] text-white font-bold text-xs shadow-xs hover:brightness-105 transition-all cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span>Kirim ke Telegram</span>
              </button>
            </div>
          </div>

          {/* Copy Link Input Bar */}
          <div className="pt-2 border-t border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  readOnly
                  value={currentUrl}
                  className="w-full rounded-xl border border-[#90A955]/40 bg-[#F6F9F5] px-3 py-2 text-xs font-mono text-[#132A13] focus:outline-hidden"
                />
              </div>
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#31572C] to-[#4F772D] px-4 py-2 text-xs font-bold text-white shadow-xs hover:brightness-110 transition-all cursor-pointer whitespace-nowrap"
              >
                {copied ? <Check className="h-4 w-4 text-[#ECF39E]" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'Tersalin!' : 'Salin Link'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
