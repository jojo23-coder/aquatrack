Fertilizer param sandbox

Status
- Switched fertilizer group to a single parameterized atom.
- Created sandbox outputs:
  - tmp-json/param-sandbox/fertilizer/fertilizer-atoms.param.json
  - tmp-json/param-sandbox/fertilizer/fertilizer-playlists.param.json

Current param atom design
- Atom: t_fert_dose
  - args: cadence (one_time|weekly), dose (half|full|maintenance)
  - text_variants maps dose -> text_template
  - cadence overridden by args

Proposed playlist logic gates
- Add optional "when" field to playlist items for conditional inclusion.
  Example:
  {"id":"t_fert_dose","when":"products.fertilizer_micros.contains_nitrogen == true","args":{"cadence":"weekly","dose":"half"}}

Engine changes needed (future)
- Allow playlist sequence items to be objects {id, args, when}.
- Evaluate "when" using existing evaluateTemplateCondition.
- Merge args into atom fields:
  - cadence override
  - text variant selection (text_variants[args.dose])
- Support args in templates as {{args.*}} (optional).

Follow-up
- Validate fertilizer contains nitrogen data source (products.* field) before enabling condition.
- Pick next group for parameterization (lighting or water changes).
- Lighting sandbox: removed i_light_on_6h_for_plants; use i_light_ramp_plan instead.
- Expected sandbox: merged e_stock_new_fish_stress + e_stock_new_shrimp_stress into e_stock_new_stress (args.livestock).
- Lighting sandbox: normalized plant_demand to low/high; removed medium from args_schema. Engine should map medium -> low.
- Expected sandbox: combined hardscape expected into e_hardscape_expected (args.type) and livestock expected into e_stock_expected (args.variant) with playlist when gates.
- Expected sandbox: e_stock_expected now uses args.stock (fish|shrimp|both) and bundles all related text into one rendered item.
- Expected sandbox: e_stock_expected text_variants now arrays; engine should join with "\n\n" for display.
- Expected sandbox: moved e_cycle_ph_crash_warning -> i_cycle_ph_crash_warning (instruction).
- Intro sandbox: renamed intro IDs to phase-labeled scheme and replaced duration atoms with param i_intro_duration (args.days).
- Intro sandbox: added DS4/DS5 intro atoms and inserted into DS4@401 and DS5@501 playlists.
- Chem sandbox: parameterized t_chem_test; due_offset_days stays on playlist entries (Option A).
- Chem sandbox: added playlist-level when guards for t_chem_test based on setup.can_test_*.
- CO2 sandbox: parameterized CO2 targets (i_co2_target), off guidance (i_co2_off_guidance), and turn on (t_co2_turn_on).
- CO2 sandbox: merged i_co2_off_guidance variants into single reason=off.
- CO2 sandbox: de-parameterized i_co2_off_guidance (single variant).
- CO2 sandbox: de-parameterized t_co2_turn_on (standard only).
- CO2 sandbox: removed i_co2_start_high_saturation_fishless; replaced with i_co2_target (lime_green).
- CO2 sandbox: removed setup.co2_enabled conditions from atoms; added playlist-level when guards.
- Equipment sandbox: moved heater conditions from atoms to playlist when guards.
- Plants sandbox: combined i_plant_prep_remove_wool + i_plant_mist_during_setup into i_plants_prep with array variant.
- Plants sandbox: shortened plant atom names (dense, epiphytes, stems, root_tabs) and updated playlists.
- Plants sandbox: i_plants_prep now a single atom with array text_template; playlist entries are plain string IDs.
- Plants sandbox: moved plant atom conditions to playlist-level when guards.
- Stocking sandbox: combined acclimation, feeding guidance, detox, and timing atoms into parameterized forms.
- Stocking sandbox: moved stocking conditions to playlist-level when guards (fish/shrimp/detox).
- Stocking sandbox: folded day-3 acclimation into t_stock_acclimate args.due_offset_days, restored i_stock_ds_timing single atom, removed i_stock_feed_guidance initial variant.
- Hardscape/Substrate sandbox: created from data/atom-library.json + data/phase-playlists.lookup.json and extracted i_hard_*, t_hard_*, i_sub_*, t_sub_* atoms/playlists.
- Hardscape/Substrate sandbox: parameterized hardscape and substrate prep atoms, moved conditions to playlist when guards, and normalized PA1 to include tips/finalize layout.
- Maintenance sandbox: created from data/atom-library.json + data/phase-playlists.lookup.json and extracted i_maint_*, t_maint_* atoms/playlists.
- Maintenance sandbox: combined weekly prep tasks into t_maint_prep and moved maint conditions to playlist when guards.
- Water sandbox: created from data/atom-library.json + data/phase-playlists.lookup.json and extracted i_water_*, t_water_* atoms/playlists.
- Water sandbox: combined full-fill dosing tasks into t_water_fill_dose and moved water conditions to playlist when guards.
- Chem sandbox: moved i_chem_nitrite_watch and i_chem_nitrate_progress_check conditions to playlist when guards in param outputs.
- Expected sandbox: moved e_plant_melt_high_ammonia and e_chem_nitrate_fert_high_note conditions to playlist when guards in param outputs.
- Intros sandbox: moved PA1 fertilizer intro conditions to playlist when guards in param outputs.
- Fertilizer sandbox: used fertilizer-atoms.param.json, removed atom conditions, moved to playlist when guards, and mapped maintenance dose to full.
- Cycle sandbox: created from data/atom-library.json + data/phase-playlists.lookup.json and extracted i_cycle_*, t_cycle_* atoms/playlists.
- Cycle sandbox: moved cycle atom conditions to playlist when guards.
- Complete sandbox: merged refactored atoms/playlists into tmp-json/param-sandbox/complete with no missing IDs.
