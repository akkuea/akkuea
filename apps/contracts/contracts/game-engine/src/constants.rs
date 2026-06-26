pub const EPOCH_LENGTH: u64 = 100;
pub const BASE_RENTAL_RATE: i128 = 10 * 10_000_000; // 10 LAND per epoch (7 decimals)

pub const IMPROVEMENT_COST_RESIDENTIAL: i128 = 200 * 10_000_000;
pub const IMPROVEMENT_COST_COMMERCIAL: i128 = 600 * 10_000_000;
pub const IMPROVEMENT_COST_SKYSCRAPER: i128 = 1_800 * 10_000_000;

// Rental multipliers as integer ratios (numerator, denominator)
pub const MULTIPLIER_VACANT: (i128, i128) = (1, 1);
pub const MULTIPLIER_RESIDENTIAL: (i128, i128) = (3, 2); // 1.5x
pub const MULTIPLIER_COMMERCIAL: (i128, i128) = (3, 1); // 3x
pub const MULTIPLIER_SKYSCRAPER: (i128, i128) = (6, 1); // 6x

pub const LEVEL_VACANT: u32 = 0;
pub const LEVEL_RESIDENTIAL: u32 = 1;
pub const LEVEL_COMMERCIAL: u32 = 2;
pub const LEVEL_SKYSCRAPER: u32 = 3;
