import { describe, expect, it } from 'vitest';
import { generatePlan, calcAmmoniaMl, deriveNetVolume, deriveWeeklyWcRange, calcGhGRange, calcKhG } from './planEngine.js';
import { readFile } from 'node:fs/promises';

const loadEnginePackage = async () => {
  const raw = await readFile(new URL('../tmp-json/aquatrack_engine.package.json', import.meta.url), 'utf8');
  return JSON.parse(raw);
};

const baseSetup = {
  user_preferences: {
    cycling_mode_preference: 'auto',
    dark_start: false,
    risk_tolerance: 'low',
    goal_profile: 'stability_first',
    photoperiod_hours_initial: 6,
    photoperiod_hours_post_cycle: 8,
    units: 'metric'
  },
  tank_profile: {
    tank_volume_l_gross: 60,
    net_volume_method: 'estimate_multiplier',
    estimated_net_multiplier: 0.85,
    substrate: { type: 'inert' },
    co2: { enabled: true, injection_type: 'diffuser' }
  },
  water_source_profile: {
    tap_ph: 7.2,
    tap_gh_dgh: 2,
    tap_kh_dkh: 1,
    disinfectant: 'chlorine',
    weekly_water_change_percent_target: [25, 30]
  },
  biology_profile: {
    plants: { categories: ['epiphytes'], demand_class: 'low' },
    livestock_plan: { fish: [], shrimp: [], cleanup_crew: [] }
  },
  product_stack: {
    ammonia_source: { type: 'pure_ammonia', solution_percent: 10 },
    selected_product_ids: ['gh_remineralizer', 'kh_buffer', 'ammonia_solution', 'bacteria_starter', 'fertilizer_micros']
  }
};

const baseCatalog = {
  version: '0.1',
  catalog_id: 'test',
  products: [
    { product_id: 'gh_remineralizer', category: 'remineralizer_gh', constraints: { requires_trigger: false, warnings: [] } },
    { product_id: 'kh_buffer', category: 'buffer_kh', constraints: { requires_trigger: false, warnings: [] } },
    { product_id: 'ammonia_solution', category: 'ammonia_source', constraints: { requires_trigger: false, warnings: [] } },
    { product_id: 'bacteria_starter', category: 'bacteria_starter', constraints: { requires_trigger: false, warnings: [] } },
    { product_id: 'fertilizer_micros', category: 'fertilizer_micros', constraints: { requires_trigger: false, warnings: [] } }
  ]
};

describe('plan engine calculations', () => {
  it('derives net volume for explicit and estimated modes', () => {
    expect(deriveNetVolume({ net_volume_method: 'explicit', net_water_volume_l: 50, tank_volume_l_gross: 60, estimated_net_multiplier: 0.85 })).toBe(50);
    expect(deriveNetVolume({ net_volume_method: 'estimate_multiplier', tank_volume_l_gross: 60, estimated_net_multiplier: 0.85 })).toBeCloseTo(51);
  });

  it('derives weekly water change volume range', () => {
    const range = deriveWeeklyWcRange(50, [20, 30]);
    expect(range[0]).toBeCloseTo(10);
    expect(range[1]).toBeCloseTo(15);
  });

  it('scales ammonia dose linearly for 10% solution', () => {
    const calibration = { reference_solution_percent: 10, reference_dose_ml: 0.6, reference_volume_l: 60, reference_result_ppm: 2.0 };
    const dose60 = calcAmmoniaMl(60, 2.0, 10, calibration);
    const dose120 = calcAmmoniaMl(120, 2.0, 10, calibration);
    expect(dose120).toBeCloseTo(dose60 * 2);
  });

  it('produces non-negative GH/KH dosing outputs', () => {
    const ghRange = calcGhGRange(6, [5, 6], 60, 0.0666666667);
    expect(ghRange[0]).toBeGreaterThanOrEqual(0);
    expect(ghRange[1]).toBeGreaterThanOrEqual(0);
    const kh = calcKhG(5, 3, 60, 0.6);
    expect(kh).toBeGreaterThanOrEqual(0);
  });
});

describe('plan engine template selection', () => {
  it('selects fish-in template when cycling_mode_preference is fish_in', async () => {
    const enginePackage = await loadEnginePackage();
    const plan = generatePlan({
      setup: { ...baseSetup, user_preferences: { ...baseSetup.user_preferences, cycling_mode_preference: 'fish_in' } },
      productCatalog: baseCatalog,
      enginePackage,
      overrideAcknowledged: true,
      generatedAtIso: '2024-01-01T00:00:00.000Z'
    });
    expect(plan.phases[0].phase_id).toBe('phase_fish_in_week_1');
  });
});
