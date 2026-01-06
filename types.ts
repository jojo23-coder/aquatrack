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
  | 'phase_6_steady_maintenance';

export type TaskFrequency = 'daily' | 'weekly' | 'monthly' | 'one-time';

export interface ParameterRange {
  min: number;
  max: number;
}

export interface WaterLog {
  id: string;
  date: string;
  temperature: number;
  pH: number;
  ammonia: number;
  nitrite: number;
  nitrate: number;
  gh?: number;
  kh?: number;
  degassedPH?: number;
  bubbleRate?: number;
  notes?: string;
}

export interface Task {
  id: string;
  phaseId?: PhaseId; // For one-time tasks
  startPhaseId?: PhaseId; // For recurring tasks: visible from this phase onwards
  frequency: TaskFrequency;
  title: string;
  completed: boolean;
}

export interface ReminderSettings {
  enabled: boolean;
  dailyTime: string;
  weeklyDay: number; // 0-6 (Sun-Sat)
  monthlyDay: number; // 1-28
}

export interface AquariumState {
  tankName: string;
  tankSize: number;
  tankType: TankType;
  startDate: string;
  logs: WaterLog[];
  tasks: Task[];
  currentPhase: PhaseId;
  reminderSettings: ReminderSettings;
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