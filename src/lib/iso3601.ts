export type OringClass = 'A' | 'B';

interface ToleranceBand {
	minNominal: number; // exclusive lower bound (mm), >
	maxNominal: number; // inclusive upper bound (mm), <=
	upperTol: number;
	lowerTol: number;
}

// ── Class A: Grade N (symmetric ±) ────────────────────────────────

const CS_TOL_A: ToleranceBand[] = [
	{ minNominal: 0, maxNominal: 1.02, upperTol: 0.07, lowerTol: -0.07 },
	{ minNominal: 1.02, maxNominal: 1.78, upperTol: 0.08, lowerTol: -0.08 },
	{ minNominal: 1.78, maxNominal: 2.62, upperTol: 0.09, lowerTol: -0.09 },
	{ minNominal: 2.62, maxNominal: 3.53, upperTol: 0.10, lowerTol: -0.10 },
	{ minNominal: 3.53, maxNominal: 5.33, upperTol: 0.13, lowerTol: -0.13 },
	{ minNominal: 5.33, maxNominal: 7.00, upperTol: 0.15, lowerTol: -0.15 },
	{ minNominal: 7.00, maxNominal: 10.00, upperTol: 0.20, lowerTol: -0.20 }
];

const ID_TOL_A: ToleranceBand[] = [
	{ minNominal: 0, maxNominal: 3.00, upperTol: 0.12, lowerTol: -0.12 },
	{ minNominal: 3.00, maxNominal: 6.00, upperTol: 0.15, lowerTol: -0.15 },
	{ minNominal: 6.00, maxNominal: 10.00, upperTol: 0.18, lowerTol: -0.18 },
	{ minNominal: 10.00, maxNominal: 18.00, upperTol: 0.22, lowerTol: -0.22 },
	{ minNominal: 18.00, maxNominal: 25.00, upperTol: 0.25, lowerTol: -0.25 },
	{ minNominal: 25.00, maxNominal: 31.50, upperTol: 0.30, lowerTol: -0.30 },
	{ minNominal: 31.50, maxNominal: 40.00, upperTol: 0.35, lowerTol: -0.35 },
	{ minNominal: 40.00, maxNominal: 50.00, upperTol: 0.38, lowerTol: -0.38 },
	{ minNominal: 50.00, maxNominal: 63.00, upperTol: 0.45, lowerTol: -0.45 },
	{ minNominal: 63.00, maxNominal: 80.00, upperTol: 0.52, lowerTol: -0.52 },
	{ minNominal: 80.00, maxNominal: 100.00, upperTol: 0.60, lowerTol: -0.60 },
	{ minNominal: 100.00, maxNominal: 125.00, upperTol: 0.70, lowerTol: -0.70 },
	{ minNominal: 125.00, maxNominal: 160.00, upperTol: 0.85, lowerTol: -0.85 },
	{ minNominal: 160.00, maxNominal: 200.00, upperTol: 0.95, lowerTol: -0.95 },
	{ minNominal: 200.00, maxNominal: 250.00, upperTol: 1.10, lowerTol: -1.10 },
	{ minNominal: 250.00, maxNominal: 315.00, upperTol: 1.30, lowerTol: -1.30 },
	{ minNominal: 315.00, maxNominal: 400.00, upperTol: 1.50, lowerTol: -1.50 },
	{ minNominal: 400.00, maxNominal: 500.00, upperTol: 1.70, lowerTol: -1.70 },
	{ minNominal: 500.00, maxNominal: Infinity, upperTol: 1.80, lowerTol: -1.80 }
];

// ── Class B: Grade S (CS) and Grade B (ID) — asymmetric +/0 ──────

const CS_TOL_B: ToleranceBand[] = [
	{ minNominal: 0, maxNominal: 1.02, upperTol: 0.10, lowerTol: 0 },
	{ minNominal: 1.02, maxNominal: 1.78, upperTol: 0.10, lowerTol: 0 },
	{ minNominal: 1.78, maxNominal: 2.62, upperTol: 0.13, lowerTol: 0 },
	{ minNominal: 2.62, maxNominal: 3.53, upperTol: 0.13, lowerTol: 0 },
	{ minNominal: 3.53, maxNominal: 5.33, upperTol: 0.15, lowerTol: 0 },
	{ minNominal: 5.33, maxNominal: 7.00, upperTol: 0.20, lowerTol: 0 },
	{ minNominal: 7.00, maxNominal: 10.00, upperTol: 0.25, lowerTol: 0 }
];

const ID_TOL_B: ToleranceBand[] = [
	{ minNominal: 0, maxNominal: 3.00, upperTol: 0.15, lowerTol: 0 },
	{ minNominal: 3.00, maxNominal: 6.00, upperTol: 0.20, lowerTol: 0 },
	{ minNominal: 6.00, maxNominal: 10.00, upperTol: 0.25, lowerTol: 0 },
	{ minNominal: 10.00, maxNominal: 18.00, upperTol: 0.30, lowerTol: 0 },
	{ minNominal: 18.00, maxNominal: 25.00, upperTol: 0.35, lowerTol: 0 },
	{ minNominal: 25.00, maxNominal: 31.50, upperTol: 0.40, lowerTol: 0 },
	{ minNominal: 31.50, maxNominal: 40.00, upperTol: 0.45, lowerTol: 0 },
	{ minNominal: 40.00, maxNominal: 50.00, upperTol: 0.50, lowerTol: 0 },
	{ minNominal: 50.00, maxNominal: 63.00, upperTol: 0.60, lowerTol: 0 },
	{ minNominal: 63.00, maxNominal: 80.00, upperTol: 0.70, lowerTol: 0 },
	{ minNominal: 80.00, maxNominal: 100.00, upperTol: 0.80, lowerTol: 0 },
	{ minNominal: 100.00, maxNominal: 125.00, upperTol: 0.90, lowerTol: 0 },
	{ minNominal: 125.00, maxNominal: 160.00, upperTol: 1.00, lowerTol: 0 },
	{ minNominal: 160.00, maxNominal: 200.00, upperTol: 1.20, lowerTol: 0 },
	{ minNominal: 200.00, maxNominal: 250.00, upperTol: 1.40, lowerTol: 0 },
	{ minNominal: 250.00, maxNominal: 315.00, upperTol: 1.60, lowerTol: 0 },
	{ minNominal: 315.00, maxNominal: 400.00, upperTol: 1.80, lowerTol: 0 },
	{ minNominal: 400.00, maxNominal: 500.00, upperTol: 2.00, lowerTol: 0 },
	{ minNominal: 500.00, maxNominal: Infinity, upperTol: 2.20, lowerTol: 0 }
];

function findBand(
	nominal: number,
	bands: ToleranceBand[]
): { upper: number; lower: number } | null {
	for (const band of bands) {
		if (nominal > band.minNominal && nominal <= band.maxNominal) {
			return { upper: band.upperTol, lower: band.lowerTol };
		}
	}
	return null;
}

/**
 * Look up ISO 3601-1 tolerance for a cross-section diameter (mm).
 * Class A = Grade N (symmetric ±), Class B = Grade S (asymmetric +/0).
 */
export function lookupCSTolerance(nominal: number, cls: OringClass = 'A'): { upper: number; lower: number } | null {
	return findBand(nominal, cls === 'A' ? CS_TOL_A : CS_TOL_B);
}

/**
 * Look up ISO 3601-1 tolerance for an inner diameter (mm).
 * Class A = Grade N (symmetric ±), Class B = Grade B (asymmetric +/0).
 */
export function lookupIDTolerance(nominal: number, cls: OringClass = 'A'): { upper: number; lower: number } | null {
	return findBand(nominal, cls === 'A' ? ID_TOL_A : ID_TOL_B);
}
