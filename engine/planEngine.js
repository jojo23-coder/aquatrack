const DEFAULT_GENERATED_AT_ISO = '1970-01-01T00:00:00.000Z';

const ROLE_CATEGORIES = {
  gh_remineralizer: 'remineralizer_gh',
  kh_buffer: 'buffer_kh',
  bacteria_starter: 'bacteria_starter',
  fertilizer_micros: 'fertilizer_micros',
  ammonia_source: 'ammonia_source',
  detoxifier_conditioner: 'detoxifier_conditioner',
  water_clarifier: 'water_clarifier',
  water_quality_support: 'water_quality_support'
};

const REQUIRED_ROLES = new Set(['gh_remineralizer', 'kh_buffer']);

const CADENCE_ORDER = ['one_time', 'daily', 'weekly', 'monthly', 'as_needed'];

const TRIGGER_ONLY_KEYWORDS = [
  { role: 'detoxifier_conditioner', match: /detoxifier|conditioner/i },
  { role: 'water_clarifier', match: /clarifier/i },
  { role: 'water_quality_support', match: /water quality/i }
];

const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/A';
  }
  const fixed = Number(value).toFixed(decimals);
  if (!fixed.includes('.')) {
    return fixed;
  }
  return fixed.replace(/\.?0+$/, '');
};

const formatRange = (range, decimals = 2) => {
  if (!Array.isArray(range) || range.length !== 2) {
    return 'N/A';
  }
  if (range.some((value) => value === null || value === undefined || Number.isNaN(value))) {
    return 'N/A';
  }
  return `${formatNumber(range[0], decimals)}-${formatNumber(range[1], decimals)}`;
};

const averageRange = (range) => {
  if (!Array.isArray(range) || range.length !== 2) {
    return null;
  }
  if (range.some((value) => value === null || value === undefined || Number.isNaN(value))) {
    return null;
  }
  return (range[0] + range[1]) / 2;
};

const roundTo = (value, decimals = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return value;
  }
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

const getByPath = (obj, path) => {
  if (!path) return undefined;
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);
};

const matchRule = (conditions, context) => {
  if (!conditions || Object.keys(conditions).length === 0) {
    return true;
  }
  return Object.entries(conditions).every(([key, value]) => getByPath(context, key) === value);
};

const evaluateDecisionTable = (table, context) => {
  let matched = false;
  let result = {};
  for (const rule of table.rules || []) {
    const isFallback = rule.if && Object.keys(rule.if).length === 0;
    if (isFallback && matched) {
      continue;
    }
    if (matchRule(rule.if, context)) {
      matched = true;
      result = { ...result, ...(rule.then || {}) };
    }
  }
  return result;
};

const evaluateOverridePolicy = (policy, context) => {
  const conditions = policy?.requires_acknowledgement_when || [];
  return conditions.some((expression) => evaluateExpression(expression, context));
};

const evaluateExpression = (expression, context) => {
  if (!expression) return false;
  return expression.split(' AND ').every((clause) => evaluateClause(clause.trim(), context));
};

const evaluateClause = (clause, context) => {
  const match = clause.match(/^([a-zA-Z0-9_]+)\s*(==|!=|>=|<=|>|<)\s*('?[^']*'?|\d+(\.\d+)?)$/);
  if (!match) return false;
  const [, key, operator, rawValue] = match;
  const left = context[key];
  let right;
  if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
    right = rawValue.slice(1, -1);
  } else {
    right = Number(rawValue);
  }
  switch (operator) {
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '>=':
      return Number(left) >= right;
    case '<=':
      return Number(left) <= right;
    case '>':
      return Number(left) > right;
    case '<':
      return Number(left) < right;
    default:
      return false;
  }
};

const selectProductsByRole = (productCatalog, selectedIds, notes) => {
  const products = productCatalog?.products || [];
  const selectedSet = new Set(selectedIds || []);
  const roleMap = {};

  for (const [role, category] of Object.entries(ROLE_CATEGORIES)) {
    const candidates = products.filter((product) => product.category === category);
    const selectedCandidates = candidates.filter((product) => selectedSet.has(product.product_id));
    const chosen = selectedCandidates[0] || null;
    if (!chosen && REQUIRED_ROLES.has(role)) {
      notes.push({
        type: 'warning',
        message: `Required product role missing: ${role}.`,
        role
      });
    }
    roleMap[role] = chosen;
  }
  return roleMap;
};

const deriveNetVolume = (tankProfile) => {
  if (tankProfile.net_volume_method === 'explicit' && typeof tankProfile.net_water_volume_l === 'number') {
    return tankProfile.net_water_volume_l;
  }
  return tankProfile.tank_volume_l_gross * tankProfile.estimated_net_multiplier;
};

const deriveWeeklyWcRange = (netVolume, percentRange) => {
  const [low, high] = percentRange;
  return [netVolume * (low / 100), netVolume * (high / 100)];
};

const calcGhGRange = (tapGh, targetRange, volume, constant) => {
  const [targetLow, targetHigh] = targetRange;
  const lowDelta = Math.max(0, targetLow - tapGh);
  const highDelta = Math.max(0, targetHigh - tapGh);
  return [lowDelta * volume * constant, highDelta * volume * constant];
};

const calcKhG = (tapKh, targetKh, volume, constant) => {
  const delta = Math.max(0, targetKh - tapKh);
  return delta * (volume / 10) * constant;
};

const calcAmmoniaMl = (netVolume, targetPpm, solutionPercent, calibration) => {
  if (solutionPercent !== calibration.reference_solution_percent) {
    return null;
  }
  const ratio = (netVolume / calibration.reference_volume_l) * (targetPpm / calibration.reference_result_ppm);
  return calibration.reference_dose_ml * ratio;
};

const calcFertilizerMlWeek = (netVolume, doseFactor, label) => {
  const base = label.ml_per_250l_per_week * (netVolume / 250);
  return base * doseFactor;
};

const buildPlaceholderMap = (data) => {
  const {
    derived,
    dosingReference,
    targets,
    calculatorDefaults,
    ammoniaSolutionPercent,
    roleMap,
    cyclingMode
  } = data;
  const getRoleDose = (role, volume) => {
    const product = roleMap?.[role];
    const doseModel = product?.dose_model;
    if (!doseModel || doseModel.dose_basis !== 'per_volume') return null;
    if (!doseModel.amount || !doseModel.per_volume_l) return null;
    const total = (volume / doseModel.per_volume_l) * doseModel.amount;
    return {
      amount: total,
      unit: doseModel.unit || ''
    };
  };
  const doseToString = (dose) => {
    if (!dose) return 'per label';
    return `${formatNumber(dose.amount, 1)} ${dose.unit}`.trim();
  };
  const getRoleName = (role) => {
    const product = roleMap?.[role];
    return product?.display_name || role.replace(/_/g, ' ');
  };
  const ghFullFillTarget = averageRange(dosingReference.gh_full_fill_g_range);
  const ghWcTarget = averageRange(dosingReference.gh_wc_g_range);
  const khWcTarget = averageRange(dosingReference.kh_wc_g_range);
  const targetGh = targets.gh_dgh?.target ?? averageRange(targets.gh_dgh?.target_range);
  const targetKh = targets.kh_dkh?.target ?? averageRange(targets.kh_dkh?.target_range);
  const conditionerFull = getRoleDose('detoxifier_conditioner', derived.net_water_volume_l);
  const bacteriaFull = getRoleDose('bacteria_starter', derived.net_water_volume_l);
  const bacteriaWeekly = getRoleDose('bacteria_starter', derived.net_water_volume_l);

  const cycleSafe = cyclingMode === 'fishless_ammonia'
    ? { ammonia: 6, nitrite: 5 }
    : {
      ammonia: targets.ammonia_ppm?.target ?? 0,
      nitrite: targets.nitrite_ppm?.target ?? 0
    };

  return {
    net_volume_l: formatNumber(derived.net_water_volume_l, 1),
    photoperiod_hours_initial: formatNumber(derived.photoperiod_hours_initial, 1),
    photoperiod_hours_post_cycle: formatNumber(derived.photoperiod_hours_post_cycle, 1),
    cycle_ammonia_target_range: formatRange(calculatorDefaults.cycle_ammonia_target_ppm_range, 1),
    cycle_ammonia_max: formatNumber(calculatorDefaults.cycle_ammonia_max_ppm, 1),
    ammonia_ml_range: formatRange(dosingReference.ammonia_ml_range, 2),
    ammonia_solution_percent: formatNumber(ammoniaSolutionPercent ?? 'N/A', 0),
    weekly_wc_percent_range: formatRange(derived.weekly_water_change_percent_range, 0),
    weekly_wc_volume_l_range: formatRange(derived.weekly_water_change_volume_l_range, 1),
    gh_full_fill_g_range: formatRange(dosingReference.gh_full_fill_g_range, 2),
    gh_full_fill_g_target: formatNumber(ghFullFillTarget, 1),
    gh_wc_g_range: formatRange(dosingReference.gh_wc_g_range, 2),
    gh_wc_g_target: formatNumber(ghWcTarget, 1),
    kh_full_fill_g: formatNumber(dosingReference.kh_full_fill_g, 2),
    kh_wc_g_range: formatRange(dosingReference.kh_wc_g_range, 2),
    kh_wc_g_target: formatNumber(khWcTarget, 1),
    target_gh_range: formatRange(targets.gh_dgh?.target_range, 1),
    target_gh_dgh: formatNumber(targetGh, 1),
    target_kh_dkh: formatNumber(targetKh, 1),
    safe_ammonia_ppm: formatNumber(targets.ammonia_ppm?.target, 1),
    safe_nitrite_ppm: formatNumber(targets.nitrite_ppm?.target, 1),
    cycle_safe_ammonia_ppm: formatNumber(cycleSafe.ammonia, 1),
    cycle_safe_nitrite_ppm: formatNumber(cycleSafe.nitrite, 1),
    cycle_safe_ph_min: formatNumber(6.4, 1),
    fertilizer_start_ml_week: formatNumber(dosingReference.fertilizer_start_ml_week, 2),
    fertilizer_start_factor: formatNumber(calculatorDefaults.fertilizer_start_factor, 2),
    fertilizer_maint_ml_week_range: formatRange(dosingReference.fertilizer_maint_ml_week_range, 2),
    gh_remineralizer_name: getRoleName('gh_remineralizer'),
    kh_buffer_name: getRoleName('kh_buffer'),
    bacteria_starter_name: getRoleName('bacteria_starter'),
    conditioner_name: getRoleName('detoxifier_conditioner'),
    ammonia_source_name: getRoleName('ammonia_source'),
    fertilizer_micros_name: getRoleName('fertilizer_micros'),
    conditioner_full_dose: doseToString(conditionerFull),
    bacteria_full_dose: doseToString(bacteriaFull),
    bacteria_weekly_dose: doseToString(bacteriaWeekly),
    co2_schedule: dosingReference.co2_schedule || 'CO2 schedule unavailable'
  };
};

const renderTemplateText = (template, replacements) => {
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(replacements, key)) {
      return replacements[key];
    }
    return `{${key}}`;
  });
};

const shouldSkipTriggerInstruction = (text, roleMap) => {
  for (const { role, match } of TRIGGER_ONLY_KEYWORDS) {
    const product = roleMap[role];
    if (product && product.constraints?.requires_trigger && match.test(text)) {
      return true;
    }
  }
  return false;
};

const buildCatalogFromUserProducts = (userProducts = []) => {
  const effectMap = {
    gh_remineralizer: { effect_type: 'delta_GH_dGH', unit: 'dGH' },
    kh_buffer: { effect_type: 'delta_KH_dKH', unit: 'dKH' },
    fertilizer_micros: { effect_type: 'none', unit: 'support' },
    ammonia_source: { effect_type: 'target_TAN_ppm', unit: 'ppm' },
    bacteria_starter: { effect_type: 'bioaugmentation_support', unit: 'support' },
    detoxifier_conditioner: { effect_type: 'detox_support', unit: 'support' },
    water_clarifier: { effect_type: 'clarify_support', unit: 'support' },
    water_quality_support: { effect_type: 'none', unit: 'support' }
  };

  const bicarbonateDeltaKh = (doseAmount, perVolumeL) => {
    if (!doseAmount || !perVolumeL) return 0;
    const meqPerL = (doseAmount * 1000) / 84 / perVolumeL;
    return meqPerL / 0.357;
  };

  const ammoniaDeltaPpm = (doseAmount, perVolumeL, solutionPercent) => {
    if (!doseAmount || !perVolumeL) return 0;
    const percent = solutionPercent || 10;
    const ppmPerMlPerL = 200 * (percent / 10);
    const mlPerL = doseAmount / perVolumeL;
    return ppmPerMlPerL * mlPerL;
  };

  const products = userProducts.map((product) => {
    const category = ROLE_CATEGORIES[product.role];
    const effect = effectMap[product.role] || { effect_type: 'none', unit: 'support' };
    let strength = product.effect_value;
    if (product.role === 'fertilizer_micros') {
      strength = null;
    }
    if (product.role === 'kh_buffer' && product.bicarbonate) {
      strength = bicarbonateDeltaKh(product.dose_amount, product.per_volume_l);
    }
    if (product.role === 'ammonia_source' && product.pure_ammonia) {
      strength = ammoniaDeltaPpm(product.dose_amount, product.per_volume_l, product.ammonia_solution_percent);
    }
    return {
      product_id: product.role,
      display_name: product.name || product.role,
      category,
      dose_model: {
        dose_basis: 'per_volume',
        amount: product.dose_amount,
        unit: product.dose_unit,
        per_volume_l: product.per_volume_l,
        frequency_default: 'as_needed',
        scaling_rule: 'linear_by_volume',
        notes: null
      },
      effect_model: {
        effect_type: effect.effect_type,
        strength,
        strength_units: effect.unit,
        calculation_method: null,
        notes: null
      },
      constraints: {
        allowed_phases: null,
        requires_trigger: ['detoxifier_conditioner', 'water_clarifier', 'water_quality_support'].includes(product.role),
        warnings: []
      }
    };
  });

  return {
    version: 'user_products',
    catalog_id: 'user_products',
    products
  };
};

const generateChecklists = (phases) => {
  return phases.map((phase) => {
    const cadenceBuckets = Object.fromEntries(CADENCE_ORDER.map((cadence) => [cadence, []]));
    const taskAtoms = Array.isArray(phase.task_atoms) ? phase.task_atoms : [];
    for (const task of taskAtoms) {
      if (!task?.cadence) continue;
      if (!cadenceBuckets[task.cadence]) {
        cadenceBuckets[task.cadence] = [];
      }
      cadenceBuckets[task.cadence].push(task.text);
    }
    return {
      phase_id: phase.phase_id,
      phase_name: phase.phase_name,
      objectives: [...phase.objective_ids].sort(),
      cadence: cadenceBuckets
    };
  });
};

const matchesCondition = (when, context) => {
  if (!when) return true;
  if (when.any) {
    return when.any.some((entry) => matchesCondition(entry, context));
  }
  if (when.all) {
    return when.all.every((entry) => matchesCondition(entry, context));
  }
  if (when.not) {
    return !matchesCondition(when.not, context);
  }

  const matchValue = (actual, expected) => {
    if (Array.isArray(expected)) {
      return expected.includes(actual);
    }
    return actual === expected;
  };

  if (when.cycling_mode_in && !matchValue(context.cycling_mode, when.cycling_mode_in)) {
    return false;
  }
  if (when.substrate_in && !matchValue(context.substrate_type, when.substrate_in)) {
    return false;
  }
  if (when.dark_start_enabled !== undefined && context.dark_start_enabled !== when.dark_start_enabled) {
    return false;
  }
  if (when.recommended_dark_start !== undefined && context.recommended_dark_start !== when.recommended_dark_start) {
    return false;
  }
  if (when.user_dark_start_override !== undefined && context.user_dark_start_override !== when.user_dark_start_override) {
    return false;
  }
  if (when.dark_start_preference_in && !matchValue(context.dark_start_preference, when.dark_start_preference_in)) {
    return false;
  }
  if (when.co2_enabled !== undefined && context.co2_enabled !== when.co2_enabled) {
    return false;
  }
  if (when.plants_present !== undefined && context.plants_present !== when.plants_present) {
    return false;
  }
  if (when.shrimp_planned !== undefined && context.shrimp_planned !== when.shrimp_planned) {
    return false;
  }
  if (when.risk_tolerance_in && !matchValue(context.risk_tolerance, when.risk_tolerance_in)) {
    return false;
  }
  if (when.tap_kh_status_in && !matchValue(context.tap_kh_status, when.tap_kh_status_in)) {
    return false;
  }
  if (when.disinfectant_in && !matchValue(context.disinfectant, when.disinfectant_in)) {
    return false;
  }
  if (when.ammonia_available !== undefined && context.ammonia_available !== when.ammonia_available) {
    return false;
  }

  return true;
};

const buildPhasesFromRuleset = ({ ruleset, context, replacements }) => {
  if (!ruleset?.phases?.length) return [];
  const phases = [];
  const phaseOrder = [...ruleset.phases].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const phase of phaseOrder) {
    if (!matchesCondition(phase.when, context)) {
      continue;
    }

    const instruction_atoms = [];
    const task_atoms = [];
    const expected_behavior_atoms = [];
    const objective_ids = new Set(phase.objective_ids || []);
    const exit_checks = Array.isArray(phase.exit_checks) ? [...phase.exit_checks] : [];
    const addedInstructions = new Set();
    const addedTasks = new Set();

    const phaseRules = (ruleset.rules || []).filter((rule) => {
      if (rule.phase_ids && !rule.phase_ids.includes(phase.id)) return false;
      if (!matchesCondition(rule.when, context)) return false;
      if (Array.isArray(rule.requires_roles)) {
        const hasAll = rule.requires_roles.every((role) => context.roles_enabled.has(role));
        if (!hasAll) return false;
      }
      return true;
    });

    for (const rule of phaseRules) {
      if (Array.isArray(rule.objectives)) {
        for (const obj of rule.objectives) objective_ids.add(obj);
      }
      if (Array.isArray(rule.expected)) {
        for (const exp of rule.expected) expected_behavior_atoms.push(exp);
      }
      if (Array.isArray(rule.instructions)) {
        for (const instruction of rule.instructions) {
          const rendered = renderTemplateText(instruction.text, replacements);
          const key = rendered;
          if (addedInstructions.has(key)) continue;
          addedInstructions.add(key);
          instruction_atoms.push({
            id: `${rule.id}_i_${instruction_atoms.length}`,
            cadence: instruction.cadence || 'one_time',
            text: rendered
          });
        }
      }
      if (Array.isArray(rule.tasks)) {
        for (const task of rule.tasks) {
          const rendered = renderTemplateText(task.text, replacements);
          const key = `${task.cadence}:${rendered}`;
          if (addedTasks.has(key)) continue;
          addedTasks.add(key);
          task_atoms.push({
            id: `${rule.id}_t_${task_atoms.length}`,
            cadence: task.cadence,
            text: rendered,
            until_phase_id: task.until_phase_id || null
          });
        }
      }
    }

    phases.push({
      phase_id: phase.id,
      phase_name: phase.label,
      objective_ids: Array.from(objective_ids),
      instruction_atoms,
      task_atoms,
      expected_behavior_atoms,
      measurement_hooks: phase.measurement_hooks || [],
      exit_checks
    });
  }

  return phases;
};

const normalizeSetup = (setup, notes) => {
  const normalized = {
    user_preferences: {
      cycling_mode_preference: setup?.user_preferences?.cycling_mode_preference ?? 'auto',
      dark_start: setup?.user_preferences?.dark_start ?? 'auto',
      risk_tolerance: setup?.user_preferences?.risk_tolerance ?? 'low',
      goal_profile: setup?.user_preferences?.goal_profile ?? 'stability_first',
      photoperiod_hours_initial: setup?.user_preferences?.photoperiod_hours_initial ?? 6,
      photoperiod_hours_post_cycle: setup?.user_preferences?.photoperiod_hours_post_cycle ?? 8,
      units: setup?.user_preferences?.units ?? 'metric'
    },
    tank_profile: {
      tank_volume_l_gross: setup?.tank_profile?.tank_volume_l_gross ?? 0,
      net_volume_method: setup?.tank_profile?.net_volume_method ?? 'estimate_multiplier',
      estimated_net_multiplier: setup?.tank_profile?.estimated_net_multiplier ?? 0.85,
      net_water_volume_l: setup?.tank_profile?.net_water_volume_l,
      substrate: {
        type: setup?.tank_profile?.substrate?.type ?? 'inert',
        sand_cap_cm: setup?.tank_profile?.substrate?.sand_cap_cm ?? 2.0
      },
      filtration: {
        filter_model: setup?.tank_profile?.filtration?.filter_model ?? '',
        rated_flow_lph: setup?.tank_profile?.filtration?.rated_flow_lph ?? 0,
        flow_class: setup?.tank_profile?.filtration?.flow_class ?? 'medium'
      },
      co2: {
        enabled: setup?.tank_profile?.co2?.enabled ?? true,
        injection_type: setup?.tank_profile?.co2?.injection_type ?? 'diffuser',
        target_ph_drop: setup?.tank_profile?.co2?.target_ph_drop ?? 1.0,
        surface_agitation: setup?.tank_profile?.co2?.surface_agitation ?? 'gentle_ripple'
      },
      temperature_target_c: setup?.tank_profile?.temperature_target_c ?? [22, 24]
    },
    water_source_profile: {
      tap_ph: setup?.water_source_profile?.tap_ph ?? 7.0,
      tap_gh_dgh: setup?.water_source_profile?.tap_gh_dgh ?? 0,
      tap_kh_dkh: setup?.water_source_profile?.tap_kh_dkh ?? null,
      disinfectant: setup?.water_source_profile?.disinfectant ?? 'unknown',
      weekly_water_change_percent_target: setup?.water_source_profile?.weekly_water_change_percent_target ?? [25, 30]
    },
    biology_profile: {
      plants: {
        categories: setup?.biology_profile?.plants?.categories ?? [],
        demand_class: setup?.biology_profile?.plants?.demand_class ?? 'auto'
      },
      livestock_plan: {
        fish: setup?.biology_profile?.livestock_plan?.fish ?? [],
        shrimp: setup?.biology_profile?.livestock_plan?.shrimp ?? [],
        cleanup_crew: setup?.biology_profile?.livestock_plan?.cleanup_crew ?? []
      }
    },
    product_stack: {
      ammonia_source: {
        type: setup?.product_stack?.ammonia_source?.type ?? 'pure_ammonia',
        solution_percent: setup?.product_stack?.ammonia_source?.solution_percent ?? 10
      },
      selected_product_ids: setup?.product_stack?.selected_product_ids ?? [],
      user_products: setup?.product_stack?.user_products ?? []
    }
  };

  if (!normalized.tank_profile.tank_volume_l_gross) {
    notes.push({ type: 'warning', message: 'tank_profile.tank_volume_l_gross is missing or zero.' });
  }
  if (!normalized.water_source_profile.tap_gh_dgh && normalized.water_source_profile.tap_gh_dgh !== 0) {
    notes.push({ type: 'warning', message: 'water_source_profile.tap_gh_dgh is missing.' });
  }
  if (!Array.isArray(normalized.product_stack.selected_product_ids)) {
    notes.push({ type: 'warning', message: 'product_stack.selected_product_ids is missing or invalid.' });
    normalized.product_stack.selected_product_ids = [];
  }
  if (normalized.tank_profile.net_volume_method === 'explicit' && typeof normalized.tank_profile.net_water_volume_l !== 'number') {
    notes.push({ type: 'warning', message: 'tank_profile.net_water_volume_l is required when net_volume_method is explicit.' });
  }

  return normalized;
};

export const generatePlan = ({
  setup,
  productCatalog,
  enginePackage,
  protocolRuleset,
  userTargets,
  overrideAcknowledged = false,
  generatedAtIso = DEFAULT_GENERATED_AT_ISO
}) => {
  const notes = [];
  const normalizedSetup = normalizeSetup(setup, notes);
  const userProducts = normalizedSetup.product_stack.user_products || [];
  const enabledUserProducts = userProducts.filter((product) => product.enabled);
  const effectiveCatalog = enabledUserProducts.length ? buildCatalogFromUserProducts(enabledUserProducts) : productCatalog;
  const effectiveSelectedIds = enabledUserProducts.length
    ? enabledUserProducts.map((product) => product.role)
    : normalizedSetup.product_stack.selected_product_ids;
  const parameterLimits = enginePackage?.parameter_limits?.['parameter_limits.generic.json'] || {};
  const calculatorDefaults = enginePackage?.calculators?.['calculator.framework.json']?.defaults || {};
  const calculatorConstants = enginePackage?.calculators?.['calculator.framework.json']?.constants || {};

  const derivedNetVolume = deriveNetVolume(normalizedSetup.tank_profile);
  const weeklyWcPercentRange = normalizedSetup.water_source_profile.weekly_water_change_percent_target;
  const weeklyWcVolumeRange = deriveWeeklyWcRange(derivedNetVolume, weeklyWcPercentRange);

  const shrimpPlanned = (normalizedSetup.biology_profile.livestock_plan.shrimp || []).length > 0;
  const tapKh = normalizedSetup.water_source_profile.tap_kh_dkh;
  const tapKhStatus = tapKh === null || tapKh < 2 ? 'unknown_or_low' : 'ok';
  const ammoniaAvailable = normalizedSetup.product_stack.ammonia_source.type !== 'none'
    || enabledUserProducts.some((product) => product.role === 'ammonia_source');

  const cyclingDecisionContext = {
    cycling_mode_preference: normalizedSetup.user_preferences.cycling_mode_preference,
    shrimp_planned: shrimpPlanned,
    risk_tolerance: normalizedSetup.user_preferences.risk_tolerance,
    tap_kh_status: tapKhStatus,
    ammonia_available: ammoniaAvailable
  };

  const cyclingDecision = evaluateDecisionTable(
    enginePackage.decision_tables['cycling_mode.decision_table.json'],
    cyclingDecisionContext
  );

    const darkStartPreference = normalizedSetup.user_preferences.dark_start;
    const darkStartRequested = darkStartPreference === true;
  const darkDecisionContext = {
    dark_start: darkStartRequested,
    goal_profile: normalizedSetup.user_preferences.goal_profile,
    high_light: normalizedSetup.user_preferences.photoperiod_hours_initial >= 8,
    aquasoil: normalizedSetup.tank_profile.substrate.type === 'aquasoil'
  };

  const darkDecision = evaluateDecisionTable(
    enginePackage.decision_tables['dark_start.decision_table.json'],
    darkDecisionContext
  );

  const recommendedCyclingMode = cyclingDecision.recommended_cycling_mode || 'fishless_ammonia';
  const recommendedDarkStart = !!darkDecision.recommended_dark_start;
  const userSelectedDarkStart =
    darkStartPreference === 'auto' || darkStartPreference === undefined
      ? recommendedDarkStart
      : !!darkStartPreference;
  const userSelectedCyclingMode =
    normalizedSetup.user_preferences.cycling_mode_preference !== 'auto'
      ? normalizedSetup.user_preferences.cycling_mode_preference
      : recommendedCyclingMode;

  const overrideContext = {
    user_selected_cycling_mode: userSelectedCyclingMode,
    recommended_cycling_mode: recommendedCyclingMode,
    risk_score_1_to_5: cyclingDecision.risk_score_1_to_5 ?? 2
  };
  const requiresOverrideAcknowledgement = evaluateOverridePolicy(
    enginePackage.decision_tables['override.policy.json'],
    overrideContext
  );

  if (requiresOverrideAcknowledgement && !overrideAcknowledged) {
    notes.push({
      type: 'blocking',
      message: enginePackage.decision_tables['override.policy.json'].acknowledgement_text
    });
  }

  const mapUserTargets = (targets) => {
    if (!targets) return null;
    return {
      temperature_c: { target_range: [targets.temperature.min, targets.temperature.max] },
      ph_co2_on: { target_range: [targets.pH.min, targets.pH.max] },
      gh_dgh: { target_range: [targets.gh.min, targets.gh.max], target: (targets.gh.min + targets.gh.max) / 2 },
      kh_dkh: { target_range: [targets.kh.min, targets.kh.max], target: (targets.kh.min + targets.kh.max) / 2 },
      ammonia_ppm: { target: targets.ammonia },
      nitrite_ppm: { target: targets.nitrite },
      nitrate_ppm: { target_range: [targets.nitrate.min, targets.nitrate.max] }
    };
  };
  const effectiveTargets = mapUserTargets(userTargets) || parameterLimits;
  const targetGhRange = effectiveTargets.gh_dgh?.target_range
    || [parameterLimits.gh_dgh?.min ?? 0, parameterLimits.gh_dgh?.max ?? 0];
  const targetKh = effectiveTargets.kh_dkh?.target
    ?? effectiveTargets.kh_dkh?.max
    ?? parameterLimits.kh_dkh?.max
    ?? 0;

  const ammoniaSolutionPercent = (() => {
    const userAmmonia = enabledUserProducts.find(
      (product) => product.role === 'ammonia_source'
    );
    if (userAmmonia?.ammonia_solution_percent) {
      return userAmmonia.ammonia_solution_percent;
    }
    return normalizedSetup.product_stack.ammonia_source.solution_percent;
  })();
  const ammoniaTargetRange = calculatorDefaults.cycle_ammonia_target_ppm_range || [1.5, 2.0];
  const ammoniaMlRange = ammoniaTargetRange.map((target) =>
    calcAmmoniaMl(
      derivedNetVolume,
      target,
      ammoniaSolutionPercent,
      calculatorConstants.ammonia_calibration
    )
  );
  if (ammoniaMlRange.some((value) => value === null)) {
    notes.push({
      type: 'warning',
      message: `Ammonia dosing requires calibration for solution_percent ${ammoniaSolutionPercent}.`
    });
  }

  const ghFullFillRange = calcGhGRange(
    normalizedSetup.water_source_profile.tap_gh_dgh,
    targetGhRange,
    derivedNetVolume,
    calculatorConstants.gh_remineralizer.g_per_l_per_1_dgh
  );

  const ghWcLow = calcGhGRange(
    normalizedSetup.water_source_profile.tap_gh_dgh,
    targetGhRange,
    weeklyWcVolumeRange[0],
    calculatorConstants.gh_remineralizer.g_per_l_per_1_dgh
  );

  const ghWcHigh = calcGhGRange(
    normalizedSetup.water_source_profile.tap_gh_dgh,
    targetGhRange,
    weeklyWcVolumeRange[1],
    calculatorConstants.gh_remineralizer.g_per_l_per_1_dgh
  );
  const ghWcRange = [ghWcLow[0], ghWcHigh[1]];

  const tapKhValue = normalizedSetup.water_source_profile.tap_kh_dkh ?? 0;
  if (normalizedSetup.water_source_profile.tap_kh_dkh === null) {
    notes.push({ type: 'warning', message: 'Tap KH is unknown; test before dosing KH buffer.' });
  }

  const khFullFillG = calcKhG(
    tapKhValue,
    targetKh,
    derivedNetVolume,
    calculatorConstants.kh_buffer_rule_of_thumb.g_per_10l_per_1_dkh
  );

  const khWcRange = deriveWeeklyWcRange(derivedNetVolume, weeklyWcPercentRange).map((volume) =>
    calcKhG(
      tapKhValue,
      targetKh,
      volume,
      calculatorConstants.kh_buffer_rule_of_thumb.g_per_10l_per_1_dkh
    )
  );

  const fertilizerStartMl = calcFertilizerMlWeek(
    derivedNetVolume,
    calculatorDefaults.fertilizer_start_factor,
    calculatorConstants.fertilizer_micros_label
  );

  const fertilizerMaintRange = calculatorDefaults.fertilizer_maint_factor_range.map((factor) =>
    calcFertilizerMlWeek(derivedNetVolume, factor, calculatorConstants.fertilizer_micros_label)
  );

  const dosingReference = {
    cycle_ammonia_target_range: ammoniaTargetRange,
    cycle_ammonia_max: calculatorDefaults.cycle_ammonia_max_ppm,
    ammonia_solution_percent: ammoniaSolutionPercent,
    ammonia_ml_range: ammoniaMlRange.map((value) => (value === null ? null : roundTo(value, 2))),
    gh_full_fill_g_range: ghFullFillRange.map((value) => roundTo(value, 2)),
    gh_wc_g_range: ghWcRange.map((value) => roundTo(value, 2)),
    kh_full_fill_g: roundTo(khFullFillG, 2),
    kh_wc_g_range: khWcRange.map((value) => roundTo(value, 2)),
    fertilizer_start_ml_week: roundTo(fertilizerStartMl, 2),
    fertilizer_maint_ml_week_range: fertilizerMaintRange.map((value) => roundTo(value, 2)),
    co2_schedule: `CO2 on ${calculatorDefaults.co2_on_lead_hours}h before lights, off ${calculatorDefaults.co2_off_lead_hours}h before lights off.`
  };

  const targets = {
    ...parameterLimits,
    ...effectiveTargets
  };

  const roleMap = selectProductsByRole(
    effectiveCatalog,
    effectiveSelectedIds,
    notes
  );

  Object.entries(roleMap).forEach(([role, product]) => {
    if (product?.constraints?.requires_trigger) {
      notes.push({
        type: 'trigger_only',
        role,
        message: `Use ${role} only when specifically needed; do not schedule routinely.`
      });
    }
    if (product?.constraints?.warnings) {
      for (const warning of product.constraints.warnings) {
        notes.push({ type: 'warning', role, message: warning });
      }
    }
  });

  const replacements = buildPlaceholderMap({
    derived: {
      net_water_volume_l: derivedNetVolume,
      weekly_water_change_percent_range: weeklyWcPercentRange,
      weekly_water_change_volume_l_range: weeklyWcVolumeRange,
      photoperiod_hours_initial: normalizedSetup.user_preferences.photoperiod_hours_initial,
      photoperiod_hours_post_cycle: normalizedSetup.user_preferences.photoperiod_hours_post_cycle
    },
    dosingReference,
    targets,
    calculatorDefaults,
    ammoniaSolutionPercent,
    roleMap,
    cyclingMode: userSelectedCyclingMode
  });

  const ruleset = protocolRuleset || enginePackage.protocol_ruleset;
  const rulesContext = {
    cycling_mode: userSelectedCyclingMode,
    dark_start_enabled: userSelectedDarkStart,
    recommended_dark_start: recommendedDarkStart,
    user_dark_start_override: userSelectedDarkStart !== recommendedDarkStart,
    dark_start_preference: darkStartPreference ?? 'auto',
    substrate_type: normalizedSetup.tank_profile.substrate.type,
    co2_enabled: normalizedSetup.tank_profile.co2.enabled,
    plants_present: (normalizedSetup.biology_profile.plants?.species || []).length > 0,
    shrimp_planned: shrimpPlanned,
    risk_tolerance: normalizedSetup.user_preferences.risk_tolerance,
    tap_kh_status: tapKhStatus,
    disinfectant: normalizedSetup.water_source_profile.disinfectant,
    ammonia_available: ammoniaAvailable,
    roles_enabled: new Set(Object.entries(roleMap).filter(([, product]) => !!product).map(([role]) => role))
  };

  let phases = buildPhasesFromRuleset({
    ruleset,
    context: rulesContext,
    replacements
  });

  if (!phases.length) {
    const templatePackId = userSelectedCyclingMode === 'fish_in'
      ? 'template.pack.fish_in_v1.json'
      : 'template.pack.inert_fishless_v1.json';

    const templatePack = enginePackage.templates?.[templatePackId];
    phases = (templatePack?.phases || []).map((phase) => {
      const instruction_atoms = [];
      for (const atom of phase.instruction_atoms) {
        const rendered = renderTemplateText(atom.text_template, replacements);
        if (shouldSkipTriggerInstruction(rendered, roleMap)) {
          continue;
        }
        instruction_atoms.push({
          id: atom.id,
          cadence: atom.cadence,
          text: rendered
        });
      }
      return {
        phase_id: phase.phase_id,
        phase_name: phase.phase_name,
        objective_ids: phase.objective_ids,
        instruction_atoms,
        expected_behavior_atoms: phase.expected_behavior_atoms,
        measurement_hooks: phase.measurement_hooks
      };
    });
  }

  const phase_checklists = generateChecklists(phases);

  return {
    meta: {
      setup_version: enginePackage.schemas['setup.schema.json'].version,
      plan_version: enginePackage.schemas['plan.output.schema.json'].version,
      generated_at_iso: generatedAtIso
    },
    selection: {
      recommended_cycling_mode: recommendedCyclingMode,
      user_selected_cycling_mode: userSelectedCyclingMode,
      recommended_dark_start: recommendedDarkStart,
      user_selected_dark_start: userSelectedDarkStart,
      risk_score_1_to_5: cyclingDecision.risk_score_1_to_5 ?? 2,
      reason_codes: cyclingDecision.reason_codes || [],
      requires_override_acknowledgement: requiresOverrideAcknowledgement,
      override_acknowledged: overrideAcknowledged,
      blocked: requiresOverrideAcknowledgement && !overrideAcknowledged
    },
    derived: {
      net_water_volume_l: roundTo(derivedNetVolume, 2),
      weekly_water_change_percent_range: weeklyWcPercentRange,
      weekly_water_change_volume_l_range: weeklyWcVolumeRange.map((value) => roundTo(value, 2)),
      photoperiod_hours_initial: normalizedSetup.user_preferences.photoperiod_hours_initial,
      photoperiod_hours_post_cycle: normalizedSetup.user_preferences.photoperiod_hours_post_cycle
    },
    global_reference: {
      targets,
      parameter_limits: parameterLimits,
      dosing_reference: dosingReference
    },
    phases,
    phase_checklists,
    worksheets: enginePackage.worksheets['worksheets.generic.json'],
    notes
  };
};

export {
  deriveNetVolume,
  deriveWeeklyWcRange,
  calcAmmoniaMl,
  calcGhGRange,
  calcKhG,
  calcFertilizerMlWeek
};
