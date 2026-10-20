import React from 'react';

interface AmbientBackgroundProps {
  reducedMotion: boolean;
  isLightMode: boolean;
}

export const AmbientBackground: React.FC<AmbientBackgroundProps> = React.memo(
  ({ isLightMode }) => {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
        style={{
          background: isLightMode
            ? '#ffffff'
            : 'radial-gradient(circle at 15% 15%, rgba(0, 240, 255, 0.08), transparent 45%), radial-gradient(circle at 85% 35%, rgba(0, 229, 163, 0.06), transparent 45%), radial-gradient(circle at 50% 90%, rgba(2, 132, 199, 0.06), transparent 50%)',
        }}
      >
        {/* Subtle Tech Grid */}
        <div className="absolute inset-0 nexus-tech-grid opacity-70" />
      </div>
    );
  }
);
