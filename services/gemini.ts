
import { GoogleGenAI, Type } from "@google/genai";
import { SystemMetrics, SimulationPhase, SimulationConfig } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getAdversarialAnalysis = async (
  metrics: SystemMetrics[],
  config: SimulationConfig,
  phase: SimulationPhase
) => {
  const model = "gemini-3-pro-preview";
  const prompt = `
    EXECUTIVE ADVERSARIAL AUDIT FOR STRATUM-0.
    PHASE: ${phase}
    CONFIG: ${JSON.stringify(config)}
    DATASET: ${JSON.stringify(metrics.slice(-15))}

    Your objective is to identify deep architectural vulnerabilities in this high-integrity manifold.
    Focus on:
    1. Deterministic Drift: Are outcomes becoming probabilistic?
    2. Constraint Saturation: Are we near the point of total state collapse?
    3. Remediation: Provide a specific numeric configuration adjustment.

    Return JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            integrityScore: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            invalidTransitionRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendation: { type: Type.STRING },
            suggestedConfig: {
              type: Type.OBJECT,
              properties: {
                cpuBudget: { type: Type.NUMBER },
                latencyHardCeiling: { type: Type.NUMBER },
                concurrencyLimit: { type: Type.NUMBER }
              }
            }
          },
          required: ["integrityScore", "summary", "invalidTransitionRisks", "recommendation"]
        },
        thinkingConfig: { thinkingBudget: 4000 }
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Adversarial Analysis failed", error);
    return null;
  }
};

export const getAutopilotPolicy = async (
  metrics: SystemMetrics[],
  config: SimulationConfig,
  phase: SimulationPhase
) => {
  const model = "gemini-3-flash-preview";
  const prompt = `
    SYSTEM GOVERNANCE PROTOCOL: STRATUM-0 AUTOPILOT.
    PHASE: ${phase}
    CONFIG: ${JSON.stringify(config)}
    TELEMETRY: ${JSON.stringify(metrics.slice(-5))}

    CRITICAL INVARIANTS:
    - Integrity Score must remain > 98%.
    - If ErrorCount > 0, immediate restriction of concurrency.
    - If stable for 10+ ticks, tighten constraints (lower budget/ceiling) to improve Syntropic Potential (Φ).

    Return adjustment JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cpuBudget: { type: Type.NUMBER },
            latencyHardCeiling: { type: Type.NUMBER },
            concurrencyLimit: { type: Type.NUMBER },
            actionSummary: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            shouldAdvancePhase: { type: Type.BOOLEAN }
          },
          required: ["cpuBudget", "latencyHardCeiling", "concurrencyLimit", "actionSummary", "reasoning", "shouldAdvancePhase"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return null;
  }
};

export const generatePathologicalInput = async (config: SimulationConfig) => {
  const model = "gemini-3-flash-preview";
  const prompt = `Synthesize 5 pathological task payloads designed to bypass the current admission control invariants for this configuration: ${JSON.stringify(config)}. Complexity 1-100. Return JSON array.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              complexity: { type: Type.NUMBER }
            }
          }
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return [];
  }
};
