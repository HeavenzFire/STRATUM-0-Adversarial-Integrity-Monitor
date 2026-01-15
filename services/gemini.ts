
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
    Analyze this system telemetry for a high-integrity architecture under pressure.
    PHASE: ${phase}
    CONFIG: ${JSON.stringify(config)}
    RECENT METRICS (last 10 ticks): ${JSON.stringify(metrics.slice(-10))}

    Evaluate based on:
    1. Constraint Density vs State Integrity.
    2. Predictive Failure (Refusal) vs Uncontrolled Failure (Errors).
    3. Entropic leakage.

    Provide a concise, engineering-valid audit report in JSON format.
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
            recommendation: { type: Type.STRING }
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

export const generatePathologicalInput = async (config: SimulationConfig) => {
  const model = "gemini-3-pro-preview";
  const prompt = `Generate a set of 10 pathological task definitions (id, complexity 1-100, arrival_skew) to break a deterministic state machine under these constraints: ${JSON.stringify(config)}. 
  Focus on high churn and near-duplicate tasks. Return JSON array.`;

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
              complexity: { type: Type.NUMBER },
              arrivalSkew: { type: Type.NUMBER }
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
