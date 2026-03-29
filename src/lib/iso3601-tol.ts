export type OringClass = 'A' | 'B' | 'Aero';

interface ToleranceBand {
	maxNominal: number; // inclusive upper bound (mm), nominal > prev && nominal <= this
	tol: number; // symmetric ± tolerance
}

// ── CS tolerance Class A ──────────────────────────────────────────

const CS_TOL_A: ToleranceBand[] = [
	{ maxNominal: 1.02, tol: 0.08 },
	{ maxNominal: 1.78, tol: 0.08 },
	{ maxNominal: 2.62, tol: 0.08 },
	{ maxNominal: 3.53, tol: 0.1 },
	{ maxNominal: 5.33, tol: 0.13 },
	{ maxNominal: 6.99, tol: 0.15 }
];

// ── CS tolerance Class B ──────────────────────────────────────────

const CS_TOL_B: ToleranceBand[] = [
	{ maxNominal: 1.02, tol: 0.08 },
	{ maxNominal: 1.78, tol: 0.08 },
	{ maxNominal: 2.62, tol: 0.09 },
	{ maxNominal: 3.53, tol: 0.1 },
	{ maxNominal: 5.33, tol: 0.13 },
	{ maxNominal: 6.99, tol: 0.15 }
];

// ── CS tolerance Aero ──────────────────────────────────────────

const CS_TOL_AERO: ToleranceBand[] = [
	{ maxNominal: 1.8, tol: 0.08 },
	{ maxNominal: 2.65, tol: 0.09 },
	{ maxNominal: 3.55, tol: 0.1 },
	{ maxNominal: 5.3, tol: 0.13 },
	{ maxNominal: 7.0, tol: 0.15 }
];

// ── CS tolerance Non-STD A ──────────────────────────────────────────

const CS_TOL_NSTDA: ToleranceBand[] = [
	{ maxNominal: 3.15, tol: 0.08 },
	{ maxNominal: 4.5, tol: 0.1 },
	{ maxNominal: 6.3, tol: 0.13 },
	{ maxNominal: 8.4, tol: 0.15 }
];

// ── CS tolerance Non-STD B ──────────────────────────────────────────

const CS_TOL_NSTDB: ToleranceBand[] = [
	{ maxNominal: 2.25, tol: 0.08 },
	{ maxNominal: 3.15, tol: 0.09 },
	{ maxNominal: 4.5, tol: 0.1 },
	{ maxNominal: 6.3, tol: 0.13 },
	{ maxNominal: 8.4, tol: 0.15 }
];

// ── ID tolerance Class A - 1.02 / 1.27 / 1.52 / 1.78 ──────────────────────────────────────────

const ID_TOL_A_178: ToleranceBand[] = [
	{ maxNominal: 1.42, tol: 0.1 },
	{ maxNominal: 12.42, tol: 0.13 },
	{ maxNominal: 14.0, tol: 0.18 },
	{ maxNominal: 23.52, tol: 0.23 },
	{ maxNominal: 28.3, tol: 0.25 },
	{ maxNominal: 33.05, tol: 0.28 },
	{ maxNominal: 41.0, tol: 0.33 },
	{ maxNominal: 47.35, tol: 0.38 },
	{ maxNominal: 63.22, tol: 0.46 },
	{ maxNominal: 72.75, tol: 0.51 },
	{ maxNominal: 88.62, tol: 0.61 },
	{ maxNominal: 101.32, tol: 0.69 },
	{ maxNominal: 120.37, tol: 0.76 },
	{ maxNominal: 133.07, tol: 0.94 }
];

// ── ID tolerance Class A - 2.62 ──────────────────────────────────────────

const ID_TOL_A_262: ToleranceBand[] = [
	{ maxNominal: 12.37, tol: 0.13 },
	{ maxNominal: 13.94, tol: 0.18 },
	{ maxNominal: 18.72, tol: 0.23 },
	{ maxNominal: 28.24, tol: 0.25 },
	{ maxNominal: 37.77, tol: 0.3 },
	{ maxNominal: 47.29, tol: 0.38 },
	{ maxNominal: 56.82, tol: 0.43 },
	{ maxNominal: 66.34, tol: 0.51 },
	{ maxNominal: 72.69, tol: 0.56 },
	{ maxNominal: 88.57, tol: 0.61 },
	{ maxNominal: 101.27, tol: 0.71 },
	{ maxNominal: 120.32, tol: 0.76 },
	{ maxNominal: 152.07, tol: 0.89 },
	{ maxNominal: 177.47, tol: 1.02 },
	{ maxNominal: 202.87, tol: 1.14 },
	{ maxNominal: 228.27, tol: 1.27 },
	{ maxNominal: 247.32, tol: 1.4 }
];

// ── ID tolerance Class A - 3.53 ──────────────────────────────────────────

const ID_TOL_A_353: ToleranceBand[] = [
	{ maxNominal: 12.29, tol: 0.13 },
	{ maxNominal: 13.87, tol: 0.18 },
	{ maxNominal: 17.04, tol: 0.23 },
	{ maxNominal: 26.57, tol: 0.25 },
	{ maxNominal: 36.09, tol: 0.3 },
	{ maxNominal: 44.04, tol: 0.38 },
	{ maxNominal: 53.57, tol: 0.46 },
	{ maxNominal: 88.49, tol: 0.61 },
	{ maxNominal: 104.37, tol: 0.71 },
	{ maxNominal: 120.24, tol: 0.76 },
	{ maxNominal: 151.99, tol: 0.89 },
	{ maxNominal: 177.39, tol: 1.02 },
	{ maxNominal: 202.79, tol: 1.14 },
	{ maxNominal: 228.19, tol: 1.27 },
	{ maxNominal: 266.29, tol: 1.4 },
	{ maxNominal: 380.59, tol: 1.65 },
	{ maxNominal: 405.26, tol: 1.91 },
	{ maxNominal: 430.66, tol: 2.03 },
	{ maxNominal: 456.06, tol: 2.16 }
];

// ── ID tolerance Class A - 5.33 ──────────────────────────────────────────

const ID_TOL_A_533: ToleranceBand[] = [
	{ maxNominal: 12.07, tol: 0.13 },
	{ maxNominal: 13.64, tol: 0.18 },
	{ maxNominal: 16.81, tol: 0.23 },
	{ maxNominal: 26.34, tol: 0.25 },
	{ maxNominal: 34.29, tol: 0.3 },
	{ maxNominal: 46.99, tol: 0.38 },
	{ maxNominal: 59.69, tol: 0.46 },
	{ maxNominal: 72.39, tol: 0.51 },
	{ maxNominal: 88.27, tol: 0.61 },
	{ maxNominal: 104.14, tol: 0.71 },
	{ maxNominal: 123.19, tol: 0.76 },
	{ maxNominal: 151.77, tol: 0.94 },
	{ maxNominal: 177.17, tol: 1.02 },
	{ maxNominal: 202.57, tol: 1.14 },
	{ maxNominal: 227.97, tol: 1.27 },
	{ maxNominal: 253.37, tol: 1.4 },
	{ maxNominal: 278.77, tol: 1.52 },
	{ maxNominal: 329.57, tol: 1.65 },
	{ maxNominal: 380.37, tol: 1.78 },
	{ maxNominal: 405.26, tol: 1.91 },
	{ maxNominal: 430.66, tol: 2.03 },
	{ maxNominal: 456.06, tol: 2.16 },
	{ maxNominal: 481.46, tol: 2.29 },
	{ maxNominal: 532.26, tol: 2.41 },
	{ maxNominal: 557.66, tol: 2.54 },
	{ maxNominal: 582.68, tol: 2.67 },
	{ maxNominal: 608.08, tol: 2.79 },
	{ maxNominal: 633.48, tol: 2.92 },
	{ maxNominal: 658.88, tol: 3.05 }
];

// ── ID tolerance Class A - 6.99 ──────────────────────────────────────────

const ID_TOL_A_699: ToleranceBand[] = [
	{ maxNominal: 123.19, tol: 0.84 },
	{ maxNominal: 151.77, tol: 0.94 },
	{ maxNominal: 177.17, tol: 1.02 },
	{ maxNominal: 202.57, tol: 1.14 },
	{ maxNominal: 253.37, tol: 1.4 },
	{ maxNominal: 329.57, tol: 1.52 },
	{ maxNominal: 393.07, tol: 1.78 },
	{ maxNominal: 417.96, tol: 1.91 },
	{ maxNominal: 430.66, tol: 2.03 },
	{ maxNominal: 468.76, tol: 2.16 },
	{ maxNominal: 494.16, tol: 2.29 },
	{ maxNominal: 532.26, tol: 2.41 },
	{ maxNominal: 557.66, tol: 2.54 },
	{ maxNominal: 582.68, tol: 2.67 },
	{ maxNominal: 608.08, tol: 2.79 },
	{ maxNominal: 633.48, tol: 2.92 },
	{ maxNominal: 658.88, tol: 3.05 }
];

// ── ID tolerance Class B ──────────────────────────────────────────
// ISO 3601-1:2012 Equation A.1: ±[(d1^0.95 × 0.009) + 0.11]

function classB_IDTolerance(d1: number): number {
	return Math.round((Math.pow(d1, 0.95) * 0.009 + 0.11) * 100) / 100;
}

// ── ID tolerance Non-STD A ──────────────────────────────────────────

const ID_TOL_NSTDA: ToleranceBand[] = [
	{ maxNominal: 1.53, tol: 0.1 },
	{ maxNominal: 11.69, tol: 0.13 },
	{ maxNominal: 13.46, tol: 0.15 },
	{ maxNominal: 17.53, tol: 0.18 },
	{ maxNominal: 20.57, tol: 0.2 },
	{ maxNominal: 23.88, tol: 0.23 },
	{ maxNominal: 28.7, tol: 0.25 },
	{ maxNominal: 35.56, tol: 0.3 },
	{ maxNominal: 43.18, tol: 0.36 },
	{ maxNominal: 50.8, tol: 0.41 },
	{ maxNominal: 58.42, tol: 0.46 },
	{ maxNominal: 66.55, tol: 0.51 },
	{ maxNominal: 74.93, tol: 0.56 },
	{ maxNominal: 83.57, tol: 0.61 },
	{ maxNominal: 92.2, tol: 0.66 },
	{ maxNominal: 101.6, tol: 0.71 },
	{ maxNominal: 117.35, tol: 0.76 },
	{ maxNominal: 141.22, tol: 0.89 },
	{ maxNominal: 166.37, tol: 1.02 },
	{ maxNominal: 192.02, tol: 1.14 },
	{ maxNominal: 218.69, tol: 1.27 },
	{ maxNominal: 253.37, tol: 1.4 },
	{ maxNominal: 289.56, tol: 1.52 },
	{ maxNominal: 347.98, tol: 1.78 },
	{ maxNominal: 408.94, tol: 2.03 },
	{ maxNominal: 472.44, tol: 2.29 },
	{ maxNominal: 571.5, tol: 2.54 },
	{ maxNominal: 711.2, tol: 3.05 },
	{ maxNominal: 855.98, tol: 3.56 },
	{ maxNominal: 1005.84, tol: 4.06 },
	{ maxNominal: 1163.32, tol: 4.57 },
	{ maxNominal: 1320.8, tol: 5.08 }
];

// ── ID tolerance Aero - 1.80 ──────────────────────────────────────────

const ID_TOL_AERO_180: ToleranceBand[] = [
	{ maxNominal: 6.7, tol: 0.13 },
	{ maxNominal: 8.0, tol: 0.14 },
	{ maxNominal: 10.0, tol: 0.15 },
	{ maxNominal: 11.2, tol: 0.16 },
	{ maxNominal: 13.2, tol: 0.17 },
	{ maxNominal: 15.0, tol: 0.18 },
	{ maxNominal: 16.0, tol: 0.19 },
	{ maxNominal: 18.0, tol: 0.2 },
	{ maxNominal: 20.0, tol: 0.21 },
	{ maxNominal: 21.2, tol: 0.22 },
	{ maxNominal: 22.4, tol: 0.23 },
	{ maxNominal: 25.0, tol: 0.24 },
	{ maxNominal: 26.5, tol: 0.25 },
	{ maxNominal: 30.0, tol: 0.26 },
	{ maxNominal: 31.5, tol: 0.28 },
	{ maxNominal: 33.5, tol: 0.29 },
	{ maxNominal: 34.5, tol: 0.3 },
	{ maxNominal: 36.5, tol: 0.31 },
	{ maxNominal: 38.7, tol: 0.32 },
	{ maxNominal: 40.0, tol: 0.33 },
	{ maxNominal: 41.2, tol: 0.34 },
	{ maxNominal: 43.7, tol: 0.35 },
	{ maxNominal: 45.0, tol: 0.36 },
	{ maxNominal: 47.5, tol: 0.38 },
	{ maxNominal: 50.0, tol: 0.39 },
	{ maxNominal: 53.0, tol: 0.41 },
	{ maxNominal: 56.0, tol: 0.42 },
	{ maxNominal: 60.0, tol: 0.45 },
	{ maxNominal: 63.0, tol: 0.46 },
	{ maxNominal: 67.0, tol: 0.49 },
	{ maxNominal: 71.0, tol: 0.51 },
	{ maxNominal: 75.0, tol: 0.53 },
	{ maxNominal: 80.0, tol: 0.56 },
	{ maxNominal: 85.0, tol: 0.59 },
	{ maxNominal: 90.0, tol: 0.62 },
	{ maxNominal: 95.0, tol: 0.64 },
	{ maxNominal: 100.0, tol: 0.67 },
	{ maxNominal: 106.0, tol: 0.71 },
	{ maxNominal: 112.0, tol: 0.74 },
	{ maxNominal: 118.0, tol: 0.77 },
	{ maxNominal: 125.0, tol: 0.81 }
];

// ── ID tolerance Aero - 2.65 ──────────────────────────────────────────

const ID_TOL_AERO_265: ToleranceBand[] = [
	{ maxNominal: 6.0, tol: 0.13 },
	{ maxNominal: 8.0, tol: 0.14 },
	{ maxNominal: 10.0, tol: 0.15 },
	{ maxNominal: 11.2, tol: 0.16 },
	{ maxNominal: 13.2, tol: 0.17 },
	{ maxNominal: 15.0, tol: 0.18 },
	{ maxNominal: 16.0, tol: 0.19 },
	{ maxNominal: 18.0, tol: 0.2 },
	{ maxNominal: 20.0, tol: 0.21 },
	{ maxNominal: 21.2, tol: 0.22 },
	{ maxNominal: 22.4, tol: 0.23 },
	{ maxNominal: 25.0, tol: 0.24 },
	{ maxNominal: 26.5, tol: 0.25 },
	{ maxNominal: 28.0, tol: 0.26 },
	{ maxNominal: 30.0, tol: 0.27 },
	{ maxNominal: 31.5, tol: 0.28 },
	{ maxNominal: 33.5, tol: 0.29 },
	{ maxNominal: 34.5, tol: 0.3 },
	{ maxNominal: 36.5, tol: 0.31 },
	{ maxNominal: 38.7, tol: 0.32 },
	{ maxNominal: 40.0, tol: 0.33 },
	{ maxNominal: 41.2, tol: 0.34 },
	{ maxNominal: 43.7, tol: 0.35 },
	{ maxNominal: 45.0, tol: 0.36 },
	{ maxNominal: 46.2, tol: 0.37 },
	{ maxNominal: 48.7, tol: 0.38 },
	{ maxNominal: 50.0, tol: 0.39 },
	{ maxNominal: 51.5, tol: 0.4 },
	{ maxNominal: 53.0, tol: 0.41 },
	{ maxNominal: 56.0, tol: 0.42 },
	{ maxNominal: 58.0, tol: 0.44 },
	{ maxNominal: 61.5, tol: 0.45 },
	{ maxNominal: 63.0, tol: 0.46 },
	{ maxNominal: 65.0, tol: 0.48 },
	{ maxNominal: 67.0, tol: 0.49 },
	{ maxNominal: 69.0, tol: 0.5 },
	{ maxNominal: 71.0, tol: 0.51 },
	{ maxNominal: 73.0, tol: 0.52 },
	{ maxNominal: 75.0, tol: 0.53 },
	{ maxNominal: 80.0, tol: 0.56 },
	{ maxNominal: 85.0, tol: 0.59 },
	{ maxNominal: 90.0, tol: 0.62 },
	{ maxNominal: 95.0, tol: 0.64 },
	{ maxNominal: 100.0, tol: 0.67 },
	{ maxNominal: 106.0, tol: 0.71 },
	{ maxNominal: 112.0, tol: 0.74 },
	{ maxNominal: 118.0, tol: 0.77 },
	{ maxNominal: 125.0, tol: 0.81 },
	{ maxNominal: 132.0, tol: 0.85 },
	{ maxNominal: 140.0, tol: 0.89 },
	{ maxNominal: 150.0, tol: 0.95 },
	{ maxNominal: 160.0, tol: 1.0 },
	{ maxNominal: 170.0, tol: 1.06 },
	{ maxNominal: 180.0, tol: 1.11 },
	{ maxNominal: 190.0, tol: 1.17 },
	{ maxNominal: 200.0, tol: 1.22 },
	{ maxNominal: 212.0, tol: 1.29 },
	{ maxNominal: 224.0, tol: 1.35 },
	{ maxNominal: 230.0, tol: 1.39 },
	{ maxNominal: 236.0, tol: 1.42 },
	{ maxNominal: 243.0, tol: 1.46 },
	{ maxNominal: 250.0, tol: 1.49 }
];

// ── ID tolerance Aero - 3.55 ──────────────────────────────────────────

const ID_TOL_AERO_355: ToleranceBand[] = [
	{ maxNominal: 15.0, tol: 0.18 },
	{ maxNominal: 16.0, tol: 0.19 },
	{ maxNominal: 18.0, tol: 0.2 },
	{ maxNominal: 20.0, tol: 0.21 },
	{ maxNominal: 21.2, tol: 0.22 },
	{ maxNominal: 22.4, tol: 0.23 },
	{ maxNominal: 25.0, tol: 0.24 },
	{ maxNominal: 26.5, tol: 0.25 },
	{ maxNominal: 28.0, tol: 0.26 },
	{ maxNominal: 30.0, tol: 0.27 },
	{ maxNominal: 31.5, tol: 0.28 },
	{ maxNominal: 33.5, tol: 0.29 },
	{ maxNominal: 34.5, tol: 0.3 },
	{ maxNominal: 36.5, tol: 0.31 },
	{ maxNominal: 38.7, tol: 0.32 },
	{ maxNominal: 40.0, tol: 0.33 },
	{ maxNominal: 41.2, tol: 0.34 },
	{ maxNominal: 43.7, tol: 0.35 },
	{ maxNominal: 45.0, tol: 0.36 },
	{ maxNominal: 46.2, tol: 0.37 },
	{ maxNominal: 48.7, tol: 0.38 },
	{ maxNominal: 50.0, tol: 0.39 },
	{ maxNominal: 51.5, tol: 0.4 },
	{ maxNominal: 53.0, tol: 0.41 },
	{ maxNominal: 56.0, tol: 0.42 },
	{ maxNominal: 58.0, tol: 0.44 },
	{ maxNominal: 61.5, tol: 0.45 },
	{ maxNominal: 63.0, tol: 0.46 },
	{ maxNominal: 65.0, tol: 0.48 },
	{ maxNominal: 67.0, tol: 0.49 },
	{ maxNominal: 69.0, tol: 0.5 },
	{ maxNominal: 71.0, tol: 0.51 },
	{ maxNominal: 73.0, tol: 0.52 },
	{ maxNominal: 75.0, tol: 0.53 },
	{ maxNominal: 77.5, tol: 0.55 },
	{ maxNominal: 80.0, tol: 0.56 },
	{ maxNominal: 82.5, tol: 0.57 },
	{ maxNominal: 85.0, tol: 0.59 },
	{ maxNominal: 87.5, tol: 0.6 },
	{ maxNominal: 90.0, tol: 0.62 },
	{ maxNominal: 92.5, tol: 0.63 },
	{ maxNominal: 95.0, tol: 0.64 },
	{ maxNominal: 97.5, tol: 0.66 },
	{ maxNominal: 100.0, tol: 0.67 },
	{ maxNominal: 103.0, tol: 0.69 },
	{ maxNominal: 106.0, tol: 0.71 },
	{ maxNominal: 109.0, tol: 0.72 },
	{ maxNominal: 112.0, tol: 0.74 },
	{ maxNominal: 115.0, tol: 0.76 },
	{ maxNominal: 118.0, tol: 0.77 },
	{ maxNominal: 122.0, tol: 0.8 },
	{ maxNominal: 125.0, tol: 0.81 },
	{ maxNominal: 128.0, tol: 0.83 },
	{ maxNominal: 132.0, tol: 0.85 },
	{ maxNominal: 136.0, tol: 0.87 },
	{ maxNominal: 140.0, tol: 0.89 },
	{ maxNominal: 145.0, tol: 0.92 },
	{ maxNominal: 150.0, tol: 0.95 },
	{ maxNominal: 155.0, tol: 0.98 },
	{ maxNominal: 160.0, tol: 1.0 },
	{ maxNominal: 165.0, tol: 1.03 },
	{ maxNominal: 170.0, tol: 1.06 },
	{ maxNominal: 175.0, tol: 1.09 },
	{ maxNominal: 180.0, tol: 1.11 },
	{ maxNominal: 185.0, tol: 1.14 },
	{ maxNominal: 190.0, tol: 1.17 },
	{ maxNominal: 195.0, tol: 1.2 },
	{ maxNominal: 200.0, tol: 1.22 },
	{ maxNominal: 212.0, tol: 1.29 },
	{ maxNominal: 218.0, tol: 1.32 },
	{ maxNominal: 224.0, tol: 1.35 },
	{ maxNominal: 230.0, tol: 1.39 },
	{ maxNominal: 236.0, tol: 1.42 },
	{ maxNominal: 250.0, tol: 1.49 },
	{ maxNominal: 258.0, tol: 1.54 },
	{ maxNominal: 265.0, tol: 1.57 },
	{ maxNominal: 280.0, tol: 1.65 },
	{ maxNominal: 290.0, tol: 1.71 },
	{ maxNominal: 300.0, tol: 1.76 },
	{ maxNominal: 307.0, tol: 1.8 },
	{ maxNominal: 315.0, tol: 1.84 },
	{ maxNominal: 335.0, tol: 1.95 },
	{ maxNominal: 355.0, tol: 2.06 }
];

// ── ID tolerance Aero - 5.30 ──────────────────────────────────────────

const ID_TOL_AERO_530: ToleranceBand[] = [
	{ maxNominal: 38.7, tol: 0.32 },
	{ maxNominal: 40.0, tol: 0.33 },
	{ maxNominal: 41.2, tol: 0.34 },
	{ maxNominal: 43.7, tol: 0.35 },
	{ maxNominal: 45.0, tol: 0.36 },
	{ maxNominal: 46.2, tol: 0.37 },
	{ maxNominal: 48.7, tol: 0.38 },
	{ maxNominal: 50.0, tol: 0.39 },
	{ maxNominal: 51.5, tol: 0.4 },
	{ maxNominal: 53.0, tol: 0.41 },
	{ maxNominal: 56.0, tol: 0.42 },
	{ maxNominal: 58.0, tol: 0.44 },
	{ maxNominal: 61.5, tol: 0.45 },
	{ maxNominal: 63.0, tol: 0.46 },
	{ maxNominal: 65.0, tol: 0.48 },
	{ maxNominal: 67.0, tol: 0.49 },
	{ maxNominal: 69.0, tol: 0.5 },
	{ maxNominal: 71.0, tol: 0.51 },
	{ maxNominal: 73.0, tol: 0.52 },
	{ maxNominal: 75.0, tol: 0.53 },
	{ maxNominal: 77.5, tol: 0.55 },
	{ maxNominal: 80.0, tol: 0.56 },
	{ maxNominal: 82.5, tol: 0.57 },
	{ maxNominal: 85.0, tol: 0.59 },
	{ maxNominal: 87.5, tol: 0.6 },
	{ maxNominal: 90.0, tol: 0.62 },
	{ maxNominal: 92.5, tol: 0.63 },
	{ maxNominal: 95.0, tol: 0.64 },
	{ maxNominal: 97.5, tol: 0.66 },
	{ maxNominal: 100.0, tol: 0.67 },
	{ maxNominal: 103.0, tol: 0.69 },
	{ maxNominal: 106.0, tol: 0.71 },
	{ maxNominal: 109.0, tol: 0.72 },
	{ maxNominal: 112.0, tol: 0.74 },
	{ maxNominal: 115.0, tol: 0.76 },
	{ maxNominal: 118.0, tol: 0.77 },
	{ maxNominal: 122.0, tol: 0.8 },
	{ maxNominal: 125.0, tol: 0.81 },
	{ maxNominal: 128.0, tol: 0.83 },
	{ maxNominal: 132.0, tol: 0.85 },
	{ maxNominal: 136.0, tol: 0.87 },
	{ maxNominal: 140.0, tol: 0.89 },
	{ maxNominal: 145.0, tol: 0.92 },
	{ maxNominal: 150.0, tol: 0.95 },
	{ maxNominal: 155.0, tol: 0.98 },
	{ maxNominal: 160.0, tol: 1.0 },
	{ maxNominal: 165.0, tol: 1.03 },
	{ maxNominal: 170.0, tol: 1.06 },
	{ maxNominal: 175.0, tol: 1.09 },
	{ maxNominal: 180.0, tol: 1.11 },
	{ maxNominal: 185.0, tol: 1.14 },
	{ maxNominal: 190.0, tol: 1.17 },
	{ maxNominal: 195.0, tol: 1.2 },
	{ maxNominal: 200.0, tol: 1.22 }
];

// ── ID tolerance Aero - 7.00 ──────────────────────────────────────────

const ID_TOL_AERO_700: ToleranceBand[] = [
	{ maxNominal: 109.0, tol: 0.72 },
	{ maxNominal: 112.0, tol: 0.74 },
	{ maxNominal: 115.0, tol: 0.76 },
	{ maxNominal: 118.0, tol: 0.77 },
	{ maxNominal: 122.0, tol: 0.8 },
	{ maxNominal: 125.0, tol: 0.81 },
	{ maxNominal: 128.0, tol: 0.83 },
	{ maxNominal: 132.0, tol: 0.85 },
	{ maxNominal: 136.0, tol: 0.87 },
	{ maxNominal: 140.0, tol: 0.89 },
	{ maxNominal: 145.0, tol: 0.92 },
	{ maxNominal: 150.0, tol: 0.95 },
	{ maxNominal: 155.0, tol: 0.98 },
	{ maxNominal: 160.0, tol: 1.0 },
	{ maxNominal: 165.0, tol: 1.03 },
	{ maxNominal: 170.0, tol: 1.06 },
	{ maxNominal: 175.0, tol: 1.09 },
	{ maxNominal: 180.0, tol: 1.11 },
	{ maxNominal: 185.0, tol: 1.14 },
	{ maxNominal: 190.0, tol: 1.17 },
	{ maxNominal: 195.0, tol: 1.2 },
	{ maxNominal: 200.0, tol: 1.22 },
	{ maxNominal: 206.0, tol: 1.26 },
	{ maxNominal: 212.0, tol: 1.29 },
	{ maxNominal: 218.0, tol: 1.32 },
	{ maxNominal: 224.0, tol: 1.35 },
	{ maxNominal: 230.0, tol: 1.39 },
	{ maxNominal: 236.0, tol: 1.42 },
	{ maxNominal: 243.0, tol: 1.46 },
	{ maxNominal: 250.0, tol: 1.49 },
	{ maxNominal: 258.0, tol: 1.54 },
	{ maxNominal: 265.0, tol: 1.57 },
	{ maxNominal: 272.0, tol: 1.61 },
	{ maxNominal: 280.0, tol: 1.65 },
	{ maxNominal: 290.0, tol: 1.71 },
	{ maxNominal: 300.0, tol: 1.76 },
	{ maxNominal: 307.0, tol: 1.8 },
	{ maxNominal: 315.0, tol: 1.84 },
	{ maxNominal: 325.0, tol: 1.9 },
	{ maxNominal: 335.0, tol: 1.95 },
	{ maxNominal: 345.0, tol: 2.0 },
	{ maxNominal: 355.0, tol: 2.06 },
	{ maxNominal: 365.0, tol: 2.11 },
	{ maxNominal: 375.0, tol: 2.16 },
	{ maxNominal: 387.0, tol: 2.23 },
	{ maxNominal: 400.0, tol: 2.29 }
];

// ID tolerance Non-STD B uses the same equation A.1 as Class B (classB_IDTolerance)

// ── Lookup helpers ────────────────────────────────────────────────

function findBand(
	nominal: number,
	bands: ToleranceBand[]
): { upper: number; lower: number } | null {
	for (let i = 0; i < bands.length; i++) {
		const minNominal = i === 0 ? 0 : bands[i - 1].maxNominal;
		if (nominal > minNominal && nominal <= bands[i].maxNominal) {
			return { upper: bands[i].tol, lower: -bands[i].tol };
		}
	}
	return null;
}

/**
 * Look up ISO 3601-1 tolerance for a cross-section diameter (mm).
 */
export function lookupCSTolerance(
	nominal: number,
	cls: OringClass = 'A'
): { upper: number; lower: number } | null {
	const table = cls === 'A' ? CS_TOL_A : cls === 'B' ? CS_TOL_B : CS_TOL_AERO;
	return findBand(nominal, table);
}

/**
 * Look up ISO 3601-1 tolerance for an inner diameter (mm).
 * Class A tolerances depend on the cross-section diameter.
 */
export function lookupIDTolerance(
	nominal: number,
	cls: OringClass = 'A',
	cs?: number
): { upper: number; lower: number } | null {
	if (cls === 'B') {
		const tol = classB_IDTolerance(nominal);
		return { upper: tol, lower: -tol };
	}

	// Class A / Aero: dispatch to per-CS tolerance table
	const table = cls === 'Aero' ? getAeroIDTable(cs) : getClassAIDTable(cs);
	return table ? findBand(nominal, table) : null;
}

function getClassAIDTable(cs?: number): ToleranceBand[] | null {
	if (cs == null) return null;
	if (cs <= 1.78) return ID_TOL_A_178;
	if (cs <= 2.62) return ID_TOL_A_262;
	if (cs <= 3.53) return ID_TOL_A_353;
	if (cs <= 5.33) return ID_TOL_A_533;
	if (cs <= 6.99) return ID_TOL_A_699;
	return null;
}

function getAeroIDTable(cs?: number): ToleranceBand[] | null {
	if (cs == null) return null;
	if (cs <= 1.80) return ID_TOL_AERO_180;
	if (cs <= 2.65) return ID_TOL_AERO_265;
	if (cs <= 3.55) return ID_TOL_AERO_355;
	if (cs <= 5.30) return ID_TOL_AERO_530;
	if (cs <= 7.00) return ID_TOL_AERO_700;
	return null;
}
