
export enum SimulationPhase {
  BASE = 'BASE',
  PHASE_1 = 'ENTROPIC_ESCAPE_REMOVAL',
  PHASE_2 = 'CONSTRAINT_COMPRESSION',
  PHASE_3 = 'ADVERSARIAL_LOAD_SHAPE',
  PHASE_4 = 'OBSERVATION_COLLAPSE',
  PHASE_5 = 'ZERO_ERROR_AUDIT'
}

export interface SystemMetrics {
  throughput: number;
  latency: number;
  memoryUsage: number;
  cpuLoad: number;
  refusalCount: number;
  errorCount: number; 
  timestamp: number;
  routingOverhead: number; // New: Cost of orchestration
}

export interface Task {
  id: string;
  complexity: number;
  startTime: number;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'REFUSED' | 'FAILED';
  assignedNode?: 'PRIMARY_PRO' | 'EDGE_FLASH'; // New: Orchestration routing
}

export interface TickTrace {
  tick: number;
  incomingTasks: { id: string; complexity: number }[];
}

export interface TraceRecord {
  id: string;
  timestamp: number;
  phase: SimulationPhase;
  integrityScore: number;
  data: TickTrace[];
}

export interface SimulationConfig {
  cpuBudget: number;
  memoryCap: number;
  latencyHardCeiling: number;
  concurrencyLimit: number;
  loadShape: 'LINEAR' | 'BURST' | 'SKEWED' | 'PATHOLOGICAL';
  telemetryEnabled: boolean;
  retriesEnabled: boolean;
  isAccelerated: boolean;
  isAutoAdvancing: boolean;
  phaseTickCounter: number;
  isRecording: boolean; // New: Trace recording
  isReplaying: boolean; // New: Trace replay
  activeTraceId?: string;
}

export interface AuditReport {
  integrityScore: number;
  summary: string;
  invalidTransitionRisks: string[];
  recommendation: string;
}
