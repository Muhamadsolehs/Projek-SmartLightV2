import React from 'react';

interface SystemLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  theme?: 'dark' | 'light';
}

export const SystemLogo: React.FC<SystemLogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
  theme = 'dark',
}) => {
  const sizeMap = {
    sm: { box: 'h-8 w-8', icon: 32, title: 'text-xs', sub: 'text-[9px]' },
    md: { box: 'h-10 w-10', icon: 40, title: 'text-sm font-extrabold', sub: 'text-[10px]' },
    lg: { box: 'h-12 w-12', icon: 48, title: 'text-base font-extrabold', sub: 'text-xs' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Emblem SVG Icon */}
      <div
        className={`relative ${currentSize.box} shrink-0 rounded-xl bg-gradient-to-br from-[#132A13] via-[#31572C] to-[#4F772D] p-1.5 shadow-md border border-[#90A955]/40 flex items-center justify-center overflow-hidden group`}
      >
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full transform transition-transform duration-300 group-hover:scale-105"
        >
          <defs>
            {/* Gradient for Rice Leaf / Agricultural Stalk */}
            <linearGradient id="padiGrad" x1="6" y1="34" x2="20" y2="6" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#31572C" />
              <stop offset="50%" stopColor="#90A955" />
              <stop offset="100%" stopColor="#ECF39E" />
            </linearGradient>

            {/* Gradient for UV Trap Light Beam */}
            <linearGradient id="lightGrad" x1="20" y1="10" x2="20" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ECF39E" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#90A955" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#4F772D" stopOpacity="0.1" />
            </linearGradient>

            {/* Glow for IoT Beacon Node */}
            <radialGradient id="beaconGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ECF39E" stopOpacity="1" />
              <stop offset="70%" stopColor="#90A955" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#31572C" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background Ambient Radar Waves (IoT telemetry) */}
          <circle cx="20" cy="18" r="14" stroke="#90A955" strokeWidth="0.8" strokeDasharray="2 3" opacity="0.4" />
          <circle cx="20" cy="18" r="9" stroke="#ECF39E" strokeWidth="1" opacity="0.3" />

          {/* Phototaxis Cone Light (Cahaya penarik serangga nokturnal) */}
          <path
            d="M17 14 L23 14 L27 33 L13 33 Z"
            fill="url(#lightGrad)"
            opacity="0.85"
          />

          {/* Left Stylized Rice Stalk (Bulir Padi Subang) */}
          <path
            d="M20 34 C12 32 8 23 11 13 C12 17 15 22 20 25"
            stroke="url(#padiGrad)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* Rice Grains (Bulir) */}
          <ellipse cx="12" cy="15" rx="2" ry="3.5" transform="rotate(-30 12 15)" fill="#ECF39E" />
          <ellipse cx="14" cy="21" rx="1.8" ry="3.2" transform="rotate(-25 14 21)" fill="#90A955" />
          <ellipse cx="16.5" cy="27" rx="1.6" ry="2.8" transform="rotate(-15 16.5 27)" fill="#4F772D" />

          {/* Right Smart Sensor / Antenna Wave */}
          <path
            d="M20 34 C24 30 27 24 27 16 C27 12 25 9 20 8"
            stroke="#90A955"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="0 0"
          />
          <ellipse cx="27" cy="18" rx="1.8" ry="3" transform="rotate(25 27 18)" fill="#ECF39E" />
          <ellipse cx="25" cy="24" rx="1.6" ry="2.8" transform="rotate(20 25 24)" fill="#90A955" />

          {/* Central IoT Beacon & Light Core (LED UV 365nm Lampu Perangkap) */}
          <circle cx="20" cy="13" r="3.2" fill="url(#beaconGlow)" />
          <circle cx="20" cy="13" r="1.5" fill="#FFFFFF" />

          {/* Base Water Basin Line (Baki Air Hidraulik) */}
          <path
            d="M11 34 Q20 36 29 34"
            stroke="#ECF39E"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Brand Text (Conditional) */}
      {showText && (
        <div className="leading-tight">
          <span
            className={`block tracking-tight font-extrabold ${currentSize.title} ${
              theme === 'dark' ? 'text-white' : 'text-[#132A13]'
            }`}
          >
            Smart Light Trap
          </span>
          <span
            className={`block tracking-wide font-semibold ${currentSize.sub} ${
              theme === 'dark' ? 'text-[#ECF39E]' : 'text-[#4F772D]'
            }`}
          >
            IoT Agritech Subang
          </span>
        </div>
      )}
    </div>
  );
};
