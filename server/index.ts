import 'dotenv/config';

import express from 'express';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(express.json({ limit: '256kb' }));

const PORT = Number(process.env.API_PORT || 8787);
const RATE_LIMIT_WINDOW_MS = 5000;

const requestLog = new Map<string, number>();

type FuelType = 'kerosene' | 'hydrogen' | 'solid' | 'xenon';

type DesignComponent = {
  name?: string;
  mass?: number;
  thrust?: number;
  fuelCapacity?: number;
  fuelType?: FuelType;
  customScale?: number;
};

const FUEL_DENSITY: Record<FuelType, number> = {
  kerosene: 0.8,
  hydrogen: 0.07,
  solid: 1.8,
  xenon: 3.0,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/analysis/rocket', async (req, res) => {
  const now = Date.now();
  const clientId = req.ip || 'unknown';
  const previous = requestLog.get(clientId) || 0;

  if (now - previous < RATE_LIMIT_WINDOW_MS) {
    return res.status(429).json({ error: 'Too many requests. Retry in a few seconds.' });
  }
  requestLog.set(clientId, now);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Server is missing GEMINI_API_KEY.' });
  }

  const componentsRaw = req.body?.components;
  if (!Array.isArray(componentsRaw) || componentsRaw.length === 0) {
    return res.status(400).json({ error: 'Request must include at least one component.' });
  }

  if (componentsRaw.length > 300) {
    return res.status(400).json({ error: 'Component count is too large.' });
  }

  const components = componentsRaw as DesignComponent[];
  const normalizedComponents = components.map((component) => {
    const scale = clamp(Number(component.customScale ?? 1) || 1, 0.1, 20);
    const fuelType: FuelType = (component.fuelType && component.fuelType in FUEL_DENSITY)
      ? component.fuelType
      : 'kerosene';

    return {
      name: String(component.name || 'Unnamed Component').slice(0, 80),
      mass: clamp(Number(component.mass ?? 0) || 0, 0, 1_000_000),
      thrust: clamp(Number(component.thrust ?? 0) || 0, 0, 1_000_000_000),
      fuelCapacity: clamp(Number(component.fuelCapacity ?? 0) || 0, 0, 1_000_000),
      fuelType,
      customScale: scale,
    };
  });

  const totalMass = normalizedComponents.reduce((sum, component) => {
    const dryMass = component.mass * component.customScale;
    const fuelMass = component.fuelCapacity * FUEL_DENSITY[component.fuelType] * component.customScale;
    return sum + dryMass + fuelMass;
  }, 0);

  const totalThrust = normalizedComponents.reduce((sum, component) => {
    return sum + (component.thrust * component.customScale);
  }, 0);

  const totalFuel = normalizedComponents.reduce((sum, component) => {
    return sum + (component.fuelCapacity * component.customScale);
  }, 0);

  const twr = totalMass > 0 ? totalThrust / (totalMass * 9.81) : 0;

  const prompt = [
    'Analyze this rocket design for a flight simulator as Mission Control.',
    `Components: ${normalizedComponents.map((c) => c.name).join(', ')}`,
    `Total mass (full): ${Math.round(totalMass)} kg`,
    `Total thrust: ${Math.round(totalThrust)} N`,
    `Total fuel units: ${Math.round(totalFuel)}`,
    `Estimated sea-level TWR: ${twr.toFixed(2)}`,
    'Provide concise technical advice in at most 3 sentences and mention whether it is likely orbit-capable or too heavy.',
  ].join('\n');

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return res.json({
      advice: response.text || 'Design looks nominal. Ready for launch.',
      metrics: {
        totalMass,
        totalThrust,
        totalFuel,
        twr,
      },
    });
  } catch (error) {
    console.error('Rocket analysis failed', error);
    return res.status(502).json({ error: 'Gemini request failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`Astroforge API listening on port ${PORT}`);
});
