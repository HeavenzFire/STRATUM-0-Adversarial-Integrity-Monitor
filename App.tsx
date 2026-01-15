
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SimulationPhase, SimulationConfig, SystemMetrics, Task, TraceRecord, TickTrace } from './types';
import { MetricChart } from './components/MetricChart';
import { PhaseControls } from './components/PhaseControls';
import { getAdversarialAnalysis } from './services/gemini';

const INITIAL_CONFIG: SimulationConfig = {
  cpuBudget: 100,
  memoryCap: 4096,
  latencyHardCeiling: 500,
  concurrencyLimit: 20,
  loadShape: 'LINEAR',
  telemetryEnabled: true,
  retriesEnabled: true,
  isAccelerated: false,
  isAutoAdvancing: false,
  phaseTickCounter: 0,
  isRecording: false,
  isReplaying: false
};

const TICKS_PER_PHASE = 30;

const App: React.FC = () => {
  const [phase, setPhase] = useState<SimulationPhase>(SimulationPhase.BASE);
  const [config, setConfig] = useState<SimulationConfig>(INITIAL_CONFIG);
  const [history, setHistory] = useState<SystemMetrics[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  
  const tickRef = useRef<number>(0);
  const taskQueueRef = useRef<Task[]>([]);
  const currentTraceRef = useRef<TickTrace[]>([]);
  const activeTraceDataRef = useRef<TraceRecord | null>(null);

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

  const tick = useCallback(() => {
    tickRef.current += 1;

    let incoming: { id: string; complexity: number }[] = [];

    if (config.isReplaying && activeTraceDataRef.current) {
      const replayStep = activeTraceDataRef.current.data.find(d => d.tick === tickRef.current);
      if (replayStep) {
        incoming = replayStep.incomingTasks;
      } else if (tickRef.current > activeTraceDataRef.current.data.length && activeTraceDataRef.current.data.length > 0) {
        // End of replay sequence
        setConfig(p => ({ ...p, isReplaying: false }));
      }
    } else {
      // Normal Stochastic Generation
      let count = Math.floor(Math.random() * 5);
      if (config.isAccelerated) count = Math.floor(Math.random() * 10) + 5;
      if (phase === SimulationPhase.PHASE_3) {
         if (tickRef.current % 5 === 0) count += 25;
      }

      incoming = Array.from({ length: count }).map((_, i) => ({
        id: `T-${tickRef.current}-${i}`,
        complexity: (Math.random() * 80) + 20
      }));

      if (config.isRecording) {
        currentTraceRef.current.push({ tick: tickRef.current, incomingTasks: incoming });
      }
    }

    // 1. Ingress & Orchestration Router
    const routingCost = incoming.length * 2.5; // Fixed cost per routing decision
    const newTasks: Task[] = incoming.map(inc => ({
      ...inc,
      startTime: Date.now(),
      status: 'PENDING',
      assignedNode: inc.complexity > 70 ? 'PRIMARY_PRO' : 'EDGE_FLASH'
    }));

    taskQueueRef.current = [...taskQueueRef.current, ...newTasks];

    // 2. Admission Control
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

    // 3. Process Execution
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

    // 4. Metrics
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

    // Auto-Advance
    if (config.isAutoAdvancing) {
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
  }, [config, phase]);

  useEffect(() => {
    const intervalTime = config.isAccelerated ? 150 : 1000;
    const interval = setInterval(tick, intervalTime);
    return () => clearInterval(interval);
  }, [tick, config.isAccelerated]);

  useEffect(() => {
    if (config.isReplaying) return; // Don't override during replay
    switch(phase) {
      case SimulationPhase.BASE:
        setConfig(p => ({ ...p, cpuBudget: 100, latencyHardCeiling: 500, concurrencyLimit: 20, retriesEnabled: true }));
        break;
      case SimulationPhase.PHASE_1:
        setConfig(p => ({ ...p, retriesEnabled: false }));
        break;
      case SimulationPhase.PHASE_2:
        setConfig(p => ({ ...p, cpuBudget: 50, latencyHardCeiling: 150, concurrencyLimit: 15 }));
        break;
      case SimulationPhase.PHASE_5:
        setConfig(p => ({ ...p, cpuBudget: 30, latencyHardCeiling: 80, concurrencyLimit: 10 }));
        break;
    }
  }, [phase, config.isReplaying]);

  const integrityScore = Math.max(0, 100 - (history.reduce((acc, curr) => acc + curr.errorCount, 0) / 10));

  return (
    <div className={`flex flex-col lg:flex-row h-screen w-full bg-[#050505] overflow-hidden grid-overlay transition-all duration-1000 ${config.isReplaying ? 'bg-amber-950/10' : ''} ${config.isRecording ? 'border-4 border-red-600/30' : ''}`}>
      {/* Sidebar */}
      <aside className="w-full lg:w-80 h-auto lg:h-full shrink-0 flex flex-col border-r border-zinc-900">
        <PhaseControls 
          currentPhase={phase} 
          config={config} 
          onPhaseChange={setPhase} 
          onConfigChange={(c) => setConfig(p => ({ ...p, ...c }))} 
        />
        
        {/* Trace Sidebar */}
        <div className="flex-1 bg-zinc-950 border-t border-zinc-900 p-6 overflow-y-auto font-mono">
           <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 border-b border-zinc-800 pb-2">DETERMINISTIC TRACES</h2>
           <div className="flex flex-col gap-2">
              <button 
                onClick={config.isRecording ? stopRecordingAndSave : startRecording}
                className={`px-3 py-2 text-[9px] font-bold border transition-all uppercase ${config.isRecording ? 'bg-red-600 border-red-500 text-white animate-pulse' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                {config.isRecording ? 'STOP & SAVE TRACE' : 'RECORD NEW TRACE'}
              </button>
              
              <div className="mt-4 space-y-1">
                {traces.map(t => (
                  <div key={t.id} className="group flex items-center justify-between p-2 bg-zinc-900/30 border border-zinc-900 hover:border-zinc-700 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-zinc-300 font-bold">{t.id}</span>
                      <span className="text-[7px] text-zinc-600 uppercase">{t.phase} | SCORE: {t.integrityScore.toFixed(0)}%</span>
                    </div>
                    <button 
                      onClick={() => startReplay(t.id)}
                      className="text-[8px] px-2 py-1 bg-zinc-100 text-black font-bold hover:bg-white transition-colors"
                    >
                      REPLAY
                    </button>
                  </div>
                ))}
                {traces.length === 0 && <p className="text-[8px] text-zinc-700 text-center py-4 italic">NO TRACES STORED</p>}
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-6 overflow-y-auto gap-6 relative">
        {config.isReplaying && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden bg-amber-500/5 z-0">
             <div className="absolute top-0 left-0 w-full h-1 bg-amber-600 animate-[pulse_0.4s_infinite]" />
             <div className="text-[100px] font-black text-amber-500/5 absolute bottom-0 right-0 leading-none select-none">REPLAY</div>
          </div>
        )}

        {/* Header */}
        <header className="flex justify-between items-center border-b border-zinc-800 pb-4 z-10">
          <div>
            <h1 className="text-xl font-bold tracking-tighter text-zinc-100 flex items-center gap-2">
              <span className={`w-3 h-3 ${config.isRecording ? 'bg-red-600 animate-ping' : config.isReplaying ? 'bg-amber-600 animate-pulse' : 'bg-green-600 animate-pulse'}`}></span>
              STRATUM-0 <span className="text-zinc-500 font-light">// ORCHESTRATION LAYER</span>
              {config.isReplaying && <span className="text-amber-500 text-[10px] border border-amber-500 px-2 ml-2 font-mono">DETERMINISTIC_REPLAY</span>}
              {config.isRecording && <span className="text-red-500 text-[10px] border border-red-500 px-2 ml-2 font-mono">RECORDING_TRACE</span>}
            </h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
              {config.isReplaying ? `REPLAYING: ${config.activeTraceId}` : `MODE: ACTIVE_SIMULATION`} | UPTIME: {tickRef.current}s
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setConfig(p => ({ ...p, isAutoAdvancing: !p.isAutoAdvancing }))}
              className={`px-4 py-2 text-[10px] font-bold border transition-all uppercase ${config.isAutoAdvancing ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400'}`}
            >
              {config.isAutoAdvancing ? 'ABORT SEQUENCE' : 'START AUTO-ADVANCE'}
            </button>
            <button 
              onClick={() => setConfig(p => ({ ...p, isAccelerated: !p.isAccelerated }))}
              className={`px-4 py-2 text-[10px] font-bold border transition-all uppercase ${config.isAccelerated ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400'}`}
            >
              ACCELERATE
            </button>
            <button 
              onClick={runAdversarialAudit}
              disabled={loadingAnalysis}
              className="bg-zinc-100 text-black px-4 py-2 text-[10px] font-bold uppercase hover:bg-white"
            >
              AUDIT
            </button>
          </div>
        </header>

        {/* Orchestration HUD */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 z-10">
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricChart data={history} dataKey="cpuLoad" label="COMPUTE SATURATION (%)" color="#ef4444" />
            <MetricChart data={history} dataKey="throughput" label="NODE THROUGHPUT (TPS)" color="#3b82f6" />
            <MetricChart data={history} dataKey="routingOverhead" label="ROUTING OVERHEAD (MS)" color="#f59e0b" />
          </div>
          
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-sm flex flex-col justify-between">
            <h3 className="text-xs uppercase font-bold tracking-widest text-zinc-500">ORCHESTRATION HUD</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-[8px] text-zinc-500 uppercase">PRO_NODE</span>
                <span className="text-xl font-bold text-zinc-100">{tasks.filter(t => t.assignedNode === 'PRIMARY_PRO').length}</span>
              </div>
              <div className="h-1 w-full bg-zinc-800">
                <div className="h-full bg-blue-600" style={{ width: `${(tasks.filter(t => t.assignedNode === 'PRIMARY_PRO').length / config.concurrencyLimit) * 100}%` }} />
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[8px] text-zinc-500 uppercase">FLASH_EDGE</span>
                <span className="text-xl font-bold text-zinc-100">{tasks.filter(t => t.assignedNode === 'EDGE_FLASH').length}</span>
              </div>
              <div className="h-1 w-full bg-zinc-800">
                <div className="h-full bg-green-600" style={{ width: `${(tasks.filter(t => t.assignedNode === 'EDGE_FLASH').length / config.concurrencyLimit) * 100}%` }} />
              </div>
            </div>
            <div className="pt-4 border-t border-zinc-800 text-[8px] text-zinc-600 uppercase text-center font-bold">
               INTEGRITY INDEX: {integrityScore.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Telemetry Stream */}
        <section className="bg-black border border-zinc-900 p-4 font-mono shadow-inner z-10">
          <div className="flex justify-between items-center mb-4 border-b border-zinc-900 pb-2">
            <h3 className="text-xs uppercase font-bold text-zinc-600 tracking-tighter">ORCHESTRATION_BUS_SNAPSHOT</h3>
            {config.isReplaying && <span className="text-[8px] text-amber-500 font-bold px-2 py-0.5 border border-amber-900">REPLAY_ENABLED</span>}
          </div>
          <div className="h-80 overflow-y-auto space-y-0.5 text-[9px] scrollbar-hide">
            {[...tasks].reverse().map(t => (
              <div key={t.id} className="grid grid-cols-5 border-b border-zinc-900/30 py-1 hover:bg-zinc-900/20 px-2 transition-colors">
                <span className="text-zinc-500">{t.id}</span>
                <span className="text-zinc-600 italic">[{t.assignedNode}]</span>
                <span className="text-zinc-700">CX:{t.complexity.toFixed(0)}</span>
                <span className="text-zinc-700">{(Date.now() - t.startTime)}ms</span>
                <span className={`text-right font-bold ${
                  t.status === 'EXECUTING' ? 'text-blue-600' :
                  t.status === 'REFUSED' ? 'text-zinc-500' :
                  t.status === 'FAILED' ? 'text-red-700' : 'text-green-700'
                }`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Audit Results */}
        {analysis && (
          <section className="bg-zinc-950 border border-zinc-800 p-6 rounded-sm shadow-2xl relative overflow-hidden z-10 animate-in fade-in