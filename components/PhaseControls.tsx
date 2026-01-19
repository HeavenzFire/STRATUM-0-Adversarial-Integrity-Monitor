
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
    <div className="flex flex-col gap-8 bg-transparent p-6 h-full overflow-y-auto font-mono scrollbar-hide">
      <section>
        <div className="flex justify-between items-center border-b border-zinc-900 pb-3 mb-5">
          <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Lifecycle State</h2>
          {config.isAutopilot && (
            <span className="flex items-center gap-2">
               <span className="text-[7px] text-blue-500 font-bold tracking-tighter animate-pulse">AUTONOMOUS</span>
               <div className="w-1 h-1 bg-blue-500 rounded-full" />
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          {phases.map((p) => (
            <button
              key={p}
              disabled={config.isAutopilot}
              onClick={() => onPhaseChange(p)}
              className={`text-left text-[9px] px-4 py-3 transition-all border-l-2 flex justify-between items-center ${
                currentPhase === p 
                  ? 'bg-blue-950/10 border-blue-600 text-blue-400 font-black' 
                  : 'bg-zinc-900/10 border-zinc-900/50 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400 disabled:opacity-20'
              }`}
            >
              <span>{p.replace(/_/g, ' ')}</span>
              {currentPhase === p && <div className="w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_5px_#3b82f6]" />}
            </button>
          ))}
        </div>
      </section>

      <section className={config.isAutopilot ? 'opacity-80' : ''}>
        <h2 className="text-[10px] font-black border-b border-zinc-900 pb-3 mb-5 text-zinc-500 uppercase tracking-[0.3em] flex justify-between">
          Resource Gates
          {config.isAutopilot && <span className="text-[7px] text-blue-400 animate-pulse font-bold tracking-tight">AI_CONTROL</span>}
        </h2>
        <div className="flex flex-col gap-6">
          <ControlSlider 
            label="COMPUTE_LIMIT" 
            value={config.cpuBudget} 
            suffix="%" 
            disabled={config.isAutopilot}
            onChange={(v: number) => onConfigChange({ cpuBudget: v })} 
          />
          <ControlSlider 
            label="SKEW_CEILING" 
            value={config.latencyHardCeiling} 
            suffix="ms" 
            min={10} max={1000} step={10}
            disabled={config.isAutopilot}
            onChange={(v: number) => onConfigChange({ latencyHardCeiling: v })} 
          />
          <ControlSlider 
            label="THREAD_COUNT" 
            value={config.concurrencyLimit} 
            min={1} max={100}
            disabled={config.isAutopilot}
            onChange={(v: number) => onConfigChange({ concurrencyLimit: v })} 
          />
        </div>
      </section>

      <section>
        <h2 className="text-[10px] font-black border-b border-zinc-900 pb-3 mb-5 text-zinc-500 uppercase tracking-[0.3em]">Stability Protocol</h2>
        <div className="flex flex-col gap-5">
          <Toggle 
            label="SELF_HEALING" 
            active={config.isSelfHealing} 
            onToggle={() => onConfigChange({ isSelfHealing: !config.isSelfHealing })} 
          />
          <Toggle 
            label="FLOW_LOGGING" 
            active={config.telemetryEnabled} 
            onToggle={() => onConfigChange({ telemetryEnabled: !config.telemetryEnabled })} 
          />
          <Toggle 
            label="RETRY_INVARIANTS" 
            active={config.retriesEnabled} 
            disabled={config.isAutopilot}
            onToggle={() => onConfigChange({ retriesEnabled: !config.retriesEnabled })} 
          />
        </div>
      </section>
    </div>
  );
};

const ControlSlider = ({ label, value, suffix = "", min = 10, max = 100, step = 1, onChange, disabled = false }: any) => (
  <div className={`flex flex-col gap-3 ${disabled ? 'opacity-50' : ''}`}>
    <div className="flex justify-between text-[8px] uppercase font-black text-zinc-600 tracking-widest">
      <span>{label}</span>
      <span className={disabled ? 'text-blue-500' : 'text-zinc-300'}>{value}{suffix}</span>
    </div>
    <div className="relative flex items-center">
      <input 
        type="range" min={min} max={max} step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className={`accent-zinc-100 bg-zinc-900/50 h-1 w-full appearance-none cursor-crosshair rounded-full overflow-hidden ${disabled ? 'accent-blue-500' : 'hover:bg-zinc-800'}`}
      />
    </div>
  </div>
);

const Toggle = ({ label, active, onToggle, disabled = false }: any) => (
  <label className={`flex items-center gap-4 cursor-pointer group ${disabled ? 'opacity-20 cursor-not-allowed' : ''}`}>
    <input 
      type="checkbox" 
      checked={active} 
      disabled={disabled}
      onChange={onToggle}
      className="hidden"
    />
    <div className={`w-10 h-5 border-2 flex items-center p-0.5 transition-all ${active ? 'bg-zinc-100 border-zinc-100' : 'bg-transparent border-zinc-800'}`}>
      <div className={`w-3 h-3 ${active ? 'bg-black translate-x-5' : 'bg-zinc-800 translate-x-0'} transition-transform shadow-sm`} />
    </div>
    <span className="text-[9px] uppercase font-black text-zinc-600 group-hover:text-zinc-300 transition-colors tracking-widest">{label}</span>
  </label>
);
