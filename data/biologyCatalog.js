const biologyCatalog = {
  catalog_version: "0.1",
  fish_groups: [
    {
      group_id: "tetras",
      display_name: "Tetras",
      typical_behavior: ["schooling"],
      typical_requirements: {
        temperature_c: [22, 27],
        ph: [6.0, 7.5],
        gh_dgh: [2, 10],
        kh_dkh: [1, 6]
      },
      common_examples: [
        "Neon tetra",
        "Cardinal tetra",
        "Ember tetra",
        "Black neon tetra",
        "Rummy-nose tetra",
        "Glowlight tetra"
      ]
    },
    {
      group_id: "rasboras_danios",
      display_name: "Rasboras & Danios",
      typical_behavior: ["schooling", "active_swimmers"],
      typical_requirements: {
        temperature_c: [20, 26],
        ph: [6.0, 7.5],
        gh_dgh: [2, 12],
        kh_dkh: [1, 8]
      },
      common_examples: [
        "Celestial pearl danio (Galaxy rasbora)",
        "Harlequin rasbora",
        "Chili rasbora",
        "Zebra danio",
        "Pearl danio"
      ]
    },
    {
      group_id: "livebearers",
      display_name: "Livebearers",
      typical_behavior: ["active", "often_prolific_breeders"],
      typical_requirements: {
        temperature_c: [22, 28],
        ph: [7.0, 8.2],
        gh_dgh: [8, 20],
        kh_dkh: [6, 15]
      },
      common_examples: [
        "Guppy",
        "Endler",
        "Platy",
        "Molly",
        "Swordtail"
      ]
    },
    {
      group_id: "corydoras",
      display_name: "Corydoras (armored catfish)",
      typical_behavior: ["shoaling", "bottom_dweller"],
      typical_requirements: {
        temperature_c: [22, 26],
        ph: [6.2, 7.6],
        gh_dgh: [2, 12],
        kh_dkh: [1, 8]
      },
      common_examples: [
        "Bronze corydoras",
        "Panda corydoras",
        "Peppered corydoras",
        "Pygmy corydoras",
        "Habrosus corydoras"
      ]
    },
    {
      group_id: "loaches",
      display_name: "Loaches",
      typical_behavior: ["bottom_dweller", "social (many species)"],
      typical_requirements: {
        temperature_c: [22, 28],
        ph: [6.0, 7.6],
        gh_dgh: [2, 15],
        kh_dkh: [1, 10]
      },
      common_examples: [
        "Kuhli loach",
        "Hillstream loach",
        "Clown loach",
        "Yoyo loach"
      ]
    },
    {
      group_id: "gourami_bettas",
      display_name: "Gourami & Betta relatives",
      typical_behavior: ["labyrinth_fish", "territorial (some species)"],
      typical_requirements: {
        temperature_c: [24, 30],
        ph: [6.0, 7.8],
        gh_dgh: [2, 15],
        kh_dkh: [1, 10]
      },
      common_examples: [
        "Betta splendens",
        "Honey gourami",
        "Dwarf gourami",
        "Pearl gourami"
      ]
    },
    {
      group_id: "cichlids_dwarf",
      display_name: "Dwarf Cichlids (South American/West African)",
      typical_behavior: ["territorial", "pairing/spawning"],
      typical_requirements: {
        temperature_c: [24, 28],
        ph: [5.5, 7.2],
        gh_dgh: [1, 8],
        kh_dkh: [0, 5]
      },
      common_examples: [
        "Apistogramma spp.",
        "Ram cichlid",
        "Kribensis"
      ]
    },
    {
      group_id: "cichlids_african_rift",
      display_name: "African Rift Lake Cichlids",
      typical_behavior: ["highly_territorial", "aggressive (often)"],
      typical_requirements: {
        temperature_c: [24, 27],
        ph: [7.8, 9.0],
        gh_dgh: [10, 25],
        kh_dkh: [10, 20]
      },
      common_examples: [
        "Mbuna (Lake Malawi)",
        "Peacocks (Aulonocara)",
        "Tanganyika shell dwellers"
      ]
    },
    {
      group_id: "plecos_otocinclus",
      display_name: "Algae grazers (Plecos, Otocinclus)",
      typical_behavior: ["grazer", "often_shy"],
      typical_requirements: {
        temperature_c: [22, 28],
        ph: [6.0, 7.6],
        gh_dgh: [2, 15],
        kh_dkh: [1, 10]
      },
      common_examples: [
        "Otocinclus",
        "Bristlenose pleco",
        "Clown pleco"
      ]
    },
    {
      group_id: "goldfish_coldwater",
      display_name: "Goldfish & Coldwater",
      typical_behavior: ["high_waste_output"],
      typical_requirements: {
        temperature_c: [18, 22],
        ph: [7.0, 8.2],
        gh_dgh: [6, 20],
        kh_dkh: [5, 15]
      },
      common_examples: [
        "Common goldfish",
        "Fancy goldfish",
        "White cloud mountain minnow"
      ]
    }
  ],
  shrimp_groups: [
    {
      group_id: "neocaridina",
      display_name: "Neocaridina (Cherry shrimp types)",
      typical_requirements: {
        temperature_c: [20, 26],
        ph: [6.5, 8.0],
        gh_dgh: [6, 12],
        kh_dkh: [2, 8]
      },
      common_examples: [
        "Cherry shrimp (red)",
        "Blue dream",
        "Yellow neon",
        "Rili variants"
      ]
    },
    {
      group_id: "caridina_bee",
      display_name: "Caridina (Bee/Crystal types)",
      typical_requirements: {
        temperature_c: [20, 24],
        ph: [5.8, 6.8],
        gh_dgh: [4, 6],
        kh_dkh: [0, 1]
      },
      common_examples: [
        "Crystal red",
        "Crystal black",
        "Panda",
        "King kong"
      ]
    },
    {
      group_id: "caridina_tigers",
      display_name: "Caridina (Tiger types)",
      typical_requirements: {
        temperature_c: [20, 24],
        ph: [6.0, 7.2],
        gh_dgh: [4, 8],
        kh_dkh: [0, 3]
      },
      common_examples: [
        "Tiger shrimp",
        "Orange eye blue tiger"
      ]
    },
    {
      group_id: "amano",
      display_name: "Amano shrimp",
      typical_requirements: {
        temperature_c: [20, 26],
        ph: [6.5, 7.8],
        gh_dgh: [4, 12],
        kh_dkh: [2, 8]
      },
      common_examples: [
        "Amano shrimp"
      ]
    },
    {
      group_id: "ghost_glass",
      display_name: "Ghost/Glass shrimp",
      typical_requirements: {
        temperature_c: [20, 26],
        ph: [6.5, 8.0],
        gh_dgh: [4, 12],
        kh_dkh: [2, 10]
      },
      common_examples: [
        "Ghost shrimp",
        "Glass shrimp"
      ]
    }
  ],
  plant_groups: [
    {
      group_id: "epiphytes",
      display_name: "Epiphytes (rhizome plants)",
      typical_requirements: {
        light: ["low", "medium"],
        co2: ["optional", "beneficial"],
        growth_rate: "slow"
      },
      common_examples: [
        "Anubias",
        "Bucephalandra",
        "Java fern (Microsorum)",
        "Bolbitis"
      ]
    },
    {
      group_id: "mosses",
      display_name: "Mosses",
      typical_requirements: {
        light: ["low", "medium"],
        co2: ["optional", "beneficial"],
        growth_rate: "slow_to_medium"
      },
      common_examples: [
        "Java moss",
        "Christmas moss",
        "Flame moss",
        "Weeping moss"
      ]
    },
    {
      group_id: "crypts",
      display_name: "Cryptocoryne",
      typical_requirements: {
        light: ["low", "medium"],
        co2: ["optional"],
        growth_rate: "slow_to_medium"
      },
      common_examples: [
        "Cryptocoryne wendtii",
        "Cryptocoryne parva",
        "Cryptocoryne lutea"
      ]
    },
    {
      group_id: "swords_rosettes",
      display_name: "Rosette plants (Swords etc.)",
      typical_requirements: {
        light: ["medium", "high"],
        co2: ["beneficial"],
        growth_rate: "medium",
        nutrients: ["root_feeding_common"]
      },
      common_examples: [
        "Amazon sword (Echinodorus)",
        "Helanthium tenellum (dwarf chain sword)"
      ]
    },
    {
      group_id: "stem_plants_easy",
      display_name: "Stem plants (easy)",
      typical_requirements: {
        light: ["medium"],
        co2: ["optional", "beneficial"],
        growth_rate: "fast"
      },
      common_examples: [
        "Hygrophila polysperma",
        "Ludwigia repens",
        "Rotala rotundifolia",
        "Bacopa caroliniana"
      ]
    },
    {
      group_id: "stem_plants_demanding",
      display_name: "Stem plants (demanding)",
      typical_requirements: {
        light: ["high"],
        co2: ["required"],
        growth_rate: "fast",
        nutrients: ["macros_required_common"]
      },
      common_examples: [
        "Rotala macrandra",
        "Alternanthera reineckii",
        "Pogostemon erectus"
      ]
    },
    {
      group_id: "carpeting",
      display_name: "Carpeting plants",
      typical_requirements: {
        light: ["medium", "high"],
        co2: ["beneficial", "often_required"],
        growth_rate: "medium",
        nutrients: ["often_macro_hungry"]
      },
      common_examples: [
        "Monte Carlo (Micranthemum tweediei)",
        "Dwarf hairgrass (Eleocharis)",
        "Glossostigma elatinoides"
      ]
    },
    {
      group_id: "floating_plants",
      display_name: "Floating plants",
      typical_requirements: {
        light: ["low", "medium", "high"],
        co2: ["not_required"],
        growth_rate: "fast",
        notes: ["excellent_nutrient_export"]
      },
      common_examples: [
        "Salvinia",
        "Frogbit (Limnobium)",
        "Red root floaters (Phyllanthus fluitans)",
        "Duckweed"
      ]
    },
    {
      group_id: "vallisneria_sagittaria",
      display_name: "Runners (Vallisneria/Sagittaria)",
      typical_requirements: {
        light: ["low", "medium"],
        co2: ["optional"],
        growth_rate: "medium"
      },
      common_examples: [
        "Vallisneria spiralis",
        "Vallisneria nana",
        "Sagittaria subulata"
      ]
    }
  ]
};

export default biologyCatalog;
