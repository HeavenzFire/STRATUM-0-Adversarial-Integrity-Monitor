
import React from 'react';
import { SimulationPhase, SimulationConfig } from '../types';

interface Props {
  currentPhase: SimulationPhase;
  config: SimulationConfig;
  onPhaseChange: (phase: SimulationPhase) => void;
  onConfigChange: (config: Partial<SimulationConfig>) => void;
}

export const PhaseControls: React.FC<Props> = ({ currentPhase, config, onPhaseChange, onConfigChange }) => {
  const phases = Object.values(SimulationPhase);

  return (
    <div className="flex flex-col gap-6 bg-zinc-950 p-6 border-r border-zinc-900 h-full overflow-y-auto font-mono">
      <section>
        <div className="flex justify-between items-center border-b border-zinc-800 pb-2 mb-4">
          <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">ADVERSARIAL STAGE</h2>
          {config.isAutoAdvancing && <span className="text-[8px] text-blue-500 animate-pulse font-bold">AUTO_ADVANCE</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          {phases.map((p) => (
            <button
              key={p}
              disabled={config.isAutoAdvancing}
              onClick={() => onPhaseChange(p)}
              className={`text-left text-[9px] px-3 py-2 transition-all border ${
                currentPhase === p 
                  ? 'bg-red-950/20 border-red-800 text-red-400 font-bold' 
                  : 'bg-zinc-900/20 border-zinc-900 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400 disabled:opacity-50'
              }`}
            >
              {p.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </section>

      <section className={config.isAccelerated ? 'opacity-50 pointer-events-none' : ''}>
        <h2 className="text-[10px] font-bold border-b border-zinc-800 pb-2 mb-4 text-zinc-500 uppercase tracking-widest">HARD CONSTRAINTS</h2>
        <div className="flex flex-col gap-5">
          <ControlSlider 
            label="CPU ALLOCATION" 
            value={config.cpuBudget} 
            suffix="%" 
            onChange={(v) => onConfigChange({ cpuBudget: v })} 
          />
          <ControlSlider 
            label="LATENCY CEILING" 
            value={config.latencyHardCeiling} 
            suffix="ms" 
            min={10} max={1000} step={10}
            onChange={(v) => onConfigChange({ latencyHardCeiling: v })} 
          />
          <ControlSlider 
            label="MAX CONCURRENCY" 
            value={config.concurrencyLimit} 
            min={1} max={100}
            onChange={(v) => onConfigChange({ concurrencyLimit: v })} 
          />
        </div>
      </section>

      <section>
        <h2 className="text-[10px] font-bold border-b border-zinc-800 pb-2 mb-4 text-zinc-500 uppercase tracking-widest">ARCHITECTURAL LOGIC</h2>
        <div className="flex flex-col gap-4">
          <Toggle 
            label="ENABLE RETRIES" 
            active={config.retriesEnabled} 
            disabled={config.isAutoAdvancing}
            onToggle={() => onConfigChange({ retriesEnabled: !config.retriesEnabled })} 
          />
          <Toggle 
            label="REMOTE TELEMETRY" 
            active={config.telemetryEnabled} 
            onToggle={() => onConfigChange({ telemetryEnabled: !config.telemetryEnabled })} 
          />
        </div>
      </section>

      {(config.isAccelerated || config.isAutoAdvancing) && (
        <section className="mt-auto pt-6 border-t border-zinc-900">
           <div className="bg-red-900/10 border border-red-900/30 p-3 rounded-sm">
              <p className="text-[8px] text-red-400 leading-tight uppercase font-bold mb-1">Warning: Thermal Load High</p>
              <p className="text-[7px] text-zinc-600 leading-tight">System is operating at absolute boundary levels. Expect maximum refusal density.</p>
           </div>
        </section>
      )}
    </div>
  );
};

const ControlSlider = ({ label, value, suffix = "", min = 10, max = 100, step = 1, onChange }: any) => (
  <div className="flex flex-col gap-2">
    <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-600">
      <span>{label}</span>
      <span className="text-zinc-400">{value}{suffix}</span>
    </div>
    <input 
      type="range" min={min} max={max} step={step}
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="accent-zinc-100 bg-zinc-900 h-1 appearance-none cursor-crosshair"
    />
  </div>
);

const Toggle = ({ label, active, onToggle, disabled = false }: any) => (
  <label className={`flex items-center gap-3 cursor-pointer group ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}>
    <input 
      type="checkbox" 
      checked={active} 
      disabled={disabled}
      onChange={onToggle}
      className="hidden"
    />
    <div className={`w-8 h-4 border flex items-center p-0.5 transition-colors ${active ? 'bg-zinc-100 border-zinc-100' : 'bg-zinc-900 border-zinc-800'}`}>
      <div className={`w-2.5 h-2.5 ${active ? 'bg-black translate-x-4' : 'bg-zinc-700 translate-x-0'} transition-transform`} />
    </div>
    <span className="text-[9px] uppercase font-bold text-zinc-600 group-hover:text-zinc-400 transition-colors">{label}</span>
  </label>
);
