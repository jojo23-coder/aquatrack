
import { Task, PhaseId, WaterLog } from './types';

export const PHASES = [
  {
    id: 'phase_1_initial_start_day_0',
    name: 'Phase 1 — Initial Start (Day 0)',
    icon: '🛠️',
    objectives: [
      "Assemble tank and hardscape securely",
      "Attach epiphyte plants correctly",
      "Establish baseline GH and KH",
      "Start filtration and lighting"
    ],
    instructions: [
      "Place lava rock and sand (≤2 cm cap).",
      "Attach moss, Anubias, Bucephalandra (no buried rhizomes).",
      "Fill tank carefully to avoid disturbance.",
      "Dose Seachem Equilibrium 9–13 g (full fill).",
      "Dose KH buffer ~2.0 g (full fill).",
      "Set lights to 6 h/day.",
      "Turn filter ON (24/7).",
      "Ensure CO2 is OFF."
    ],
    expected: ["Slight cloudiness.", "Air bubbles in substrate.", "Minimal plant melt."]
  },
  {
    id: 'phase_2_first_week_days_1_7',
    name: 'Phase 2 — First Week (Days 1–7)',
    icon: '🔄',
    objectives: [
      "Seed nitrifying bacteria",
      "Introduce controlled ammonia source",
      "Avoid instability or over-intervention"
    ],
    instructions: [
      "Add Seachem Stability daily.",
      "Dose ammonia to 1.5–2.0 ppm if below target (0.45–0.6 mL).",
      "Keep lights at 6 hours/day.",
      "Verify CO2 remains OFF or ≤1 bps."
    ],
    expected: ["Bacterial bloom (haze).", "Diatoms (brown algae).", "Ammonia slow drop."]
  },
  {
    id: 'phase_3_active_cycling_weeks_2_4',
    name: 'Phase 3 — Active Cycling (Weeks 2–4)',
    icon: '🧬',
    objectives: [
      "Complete ammonia → nitrite → nitrate conversion",
      "Stabilize GH and KH",
      "Ramp CO2 safely"
    ],
    instructions: [
      "Adjust CO2 by +0.5 bps/day if below target pH drop.",
      "Weekly water change 25–30%.",
      "Redose ammonia to 1.5–2.0 ppm only when ammonia reads 0 ppm.",
      "Pause CO2 increases if pH drop exceeds ~1.0."
    ],
    expected: ["Nitrite levels peaking.", "Slight pH drop from CO2.", "Plant life stabilizing."]
  },
  {
    id: 'phase_4_cycle_complete_week_4_5',
    name: 'Phase 4 — Cycle Complete (Week 4–5)',
    icon: '✅',
    objectives: [
      "Confirm biofilter capacity",
      "Transition from cycling to planted operation"
    ],
    instructions: [
      "Dose ammonia to 1.5–2.0 ppm for final test.",
      "Confirm NH3 and NO2 reach 0 within 24 h.",
      "Perform 50% water change.",
      "Start Seachem Flourish at 0.6 mL/week.",
      "Lock CO2 bubble rate."
    ],
    expected: ["Clear water.", "New green growth.", "Nitrate accumulating."]
  },
  {
    id: 'phase_5_livestock_introduction',
    name: 'Phase 5 — Livestock Introduction',
    icon: '🦐',
    objectives: [
      "Increase bioload gradually",
      "Prevent parameter shock"
    ],
    instructions: [
      "Add cleanup crew (snails/shrimp).",
      "Drip acclimate shrimp for ≥1 hour.",
      "Add fish in batches, 1–2 weeks apart.",
      "Do not change CO2 settings during addition week."
    ],
    expected: ["Shrimp exploring.", "Fish settling in.", "Steady parameters."]
  },
  {
    id: 'phase_6_steady_maintenance',
    name: 'Phase 6 — Steady Maintenance',
    icon: '🌿',
    objectives: [
      "Maintain long-term chemical stability",
      "Support slow, steady plant growth",
      "Ensure livestock health"
    ],
    instructions: [
      "Weekly 25–30% water change.",
      "Dose Equilibrium + KH buffer + Flourish.",
      "Rinse filter sponges in tank water monthly.",
      "Inspect hoses, lily pipes, and impeller."
    ],
    expected: ["Healthy plant growth.", "Active livestock.", "No algae outbreaks."]
  },
  {
    id: 'phase_co2_trimming',
    name: 'CO2 Trim — Trimming (Setup & Retuning)',
    icon: '🫧',
    objectives: [
      "Achieve stable CO2 delivery for shrimp + galaxy rasboras",
      "Hit and maintain a ~1.0 pH drop without livestock stress",
      "Lock a repeatable CO2 setting for long-term stability"
    ],
    instructions: [
      "Establish baseline: Aerate a cup of tank water for 24h to measure 'Degassed pH'.",
      "Peak Check: Measure 'CO2-on pH' after 1h of CO2 runtime.",
      "Calculate: pH Drop = Degassed - Peak. Target: 1.0 (Range 0.8–1.2).",
      "Adjust bubble rate (bps) in small +/- 0.5 bps steps every 24h.",
      "Observe: Watch for surface gasping or shrimp 'climbing' behavior.",
      "EMERGENCY: If stress seen, turn CO2 OFF and increase surface agitation immediately."
    ],
    expected: [
      "Stability reduces algae risk more than pushing higher CO2 concentrations.",
      "Inline systems respond slowly; allow 24h between adjustments.",
      "Degassed pH remains higher than peak CO2-on pH."
    ]
  }
];

export const INITIAL_TASKS: Task[] = [
  // Phase 1 - One-time
  { id: 'p1_o1', phaseId: 'phase_1_initial_start_day_0', frequency: 'one-time', title: 'Assemble tank and hardscape securely', completed: true },
  { id: 'p1_o2', phaseId: 'phase_1_initial_start_day_0', frequency: 'one-time', title: 'Attach epiphyte plants correctly', completed: true },
  { id: 'p1_o3', phaseId: 'phase_1_initial_start_day_0', frequency: 'one-time', title: 'Dose Equilibrium 9–13 g (Baseline)', completed: true },
  { id: 'p1_o4', phaseId: 'phase_1_initial_start_day_0', frequency: 'one-time', title: 'Dose KH buffer ~2.0 g (Baseline)', completed: true },
  { id: 'p1_m1', phaseId: 'phase_1_initial_start_day_0', frequency: 'one-time', title: 'Baseline Measure: GH, KH, Temp', completed: true },

  // Phase 2 - One-time
  { id: 'p2_a1', phaseId: 'phase_2_first_week_days_1_7', frequency: 'one-time', title: 'Initial Ammonia Dose (1.5–2.0 ppm)', completed: false },

  // Phase CO2 Trim - Specific Tasks
  { id: 'pco2_o1', phaseId: 'phase_co2_trimming', frequency: 'one-time', title: 'Degassed pH baseline recorded', completed: false },
  { id: 'pco2_o2', phaseId: 'phase_co2_trimming', frequency: 'one-time', title: 'CO2-on pH recorded at peak time', completed: false },
  { id: 'pco2_o3', phaseId: 'phase_co2_trimming', frequency: 'one-time', title: 'pH drop calculated and within 0.8–1.2 range', completed: false },
  { id: 'pco2_o4', phaseId: 'phase_co2_trimming', frequency: 'one-time', title: 'Livestock behavior verified normal (if present)', completed: false },
  { id: 'pco2_o5', phaseId: 'phase_co2_trimming', frequency: 'one-time', title: 'CO2 setting locked for 7 days', completed: false },

  // Phase 4 - One-time
  { id: 'p4_o1', phaseId: 'phase_4_cycle_complete_week_4_5', frequency: 'one-time', title: '24h clearance test: Dose NH3 and verify 0/0', completed: false },
  { id: 'p4_o2', phaseId: 'phase_4_cycle_complete_week_4_5', frequency: 'one-time', title: 'Final 50% Post-Cycle Water Change', completed: false },

  // Daily Routine
  { id: 'd_1', frequency: 'daily', startPhaseId: 'phase_2_first_week_days_1_7', title: 'Add Seachem Stability', completed: false },
  { id: 'd_2', frequency: 'daily', startPhaseId: 'phase_1_initial_start_day_0', title: 'Visual inspection: clarity & filter flow', completed: false },
  { id: 'd_co2_1', frequency: 'daily', startPhaseId: 'phase_co2_trimming', title: 'Confirm CO2 solenoid activation/deactivation', completed: false },
  { id: 'd_co2_2', frequency: 'daily', startPhaseId: 'phase_co2_trimming', title: 'Check surface ripple status', completed: false },

  // Weekly Maintenance
  { id: 'w_1', frequency: 'weekly', startPhaseId: 'phase_3_active_cycling_weeks_2_4', title: '25–30% Water Change', completed: false },
  { id: 'w_2', frequency: 'weekly', startPhaseId: 'phase_3_active_cycling_weeks_2_4', title: 'Dose Equilibrium (2.5–3.0 g) & KH Buffer', completed: false },
  { id: 'w_m1', frequency: 'weekly', startPhaseId: 'phase_3_active_cycling_weeks_2_4', title: 'Full Test: GH, KH, Nitrate', completed: false },
  { id: 'w_co2_1', frequency: 'weekly', startPhaseId: 'phase_co2_trimming', title: 'Re-check pH drop (Degassed vs peak On)', completed: false },
  { id: 'w_co2_2', frequency: 'weekly', startPhaseId: 'phase_co2_trimming', title: 'Inspect CO2 tubing & check valve for water', completed: false },

  // Monthly
  { id: 'm_1', frequency: 'monthly', startPhaseId: 'phase_6_steady_maintenance', title: 'Rinse filter sponges in tank water', completed: false },
];

export const MOCK_LOGS: WaterLog[] = [
  { id: '1', date: '2024-03-01', temperature: 23.5, pH: 7.2, ammonia: 0, nitrite: 0, nitrate: 0, gh: 5.5, kh: 3.0, notes: 'Day 0 fill' },
  { id: '2', date: '2024-03-02', temperature: 23.0, pH: 7.1, ammonia: 1.8, nitrite: 0.1, nitrate: 1, gh: 5.8, kh: 3.1, notes: 'First ammonia dose' },
  { id: '3', date: '2024-03-05', temperature: 23.2, pH: 7.0, ammonia: 1.0, nitrite: 1.5, nitrate: 5, gh: 5.7, kh: 3.0, notes: 'Cycling started' },
  { id: '4', date: '2024-03-10', temperature: 23.0, pH: 6.9, ammonia: 0.2, nitrite: 4.0, nitrate: 15, gh: 5.6, kh: 2.9, notes: 'Nitrite spike' },
];

export const CHART_COLORS = {
  ammonia: '#fbbf24',
  nitrite: '#ef4444',
  nitrate: '#10b981',
  temp: '#3b82f6',
  pH: '#8b5cf6',
  gh: '#2dd4bf',
  kh: '#f472b6',
};
