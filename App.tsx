
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SimulationPhase, SimulationConfig, SystemMetrics, Task, TraceRecord, TickTrace, DecisionLogEntry } from './types';
import { MetricChart } from './components/MetricChart';
import { PhaseControls } from './components/PhaseControls';
import { getAdversarialAnalysis, getAutopilotPolicy, generatePathologicalInput } from './services/gemini';

const INITIAL_CONFIG: SimulationConfig = {
  cpuBudget: 100,
  memoryCap: 4096,
  latencyHardCeiling: 500,
  concurrencyLimit: 20,
  loadShape: 'LINEAR',
  telemetryEnabled: true,
  retriesEnabled: true,
  isAccelerated: false,
  isAutoAdvancing: true, // Enabled by default as requested
  phaseTickCounter: 0,
  isRecording: false,
  isReplaying: false,
  isAutopilot: false,
  isSelfHealing: true
};

const TICKS_PER_PHASE = 30; // 30 ticks per phase as requested
const AUTOPILOT_INTERVAL = 10; 

const App: React.FC = () => {
  const [phase, setPhase] = useState<SimulationPhase>(SimulationPhase.BASE);
  const [config, setConfig] = useState<SimulationConfig>(INITIAL_CONFIG);
  const [history, setHistory] = useState<SystemMetrics[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [decisionLog, setDecisionLog] = useState<DecisionLogEntry[]>([]);
  
  const tickRef = useRef<number>(0);
  const taskQueueRef = useRef<Task[]>([]);
  const currentTraceRef = useRef<TickTrace[]>([]);
  const activeTraceDataRef = useRef<TraceRecord | null>(null);
  const lastAutopilotTick = useRef<number>(0);

  const startRecording = () => {
    currentTraceRef.current = [];
    setConfig(p => ({ ...p, isRecording: true, isReplaying: false }));
    tickRef.current = 0;
  };

  const stopRecordingAndSave = () => {
    const integrity = Math.max(0, 100 - (history.reduce((acc, curr) => acc + curr.errorCount, 0) / 10));
    const newTrace: TraceRecord = {
      id: `trace-${Date.now()}`,
      timestamp: Date.now(),
      phase,
      integrityScore: integrity,
      data: [...currentTraceRef.current]
    };
    setTraces(prev => [newTrace, ...prev]);
    setConfig(p => ({ ...p, isRecording: false }));
  };

  const startReplay = (traceId: string) => {
    const trace = traces.find(t => t.id === traceId);
    if (!trace) return;
    activeTraceDataRef.current = trace;
    setPhase(trace.phase);
    tickRef.current = 0;
    taskQueueRef.current = [];
    setHistory([]);
    setTasks([]);
    setConfig(p => ({ ...p, isReplaying: true, isRecording: false, activeTraceId: traceId }));
  };

  const runAdversarialAudit = useCallback(async (autoApply: boolean = false) => {
    setLoadingAnalysis(true);
    const result = await getAdversarialAnalysis(history, config, phase);
    setAnalysis(result);
    setLoadingAnalysis(false);

    if (autoApply && result?.suggestedConfig) {
      setConfig(prev => ({
        ...prev,
        ...result.suggestedConfig
      }));
      setDecisionLog(prev => [{
        timestamp: Date.now(),
        action: "AUTO_REMEDIATION_APPLIED",
        reason: "Applied structural fix from Adversarial Audit.",
        isAutoAudit: true
      }, ...prev]);
    }
  }, [history, config, phase]);

  const autopilotStep = useCallback(async () => {
    if (!config.isAutopilot) return;

    const policy = await getAutopilotPolicy(history, config, phase);
    if (policy) {
      setConfig(prev => ({
        ...prev,
        cpuBudget: policy.cpuBudget,
        latencyHardCeiling: policy.latencyHardCeiling,
        concurrencyLimit: policy.concurrencyLimit
      }));

      setDecisionLog(prev => [{
        timestamp: Date.now(),
        action: policy.actionSummary,
        reason: policy.reasoning
      }, ...prev].slice(0, 30));

      if (policy.shouldAdvancePhase && config.isAutoAdvancing) {
        const phases = Object.values(SimulationPhase);
        const currentIndex = phases.indexOf(phase);
        if (currentIndex < phases.length - 1) {
          setPhase(phases[currentIndex + 1]);
          setConfig(prev => ({ ...prev, phaseTickCounter: 0 }));
          setDecisionLog(prev => [{
            timestamp: Date.now(),
            action: "AUTONOMOUS_PHASE_SHIFT",
            reason: "AI verified stability. Escalating system complexity."
          }, ...prev]);
        }
      }

      if (config.isSelfHealing && history.length > 0 && history[history.length-1].errorCount > 0) {
        setDecisionLog(prev => [{
          timestamp: Date.now(),
          action: "SELF_HEALING_ACTIVATED",
          reason: "Detected invariant violations. Initiating emergency audit."
        }, ...prev]);
        runAdversarialAudit(true);
      }
    }
  }, [config.isAutopilot, config.isSelfHealing, config.isAutoAdvancing, history, phase, runAdversarialAudit]);

  const tick = useCallback(() => {
    tickRef.current += 1;

    let incoming: { id: string; complexity: number }[] = [];

    if (config.isReplaying && activeTraceDataRef.current) {
      const replayStep = activeTraceDataRef.current.data.find(d => d.tick === tickRef.current);
      if (replayStep) {
        incoming = replayStep.incomingTasks;
      } else if (tickRef.current > activeTraceDataRef.current.data.length) {
        setConfig(p => ({ ...p, isReplaying: false }));
      }
    } else {
      let count = Math.floor(Math.random() * 5);
      if (config.isAccelerated) count = Math.floor(Math.random() * 10) + 5;
      
      if (phase === SimulationPhase.PHASE_3) {
         if (tickRef.current % 5 === 0) count += 25;
      } else if (phase === SimulationPhase.PHASE_5) {
         count += 8; 
      }

      incoming = Array.from({ length: count }).map((_, i) => ({
        id: `T-${tickRef.current}-${i}`,
        complexity: (Math.random() * 80) + 20
      }));

      if (config.isAutopilot && tickRef.current % 50 === 0 && history.length > 0 && history[history.length-1].errorCount === 0) {
        generatePathologicalInput(config).then(patho => {
          if (patho.length > 0) {
            taskQueueRef.current = [...taskQueueRef.current, ...patho.map(p => ({
              id: `SYNTH-${p.id}`,
              complexity: p.complexity,
              startTime: Date.now(),
              status: 'PENDING' as const,
              assignedNode: 'PRIMARY_PRO' as const
            }))];
          }
        });
      }

      if (config.isRecording) {
        currentTraceRef.current.push({ tick: tickRef.current, incomingTasks: incoming });
      }
    }

    const routingCost = incoming.length * 2.5;
    const newTasks: Task[] = incoming.map(inc => ({
      ...inc,
      startTime: Date.now(),
      status: 'PENDING',
      assignedNode: inc.complexity > 70 ? 'PRIMARY_PRO' : 'EDGE_FLASH'
    }));

    taskQueueRef.current = [...taskQueueRef.current, ...newTasks];

    const activeTasks = taskQueueRef.current.filter(t => t.status === 'EXECUTING');
    const pendingTasks = taskQueueRef.current.filter(t => t.status === 'PENDING');
    
    let errorCount = 0;
    let refusalCount = 0;

    pendingTasks.forEach(task => {
      if (activeTasks.length >= config.concurrencyLimit) {
        if (!config.retriesEnabled) {
          task.status = 'REFUSED';
          refusalCount++;
        }
      } else {
        task.status = 'EXECUTING';
      }
    });

    const currentTickTasks = taskQueueRef.current.filter(t => t.status === 'EXECUTING');
    currentTickTasks.forEach(task => {
      const duration = Date.now() - task.startTime;
      const overheadMultiplier = task.assignedNode === 'PRIMARY_PRO' ? 1.2 : 0.8;
      
      if (duration > config.latencyHardCeiling) {
        if (phase === SimulationPhase.PHASE_2 || phase === SimulationPhase.PHASE_5) {
          task.status = 'REFUSED'; 
          refusalCount++;
        } else {
          task.status = 'FAILED';
          errorCount++;
        }
      } else if (duration > (task.complexity * overheadMultiplier * (100 / config.cpuBudget))) {
        task.status = 'COMPLETED';
      }
    });

    const finishedIds = taskQueueRef.current
      .filter(t => t.status === 'COMPLETED' || t.status === 'REFUSED' || t.status === 'FAILED')
      .map(t => t.id);
    
    taskQueueRef.current = taskQueueRef.current.filter(t => !finishedIds.includes(t.id));

    const currentMetrics: SystemMetrics = {
      throughput: finishedIds.length,
      latency: pendingTasks.length > 0 ? Date.now() - pendingTasks[0].startTime : 0,
      memoryUsage: (activeTasks.length * 40) + (Math.random() * 100),
      cpuLoad: Math.min(100, (activeTasks.length / config.concurrencyLimit) * 100),
      refusalCount,
      errorCount,
      timestamp: tickRef.current,
      routingOverhead: routingCost
    };

    setHistory(prev => [...prev.slice(-100), currentMetrics]);
    setTasks(taskQueueRef.current);

    if (config.isAutopilot && tickRef.current - lastAutopilotTick.current >= AUTOPILOT_INTERVAL) {
      lastAutopilotTick.current = tickRef.current;
      autopilotStep();
    }

    if (config.isAutoAdvancing && !config.isAutopilot) {
      setConfig(prev => {
        const nextTickCount = prev.phaseTickCounter + 1;
        if (nextTickCount >= TICKS_PER_PHASE) {
          const phases = Object.values(SimulationPhase);
          const currentIndex = phases.indexOf(phase);
          if (currentIndex < phases.length - 1) {
            setPhase(phases[currentIndex + 1]);
            return { ...prev, phaseTickCounter: 0 };
          }
          return { ...prev, isAutoAdvancing: false, phaseTickCounter: 0 };
        }
        return { ...prev, phaseTickCounter: nextTickCount };
      });
    }
  }, [config, phase, autopilotStep]);

  useEffect(() => {
    const intervalTime = config.isAccelerated ? 150 : 1000;
    const interval = setInterval(tick, intervalTime);
    return () => clearInterval(interval);
  }, [tick, config.isAccelerated]);

  const integrityScore = Math.max(0, 100 - (history.reduce((acc, curr) => acc + curr.errorCount, 0) / 10));

  return (
    <div className={`flex flex-col lg:flex-row h-screen w-full bg-[#030303] overflow-hidden grid-overlay transition-all duration-1000 ${config.isAutopilot ? 'border-l-8 border-blue-500/80 shadow-[inset_10px_0_30px_rgba(59,130,246,0.1)]' : ''}`}>
      <aside className="w-full lg:w-80 h-auto lg:h-full shrink-0 flex flex-col border-r border-zinc-900 bg-black/60 backdrop-blur-xl">
        <PhaseControls 
          currentPhase={phase} 
          config={config} 
          onPhaseChange={setPhase} 
          onConfigChange={(c) => setConfig(p => ({ ...p, ...c }))} 
        />
        
        <div className="flex-1 border-t border-zinc-900 p-6 overflow-y-auto font-mono scrollbar-hide">
           <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4 border-b border-zinc-900 pb-2 flex justify-between items-center">
            EXECUTIVE_LOG
            {config.isAutopilot && <span className="flex gap-1"><span className="w-1 h-1 bg-blue-500 animate-ping"></span><span className="w-1 h-1 bg-blue-500 animate-ping delay-75"></span></span>}
           </h2>
           <div className="space-y-4">
              {decisionLog.map((log, i) => (
                <div key={i} className={`border-l-2 ${log.isAutoAudit ? 'border-red-600 bg-red-900/5' : 'border-blue-800 bg-blue-900/5'} pl-3 py-2 transition-all hover:bg-zinc-900/20`}>
                  <p className={`text-[9px] font-black uppercase tracking-tighter ${log.isAutoAudit ? 'text-red-400' : 'text-blue-400'}`}>{log.action}</p>
                  <p className="text-[8px] text-zinc-500 italic mt-1 leading-tight">{log.reason}</p>
                  <p className="text-[7px] text-zinc-700 mt-2 font-bold">{new Date(log.timestamp).toLocaleTimeString()}</p>
                </div>
              ))}
              {decisionLog.length === 0 && <p className="text-[8px] text-zinc-800 text-center py-10 tracking-widest uppercase">SYSTEM_STALL: IDLE</p>}
           </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col p-8 overflow-y-auto gap-8 relative">
        {config.isAutopilot && (
          <div className="absolute inset-0 pointer-events-none z-0">
             <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-[scan_3s_linear_infinite]" />
             <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-blue-500 to-transparent animate-[scan_4s_linear_infinite]" />
          </div>
        )}

        <header className="flex justify-between items-end border-b border-zinc-900 pb-6 z-10">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-sm ${config.isAutopilot ? 'bg-blue-600 shadow-[0_0_10px_#3b82f6]' : 'bg-green-600 animate-pulse'}`} />
              <h1 className="text-2xl font-black tracking-[-0.05em] text-zinc-100 uppercase">
                STRATUM-0 <span className="text-zinc-600 font-light tracking-normal">Autonomous Integrity Nerve Center</span>
              </h1>
            </div>
            <div className="flex gap-6 mt-2 font-mono items-center">
              <span className="text-[10px] text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-1 bg-zinc-800 rounded-full" /> T_DOMAIN: {tickRef.current}s
              </span>
              <span className="text-[10px] text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-1 bg-zinc-800 rounded-full" /> SYNC_MODE: {config.isAutopilot ? 'AI_GOVERNED' : 'MANUAL_OVERRIDE'}
              </span>
              {config.isAutoAdvancing && !config.isAutopilot && (
                <div className="flex flex-col gap-1 min-w-[120px]">
                  <div className="flex justify-between text-[8px] text-blue-500 font-black uppercase tracking-tighter">
                    <span>PHASE PROGRESS</span>
                    <span>{config.phaseTickCounter} / {TICKS_PER_PHASE}</span>
                  </div>
                  <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${(config.phaseTickCounter / TICKS_PER_PHASE) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3">
             <button 
              onClick={() => setConfig(p => ({ ...p, isAutopilot: !p.isAutopilot, isAutoAdvancing: !p.isAutopilot ? true : p.isAutoAdvancing }))}
              className={`px-6 py-2.5 text-[11px] font-black border-2 transition-all uppercase tracking-widest ${config.isAutopilot ? 'bg-blue-600 border-blue-400 text-white' : 'bg-transparent border-zinc-800 text-zinc-600 hover:border-zinc-400 hover:text-zinc-100'}`}
            >
              {config.isAutopilot ? 'HALT AUTONOMY' : 'ENGAGE AUTOPILOT'}
            </button>
            <button 
              onClick={() => setConfig(p => ({ ...p, isAccelerated: !p.isAccelerated }))}
              className={`px-4 py-2.5 text-[11px] font-black border-2 transition-all uppercase tracking-widest ${config.isAccelerated ? 'bg-red-950/30 border-red-800 text-red-500' : 'bg-transparent border-zinc-800 text-zinc-600'}`}
            >
              ACCEL
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 z-10">
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricChart data={history} dataKey="cpuLoad" label="COMPUTE DENSITY" color="#ef4444" />
            <MetricChart data={history} dataKey="throughput" label="FLOW RATE (TPS)" color="#3b82f6" />
            <MetricChart data={history} dataKey="latency" label="RESPONSE LAGGARD" color="#f59e0b" />
          </div>
          
          <div className="bg-zinc-900/10 border border-zinc-800/50 p-6 rounded-sm flex flex-col justify-between group relative overflow-hidden backdrop-blur-sm">
            <div className={`absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl ${integrityScore < 95 ? 'from-red-600/20' : 'from-blue-600/20'} opacity-50`} />
            <h3 className="text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-600">INTEGRITY_INDEX (Φ)</h3>
            <div className="flex flex-col items-center py-4">
              <span className={`text-6xl font-black transition-all tracking-tighter ${integrityScore < 95 ? 'text-red-500 animate-pulse' : 'text-zinc-100'}`}>
                {integrityScore.toFixed(1)}
              </span>
              <span className="text-[8px] text-zinc-700 uppercase mt-2 font-mono">Real-time Stability Manifold</span>
            </div>
            <div className="pt-4 border-t border-zinc-900 space-y-2 font-mono">
               <div className="flex justify-between text-[9px]">
                  <span className="text-zinc-600">VIOLATIONS:</span>
                  <span className={history[history.length-1]?.errorCount > 0 ? 'text-red-600 font-black' : 'text-zinc-400'}>
                    {history[history.length-1]?.errorCount || 0}
                  </span>
               </div>
               <div className="flex justify-between text-[9px]">
                  <span className="text-zinc-600">PREDICTIVE:</span>
                  <span className="text-zinc-400">{history[history.length-1]?.refusalCount || 0}</span>
               </div>
            </div>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 z-10">
           <div className="bg-black/40 border border-zinc-900 p-6 rounded-sm">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">PRIMARY_PRO_CLUSTER</h3>
               <span className="text-[8px] bg-blue-950 text-blue-400 px-3 py-1 font-bold tracking-tighter">HIGH_FIDELITY</span>
             </div>
             <div className="grid grid-cols-1 gap-2">
                {tasks.filter(t => t.assignedNode === 'PRIMARY_PRO').map(t => (
                  <div key={t.id} className="text-[9px] flex justify-between bg-zinc-900/20 p-2 border border-zinc-800/30 font-mono group hover:bg-zinc-800/40 transition-colors">
                    <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">{t.id}</span>
                    <div className="flex gap-4">
                      <span className="text-blue-700 font-bold">CX_{t.complexity.toFixed(0)}</span>
                      <span className="text-zinc-800 font-black">{Math.floor((Date.now() - t.startTime))}ms</span>
                    </div>
                  </div>
                ))}
                {tasks.filter(t => t.assignedNode === 'PRIMARY_PRO').length === 0 && (
                  <div className="text-[10px] text-zinc-800 uppercase tracking-widest py-10 text-center border border-dashed border-zinc-900">
                    AWAITING_COMPLEX_INGRESS
                  </div>
                )}
             </div>
           </div>
           
           <div className="bg-black/40 border border-zinc-900 p-6 rounded-sm">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">EDGE_FLASH_MESH</h3>
               <span className="text-[8px] bg-green-950 text-green-400 px-3 py-1 font-bold tracking-tighter">LOW_LATENCY</span>
             </div>
             <div className="grid grid-cols-1 gap-2">
                {tasks.filter(t => t.assignedNode === 'EDGE_FLASH').map(t => (
                  <div key={t.id} className="text-[9px] flex justify-between bg-zinc-900/20 p-2 border border-zinc-800/30 font-mono group hover:bg-zinc-800/40 transition-colors">
                    <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">{t.id}</span>
                    <div className="flex gap-4">
                      <span className="text-green-700 font-bold">CX_{t.complexity.toFixed(0)}</span>
                      <span className="text-zinc-800 font-black">{Math.floor((Date.now() - t.startTime))}ms</span>
                    </div>
                  </div>
                ))}
                {tasks.filter(t => t.assignedNode === 'EDGE_FLASH').length === 0 && (
                  <div className="text-[10px] text-zinc-800 uppercase tracking-widest py-10 text-center border border-dashed border-zinc-900">
                    IDLE_STATE_MAINTAINED
                  </div>
                )}
             </div>
           </div>
        </section>

        {analysis && (
          <section className="bg-zinc-950 border-2 border-zinc-900 p-8 rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden z-10 animate-in slide-in-from-bottom-10 duration-500">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-600/50" />
            <div className="flex items-center gap-6 mb-8">
              <div className="p-3 bg-red-900/20 border border-red-900/40 rounded-sm">
                <div className="w-5 h-5 bg-red-600 rounded-sm shadow-[0_0_10px_#dc2626]" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-widest uppercase text-zinc-100">AUTONOMOUS AUDIT PROTOCOL</h2>
                <p className="text-[9px] text-zinc-500 uppercase font-mono tracking-widest">Trace ID: {Math.random().toString(36).substring(7).toUpperCase()} // Result Code: 0x2A</p>
              </div>
              <div className={`ml-auto text-xl font-black font-mono px-6 py-2 rounded-sm border-2 ${analysis.integrityScore > 95 ? 'border-green-900/50 text-green-500' : 'border-red-900/50 text-red-500'}`}>
                Φ_RES: {analysis.integrityScore}%
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <h4 className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.3em]">System Evaluation</h4>
                <p className="text-xs text-zinc-400 leading-relaxed font-light pl-4 border-l border-zinc-800 italic">
                  {analysis.summary}
                </p>
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.3em]">State-Space Risks</h4>
                <div className="space-y-2">
                  {analysis.invalidTransitionRisks.map((risk: string, i: number) => (
                    <div key={i} className="text-[10px] p-3 bg-zinc-900/50 border border-zinc-800 text-zinc-500 flex gap-3 items-center group hover:bg-zinc-900 transition-colors">
                      <span className="w-1 h-1 bg-red-900 group-hover:bg-red-600 rounded-full transition-colors" />
                      {risk}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-900 flex justify-between items-center">
               <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-red-700 uppercase tracking-widest">REMEDIAL_PRESCRIPTION:</span>
                  <span className="text-[11px] text-zinc-300 font-light">{analysis.recommendation}</span>
               </div>
               {analysis.autoApplied && <span className="text-[9px] bg-green-900/20 text-green-500 px-3 py-1 font-bold border border-green-900/30">AUTO_APPLIED</span>}
            </div>
          </section>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 w-full bg-black/90 backdrop-blur-md border-t border-zinc-900 py-2 px-8 z-50 pointer-events-none flex justify-between items-center font-mono">
        <div className="flex gap-8 text-[9px] text-zinc-700 tracking-widest font-bold">
           <span>STRATUM-0_V1.5A</span>
           <span className={config.isAutopilot ? 'text-blue-800' : ''}>AUTH: {config.isAutopilot ? 'AI_SYS_CORE' : 'USER_OPS'}</span>
           <span>PHASE: {phase}</span>
        </div>
        <div className="flex gap-10 text-[9px] text-zinc-700 tracking-widest font-bold uppercase">
           <span>Flow: {history[history.length-1]?.throughput || 0} TPS</span>
           <span>Skew: {history[history.length-1]?.latency.toFixed(2)}ms</span>
           <span className="text-green-900 flex items-center gap-2">
              <span className="w-1 h-1 bg-green-900 rounded-full animate-pulse" /> SYSTEM_NOMINAL
           </span>
        </div>
      </footer>

      {config.isReplaying && (
        <div className="fixed inset-0 bg-amber-950/5 pointer-events-none z-40 border-8 border-amber-900/20 flex items-center justify-center">
           <div className="text-[15vw] font-black text-amber-900/5 select-none tracking-tighter">REPLAY_SEQUENCE</div>
        </div>
      )}
    </div>
  );
};

export default App;
