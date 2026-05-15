import React from 'react';
import { motion } from 'motion/react';

interface TankGaugeProps {
  percentage: number;
  fuelType: 'gasoil' | 'essence';
}

export default function TankGauge({ percentage, fuelType }: TankGaugeProps) {
  const isLow = percentage <= 25;
  
  // Colors based on fuel type
  const liquidColor = fuelType === 'gasoil' ? '#94a3b8' : '#f59e0b';
  const glowColor = fuelType === 'gasoil' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(245, 158, 11, 0.3)';

  return (
    <div className="relative w-full h-64 flex justify-center items-end py-4">
      {/* Tank Container */}
      <div className="relative w-48 h-56 bg-[#0f172a] rounded-[2rem] border-4 border-[#334155] shadow-2xl overflow-hidden">
        
        {/* Measurement Lines */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {[75, 50, 25].map((level) => (
            <div 
              key={level} 
              className="absolute w-full border-t border-white/10 flex items-center justify-end pr-2"
              style={{ top: `${100 - level}%` }}
            >
              <span className="text-[10px] font-bold text-slate-500 bg-[#1e293b]/80 px-1 rounded">
                {level}%
              </span>
            </div>
          ))}
        </div>

        {/* Liquid Container */}
        <motion.div 
          className="absolute bottom-0 left-0 w-full overflow-hidden"
          initial={{ height: 0 }}
          animate={{ height: `${percentage}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          {/* Floating Effect Wrapper */}
          <motion.div 
            className="absolute inset-0 w-full h-full"
            animate={{ 
              y: [0, -3, 0],
            }}
            transition={{ 
              duration: 5, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: 1.5 // Start after initial rise
            }}
          >
            {/* Wave Animation */}
            <div className="absolute top-0 left-[-50%] w-[200%] h-full">
              <svg 
                viewBox="0 0 120 28" 
                preserveAspectRatio="none" 
                className="absolute top-[-15px] w-full h-8 animate-wave"
                style={{ fill: liquidColor }}
              >
                <path d="M0 15 Q30 0 60 15 T120 15 V30 H0 Z" />
              </svg>
              
              {/* Main Liquid Body */}
              <div 
                className="w-full h-full mt-[-1px]" 
                style={{ 
                  background: `linear-gradient(to bottom, ${liquidColor}, ${isLow ? '#991b1b' : '#1e293b'})`,
                  boxShadow: `inset 0 10px 20px rgba(255,255,255,0.1), 0 0 20px ${glowColor}`
                }} 
              />
              
              {/* Internal Shine */}
              <div className="absolute top-4 left-4 w-4 h-[80%] bg-white/10 rounded-full blur-sm" />
            </div>
          </motion.div>
        </motion.div>

        {/* Glass Reflection */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none z-30" />
      </div>

      {/* Outer Glow */}
      <div 
        className="absolute w-56 h-64 rounded-[3rem] blur-3xl opacity-20 pointer-events-none -z-10"
        style={{ backgroundColor: liquidColor }}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes wave {
          0% { transform: translateX(0); }
          50% { transform: translateX(25%); }
          100% { transform: translateX(0); }
        }
        .animate-wave {
          animation: wave 4s ease-in-out infinite;
        }
      `}} />
    </div>
  );
}
