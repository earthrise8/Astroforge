export type ComponentType = 'capsule' | 'nosecone' | 'payload_bay' | 'fuel_tank' | 'engine' | 'srb' | 'coupler' | 'fins' | 'parachute';

export type FuelType = 'kerosene' | 'hydrogen' | 'solid' | 'xenon';

export interface FuelStats {
  density: number; // kg per unit volume
  isp: number; // Specific impulse (efficiency)
  color: string;
}

export const FUEL_TYPES: Record<FuelType, FuelStats> = {
  kerosene: { density: 0.8, isp: 300, color: '#ffaa00' },
  hydrogen: { density: 0.07, isp: 450, color: '#aaaaff' },
  solid: { density: 1.8, isp: 250, color: '#ff5500' },
  xenon: { density: 3.0, isp: 3000, color: '#00ffff' },
};

export interface RocketComponent {
  id: string;
  instanceId: string; // Unique ID for each instance in the assembly
  type: ComponentType;
  name: string;
  mass: number; // base mass (kg)
  thrust?: number; // base thrust (N)
  isp?: number; // specific impulse (s)
  fuelCapacity?: number; // max fuel units
  passengerCapacity?: number; // number of crew/passengers
  fuelType?: FuelType;
  dragCoefficient: number;
  description: string;
  visualScale: [number, number, number];
  color: string;
  customScale: number; // User-defined multiplier
  shape?: 'ogive' | 'von_karman' | 'parabolic' | 'conic'; // For nosecones
  boosterCount?: number; // For SRBs
}

export interface Stage {
  id: string;
  componentInstanceIds: string[];
}

export interface RocketDesign {
  components: RocketComponent[];
  stages: Stage[];
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  type: 'altitude' | 'payload' | 'landing';
  targetAltitude?: number;
  targetVelocity?: number;
  reward: string;
}

export interface FlightState {
  position: [number, number, number];
  velocity: [number, number, number];
  rotation: [number, number, number];
  liquidFuel: number;
  liquidFuelBySegment: number[];
  srbFuel: number;
  maxLiquidFuel: number;
  maxLiquidFuelBySegment: number[];
  maxSrbFuel: number;
  isEngineActive: boolean;
  isParachuteDeployed: boolean;
  altitude: number;
  maxAltitude: number;
  time: number;
  isCrashed: boolean;
  isLanded: boolean;
  engineTemperature: number;
  structuralStress: number;
  fuelFlowRate: number;
  missionStatus: 'idle' | 'active' | 'success' | 'failed';
  missionProgress: number; // 0-100
  trail: [number, number, number][];
  angularVelocity: [number, number, number];
  gimbalAngle: [number, number]; // [pitch, yaw] in radians
  centerOfMass: number; // Y-offset from rocket base
  throttle: number; // 0-1
  isSrbIgnited: boolean;
  isSasActive: boolean;
  currentStageIndex: number;
  stages: Stage[];
  activeComponentIds: string[];
  detachedComponentIds: string[];
}

export const COMPONENT_TEMPLATES: Record<string, Omit<RocketComponent, 'instanceId' | 'color' | 'customScale'>> = {
  'nosecone-ogive': {
    id: 'nosecone-ogive',
    type: 'nosecone',
    name: 'Ogive Nosecone',
    mass: 150,
    dragCoefficient: 0.05,
    description: 'Classic tangent ogive shape for low supersonic drag.',
    visualScale: [1, 1.5, 1],
    shape: 'ogive',
  },
  'nosecone-von-karman': {
    id: 'nosecone-von-karman',
    type: 'nosecone',
    name: 'Von Karman Nosecone',
    mass: 180,
    dragCoefficient: 0.04,
    description: 'Mathematically optimized for minimum wave drag at high Mach numbers.',
    visualScale: [1, 1.8, 1],
    shape: 'von_karman',
  },
  'nosecone-parabolic': {
    id: 'nosecone-parabolic',
    type: 'nosecone',
    name: 'Parabolic Nosecone',
    mass: 140,
    dragCoefficient: 0.06,
    description: 'Smooth parabolic profile for subsonic and transonic stability.',
    visualScale: [1, 1.4, 1],
    shape: 'parabolic',
  },
  'capsule-standard': {
    id: 'capsule-standard',
    type: 'capsule',
    name: 'Command Capsule',
    mass: 500,
    passengerCapacity: 3,
    dragCoefficient: 0.3,
    description: 'Standard crew capsule for low earth orbit.',
    visualScale: [1, 1, 1],
  },
  'payload-bay-small': {
    id: 'payload-bay-small',
    type: 'payload_bay',
    name: 'Small Payload Bay',
    mass: 300,
    dragCoefficient: 0.1,
    description: 'Hollow section for housing satellites or scientific instruments.',
    visualScale: [1, 1.5, 1],
  },
  'coupler-standard': {
    id: 'coupler-standard',
    type: 'coupler',
    name: 'Interstage Coupler',
    mass: 100,
    dragCoefficient: 0.05,
    description: 'Structural ring used to connect different stages.',
    visualScale: [1, 0.3, 1],
  },
  'tank-small': {
    id: 'tank-small',
    type: 'fuel_tank',
    name: 'Small Fuel Tank',
    mass: 200,
    fuelCapacity: 1000,
    fuelType: 'kerosene',
    dragCoefficient: 0.1,
    description: 'Lightweight tank for short hops.',
    visualScale: [1, 1, 1],
  },
  'tank-large': {
    id: 'tank-large',
    type: 'fuel_tank',
    name: 'Large Fuel Tank',
    mass: 500,
    fuelCapacity: 5000,
    fuelType: 'kerosene',
    dragCoefficient: 0.15,
    description: 'Heavy duty tank for high altitude missions.',
    visualScale: [1, 2, 1],
  },
  'engine-rs25': {
    id: 'engine-rs25',
    type: 'engine',
    name: 'RS-25 (Space Shuttle)',
    mass: 3500,
    thrust: 1800000,
    isp: 450,
    dragCoefficient: 0.25,
    description: 'High-performance hydrogen engine used on the Space Shuttle.',
    visualScale: [1.4, 1.8, 1.4],
  },
  'engine-raptor': {
    id: 'engine-raptor',
    type: 'engine',
    name: 'Raptor Engine',
    mass: 1600,
    thrust: 2200000,
    isp: 380,
    dragCoefficient: 0.2,
    description: 'Methane-fueled full-flow staged combustion engine.',
    visualScale: [1.1, 1.2, 1.1],
  },
  'engine-merlin': {
    id: 'engine-merlin',
    type: 'engine',
    name: 'Merlin 1D',
    mass: 470,
    thrust: 845000,
    isp: 311,
    dragCoefficient: 0.2,
    description: 'Reliable kerosene engine with high thrust-to-weight ratio.',
    visualScale: [0.8, 0.8, 0.8],
  },
  'engine-rd180': {
    id: 'engine-rd180',
    type: 'engine',
    name: 'RD-180',
    mass: 5480,
    thrust: 3830000,
    isp: 311,
    dragCoefficient: 0.3,
    description: 'Powerful dual-chamber engine used on Atlas V.',
    visualScale: [1.8, 1.5, 1.8],
  },
  'engine-f1': {
    id: 'engine-f1',
    type: 'engine',
    name: 'F-1 (Saturn V)',
    mass: 8400,
    thrust: 6770000,
    isp: 263,
    dragCoefficient: 0.4,
    description: 'The most powerful single-chamber liquid-fueled engine ever flown.',
    visualScale: [2.2, 2.5, 2.2],
  },
  'srb-booster': {
    id: 'srb-booster',
    type: 'srb',
    name: 'Strap-on SRB',
    mass: 1000,
    thrust: 1200000,
    isp: 250,
    fuelCapacity: 10000,
    fuelType: 'solid',
    dragCoefficient: 0.3,
    description: 'Solid Rocket Booster for massive initial lift.',
    visualScale: [0.6, 2.5, 0.6],
    boosterCount: 2,
  },
  'srb-heavy': {
    id: 'srb-heavy',
    type: 'srb',
    name: 'Heavy SRB (SLS)',
    mass: 5000,
    thrust: 16000000,
    isp: 269,
    fuelCapacity: 50000,
    fuelType: 'solid',
    dragCoefficient: 0.5,
    description: 'Five-segment solid rocket booster used on the SLS.',
    visualScale: [1.2, 5.0, 1.2],
    boosterCount: 2,
  },
  'fins-basic': {
    id: 'fins-basic',
    type: 'fins',
    name: 'Stabilizing Fins',
    mass: 50,
    dragCoefficient: 0.05,
    description: 'Improves stability during atmospheric flight.',
    visualScale: [1.5, 1, 0.2],
  },
  'parachute-standard': {
    id: 'parachute-standard',
    type: 'parachute',
    name: 'Recovery Parachute',
    mass: 100,
    dragCoefficient: 2.5,
    description: 'Essential for safe landing.',
    visualScale: [0.5, 0.5, 0.5],
  },
};
