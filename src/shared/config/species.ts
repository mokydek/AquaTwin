// Aquaculture species catalog. Values are approximate husbandry guidance for an
// MVP, not scientific constants. Display names live in i18n under species.*.

export const SPECIES_LIST = ['tilapia', 'trout', 'sturgeon', 'carp', 'catfish'] as const

export type Species = (typeof SPECIES_LIST)[number]

export type SpeciesConfig = {
  // optimal water temperature range in Celsius
  tempMin: number
  tempMax: number
  // maximum safe stocking density in kg per cubic metre
  maxDensityKgM3: number
  // recommended daily feed as a percent of biomass
  feedPercent: number
  // typical harvest weight in grams
  harvestWeightG: number
}

export const SPECIES: Record<Species, SpeciesConfig> = {
  tilapia: { tempMin: 24, tempMax: 30, maxDensityKgM3: 30, feedPercent: 2.5, harvestWeightG: 500 },
  trout: { tempMin: 12, tempMax: 18, maxDensityKgM3: 25, feedPercent: 1.8, harvestWeightG: 350 },
  sturgeon: { tempMin: 18, tempMax: 24, maxDensityKgM3: 40, feedPercent: 1.5, harvestWeightG: 2000 },
  carp: { tempMin: 20, tempMax: 28, maxDensityKgM3: 25, feedPercent: 2.5, harvestWeightG: 1500 },
  catfish: { tempMin: 25, tempMax: 30, maxDensityKgM3: 80, feedPercent: 3.0, harvestWeightG: 800 },
}
