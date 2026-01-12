export enum TankType {
  FRESHWATER = 'Freshwater',
  SALTWATER = 'Saltwater',
  PLANTED = 'Planted'
}

export type PhaseId = 
  | 'phase_1_initial_start_day_0' 
  | 'phase_2_first_week_days_1_7' 
  | 'phase_3_active_cycling_weeks_2_4' 
  | 'phase_co2_trimming'
  | 'phase_4_cycle_complete_week_4_5' 
  | 'phase_5_livestock_introduction' 
  | 'phase_6_steady_maintenance'
  | 'startup'
  | 'dark_start'
  | 'establish'
  | 'cycle'
  | 'stabilize'
  | 'stock'
  | 'maintenance';

export type TaskFrequency = 'daily' | 'weekly' | 'interval' | 'monthly' | 'one-time';

export interface ParameterRange {
  min: number;
  max: number;
}

export interface WaterLog {
  id: string;
  date: string;
  temperature: number;
  pH?: number;
  ammonia?: number;
  nitrite?: number;
  nitrate?: number;
  gh?: number;
  kh?: number;
  degassedPH?: number;
  bubbleRate?: number;
  notes?: string;
}

export type WaterLogParameter = 'pH' | 'ammonia' | 'nitrite' | 'nitrate' | 'gh' | 'kh';

export interface Task {
  id: string;
  phaseId?: PhaseId; // For one-time tasks
  startPhaseId?: PhaseId; // For recurring tasks: visible from this phase onwards
  endPhaseId?: PhaseId; // For recurring tasks: hidden after this phase
  frequency: TaskFrequency;
  everyDays?: number;
  dueOffsetDays?: number;
  title: string;
  completed: boolean;
  lastCompletedAt?: string;
  logParameter?: WaterLogParameter;
  logDerived?: boolean;
}

export interface ReminderSettings {
  enabled: boolean;
  dailyTime: string;
  weeklyDay: number; // 0-6 (Sun-Sat)
  monthlyDay: number; // 1-31
}

export interface EngineSetup {
  user_preferences: {
    cycling_mode_preference: 'auto' | 'fishless_ammonia' | 'dark_start' | 'fish_in' | 'plant_assisted';
  };
  protocol_preferences: {
    cycling: boolean;
    maintenance: boolean;
    stocking: boolean;
    plant_care: boolean;
    alerts: boolean;
    emergency: boolean;
  };
  protocol_overrides: {
    cycling: boolean;
    maintenance: boolean;
  };
  tank_profile: {
    tank_volume_l_gross: number;
    net_volume_method: 'explicit' | 'estimate_multiplier';
    estimated_net_multiplier: number;
    net_water_volume_l?: number;
    substrate: {
      type: 'inert' | 'aquasoil';
      sand_cap_cm: number;
    };
    hardscape: {
      type: 'wood' | 'stone' | 'mixed';
    };
    lighting_system: 'basic' | 'dedicated' | 'high_performance';
    filtration: {
      filter_model?: string;
      rated_flow_lph?: number;
      flow_class: 'low' | 'medium' | 'high';
    };
    heater_installed: boolean;
    co2: {
      enabled: boolean;
      injection_type: 'inline' | 'diffuser' | 'reactor';
      target_ph_drop: number;
      surface_agitation: 'flat' | 'gentle_ripple' | 'turbulent';
      start_intent?: 'from_start' | 'eventual';
    };
    temperature_target_c: [number, number];
  };
  water_source_profile: {
    tap_ph: number;
    tap_gh_dgh: number;
    tap_kh_dkh: number | null;
    tap_ammonia_ppm: number;
    disinfectant: 'none' | 'chlorine' | 'chloramine' | 'unknown';
    weekly_water_change_percent_target: number;
  };
  biology_profile: {
    plants: {
      categories: Array<'moss' | 'epiphytes' | 'stems' | 'floaters' | 'root_feeders'>;
      demand_class: 'low' | 'medium' | 'high' | 'auto';
      density: 'none' | 'sparse' | 'moderate' | 'heavy';
      species: string[];
    };
    livestock_plan: {
      fish: string[];
      shrimp: string[];
      cleanup_crew: string[];
    };
    livestock_traits: {
      is_sensitive: boolean;
      has_diggers: boolean;
    };
  };
  product_stack: {
    ammonia_source: {
      type: 'pure_ammonia' | 'fish_food' | 'none';
      solution_percent: number | null;
    };
    selected_product_ids: string[];
    remineralizer_mode?: 'combo' | 'separate';
    user_products: Array<{
      role: 'gh_remineralizer' | 'kh_buffer' | 'gh_kh_remineralizer' | 'bacteria_starter' | 'fertilizer_micros' | 'ammonia_source' | 'detoxifier_conditioner' | 'water_clarifier' | 'water_quality_support';
      enabled: boolean;
      name: string;
      dose_amount: number;
      dose_unit: 'mL' | 'g' | 'drops';
      per_volume_l: number;
      effect_value: number;
      per_volume_l_gh?: number;
      effect_value_gh?: number;
      per_volume_l_kh?: number;
      effect_value_kh?: number;
      bicarbonate?: boolean;
      contains_nitrogen?: boolean;
      contains_potassium?: boolean;
      ammonia_solution_percent?: number;
      pure_ammonia?: boolean;
    }>;
  };
  testing: {
    can_test_ammonia: boolean;
    can_test_nitrite: boolean;
    can_test_nitrate: boolean;
    can_test_ph: boolean;
    can_test_gh: boolean;
    can_test_kh: boolean;
  };
}

export interface AquariumState {
  id: string;
  tankName: string;
  tankSize: number;
  tankType: TankType;
  startDate: string;
  timezone: string;
  phaseStartDates: Partial<Record<PhaseId, string>>;
  logs: WaterLog[];
  tasks: Task[];
  currentPhase: PhaseId;
  reminderSettings: ReminderSettings;
  engineSetup: EngineSetup;
  targets: {
    temperature: ParameterRange;
    pH: ParameterRange;
    ammonia: number; // Max safe level
    nitrite: number; // Max safe level
    nitrate: ParameterRange;
    gh: ParameterRange;
    kh: ParameterRange;
  };
}
