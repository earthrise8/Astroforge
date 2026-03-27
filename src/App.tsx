/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { 
  Rocket, 
  Play, 
  RotateCcw, 
  Settings, 
  ChevronRight, 
  ChevronLeft, 
  Info,
  Wind,
  Zap,
  ArrowUp,
  Droplets,
  Trophy,
  AlertTriangle,
  Cpu,
  LayoutGrid,
  Target,
  Box,
  ArrowDownCircle,
  Home,
  Folder,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Triangle,
  Square,
  Circle,
  Link as LinkIcon,
  Flame,
  Layout,
  Maximize2,
  Globe,
  User,
  Eye,
  Pin,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  RocketComponent, 
  RocketDesign, 
  COMPONENT_TEMPLATES, 
  ComponentType, 
  FlightState,
  Mission,
  FUEL_TYPES,
  FuelType,
  Stage
} from './types';
import { cn } from './lib/utils';

// Constants
const GRAVITY = 9.81;
const AIR_DENSITY = 1.225; // kg/m^3 at sea level
const TIME_STEP = 1 / 60;
const ATTACHMENT_TYPES = ['srb', 'fins'];

const MISSIONS: Mission[] = [
  {
    id: 'alt_1',
    name: 'Atmospheric Breach',
    description: 'Reach an altitude of 5,000 meters to test structural integrity.',
    type: 'altitude',
    targetAltitude: 5000,
    reward: 'Advanced Alloys Unlocked',
  },
  {
    id: 'payload_1',
    name: 'Satellite Deployment',
    description: 'Deliver a payload to 2,000 meters. Maintain vertical velocity below 5 m/s at target.',
    type: 'payload',
    targetAltitude: 2000,
    targetVelocity: 5,
    reward: 'Navigation Computer Mk II',
  },
  {
    id: 'landing_1',
    name: 'Reusable Booster Test',
    description: 'Ascend to at least 1,000 meters, then perform a soft landing (velocity < 5 m/s).',
    type: 'landing',
    targetAltitude: 1000,
    targetVelocity: 5,
    reward: 'Heavy Lift Engines Unlocked',
  },
];

const INITIAL_FLIGHT_STATE: FlightState = {
  position: [0, 1, 0],
  velocity: [0, 0, 0],
  rotation: [0, 0, 0],
  liquidFuel: 0,
  liquidFuelBySegment: [],
  srbFuel: 0,
  maxLiquidFuel: 0,
  maxLiquidFuelBySegment: [],
  maxSrbFuel: 0,
  isEngineActive: false,
  isParachuteDeployed: false,
  altitude: 0,
  maxAltitude: 0,
  time: 0,
  isCrashed: false,
  isLanded: true,
  engineTemperature: 20, // Celsius (ambient)
  structuralStress: 0, // 0-100%
  fuelFlowRate: 0, // kg/s
  missionStatus: 'idle',
  missionProgress: 0,
  trail: [],
  angularVelocity: [0, 0, 0],
  gimbalAngle: [0, 0],
  centerOfMass: 0,
  throttle: 0,
  isSrbIgnited: false,
  isSasActive: false,
  currentStageIndex: 0,
  stages: [],
  activeComponentIds: [],
  detachedComponentIds: [],
};

interface SortableItemProps {
  comp: RocketComponent;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onUpdate: (updates: Partial<RocketComponent>) => void;
  key?: React.Key;
}

type LaunchValidationIssue = {
  id: string;
  severity: 'error' | 'warning';
  message: string;
};

function SortableItem({ 
  comp, 
  index, 
  isSelected, 
  onSelect, 
  onRemove,
  onUpdate
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: comp.instanceId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "group relative bg-slate-800/30 border rounded-xl flex flex-col transition-all overflow-hidden",
        isSelected ? "border-orange-500 bg-slate-800/60 shadow-lg shadow-orange-500/10" : "border-slate-700/50 hover:border-slate-600",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-center p-3 gap-3">
        <div 
          {...attributes} 
          {...listeners} 
          className="cursor-grab active:cursor-grabbing p-1 text-slate-600 hover:text-slate-400"
        >
          <div className="grid grid-cols-2 gap-0.5">
            {[...Array(4)].map((_, i) => <div key={i} className="w-1 h-1 bg-current rounded-full" />)}
          </div>
        </div>
        <div className="flex-1 cursor-pointer" onClick={onSelect}>
          <div className="text-xs font-bold flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: comp.color }} />
            {comp.name}
          </div>
          <div className="text-[9px] text-slate-500 uppercase flex gap-2">
            <span>{comp.type}</span>
            <span>•</span>
            <span>x{comp.customScale.toFixed(1)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-all p-1"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className={cn("transition-transform duration-200", isSelected ? "rotate-180" : "rotate-0")}>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-700/50 bg-slate-900/40 p-4 space-y-4"
          >
            <div className="space-y-3">
              {/* Color Picker */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {['#ffffff', '#dddddd', '#333333', '#cc0000', '#0066cc', '#009944', '#ffcc00'].map(color => (
                    <button
                      key={color}
                      onClick={() => onUpdate({ color })}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 transition-all",
                        comp.color === color ? "border-orange-500 scale-110" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Scale Slider */}
              {comp.type !== 'engine' && comp.type !== 'srb' && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Size Scale</label>
                    <span className="text-[10px] font-mono text-slate-300">x{comp.customScale.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="0.5" max="2.0" step="0.1"
                    value={comp.customScale}
                    onChange={(e) => onUpdate({ customScale: parseFloat(e.target.value) })}
                    className="w-full accent-orange-500"
                  />
                </div>
              )}

              {/* Booster Count (only for SRBs) */}
              {comp.type === 'srb' && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Booster Count</label>
                    <span className="text-[10px] font-mono text-slate-300">{comp.boosterCount || 2} Boosters</span>
                  </div>
                  <input 
                    type="range" min="1" max="8" step="1"
                    value={comp.boosterCount || 2}
                    onChange={(e) => onUpdate({ boosterCount: parseInt(e.target.value) })}
                    className="w-full accent-orange-500"
                  />
                </div>
              )}

              {/* Fuel Type (only for tanks) */}
              {comp.type === 'fuel_tank' && (
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Fuel Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(FUEL_TYPES) as FuelType[]).map(ft => (
                      <button
                        key={ft}
                        onClick={() => onUpdate({ fuelType: ft })}
                        className={cn(
                          "text-[10px] py-1 rounded border transition-all uppercase font-bold",
                          comp.fuelType === ft 
                            ? "bg-orange-500 border-orange-400 text-white" 
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                        )}
                      >
                        {ft}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Component Stats */}
              <div className="pt-2 border-t border-slate-700/30 grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Mass</span>
                  <span className="text-[10px] font-mono text-slate-300">{Math.round(comp.mass * Math.pow(comp.customScale, 3) * (comp.boosterCount || 1))} kg</span>
                </div>
                {comp.fuelCapacity !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-slate-500 uppercase font-bold">Fuel Cap</span>
                    <span className="text-[10px] font-mono text-slate-300">{Math.round(comp.fuelCapacity * comp.customScale * (comp.boosterCount || 1))} units</span>
                  </div>
                )}
                {comp.thrust !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-slate-500 uppercase font-bold">Thrust</span>
                    <span className="text-[10px] font-mono text-orange-400">{Math.round(comp.thrust * Math.pow(comp.customScale, 2) * (comp.boosterCount || 1))} N</span>
                  </div>
                )}
                {comp.passengerCapacity !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-slate-500 uppercase font-bold">Crew</span>
                    <span className="text-[10px] font-mono text-blue-400">{comp.passengerCapacity}</span>
                  </div>
                )}
                {comp.isp !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-slate-500 uppercase font-bold">Isp</span>
                    <span className="text-[10px] font-mono text-green-400">{comp.isp}s</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SortableStageTimelineProps {
  stageId: string;
  idx: number;
  isCurrent: boolean;
  isPast: boolean;
  isNext: boolean;
  stage: Stage;
  design: RocketDesign;
  key?: React.Key;
}

interface FlightComponentPopup {
  componentInstanceId: string;
  x: number;
  y: number;
  pinned: boolean;
}

function SortableStageTimeline({ stageId, idx, isCurrent, isPast, isNext, stage, design }: SortableStageTimelineProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stageId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn(
        "flex-shrink-0 w-12 h-12 rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-500 relative cursor-grab active:cursor-grabbing",
        isCurrent ? "bg-orange-500 border-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.4)]" :
        isPast ? "bg-slate-900 border-slate-800 opacity-40" :
        "bg-slate-900 border-slate-700 hover:border-slate-600"
      )}
    >
      {isCurrent && (
        <motion.div 
          layoutId="active-stage-glow-timeline"
          className="absolute -inset-2 bg-orange-500/20 rounded-2xl blur-xl"
        />
      )}
      <span className={cn(
        "text-[10px] font-black uppercase tracking-tighter",
        isCurrent ? "text-white" : "text-slate-500"
      )}>
        S{idx + 1}
      </span>
      <div className="flex gap-0.5 mt-0.5">
        {stage.componentInstanceIds.slice(0, 2).map(id => {
          const comp = design.components.find(c => c.instanceId === id);
          if (!comp) return null;
          return (
            <div key={id} className={cn(
              "w-0.5 h-0.5 rounded-full",
              comp.type === 'engine' ? "bg-orange-400" :
              comp.type === 'srb' ? "bg-red-400" :
              comp.type === 'coupler' ? "bg-slate-400" :
              "bg-green-400"
            )} />
          );
        })}
      </div>
    </motion.div>
  );
}

export default function App() {
  const [mode, setMode] = useState<'build' | 'flight'>('build');
  const [activeNavTab, setActiveNavTab] = useState<'home' | 'components' | 'staging' | 'missions' | 'ai' | 'saved' | 'settings'>('components');
  const [componentFilter, setComponentFilter] = useState<ComponentType | 'all'>('all');
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [savedDesigns, setSavedDesigns] = useState<{id: string, name: string, design: RocketDesign}[]>(() => {
    const saved = localStorage.getItem('astroforge_saved_designs');
    if (saved) return JSON.parse(saved);
    return [];
  });
  const [design, setDesign] = useState<RocketDesign>(() => {
    const saved = localStorage.getItem('astroforge_design');
    if (saved) return JSON.parse(saved);
    return {
      components: [
        { ...COMPONENT_TEMPLATES['capsule-standard'], instanceId: 'initial-capsule', color: '#ffffff', customScale: 1 },
        { ...COMPONENT_TEMPLATES['tank-small'], instanceId: 'initial-tank', color: '#dddddd', customScale: 1 },
        { ...COMPONENT_TEMPLATES['engine-merlin'], instanceId: 'initial-engine', color: '#333333', customScale: 1 },
      ] as RocketComponent[],
      stages: []
    };
  });

  useEffect(() => {
    localStorage.setItem('astroforge_design', JSON.stringify(design));
  }, [design]);

  useEffect(() => {
    localStorage.setItem('astroforge_saved_designs', JSON.stringify(savedDesigns));
  }, [savedDesigns]);
  const [selectedComponentIndex, setSelectedComponentIndex] = useState<number | null>(null);
  const [expandedLibraryItem, setExpandedLibraryItem] = useState<string | null>(null);
  const [componentSearch, setComponentSearch] = useState<string>('');
  const [flightState, setFlightState] = useState<FlightState>(INITIAL_FLIGHT_STATE);
  const [aiAdvice, setAiAdvice] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [cameraView, setCameraView] = useState<'follow' | 'ground' | 'top' | 'passenger'>('follow');
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0, z: 0 });
  const [cameraZoom, setCameraZoom] = useState(1);
  const [timeWarp, setTimeWarp] = useState(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlightShortcutsOpen, setIsFlightShortcutsOpen] = useState(true);
  const [isFlightStagingOpen, setIsFlightStagingOpen] = useState(true);
  const [flightComponentPopups, setFlightComponentPopups] = useState<FlightComponentPopup[]>([]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    rocket: THREE.Group;
    ground: THREE.Mesh;
    stars: THREE.Points;
    controls: OrbitControls;
    trailLine: THREE.Line;
    comMarker: THREE.Mesh;
    explosion?: {
      points: THREE.Points;
      velocities: Float32Array;
      startTime: number;
    };
    parachute?: THREE.Mesh;
    launchPad: THREE.Group;
    exhaustParticles?: {
      points: THREE.Points;
      velocities: Float32Array;
      lifetimes: Float32Array;
    };
    srbExhaustParticles?: {
      points: THREE.Points;
      velocities: Float32Array;
      lifetimes: Float32Array;
    };
  } | null>(null);

  const requestRef = useRef<number>(null);

  // Refs for stable render loop
  const flightStateRef = useRef(flightState);
  const modeRef = useRef(mode);
  const designRef = useRef(design);
  const cameraViewRef = useRef(cameraView);
  const cameraOffsetRef = useRef(cameraOffset);
  const cameraZoomRef = useRef(cameraZoom);
  const timeWarpRef = useRef(timeWarp);
  const countdownRef = useRef(countdown);
  const keysPressed = useRef<Set<string>>(new Set());

  useEffect(() => { flightStateRef.current = flightState; }, [flightState]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { designRef.current = design; }, [design]);
  useEffect(() => { cameraViewRef.current = cameraView; }, [cameraView]);
  useEffect(() => { cameraOffsetRef.current = cameraOffset; }, [cameraOffset]);
  useEffect(() => { cameraZoomRef.current = cameraZoom; }, [cameraZoom]);
  useEffect(() => { timeWarpRef.current = timeWarp; }, [timeWarp]);
  useEffect(() => { countdownRef.current = countdown; }, [countdown]);

  const getFuelMassForComponent = (comp: RocketComponent) => {
    const scale = comp.customScale || 1;
    const count = comp.type === 'srb' ? (comp.boosterCount || 1) : 1;
    const fuelUnits = (comp.fuelCapacity || 0) * scale * count;
    const fuelDensity = comp.fuelType ? FUEL_TYPES[comp.fuelType].density : 1;
    return fuelUnits * fuelDensity;
  };

  const getSegmentAssignments = (detachedComponentIds: string[] = []) => {
    const detachedSet = new Set(detachedComponentIds);
    const segmentByComponent: Record<string, number> = {};
    let segmentIndex = 0;
    let lastMainSegment = 0;

    design.components.forEach(comp => {
      if (detachedSet.has(comp.instanceId)) return;

      if (ATTACHMENT_TYPES.includes(comp.type)) {
        segmentByComponent[comp.instanceId] = lastMainSegment;
        return;
      }

      segmentByComponent[comp.instanceId] = segmentIndex;
      lastMainSegment = segmentIndex;

      if (comp.type === 'coupler') {
        segmentIndex += 1;
      }
    });

    return segmentByComponent;
  };

  const getLiquidFuelBySegment = (detachedComponentIds: string[] = []) => {
    const detachedSet = new Set(detachedComponentIds);
    const segmentByComponent = getSegmentAssignments(detachedComponentIds);
    const fuelBySegment: number[] = [];

    design.components.forEach(comp => {
      if (detachedSet.has(comp.instanceId)) return;
      if (comp.type === 'srb' || !comp.fuelCapacity) return;

      const segment = segmentByComponent[comp.instanceId] || 0;
      fuelBySegment[segment] = (fuelBySegment[segment] || 0) + getFuelMassForComponent(comp);
    });

    return fuelBySegment;
  };

  const getComponentFuelMass = (comp: RocketComponent, fs: FlightState) => {
    if (fs.detachedComponentIds.includes(comp.instanceId)) return 0;

    const activeComponents = design.components.filter(c => !fs.detachedComponentIds.includes(c.instanceId));

    if (comp.type === 'srb') {
      const totalSrbCapacity = activeComponents.reduce((sum, c) => {
        if (c.type !== 'srb') return sum;
        return sum + getFuelMassForComponent(c);
      }, 0);

      if (totalSrbCapacity <= 0) return 0;
      return (fs.srbFuel / totalSrbCapacity) * getFuelMassForComponent(comp);
    }

    if (!comp.fuelCapacity) return 0;

    const segmentByComponent = getSegmentAssignments(fs.detachedComponentIds);
    const segment = segmentByComponent[comp.instanceId] || 0;
    const segmentFuel = fs.liquidFuelBySegment[segment] || 0;

    let segmentCapacity = 0;
    activeComponents.forEach(c => {
      if (c.type === 'srb' || !c.fuelCapacity) return;
      if ((segmentByComponent[c.instanceId] || 0) !== segment) return;
      segmentCapacity += getFuelMassForComponent(c);
    });

    if (segmentCapacity <= 0) return 0;
    return (segmentFuel / segmentCapacity) * getFuelMassForComponent(comp);
  };

  const getComponentHeating = (comp: RocketComponent, fs: FlightState) => {
    const speed = Math.sqrt(fs.velocity[0] ** 2 + fs.velocity[1] ** 2 + fs.velocity[2] ** 2);
    const aeroHeating = Math.min(450, (speed * speed) / 220);
    const stressHeating = fs.structuralStress * 1.1;
    const engineBias = comp.type === 'engine' ? 1.15 : comp.type === 'srb' ? 1.05 : 0.45;
    const activeBias = fs.activeComponentIds.includes(comp.instanceId) ? 40 : 0;

    return Math.max(20, fs.engineTemperature * engineBias + aeroHeating + stressHeating + activeBias);
  };

  useEffect(() => {
    if (mode !== 'flight') {
      setFlightComponentPopups([]);
    }
  }, [mode]);

  useEffect(() => {
    const validIds = new Set(design.components.map(c => c.instanceId));
    setFlightComponentPopups(prev => prev.filter(p => validIds.has(p.componentInstanceId)));
  }, [design]);

  const capsuleOffset = useMemo(() => {
    let totalHeight = 0;
    design.components.forEach(c => {
      if (ATTACHMENT_TYPES.includes(c.type)) return;
      const scale = c.customScale || 1;
      if (c.type === 'nosecone') totalHeight += c.visualScale[1] * scale;
      else if (c.type === 'capsule') totalHeight += 1 * scale;
      else if (c.type === 'fuel_tank' || c.type === 'payload_bay') totalHeight += c.visualScale[1] * scale;
      else if (c.type === 'coupler') totalHeight += 0.3 * scale;
      else if (c.type === 'engine') totalHeight += c.visualScale[1] * scale;
      else totalHeight += 0.5 * scale;
    });

    let y = totalHeight;
    let lastMainY = totalHeight;
    for (const comp of design.components) {
      const scale = comp.customScale || 1;
      let height = 0.5 * scale;
      if (comp.type === 'nosecone') height = comp.visualScale[1] * scale;
      else if (comp.type === 'capsule') height = 1 * scale;
      else if (comp.type === 'fuel_tank' || comp.type === 'payload_bay') height = comp.visualScale[1] * scale;
      else if (comp.type === 'coupler') height = 0.3 * scale;
      else if (comp.type === 'engine') height = comp.visualScale[1] * scale;
      
      let compY = y - height / 2;
      if (ATTACHMENT_TYPES.includes(comp.type)) {
        compY = lastMainY;
      } else {
        lastMainY = y - height / 2;
        y -= height;
      }

      if (comp.type === 'capsule' || comp.type === 'nosecone') {
        return compY;
      }
    }
    return totalHeight - 0.5;
  }, [design]);

  const launchValidationIssues = useMemo<LaunchValidationIssue[]>(() => {
    const issues: LaunchValidationIssue[] = [];
    const propulsionComponents = design.components.filter(c => c.type === 'engine' || c.type === 'srb');

    if (design.components.length === 0) {
      issues.push({
        id: 'empty-design',
        severity: 'error',
        message: 'No components in vehicle. Add at least one command module and propulsion system.',
      });
      return issues;
    }

    if (propulsionComponents.length === 0) {
      issues.push({
        id: 'no-propulsion',
        severity: 'error',
        message: 'No propulsion detected. Add at least one engine or SRB.',
      });
    }

    const totalFuelMass = design.components.reduce((sum, component) => {
      return sum + getFuelMassForComponent(component);
    }, 0);

    if (totalFuelMass <= 0) {
      issues.push({
        id: 'no-fuel',
        severity: 'error',
        message: 'No usable fuel detected. Add a fueled tank or SRB to launch safely.',
      });
    }

    const stages = design.stages || [];
    const componentIds = new Set(design.components.map(c => c.instanceId));

    if (stages.length === 0) {
      issues.push({
        id: 'no-stages',
        severity: 'warning',
        message: 'No staging sequence defined. You can still fly, but in-flight activation will be manual.',
      });
    } else {
      stages.forEach((stage, idx) => {
        if (stage.componentInstanceIds.length === 0) {
          issues.push({
            id: `empty-stage-${stage.id}`,
            severity: 'warning',
            message: `Stage ${idx + 1} is empty and will do nothing when activated.`,
          });
        }

        const invalidIds = stage.componentInstanceIds.filter(id => !componentIds.has(id));
        if (invalidIds.length > 0) {
          issues.push({
            id: `invalid-stage-refs-${stage.id}`,
            severity: 'error',
            message: `Stage ${idx + 1} references missing components and needs repair.`,
          });
        }
      });

      const firstStage = stages[0];
      const firstStagePropulsion = firstStage?.componentInstanceIds.some(id => {
        const component = design.components.find(c => c.instanceId === id);
        return component?.type === 'engine' || component?.type === 'srb';
      }) || false;

      if (!firstStagePropulsion) {
        issues.push({
          id: 'stage-1-no-propulsion',
          severity: 'error',
          message: 'Stage 1 has no propulsion assigned. Add an engine or SRB to the first stage.',
        });
      }
    }

    return issues;
  }, [design]);

  const hasBlockingLaunchIssue = launchValidationIssues.some(issue => issue.severity === 'error');

  // Gemini AI Integration
  const analyzeRocket = async () => {
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/analysis/rocket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          components: design.components,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const errorMessage = (errorPayload && errorPayload.error) || 'Mission Control unavailable.';
        throw new Error(errorMessage);
      }

      const payload = await response.json();
      setAiAdvice(payload.advice || "Design looks nominal. Ready for launch.");
    } catch (error) {
      console.error("AI Analysis failed", error);
      if (error instanceof Error && error.message) {
        setAiAdvice(`Mission Control offline: ${error.message}`);
      } else {
        setAiAdvice("Mission Control offline. Proceed with caution.");
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  // Initialize Three.js
  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    // scene.background = new THREE.Color(0x87ceeb); // Removed for transparency in build mode

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100000);
    camera.position.set(0, 3, 15);
    camera.lookAt(0, 1.5, 0);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    
    if (canvasRef.current) {
      canvasRef.current.appendChild(renderer.domElement);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1.5;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 1.5;
    controls.enabled = mode === 'build';

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(500, 1000, 500);
    scene.add(sunLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(10000, 10000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3d5a3d });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Stars (for high altitude)
    const starGeo = new THREE.BufferGeometry();
    const starCount = 5000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      starPos[i] = (Math.random() - 0.5) * 20000;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, transparent: true, opacity: 0 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Launch Pad
    const launchPad = new THREE.Group();
    const padBaseGeo = new THREE.CylinderGeometry(10, 12, 1, 32);
    const padBaseMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 });
    const padBase = new THREE.Mesh(padBaseGeo, padBaseMat);
    padBase.position.y = 0.5;
    launchPad.add(padBase);

    const padTowerGeo = new THREE.BoxGeometry(2, 20, 2);
    const padTowerMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.7 });
    const padTower = new THREE.Mesh(padTowerGeo, padTowerMat);
    padTower.position.set(-6, 10, 0);
    launchPad.add(padTower);
    
    const armGeo = new THREE.BoxGeometry(4, 0.5, 0.5);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(-3, 15, 0);
    launchPad.add(arm);
    
    scene.add(launchPad);

    // Rocket Group
    const rocket = new THREE.Group();
    scene.add(rocket);

    // Trail Line
    const trailGeo = new THREE.BufferGeometry();
    const trailMat = new THREE.LineBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.6 });
    const trailLine = new THREE.Line(trailGeo, trailMat);
    scene.add(trailLine);

    // CoM Marker
    const comGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const comMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8 });
    const comMarker = new THREE.Mesh(comGeo, comMat);
    comMarker.visible = false; // Hidden by default
    scene.add(comMarker);

    // Explosion Particles
    const explosionCount = 2000;
    const explosionGeo = new THREE.BufferGeometry();
    const explosionPos = new Float32Array(explosionCount * 3);
    const explosionVel = new Float32Array(explosionCount * 3);
    const explosionColors = new Float32Array(explosionCount * 3);
    for (let i = 0; i < explosionCount; i++) {
      explosionPos[i * 3] = 0;
      explosionPos[i * 3 + 1] = 0;
      explosionPos[i * 3 + 2] = 0;
      
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 5 + Math.random() * 40;
      explosionVel[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
      explosionVel[i * 3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
      explosionVel[i * 3 + 2] = speed * Math.cos(phi);

      const color = new THREE.Color();
      color.setHSL(0.05 + Math.random() * 0.1, 1, 0.5 + Math.random() * 0.5);
      explosionColors[i * 3] = color.r;
      explosionColors[i * 3 + 1] = color.g;
      explosionColors[i * 3 + 2] = color.b;
    }
    explosionGeo.setAttribute('position', new THREE.BufferAttribute(explosionPos, 3));
    explosionGeo.setAttribute('color', new THREE.BufferAttribute(explosionColors, 3));
    const explosionMat = new THREE.PointsMaterial({ size: 1.5, vertexColors: true, transparent: true, opacity: 0 });
    const explosionPoints = new THREE.Points(explosionGeo, explosionMat);
    scene.add(explosionPoints);

    // Exhaust Particles
    const exhaustCount = 1600;
    const exhaustGeo = new THREE.BufferGeometry();
    const exhaustPos = new Float32Array(exhaustCount * 3);
    const exhaustVel = new Float32Array(exhaustCount * 3);
    const exhaustLifetimes = new Float32Array(exhaustCount);
    for (let i = 0; i < exhaustCount; i++) {
      exhaustLifetimes[i] = -1; // Inactive
    }
    exhaustGeo.setAttribute('position', new THREE.BufferAttribute(exhaustPos, 3));
    const exhaustMat = new THREE.PointsMaterial({
      size: 0.95,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      vertexColors: false,
      color: 0xffc88a
    });
    const exhaustPoints = new THREE.Points(exhaustGeo, exhaustMat);
    scene.add(exhaustPoints);

    // SRB Exhaust Particles
    const srbExhaustCount = 1800;
    const srbExhaustGeo = new THREE.BufferGeometry();
    const srbExhaustPos = new Float32Array(srbExhaustCount * 3);
    const srbExhaustVel = new Float32Array(srbExhaustCount * 3);
    const srbExhaustLifetimes = new Float32Array(srbExhaustCount);
    for (let i = 0; i < srbExhaustCount; i++) {
      srbExhaustLifetimes[i] = -1;
    }
    srbExhaustGeo.setAttribute('position', new THREE.BufferAttribute(srbExhaustPos, 3));
    const srbExhaustMat = new THREE.PointsMaterial({
      size: 0.7,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      color: 0xffe6c7
    });
    const srbExhaustPoints = new THREE.Points(srbExhaustGeo, srbExhaustMat);
    scene.add(srbExhaustPoints);

    // Raycaster for selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isFlightPanning = false;
    let lastPanX = 0;
    let lastPanY = 0;

    const handleCanvasClick = (event: MouseEvent) => {
      if (!canvasRef.current) return;
      
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(rocket.children, true);

      if (modeRef.current === 'build') {
        if (intersects.length > 0) {
          let object = intersects[0].object;
          while (object.parent && object.userData.index === undefined && object.parent !== rocket) {
            object = object.parent;
          }
          
          if (object.userData.index !== undefined) {
            setSelectedComponentIndex(object.userData.index);
          } else {
            setSelectedComponentIndex(null);
          }
        } else {
          setSelectedComponentIndex(null);
        }
        return;
      }

      if (modeRef.current !== 'flight') return;

      if (intersects.length > 0) {
        let object = intersects[0].object;
        while (object.parent && !object.userData.instanceId && object.userData.index === undefined && object.parent !== rocket) {
          object = object.parent;
        }

        let clickedInstanceId: string | undefined = object.userData.instanceId;
        if (!clickedInstanceId && object.userData.index !== undefined) {
          clickedInstanceId = designRef.current.components[object.userData.index]?.instanceId;
        }

        if (clickedInstanceId) {
          const popupWidth = 230;
          const popupHeight = 130;
          const x = Math.max(12, Math.min(rect.width - popupWidth - 12, event.clientX - rect.left + 12));
          const y = Math.max(12, Math.min(rect.height - popupHeight - 12, event.clientY - rect.top + 12));

          setFlightComponentPopups(prev => {
            const pinnedPopups = prev.filter(p => p.pinned);
            const existingPinned = pinnedPopups.find(p => p.componentInstanceId === clickedInstanceId);
            if (existingPinned) return prev;
            return [...pinnedPopups, { componentInstanceId: clickedInstanceId, x, y, pinned: false }];
          });
        } else {
          setFlightComponentPopups(prev => prev.filter(p => p.pinned));
        }
      } else {
        setFlightComponentPopups(prev => prev.filter(p => p.pinned));
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (modeRef.current !== 'flight') return;
      if (event.button !== 2) return;
      event.preventDefault();
      isFlightPanning = true;
      lastPanX = event.clientX;
      lastPanY = event.clientY;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (modeRef.current !== 'flight' || !isFlightPanning) return;

      const dx = event.clientX - lastPanX;
      const dy = event.clientY - lastPanY;
      lastPanX = event.clientX;
      lastPanY = event.clientY;

      const panScale = 0.02;
      setCameraOffset(prev => ({
        ...prev,
        x: prev.x - dx * panScale,
        y: prev.y + dy * panScale,
      }));
    };

    const stopFlightPan = () => {
      isFlightPanning = false;
    };

    const handleFlightWheel = (event: WheelEvent) => {
      if (modeRef.current !== 'flight') return;
      event.preventDefault();

      const zoomStep = 0.0015;
      setCameraZoom(prev => Math.max(0.2, Math.min(10, prev + event.deltaY * zoomStep)));
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (modeRef.current !== 'flight') return;
      event.preventDefault();
    };

    renderer.domElement.addEventListener('click', handleCanvasClick);
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseup', stopFlightPan);
    renderer.domElement.addEventListener('mouseleave', stopFlightPan);
    renderer.domElement.addEventListener('wheel', handleFlightWheel, { passive: false });
    renderer.domElement.addEventListener('contextmenu', handleContextMenu);

    sceneRef.current = { 
      scene, camera, renderer, rocket, ground, stars, controls, trailLine, comMarker,
      explosion: {
        points: explosionPoints,
        velocities: explosionVel,
        startTime: 0
      },
      launchPad,
      exhaustParticles: {
        points: exhaustPoints,
        velocities: exhaustVel,
        lifetimes: exhaustLifetimes
      },
      srbExhaustParticles: {
        points: srbExhaustPoints,
        velocities: srbExhaustVel,
        lifetimes: srbExhaustLifetimes
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      if (!canvasRef.current) return;
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    
    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mouseup', stopFlightPan);
      renderer.domElement.removeEventListener('mouseleave', stopFlightPan);
      renderer.domElement.removeEventListener('wheel', handleFlightWheel);
      renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
      renderer.dispose();
    };
  }, []);

  // Update Rocket Visuals
  useEffect(() => {
    if (!sceneRef.current) return;
    const { rocket, scene } = sceneRef.current;
    
    // Clear existing rocket parts
    while(rocket.children.length > 0) {
      rocket.remove(rocket.children[0]);
    }

    // Calculate total height first to stack from bottom up
    let totalHeight = 0;
    const activeComponents = design.components.filter(c => !flightState.detachedComponentIds.includes(c.instanceId));
    
    activeComponents.forEach(comp => {
      if (ATTACHMENT_TYPES.includes(comp.type)) return;
      const scale = comp.customScale || 1;
      if (comp.type === 'nosecone') totalHeight += comp.visualScale[1] * scale;
      else if (comp.type === 'capsule') totalHeight += 1 * scale;
      else if (comp.type === 'fuel_tank' || comp.type === 'payload_bay') totalHeight += comp.visualScale[1] * scale;
      else if (comp.type === 'coupler') totalHeight += 0.3 * scale;
      else if (comp.type === 'engine') totalHeight += comp.visualScale[1] * scale;
      else totalHeight += 0.5 * scale;
    });

    let currentY = totalHeight;
    let lastMainY = totalHeight;
    activeComponents.forEach((comp) => {
      const originalIdx = design.components.findIndex(c => c.instanceId === comp.instanceId);
      const isSelected = selectedComponentIndex === originalIdx;
      let geometry: THREE.BufferGeometry;
      const material = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(comp.color),
        metalness: 0.5,
        roughness: 0.5,
        emissive: isSelected ? new THREE.Color(0x0066ff) : new THREE.Color(0x000000),
        emissiveIntensity: isSelected ? 0.5 : 0
      });

      const scale = comp.customScale || 1;
      const visualScale = [comp.visualScale[0] * scale, comp.visualScale[1] * scale, comp.visualScale[2] * scale];

      if (comp.type === 'nosecone') {
        const points = [];
        const segments = 20;
        const height = visualScale[1];
        const radius = 0.5 * scale;
        
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const y = t * height;
          let r = 0;
          
          if (comp.shape === 'ogive') {
            // Tangent ogive approximation
            const rho = (radius * radius + height * height) / (2 * radius);
            r = Math.sqrt(rho * rho - Math.pow(height - y, 2)) + radius - rho;
          } else if (comp.shape === 'von_karman') {
            // Haack series (Von Karman) approximation
            const theta = Math.acos(1 - (2 * y) / height);
            r = (radius / Math.sqrt(Math.PI)) * Math.sqrt(theta - Math.sin(2 * theta) / 2);
          } else if (comp.shape === 'parabolic') {
            const K = 0.5; // Parabolic coefficient
            r = radius * ((2 * (y / height) - K * Math.pow(y / height, 2)) / (2 - K));
          } else {
            // Conic
            r = radius * (1 - y / height);
          }
          points.push(new THREE.Vector2(Math.max(0, r), y));
        }
        geometry = new THREE.LatheGeometry(points, 32);
        // Rotate lathe to point up
        geometry.rotateX(Math.PI);
        geometry.translate(0, height / 2, 0);
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { index: originalIdx, instanceId: comp.instanceId };
        mesh.position.y = currentY - height / 2;
        lastMainY = currentY - height / 2;
        currentY -= height;
        rocket.add(mesh);
        return;
      } else if (comp.type === 'capsule') {
        geometry = new THREE.ConeGeometry(0.5 * scale, 1 * scale, 32);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { index: originalIdx, instanceId: comp.instanceId };
        mesh.position.y = currentY - (1 * scale) / 2;
        lastMainY = currentY - (1 * scale) / 2;
        currentY -= (1 * scale);
        rocket.add(mesh);
        return;
      } else if (comp.type === 'srb') {
        const srbGroup = new THREE.Group();
        const srbCount = comp.boosterCount || 2;
        // Offset should be core radius (0.5) + srb radius (0.3 * visualScale[0])
        const offset = (0.5 * scale) + (0.3 * visualScale[0]);
        for (let i = 0; i < srbCount; i++) {
          const srbGeo = new THREE.CylinderGeometry(0.3 * visualScale[0], 0.3 * visualScale[0], visualScale[1], 32);
          const srbCapGeo = new THREE.ConeGeometry(0.3 * visualScale[0], 0.4 * visualScale[0], 32);
          const srbMesh = new THREE.Mesh(srbGeo, material);
          const srbCap = new THREE.Mesh(srbCapGeo, material);
          srbCap.position.y = visualScale[1] / 2 + 0.2 * visualScale[0];
          
          const booster = new THREE.Group();
          booster.add(srbMesh);
          booster.add(srbCap);
          
          // Add nozzle marker for exhaust
          const srbNozzle = new THREE.Object3D();
          srbNozzle.position.y = -visualScale[1] / 2;
          srbNozzle.userData = { isSrbNozzle: true, instanceId: comp.instanceId };
          booster.add(srbNozzle);
          
          booster.userData = { index: originalIdx, instanceId: comp.instanceId };
          
          const angle = (i / srbCount) * Math.PI * 2;
          booster.position.set(Math.cos(angle) * offset, 0, Math.sin(angle) * offset);
          srbGroup.add(booster);
        }
        srbGroup.userData = { index: originalIdx };
        const height = visualScale[1];
        srbGroup.position.y = lastMainY; // Sit around the main part
        rocket.add(srbGroup);
        return;
      } else if (comp.type === 'fuel_tank' || comp.type === 'payload_bay') {
        geometry = new THREE.CylinderGeometry(0.5 * scale, 0.5 * scale, visualScale[1], 32);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { index: originalIdx, instanceId: comp.instanceId };
        mesh.position.y = currentY - visualScale[1] / 2;
        lastMainY = currentY - visualScale[1] / 2;
        currentY -= visualScale[1];
        rocket.add(mesh);
        return;
      } else if (comp.type === 'coupler') {
        geometry = new THREE.CylinderGeometry(0.5 * scale, 0.5 * scale, 0.3 * scale, 32);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { index: originalIdx, instanceId: comp.instanceId };
        mesh.position.y = currentY - (0.3 * scale) / 2;
        lastMainY = currentY - (0.3 * scale) / 2;
        currentY -= (0.3 * scale);
        rocket.add(mesh);
        return;
      } else if (comp.type === 'engine') {
        const engineGroup = new THREE.Group();
        const bodyGeo = new THREE.CylinderGeometry(0.5 * scale, 0.5 * scale, visualScale[1] * 0.6, 32);
        const body = new THREE.Mesh(bodyGeo, material);
        body.position.y = visualScale[1] * 0.2;
        body.userData = { index: originalIdx, instanceId: comp.instanceId };
        
        const nozzleGeo = new THREE.CylinderGeometry(0.3 * scale, 0.6 * scale, visualScale[1] * 0.4, 32);
        const nozzle = new THREE.Mesh(nozzleGeo, material);
        nozzle.position.y = -visualScale[1] * 0.3;
        nozzle.userData = { index: originalIdx, isNozzle: true, instanceId: comp.instanceId };
        
        engineGroup.add(body);
        engineGroup.add(nozzle);
        engineGroup.userData = { index: originalIdx, instanceId: comp.instanceId };
        
        const height = visualScale[1];
        engineGroup.position.y = currentY - height / 2;
        lastMainY = currentY - height / 2;
        currentY -= height;
        rocket.add(engineGroup);
        return;
      } else if (comp.type === 'fins') {
        const finGroup = new THREE.Group();
        const finCount = 4;
        for (let i = 0; i < finCount; i++) {
          const finGeo = new THREE.BoxGeometry(0.6 * scale, 0.8 * scale, 0.05 * scale);
          const finMat = new THREE.MeshStandardMaterial({ 
            color: new THREE.Color(comp.color),
            emissive: isSelected ? new THREE.Color(0x0066ff) : new THREE.Color(0x000000),
            emissiveIntensity: isSelected ? 0.5 : 0
          });
          const fin = new THREE.Mesh(finGeo, finMat);
          const angle = (i / finCount) * Math.PI * 2;
          fin.position.set(Math.cos(angle) * 0.5 * scale, 0, Math.sin(angle) * 0.5 * scale);
          fin.rotation.y = -angle;
          fin.userData = { index: originalIdx };
          finGroup.add(fin);
        }
        finGroup.userData = { index: originalIdx };
        finGroup.position.y = lastMainY;
        rocket.add(finGroup);
        return;
      } else if (comp.type === 'parachute') {
        const parachuteGroup = new THREE.Group();
        const baseGeo = new THREE.CylinderGeometry(0.4 * scale, 0.4 * scale, 0.2 * scale, 32);
        const base = new THREE.Mesh(baseGeo, material);
        base.userData = { index: originalIdx };
        parachuteGroup.add(base);

        if (flightState.isParachuteDeployed) {
          const canopyGeo = new THREE.SphereGeometry(2 * scale, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
          const canopyMat = new THREE.MeshStandardMaterial({ color: 0xff4444, side: THREE.DoubleSide });
          const canopy = new THREE.Mesh(canopyGeo, canopyMat);
          canopy.position.y = 3 * scale;
          parachuteGroup.add(canopy);

          // Lines
          const lineMat = new THREE.LineBasicMaterial({ color: 0xcccccc });
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const lineGeo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(Math.cos(angle) * 2 * scale, 3 * scale, Math.sin(angle) * 2 * scale)
            ]);
            parachuteGroup.add(new THREE.Line(lineGeo, lineMat));
          }
        }

        parachuteGroup.userData = { index: originalIdx };
        const height = 0.5 * scale;
        parachuteGroup.position.y = currentY - height / 2;
        lastMainY = currentY - height / 2;
        currentY -= height;
        rocket.add(parachuteGroup);
        return;
      } else {
        geometry = new THREE.BoxGeometry(0.5 * scale, 0.5 * scale, 0.5 * scale);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { index: originalIdx };
        mesh.position.y = currentY - (0.5 * scale) / 2;
        lastMainY = currentY - (0.5 * scale) / 2;
        currentY -= (0.5 * scale);
        rocket.add(mesh);
        return;
      }
    });

    // Center the rocket group for build mode centering or flight positioning
    if (mode === 'build') {
      rocket.position.set(0, 0, 0);
      rocket.rotation.set(0, 0, 0);
      // Adjust camera target to look at the rocket
      if (sceneRef.current) {
        sceneRef.current.controls.target.set(0, totalHeight / 2, 0);
      }
    } else {
      rocket.position.set(flightState.position[0], flightState.position[1], flightState.position[2]);
      rocket.rotation.set(flightState.rotation[0], flightState.rotation[1], flightState.rotation[2]);
    }
  }, [design, mode, selectedComponentIndex, flightState.detachedComponentIds, flightState.isParachuteDeployed]);

  // Physics Loop
  const updatePhysics = () => {
    const currentFlightState = flightStateRef.current;
    const isPreLaunchIdle = currentFlightState.currentStageIndex === 0 && currentFlightState.activeComponentIds.length === 0;

    if (modeRef.current !== 'flight' || currentFlightState.isCrashed || countdownRef.current !== null || isPreLaunchIdle) {
      requestRef.current = requestAnimationFrame(updatePhysics);
      return;
    }

    const dt = TIME_STEP * timeWarpRef.current;

    setFlightState(prev => {
      const newState = { ...prev };
      
      // Calculate total height and CoM
      let totalHeight = 0;
      const activeComponents = design.components.filter(c => !newState.detachedComponentIds.includes(c.instanceId));
      const segmentByComponent = getSegmentAssignments(newState.detachedComponentIds);
      let liquidFuelBySegment = [...(newState.liquidFuelBySegment || [])];

      if (liquidFuelBySegment.length === 0) {
        liquidFuelBySegment = getLiquidFuelBySegment(newState.detachedComponentIds);
      }
      
      activeComponents.forEach(c => {
        if (ATTACHMENT_TYPES.includes(c.type)) return;
        const scale = c.customScale || 1;
        if (c.type === 'nosecone') totalHeight += c.visualScale[1] * scale;
        else if (c.type === 'capsule') totalHeight += 1 * scale;
        else if (c.type === 'fuel_tank' || c.type === 'payload_bay') totalHeight += c.visualScale[1] * scale;
        else if (c.type === 'coupler') totalHeight += 0.3 * scale;
        else if (c.type === 'engine') totalHeight += c.visualScale[1] * scale;
        else totalHeight += 0.5 * scale;
      });

      let totalMass = 0;
      let weightedY = 0;
      const liquidFuelCapacityBySegment: number[] = [];
      activeComponents.forEach(c => {
        if (c.type === 'srb' || !c.fuelCapacity) return;
        const segment = segmentByComponent[c.instanceId] || 0;
        liquidFuelCapacityBySegment[segment] = (liquidFuelCapacityBySegment[segment] || 0) + getFuelMassForComponent(c);
      });

      liquidFuelBySegment = liquidFuelBySegment.map((fuel, idx) => {
        if ((liquidFuelCapacityBySegment[idx] || 0) <= 0) return 0;
        return fuel;
      });

      const totalLiquidFuelCapacity = liquidFuelCapacityBySegment.reduce((sum, fuel) => sum + (fuel || 0), 0);
      let totalSrbFuelCapacity = activeComponents.reduce((sum, c) => {
        if (c.type !== 'srb') return sum;
        return sum + getFuelMassForComponent(c);
      }, 0);
      
      let currentY = totalHeight;
      let lastMainY = totalHeight;
      activeComponents.forEach((comp) => {
        const scale = comp.customScale || 1;
        const boosterCount = comp.boosterCount || 1;
        let height = 0.5 * scale;
        if (comp.type === 'nosecone') height = comp.visualScale[1] * scale;
        else if (comp.type === 'capsule') height = 1 * scale;
        else if (comp.type === 'fuel_tank' || comp.type === 'payload_bay') height = comp.visualScale[1] * scale;
        else if (comp.type === 'coupler') height = 0.3 * scale;
        else if (comp.type === 'engine') height = comp.visualScale[1] * scale;
        
        const dryMass = comp.mass * scale * boosterCount;
        let fuelInComp = 0;
        if (comp.type === 'srb') {
          if (comp.fuelCapacity && totalSrbFuelCapacity > 0) {
            fuelInComp = (newState.srbFuel / totalSrbFuelCapacity) * getFuelMassForComponent(comp);
          }
        } else {
          const segment = segmentByComponent[comp.instanceId] || 0;
          const segmentFuel = liquidFuelBySegment[segment] || 0;
          const segmentCapacity = liquidFuelCapacityBySegment[segment] || 0;
          if (comp.fuelCapacity && segmentCapacity > 0) {
            fuelInComp = (segmentFuel / segmentCapacity) * getFuelMassForComponent(comp);
          }
        }
        
        const compMass = dryMass + fuelInComp;
        let compY = currentY - height / 2;
        
        if (ATTACHMENT_TYPES.includes(comp.type)) {
          compY = lastMainY;
        } else {
          lastMainY = currentY - height / 2;
          currentY -= height;
        }
        
        weightedY += compMass * compY;
        totalMass += compMass;
      });
      
      const currentMass = totalMass;
      const CoM_Y = weightedY / currentMass;
      newState.centerOfMass = CoM_Y;

      // Moment of Inertia (approximate as cylinder)
      const R = 0.5;
      const H = totalHeight;
      const Ix = (1/12) * currentMass * H**2 + (1/4) * currentMass * R**2;
      const Iz = Ix;
      const Iy = 0.5 * currentMass * R**2;

      // Forces
      let thrustForce = [0, 0, 0];
      let currentThrust = 0;
      let liquidBurnRate = 0;
      let srbBurnRate = 0;
      const liquidBurnBySegment: number[] = [];

      const componentThrusts = activeComponents.map(c => {
        const scale = c.customScale || 1;
        if (c.type === 'engine') {
          const segment = segmentByComponent[c.instanceId] || 0;
          const segmentFuel = liquidFuelBySegment[segment] || 0;
          if (newState.activeComponentIds.includes(c.instanceId) && segmentFuel > 0) {
            const t = (c.thrust || 0) * scale * newState.throttle;
            const burnRate = t / (GRAVITY * (c.isp || 300));
            liquidBurnRate += burnRate;
            liquidBurnBySegment[segment] = (liquidBurnBySegment[segment] || 0) + burnRate;
            return t;
          }
        } else if (c.type === 'srb') {
          if (newState.activeComponentIds.includes(c.instanceId) && newState.srbFuel > 0) {
            const t = (c.thrust || 0) * scale * (c.boosterCount || 1);
            srbBurnRate += t / (GRAVITY * (c.isp || 250));
            return t;
          }
        }
        return 0;
      });

      currentThrust = componentThrusts.reduce((sum, t) => sum + t, 0);

      const maxGimbal = 0.15;
      const isSteering = ['w', 'a', 's', 'd', 'q', 'e'].some(k => keysPressed.current.has(k));

      if (currentThrust > 0) {
        // SAS Logic
        if (newState.isSasActive && !isSteering) {
          const dampingGain = 0.5;
          const orientationGain = 0.2;
          
          // Target: zero angular velocity and vertical orientation (rotation 0 and 2)
          // gimbalAngle[0] controls pitch (rotation[0])
          // gimbalAngle[1] controls yaw (rotation[2])
          
          const pitchCorrection = -newState.angularVelocity[0] * dampingGain - newState.rotation[0] * orientationGain;
          const yawCorrection = -newState.angularVelocity[2] * dampingGain - newState.rotation[2] * orientationGain;
          
          newState.gimbalAngle[0] = Math.max(-maxGimbal, Math.min(maxGimbal, pitchCorrection));
          newState.gimbalAngle[1] = Math.max(-maxGimbal, Math.min(maxGimbal, yawCorrection));
        }

        // Thrust direction in local space (with gimbal)
        const thrustDirLocal = new THREE.Vector3(0, 1, 0);
        thrustDirLocal.applyAxisAngle(new THREE.Vector3(1, 0, 0), newState.gimbalAngle[0]);
        thrustDirLocal.applyAxisAngle(new THREE.Vector3(0, 0, 1), newState.gimbalAngle[1]);
        
        // Torque in local space: T = r x F
        // r is vector from CoM to engine nozzle (at y=0)
        const r_local = new THREE.Vector3(0, -CoM_Y, 0);
        const F_local = thrustDirLocal.clone().multiplyScalar(currentThrust);
        const torque_local = new THREE.Vector3().crossVectors(r_local, F_local);
        
        // Angular Acceleration in local space
        const angularAccelLocal = [
          torque_local.x / Ix,
          torque_local.y / Iy,
          torque_local.z / Iz
        ];
        
        // Update Angular Velocity
        newState.angularVelocity[0] += angularAccelLocal[0] * dt;
        newState.angularVelocity[1] += angularAccelLocal[1] * dt;
        newState.angularVelocity[2] += angularAccelLocal[2] * dt;

        // Thrust direction in world space
        const thrustDirWorld = thrustDirLocal.clone().applyEuler(new THREE.Euler(...newState.rotation));
        thrustForce = [
          thrustDirWorld.x * currentThrust,
          thrustDirWorld.y * currentThrust,
          thrustDirWorld.z * currentThrust
        ];
        
        // Burn fuel
        newState.fuelFlowRate = liquidBurnRate + srbBurnRate;
        liquidBurnBySegment.forEach((burnRate, segment) => {
          if (!burnRate) return;
          liquidFuelBySegment[segment] = Math.max(0, (liquidFuelBySegment[segment] || 0) - burnRate * dt);
        });
        newState.liquidFuelBySegment = liquidFuelBySegment;
        newState.maxLiquidFuelBySegment = liquidFuelCapacityBySegment;
        newState.liquidFuel = liquidFuelBySegment.reduce((sum, fuel, idx) => {
          if ((liquidFuelCapacityBySegment[idx] || 0) <= 0) return sum;
          return sum + fuel;
        }, 0);
        newState.maxLiquidFuel = totalLiquidFuelCapacity;
        newState.srbFuel = Math.max(0, newState.srbFuel - srbBurnRate * dt);
        
        // Engine Temperature: Increases when active
        const targetTemp = 800 + (currentThrust / 10000); // Scale temp
        newState.engineTemperature += (targetTemp - newState.engineTemperature) * 0.05 * dt;
      } else {
        newState.fuelFlowRate = 0;
        // Engine Temperature: Cools down when inactive
        newState.engineTemperature += (20 - newState.engineTemperature) * 0.01 * dt;
      }

      // Damping for angular velocity
      newState.angularVelocity[0] *= 0.98;
      newState.angularVelocity[1] *= 0.98;
      newState.angularVelocity[2] *= 0.98;

      // Update Rotation
      newState.rotation[0] += newState.angularVelocity[0] * dt;
      newState.rotation[1] += newState.angularVelocity[1] * dt;
      newState.rotation[2] += newState.angularVelocity[2] * dt;

      // Gravity
      const gravityForce = [0, -GRAVITY * currentMass, 0];

      // Drag
      const speed = Math.sqrt(newState.velocity[0]**2 + newState.velocity[1]**2 + newState.velocity[2]**2);
      const dragCoeff = design.components.reduce((sum, c) => sum + c.dragCoefficient, 0) + (newState.isParachuteDeployed ? 5.0 : 0);
      const dragMag = 0.5 * AIR_DENSITY * speed**2 * dragCoeff * 1.0; // Area approx 1.0
      const dragForce = speed > 0 ? [
        -newState.velocity[0] / speed * dragMag,
        -newState.velocity[1] / speed * dragMag,
        -newState.velocity[2] / speed * dragMag
      ] : [0, 0, 0];

      // Net Force
      const netForce = [
        thrustForce[0] + gravityForce[0] + dragForce[0],
        thrustForce[1] + gravityForce[1] + dragForce[1],
        thrustForce[2] + gravityForce[2] + dragForce[2]
      ];

      // Acceleration
      const accel = [
        netForce[0] / currentMass,
        netForce[1] / currentMass,
        netForce[2] / currentMass
      ];

      // Structural Stress: Based on acceleration (G-force) and drag
      const gForce = Math.sqrt(accel[0]**2 + accel[1]**2 + accel[2]**2) / GRAVITY;
      const dragStress = dragMag / 10000; // Simplified drag stress
      newState.structuralStress = Math.min(100, (gForce * 5) + dragStress);

      // Mission Logic
      if (activeMissionId) {
        const mission = MISSIONS.find(m => m.id === activeMissionId);
        if (mission && newState.missionStatus === 'active') {
          if (mission.type === 'altitude') {
            newState.missionProgress = Math.min(100, (newState.maxAltitude / mission.targetAltitude!) * 100);
            if (newState.maxAltitude >= mission.targetAltitude!) {
              newState.missionStatus = 'success';
            }
          } else if (mission.type === 'payload') {
            const distToTarget = Math.abs(newState.altitude - mission.targetAltitude!);
            if (distToTarget < 50) {
              const speed = Math.sqrt(newState.velocity[0]**2 + newState.velocity[1]**2 + newState.velocity[2]**2);
              if (speed < mission.targetVelocity!) {
                newState.missionStatus = 'success';
                newState.missionProgress = 100;
              } else {
                newState.missionProgress = 90; // Close but too fast
              }
            } else {
              newState.missionProgress = Math.min(90, (newState.maxAltitude / mission.targetAltitude!) * 90);
            }
          } else if (mission.type === 'landing') {
            if (newState.maxAltitude >= mission.targetAltitude!) {
              if (newState.isLanded && !newState.isCrashed) {
                const impactSpeed = Math.abs(newState.velocity[1]);
                // Note: velocity is already 0 if landed, but we checked impactSpeed in the ground collision logic
                // We can check if it landed successfully
                newState.missionStatus = 'success';
                newState.missionProgress = 100;
              } else {
                newState.missionProgress = 50 + Math.min(40, (1 - newState.altitude / newState.maxAltitude) * 40);
              }
            } else {
              newState.missionProgress = Math.min(50, (newState.maxAltitude / mission.targetAltitude!) * 50);
            }
          }

          if (newState.isCrashed) {
            newState.missionStatus = 'failed';
          }
        }
      }

      // Update Velocity
      newState.velocity = [
        newState.velocity[0] + accel[0] * dt,
        newState.velocity[1] + accel[1] * dt,
        newState.velocity[2] + accel[2] * dt
      ];

      // Update Position
      newState.position = [
        newState.position[0] + newState.velocity[0] * dt,
        newState.position[1] + newState.velocity[1] * dt,
        newState.position[2] + newState.velocity[2] * dt
      ];

      newState.altitude = newState.position[1];
      newState.maxAltitude = Math.max(newState.maxAltitude, newState.altitude);
      newState.time += dt;

      // Update Trail
      const lastPoint = newState.trail[newState.trail.length - 1];
      const currentPos = newState.position;
      if (!lastPoint || 
          Math.sqrt(
            Math.pow(currentPos[0] - lastPoint[0], 2) + 
            Math.pow(currentPos[1] - lastPoint[1], 2) + 
            Math.pow(currentPos[2] - lastPoint[2], 2)
          ) > 1.0) {
        newState.trail = [...newState.trail, [...currentPos]];
        if (newState.trail.length > 1000) {
          newState.trail.shift();
        }
      }

      // Ground/Pad Collision
      const padRadius = 10;
      const onPad = Math.sqrt(newState.position[0]**2 + newState.position[2]**2) < padRadius;
      const groundY = onPad ? 1 : 0;

      if (newState.position[1] <= groundY) {
        newState.position[1] = groundY;
        const impactSpeed = Math.abs(newState.velocity[1]);
        if (impactSpeed > 10) {
          newState.isCrashed = true;
        } else if (newState.time > 1) {
          newState.isLanded = true;
          newState.velocity = [0, 0, 0];
        }
      } else {
        newState.isLanded = false;
      }

      return newState;
    });

    requestRef.current = requestAnimationFrame(updatePhysics);
  };

  useEffect(() => {
    if (mode === 'flight') {
      requestRef.current = requestAnimationFrame(updatePhysics);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [mode]);

  // Visual Update Loop
  useEffect(() => {
    let animId: number;
    const renderLoop = () => {
      if (!sceneRef.current) return;
      const { scene, camera, renderer, rocket, stars, ground, controls, trailLine, comMarker, explosion, launchPad, exhaustParticles, srbExhaustParticles } = sceneRef.current;
      const fs = flightStateRef.current;
      const m = modeRef.current;
      const cv = cameraViewRef.current;
      const tw = timeWarpRef.current;
      const cd = countdownRef.current;
      const co = cameraOffsetRef.current;
      const cz = cameraZoomRef.current;

      // Update camera offsets based on keys
      if (m === 'flight') {
        const panSpeed = 0.2;
        const zoomSpeed = 0.02;
        if (keysPressed.current.has('arrowup')) setCameraOffset(prev => ({ ...prev, y: prev.y + panSpeed }));
        if (keysPressed.current.has('arrowdown')) setCameraOffset(prev => ({ ...prev, y: prev.y - panSpeed }));
        if (keysPressed.current.has('arrowleft')) setCameraOffset(prev => ({ ...prev, x: prev.x - panSpeed }));
        if (keysPressed.current.has('arrowright')) setCameraOffset(prev => ({ ...prev, x: prev.x + panSpeed }));
        if (keysPressed.current.has('+') || keysPressed.current.has('=')) setCameraZoom(prev => Math.max(0.1, prev - zoomSpeed));
        if (keysPressed.current.has('-') || keysPressed.current.has('_')) setCameraZoom(prev => Math.min(10, prev + zoomSpeed));
      }

      // Update sky, stars, and launch pad
      if (m === 'build') {
        scene.background = null;
        if (stars) (stars.material as THREE.PointsMaterial).opacity = 0;
        if (ground) ground.visible = false;
        if (launchPad) launchPad.visible = false;
      } else {
        const alt = fs.altitude;
        const altFactor = Math.min(alt / 50000, 1);
        
        // Sky color
        const skyColor = new THREE.Color().lerpColors(
          new THREE.Color(0x87ceeb), 
          new THREE.Color(0x000005), 
          altFactor
        );
        scene.background = skyColor;
        
        // Stars visibility
        if (stars) {
          const starOpacity = alt < 10000 ? 0 : Math.min(1, (alt - 10000) / 20000);
          (stars.material as THREE.PointsMaterial).opacity = starOpacity;
          stars.visible = starOpacity > 0;
        }
        
        // Ground and Pad visibility
        if (ground) ground.visible = true;
        if (launchPad) launchPad.visible = true;
      }

      // Update trail
      if (trailLine) {
        if (m === 'flight' && fs.trail.length > 1) {
          trailLine.visible = true;
          const positions = new Float32Array(fs.trail.length * 3);
          for (let i = 0; i < fs.trail.length; i++) {
            positions[i * 3] = fs.trail[i][0];
            positions[i * 3 + 1] = fs.trail[i][1];
            positions[i * 3 + 2] = fs.trail[i][2];
          }
          trailLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          trailLine.geometry.attributes.position.needsUpdate = true;

          // Dynamic Trail Color
          const alt = fs.altitude;
          const altFactor = Math.min(alt / 50000, 1);
          const trailColor = new THREE.Color().lerpColors(
            new THREE.Color(0xffaa00), // Orange/Yellow
            new THREE.Color(0x00aaff), // Blue
            altFactor
          );
          (trailLine.material as THREE.LineBasicMaterial).color = trailColor;
          (trailLine.material as THREE.LineBasicMaterial).opacity = 0.6 * (1 - altFactor * 0.5);
        } else {
          trailLine.visible = false;
        }
      }

      // Update controls
      if (m === 'build') {
        controls.enabled = true;
        controls.update();
      } else {
        controls.enabled = false;
      }

      // Update rocket transform - only in flight mode
      if (m === 'flight') {
        rocket.position.set(fs.position[0], fs.position[1], fs.position[2]);
        rocket.rotation.set(fs.rotation[0], fs.rotation[1], fs.rotation[2]);

        // Update nozzle rotation for gimbal visualization
        rocket.traverse((child) => {
          if (child.userData.isNozzle) {
            child.rotation.set(fs.gimbalAngle[0], 0, fs.gimbalAngle[1]);
          }
        });

        // Update CoM marker
        if (comMarker) {
          comMarker.visible = true;
          // CoM is in local space, relative to rocket base (which is at 0,0,0 in the rocket group)
          const comLocal = new THREE.Vector3(0, fs.centerOfMass, 0);
          const comWorld = comLocal.applyMatrix4(rocket.matrixWorld);
          comMarker.position.copy(comWorld);
        }
      } else {
        if (comMarker) comMarker.visible = false;
      }

      // Update Exhaust Particles
      if (exhaustParticles) {
        const { points, velocities, lifetimes } = exhaustParticles;
        const positions = points.geometry.attributes.position.array as Float32Array;
        const mat = points.material as THREE.PointsMaterial;

        const altitude = Math.max(0, fs.altitude);
        const atmosphereFactor = THREE.MathUtils.clamp(1 - altitude / 35000, 0, 1);
        const vacuumFactor = 1 - atmosphereFactor;

        if (m === 'flight' && fs.isEngineActive && fs.throttle > 0 && !fs.isCrashed && !fs.isLanded && cd === null) {
          // Find all active engine nozzles
          const engineNozzles: THREE.Object3D[] = [];
          rocket.traverse((child) => {
            if (child.userData.isNozzle && fs.activeComponentIds.includes(child.userData.instanceId)) {
              engineNozzles.push(child);
            }
          });
          
          if (engineNozzles.length > 0) {
            points.visible = true;
            
            // Emit new particles for each active nozzle
            engineNozzles.forEach(nozzle => {
              const emitCount = Math.max(1, Math.floor((6 + 8 * atmosphereFactor) * fs.throttle));
              const spread = THREE.MathUtils.lerp(0.35, 2.5, vacuumFactor);
              for (let i = 0; i < emitCount; i++) {
                let idx = -1;
                for (let j = 0; j < lifetimes.length; j++) {
                  if (lifetimes[j] <= 0) {
                    idx = j;
                    break;
                  }
                }
                
                if (idx !== -1) {
                  lifetimes[idx] = THREE.MathUtils.lerp(1.25, 0.75, vacuumFactor);
                  const worldNozzlePos = new THREE.Vector3().setFromMatrixPosition(nozzle.matrixWorld);
                  positions[idx * 3] = worldNozzlePos.x;
                  positions[idx * 3 + 1] = worldNozzlePos.y;
                  positions[idx * 3 + 2] = worldNozzlePos.z;

                  const exhaustDir = new THREE.Vector3(0, -1, 0).applyEuler(new THREE.Euler(fs.rotation[0], fs.rotation[1], fs.rotation[2]));
                  const speed = 12 + Math.random() * 16;
                  velocities[idx * 3] = exhaustDir.x * speed + (Math.random() - 0.5) * spread;
                  velocities[idx * 3 + 1] = exhaustDir.y * speed + (Math.random() - 0.5) * spread;
                  velocities[idx * 3 + 2] = exhaustDir.z * speed + (Math.random() - 0.5) * spread;
                }
              }
            });
          }

          // Dense, warm plume in thicker air, wider and cooler tone in thinner air.
          const exhaustColor = new THREE.Color().lerpColors(
            new THREE.Color(0xffc27a),
            new THREE.Color(0x9fc8ff),
            vacuumFactor
          );
          mat.color = exhaustColor;
          mat.size = THREE.MathUtils.lerp(0.8, 1.9, vacuumFactor);
          mat.opacity = THREE.MathUtils.lerp(0.95, 0.55, vacuumFactor) * (0.35 + 0.65 * fs.throttle);
        } else {
          // Fade out existing particles if engine off
          let hasActive = false;
          for (let i = 0; i < lifetimes.length; i++) {
            if (lifetimes[i] > 0) hasActive = true;
          }
          if (!hasActive) points.visible = false;
        }

        // Update all active particles
        for (let i = 0; i < lifetimes.length; i++) {
          if (lifetimes[i] > 0) {
            positions[i * 3] += velocities[i * 3] * 0.016;
            positions[i * 3 + 1] += velocities[i * 3 + 1] * 0.016;
            positions[i * 3 + 2] += velocities[i * 3 + 2] * 0.016;
            lifetimes[i] -= THREE.MathUtils.lerp(0.018, 0.032, vacuumFactor); // Age particle
          } else {
            // Move dead particles far away
            positions[i * 3] = 0;
            positions[i * 3 + 1] = -1000;
            positions[i * 3 + 2] = 0;
          }
        }
        points.geometry.attributes.position.needsUpdate = true;
      }

      // Update SRB Exhaust Particles
      if (srbExhaustParticles) {
        const { points, velocities, lifetimes } = srbExhaustParticles;
        const positions = points.geometry.attributes.position.array as Float32Array;
        const mat = points.material as THREE.PointsMaterial;
        const altitude = Math.max(0, fs.altitude);
        const atmosphereFactor = THREE.MathUtils.clamp(1 - altitude / 35000, 0, 1);
        const vacuumFactor = 1 - atmosphereFactor;

        if (m === 'flight' && fs.isSrbIgnited && fs.srbFuel > 0 && !fs.isCrashed && !fs.isLanded && cd === null) {
          points.visible = true;
          
          // Find all active SRB nozzles
          const srbNozzles: THREE.Object3D[] = [];
          rocket.traverse((child) => {
            if (child.userData.isSrbNozzle && fs.activeComponentIds.includes(child.userData.instanceId)) {
              srbNozzles.push(child);
            }
          });

          // Emit new particles for each nozzle
          srbNozzles.forEach(nozzle => {
            const emitCount = Math.max(2, Math.floor(5 + 5 * atmosphereFactor));
            const spread = THREE.MathUtils.lerp(0.5, 3.0, vacuumFactor);
            for (let i = 0; i < emitCount; i++) {
              let idx = -1;
              for (let j = 0; j < lifetimes.length; j++) {
                if (lifetimes[j] <= 0) {
                  idx = j;
                  break;
                }
              }
              
              if (idx !== -1) {
                lifetimes[idx] = THREE.MathUtils.lerp(1.1, 0.55, vacuumFactor);
                const worldNozzlePos = new THREE.Vector3().setFromMatrixPosition(nozzle.matrixWorld);
                positions[idx * 3] = worldNozzlePos.x;
                positions[idx * 3 + 1] = worldNozzlePos.y;
                positions[idx * 3 + 2] = worldNozzlePos.z;

                const exhaustDir = new THREE.Vector3(0, -1, 0).applyEuler(new THREE.Euler(fs.rotation[0], fs.rotation[1], fs.rotation[2]));
                const speed = 9 + Math.random() * 10;
                velocities[idx * 3] = exhaustDir.x * speed + (Math.random() - 0.5) * spread;
                velocities[idx * 3 + 1] = exhaustDir.y * speed + (Math.random() - 0.5) * spread;
                velocities[idx * 3 + 2] = exhaustDir.z * speed + (Math.random() - 0.5) * spread;
              }
            }
          });

          mat.color = new THREE.Color().lerpColors(
            new THREE.Color(0xffe0bf),
            new THREE.Color(0xb2d4ff),
            vacuumFactor
          );
          mat.size = THREE.MathUtils.lerp(0.65, 1.6, vacuumFactor);
          mat.opacity = THREE.MathUtils.lerp(0.85, 0.5, vacuumFactor);
        } else {
          let hasActive = false;
          for (let i = 0; i < lifetimes.length; i++) {
            if (lifetimes[i] > 0) hasActive = true;
          }
          if (!hasActive) points.visible = false;
        }

        // Update all active SRB particles
        for (let i = 0; i < lifetimes.length; i++) {
          if (lifetimes[i] > 0) {
            positions[i * 3] += velocities[i * 3] * 0.016;
            positions[i * 3 + 1] += velocities[i * 3 + 1] * 0.016;
            positions[i * 3 + 2] += velocities[i * 3 + 2] * 0.016;
            lifetimes[i] -= THREE.MathUtils.lerp(0.024, 0.04, vacuumFactor);
          } else {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = -1000;
            positions[i * 3 + 2] = 0;
          }
        }
        points.geometry.attributes.position.needsUpdate = true;
      }

      // Update Explosion
      if (explosion) {
        if (fs.isCrashed) {
          if (explosion.startTime === 0) {
            explosion.startTime = Date.now();
            explosion.points.position.set(fs.position[0], fs.position[1], fs.position[2]);
            explosion.points.material.opacity = 1;
            rocket.visible = false; // Hide rocket on crash
          }
          
          const elapsed = (Date.now() - explosion.startTime) / 1000;
          const positions = explosion.points.geometry.attributes.position.array as Float32Array;
          
          for (let i = 0; i < positions.length / 3; i++) {
            positions[i * 3] += explosion.velocities[i * 3] * 0.016 * tw;
            positions[i * 3 + 1] += explosion.velocities[i * 3 + 1] * 0.016 * tw;
            positions[i * 3 + 2] += explosion.velocities[i * 3 + 2] * 0.016 * tw;
            
            // Gravity on particles
            explosion.velocities[i * 3 + 1] -= 9.8 * 0.016 * tw;
            
            // Ground collision for particles
            if (positions[i * 3 + 1] < -fs.position[1]) {
              positions[i * 3 + 1] = -fs.position[1];
              explosion.velocities[i * 3] *= 0.8;
              explosion.velocities[i * 3 + 1] *= -0.3;
              explosion.velocities[i * 3 + 2] *= 0.8;
            }
          }
          explosion.points.geometry.attributes.position.needsUpdate = true;
          explosion.points.material.opacity = Math.max(0, 1 - elapsed / 5);
        } else {
          explosion.points.material.opacity = 0;
          explosion.startTime = 0;
          rocket.visible = true;
        }
      }

      // Camera logic
      if (m === 'build') {
        // OrbitControls handles camera in build mode
      } else {
        if (cv === 'follow') {
          const baseOffset = new THREE.Vector3(0, 3, 10).multiplyScalar(cz);
          const offset = baseOffset.applyEuler(new THREE.Euler(0, fs.rotation[1], 0));
          camera.position.lerp(new THREE.Vector3(
            fs.position[0] + offset.x + co.x,
            fs.position[1] + offset.y + co.y,
            fs.position[2] + offset.z + co.z
          ), 0.1);
          camera.lookAt(fs.position[0], fs.position[1], fs.position[2]);
        } else if (cv === 'ground') {
          camera.position.set(20 * cz + co.x, 2 + co.y, 20 * cz + co.z);
          camera.lookAt(fs.position[0], fs.position[1], fs.position[2]);
        } else if (cv === 'top') {
          camera.position.set(fs.position[0] + co.x, fs.position[1] + 50 * cz + co.y, fs.position[2] + co.z);
          camera.lookAt(fs.position[0], fs.position[1], fs.position[2]);
        } else if (cv === 'passenger') {
          const localPos = new THREE.Vector3(co.x, capsuleOffset + co.y, 0.4 + co.z);
          const worldPos = localPos.applyMatrix4(rocket.matrixWorld);
          camera.position.copy(worldPos);
          
          const lookAtLocal = new THREE.Vector3(0, capsuleOffset + 2, 5);
          const lookAtWorld = lookAtLocal.applyMatrix4(rocket.matrixWorld);
          camera.lookAt(lookAtWorld);
          camera.fov = 75 * cz;
          camera.updateProjectionMatrix();
        }
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(renderLoop);
    };
    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase());
      if (mode !== 'flight' || flightState.isCrashed) return;

      const gimbalStep = 0.02;
      const maxGimbal = 0.15; // ~8.5 degrees
      
      setFlightState(prev => {
        const newState = { ...prev, gimbalAngle: [...prev.gimbalAngle] };
        
        // Camera switching
        if (e.key === '1') setCameraView('follow');
        if (e.key === '2') setCameraView('ground');
        if (e.key === '3') setCameraView('top');
        if (e.key === '4') setCameraView('passenger');

        // SAS toggle
        if (e.key.toLowerCase() === 't') newState.isSasActive = !newState.isSasActive;

        // Gimbal control (Pitch/Yaw)
        if (e.key === 'w') newState.gimbalAngle[0] = Math.max(-maxGimbal, newState.gimbalAngle[0] - gimbalStep);
        if (e.key === 's') newState.gimbalAngle[0] = Math.min(maxGimbal, newState.gimbalAngle[0] + gimbalStep);
        if (e.key === 'a') newState.gimbalAngle[1] = Math.max(-maxGimbal, newState.gimbalAngle[1] - gimbalStep);
        if (e.key === 'd') newState.gimbalAngle[1] = Math.min(maxGimbal, newState.gimbalAngle[1] + gimbalStep);
        
        // Reset gimbal
        if (e.key === 'x') newState.gimbalAngle = [0, 0];

        // Roll control (still direct for now, or could be RCS)
        const rollSpeed = 0.02;
        const newRotation = [...prev.rotation] as [number, number, number];
        if (e.key === 'q') newRotation[1] += rollSpeed;
        if (e.key === 'e') newRotation[1] -= rollSpeed;
        newState.rotation = newRotation;
        
        if (e.code === 'Space') {
          newState.isEngineActive = !newState.isEngineActive;
          if (newState.isEngineActive) newState.isSrbIgnited = true;
        }
        
        // Throttle control
        const throttleStep = 0.05;
        if (e.key === 'Shift') {
          newState.throttle = Math.min(1, newState.throttle + throttleStep);
        }
        if (e.key === 'Control') {
          newState.throttle = Math.max(0, newState.throttle - throttleStep);
        }
        // Full/Zero throttle shortcuts
        if (e.key === 'z') newState.throttle = 1;
        if (e.key === 'x') newState.throttle = 0;

        if (e.key === 'p') {
          newState.isParachuteDeployed = !newState.isParachuteDeployed;
        }

        if (e.key === 'Enter') {
          activateNextStage();
        }

        // Camera views (1-4)
        if (e.key === '1') setCameraView('follow');
        if (e.key === '2') setCameraView('ground');
        if (e.key === '3') setCameraView('top');
        if (e.key === '4') setCameraView('passenger');

        // Time warp keys (now using [ and ] or similar, or just remove the old 1-4)
        if (e.key === '[') setTimeWarp(Math.max(1, timeWarp / 2));
        if (e.key === ']') setTimeWarp(Math.min(8, timeWarp * 2));

        return newState;
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mode, flightState.isCrashed]);

  const resetBuild = () => {
    setMode('build');
    setFlightState(INITIAL_FLIGHT_STATE);
    setFlightComponentPopups([]);
    setCountdown(null);
    setTimeWarp(1);
    setCameraView('follow');
    setCameraOffset({ x: 0, y: 0, z: 0 });
    setCameraZoom(1);
  };

  const playCountdownSound = (count: number) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (count === 0) {
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      } else {
        osc.frequency.value = 440;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      }
      
      osc.start();
      osc.stop(ctx.currentTime + 1);
    } catch (e) {
      console.warn("Audio context failed", e);
    }
  };

  const playLaunchRumble = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 150;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.8, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 4);

      whiteNoise.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start();
      whiteNoise.stop(ctx.currentTime + 4);
    } catch (e) {
      console.warn("Audio context failed", e);
    }
  };

  const syncFlightStages = (stages: RocketDesign['stages']) => {
    setFlightState(prev => ({
      ...prev,
      stages,
      currentStageIndex: Math.min(prev.currentStageIndex, stages.length),
    }));
  };

  const addStage = () => {
    setDesign(prev => {
      const stages = [
        ...(prev.stages || []),
        { id: `stage-${Date.now()}`, componentInstanceIds: [] }
      ];
      syncFlightStages(stages);
      return { ...prev, stages };
    });
  };

  const removeStage = (stageId: string) => {
    setDesign(prev => {
      const stages = (prev.stages || []).filter(s => s.id !== stageId);
      syncFlightStages(stages);
      return { ...prev, stages };
    });
  };

  const reorderStage = (index: number, direction: 'up' | 'down') => {
    setDesign(prev => {
      const stages = [...(prev.stages || [])];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= stages.length) return prev;
      [stages[index], stages[newIndex]] = [stages[newIndex], stages[index]];
      syncFlightStages(stages);
      return { ...prev, stages };
    });
  };

  const addComponentToStage = (stageId: string, componentInstanceId: string) => {
    setDesign(prev => {
      const stages = (prev.stages || []).map(s => {
        if (s.id === stageId) {
          if (s.componentInstanceIds.includes(componentInstanceId)) return s;
          return { ...s, componentInstanceIds: [...s.componentInstanceIds, componentInstanceId] };
        }
        return s;
      });
      syncFlightStages(stages);
      return { ...prev, stages };
    });
  };

  const removeComponentFromStage = (stageId: string, componentInstanceId: string) => {
    setDesign(prev => {
      const stages = (prev.stages || []).map(s => {
        if (s.id === stageId) {
          return { ...s, componentInstanceIds: s.componentInstanceIds.filter(id => id !== componentInstanceId) };
        }
        return s;
      });
      syncFlightStages(stages);
      return { ...prev, stages };
    });
  };

  const activateNextStage = () => {
    setFlightState(prev => {
      if (prev.currentStageIndex >= (prev.stages?.length || 0)) return prev;
      
      const nextStageIndex = prev.currentStageIndex;
      const stage = prev.stages?.[nextStageIndex];
      if (!stage) return prev;

      const newActiveIds = [...prev.activeComponentIds];
      const newDetachedIds = [...prev.detachedComponentIds];

      stage.componentInstanceIds.forEach(id => {
        const comp = design.components.find(c => c.instanceId === id);
        if (!comp) return;

        if (comp.type === 'coupler') {
          // Detach everything below this coupler
          const couplerIdx = design.components.findIndex(c => c.instanceId === id);
          design.components.forEach((c, idx) => {
            if (idx >= couplerIdx && !newDetachedIds.includes(c.instanceId)) {
              newDetachedIds.push(c.instanceId);
            }
          });
        } else if (comp.type === 'parachute') {
          // Handled in physics/visuals via isParachuteDeployed
          // But we can mark it as "active" to show in UI
          if (!newActiveIds.includes(id)) newActiveIds.push(id);
        } else {
          // Engine or SRB
          if (!newActiveIds.includes(id)) newActiveIds.push(id);
        }
      });

      return {
        ...prev,
        currentStageIndex: nextStageIndex + 1,
        activeComponentIds: newActiveIds,
        detachedComponentIds: newDetachedIds,
        isEngineActive: true, // Ensure engines are on if we just staged them
        isSrbIgnited: true,
        isParachuteDeployed: stage.componentInstanceIds.some(id => {
          const comp = design.components.find(c => c.instanceId === id);
          return comp?.type === 'parachute';
        }) || prev.isParachuteDeployed
      };
    });
  };

  const executeLaunch = () => {
    // Initialize with first stage if available
    const firstStage = design.stages?.[0];
    const initialActiveIds = firstStage ? firstStage.componentInstanceIds : [];
    
    setFlightState(prev => ({
      ...prev,
      isEngineActive: true,
      throttle: 1,
      currentStageIndex: firstStage ? 1 : 0,
      activeComponentIds: initialActiveIds,
    }));
    playLaunchRumble();
  };

  const triggerComponentAction = (comp: RocketComponent, action: 'start' | 'stop' | 'deploy' | 'stow') => {
    setFlightState(prev => {
      const activeComponentIds = [...prev.activeComponentIds];
      const isPropulsionComponent = comp.type === 'engine' || comp.type === 'srb';

      if (isPropulsionComponent) {
        if (action === 'start' && !activeComponentIds.includes(comp.instanceId)) {
          activeComponentIds.push(comp.instanceId);
        }
        if (action === 'stop') {
          const idx = activeComponentIds.indexOf(comp.instanceId);
          if (idx !== -1) activeComponentIds.splice(idx, 1);
        }
      }

      const hasActivePropulsion = activeComponentIds.some(id => {
        const activeComp = design.components.find(c => c.instanceId === id);
        if (!activeComp) return false;
        if (prev.detachedComponentIds.includes(id)) return false;
        return activeComp.type === 'engine' || activeComp.type === 'srb';
      });

      const hasActiveSrb = activeComponentIds.some(id => {
        const activeComp = design.components.find(c => c.instanceId === id);
        if (!activeComp) return false;
        if (prev.detachedComponentIds.includes(id)) return false;
        return activeComp.type === 'srb';
      });

      let isParachuteDeployed = prev.isParachuteDeployed;
      if (comp.type === 'parachute') {
        if (action === 'deploy') isParachuteDeployed = true;
        if (action === 'stow') isParachuteDeployed = false;
      }

      return {
        ...prev,
        activeComponentIds,
        isEngineActive: hasActivePropulsion,
        isSrbIgnited: prev.isSrbIgnited || hasActiveSrb || (comp.type === 'srb' && action === 'start'),
        isParachuteDeployed,
      };
    });
  };

  const beginLaunchCountdown = () => {
    const isPreLaunchIdle = flightState.currentStageIndex === 0 && flightState.activeComponentIds.length === 0;
    if (mode !== 'flight' || countdown !== null || flightState.isCrashed || !isPreLaunchIdle) return;
    setCountdown(3);
    playCountdownSound(3);
  };

  const startFlight = () => {
    if (hasBlockingLaunchIssue) {
      setActiveNavTab('staging');
      return;
    }

    const liquidFuelBySegment = getLiquidFuelBySegment();
    const liquidFuel = liquidFuelBySegment.reduce((sum, fuel) => sum + fuel, 0);

    const srbFuel = design.components.reduce((sum, c) => {
      if (c.type !== 'srb') return sum;
      return sum + getFuelMassForComponent(c);
    }, 0);
    
    setFlightState({
      ...INITIAL_FLIGHT_STATE,
      liquidFuel,
      liquidFuelBySegment,
      srbFuel,
      maxLiquidFuel: liquidFuel,
      maxLiquidFuelBySegment: [...liquidFuelBySegment],
      maxSrbFuel: srbFuel,
      isLanded: true,
      missionStatus: activeMissionId ? 'active' : 'idle',
      stages: design.stages,
    });
    setMode('flight');
    setFlightComponentPopups([]);
    setCameraOffset({ x: 0, y: 0, z: 0 });
    setCameraZoom(1);
  };

  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
        playCountdownSound(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setCountdown(null);
        executeLaunch();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setDesign((prev) => {
        const oldIndex = prev.components.findIndex((c) => c.instanceId === active.id);
        const newIndex = prev.components.findIndex((c) => c.instanceId === over?.id);
        return {
          components: arrayMove(prev.components, oldIndex, newIndex),
        };
      });
    }
  };

  const addComponent = (template: Omit<RocketComponent, 'instanceId' | 'color' | 'customScale'>) => {
    const newComp: RocketComponent = {
      ...template,
      instanceId: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      color: template.type === 'engine' ? '#333333' : '#ffffff',
      customScale: 1,
    };
    setDesign(prev => ({
      ...prev,
      components: [...prev.components, newComp]
    }));
  };

  const updateComponent = (index: number, updates: Partial<RocketComponent>) => {
    setDesign(prev => {
      const newComps = [...prev.components];
      newComps[index] = { ...newComps[index], ...updates };
      return { ...prev, components: newComps };
    });
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* 3D Canvas Background */}
      <div ref={canvasRef} className="absolute inset-0 z-0" />

      {/* Overlay UI */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        
        {/* Countdown Overlay */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm pointer-events-auto"
            >
              <motion.div 
                key={countdown}
                initial={{ scale: 0.5, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 1.5, opacity: 0, y: -20 }}
                transition={{ type: "spring", damping: 12 }}
                className="flex flex-col items-center"
              >
                <div className="text-[180px] font-black italic tracking-tighter text-orange-500 leading-none drop-shadow-[0_0_50px_rgba(249,115,22,0.4)]">
                  {countdown === 0 ? "IGNITION" : countdown}
                </div>
                <div className="text-xl font-mono text-slate-400 uppercase tracking-[0.5em] mt-4">
                  {countdown === 0 ? "Main Engine Start" : "Pre-Flight Sequence"}
                </div>
                
                {/* Visual progress bar */}
                <div className="w-64 h-1 bg-slate-800 rounded-full mt-12 overflow-hidden">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1, ease: "linear" }}
                    className="h-full bg-orange-500"
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Header */}
        <header className="p-6 flex justify-between items-start pointer-events-auto">
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-black tracking-tighter uppercase italic flex items-center gap-2">
              <Rocket className="w-8 h-8 text-orange-500" />
              AstroForge
            </h1>
            <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">Rocket Flight Simulation v1.0</p>
          </div>

          <div className="flex gap-4">
            {mode === 'build' ? (
              <div className="flex flex-col items-end gap-2 max-w-[26rem]">
                <button 
                  onClick={startFlight}
                  disabled={hasBlockingLaunchIssue}
                  className={cn(
                    "text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all shadow-lg shadow-orange-900/20 group",
                    hasBlockingLaunchIssue
                      ? "bg-orange-900/50 text-orange-200/70 cursor-not-allowed"
                      : "bg-orange-600 hover:bg-orange-500"
                  )}
                >
                  <Play className="w-5 h-5 group-hover:scale-125 transition-transform" />
                  {hasBlockingLaunchIssue ? "FIX ISSUES TO LAUNCH" : "SEND TO LAUNCH PAD"}
                </button>

                {launchValidationIssues.length > 0 && (
                  <div className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 backdrop-blur-sm p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Pre-Launch Checklist</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {launchValidationIssues.filter(issue => issue.severity === 'error').length} ERR / {launchValidationIssues.filter(issue => issue.severity === 'warning').length} WARN
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                      {launchValidationIssues.map(issue => (
                        <div key={issue.id} className="flex items-start gap-2 text-[10px] text-slate-300 leading-relaxed">
                          <span className={cn(
                            "mt-1 inline-block w-1.5 h-1.5 rounded-full",
                            issue.severity === 'error' ? "bg-red-400" : "bg-amber-400"
                          )} />
                          <span>{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                {flightState.currentStageIndex === 0 && flightState.activeComponentIds.length === 0 && !flightState.isCrashed && (
                  <button
                    onClick={beginLaunchCountdown}
                    disabled={countdown !== null}
                    className="bg-orange-600 hover:bg-orange-500 disabled:bg-orange-900/40 disabled:text-orange-300/60 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all"
                  >
                    <Play className="w-5 h-5" />
                    {countdown !== null ? "COUNTDOWN..." : "START"}
                  </button>
                )}
                <button 
                  onClick={resetBuild}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all"
                >
                  <RotateCcw className="w-5 h-5" />
                  ABORT & REDESIGN
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Interface Area */}
        <main className="flex-1 flex justify-between p-6 gap-6 overflow-hidden">
          
          {/* Left Panel: Sidebar + Content */}
          <AnimatePresence mode="wait">
            {mode === 'build' ? (
              <motion.div 
                key="build-panel"
                initial={{ x: -400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -400, opacity: 0 }}
                className="w-[440px] max-w-[50%] min-w-[320px] flex gap-4 pointer-events-auto"
              >
                {/* Left Sidebar Nav */}
                <div className="w-16 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-2xl flex flex-col items-center py-6 gap-6 shadow-2xl">
                  <button 
                    onClick={() => setActiveNavTab('home')}
                    className={cn(
                      "p-3 rounded-xl transition-all relative group",
                      activeNavTab === 'home' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    )}
                  >
                    <Home className="w-5 h-5" />
                    <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 uppercase font-bold tracking-widest">Home View</span>
                  </button>

                  <div className="w-8 h-[1px] bg-slate-800" />

                  <button 
                    onClick={() => setActiveNavTab('components')}
                    className={cn(
                      "p-3 rounded-xl transition-all relative group",
                      activeNavTab === 'components' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    )}
                  >
                    <LayoutGrid className="w-5 h-5" />
                    <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 uppercase font-bold tracking-widest">Components</span>
                  </button>

                  <button 
                    onClick={() => setActiveNavTab('missions')}
                    className={cn(
                      "p-3 rounded-xl transition-all relative group",
                      activeNavTab === 'missions' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    )}
                  >
                    <Target className="w-5 h-5" />
                    <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 uppercase font-bold tracking-widest">Missions</span>
                  </button>

                  <button 
                    onClick={() => setActiveNavTab('staging')}
                    className={cn(
                      "p-3 rounded-xl transition-all relative group",
                      activeNavTab === 'staging' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    )}
                  >
                    <Layout className="w-5 h-5" />
                    <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 uppercase font-bold tracking-widest">Staging</span>
                  </button>

                  <button 
                    onClick={() => setActiveNavTab('ai')}
                    className={cn(
                      "p-3 rounded-xl transition-all relative group",
                      activeNavTab === 'ai' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    )}
                  >
                    <Cpu className="w-5 h-5" />
                    <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 uppercase font-bold tracking-widest">AI Advisor</span>
                  </button>

                  <button 
                    onClick={() => setActiveNavTab('saved')}
                    className={cn(
                      "p-3 rounded-xl transition-all relative group",
                      activeNavTab === 'saved' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    )}
                  >
                    <Folder className="w-5 h-5" />
                    <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 uppercase font-bold tracking-widest">Saved Designs</span>
                  </button>

                  <div className="flex-1" />

                  <button 
                    onClick={() => setActiveNavTab('settings')}
                    className={cn(
                      "p-3 rounded-xl transition-all relative group",
                      activeNavTab === 'settings' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    )}
                  >
                    <Settings className="w-5 h-5" />
                    <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 uppercase font-bold tracking-widest">Settings</span>
                  </button>
                </div>

                {/* Content Area */}
                <AnimatePresence mode="wait">
                  {activeNavTab !== 'home' && (
                    <motion.div 
                      key={activeNavTab}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -20, opacity: 0 }}
                      className="flex-1 flex flex-col gap-4"
                    >
                      {/* Main Content (Library, Missions, AI, Saved, or Settings) */}
                      <div className="flex-1 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/30">
                          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                            {activeNavTab === 'components' ? "Component Library" : 
                             activeNavTab === 'missions' ? "Mission Briefing" : 
                             activeNavTab === 'ai' ? "AI Mission Control" :
                             activeNavTab === 'saved' ? "Saved Designs" :
                             "System Settings"}
                          </h2>
                          {activeNavTab === 'saved' && (
                            <button 
                              onClick={() => {
                                const name = prompt("Enter design name:", `Rocket ${savedDesigns.length + 1}`);
                                if (name) {
                                  setSavedDesigns(prev => [...prev, { id: Date.now().toString(), name, design: JSON.parse(JSON.stringify(design)) }]);
                                }
                              }}
                              className="text-[10px] bg-orange-500 hover:bg-orange-400 text-white px-2 py-1 rounded uppercase font-bold transition-colors"
                            >
                              Save Current
                            </button>
                          )}
                        </div>

                        {activeNavTab === 'components' && (
                          <div className="border-b border-slate-700 bg-slate-800/20">
                            {/* Search Bar */}
                            <div className="p-2 border-b border-slate-700/50">
                              <div className="relative">
                                <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                <input 
                                  type="text"
                                  placeholder="Search components..."
                                  value={componentSearch}
                                  onChange={(e) => setComponentSearch(e.target.value)}
                                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-1.5 pl-9 pr-3 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50 transition-colors"
                                />
                              </div>
                            </div>

                            {/* Filters */}
                            <div className="p-2 flex gap-1 overflow-x-auto no-scrollbar">
                              <button 
                                onClick={() => setComponentFilter('all')}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                                  componentFilter === 'all' ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                                )}
                              >
                                All
                              </button>
                              {(['nosecone', 'capsule', 'payload_bay', 'fuel_tank', 'engine', 'srb', 'coupler', 'fins', 'parachute'] as ComponentType[]).map(type => (
                                <button 
                                  key={type}
                                  onClick={() => setComponentFilter(type)}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5",
                                    componentFilter === type ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                                  )}
                                >
                                  {type === 'nosecone' && <Triangle className="w-3 h-3" />}
                                  {type === 'capsule' && <Box className="w-3 h-3" />}
                                  {type === 'payload_bay' && <Square className="w-3 h-3" />}
                                  {type === 'fuel_tank' && <Droplets className="w-3 h-3" />}
                                  {type === 'engine' && <Zap className="w-3 h-3" />}
                                  {type === 'srb' && <Flame className="w-3 h-3" />}
                                  {type === 'coupler' && <LinkIcon className="w-3 h-3" />}
                                  {type === 'fins' && <Wind className="w-3 h-3" />}
                                  {type === 'parachute' && <ArrowDownCircle className="w-3 h-3" />}
                                  {type.replace('_', ' ')}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                          {activeNavTab === 'components' ? (
                            Object.values(COMPONENT_TEMPLATES)
                              .filter(comp => {
                                const matchesFilter = componentFilter === 'all' || comp.type === componentFilter;
                                const matchesSearch = comp.name.toLowerCase().includes(componentSearch.toLowerCase()) || 
                                                     comp.description.toLowerCase().includes(componentSearch.toLowerCase());
                                return matchesFilter && matchesSearch;
                              })
                              .map(comp => (
                                <div
                                  key={comp.id}
                                  className="w-full p-2 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-orange-500/50 hover:bg-slate-800 transition-all group overflow-hidden"
                                >
                                  <div className="flex items-center gap-3">
                                    {/* Component "Image" (Icon Representation) - Compact */}
                                    <div 
                                      onClick={() => addComponent(comp)}
                                      className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-700 group-hover:border-orange-500/30 transition-colors cursor-pointer relative overflow-hidden shrink-0"
                                    >
                                      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                      {comp.type === 'nosecone' && <Triangle className="w-6 h-6 text-orange-400" />}
                                      {comp.type === 'capsule' && <Box className="w-6 h-6 text-blue-400" />}
                                      {comp.type === 'payload_bay' && <Square className="w-6 h-6 text-slate-400" />}
                                      {comp.type === 'fuel_tank' && <Droplets className="w-6 h-6 text-blue-500" />}
                                      {comp.type === 'engine' && <Zap className="w-6 h-6 text-orange-500" />}
                                      {comp.type === 'srb' && <Flame className="w-6 h-6 text-red-500" />}
                                      {comp.type === 'coupler' && <LinkIcon className="w-6 h-6 text-slate-500" />}
                                      {comp.type === 'fins' && <Wind className="w-6 h-6 text-slate-400" />}
                                      {comp.type === 'parachute' && <ArrowDownCircle className="w-6 h-6 text-green-400" />}
                                      
                                      <div className="absolute bottom-0.5 right-0.5">
                                        <Plus className="w-2.5 h-2.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-start">
                                        <div 
                                          className="cursor-pointer flex-1"
                                          onClick={() => addComponent(comp)}
                                        >
                                          <h3 className="font-bold text-[13px] truncate leading-tight">{comp.name}</h3>
                                          <p className="text-[8px] text-slate-500 uppercase tracking-widest font-black">{comp.type.replace('_', ' ')}</p>
                                        </div>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedLibraryItem(expandedLibraryItem === comp.id ? null : comp.id);
                                          }}
                                          className="p-1 hover:bg-slate-700 rounded-md transition-colors text-slate-500 hover:text-slate-300"
                                        >
                                          {expandedLibraryItem === comp.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                        </button>
                                      </div>

                                      <div className="mt-1 flex gap-2.5 text-[9px] font-mono text-slate-500">
                                        <span className="flex items-center gap-1"><Wind className="w-2.5 h-2.5" /> {comp.mass}kg</span>
                                        {comp.thrust && <span className="flex items-center gap-1 text-orange-400"><Zap className="w-2.5 h-2.5" /> {comp.thrust > 1000 ? (comp.thrust / 1000).toFixed(1) + 'kN' : comp.thrust + 'N'}</span>}
                                      </div>
                                    </div>
                                  </div>

                                  <AnimatePresence>
                                    {expandedLibraryItem === comp.id && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="pt-2 mt-2 border-t border-slate-700/50">
                                          <p className="text-[10px] text-slate-400 leading-relaxed italic">
                                            {comp.description}
                                          </p>
                                          {comp.shape && (
                                            <div className="mt-1.5 flex items-center gap-2">
                                              <span className="text-[8px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-400 uppercase font-bold">Shape: {comp.shape.replace('_', ' ')}</span>
                                            </div>
                                          )}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              ))
                          ) : activeNavTab === 'staging' ? (
                            <div className="space-y-4">
                              <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Staging Sequence</h3>
                                <button 
                                  onClick={addStage}
                                  className="p-1.5 bg-orange-500 hover:bg-orange-400 text-white rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"
                                >
                                  <Plus className="w-3 h-3" /> Add Stage
                                </button>
                              </div>

                              {(design.stages || []).length === 0 ? (
                                <div className="p-8 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                                  <Layout className="w-8 h-8 text-slate-700 mx-auto mb-2 opacity-20" />
                                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">No stages defined</p>
                                  <p className="text-[9px] text-slate-600 mt-1 italic">Add a stage to begin sequencing your launch.</p>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {(design.stages || []).map((stage, sIdx) => (
                                    <div key={stage.id} className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
                                      <div className="p-3 bg-slate-800/60 border-b border-slate-700 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                          <div className="w-5 h-5 bg-orange-500 text-white rounded flex items-center justify-center text-[10px] font-black">
                                            {sIdx + 1}
                                          </div>
                                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Stage {sIdx + 1}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button 
                                            onClick={() => reorderStage(sIdx, 'up')} 
                                            disabled={sIdx === 0}
                                            className="p-1 hover:bg-slate-700 rounded text-slate-500 disabled:opacity-20"
                                          >
                                            <ChevronUp className="w-3 h-3" />
                                          </button>
                                          <button 
                                            onClick={() => reorderStage(sIdx, 'down')} 
                                            disabled={sIdx === (design.stages?.length || 0) - 1}
                                            className="p-1 hover:bg-slate-700 rounded text-slate-500 disabled:opacity-20"
                                          >
                                            <ChevronDown className="w-3 h-3" />
                                          </button>
                                          <button 
                                            onClick={() => removeStage(stage.id)} 
                                            className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded text-slate-500 ml-1"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="p-2 space-y-1">
                                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1 px-1">Triggered Components</p>
                                        <div className="space-y-1">
                                          {stage.componentInstanceIds.map(id => {
                                            const comp = design.components.find(c => c.instanceId === id);
                                            if (!comp) return null;
                                            return (
                                              <div key={id} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg border border-slate-700/50 group">
                                                <div className="flex items-center gap-2">
                                                  {comp.type === 'engine' && <Zap className="w-3 h-3 text-orange-400" />}
                                                  {comp.type === 'srb' && <Flame className="w-3 h-3 text-red-400" />}
                                                  {comp.type === 'coupler' && <LinkIcon className="w-3 h-3 text-slate-400" />}
                                                  {comp.type === 'parachute' && <ArrowDownCircle className="w-3 h-3 text-green-400" />}
                                                  <span className="text-[10px] font-medium truncate max-w-[120px]">{comp.name}</span>
                                                </div>
                                                <button 
                                                  onClick={() => removeComponentFromStage(stage.id, id)}
                                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-400 transition-all"
                                                >
                                                  <X className="w-3 h-3" />
                                                </button>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <div className="pt-2">
                                          <select 
                                            onChange={(e) => {
                                              if (e.target.value) {
                                                addComponentToStage(stage.id, e.target.value);
                                                e.target.value = "";
                                              }
                                            }}
                                            className="w-full bg-blue-950/50 border border-blue-700/50 rounded-lg py-1.5 px-2 text-[10px] text-blue-200 focus:outline-none focus:border-blue-400"
                                          >
                                            <option value="">+ Add Component</option>
                                            {design.components
                                              .filter(c => ['engine', 'srb', 'coupler', 'parachute'].includes(c.type))
                                              .filter(c => !stage.componentInstanceIds.includes(c.instanceId))
                                              .map(c => (
                                                <option key={c.instanceId} value={c.instanceId}>{c.name}</option>
                                              ))
                                            }
                                          </select>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : activeNavTab === 'missions' ? (
                            <div className="space-y-3">
                              {MISSIONS.map(mission => (
                                <button
                                  key={mission.id}
                                  onClick={() => setActiveMissionId(activeMissionId === mission.id ? null : mission.id)}
                                  className={cn(
                                    "w-full text-left p-4 rounded-xl border transition-all group relative overflow-hidden",
                                    activeMissionId === mission.id 
                                      ? "bg-orange-500/10 border-orange-500/50 shadow-lg shadow-orange-500/10" 
                                      : "bg-slate-800/50 border-slate-700 hover:border-slate-500 hover:bg-slate-800"
                                  )}
                                >
                                  {activeMissionId === mission.id && (
                                    <div className="absolute top-0 right-0 p-2">
                                      <div className="bg-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter">Selected</div>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 mb-2">
                                    <Trophy className={cn("w-4 h-4", activeMissionId === mission.id ? "text-orange-400" : "text-slate-500")} />
                                    <span className="font-bold text-sm tracking-tight">{mission.name}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{mission.description}</p>
                                  <div className="flex justify-between items-center">
                                    <div className="text-[9px] font-mono text-slate-500 uppercase">
                                      Reward: <span className="text-orange-400/80">{mission.reward}</span>
                                    </div>
                                    <ChevronRight className={cn("w-4 h-4 transition-transform", activeMissionId === mission.id ? "translate-x-1 text-orange-500" : "text-slate-700 group-hover:translate-x-1")} />
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : activeNavTab === 'ai' ? (
                            <div className="space-y-6">
                              <div className="bg-blue-500/10 border border-blue-500/30 p-6 rounded-2xl space-y-4">
                                <div className="flex items-center gap-3 text-blue-400">
                                  <Cpu className="w-6 h-6" />
                                  <h3 className="font-black uppercase tracking-widest">Mission Control AI</h3>
                                </div>
                                <p className="text-sm text-slate-300 leading-relaxed">
                                  {aiAdvice || "Ready to analyze your current rocket design. I'll check for thrust-to-weight ratio, structural integrity, and mission compatibility."}
                                </p>
                                <button 
                                  onClick={analyzeRocket}
                                  disabled={isAiLoading}
                                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-all disabled:opacity-50 shadow-lg shadow-blue-900/20"
                                >
                                  {isAiLoading ? "Processing Telemetry..." : "Run Design Analysis"}
                                </button>
                              </div>
                              
                              <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Analysis History</h4>
                                <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/30 text-[11px] text-slate-500 italic">
                                  No previous analysis data found.
                                </div>
                              </div>
                            </div>
                          ) : activeNavTab === 'saved' ? (
                            <div className="space-y-3">
                              {savedDesigns.length === 0 ? (
                                <div className="h-40 flex flex-col items-center justify-center text-slate-600 text-center p-6 space-y-3">
                                  <Folder className="w-10 h-10 opacity-20" />
                                  <p className="text-xs italic">No saved designs yet. Build something amazing and save it!</p>
                                </div>
                              ) : (
                                savedDesigns.map(sd => (
                                  <div key={sd.id} className="flex gap-2">
                                    <button
                                      onClick={() => setDesign(JSON.parse(JSON.stringify(sd.design)))}
                                      className="flex-1 text-left p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-orange-500/50 hover:bg-slate-800 transition-all group"
                                    >
                                      <div className="flex justify-between items-center">
                                        <span className="font-bold text-sm">{sd.name}</span>
                                        <span className="text-[9px] text-slate-500 font-mono">{sd.design.components.length} parts</span>
                                      </div>
                                    </button>
                                    <button 
                                      onClick={() => setSavedDesigns(prev => prev.filter(p => p.id !== sd.id))}
                                      className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:bg-red-500/20 hover:border-red-500/50 text-slate-500 hover:text-red-400 transition-all"
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-8 space-y-4">
                              <Settings className="w-12 h-12 opacity-20" />
                              <div className="space-y-2">
                                <h3 className="font-bold text-slate-300 uppercase tracking-widest">System Settings</h3>
                                <p className="text-xs">Advanced simulation parameters and UI preferences will be available here in future updates.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div 
                key="flight-hud"
                initial={{ x: -400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -400, opacity: 0 }}
                className="w-80 flex flex-col gap-4 pointer-events-auto"
              >
                {/* Flight Stats */}
                <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 p-6 rounded-2xl shadow-2xl space-y-6">
                  {/* Active Mission Progress */}
                  {activeMissionId && (
                    <div className="pb-4 border-b border-slate-800 space-y-3">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-orange-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                          {MISSIONS.find(m => m.id === activeMissionId)?.name}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold uppercase">
                          <span className="text-slate-500">Mission Progress</span>
                          <span className={cn(
                            flightState.missionStatus === 'success' ? "text-green-400" : 
                            flightState.missionStatus === 'failed' ? "text-red-400" : "text-orange-400"
                          )}>
                            {flightState.missionStatus === 'success' ? "COMPLETED" : 
                             flightState.missionStatus === 'failed' ? "FAILED" : 
                             `${Math.round(flightState.missionProgress)}%`}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            className={cn(
                              "h-full transition-colors",
                              flightState.missionStatus === 'success' ? "bg-green-500" : 
                              flightState.missionStatus === 'failed' ? "bg-red-500" : "bg-orange-500"
                            )}
                            animate={{ width: `${flightState.missionProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      <span>Altitude</span>
                      <span>{Math.round(flightState.altitude)}m</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full relative overflow-hidden">
                      {/* Atmospheric Markers */}
                      <div className="absolute left-[12%] top-0 bottom-0 w-px bg-white/20 z-10" />
                      <div className="absolute left-[50%] top-0 bottom-0 w-px bg-white/20 z-10" />
                      <div className="absolute left-[85%] top-0 bottom-0 w-px bg-white/20 z-10" />
                      
                      <motion.div 
                        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" 
                        animate={{ width: `${Math.min(flightState.altitude / 100000 * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[7px] text-slate-600 mt-1 font-mono uppercase">
                      <span>Sea</span>
                      <span>Tropo</span>
                      <span>Strato</span>
                      <span>Meso</span>
                      <span>Space</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Velocity</span>
                      <div className="text-xl font-mono font-bold">
                        {Math.round(Math.sqrt(flightState.velocity[0]**2 + flightState.velocity[1]**2 + flightState.velocity[2]**2))} <span className="text-xs text-slate-500">m/s</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Max Alt</span>
                      <div className="text-xl font-mono font-bold">
                        {Math.round(flightState.maxAltitude)} <span className="text-xs text-slate-500">m</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                        <span>Liquid Fuel</span>
                        <span className={cn(flightState.liquidFuel < 100 ? "text-red-500 animate-pulse" : "text-blue-400")}>
                          {Math.round(flightState.liquidFuel)}kg
                        </span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-blue-400" 
                          animate={{ 
                            width: `${(flightState.liquidFuel / (flightState.maxLiquidFuel || 0.001)) * 100}%` 
                          }}
                        />
                      </div>
                    </div>

                    {flightState.maxSrbFuel > 0 && (
                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                          <span>SRB Fuel</span>
                          <span className={cn(flightState.srbFuel < 100 ? "text-red-500 animate-pulse" : "text-orange-400")}>
                            {Math.round(flightState.srbFuel)}kg
                          </span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-orange-400" 
                            animate={{ 
                              width: `${(flightState.srbFuel / (flightState.maxSrbFuel || 0.001)) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">SAS SYSTEM</span>
                      <button 
                        onClick={() => setFlightState(prev => ({ ...prev, isSasActive: !prev.isSasActive }))}
                        className={cn("px-2 py-0.5 rounded text-[10px] font-bold transition-all hover:scale-105 active:scale-95", flightState.isSasActive ? "bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-slate-800 text-slate-500 hover:bg-slate-700")}
                      >
                        {flightState.isSasActive ? "ACTIVE" : "OFF"}
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">ENGINE</span>
                      <button 
                        onClick={() => setFlightState(prev => {
                          const nextActive = !prev.isEngineActive;
                          return { 
                            ...prev, 
                            isEngineActive: nextActive,
                            isSrbIgnited: nextActive ? true : prev.isSrbIgnited 
                          };
                        })}
                        className={cn("px-2 py-0.5 rounded text-[10px] font-bold transition-all hover:scale-105 active:scale-95", flightState.isEngineActive ? "bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.4)]" : "bg-slate-800 text-slate-500 hover:bg-slate-700")}
                      >
                        {flightState.isEngineActive ? "ACTIVE" : "IDLE"}
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">PARACHUTE</span>
                      <button 
                        onClick={() => setFlightState(prev => ({ ...prev, isParachuteDeployed: !prev.isParachuteDeployed }))}
                        className={cn("px-2 py-0.5 rounded text-[10px] font-bold transition-all hover:scale-105 active:scale-95", flightState.isParachuteDeployed ? "bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]" : "bg-slate-800 text-slate-500 hover:bg-slate-700")}
                      >
                        {flightState.isParachuteDeployed ? "DEPLOYED" : "STOWED"}
                      </button>
                    </div>
                  </div>

                  {/* Telemetry Data */}
                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Real-time Telemetry</h3>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {/* Engine Temp */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold uppercase">
                          <span className="text-slate-400">Engine Temp</span>
                          <span className={cn(flightState.engineTemperature > 800 ? "text-red-400" : "text-slate-300")}>
                            {Math.round(flightState.engineTemperature)}°C
                          </span>
                        </div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            className={cn("h-full", flightState.engineTemperature > 800 ? "bg-red-500" : "bg-orange-400")}
                            animate={{ width: `${Math.min(flightState.engineTemperature / 1000 * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Structural Stress */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold uppercase">
                          <span className="text-slate-400">Structural Stress</span>
                          <span className={cn(flightState.structuralStress > 80 ? "text-red-400" : "text-slate-300")}>
                            {Math.round(flightState.structuralStress)}%
                          </span>
                        </div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            className={cn("h-full", flightState.structuralStress > 80 ? "bg-red-500" : "bg-blue-400")}
                            animate={{ width: `${flightState.structuralStress}%` }}
                          />
                        </div>
                      </div>

                      {/* Fuel Flow */}
                      <div className="flex justify-between text-[9px] font-bold uppercase">
                        <span className="text-slate-400">Fuel Flow Rate</span>
                        <span className="text-blue-400 font-mono">
                          {flightState.fuelFlowRate.toFixed(1)} kg/s
                        </span>
                      </div>

                      {/* Gimbal Angle */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[9px] font-bold uppercase">
                          <span className="text-slate-400">Gimbal Angle</span>
                          <span className="text-orange-400 font-mono">
                            X: {(flightState.gimbalAngle[0] * 180 / Math.PI).toFixed(1)}° | Z: {(flightState.gimbalAngle[1] * 180 / Math.PI).toFixed(1)}°
                          </span>
                        </div>
                        <div className="flex gap-1 h-1">
                          <div className="flex-1 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-orange-500"
                              animate={{ width: `${Math.min(Math.abs(flightState.gimbalAngle[0] / 0.1) * 100, 100)}%` }}
                            />
                          </div>
                          <div className="flex-1 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-orange-500"
                              animate={{ width: `${Math.min(Math.abs(flightState.gimbalAngle[1] / 0.1) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Angular Velocity */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold uppercase">
                          <span className="text-slate-400">Angular Velocity</span>
                          <span className="text-blue-300 font-mono">
                            {Math.sqrt(flightState.angularVelocity[0]**2 + flightState.angularVelocity[1]**2 + flightState.angularVelocity[2]**2).toFixed(2)} rad/s
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Central Viewport Overlays */}
          <div className="flex-1 relative">
            {/* Viewport Info */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-4">
              {mode === 'flight' && (
                <div className="px-3 py-1 bg-slate-900/60 border border-slate-800 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Flight Cam
                </div>
              )}
            </div>

            {/* Reset View Button */}
            {mode === 'build' && (
              <div className="absolute bottom-8 left-1/2 translate-x-1/2 z-20 pointer-events-auto">
                <button 
                  onClick={() => {
                    if (sceneRef.current?.controls) {
                      sceneRef.current.camera.position.set(0, 3, 15);
                      sceneRef.current.controls.target.set(0, 1.5, 0);
                      sceneRef.current.controls.update();
                    }
                  }}
                  className="p-2 bg-slate-900/80 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors group flex items-center gap-2"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400 group-hover:text-orange-500 transition-colors" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Reset View</span>
                </button>
              </div>
            )}

            {mode === 'flight' && (
              <div className="absolute inset-0 z-30 pointer-events-none">
                {flightComponentPopups.map((popup) => {
                  const comp = design.components.find(c => c.instanceId === popup.componentInstanceId);
                  if (!comp) return null;

                  const fuelMass = getComponentFuelMass(comp, flightState);
                  const heating = getComponentHeating(comp, flightState);
                  const isDetached = flightState.detachedComponentIds.includes(comp.instanceId);
                  const isActive = flightState.activeComponentIds.includes(comp.instanceId);

                  return (
                    <div
                      key={popup.componentInstanceId}
                      className="absolute w-56 bg-slate-900/90 border border-slate-700 rounded-xl shadow-xl backdrop-blur-sm p-3 pointer-events-auto"
                      style={{ left: popup.x, top: popup.y }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Component</div>
                          <div className="text-xs font-bold text-slate-100 truncate max-w-[150px]">{comp.name}</div>
                        </div>
                        <button
                          onClick={() => {
                            setFlightComponentPopups(prev => prev.map(p => {
                              if (p.componentInstanceId !== popup.componentInstanceId) return p;
                              return { ...p, pinned: !p.pinned };
                            }));
                          }}
                          className={cn(
                            "p-1 rounded-md border transition-colors",
                            popup.pinned
                              ? "bg-orange-500/20 border-orange-500/40 text-orange-300"
                              : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                          )}
                          title={popup.pinned ? 'Unpin popup' : 'Pin popup'}
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="space-y-1.5 text-[10px] uppercase tracking-wider font-bold">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Fuel</span>
                          <span className="font-mono text-blue-300">{fuelMass.toFixed(1)} kg</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Heating</span>
                          <span className={cn("font-mono", heating > 900 ? "text-red-400" : heating > 550 ? "text-orange-300" : "text-green-300")}>{heating.toFixed(0)} C</span>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-700/60 space-y-1.5">
                        {(comp.type === 'engine' || comp.type === 'srb') && (
                          <button
                            onClick={() => triggerComponentAction(comp, isActive ? 'stop' : 'start')}
                            disabled={isDetached || countdown !== null}
                            className={cn(
                              "w-full py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors",
                              isActive
                                ? "bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                                : "bg-orange-500/20 border border-orange-500/40 text-orange-300 hover:bg-orange-500/30",
                              (isDetached || countdown !== null) && "opacity-40 cursor-not-allowed hover:bg-inherit"
                            )}
                          >
                            {isActive ? 'Stop Component' : 'Start Component'}
                          </button>
                        )}

                        {comp.type === 'parachute' && (
                          <button
                            onClick={() => triggerComponentAction(comp, flightState.isParachuteDeployed ? 'stow' : 'deploy')}
                            disabled={isDetached || countdown !== null}
                            className={cn(
                              "w-full py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors border",
                              flightState.isParachuteDeployed
                                ? "bg-green-500/20 border-green-500/40 text-green-300 hover:bg-green-500/30"
                                : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25",
                              (isDetached || countdown !== null) && "opacity-40 cursor-not-allowed hover:bg-inherit"
                            )}
                          >
                            {flightState.isParachuteDeployed ? 'Stow Parachute' : 'Deploy Parachute'}
                          </button>
                        )}

                        {isDetached && (
                          <div className="text-[9px] text-red-300/80 uppercase tracking-widest font-bold">Detached component</div>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setFlightComponentPopups(prev => prev.filter(p => p.componentInstanceId !== popup.componentInstanceId));
                        }}
                        className="mt-2 text-[9px] text-slate-500 hover:text-slate-300 uppercase tracking-widest font-bold"
                      >
                        Close
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel: Active Design or Flight Status */}
          <AnimatePresence mode="wait">
            {mode === 'build' ? (
              <motion.div 
                key="active-design"
                initial={{ x: 400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 400, opacity: 0 }}
                className="w-80 flex flex-col gap-4 pointer-events-auto"
              >
                {(() => {
                  const totalMass = design.components.reduce((s, c) => {
                    const scaleFactor = Math.pow(c.customScale, 3);
                    const count = c.boosterCount || 1;
                    const fuelMass = (c.fuelCapacity || 0) * scaleFactor * (FUEL_TYPES[c.fuelType || 'kerosene'].density / FUEL_TYPES['kerosene'].density) * count;
                    return s + (c.mass * scaleFactor * count) + fuelMass;
                  }, 0);

                  const dryMass = design.components.reduce((s, c) => {
                    const scaleFactor = Math.pow(c.customScale, 3);
                    const count = c.boosterCount || 1;
                    return s + (c.mass * scaleFactor * count);
                  }, 0);

                  const totalThrust = design.components.reduce((s, c) => s + (c.thrust || 0) * Math.pow(c.customScale, 2) * (c.boosterCount || 1), 0);

                  const totalWeightedIsp = design.components.reduce((s, c) => {
                    if (c.thrust && c.isp) {
                      const count = c.boosterCount || 1;
                      return s + (c.thrust * Math.pow(c.customScale, 2) * count * c.isp);
                    }
                    return s;
                  }, 0);

                  const avgIsp = totalThrust > 0 ? totalWeightedIsp / totalThrust : 0;
                  const deltaV = avgIsp > 0 && totalMass > dryMass ? avgIsp * 9.81 * Math.log(totalMass / dryMass) : 0;
                  const twRatio = totalMass > 0 ? totalThrust / (totalMass * 9.81) : 0;

                  return (
                    <div className="flex-1 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                      <div className="p-4 border-bottom border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Info className="w-4 h-4 text-slate-400" />
                          <h2 className="font-bold uppercase text-sm tracking-widest">Active Assembly</h2>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{design.components.length} PARTS</span>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        <DndContext 
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext 
                            items={design.components.map(c => c.instanceId)}
                            strategy={verticalListSortingStrategy}
                          >
                            {design.components.map((comp, idx) => (
                              <SortableItem 
                                key={comp.instanceId}
                                comp={comp}
                                index={idx}
                                isSelected={selectedComponentIndex === idx}
                                onSelect={() => setSelectedComponentIndex(selectedComponentIndex === idx ? null : idx)}
                                onUpdate={(updates) => updateComponent(idx, updates)}
                                onRemove={() => {
                                  setDesign(prev => ({ ...prev, components: prev.components.filter((_, i) => i !== idx) }));
                                  if (selectedComponentIndex === idx) setSelectedComponentIndex(null);
                                }}
                              />
                            ))}
                          </SortableContext>
                        </DndContext>
                        {design.components.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-8">
                            <Rocket className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm">No components selected.<br/>Add parts from the library.</p>
                          </div>
                        )}
                      </div>

                      <div className="p-4 bg-slate-950/50 border-t border-slate-700 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Total Mass</span>
                          <span className="font-mono">{Math.round(totalMass)} kg</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Max Thrust</span>
                          <span className="font-mono text-orange-400">{Math.round(totalThrust)} N</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">T:W Ratio</span>
                            <div className={cn("text-sm font-mono font-bold", twRatio > 1.2 ? "text-green-400" : "text-red-400")}>
                              {twRatio.toFixed(2)}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Delta-V</span>
                            <div className="text-sm font-mono font-bold text-blue-400">
                              {Math.round(deltaV)} m/s
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Build Controls Hint */}
                      <div className="mt-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800 text-[10px] text-slate-400 space-y-2">
                        <div className="flex justify-between"><span>ROTATE</span> <span className="text-slate-200 font-mono">LEFT CLICK</span></div>
                        <div className="flex justify-between"><span>PAN</span> <span className="text-slate-200 font-mono">RIGHT CLICK</span></div>
                        <div className="flex justify-between"><span>ZOOM</span> <span className="text-slate-200 font-mono">SCROLL</span></div>
                        <div className="flex justify-between"><span>SELECT</span> <span className="text-slate-200 font-mono">CLICK PART</span></div>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            ) : (
              <motion.div 
                key="flight-status"
                initial={{ x: 400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 400, opacity: 0 }}
                className="w-80 max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar flex flex-col gap-4 pointer-events-auto ml-auto pr-1"
              >
                <div className="bg-slate-900/60 backdrop-blur-sm p-3 rounded-xl border border-slate-800 space-y-3">
                  <button
                    onClick={() => setIsFlightShortcutsOpen(prev => !prev)}
                    className="w-full flex items-center justify-between text-[10px] text-slate-300 uppercase tracking-widest font-bold hover:text-white transition-colors"
                  >
                    <span>Flight Shortcuts</span>
                    {isFlightShortcutsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {isFlightShortcutsOpen && (
                    <div className="text-[10px] text-slate-400 space-y-2">
                      <div className="flex justify-between"><span>STAGE</span> <span className="text-orange-400 font-black font-mono">ENTER</span></div>
                      <div className="flex justify-between"><span>THRUST</span> <span className="text-slate-200 font-mono">SPACE</span></div>
                      <div className="flex justify-between"><span>THROTTLE</span> <span className="text-slate-200 font-mono">SHIFT/CTRL</span></div>
                      <div className="flex justify-between"><span>PITCH/YAW</span> <span className="text-slate-200 font-mono">WASD</span></div>
                      <div className="flex justify-between"><span>ROLL</span> <span className="text-slate-200 font-mono">QE</span></div>
                      <div className="flex justify-between"><span>PARACHUTE</span> <span className="text-slate-200 font-mono">P</span></div>
                      <div className="flex justify-between"><span>CAMERA VIEW</span> <span className="text-slate-200 font-mono">1-4</span></div>
                      <div className="flex justify-between"><span>PAN/ZOOM</span> <span className="text-slate-200 font-mono">ARROWS / +/-</span></div>
                      <div className="flex justify-between"><span>TIME WARP</span> <span className="text-slate-200 font-mono">[ / ]</span></div>
                    </div>
                  )}
                </div>

                {/* Staging Timeline - Horizontal */}
                {(flightState.stages || []).length > 0 && (
                  <div className="bg-slate-900/60 backdrop-blur-sm p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Rocket className="w-3 h-3 text-orange-400" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Stage Timeline</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                      <div className="h-0.5 absolute bottom-8 left-0 right-0 bg-slate-800/30 mx-3" />
                      <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => {
                          const { active, over } = event;
                          if (over && active.id !== over.id) {
                            const oldIndex = (flightState.stages || []).findIndex(s => s.id === active.id);
                            const newIndex = (flightState.stages || []).findIndex(s => s.id === over.id);
                            if (oldIndex > newIndex) {
                              reorderStage(oldIndex, 'up');
                            } else {
                              reorderStage(oldIndex, 'down');
                            }
                          }
                        }}
                      >
                        <SortableContext 
                          items={(flightState.stages || []).map(s => s.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {(flightState.stages || []).map((stage, idx) => {
                            const isCurrent = idx === flightState.currentStageIndex - 1;
                            const isPast = idx < flightState.currentStageIndex - 1;
                            const isNext = idx === flightState.currentStageIndex;

                            return (
                              <SortableStageTimeline
                                key={stage.id}
                                stageId={stage.id}
                                idx={idx}
                                isCurrent={isCurrent}
                                isPast={isPast}
                                isNext={isNext}
                                stage={stage}
                                design={design}
                              />
                            );
                          })}
                        </SortableContext>
                      </DndContext>
                    </div>
                  </div>
                )}

                <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-800 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setIsFlightStagingOpen(prev => !prev)}
                    className="w-full px-4 py-3 border-b border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-orange-400" />
                      <span className="text-xs font-black uppercase tracking-widest text-slate-300">In-Flight Staging</span>
                    </div>
                    {isFlightStagingOpen ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
                  </button>

                  {isFlightStagingOpen && (
                    <div className="max-h-[min(65vh,36rem)] overflow-y-auto overscroll-contain touch-pan-y p-4 pr-2 space-y-3 custom-scrollbar">
                      <div className="flex justify-between items-center">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Staging Sequence</h3>
                        <button
                          onClick={addStage}
                          className="px-2 py-1 text-[9px] rounded-md bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add Stage
                        </button>
                      </div>

                      {(design.stages || []).length === 0 ? (
                        <div className="py-6 text-center rounded-lg border border-dashed border-slate-700 bg-slate-900/40">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">No stages defined</p>
                          <p className="text-[9px] text-slate-600 mt-1 italic">Add a stage to begin sequencing your launch.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(design.stages || []).map((stage, sIdx) => (
                            <div key={stage.id} className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
                              <div className="p-3 bg-slate-900/50 border-b border-slate-700/50">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Stage {sIdx + 1}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => reorderStage(sIdx, 'up')}
                                      disabled={sIdx === 0}
                                      className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 hover:text-slate-300"
                                    >
                                      <ChevronUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => reorderStage(sIdx, 'down')}
                                      disabled={sIdx === (design.stages?.length || 0) - 1}
                                      className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 hover:text-slate-300"
                                    >
                                      <ChevronDown className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => removeStage(stage.id)}
                                      className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="p-3 space-y-2">
                                <div className="space-y-1.5">
                                  {stage.componentInstanceIds.map(id => {
                                    const comp = design.components.find(c => c.instanceId === id);
                                    if (!comp) return null;
                                    return (
                                      <div key={id} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg border border-slate-700/50 group">
                                        <div className="flex items-center gap-2">
                                          {comp.type === 'engine' && <Zap className="w-3 h-3 text-orange-400" />}
                                          {comp.type === 'srb' && <Flame className="w-3 h-3 text-red-400" />}
                                          {comp.type === 'coupler' && <LinkIcon className="w-3 h-3 text-slate-400" />}
                                          {comp.type === 'parachute' && <ArrowDownCircle className="w-3 h-3 text-green-400" />}
                                          <span className="text-[10px] font-medium truncate max-w-[120px]">{comp.name}</span>
                                        </div>
                                        <button
                                          onClick={() => removeComponentFromStage(stage.id, id)}
                                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-400 transition-all"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="pt-2">
                                  <select
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        addComponentToStage(stage.id, e.target.value);
                                        e.target.value = "";
                                      }
                                    }}
                                    className="w-full bg-blue-950/50 border border-blue-700/50 rounded-lg py-1.5 px-2 text-[10px] text-blue-200 focus:outline-none focus:border-blue-400"
                                  >
                                    <option value="">+ Add Component</option>
                                    {design.components
                                      .filter(c => ['engine', 'srb', 'coupler', 'parachute'].includes(c.type))
                                      .filter(c => !stage.componentInstanceIds.includes(c.instanceId))
                                      .map(c => (
                                        <option key={c.instanceId} value={c.instanceId}>{c.name}</option>
                                      ))
                                    }
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {flightState.missionStatus === 'failed' && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-red-950/80 backdrop-blur-md border border-red-500/50 p-6 rounded-2xl shadow-2xl text-center space-y-4"
                  >
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                    <h2 className="text-2xl font-black uppercase italic text-red-200">Mission Failed</h2>
                    <p className="text-sm text-red-300">
                      {flightState.isCrashed 
                        ? "The rocket was destroyed upon impact." 
                        : "Mission objectives were not met within the required parameters."}
                    </p>
                    <button 
                      onClick={resetBuild}
                      className="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold transition-all"
                    >
                      RETRY MISSION
                    </button>
                  </motion.div>
                )}

                {flightState.missionStatus === 'success' && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-green-950/80 backdrop-blur-md border border-green-500/50 p-6 rounded-2xl shadow-2xl text-center space-y-4"
                  >
                    <Trophy className="w-12 h-12 text-green-500 mx-auto" />
                    <h2 className="text-2xl font-black uppercase italic text-green-200">Mission Success</h2>
                    <div className="space-y-2">
                      <p className="text-sm text-green-300 font-bold">
                        {MISSIONS.find(m => m.id === activeMissionId)?.name} COMPLETED
                      </p>
                      <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl">
                        <span className="text-[10px] text-green-500 uppercase font-bold tracking-widest block mb-1">Reward Unlocked</span>
                        <span className="text-xs text-white font-mono">{MISSIONS.find(m => m.id === activeMissionId)?.reward}</span>
                      </div>
                    </div>
                    <button 
                      onClick={resetBuild}
                      className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold transition-all"
                    >
                      RETURN TO HANGAR
                    </button>
                  </motion.div>
                )}

                {!activeMissionId && flightState.isCrashed && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-red-950/80 backdrop-blur-md border border-red-500/50 p-6 rounded-2xl shadow-2xl text-center space-y-4"
                  >
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                    <h2 className="text-2xl font-black uppercase italic text-red-200">Rocket Destroyed</h2>
                    <p className="text-sm text-red-300">Impact velocity exceeded structural limits.</p>
                    <button 
                      onClick={resetBuild}
                      className="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold transition-all"
                    >
                      BACK TO BUILDER
                    </button>
                  </motion.div>
                )}

                {!activeMissionId && flightState.isLanded && flightState.time > 5 && !flightState.isCrashed && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-green-950/80 backdrop-blur-md border border-green-500/50 p-6 rounded-2xl shadow-2xl text-center space-y-4"
                  >
                    <Trophy className="w-12 h-12 text-green-500 mx-auto" />
                    <h2 className="text-2xl font-black uppercase italic text-green-200">Flight Complete</h2>
                    <p className="text-sm text-green-300">Safe landing confirmed. Max altitude: {Math.round(flightState.maxAltitude)}m.</p>
                    <button 
                      onClick={resetBuild}
                      className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold transition-all"
                    >
                      NEW DESIGN
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer HUD - Only in flight mode */}
        {mode === 'flight' && (
          <footer className="p-6 flex justify-center pointer-events-auto">
            <div className="bg-slate-900/60 backdrop-blur-sm px-6 py-3 rounded-full border border-slate-800 flex gap-8 items-center">
              <div className="flex items-center gap-4 border-r border-slate-800 pr-8">
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] text-slate-500 uppercase font-bold tracking-widest">Throttle</span>
                  <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-orange-500"
                      animate={{ width: `${flightState.throttle * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-[10px] font-mono text-slate-200 w-8">
                  {Math.round(flightState.throttle * 100)}%
                </div>
              </div>

              <div className="flex items-center gap-4 pr-8">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", flightState.isLanded ? "bg-green-500" : "bg-blue-500 animate-pulse")} />
                  <span className="text-[10px] font-bold text-slate-200 uppercase tracking-widest">
                    {flightState.isLanded ? "Surface Operations" : "Flight Operations"}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  T+ {flightState.time.toFixed(1)}s
                </div>
              </div>
              
              <div className="h-4 w-px bg-slate-800" />
              <div className="flex gap-2 items-center">
                {[
                  { id: 'follow', icon: <Rocket className="w-3 h-3" />, key: '1' },
                  { id: 'ground', icon: <Globe className="w-3 h-3" />, key: '2' },
                  { id: 'top', icon: <ArrowUp className="w-3 h-3" />, key: '3' },
                  { id: 'passenger', icon: <Eye className="w-3 h-3" />, key: '4' }
                ].map(view => (
                  <button
                    key={view.id}
                    onClick={() => setCameraView(view.id as any)}
                    className={cn(
                      "w-8 h-8 rounded-lg flex flex-col items-center justify-center transition-all relative",
                      cameraView === view.id ? "bg-orange-500 text-white shadow-lg" : "bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-200"
                    )}
                  >
                    {view.icon}
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-slate-900 rounded-full text-[6px] flex items-center justify-center border border-slate-700 text-slate-400">
                      {view.key}
                    </span>
                  </button>
                ))}
              </div>
              
              <div className="h-4 w-px bg-slate-800" />
              <div className="flex gap-2 items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mr-2">Time Warp</span>
                {[1, 2, 4, 8].map(w => (
                  <button
                    key={w}
                    onClick={() => setTimeWarp(w)}
                    className={cn(
                      "w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-all relative",
                      timeWarp === w ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                    )}
                  >
                    {w}x
                  </button>
                ))}
                <div className="flex gap-1 ml-2">
                  <span className="text-[8px] text-slate-600 font-mono bg-slate-900 px-1 rounded border border-slate-800">[</span>
                  <span className="text-[8px] text-slate-600 font-mono bg-slate-900 px-1 rounded border border-slate-800">]</span>
                </div>
              </div>
            </div>
          </footer>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </div>
  );
}
