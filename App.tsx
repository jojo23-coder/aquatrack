import React, { useState, useEffect, useMemo } from 'react';
import { AquariumState, TankType, WaterLog, PhaseId, ParameterRange, ReminderSettings, EngineSetup, Task } from './types';
import { INITIAL_TASKS, MOCK_LOGS, PHASES } from './constants';
import WaterParameterChart from './components/WaterParameterChart';
import Checklist from './components/Checklist';
import LogForm from './components/LogForm';
import { LayoutDashboard, ClipboardList, PlusCircle, Settings, Droplets, Info, ChevronRight, CheckCircle2, Trash2, Edit2, History, AlertCircle, Target, X, Wind, Layers, Bell, Clock, Calendar, BellRing, RefreshCw } from 'lucide-react';
import biologyCatalog from './data/biologyCatalog';
import enginePackage from './data/aquatrack_engine.package.json';
import productCatalog from './data/product.catalog.instance.json';
import protocolRuleset from './data/protocol.ruleset.json';
import atomLibrary from './data/atom-library.json';
import phasePlaylists from './data/phase-playlists.lookup.json';
import { generatePlan, generatePhasesFromPlaylists } from './engine/planEngine';

type Tab = 'dashboard' | 'logs' | 'roadmap' | 'settings';

const STORAGE_KEY = 'aquatrack_v1_data';

const fishSpeciesIndex = new Map();
const shrimpSpeciesIndex = new Map();
const plantSpeciesIndex = new Map();

const registerGroup = (map, group, type) => {
  map.set(group.display_name, { group, type });
  group.common_examples.forEach(name => {
    map.set(name, { group, type });
  });
};

biologyCatalog.fish_groups.forEach(group => registerGroup(fishSpeciesIndex, group, 'fish'));
biologyCatalog.shrimp_groups.forEach(group => registerGroup(shrimpSpeciesIndex, group, 'shrimp'));
biologyCatalog.plant_groups.forEach(group => registerGroup(plantSpeciesIndex, group, 'plant'));

const fishOptions = biologyCatalog.fish_groups.map(group => group.display_name).sort();
const shrimpOptions = biologyCatalog.shrimp_groups.map(group => group.display_name).sort();
const plantOptions = biologyCatalog.plant_groups.map(group => group.display_name).sort();

const getRequirementRanges = (speciesName) => {
  const fishMatch = fishSpeciesIndex.get(speciesName);
  if (fishMatch) return fishMatch.group.typical_requirements;
  const shrimpMatch = shrimpSpeciesIndex.get(speciesName);
  if (shrimpMatch) return shrimpMatch.group.typical_requirements;
  return null;
};

const getPlantDemandClass = (speciesList: string[]) => {
  const plantGroups = speciesList
    .map(name => plantSpeciesIndex.get(name)?.group)
    .filter(Boolean);
  if (!plantGroups.length) return 'auto';
  const hasHighLight = plantGroups.some(group => group.typical_requirements.light?.includes('high'));
  const hasRequiredCo2 = plantGroups.some(group => group.typical_requirements.co2?.includes('required'));
  const hasMediumLight = plantGroups.some(group => group.typical_requirements.light?.includes('medium'));
  if (hasRequiredCo2 || hasHighLight) return 'high';
  if (hasMediumLight) return 'medium';
  return 'low';
};

const rangesOverlap = (rangeA, rangeB) => {
  if (!rangeA || !rangeB) return true;
  return Math.max(rangeA[0], rangeB[0]) <= Math.min(rangeA[1], rangeB[1]);
};

const intersectRange = (ranges) => {
  if (!ranges.length) return null;
  let min = ranges[0][0];
  let max = ranges[0][1];
  ranges.forEach(range => {
    min = Math.max(min, range[0]);
    max = Math.min(max, range[1]);
  });
  if (min > max) return null;
  return [min, max];
};

const meanRange = (range) => {
  if (!range) return null;
  return (range[0] + range[1]) / 2;
};

const intersectSets = (sets) => {
  if (!sets.length) return [];
  let common = new Set(sets[0]);
  sets.slice(1).forEach(values => {
    common = new Set(values.filter(value => common.has(value)));
  });
  return Array.from(common);
};

const deriveLivestockTraits = (fishList: string[], shrimpList: string[]) => {
  let isSensitive = shrimpList.length > 0;
  let hasDiggers = false;
  fishList.forEach((name) => {
    const match = fishSpeciesIndex.get(name);
    if (match?.group?.sensitive) {
      isSensitive = true;
    }
    if (match?.group?.digger) {
      hasDiggers = true;
    }
  });
  return { is_sensitive: isSensitive, has_diggers: hasDiggers };
};

const formatDisplayValue = (value) => {
  if (!value) return '';
  return value
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};

const renderBoldText = (text: string) => {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={`b-${index}`} className="font-semibold text-slate-100">{part}</strong>;
    }
    return <span key={`t-${index}`}>{part}</span>;
  });
};

const cyclingReasonDescriptions: Record<string, string> = {
  DEFAULT_SAFE: 'Default safe recommendation when no risk flags are present.',
  SHRIMP_PLANNED: 'Shrimp planned: favor a stable, low-risk cycle.',
  LOW_RISK_TOLERANCE: 'Low risk tolerance selected.',
  KH_UNKNOWN_OR_LOW: 'Tap KH is unknown or low, so predictability is prioritized.',
  PREDICTABILITY_PRIORITY: 'Favoring the most predictable cycling path.',
  NO_AMMONIA_SOURCE: 'No ammonia source available for fishless cycling.',
  USER_ACCEPTS_RISK: 'High risk tolerance allows fish-in cycling.',
  USER_SELECTED_HIGHER_RISK: 'User selected a higher-risk cycling mode.'
};

const darkStartReasonDescriptions: Record<string, string> = {
  USER_SELECTED: 'You explicitly selected Dark Start.',
  AQUASOIL_ALGAE_RISK: 'Aquasoil increases early algae risk; dark start helps.',
  HIGH_LIGHT_RISK: 'High initial light and growth-first goals increase algae risk.',
  DEFAULT: 'Default recommendation based on setup inputs (typically inert substrate and lower algae risk).'
};

const formatReasonList = (codes?: string[], mapping?: Record<string, string>) => {
  if (!codes || !codes.length) return 'No specific reasons available.';
  return codes
    .map((code) => mapping?.[code] || code)
    .map((text) => `- ${text}`)
    .join('\n');
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [highlightedParam, setHighlightedParam] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<WaterLog | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; content: string } | null>(null);
  const [showPhasePicker, setShowPhasePicker] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>('default');
  const [showTankSwitcher, setShowTankSwitcher] = useState(false);
  const [showDeleteTankModal, setShowDeleteTankModal] = useState(false);
  const [activeSetupSection, setActiveSetupSection] = useState<'tank' | 'water' | 'biology' | 'preferences' | 'products' | 'protocol' | 'alerts' | 'data'>('tank');
  const [selectedFishToAdd, setSelectedFishToAdd] = useState(fishOptions[0] || '');
  const [selectedShrimpToAdd, setSelectedShrimpToAdd] = useState(shrimpOptions[0] || '');
  const [selectedPlantToAdd, setSelectedPlantToAdd] = useState(plantOptions[0] || '');

  const defaultEngineSetup: EngineSetup = {
    user_preferences: {
      cycling_mode_preference: 'auto',
      dark_start: 'auto',
      risk_tolerance: 'low',
      goal_profile: 'stability_first',
      photoperiod_hours_initial: 6,
      photoperiod_hours_post_cycle: 8,
      units: 'metric'
    },
    protocol_preferences: {
      cycling: true,
      maintenance: true,
      stocking: true,
      plant_care: true,
      alerts: true,
      emergency: true
    },
    protocol_overrides: {
      cycling: false,
      dark_start: false,
      maintenance: false
    },
    tank_profile: {
      tank_volume_l_gross: 60,
      net_volume_method: 'estimate_multiplier',
      estimated_net_multiplier: 0.85,
      net_water_volume_l: undefined,
      substrate: {
        type: 'inert',
        sand_cap_cm: 2.0
      },
      hardscape: {
        type: 'mixed'
      },
      lighting_system: 'basic',
      filtration: {
        filter_model: '',
        rated_flow_lph: undefined,
        flow_class: 'medium'
      },
      heater_installed: true,
      co2: {
        enabled: true,
        injection_type: 'diffuser',
        target_ph_drop: 1.0,
        surface_agitation: 'gentle_ripple',
        start_intent: 'eventual'
      },
      temperature_target_c: [22, 24]
    },
    water_source_profile: {
      tap_ph: 7.2,
      tap_gh_dgh: 5.0,
      tap_kh_dkh: 2.0,
      tap_ammonia_ppm: 0,
      disinfectant: 'unknown',
      weekly_water_change_percent_target: 30
    },
    biology_profile: {
      plants: {
        categories: ['epiphytes'],
        demand_class: 'auto',
        density: 'moderate',
        species: []
      },
      livestock_plan: {
        fish: [],
        shrimp: [],
        cleanup_crew: []
      },
      livestock_traits: {
        is_sensitive: false,
        has_diggers: false
      }
    },
    product_stack: {
      ammonia_source: {
        type: 'pure_ammonia',
        solution_percent: 10
      },
      selected_product_ids: [],
      user_products: [
        {
          role: 'gh_remineralizer',
          enabled: false,
          name: '',
          dose_amount: 0,
          dose_unit: 'g',
          per_volume_l: 0,
          effect_value: 0
        },
        {
          role: 'kh_buffer',
          enabled: false,
          name: '',
          dose_amount: 0,
          dose_unit: 'g',
          per_volume_l: 0,
          effect_value: 0,
          bicarbonate: false
        },
        {
          role: 'gh_kh_remineralizer',
          enabled: false,
          name: '',
          dose_amount: 0,
          dose_unit: 'g',
          per_volume_l: 0,
          effect_value: 0,
          per_volume_l_gh: 0,
          effect_value_gh: 0,
          per_volume_l_kh: 0,
          effect_value_kh: 0
        },
        {
          role: 'bacteria_starter',
          enabled: false,
          name: '',
          dose_amount: 0,
          dose_unit: 'mL',
          per_volume_l: 0,
          effect_value: 0
        },
        {
          role: 'fertilizer_micros',
          enabled: false,
          name: '',
          dose_amount: 0,
          dose_unit: 'mL',
          per_volume_l: 0,
          effect_value: 0
        },
        {
          role: 'ammonia_source',
          enabled: false,
          name: '',
          dose_amount: 0,
          dose_unit: 'mL',
          per_volume_l: 0,
          effect_value: 0,
          ammonia_solution_percent: 10,
          pure_ammonia: false
        },
        {
          role: 'detoxifier_conditioner',
          enabled: false,
          name: '',
          dose_amount: 0,
          dose_unit: 'mL',
          per_volume_l: 0,
          effect_value: 0
        },
        {
          role: 'water_clarifier',
          enabled: false,
          name: '',
          dose_amount: 0,
          dose_unit: 'mL',
          per_volume_l: 0,
          effect_value: 0
        },
        {
          role: 'water_quality_support',
          enabled: false,
          name: '',
          dose_amount: 0,
          dose_unit: 'mL',
          per_volume_l: 0,
          effect_value: 0
        }
      ]
    },
    testing: {
      can_test_ammonia: true,
      can_test_nitrite: true,
      can_test_nitrate: true,
      can_test_ph: true,
      can_test_gh: true,
      can_test_kh: true
    }
  };

  const createTankId = () => `tank_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const createSeedTank = (): AquariumState => ({
    id: createTankId(),
    tankName: "Lava Rock 6L",
    tankSize: 6,
    tankType: TankType.PLANTED,
    startDate: new Date().toISOString().split('T')[0],
    logs: MOCK_LOGS,
    tasks: INITIAL_TASKS,
    currentPhase: 'phase_1_initial_start_day_0',
    reminderSettings: {
      enabled: false,
      dailyTime: "09:00",
      weeklyDay: 1, // Monday
      monthlyDay: 1
    },
    engineSetup: {
      ...defaultEngineSetup,
      tank_profile: {
        ...defaultEngineSetup.tank_profile,
        tank_volume_l_gross: 6
      }
    },
    targets: {
      temperature: { min: 22.0, max: 24.0 },
      pH: { min: 6.4, max: 7.8 },
      ammonia: 0.0,
      nitrite: 0.0,
      nitrate: { min: 5.0, max: 30.0 },
      gh: { min: 5.0, max: 7.0 },
      kh: { min: 2.0, max: 4.0 }
    }
  });

  const createEmptyTank = (): AquariumState => ({
    id: createTankId(),
    tankName: "New Tank",
    tankSize: 6,
    tankType: TankType.PLANTED,
    startDate: new Date().toISOString().split('T')[0],
    logs: [],
    tasks: [],
    currentPhase: 'phase_1_initial_start_day_0',
    reminderSettings: {
      enabled: false,
      dailyTime: "09:00",
      weeklyDay: 1, // Monday
      monthlyDay: 1
    },
    engineSetup: {
      ...defaultEngineSetup,
      protocol_overrides: {
        cycling: false,
        dark_start: false,
        maintenance: false
      },
      tank_profile: {
        ...defaultEngineSetup.tank_profile,
        tank_volume_l_gross: 6
      }
    },
    targets: {
      temperature: { min: 22.0, max: 24.0 },
      pH: { min: 6.4, max: 7.8 },
      ammonia: 0.0,
      nitrite: 0.0,
      nitrate: { min: 5.0, max: 30.0 },
      gh: { min: 5.0, max: 7.0 },
      kh: { min: 2.0, max: 4.0 }
    }
  });

  const hydrateTank = (raw: Partial<AquariumState> = {}): AquariumState => {
    const base = createSeedTank();
    const safeEngineSetup = (raw.engineSetup && typeof raw.engineSetup === 'object') ? raw.engineSetup : {};
    const rawWaterProfile = (safeEngineSetup as AquariumState['engineSetup'])?.water_source_profile;
    const wcValue = Array.isArray(rawWaterProfile?.weekly_water_change_percent_target)
      ? rawWaterProfile?.weekly_water_change_percent_target?.[0]
      : rawWaterProfile?.weekly_water_change_percent_target;
    return {
      ...base,
      ...raw,
      id: raw.id || base.id,
      reminderSettings: { ...base.reminderSettings, ...raw.reminderSettings },
      engineSetup: {
        ...defaultEngineSetup,
        ...safeEngineSetup,
        user_preferences: {
          ...defaultEngineSetup.user_preferences,
          ...(safeEngineSetup as AquariumState['engineSetup'])?.user_preferences
        },
        protocol_preferences: {
          ...defaultEngineSetup.protocol_preferences,
          ...(safeEngineSetup as AquariumState['engineSetup'])?.protocol_preferences
        },
        protocol_overrides: {
          ...defaultEngineSetup.protocol_overrides,
          ...(safeEngineSetup as AquariumState['engineSetup'])?.protocol_overrides
        },
        tank_profile: {
          ...defaultEngineSetup.tank_profile,
          ...(safeEngineSetup as AquariumState['engineSetup'])?.tank_profile,
          substrate: {
            ...defaultEngineSetup.tank_profile.substrate,
            ...(safeEngineSetup as AquariumState['engineSetup'])?.tank_profile?.substrate
          },
          hardscape: {
            ...defaultEngineSetup.tank_profile.hardscape,
            ...(safeEngineSetup as AquariumState['engineSetup'])?.tank_profile?.hardscape
          },
          filtration: {
            ...defaultEngineSetup.tank_profile.filtration,
            ...(safeEngineSetup as AquariumState['engineSetup'])?.tank_profile?.filtration
          },
          co2: {
            ...defaultEngineSetup.tank_profile.co2,
            ...(safeEngineSetup as AquariumState['engineSetup'])?.tank_profile?.co2
          }
        },
        water_source_profile: {
          ...defaultEngineSetup.water_source_profile,
          ...(safeEngineSetup as AquariumState['engineSetup'])?.water_source_profile,
          weekly_water_change_percent_target: wcValue ?? defaultEngineSetup.water_source_profile.weekly_water_change_percent_target
        },
        biology_profile: {
          ...defaultEngineSetup.biology_profile,
          ...(safeEngineSetup as AquariumState['engineSetup'])?.biology_profile,
          plants: {
            ...defaultEngineSetup.biology_profile.plants,
            ...(safeEngineSetup as AquariumState['engineSetup'])?.biology_profile?.plants
          },
          livestock_plan: {
            ...defaultEngineSetup.biology_profile.livestock_plan,
            ...(safeEngineSetup as AquariumState['engineSetup'])?.biology_profile?.livestock_plan
          },
          livestock_traits: {
            ...defaultEngineSetup.biology_profile.livestock_traits,
            ...(safeEngineSetup as AquariumState['engineSetup'])?.biology_profile?.livestock_traits
          }
        },
        testing: {
          ...defaultEngineSetup.testing,
          ...(safeEngineSetup as AquariumState['engineSetup'])?.testing
        },
        product_stack: {
          ...defaultEngineSetup.product_stack,
          ...(safeEngineSetup as AquariumState['engineSetup'])?.product_stack,
          ammonia_source: {
            ...defaultEngineSetup.product_stack.ammonia_source,
            ...(safeEngineSetup as AquariumState['engineSetup'])?.product_stack?.ammonia_source
          },
          user_products: (() => {
            const stored = (safeEngineSetup as AquariumState['engineSetup'])?.product_stack?.user_products;
            if (!Array.isArray(stored)) return defaultEngineSetup.product_stack.user_products;
            return defaultEngineSetup.product_stack.user_products.map(defaultProduct => {
              const match = stored.find(item => item.role === defaultProduct.role);
              return match ? { ...defaultProduct, ...match } : defaultProduct;
            });
          })()
        }
      }
    };
  };

  const [tankStore, setTankStore] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.tanks)) {
          const tanks = parsed.tanks.map((tank) => hydrateTank(tank));
          if (!tanks.length) {
            const tank = createSeedTank();
            return { tanks: [tank], activeTankId: tank.id };
          }
          const activeTankId = tanks.some(tank => tank.id === parsed.activeTankId)
            ? parsed.activeTankId
            : tanks[0]?.id;
          return { tanks, activeTankId };
        }
        if (parsed?.tankName && Array.isArray(parsed?.logs)) {
          const tank = hydrateTank(parsed);
          return { tanks: [tank], activeTankId: tank.id };
        }
      } catch (e) {
        console.error("Failed to load saved aquarium data", e);
      }
    }

    const tank = createSeedTank();
    return { tanks: [tank], activeTankId: tank.id };
  });

  const tanks = tankStore.tanks;
  const activeTankId = tankStore.activeTankId;
  const aquarium = (tanks.find(tank => tank.id === activeTankId) ?? tanks[0])!;

  const setAquarium = (updater: ((prev: AquariumState) => AquariumState) | AquariumState) => {
    setTankStore(prev => ({
      ...prev,
      tanks: prev.tanks.map(tank => {
        if (tank.id !== prev.activeTankId) return tank;
        return typeof updater === 'function' ? updater(tank) : { ...tank, ...updater };
      })
    }));
  };

  const setActiveTankId = (id: string) => {
    setTankStore(prev => ({ ...prev, activeTankId: id }));
  };

  const addTank = () => {
    const newTank = createEmptyTank();
    setTankStore(prev => ({
      tanks: [...prev.tanks, newTank],
      activeTankId: newTank.id
    }));
    setActiveTab('settings');
    setActiveSetupSection('tank');
  };

  const getTankLabel = (tank: AquariumState, index: number) =>
    tank.tankName?.trim() ? tank.tankName : `Tank ${index + 1}`;

  const deleteActiveTank = () => {
    setTankStore(prev => {
      const remaining = prev.tanks.filter(tank => tank.id !== prev.activeTankId);
      if (!remaining.length) {
        const tank = createEmptyTank();
        return { tanks: [tank], activeTankId: tank.id };
      }
      return { tanks: remaining, activeTankId: remaining[0].id };
    });
    setShowDeleteTankModal(false);
  };

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tankStore));
  }, [tankStore]);

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationStatus(Notification.permission);
    }
  }, []);

  const protocolPlan = useMemo(() => {
    try {
      return generatePlan({
        setup: aquarium.engineSetup,
        productCatalog,
        enginePackage,
        protocolRuleset,
        userTargets: aquarium.targets,
        overrideAcknowledged: true
      });
    } catch (error) {
      console.error('Failed to generate protocol plan', error);
      return null;
    }
  }, [aquarium.engineSetup]);

  const recommendedProtocolPlan = useMemo(() => {
    try {
      const baselineSetup = {
        ...aquarium.engineSetup,
        user_preferences: {
          ...aquarium.engineSetup.user_preferences,
          cycling_mode_preference: 'auto',
          dark_start: 'auto'
        }
      };
      return generatePlan({
        setup: baselineSetup,
        productCatalog,
        enginePackage,
        protocolRuleset,
        userTargets: aquarium.targets,
        overrideAcknowledged: true
      });
    } catch (error) {
      console.error('Failed to generate recommended protocol plan', error);
      return null;
    }
  }, [aquarium.engineSetup, aquarium.targets]);

  const playlistPlan = useMemo(() => {
    try {
      return generatePhasesFromPlaylists({
        setup: aquarium.engineSetup,
        productCatalog,
        enginePackage,
        phasePlaylists,
        atomLibrary,
        userTargets: aquarium.targets
      });
    } catch (error) {
      console.error('Failed to generate playlist phases', error);
      return null;
    }
  }, [aquarium.engineSetup, aquarium.targets]);

  const manualPhases = useMemo(() => {
    if (playlistPlan?.phases?.length) {
      return playlistPlan.phases.map(phase => ({
        id: phase.phase_id,
        name: phase.phase_name,
        instructions: phase.instruction_atoms.map(atom => atom.text),
        expected: phase.expected_behavior_atoms || [],
        tasks: phase.task_atoms || [],
        exitChecks: [],
        objectives: [],
        icon: '🫧'
      }));
    }
    if (protocolPlan?.phases?.length) {
      return protocolPlan.phases.map(phase => ({
        id: phase.phase_id,
        name: phase.phase_name,
        instructions: phase.instruction_atoms.map(atom => atom.text),
        expected: phase.expected_behavior_atoms || [],
        tasks: [],
        exitChecks: phase.exit_checks || [],
        objectives: (phase.objective_ids || []).map(formatDisplayValue),
        icon: '🫧'
      }));
    }
    return PHASES;
  }, [protocolPlan, playlistPlan]);

  const handleToggleTask = (id: string) => {
    setAquarium(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    }));
  };

  const handleAddLog = (newLogData: Omit<WaterLog, 'id'>) => {
    if (editingLog) {
      setAquarium(prev => ({
        ...prev,
        logs: prev.logs.map(l => l.id === editingLog.id ? { ...newLogData, id: editingLog.id } : l)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      }));
      setEditingLog(null);
    } else {
      const logWithId: WaterLog = {
        ...newLogData,
        id: Math.random().toString(36).substr(2, 9)
      };
      setAquarium(prev => ({
        ...prev,
        logs: [...prev.logs, logWithId].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      }));
    }
    setActiveTab('dashboard');
  };

  const handleDeleteLog = (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      setAquarium(prev => ({
        ...prev,
        logs: prev.logs.filter(l => l.id !== id)
      }));
    }
  };

  const updateTarget = (key: keyof AquariumState['targets'], field: 'min' | 'max' | 'val', value: number) => {
    setAquarium(prev => {
      const newTargets = { ...prev.targets };
      if (key === 'ammonia' || key === 'nitrite') {
        (newTargets[key] as number) = value;
      } else {
        (newTargets[key] as ParameterRange)[field as 'min' | 'max'] = value;
      }
      return { ...prev, targets: newTargets };
    });
  };

  const updateReminder = (field: keyof ReminderSettings, value: any) => {
    setAquarium(prev => ({
      ...prev,
      reminderSettings: {
        ...prev.reminderSettings,
        [field]: value
      }
    }));

    if (field === 'enabled' && value === true) {
      requestNotificationPermission();
    }
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationStatus(permission);
    if (permission === 'granted') {
      new Notification("AquaTrack Reminders Enabled", {
        body: "We'll ping you about unfinished tasks on your scheduled days.",
        icon: "/favicon.ico"
      });
    }
  };

  const updateEngineSetup = (updater: (prevSetup: EngineSetup) => EngineSetup) => {
    setAquarium(prev => ({
      ...prev,
      engineSetup: updater(prev.engineSetup)
    }));
  };

  const parseCsvList = (value: string) =>
    value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

  const formatCsvList = (values: string[]) => values.join(', ');

  const sanitizeDecimalInput = (value: string) => {
    const normalized = value.replace(/,/g, '.').replace(/\s+/g, '');
    let cleaned = '';
    let hasDot = false;
    for (const char of normalized) {
      if (char >= '0' && char <= '9') {
        cleaned += char;
        continue;
      }
      if (char === '.' && !hasDot) {
        cleaned += char;
        hasDot = true;
      }
    }
    return cleaned;
  };

  const [setupDrafts, setSetupDrafts] = useState<Record<string, string>>({});

  const getSetupDraftValue = (key: string, fallback: number | string | undefined) => {
    if (Object.prototype.hasOwnProperty.call(setupDrafts, key)) {
      return setupDrafts[key];
    }
    return fallback === undefined || fallback === null ? '' : String(fallback);
  };

  const commitSetupDraftNumber = (
    key: string,
    rawValue: string,
    onCommit: (value: number) => void
  ) => {
    const cleaned = sanitizeDecimalInput(rawValue);
    setSetupDrafts(prev => ({ ...prev, [key]: cleaned }));
    if (cleaned === '') return;
    const parsed = parseFloat(cleaned);
    if (!Number.isNaN(parsed)) {
      onCommit(parsed);
    }
  };

  const clearSetupDraft = (key: string) => {
    setSetupDrafts(prev => {
      if (!Object.prototype.hasOwnProperty.call(prev, key)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const parseNumber = (value: string, fallback = 0) => {
    const normalized = value.replace(',', '.').trim();
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  const parseOptionalNumber = (value: string) => {
    const normalized = value.replace(',', '.').trim();
    if (!normalized) return null;
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const targetSpreads: Record<'temperature' | 'pH' | 'nitrate' | 'gh' | 'kh', number> = {
    temperature: 1,
    pH: 0.3,
    nitrate: 10,
    gh: 1,
    kh: 1
  };

  const getTargetCenter = (range: ParameterRange) => (range.min + range.max) / 2;

  const updateTargetCenter = (key: keyof typeof targetSpreads, value: number) => {
    const spread = targetSpreads[key];
    setAquarium(prev => ({
      ...prev,
      targets: {
        ...prev.targets,
        [key]: {
          min: value - spread,
          max: value + spread
        }
      }
    }));
  };

  const addLivestock = (key: keyof AquariumState['engineSetup']['biology_profile']['livestock_plan'], name: string) => {
    if (!name) return;
    updateEngineSetup(prev => {
      const list = prev.biology_profile.livestock_plan[key];
      if (list.includes(name)) return prev;
      const nextLivestock = {
        ...prev.biology_profile.livestock_plan,
        [key]: [...list, name]
      };
      const nextTraits = deriveLivestockTraits(nextLivestock.fish, nextLivestock.shrimp);
      return {
        ...prev,
        biology_profile: {
          ...prev.biology_profile,
          livestock_plan: nextLivestock,
          livestock_traits: nextTraits
        }
      };
    });
  };

  const removeLivestock = (key: keyof AquariumState['engineSetup']['biology_profile']['livestock_plan'], name: string) => {
    updateEngineSetup(prev => {
      const nextLivestock = {
        ...prev.biology_profile.livestock_plan,
        [key]: prev.biology_profile.livestock_plan[key].filter(item => item !== name)
      };
      const nextTraits = deriveLivestockTraits(nextLivestock.fish, nextLivestock.shrimp);
      return {
        ...prev,
        biology_profile: {
          ...prev.biology_profile,
          livestock_plan: nextLivestock,
          livestock_traits: nextTraits
        }
      };
    });
  };

  useEffect(() => {
    const { fish, shrimp } = aquarium.engineSetup.biology_profile.livestock_plan;
    const nextTraits = deriveLivestockTraits(fish, shrimp);
    const currentTraits = aquarium.engineSetup.biology_profile.livestock_traits;
    if (
      currentTraits.is_sensitive !== nextTraits.is_sensitive
      || currentTraits.has_diggers !== nextTraits.has_diggers
    ) {
      updateEngineSetup(prev => ({
        ...prev,
        biology_profile: {
          ...prev.biology_profile,
          livestock_traits: nextTraits
        }
      }));
    }
  }, [
    aquarium.engineSetup.biology_profile.livestock_plan.fish,
    aquarium.engineSetup.biology_profile.livestock_plan.shrimp
  ]);

  const addPlant = (name: string) => {
    if (!name) return;
    updateEngineSetup(prev => {
      const list = prev.biology_profile.plants.species;
      if (list.includes(name)) return prev;
      const nextSpecies = [...list, name];
      const nextDemand = getPlantDemandClass(nextSpecies);
      return {
        ...prev,
        biology_profile: {
          ...prev.biology_profile,
          plants: {
            ...prev.biology_profile.plants,
            species: nextSpecies,
            demand_class: nextDemand
          }
        }
      };
    });
  };

  const removePlant = (name: string) => {
    updateEngineSetup(prev => {
      const nextSpecies = prev.biology_profile.plants.species.filter(item => item !== name);
      const nextDemand = getPlantDemandClass(nextSpecies);
      return {
        ...prev,
        biology_profile: {
          ...prev.biology_profile,
          plants: {
            ...prev.biology_profile.plants,
            species: nextSpecies,
            demand_class: nextDemand
          }
        }
      };
    });
  };

  const compatibilityWarnings = (() => {
    const allSpecies = [
      ...aquarium.engineSetup.biology_profile.livestock_plan.fish,
      ...aquarium.engineSetup.biology_profile.livestock_plan.shrimp
    ];
    const warnings = [];
    for (let i = 0; i < allSpecies.length; i += 1) {
      for (let j = i + 1; j < allSpecies.length; j += 1) {
        const a = allSpecies[i];
        const b = allSpecies[j];
        const reqA = getRequirementRanges(a);
        const reqB = getRequirementRanges(b);
        if (!reqA || !reqB) continue;
        const incompatible =
          !rangesOverlap(reqA.temperature_c, reqB.temperature_c) ||
          !rangesOverlap(reqA.ph, reqB.ph) ||
          !rangesOverlap(reqA.gh_dgh, reqB.gh_dgh) ||
          !rangesOverlap(reqA.kh_dkh, reqB.kh_dkh);
        if (incompatible) {
          warnings.push(`${a} ↔ ${b}`);
        }
      }
    }
    return warnings;
  })();

  const recommendedWaterTargets = (() => {
    const allSpecies = [
      ...aquarium.engineSetup.biology_profile.livestock_plan.fish,
      ...aquarium.engineSetup.biology_profile.livestock_plan.shrimp
    ];
    const requirements = allSpecies.map(name => getRequirementRanges(name)).filter(Boolean);
    if (!requirements.length) return null;
    const temperatureRange = intersectRange(requirements.map(req => req.temperature_c));
    const phRange = intersectRange(requirements.map(req => req.ph));
    const ghRange = intersectRange(requirements.map(req => req.gh_dgh));
    const khRange = intersectRange(requirements.map(req => req.kh_dkh));
    return {
      temperature: { range: temperatureRange, mean: meanRange(temperatureRange) },
      pH: { range: phRange, mean: meanRange(phRange) },
      gh: { range: ghRange, mean: meanRange(ghRange) },
      kh: { range: khRange, mean: meanRange(khRange) }
    };
  })();

  const recommendedPlantGuidance = (() => {
    const selectedPlants = aquarium.engineSetup.biology_profile.plants.species;
    const plantGroups = selectedPlants
      .map(name => plantSpeciesIndex.get(name)?.group)
      .filter(Boolean);
    if (!plantGroups.length) return null;
    const lightOptions = intersectSets(plantGroups.map(group => group.typical_requirements.light || []));
    const co2Options = intersectSets(plantGroups.map(group => group.typical_requirements.co2 || []));
    const growthRates = Array.from(new Set(plantGroups.map(group => group.typical_requirements.growth_rate).filter(Boolean)));
    const growthRate = growthRates.length === 1 ? growthRates[0] : 'mixed';
    return { lightOptions, co2Options, growthRate };
  })();

  const activePhaseData = useMemo(() => {
    const fromManual = manualPhases.find(p => p.id === aquarium.currentPhase);
    if (fromManual) return fromManual;
    return PHASES.find(p => p.id === aquarium.currentPhase) || PHASES[0];
  }, [aquarium.currentPhase, manualPhases]);

  const protocolDiscrepancies = useMemo(() => {
    const issues: Array<{ title: string; detail: string }> = [];
    const fmt = (value: number) => Number.isFinite(value) ? value.toFixed(1) : '--';
    const tapKh = aquarium.engineSetup.water_source_profile.tap_kh_dkh;
    const tapGh = aquarium.engineSetup.water_source_profile.tap_gh_dgh;
    const tapPh = aquarium.engineSetup.water_source_profile.tap_ph;
    const targetKh = (aquarium.targets.kh.min + aquarium.targets.kh.max) / 2;
    const targetGh = (aquarium.targets.gh.min + aquarium.targets.gh.max) / 2;
    const targetPh = (aquarium.targets.pH.min + aquarium.targets.pH.max) / 2;
    const targetTemp = (aquarium.targets.temperature.min + aquarium.targets.temperature.max) / 2;
    const khBufferEnabled = aquarium.engineSetup.product_stack.user_products.some(
      (product) => (product.role === 'kh_buffer' || product.role === 'gh_kh_remineralizer') && product.enabled
    );
    const ghRemineralizerEnabled = aquarium.engineSetup.product_stack.user_products.some(
      (product) => (product.role === 'gh_remineralizer' || product.role === 'gh_kh_remineralizer') && product.enabled
    );
    const co2Enabled = aquarium.engineSetup.tank_profile.co2.enabled;
    const photoperiodInitial = aquarium.engineSetup.user_preferences.photoperiod_hours_initial;
    const waterChangePercent = aquarium.engineSetup.water_source_profile.weekly_water_change_percent_target;

    if (tapKh === null || tapKh === undefined) {
      issues.push({
        title: 'Tap KH missing',
        detail: 'Test tap KH before finalizing KH targets and dosing.'
      });
    } else if (targetKh > tapKh + 0.5 && !khBufferEnabled) {
      issues.push({
        title: 'KH gap detected',
        detail: `Tap KH is ${fmt(tapKh)} dKH but target KH is ${fmt(targetKh)} dKH. Add a KH buffer or lower the target.`
      });
    }

    if (targetGh > tapGh + 0.5 && !ghRemineralizerEnabled) {
      issues.push({
        title: 'GH gap detected',
        detail: `Tap GH is ${fmt(tapGh)} dGH but target GH is ${fmt(targetGh)} dGH. Add a GH remineralizer or lower the target.`
      });
    }

    const effectiveCyclingMode =
      aquarium.engineSetup.user_preferences.cycling_mode_preference === 'auto'
        ? protocolPlan?.selection?.recommended_cycling_mode
        : aquarium.engineSetup.user_preferences.cycling_mode_preference;
    if (effectiveCyclingMode === 'fishless_ammonia') {
      const ammoniaEnabled = aquarium.engineSetup.product_stack.user_products.some(
        (product) => product.role === 'ammonia_source' && product.enabled
      );
      if (!ammoniaEnabled) {
        issues.push({
          title: 'Ammonia source missing',
          detail: 'Fishless cycling needs an ammonia source. Enable one or switch cycling mode.'
        });
      }
    }

    const bacteriaEnabled = aquarium.engineSetup.product_stack.user_products.some(
      (product) => product.role === 'bacteria_starter' && product.enabled
    );
    if (!bacteriaEnabled) {
      if (effectiveCyclingMode === 'fishless_ammonia') {
        issues.push({
          title: 'Bacteria starter recommended',
          detail: 'Fishless cycling is much faster with a bacteria starter. Without it, cycling can take significantly longer.'
        });
      } else if (effectiveCyclingMode === 'fish_in') {
        issues.push({
          title: 'Bacteria starter strongly recommended',
          detail: 'Fish-in cycling is safer with a bacteria starter to reduce ammonia spikes.'
        });
      } else if (effectiveCyclingMode === 'plant_assisted') {
        issues.push({
          title: 'Bacteria starter recommended',
          detail: 'Plant-assisted cycling can still benefit from bacteria starter to stabilize the biofilter.'
        });
      }
    }

    if (recommendedWaterTargets?.temperature?.range) {
      const [min, max] = recommendedWaterTargets.temperature.range;
      if (targetTemp < min || targetTemp > max) {
        issues.push({
          title: 'Temperature target mismatch',
          detail: `Selected target ${fmt(targetTemp)} C is outside the species range (${fmt(min)}–${fmt(max)} C).`
        });
      }
    }

    if (recommendedWaterTargets?.pH?.range) {
      const [min, max] = recommendedWaterTargets.pH.range;
      if (targetPh < min || targetPh > max) {
        issues.push({
          title: 'pH target mismatch',
          detail: `Selected target ${fmt(targetPh)} is outside the species range (${fmt(min)}–${fmt(max)}).`
        });
      }
    }

    if (recommendedWaterTargets?.gh?.range) {
      const [min, max] = recommendedWaterTargets.gh.range;
      if (targetGh < min || targetGh > max) {
        issues.push({
          title: 'GH target mismatch',
          detail: `Selected target ${fmt(targetGh)} dGH is outside the species range (${fmt(min)}–${fmt(max)} dGH).`
        });
      }
    }

    if (recommendedWaterTargets?.kh?.range) {
      const [min, max] = recommendedWaterTargets.kh.range;
      if (targetKh < min || targetKh > max) {
        issues.push({
          title: 'KH target mismatch',
          detail: `Selected target ${fmt(targetKh)} dKH is outside the species range (${fmt(min)}–${fmt(max)} dKH).`
        });
      }
    }

    if (!co2Enabled && targetPh < tapPh - 0.4) {
      issues.push({
        title: 'pH drop without CO2',
        detail: `Target pH ${fmt(targetPh)} is much lower than tap pH ${fmt(tapPh)}. Consider CO2 or raise the target.`
      });
    }

    if (Math.abs(targetPh - tapPh) >= 0.5) {
      issues.push({
        title: 'pH gap detected',
        detail: `Target pH ${fmt(targetPh)} differs from tap pH ${fmt(tapPh)} by ${fmt(Math.abs(targetPh - tapPh))}. Plan for buffering, RO mixing, or CO2 to avoid swings.`
      });
    }

    if (recommendedPlantGuidance?.co2Options?.includes('required') && !co2Enabled) {
      issues.push({
        title: 'CO2 recommended for plants',
        detail: 'Selected plants benefit from CO2. Enable CO2 or adjust plant selection.'
      });
    }

    if (aquarium.engineSetup.biology_profile.plants.demand_class === 'high' && photoperiodInitial < 6) {
      issues.push({
        title: 'Low photoperiod for high demand plants',
        detail: 'High demand plants typically need a longer photoperiod. Consider 7–8 hours or adjust plant demand.'
      });
    }

    if (aquarium.engineSetup.biology_profile.plants.demand_class === 'low' && photoperiodInitial > 9) {
      issues.push({
        title: 'High photoperiod for low demand plants',
        detail: 'Long photoperiods can increase algae risk with low demand plants.'
      });
    }

    if (waterChangePercent < 10) {
      issues.push({
        title: 'Low water change volume',
        detail: 'Weekly water change under 10% may be insufficient for stability.'
      });
    }

    if (waterChangePercent > 60) {
      issues.push({
        title: 'High water change volume',
        detail: 'Weekly water change over 60% can cause parameter swings.'
      });
    }

    if (typeof recommendedProtocolPlan?.selection?.recommended_dark_start === 'boolean'
      && aquarium.engineSetup.user_preferences.dark_start !== 'auto'
      && aquarium.engineSetup.user_preferences.dark_start !== recommendedProtocolPlan.selection.recommended_dark_start) {
      issues.push({
        title: 'Dark start override',
        detail: recommendedProtocolPlan.selection.recommended_dark_start
          ? 'Dark start is recommended to reduce early algae risk. Turning it off may increase algae blooms.'
          : 'Dark start is not recommended for this setup. Enabling it may slow early plant adaptation.'
      });
    }

    if (recommendedProtocolPlan?.selection?.recommended_cycling_mode
      && aquarium.engineSetup.user_preferences.cycling_mode_preference !== 'auto'
      && aquarium.engineSetup.user_preferences.cycling_mode_preference !== recommendedProtocolPlan.selection.recommended_cycling_mode) {
      issues.push({
        title: 'Cycling mode override',
        detail: `Recommended mode is ${formatDisplayValue(recommendedProtocolPlan.selection.recommended_cycling_mode)}. Overriding can increase cycle instability risk.`
      });
    }

    return issues;
  }, [aquarium, recommendedWaterTargets, recommendedPlantGuidance, protocolPlan, recommendedProtocolPlan]);

  const applyRecommendedWaterTargets = () => {
    if (!recommendedWaterTargets) return;
    if (recommendedWaterTargets.temperature.mean !== null) {
      updateTargetCenter('temperature', recommendedWaterTargets.temperature.mean);
    }
    if (recommendedWaterTargets.pH.mean !== null) {
      updateTargetCenter('pH', recommendedWaterTargets.pH.mean);
    }
    if (recommendedWaterTargets.gh.mean !== null) {
      updateTargetCenter('gh', recommendedWaterTargets.gh.mean);
    }
    if (recommendedWaterTargets.kh.mean !== null) {
      updateTargetCenter('kh', recommendedWaterTargets.kh.mean);
    }
  };

  const productDefinitions = [
    { role: 'gh_remineralizer', label: 'GH Remineralizer', defaultUnit: 'g', effectLabel: 'Δ GH' },
    { role: 'kh_buffer', label: 'KH Buffer', defaultUnit: 'g', effectLabel: 'Δ KH' },
    { role: 'gh_kh_remineralizer', label: 'GH/KH Remineralizer', defaultUnit: 'g' },
    { role: 'bacteria_starter', label: 'Bacteria Starter', defaultUnit: 'mL' },
    { role: 'fertilizer_micros', label: 'Fertilizer (Micros)', defaultUnit: 'mL' },
    { role: 'ammonia_source', label: 'Ammonia Source', defaultUnit: 'mL', effectLabel: 'Δ Ammonia' },
    { role: 'detoxifier_conditioner', label: 'Detoxifier/Conditioner', defaultUnit: 'mL' },
    { role: 'water_clarifier', label: 'Water Clarifier', defaultUnit: 'mL' },
    { role: 'water_quality_support', label: 'Water Quality Support', defaultUnit: 'mL' }
  ] as const;

  const updateProduct = (role: EngineSetup['product_stack']['user_products'][number]['role'], updater: (product: EngineSetup['product_stack']['user_products'][number]) => EngineSetup['product_stack']['user_products'][number]) => {
    updateEngineSetup(prev => ({
      ...prev,
      product_stack: {
        ...prev.product_stack,
        user_products: prev.product_stack.user_products.map(product =>
          product.role === role ? updater(product) : product
        )
      }
    }));
  };

  const setGhKhCombo = (enabled: boolean) => {
    const comboTemplate = defaultEngineSetup.product_stack.user_products.find(
      (product) => product.role === 'gh_kh_remineralizer'
    );
    updateEngineSetup(prev => ({
      ...prev,
      product_stack: {
        ...prev.product_stack,
        user_products: (() => {
          let foundCombo = false;
          const updated = prev.product_stack.user_products.map(product => {
            if (product.role === 'gh_kh_remineralizer') {
              foundCombo = true;
              return { ...product, enabled };
            }
            if (product.role === 'gh_remineralizer' || product.role === 'kh_buffer') {
              return { ...product, enabled: enabled ? false : product.enabled };
            }
            return product;
          });
          if (!foundCombo && comboTemplate) {
            updated.push({ ...comboTemplate, enabled });
          }
          return updated;
        })()
      }
    }));
  };

  const resetAllData = () => {
    if (confirm("WARNING: This will delete all your logs and reset the tank to defaults. This cannot be undone. Proceed?")) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  const generateProtocolTasks = () => {
    const planPhases = playlistPlan?.phases?.length ? playlistPlan.phases : protocolPlan?.phases;
    if (!planPhases?.length) return;
    const tasks: Task[] = [];
    const normalizeCadence = (cadence: string) => {
      if (cadence === 'one_time') return 'one-time';
      if (cadence === 'daily' || cadence === 'weekly' || cadence === 'monthly' || cadence === 'interval') return cadence;
      return 'one-time';
    };
    planPhases.forEach((phase) => {
      const phaseId = phase.phase_id;
      const taskAtoms = phase.task_atoms || [];
      taskAtoms.forEach((taskAtom) => {
        if (!taskAtom?.cadence || !taskAtom.text) return;
        const frequency = normalizeCadence(taskAtom.cadence);
        const everyDays = taskAtom.every_days ?? taskAtom.everyDays;
        const isOneTime = frequency === 'one-time';
        tasks.push({
          id: `${phaseId}_${taskAtom.cadence}_${tasks.length}`,
          phaseId: isOneTime ? (phaseId as PhaseId) : undefined,
          startPhaseId: isOneTime ? undefined : (phaseId as PhaseId),
          endPhaseId: isOneTime ? undefined : ((taskAtom.until_phase_id as PhaseId) || (phaseId as PhaseId)),
          frequency,
          everyDays: frequency === 'interval' ? Number(everyDays || 0) || undefined : undefined,
          title: taskAtom.text,
          completed: false
        });
      });
    });

    setAquarium(prev => ({
      ...prev,
      tasks,
      currentPhase: (planPhases?.[0]?.phase_id as PhaseId) || prev.currentPhase
    }));
    setActiveTab('roadmap');
  };

  const latestLog = aquarium.logs[aquarium.logs.length - 1] || {} as WaterLog;
  const currentPhDrop = latestLog.degassedPH && latestLog.pH ? (latestLog.degassedPH - latestLog.pH) : null;
  const fmtTarget = (value: number | undefined, digits = 1) => (
    Number.isFinite(value) ? Number(value).toFixed(digits) : '--'
  );

  const getStatusColor = (id: string, value: number | undefined) => {
    if (value === undefined) return 'text-slate-400';
    const targets = aquarium.targets;
    const isCycling = ['phase_1_initial_start_day_0', 'phase_2_first_week_days_1_7', 'phase_3_active_cycling_weeks_2_4', 'phase_4_cycle_complete_week_4_5'].includes(aquarium.currentPhase);

    switch(id) {
      case 'temperature':
        return (value >= targets.temperature.min && value <= targets.temperature.max) ? 'text-emerald-400' : 'text-red-400';
      case 'pH':
        return (value >= targets.pH.min && value <= targets.pH.max) ? 'text-emerald-400' : 'text-amber-400';
      case 'ammonia':
        if (isCycling) return value <= 3.0 ? 'text-slate-300' : 'text-red-400';
        return value <= targets.ammonia ? 'text-emerald-400' : 'text-red-400';
      case 'nitrite':
        if (isCycling) return 'text-slate-300';
        return value <= targets.nitrite ? 'text-emerald-400' : 'text-red-400';
      case 'nitrate':
        return (value >= targets.nitrate.min && value <= targets.nitrate.max) ? 'text-emerald-400' : 'text-amber-400';
      case 'hardness':
        const ghOk = (latestLog.gh || 0) >= targets.gh.min && (latestLog.gh || 0) <= targets.gh.max;
        const khOk = (latestLog.kh || 0) >= targets.kh.min && (latestLog.kh || 0) <= targets.kh.max;
        return (ghOk && khOk) ? 'text-emerald-400' : 'text-red-400';
      case 'co2':
        if (currentPhDrop === null) return 'text-slate-500';
        return (currentPhDrop >= 0.8 && currentPhDrop <= 1.2) ? 'text-emerald-400' : 'text-amber-400';
      default:
        return 'text-slate-300';
    }
  };

  const stats = [
    { 
      id: 'temperature', 
      label: 'Temp', 
      value: `${latestLog.temperature || '--'}°C`, 
      paramValue: latestLog.temperature,
      note: `Target Range: ${fmtTarget(aquarium.targets.temperature.min)}–${fmtTarget(aquarium.targets.temperature.max)}°C.\nShort excursions of ±0.5 °C are acceptable.`
    },
    { 
      id: 'pH', 
      label: 'pH', 
      value: `${latestLog.pH || '--'}`, 
      paramValue: latestLog.pH,
      note: `Target Range: ${fmtTarget(aquarium.targets.pH.min, 2)}–${fmtTarget(aquarium.targets.pH.max, 2)}.\nTarget Drop: ~1.0 unit (Degassed minus CO2-on). Latest pH drop: ${currentPhDrop !== null ? currentPhDrop.toFixed(2) : '--'}`
    },
    { 
      id: 'nitrate', 
      label: 'NO₃', 
      subLabel: 'Nitrate',
      value: `${latestLog.nitrate ?? '--'}`, 
      paramValue: latestLog.nitrate,
      note: `Recommended Range: ${fmtTarget(aquarium.targets.nitrate.min)}–${fmtTarget(aquarium.targets.nitrate.max)} ppm.`
    },
    { 
      id: 'ammonia', 
      label: 'NH₃', 
      subLabel: 'Ammonia',
      value: `${latestLog.ammonia ?? '--'}`, 
      paramValue: latestLog.ammonia,
      note: `Max target: ${fmtTarget(aquarium.targets.ammonia, 2)} ppm (post-cycle should be 0).`
    },
    { 
      id: 'nitrite', 
      label: 'NO₂', 
      subLabel: 'Nitrite',
      value: `${latestLog.nitrite ?? '--'}`, 
      paramValue: latestLog.nitrite,
      note: `Max target: ${fmtTarget(aquarium.targets.nitrite, 2)} ppm (post-cycle should be 0).`
    },
    { 
      id: 'hardness', 
      label: 'GH/KH', 
      value: `${latestLog.gh ?? '--'}/${latestLog.kh ?? '--'}`, 
      paramValue: latestLog.gh,
      note: `GH Target: ${fmtTarget(aquarium.targets.gh.min)}–${fmtTarget(aquarium.targets.gh.max)}.\nKH Target: ${fmtTarget(aquarium.targets.kh.min)}–${fmtTarget(aquarium.targets.kh.max)}.`
    },
  ];

  const toggleHighlight = (id: string) => {
    setHighlightedParam(prev => prev === id ? null : id);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="px-4 pt-4 flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-extrabold text-white mb-1">Status</h1>
                <p className="text-slate-400 text-sm font-medium">{aquarium.tankName} • {aquarium.tankSize}L</p>
              </div>
              <div className="flex gap-2 relative">
                {aquarium.reminderSettings.enabled && (
                  <div className="bg-slate-900/80 p-2 rounded-2xl border border-slate-800 flex items-center justify-center">
                    <BellRing className="w-4 h-4 text-emerald-400 animate-pulse" />
                  </div>
                )}
                <button 
                  onClick={() => setShowTankSwitcher(value => !value)}
                  className="bg-slate-900/80 p-2 rounded-2xl border border-slate-800 flex items-center gap-2 active:scale-95 transition-all"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                </button>
                {showTankSwitcher && (
                  <div className="absolute right-0 top-12 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-3 w-56 z-50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 pb-2">Tanks</p>
                    <div className="space-y-1 max-h-56 overflow-y-auto no-scrollbar pb-2">
                      {tanks.map((tank, index) => (
                        <button
                          key={tank.id}
                          onClick={() => {
                            setActiveTankId(tank.id);
                            setShowTankSwitcher(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-2xl text-xs font-semibold border transition-colors ${
                            tank.id === activeTankId
                              ? 'bg-slate-100 text-slate-950 border-slate-100'
                              : 'bg-slate-800/60 text-slate-300 border-slate-800'
                          }`}
                        >
                          {getTankLabel(tank, index)}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        addTank();
                        setShowTankSwitcher(false);
                      }}
                      className="w-full mt-2 px-3 py-2 rounded-2xl text-xs font-bold bg-slate-100 text-slate-950 shadow-lg shadow-white/5"
                    >
                      Add New
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 px-4">
              {stats.map((stat) => {
                const colorClass = getStatusColor(stat.id, stat.paramValue);
                const isWarning = colorClass === 'text-red-400' || colorClass === 'text-amber-400';
                
                return (
                  <div key={stat.id} className="relative group">
                    <button 
                      onClick={() => toggleHighlight(stat.id)}
                      className={`w-full bg-slate-900/50 border p-3 pt-4 rounded-2xl square-btn flex flex-col justify-center items-center text-center transition-all active:scale-95 overflow-hidden min-h-[85px] ${
                        highlightedParam === stat.id 
                        ? 'border-slate-300 bg-slate-300/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]' 
                        : 'border-slate-800'
                      }`}
                    >
                      
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{stat.label}</span>
                        {stat.subLabel && <span className="text-[7px] font-bold text-slate-500 uppercase -mt-0.5 mb-1">{stat.subLabel}</span>}
                      </div>
                      <p className={`text-[14px] font-bold mt-auto ${colorClass}`}>{stat.value}</p>
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setInfoModal({ title: stat.label + (stat.subLabel ? ` (${stat.subLabel})` : ''), content: stat.note });
                      }}
                      className={`absolute top-1.5 right-1.5 p-1 bg-slate-800 rounded-full border border-slate-700 ${isWarning ? colorClass : 'text-slate-500'} hover:text-white transition-colors z-10`}
                    >
                      <Info className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="px-4">
              <WaterParameterChart data={aquarium.logs} highlightedParam={highlightedParam} targets={aquarium.targets} />
            </div>

            <div className="px-4 pb-24">
               <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <div className="bg-slate-100/10 p-2 rounded-xl">
                      {activePhaseData.id === 'phase_co2_trimming' ? <Wind className="w-5 h-5 text-slate-300" /> : <Droplets className="w-5 h-5 text-slate-300" />}
                     </div>
                     <div>
                       <h3 className="font-bold text-white text-sm">{activePhaseData.name.split(' (')[0]}</h3>
                       <p className="text-[10px] text-slate-400">Current Phase Guidance</p>
                     </div>
                   </div>
                   <button 
                    onClick={() => setShowPhasePicker(true)}
                    className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
                   >
                     <Layers className="w-4 h-4" />
                   </button>
                 </div>
                 
                 <div className="space-y-2">
                    {activePhaseData.objectives.slice(0, 3).map((obj, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{obj}</span>
                      </div>
                    ))}
                 </div>

                 <div className="grid grid-cols-2 gap-2">
                   <button 
                    onClick={() => setActiveTab('roadmap')}
                    className="py-3 bg-slate-800 text-slate-300 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 border border-slate-700 active:scale-95"
                   >
                     Full Manual
                   </button>
                   <button 
                    onClick={() => setActiveTab('logs')}
                    className="py-3 bg-slate-100 text-slate-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-white/5"
                   >
                     Log Progress <ChevronRight className="w-4 h-4" />
                   </button>
                 </div>
               </div>
            </div>
          </div>
        );
      case 'logs':
        return (
          <div className="px-4 space-y-6 pb-24 animate-in fade-in duration-300 pt-4">
            <div className="flex justify-between items-end">
              <h1 className="text-3xl font-extrabold text-white">Entry</h1>
              {editingLog && (
                <button 
                  onClick={() => setEditingLog(null)}
                  className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            
            <LogForm onAdd={handleAddLog} initialData={editingLog || undefined} />
            
            <div className="space-y-4 mt-8">
              <div className="flex items-center gap-2 px-1">
                <History className="w-4 h-4 text-slate-500" />
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">History</h2>
              </div>
              
              <div className="space-y-3">
                {[...aquarium.logs].reverse().map(log => (
                  <div key={log.id} className="bg-slate-900/40 border border-slate-800/60 p-4 rounded-2xl flex items-center justify-between group">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500">{new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <div className="flex gap-3 items-center">
                        <span className="text-xs font-bold text-white">NH₃: {log.ammonia}</span>
                        <span className="text-[8px] text-slate-600">•</span>
                        <span className="text-xs font-bold text-white">NO₂: {log.nitrite}</span>
                        <span className="text-[8px] text-slate-600">•</span>
                        <span className="text-xs font-bold text-white">pH: {log.pH}</span>
                        {log.bubbleRate && (
                          <>
                            <span className="text-[8px] text-slate-600">•</span>
                            <span className="text-xs font-bold text-slate-300">CO2: {log.bubbleRate}bps</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setEditingLog(log); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="p-2.5 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteLog(log.id)}
                        className="p-2.5 bg-red-900/10 rounded-xl text-red-500 hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'roadmap':
        return (
          <div className="px-4 space-y-6 pb-24 animate-in fade-in duration-300 pt-4">
             <h1 className="text-3xl font-extrabold text-white">Manual</h1>
             
             <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
               {manualPhases.map(phase => (
                 <button 
                  key={phase.id}
                  onClick={() => setAquarium(prev => ({...prev, currentPhase: phase.id as PhaseId}))}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 border flex items-center gap-2 ${
                    aquarium.currentPhase === phase.id 
                    ? 'bg-slate-100 border-slate-100 text-slate-950 shadow-lg shadow-white/5' 
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                 >
                   {phase.name.split(' — ')[0]}
                   {aquarium.currentPhase === phase.id && <div className="w-1.5 h-1.5 bg-slate-950 rounded-full animate-pulse" />}
                 </button>
               ))}
             </div>

             <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-5 space-y-4">
               <h3 className="text-sm font-bold text-white flex items-center gap-2">
                 <span className="text-lg">{manualPhases.find(p => p.id === aquarium.currentPhase)?.icon}</span> 
                 {manualPhases.find(p => p.id === aquarium.currentPhase)?.name}
               </h3>
               
               <div className="space-y-3">
                 <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Instructions</h4>
                 <ul className="space-y-2 manual-list">
                   {manualPhases.find(p => p.id === aquarium.currentPhase)?.instructions.map((ins, i) => (
                     <li key={i} className="text-xs text-slate-300 leading-relaxed flex gap-2">
                       <span className="text-slate-400 font-bold">•</span>
                       <span>{renderBoldText(ins)}</span>
                     </li>
                   ))}
                 </ul>
               </div>

               <div className="pt-4 border-t border-slate-800 space-y-3">
                 <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Expected Normal Behavior</h4>
                 <ul className="space-y-2 manual-list">
                   {manualPhases.find(p => p.id === aquarium.currentPhase)?.expected.map((exp, i) => (
                     <li key={i} className="text-xs text-slate-400 italic flex gap-2">
                       <span className="text-slate-600 shrink-0">→</span>
                       <span>{renderBoldText(exp)}</span>
                     </li>
                   ))}
                 </ul>
               </div>

               {manualPhases.find(p => p.id === aquarium.currentPhase)?.exitChecks?.length > 0 && (
                 <div className="pt-4 border-t border-slate-800 space-y-3">
                   <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phase Complete When</h4>
                   <ul className="space-y-2">
                     {manualPhases.find(p => p.id === aquarium.currentPhase)?.exitChecks.map((check, i) => (
                       <li key={i} className="text-xs text-slate-300 leading-relaxed flex gap-2">
                         <span className="text-slate-400 font-bold">•</span> {check}
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
             </div>

             <Checklist 
              tasks={aquarium.tasks} 
              activePhase={aquarium.currentPhase} 
              onToggle={handleToggleTask}
              phaseOrder={manualPhases.map(phase => phase.id as PhaseId)}
             />
          </div>
        );
      case 'settings':
        const reminderInputClasses = "w-full bg-slate-800 border border-slate-700 h-14 rounded-2xl text-xs text-white outline-none focus:ring-2 focus:ring-slate-400 transition-all appearance-none cursor-pointer";
        const setupInputClasses = "w-full bg-slate-800 border border-slate-700 p-3.5 rounded-2xl text-xs text-white outline-none focus:ring-2 focus:ring-slate-500";
        const setupLabelClasses = "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1";
        const setupSections = [
          { id: 'tank', label: 'Tank' },
          { id: 'biology', label: 'Biology' },
          { id: 'water', label: 'Water' },
          { id: 'preferences', label: 'Preferences' },
          { id: 'products', label: 'Products' },
          { id: 'protocol', label: 'Protocol' },
          { id: 'alerts', label: 'Alerts' },
          { id: 'data', label: 'Data' }
        ] as const;
        const protocolPreferenceItems = [
          { key: 'cycling', label: 'Cycling' },
          { key: 'maintenance', label: 'Maintenance' },
          { key: 'stocking', label: 'Stocking' },
          { key: 'plant_care', label: 'Plant Care' },
          { key: 'alerts', label: 'Alerts' },
          { key: 'emergency', label: 'Emergency' }
        ] as const;

        return (
          <div className="px-4 space-y-6 pb-24 animate-in fade-in duration-300 pt-4">
            <h1 className="text-3xl font-extrabold text-white">Setup</h1>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {setupSections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSetupSection(section.id)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 border ${
                    activeSetupSection === section.id
                      ? 'bg-slate-100 border-slate-100 text-slate-950 shadow-lg shadow-white/5'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>

            {activeSetupSection === 'tank' && (
              <div className="space-y-6">
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">Tank Identity</label>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Tank Name"
                        value={aquarium.tankName}
                        onChange={e => setAquarium(prev => ({...prev, tankName: e.target.value}))}
                        className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-xs text-white outline-none focus:ring-2 focus:ring-slate-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Tank Properties</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className={setupLabelClasses}>Gross Volume (L)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={getSetupDraftValue('tank_volume_l_gross', aquarium.engineSetup.tank_profile.tank_volume_l_gross)}
                        onChange={e => commitSetupDraftNumber('tank_volume_l_gross', e.target.value, (value) => {
                          updateEngineSetup(prev => ({
                            ...prev,
                            tank_profile: { ...prev.tank_profile, tank_volume_l_gross: value }
                          }));
                        })}
                        onBlur={() => {
                          const draftValue = setupDrafts.tank_volume_l_gross;
                          const parsed = draftValue ? parseFloat(draftValue) : aquarium.engineSetup.tank_profile.tank_volume_l_gross;
                          setAquarium(prev => ({
                            ...prev,
                            tankSize: Number.isNaN(parsed) ? prev.tankSize : parsed
                          }));
                          clearSetupDraft('tank_volume_l_gross');
                        }}
                        className={setupInputClasses}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={setupLabelClasses}>Net Volume Method</label>
                      <select
                        value={aquarium.engineSetup.tank_profile.net_volume_method}
                        onChange={e => updateEngineSetup(prev => ({
                          ...prev,
                          tank_profile: { ...prev.tank_profile, net_volume_method: e.target.value as EngineSetup['tank_profile']['net_volume_method'] }
                        }))}
                        className={`${setupInputClasses} appearance-none`}
                      >
                        <option value="estimate_multiplier">Estimate</option>
                        <option value="explicit">Explicit</option>
                      </select>
                    </div>
                  </div>
                  {aquarium.engineSetup.tank_profile.net_volume_method === 'explicit' && (
                    <div className="space-y-1.5">
                      <label className={setupLabelClasses}>Net Water Volume (L)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={getSetupDraftValue('net_water_volume_l', aquarium.engineSetup.tank_profile.net_water_volume_l)}
                        onChange={e => {
                          const cleaned = sanitizeDecimalInput(e.target.value);
                          setSetupDrafts(prev => ({ ...prev, net_water_volume_l: cleaned }));
                          if (cleaned === '') {
                            updateEngineSetup(prev => ({
                              ...prev,
                              tank_profile: { ...prev.tank_profile, net_water_volume_l: undefined }
                            }));
                            return;
                          }
                          const parsed = parseFloat(cleaned);
                          if (!Number.isNaN(parsed)) {
                            updateEngineSetup(prev => ({
                              ...prev,
                              tank_profile: { ...prev.tank_profile, net_water_volume_l: parsed }
                            }));
                          }
                        }}
                        onBlur={() => clearSetupDraft('net_water_volume_l')}
                        className={setupInputClasses}
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className={setupLabelClasses}>Substrate</label>
                      <select
                        value={aquarium.engineSetup.tank_profile.substrate.type}
                        onChange={e => updateEngineSetup(prev => ({
                          ...prev,
                          tank_profile: {
                            ...prev.tank_profile,
                            substrate: { ...prev.tank_profile.substrate, type: e.target.value as EngineSetup['tank_profile']['substrate']['type'] }
                          }
                        }))}
                        className={`${setupInputClasses} appearance-none`}
                      >
                        <option value="inert">Inert</option>
                        <option value="aquasoil">Aquasoil</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className={setupLabelClasses}>Hardscape</label>
                      <select
                        value={aquarium.engineSetup.tank_profile.hardscape.type}
                        onChange={e => updateEngineSetup(prev => ({
                          ...prev,
                          tank_profile: {
                            ...prev.tank_profile,
                            hardscape: { ...prev.tank_profile.hardscape, type: e.target.value as EngineSetup['tank_profile']['hardscape']['type'] }
                          }
                        }))}
                        className={`${setupInputClasses} appearance-none`}
                      >
                        <option value="wood">Wood</option>
                        <option value="stone">Stone</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={setupLabelClasses}>CO2 Enabled</label>
                      <button
                        onClick={() => updateEngineSetup(prev => ({
                          ...prev,
                          tank_profile: { ...prev.tank_profile, co2: { ...prev.tank_profile.co2, enabled: !prev.tank_profile.co2.enabled } }
                        }))}
                        className={`w-full py-3 rounded-2xl border text-xs font-bold ${aquarium.engineSetup.tank_profile.co2.enabled ? 'bg-slate-100 text-slate-950 border-slate-100' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                      >
                        {aquarium.engineSetup.tank_profile.co2.enabled ? 'On' : 'Off'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className={setupLabelClasses}>Lighting System</label>
                      <select
                        value={aquarium.engineSetup.tank_profile.lighting_system}
                        onChange={e => updateEngineSetup(prev => ({
                          ...prev,
                          tank_profile: { ...prev.tank_profile, lighting_system: e.target.value as EngineSetup['tank_profile']['lighting_system'] }
                        }))}
                        className={`${setupInputClasses} appearance-none`}
                      >
                        <option value="basic">Basic</option>
                        <option value="dedicated">Dedicated</option>
                        <option value="high_performance">High Performance</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={setupLabelClasses}>Heater Installed</label>
                      <button
                        onClick={() => updateEngineSetup(prev => ({
                          ...prev,
                          tank_profile: { ...prev.tank_profile, heater_installed: !prev.tank_profile.heater_installed }
                        }))}
                        className={`w-full py-3 rounded-2xl border text-xs font-bold ${aquarium.engineSetup.tank_profile.heater_installed ? 'bg-slate-100 text-slate-950 border-slate-100' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                      >
                        {aquarium.engineSetup.tank_profile.heater_installed ? 'On' : 'Off'}
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {activeSetupSection === 'water' && (
              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Water Properties</h3>
                  </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={setupLabelClasses}>Tap pH</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={getSetupDraftValue('tap_ph', aquarium.engineSetup.water_source_profile.tap_ph)}
                      onChange={e => commitSetupDraftNumber('tap_ph', e.target.value, (value) => {
                        updateEngineSetup(prev => ({
                          ...prev,
                          water_source_profile: { ...prev.water_source_profile, tap_ph: value }
                        }));
                      })}
                      onBlur={() => clearSetupDraft('tap_ph')}
                      className={setupInputClasses}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={setupLabelClasses}>Tap GH (dGH)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={getSetupDraftValue('tap_gh_dgh', aquarium.engineSetup.water_source_profile.tap_gh_dgh)}
                      onChange={e => commitSetupDraftNumber('tap_gh_dgh', e.target.value, (value) => {
                        updateEngineSetup(prev => ({
                          ...prev,
                          water_source_profile: { ...prev.water_source_profile, tap_gh_dgh: value }
                        }));
                      })}
                      onBlur={() => clearSetupDraft('tap_gh_dgh')}
                      className={setupInputClasses}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={setupLabelClasses}>Tap KH (dKH)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={getSetupDraftValue('tap_kh_dkh', aquarium.engineSetup.water_source_profile.tap_kh_dkh)}
                      onChange={e => commitSetupDraftNumber('tap_kh_dkh', e.target.value, (value) => {
                        updateEngineSetup(prev => ({
                          ...prev,
                          water_source_profile: { ...prev.water_source_profile, tap_kh_dkh: value }
                        }));
                      })}
                      onBlur={() => clearSetupDraft('tap_kh_dkh')}
                      className={setupInputClasses}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={setupLabelClasses}>Water Change %</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={getSetupDraftValue('weekly_wc_percent', aquarium.engineSetup.water_source_profile.weekly_water_change_percent_target)}
                      onChange={e => commitSetupDraftNumber('weekly_wc_percent', e.target.value, (value) => {
                        updateEngineSetup(prev => ({
                          ...prev,
                          water_source_profile: {
                            ...prev.water_source_profile,
                            weekly_water_change_percent_target: value
                          }
                        }));
                      })}
                      onBlur={() => clearSetupDraft('weekly_wc_percent')}
                      className={setupInputClasses}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className={setupLabelClasses}>Tap Ammonia (ppm)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={getSetupDraftValue('tap_ammonia_ppm', aquarium.engineSetup.water_source_profile.tap_ammonia_ppm)}
                        onChange={e => commitSetupDraftNumber('tap_ammonia_ppm', e.target.value, (value) => {
                          updateEngineSetup(prev => ({
                            ...prev,
                            water_source_profile: { ...prev.water_source_profile, tap_ammonia_ppm: value }
                          }));
                        })}
                        onBlur={() => clearSetupDraft('tap_ammonia_ppm')}
                        className={setupInputClasses}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={setupLabelClasses}>Disinfectant</label>
                      <select
                        value={aquarium.engineSetup.water_source_profile.disinfectant}
                        onChange={e => updateEngineSetup(prev => ({
                          ...prev,
                          water_source_profile: { ...prev.water_source_profile, disinfectant: e.target.value as EngineSetup['water_source_profile']['disinfectant'] }
                        }))}
                        className={`${setupInputClasses} appearance-none`}
                      >
                        <option value="unknown">Unknown</option>
                        <option value="none">None</option>
                        <option value="chlorine">Chlorine</option>
                        <option value="chloramine">Chloramine</option>
                      </select>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Targets</h4>
                    <Target className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'temperature', label: 'Temp Target (°C)', key: 'temperature', step: 0.1 },
                      { id: 'pH', label: 'pH Target', key: 'pH', step: 0.1 },
                      { id: 'nitrate', label: 'Nitrate Target (ppm)', key: 'nitrate', step: 1 },
                      { id: 'gh', label: 'GH Target (dGH)', key: 'gh', step: 0.1 },
                      { id: 'kh', label: 'KH Target (dKH)', key: 'kh', step: 0.1 }
                    ].map(target => (
                      <div key={target.id} className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block ml-1">{target.label}</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={getSetupDraftValue(`target_${target.key}`, getTargetCenter(aquarium.targets[target.key as keyof typeof aquarium.targets] as ParameterRange))}
                          onChange={e => commitSetupDraftNumber(`target_${target.key}`, e.target.value, (value) => {
                            updateTargetCenter(target.key as keyof typeof targetSpreads, value);
                          })}
                          onBlur={() => clearSetupDraft(`target_${target.key}`)}
                          className="w-full bg-slate-800/50 border border-slate-700 p-3 rounded-xl text-xs text-white outline-none"
                        />
                        <span className="text-[9px] text-slate-500 ml-1">
                          Range: {(aquarium.targets[target.key as keyof typeof aquarium.targets] as ParameterRange).min.toFixed(1)}–{(aquarium.targets[target.key as keyof typeof aquarium.targets] as ParameterRange).max.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block ml-1">Ammonia Max</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={getSetupDraftValue('target_ammonia', aquarium.targets.ammonia)}
                        onChange={e => commitSetupDraftNumber('target_ammonia', e.target.value, (value) => {
                          updateTarget('ammonia', 'val', value);
                        })}
                        onBlur={() => clearSetupDraft('target_ammonia')}
                        className="w-full bg-slate-800/50 border border-slate-700 p-3 rounded-xl text-xs text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block ml-1">Nitrite Max</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={getSetupDraftValue('target_nitrite', aquarium.targets.nitrite)}
                        onChange={e => commitSetupDraftNumber('target_nitrite', e.target.value, (value) => {
                          updateTarget('nitrite', 'val', value);
                        })}
                        onBlur={() => clearSetupDraft('target_nitrite')}
                        className="w-full bg-slate-800/50 border border-slate-700 p-3 rounded-xl text-xs text-white outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSetupSection === 'biology' && (
              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Biology</h3>
                </div>
                {compatibilityWarnings.length > 0 && (
                  <div className="bg-amber-950/30 border border-amber-800/40 p-3 rounded-2xl text-[10px] text-amber-300">
                    <strong className="font-bold">Potential incompatibilities:</strong> {compatibilityWarnings.join(', ')}.
                  </div>
                )}
                <div className="space-y-2">
                  <label className={setupLabelClasses}>Fish</label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <select
                      value={selectedFishToAdd}
                      onChange={e => setSelectedFishToAdd(e.target.value)}
                      className={`${setupInputClasses} appearance-none`}
                    >
                      {fishOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => addLivestock('fish', selectedFishToAdd)}
                      className="px-4 rounded-2xl bg-slate-100 text-slate-950 text-xs font-bold"
                    >
                      Add
                    </button>
                  </div>
                  {aquarium.engineSetup.biology_profile.livestock_plan.fish.length > 0 && (
                    <div className="tag-list pt-1">
                      {aquarium.engineSetup.biology_profile.livestock_plan.fish.map(name => (
                        <button
                          key={name}
                          onClick={() => removeLivestock('fish', name)}
                          className="tag-pill"
                        >
                          <span>{name}</span>
                          <span className="tag-pill__remove">×</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className={setupLabelClasses}>Shrimp</label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <select
                      value={selectedShrimpToAdd}
                      onChange={e => setSelectedShrimpToAdd(e.target.value)}
                      className={`${setupInputClasses} appearance-none`}
                    >
                      {shrimpOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => addLivestock('shrimp', selectedShrimpToAdd)}
                      className="px-4 rounded-2xl bg-slate-100 text-slate-950 text-xs font-bold"
                    >
                      Add
                    </button>
                  </div>
                  {aquarium.engineSetup.biology_profile.livestock_plan.shrimp.length > 0 && (
                    <div className="tag-list pt-1">
                      {aquarium.engineSetup.biology_profile.livestock_plan.shrimp.map(name => (
                        <button
                          key={name}
                          onClick={() => removeLivestock('shrimp', name)}
                          className="tag-pill"
                        >
                          <span>{name}</span>
                          <span className="tag-pill__remove">×</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className={setupLabelClasses}>Plants</label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <select
                      value={selectedPlantToAdd}
                      onChange={e => setSelectedPlantToAdd(e.target.value)}
                      className={`${setupInputClasses} appearance-none`}
                    >
                      {plantOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => addPlant(selectedPlantToAdd)}
                      className="px-4 rounded-2xl bg-slate-100 text-slate-950 text-xs font-bold"
                    >
                      Add
                    </button>
                  </div>
                  {aquarium.engineSetup.biology_profile.plants.species.length > 0 && (
                    <div className="tag-list pt-1">
                      {aquarium.engineSetup.biology_profile.plants.species.map(name => (
                        <button
                          key={name}
                          onClick={() => removePlant(name)}
                          className="tag-pill"
                        >
                          <span>{name}</span>
                          <span className="tag-pill__remove">×</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className={setupLabelClasses}>Plant Density</label>
                  <select
                    value={aquarium.engineSetup.biology_profile.plants.density}
                    onChange={e => updateEngineSetup(prev => ({
                      ...prev,
                      biology_profile: {
                        ...prev.biology_profile,
                        plants: { ...prev.biology_profile.plants, density: e.target.value as EngineSetup['biology_profile']['plants']['density'] }
                      }
                    }))}
                    className={`${setupInputClasses} appearance-none`}
                  >
                    <option value="none">None</option>
                    <option value="sparse">Sparse</option>
                    <option value="moderate">Moderate</option>
                    <option value="heavy">Heavy</option>
                  </select>
                </div>
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Recommended Targets</h4>
                  </div>
                  {recommendedWaterTargets ? (
                    <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-300">
                      <div>
                        <span className="text-slate-500">Temp:</span>{' '}
                        {recommendedWaterTargets.temperature.range
                          ? `${recommendedWaterTargets.temperature.range[0]}–${recommendedWaterTargets.temperature.range[1]} C (target ${recommendedWaterTargets.temperature.mean?.toFixed(1)} C)`
                          : 'No overlap'}
                      </div>
                      <div>
                        <span className="text-slate-500">pH:</span>{' '}
                        {recommendedWaterTargets.pH.range
                          ? `${recommendedWaterTargets.pH.range[0]}–${recommendedWaterTargets.pH.range[1]} (target ${recommendedWaterTargets.pH.mean?.toFixed(2)})`
                          : 'No overlap'}
                      </div>
                      <div>
                        <span className="text-slate-500">GH:</span>{' '}
                        {recommendedWaterTargets.gh.range
                          ? `${recommendedWaterTargets.gh.range[0]}–${recommendedWaterTargets.gh.range[1]} dGH (target ${recommendedWaterTargets.gh.mean?.toFixed(1)} dGH)`
                          : 'No overlap'}
                      </div>
                      <div>
                        <span className="text-slate-500">KH:</span>{' '}
                        {recommendedWaterTargets.kh.range
                          ? `${recommendedWaterTargets.kh.range[0]}–${recommendedWaterTargets.kh.range[1]} dKH (target ${recommendedWaterTargets.kh.mean?.toFixed(1)} dKH)`
                          : 'No overlap'}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">Add fish or shrimp to see recommended water targets.</p>
                  )}
                  {recommendedPlantGuidance ? (
                    <div className="text-[11px] text-slate-300 space-y-1">
                      <div>
                        <span className="text-slate-500">Light:</span>{' '}
                        {recommendedPlantGuidance.lightOptions.length
                          ? recommendedPlantGuidance.lightOptions.map(formatDisplayValue).join(', ')
                          : 'No overlap'}
                      </div>
                      <div>
                        <span className="text-slate-500">CO2:</span>{' '}
                        {recommendedPlantGuidance.co2Options.length
                          ? recommendedPlantGuidance.co2Options.map(formatDisplayValue).join(', ')
                          : 'No overlap'}
                      </div>
                      <div>
                        <span className="text-slate-500">Growth Rate:</span> {formatDisplayValue(recommendedPlantGuidance.growthRate)}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">Add plants to see light and CO2 guidance.</p>
                  )}
                  <div className="pt-2 flex justify-center">
                    <button
                      onClick={applyRecommendedWaterTargets}
                      disabled={!recommendedWaterTargets}
                      className={`px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                        recommendedWaterTargets
                          ? 'bg-slate-100 text-slate-950 border-slate-100'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}
                    >
                      Export to Water
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3" />
                </div>
              </div>
            )}

            {activeSetupSection === 'preferences' && (
              <div className="space-y-5">
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Preferences</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className={setupLabelClasses}>Risk Tolerance</label>
                      <select
                        value={aquarium.engineSetup.user_preferences.risk_tolerance}
                        onChange={e => updateEngineSetup(prev => ({
                          ...prev,
                          user_preferences: { ...prev.user_preferences, risk_tolerance: e.target.value as EngineSetup['user_preferences']['risk_tolerance'] }
                        }))}
                        className={`${setupInputClasses} appearance-none`}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={setupLabelClasses}>Goal Profile</label>
                      <select
                        value={aquarium.engineSetup.user_preferences.goal_profile}
                        onChange={e => updateEngineSetup(prev => ({
                          ...prev,
                          user_preferences: { ...prev.user_preferences, goal_profile: e.target.value as EngineSetup['user_preferences']['goal_profile'] }
                        }))}
                        className={`${setupInputClasses} appearance-none`}
                      >
                        <option value="stability_first">Stability First</option>
                        <option value="growth_first">Growth First</option>
                        <option value="balanced">Balanced</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className={setupLabelClasses}>Units</label>
                        <select
                          value={aquarium.engineSetup.user_preferences.units}
                          onChange={e => updateEngineSetup(prev => ({
                            ...prev,
                            user_preferences: { ...prev.user_preferences, units: e.target.value as EngineSetup['user_preferences']['units'] }
                          }))}
                          className={`${setupInputClasses} appearance-none`}
                        >
                          <option value="metric">Metric</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className={setupLabelClasses}>Photoperiod Start</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={getSetupDraftValue('photoperiod_hours_initial', aquarium.engineSetup.user_preferences.photoperiod_hours_initial)}
                          onChange={e => commitSetupDraftNumber('photoperiod_hours_initial', e.target.value, (value) => {
                            updateEngineSetup(prev => ({
                              ...prev,
                              user_preferences: { ...prev.user_preferences, photoperiod_hours_initial: value }
                            }));
                          })}
                          onBlur={() => clearSetupDraft('photoperiod_hours_initial')}
                          className={setupInputClasses}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={setupLabelClasses}>Photoperiod Post</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={getSetupDraftValue('photoperiod_hours_post_cycle', aquarium.engineSetup.user_preferences.photoperiod_hours_post_cycle)}
                          onChange={e => commitSetupDraftNumber('photoperiod_hours_post_cycle', e.target.value, (value) => {
                            updateEngineSetup(prev => ({
                              ...prev,
                              user_preferences: { ...prev.user_preferences, photoperiod_hours_post_cycle: value }
                            }));
                          })}
                          onBlur={() => clearSetupDraft('photoperiod_hours_post_cycle')}
                          className={setupInputClasses}
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {activeSetupSection === 'products' && (
              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Products</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 border border-slate-800 rounded-full px-3 py-2">
                      <span>Remineralizer Mode</span>
                      <div className="grid grid-cols-2 gap-1 bg-slate-950/40 p-1 rounded-full border border-slate-800">
                        <button
                          onClick={() => setGhKhCombo(true)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            aquarium.engineSetup.product_stack.user_products.some(
                              (product) => product.role === 'gh_kh_remineralizer' && product.enabled
                            )
                              ? 'bg-slate-100 text-slate-950'
                              : 'text-slate-400'
                          }`}
                        >
                          GH/KH
                        </button>
                        <button
                          onClick={() => setGhKhCombo(false)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            aquarium.engineSetup.product_stack.user_products.some(
                              (product) => product.role === 'gh_kh_remineralizer' && product.enabled
                            )
                              ? 'text-slate-400'
                              : 'bg-slate-100 text-slate-950'
                          }`}
                        >
                          GH + KH
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">Choose either the combo remineralizer or separate GH + KH products.</p>
                  </div>
                  {productDefinitions.filter(def => {
                    const comboEnabled = aquarium.engineSetup.product_stack.user_products.some(
                      (product) => product.role === 'gh_kh_remineralizer' && product.enabled
                    );
                    if (comboEnabled) {
                      return def.role !== 'gh_remineralizer' && def.role !== 'kh_buffer';
                    }
                    return def.role !== 'gh_kh_remineralizer';
                  }).map(def => {
                    const product = aquarium.engineSetup.product_stack.user_products.find(item => item.role === def.role);
                    if (!product) return null;
                    const hasEffect = Boolean(def.effectLabel)
                      && def.role !== 'ammonia_source'
                      && !(def.role === 'kh_buffer' && product.bicarbonate)
                      && !(def.role === 'ammonia_source' && product.pure_ammonia);
                    const isKhBuffer = def.role === 'kh_buffer';
                    const isCombo = def.role === 'gh_kh_remineralizer';
                    const useBicarbonate = isKhBuffer && product.bicarbonate;
                    const isAmmonia = def.role === 'ammonia_source';
                    const usePureAmmonia = isAmmonia && product.pure_ammonia;
                    const bicarbonatePreset = {
                      name: 'Bicarbonate (NaHCO₃)',
                      dose_amount: 0.03,
                      dose_unit: 'g',
                      per_volume_l: 1,
                      effect_value: 1
                    };
                    return (
                      <div key={def.role} className="border border-slate-800 rounded-3xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{def.label}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest">{def.role.replace('_', ' ')}</p>
                          </div>
                          <button
                            onClick={() => updateProduct(def.role, current => ({ ...current, enabled: !current.enabled }))}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                              product.enabled
                                ? 'bg-slate-100 text-slate-950 border-slate-100'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {product.enabled ? 'Using' : 'Off'}
                          </button>
                        </div>
                        {product.enabled && (
                          <>
                            {isCombo && (
                              <>
                                <div className="space-y-1.5">
                                  <label className={setupLabelClasses}>Name</label>
                                  <input
                                    type="text"
                                    value={product.name}
                                    onChange={e => updateProduct(def.role, current => ({ ...current, name: e.target.value }))}
                                    className={setupInputClasses}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1.5">
                                    <label className={setupLabelClasses}>Dose</label>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={getSetupDraftValue(`product_${def.role}_dose_amount`, product.dose_amount)}
                                      onChange={e => commitSetupDraftNumber(`product_${def.role}_dose_amount`, e.target.value, (value) => {
                                        updateProduct(def.role, current => ({ ...current, dose_amount: value }));
                                      })}
                                      onBlur={() => clearSetupDraft(`product_${def.role}_dose_amount`)}
                                      className={setupInputClasses}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className={setupLabelClasses}>Unit</label>
                                    <select
                                      value={product.dose_unit}
                                      onChange={e => updateProduct(def.role, current => ({ ...current, dose_unit: e.target.value as EngineSetup['product_stack']['user_products'][number]['dose_unit'] }))}
                                      className={`${setupInputClasses} appearance-none`}
                                    >
                                      <option value="g">g</option>
                                      <option value="mL">mL</option>
                                      <option value="drops">drops</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1.5">
                                    <label className={setupLabelClasses}>Per L (GH)</label>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={getSetupDraftValue(`product_${def.role}_per_volume_l_gh`, product.per_volume_l_gh ?? 0)}
                                      onChange={e => commitSetupDraftNumber(`product_${def.role}_per_volume_l_gh`, e.target.value, (value) => {
                                        updateProduct(def.role, current => ({ ...current, per_volume_l_gh: value }));
                                      })}
                                      onBlur={() => clearSetupDraft(`product_${def.role}_per_volume_l_gh`)}
                                      className={setupInputClasses}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className={setupLabelClasses}>Δ GH</label>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={getSetupDraftValue(`product_${def.role}_effect_value_gh`, product.effect_value_gh ?? 0)}
                                      onChange={e => commitSetupDraftNumber(`product_${def.role}_effect_value_gh`, e.target.value, (value) => {
                                        updateProduct(def.role, current => ({ ...current, effect_value_gh: value }));
                                      })}
                                      onBlur={() => clearSetupDraft(`product_${def.role}_effect_value_gh`)}
                                      className={setupInputClasses}
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1.5">
                                    <label className={setupLabelClasses}>Per L (KH)</label>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={getSetupDraftValue(`product_${def.role}_per_volume_l_kh`, product.per_volume_l_kh ?? 0)}
                                      onChange={e => commitSetupDraftNumber(`product_${def.role}_per_volume_l_kh`, e.target.value, (value) => {
                                        updateProduct(def.role, current => ({ ...current, per_volume_l_kh: value }));
                                      })}
                                      onBlur={() => clearSetupDraft(`product_${def.role}_per_volume_l_kh`)}
                                      className={setupInputClasses}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className={setupLabelClasses}>Δ KH</label>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={getSetupDraftValue(`product_${def.role}_effect_value_kh`, product.effect_value_kh ?? 0)}
                                      onChange={e => commitSetupDraftNumber(`product_${def.role}_effect_value_kh`, e.target.value, (value) => {
                                        updateProduct(def.role, current => ({ ...current, effect_value_kh: value }));
                                      })}
                                      onBlur={() => clearSetupDraft(`product_${def.role}_effect_value_kh`)}
                                      className={setupInputClasses}
                                    />
                                  </div>
                                </div>
                              </>
                            )}
                            {isKhBuffer && (
                              <div className="flex items-center justify-between text-[10px] text-slate-400 border border-slate-800 rounded-full px-3 py-2">
                                <span>Use Bicarbonate</span>
                                <button
                                  onClick={() => updateProduct(def.role, current => ({
                                    ...current,
                                    bicarbonate: !current.bicarbonate,
                                    name: !current.bicarbonate ? bicarbonatePreset.name : current.name,
                                    dose_amount: !current.bicarbonate ? bicarbonatePreset.dose_amount : current.dose_amount,
                                    dose_unit: !current.bicarbonate ? bicarbonatePreset.dose_unit : current.dose_unit,
                                    per_volume_l: !current.bicarbonate ? bicarbonatePreset.per_volume_l : current.per_volume_l,
                                    effect_value: !current.bicarbonate ? bicarbonatePreset.effect_value : current.effect_value
                                  }))}
                                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                    product.bicarbonate
                                      ? 'bg-slate-100 text-slate-950 border-slate-100'
                                      : 'bg-slate-800 text-slate-400 border-slate-700'
                                  }`}
                                >
                                  {product.bicarbonate ? 'On' : 'Off'}
                                </button>
                              </div>
                            )}
                            {isAmmonia && (
                              <div className="flex items-center justify-between text-[10px] text-slate-400 border border-slate-800 rounded-full px-3 py-2">
                                <span>Pure Ammonia</span>
                                <button
                                  onClick={() => updateProduct(def.role, current => ({
                                    ...current,
                                    pure_ammonia: !current.pure_ammonia,
                                    name: !current.pure_ammonia ? 'Ammonia' : current.name
                                  }))}
                                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                    product.pure_ammonia
                                      ? 'bg-slate-100 text-slate-950 border-slate-100'
                                      : 'bg-slate-800 text-slate-400 border-slate-700'
                                  }`}
                                >
                                  {product.pure_ammonia ? 'On' : 'Off'}
                                </button>
                              </div>
                            )}
                            {useBicarbonate && (
                              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                                <div>
                                  <span className="text-slate-500">Name:</span> {bicarbonatePreset.name}
                                </div>
                                <div>
                                  <span className="text-slate-500">Dose:</span> {bicarbonatePreset.dose_amount} {bicarbonatePreset.dose_unit} / {bicarbonatePreset.per_volume_l} L
                                </div>
                                <div>
                                  <span className="text-slate-500">Δ KH:</span> {bicarbonatePreset.effect_value} dKH
                                </div>
                              </div>
                            )}
                            {!isCombo && !useBicarbonate && !usePureAmmonia && (
                              <div className="space-y-1.5">
                                <label className={setupLabelClasses}>Name</label>
                                <input
                                  type="text"
                                  value={product.name}
                                  onChange={e => updateProduct(def.role, current => ({ ...current, name: e.target.value }))}
                                  className={setupInputClasses}
                                />
                              </div>
                            )}
                            {usePureAmmonia && (
                              <div className="space-y-1.5">
                                <label className={setupLabelClasses}>Concentration %</label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={getSetupDraftValue(`product_${def.role}_ammonia_solution_percent`, product.ammonia_solution_percent ?? 10)}
                                  onChange={e => commitSetupDraftNumber(`product_${def.role}_ammonia_solution_percent`, e.target.value, (value) => {
                                    updateProduct(def.role, current => ({ ...current, ammonia_solution_percent: value }));
                                  })}
                                  onBlur={() => clearSetupDraft(`product_${def.role}_ammonia_solution_percent`)}
                                  className={setupInputClasses}
                                />
                                <p className="text-[11px] text-slate-400">
                                  1 ppm per L ≈ {(() => {
                                    const percent = product.ammonia_solution_percent ?? 10;
                                    const ppmPerMlPerL = 200 * (percent / 10);
                                    const mlPerL = ppmPerMlPerL ? 1 / ppmPerMlPerL : 0;
                                    return `${mlPerL.toFixed(4)} mL/L`;
                                  })()}
                                </p>
                              </div>
                            )}
                            {!isCombo && !useBicarbonate && !usePureAmmonia && (
                              <div className={`grid gap-2 ${hasEffect ? 'grid-cols-4' : 'grid-cols-3'}`}>
                                <div className="space-y-1.5">
                                  <label className={setupLabelClasses}>Dose</label>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={getSetupDraftValue(`product_${def.role}_dose_amount`, product.dose_amount)}
                                    onChange={e => commitSetupDraftNumber(`product_${def.role}_dose_amount`, e.target.value, (value) => {
                                      updateProduct(def.role, current => ({ ...current, dose_amount: value }));
                                    })}
                                    onBlur={() => clearSetupDraft(`product_${def.role}_dose_amount`)}
                                    className={setupInputClasses}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className={setupLabelClasses}>Unit</label>
                                  <select
                                    value={product.dose_unit}
                                    onChange={e => updateProduct(def.role, current => ({ ...current, dose_unit: e.target.value as EngineSetup['product_stack']['user_products'][number]['dose_unit'] }))}
                                    className={`${setupInputClasses} appearance-none`}
                                  >
                                    <option value="mL">mL</option>
                                    <option value="g">g</option>
                                    <option value="drops">drops</option>
                                  </select>
                                </div>
                                <div className="space-y-1.5">
                                  <label className={setupLabelClasses}>Per L</label>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={getSetupDraftValue(`product_${def.role}_per_volume_l`, product.per_volume_l)}
                                    onChange={e => commitSetupDraftNumber(`product_${def.role}_per_volume_l`, e.target.value, (value) => {
                                      updateProduct(def.role, current => ({ ...current, per_volume_l: value }));
                                    })}
                                    onBlur={() => clearSetupDraft(`product_${def.role}_per_volume_l`)}
                                    className={setupInputClasses}
                                  />
                                </div>
                                {hasEffect && (
                                  <div className="space-y-1.5">
                                  <label className={setupLabelClasses}>{def.effectLabel}</label>
                                  <input
                                      type="text"
                                      inputMode="decimal"
                                      value={getSetupDraftValue(`product_${def.role}_effect_value`, product.effect_value)}
                                      onChange={e => commitSetupDraftNumber(`product_${def.role}_effect_value`, e.target.value, (value) => {
                                        updateProduct(def.role, current => ({ ...current, effect_value: value }));
                                      })}
                                      onBlur={() => clearSetupDraft(`product_${def.role}_effect_value`)}
                                      className={setupInputClasses}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="border border-slate-800 rounded-3xl p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Testing Kits</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">availability</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'can_test_ammonia', label: 'Ammonia' },
                      { key: 'can_test_nitrite', label: 'Nitrite' },
                      { key: 'can_test_nitrate', label: 'Nitrate' },
                      { key: 'can_test_ph', label: 'pH' },
                      { key: 'can_test_gh', label: 'GH' },
                      { key: 'can_test_kh', label: 'KH' }
                    ].map(item => {
                      const enabled = aquarium.engineSetup.testing[item.key];
                      return (
                        <button
                          key={item.key}
                          onClick={() => updateEngineSetup(prev => ({
                            ...prev,
                            testing: {
                              ...prev.testing,
                              [item.key]: !prev.testing[item.key]
                            }
                          }))}
                          className={`py-3 rounded-2xl border text-[10px] font-bold uppercase tracking-wide ${
                            enabled
                              ? 'bg-slate-100 text-slate-950 border-slate-100'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeSetupSection === 'protocol' && (
              <div className="space-y-5">
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Protocol Summary</h3>
                    <span className="text-[10px] text-slate-500">Engine-guided</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Review recommendations and enable overrides when you need to deviate.</p>
                  <button
                    onClick={generateProtocolTasks}
                    disabled={!protocolPlan}
                    className={`w-full py-3 rounded-2xl text-xs font-bold border transition-all ${
                      protocolPlan
                        ? 'bg-slate-100 text-slate-950 border-slate-100 active:scale-[0.98]'
                        : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    Generate Protocol
                  </button>
                </div>

                {aquarium.engineSetup.protocol_preferences.cycling && (
                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Cycling Protocol</h4>
                    </div>
                    <div className="space-y-2 text-[11px] text-slate-400">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500">Recommended</span>
                          <button
                            onClick={() => setInfoModal({
                              title: 'Cycling Recommendation',
                              content: [
                                recommendedProtocolPlan?.selection?.method_motivation,
                                recommendedProtocolPlan?.selection?.spectrum_motivation
                              ].filter(Boolean).join('\n')
                            })}
                            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                            aria-label="Why this cycling recommendation"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-slate-200 font-semibold">{formatDisplayValue(recommendedProtocolPlan?.selection?.recommended_cycling_mode || 'fishless_ammonia')}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Current</span>
                        <span className="text-slate-200 font-semibold">
                          {aquarium.engineSetup.user_preferences.cycling_mode_preference === 'auto'
                            ? `Auto (${formatDisplayValue(recommendedProtocolPlan?.selection?.recommended_cycling_mode || 'fishless_ammonia')})`
                            : formatDisplayValue(aquarium.engineSetup.user_preferences.cycling_mode_preference)}
                        </span>
                      </div>
                      {typeof protocolPlan?.selection?.risk_score_1_to_5 === 'number' && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">Risk</span>
                            <button
                              onClick={() => setInfoModal({
                                title: 'Risk Score',
                                content: protocolPlan?.selection?.risk_motivation || 'No specific risk guidance available.'
                              })}
                              className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                              aria-label="Why this risk score"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-slate-200 font-semibold">{protocolPlan.selection.risk_score_1_to_5}/5</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className={setupLabelClasses}>Cycling Mode</label>
                      <select
                        value={aquarium.engineSetup.user_preferences.cycling_mode_preference}
                        onChange={e => updateEngineSetup(prev => ({
                          ...prev,
                          user_preferences: { ...prev.user_preferences, cycling_mode_preference: e.target.value as EngineSetup['user_preferences']['cycling_mode_preference'] }
                        }))}
                        className={`${setupInputClasses} appearance-none`}
                      >
                        <option value="auto">Auto (Recommended)</option>
                        <option value="fishless_ammonia">Fishless Ammonia</option>
                        <option value="fish_in">Fish-in</option>
                        <option value="plant_assisted">Plant Assisted</option>
                      </select>
                    </div>

                    {aquarium.engineSetup.user_preferences.cycling_mode_preference !== 'auto'
                      && recommendedProtocolPlan?.selection?.recommended_cycling_mode
                      && aquarium.engineSetup.user_preferences.cycling_mode_preference !== recommendedProtocolPlan.selection.recommended_cycling_mode && (
                      <div className="bg-amber-950/30 border border-amber-800/40 p-3 rounded-2xl text-[10px] text-amber-300">
                        Deviating from the recommended cycling mode can increase risk. Monitor ammonia and nitrite closely in the first weeks.
                      </div>
                    )}
                  </div>
                )}

                {aquarium.engineSetup.protocol_preferences.cycling && (
                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Dark Start</h4>
                    </div>
                    <div className="space-y-2 text-[11px] text-slate-400">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500">Recommended</span>
                          <button
                            onClick={() => setInfoModal({
                              title: 'Dark Start Recommendation',
                              content: formatReasonList(recommendedProtocolPlan?.selection?.dark_start_reason_codes, darkStartReasonDescriptions)
                            })}
                            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                            aria-label="Why this dark start recommendation"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-slate-200 font-semibold">{recommendedProtocolPlan?.selection?.recommended_dark_start ? 'Enabled' : 'Off'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Current</span>
                        <span className="text-slate-200 font-semibold">
                          {aquarium.engineSetup.user_preferences.dark_start === 'auto'
                            ? `Auto (${recommendedProtocolPlan?.selection?.recommended_dark_start ? 'Enabled' : 'Off'})`
                            : aquarium.engineSetup.user_preferences.dark_start
                              ? 'Enabled'
                              : 'Off'}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={setupLabelClasses}>Dark Start</label>
                      <select
                        value={
                          aquarium.engineSetup.user_preferences.dark_start === 'auto'
                            ? 'auto'
                            : aquarium.engineSetup.user_preferences.dark_start
                              ? 'true'
                              : 'false'
                        }
                        onChange={e => {
                          const value = e.target.value;
                          const nextValue = value === 'auto' ? 'auto' : value === 'true';
                          updateEngineSetup(prev => ({
                            ...prev,
                            user_preferences: { ...prev.user_preferences, dark_start: nextValue }
                          }));
                        }}
                        className={`${setupInputClasses} appearance-none`}
                      >
                        <option value="auto">Auto (Recommended)</option>
                        <option value="true">Enabled</option>
                        <option value="false">Off</option>
                      </select>
                    </div>
                    {typeof recommendedProtocolPlan?.selection?.recommended_dark_start === 'boolean'
                      && aquarium.engineSetup.user_preferences.dark_start !== 'auto'
                      && aquarium.engineSetup.user_preferences.dark_start !== recommendedProtocolPlan.selection.recommended_dark_start && (
                      <div className="bg-amber-950/30 border border-amber-800/40 p-3 rounded-2xl text-[10px] text-amber-300">
                        {recommendedProtocolPlan.selection.recommended_dark_start
                          ? 'Skipping the recommended dark start can increase algae risk in early weeks.'
                          : aquarium.engineSetup.tank_profile.substrate.type === 'inert'
                            ? 'Performing a Dark Start with inert soil provides small safety benefit and unnecessarily delays plant establishment and rooting.'
                            : 'Performing a Dark Start when it is not recommended can delay plant establishment.'}
                      </div>
                    )}
                  </div>
                )}

                {aquarium.engineSetup.protocol_preferences.maintenance && (
                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Maintenance Protocol</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className={setupLabelClasses}>Water Change %</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={getSetupDraftValue('weekly_wc_percent_protocol', aquarium.engineSetup.water_source_profile.weekly_water_change_percent_target)}
                          onChange={e => commitSetupDraftNumber('weekly_wc_percent_protocol', e.target.value, (value) => {
                            updateEngineSetup(prev => ({
                              ...prev,
                              water_source_profile: {
                                ...prev.water_source_profile,
                                weekly_water_change_percent_target: value
                              }
                            }));
                          })}
                          onBlur={() => clearSetupDraft('weekly_wc_percent_protocol')}
                          className={setupInputClasses}
                        />
                      </div>
                      <div className="flex items-end pb-3 text-[10px] text-slate-500">
                        Targets stay aligned to your Water + Biology settings.
                      </div>
                    </div>
                  </div>
                )}

                {aquarium.engineSetup.protocol_preferences.alerts && (
                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-3">
                    <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Alerts Protocol</h4>
                    <p className="text-[11px] text-slate-500">Notifications follow your Alerts setup.</p>
                  </div>
                )}

                {protocolDiscrepancies.length > 0 && (
                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-3">
                    <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Protocol Checks</h4>
                    <div className="space-y-3">
                      {protocolDiscrepancies.map((issue, index) => (
                        <div key={index} className="bg-amber-950/30 border border-amber-800/40 p-3 rounded-2xl">
                          <p className="text-[11px] font-semibold text-amber-200">{issue.title}</p>
                          <p className="text-[10px] text-amber-300 mt-1">{issue.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!protocolPlan && (
                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl text-[11px] text-slate-500">
                    Protocol recommendations are unavailable until the engine package loads.
                  </div>
                )}
              </div>
            )}

            {activeSetupSection === 'alerts' && (
              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-6">
                <div className="flex items-center justify-between mb-4 px-1">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reminders & Alerts</h4>
                  <Bell className={`w-3.5 h-3.5 transition-colors ${aquarium.reminderSettings.enabled ? 'text-white' : 'text-slate-400'}`} />
                </div>
                
                <div className="space-y-4">
                  <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-[28px] flex items-center justify-between shadow-sm">
                    <div>
                      <p className="text-sm font-bold text-white">Enable Notifications</p>
                      <p className="text-[10px] text-slate-500 font-medium">Ping for unfinished tasks</p>
                    </div>
                    <button 
                      onClick={() => updateReminder('enabled', !aquarium.reminderSettings.enabled)}
                      className={`w-12 h-7 rounded-full transition-all relative ${aquarium.reminderSettings.enabled ? 'bg-slate-300' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${aquarium.reminderSettings.enabled ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>

                  {notificationStatus === 'denied' && aquarium.reminderSettings.enabled && (
                    <div className="bg-red-950/20 border border-red-900/30 p-3 rounded-xl flex gap-2 items-start">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-red-400 leading-tight">Notifications are blocked by your browser. Please enable them in site settings.</p>
                    </div>
                  )}

                  <div className={`space-y-5 transition-opacity duration-300 ${aquarium.reminderSettings.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1.5 ml-1.5">
                          <Clock className="w-2.5 h-2.5" /> Daily Time
                        </label>
                        <input 
                          type="time"
                          value={aquarium.reminderSettings.dailyTime}
                          onChange={e => updateReminder('dailyTime', e.target.value)}
                          className={`${reminderInputClasses} text-center`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1.5 ml-1.5">
                          <Calendar className="w-2.5 h-2.5" /> Weekly Day
                        </label>
                        <select 
                          value={aquarium.reminderSettings.weeklyDay}
                          onChange={e => updateReminder('weeklyDay', parseInt(e.target.value))}
                          className={reminderInputClasses}
                          style={{ textAlignLast: 'center' }}
                        >
                          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
                            <option key={i} value={i}>{day}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1.5 ml-1.5">
                          <Calendar className="w-2.5 h-2.5" /> Monthly Day (1-28)
                        </label>
                        <input 
                          type="text"
                          inputMode="numeric"
                          min="1" max="28"
                          value={getSetupDraftValue('monthly_day', aquarium.reminderSettings.monthlyDay)}
                          onChange={e => {
                            const cleaned = sanitizeDecimalInput(e.target.value);
                            setSetupDrafts(prev => ({ ...prev, monthly_day: cleaned }));
                            if (!cleaned) return;
                            const parsed = parseInt(cleaned, 10);
                            if (!Number.isNaN(parsed)) {
                              updateReminder('monthlyDay', parsed);
                            }
                          }}
                          onBlur={() => clearSetupDraft('monthly_day')}
                          className={`${reminderInputClasses} text-center`}
                        />
                      </div>
                      <div className="flex items-end pb-3 text-[10px] text-slate-600 font-medium italic">
                        Every month
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSetupSection === 'data' && (
              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-6">
                <button 
                  onClick={() => setShowDeleteTankModal(true)}
                  className="w-full py-4 bg-red-950/20 hover:bg-red-900/30 text-red-500 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all border border-red-900/30 active:scale-95"
                >
                  <Trash2 className="w-4 h-4" /> Delete Tank
                </button>
                <button 
                  onClick={resetAllData}
                  className="w-full py-4 bg-slate-900/60 hover:bg-slate-900 text-slate-300 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all border border-slate-800 active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" /> Reset All Data
                </button>
              </div>
            )}

            <p className="text-center text-slate-600 text-[10px] px-8 pb-4">
              AquaTrack v1.4 • Locally Persistent Storage
            </p>
          </div>
        );
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-950 flex flex-col pt-8 safe-area-pt">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
        {renderContent()}
      </div>

      {infoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={() => setInfoModal(null)} />
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 w-full max-w-xs relative z-10 shadow-xl">
            <button 
              onClick={() => setInfoModal(null)}
              className="absolute top-3 right-3 p-2 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-400" />
              {infoModal.title} Guidance
            </h3>
            <div className="text-[12px] text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800">
              {infoModal.content}
            </div>
            <button 
              onClick={() => setInfoModal(null)}
              className="w-full mt-4 py-3 bg-slate-100 hover:bg-white text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-white/5 active:scale-[0.98]"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {showDeleteTankModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowDeleteTankModal(false)} />
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm relative z-10 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Delete Tank</h3>
            <p className="text-[12px] text-slate-400">
              Are you sure you want to delete "{aquarium.tankName || 'this tank'}"? This cannot be undone.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowDeleteTankModal(false)}
                className="py-3 bg-slate-800 text-slate-300 font-bold rounded-2xl border border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={deleteActiveTank}
                className="py-3 bg-red-600 text-white font-bold rounded-2xl border border-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showPhasePicker && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center animate-in slide-in-from-bottom-full duration-300">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowPhasePicker(false)} />
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-[40px] p-8 w-full max-w-md relative z-10 shadow-2xl safe-area-pb">
            <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-6" />
            <h3 className="text-xl font-black text-white mb-6 text-center">Switch Phase</h3>
            <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto no-scrollbar pb-4 px-1">
              {manualPhases.map(phase => (
                <button 
                  key={phase.id}
                  onClick={() => {
                    setAquarium(prev => ({...prev, currentPhase: phase.id as PhaseId}));
                    setShowPhasePicker(false);
                  }}
                  className={`p-5 rounded-[24px] border text-left flex items-center gap-4 transition-all active:scale-95 ${
                    aquarium.currentPhase === phase.id 
                      ? 'bg-slate-100 border-slate-100 shadow-lg shadow-white/5' 
                      : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="text-2xl grayscale-[0.5] group-hover:grayscale-0">{phase.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${aquarium.currentPhase === phase.id ? 'text-slate-950' : 'text-white'}`}>
                      {phase.name.split(' — ')[1] || phase.name}
                    </p>
                    <p className={`text-[10px] font-medium truncate ${aquarium.currentPhase === phase.id ? 'text-slate-700' : 'text-slate-500'}`}>
                      {phase.objectives?.[0] || 'Protocol phase'}
                    </p>
                  </div>
                  {aquarium.currentPhase === phase.id && (
                    <div className="bg-slate-950 p-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowPhasePicker(false)}
              className="w-full mt-6 py-4 bg-slate-800 text-slate-300 font-bold rounded-2xl active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-slate-800/50 safe-area-pb z-50">
        <div className="max-w-md mx-auto grid grid-cols-4 h-20">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-500'}`}
          >
            <LayoutDashboard className={`w-5 h-5 ${activeTab === 'dashboard' ? 'fill-white/10' : ''}`} />
            <span className="text-[9px] font-bold tracking-tight">Status</span>
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'logs' ? 'text-white' : 'text-slate-500'}`}
          >
            <PlusCircle className={`w-5 h-5 ${activeTab === 'logs' ? 'fill-white/10' : ''}`} />
            <span className="text-[9px] font-bold tracking-tight">Entry</span>
          </button>
          <button 
            onClick={() => setActiveTab('roadmap')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'roadmap' ? 'text-white' : 'text-slate-500'}`}
          >
            <ClipboardList className={`w-5 h-5 ${activeTab === 'roadmap' ? 'fill-white/10' : ''}`} />
            <span className="text-[9px] font-bold tracking-tight">Manual</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'settings' ? 'text-white' : 'text-slate-500'}`}
          >
            <Settings className={`w-5 h-5 ${activeTab === 'settings' ? 'fill-white/10' : ''}`} />
            <span className="text-[9px] font-bold tracking-tight">Setup</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;
