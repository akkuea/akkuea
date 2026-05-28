/// Economic constants for Akkuea Land game engine.
///
/// Rental income formula (integer arithmetic only):
///   income = (BASE_RENTAL_RATE * multiplier_num / multiplier_den) * epochs_elapsed
///
/// Partial epochs do not generate income — only whole epochs count.
/// Rounding: integer division truncates toward zero, so any fractional
/// LAND within a single epoch is lost. This is consistent and intentional.

/// Number of ledgers per rental epoch.
pub const EPOCH_LENGTH: u64 = 100;

/// Base rental income per epoch for a vacant (level 0) property, in stroops.
/// 10 LAND with 7 decimal places = 10 * 10_000_000 = 100_000_000 stroops.
pub const BASE_RENTAL_RATE: i128 = 10 * 10_000_000;

// -- Improvement costs (in stroops) --

/// Cost to upgrade from Vacant (0) to Residential (1).
pub const IMPROVEMENT_COST_RESIDENTIAL: i128 = 200 * 10_000_000;

/// Cost to upgrade from Residential (1) to Commercial (2).
pub const IMPROVEMENT_COST_COMMERCIAL: i128 = 600 * 10_000_000;

/// Cost to upgrade from Commercial (2) to Skyscraper (3).
pub const IMPROVEMENT_COST_SKYSCRAPER: i128 = 1_800 * 10_000_000;

// -- Rental multipliers as integer ratios (numerator, denominator) --

/// Vacant: 1/1 = 1× base rate.
pub const MULTIPLIER_VACANT: (i128, i128) = (1, 1);

/// Residential: 3/2 = 1.5× base rate.
pub const MULTIPLIER_RESIDENTIAL: (i128, i128) = (3, 2);

/// Commercial: 3/1 = 3× base rate.
pub const MULTIPLIER_COMMERCIAL: (i128, i128) = (3, 1);

/// Skyscraper: 6/1 = 6× base rate.
pub const MULTIPLIER_SKYSCRAPER: (i128, i128) = (6, 1);

// -- Improvement level identifiers --

pub const LEVEL_VACANT: u32 = 0;
pub const LEVEL_RESIDENTIAL: u32 = 1;
pub const LEVEL_COMMERCIAL: u32 = 2;
pub const LEVEL_SKYSCRAPER: u32 = 3;

/// Returns the improvement cost for upgrading TO the given level.
pub fn improvement_cost(target_level: u32) -> i128 {
    match target_level {
        LEVEL_RESIDENTIAL => IMPROVEMENT_COST_RESIDENTIAL,
        LEVEL_COMMERCIAL => IMPROVEMENT_COST_COMMERCIAL,
        LEVEL_SKYSCRAPER => IMPROVEMENT_COST_SKYSCRAPER,
        _ => 0,
    }
}

/// Computes accrued rental income using integer arithmetic only.
///
/// `current_ledger` — the current ledger sequence number.
/// `last_claimed_ledger` — the ledger at which rent was last claimed.
/// `level` — the property improvement level (0–3).
///
/// Returns the claimable income in stroops.
pub fn calculate_accrued_income(current_ledger: u64, last_claimed_ledger: u64, level: u32) -> i128 {
    if current_ledger <= last_claimed_ledger {
        return 0;
    }

    let epochs_elapsed = (current_ledger - last_claimed_ledger) / EPOCH_LENGTH;
    if epochs_elapsed == 0 {
        return 0;
    }

    let (num, den) = match level {
        LEVEL_RESIDENTIAL => MULTIPLIER_RESIDENTIAL,
        LEVEL_COMMERCIAL => MULTIPLIER_COMMERCIAL,
        LEVEL_SKYSCRAPER => MULTIPLIER_SKYSCRAPER,
        _ => MULTIPLIER_VACANT,
    };

    (BASE_RENTAL_RATE * num / den) * epochs_elapsed as i128
}
