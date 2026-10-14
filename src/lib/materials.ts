import type { OringMaterial } from './types';

/**
 * Gent's relation: Shore A hardness → Young's modulus (MPa).
 * Hardness-only estimate — doesn't know about compound/filler.
 */
export function gentModulus(shoreA: number): number {
	return (0.0981 * (56 + 7.62336 * shoreA)) / (0.137505 * (254 - 2.54 * shoreA));
}

/**
 * Effective modulus calibration matrix: [Shore A, E_eff (MPa)] per compound.
 * E_eff is the modulus that makes Lindley's compression force match Trelleborg's
 * O-Ring Calculator (mean of min/max-limit back-calculations, same rod-seal geometry:
 * Ø32.5 rod, 2.62 CS, 18.7–25.7% compression). Compounds with no points fall back to Gent.
 */
export const MATERIALS: Record<OringMaterial, [shoreA: number, eEff: number][]> = {
	NBR: [
		[70, 7.26],
		[90, 16.85]
	],
	HNBR: [], // Trelleborg doesn't report force for HNBR
	FKM: [
		[70, 7.9],
		[90, 20.74]
	],
	EPDM: [[75, 7.48]],
	VMQ: [[70, 6.77]],
	FFKM: [] // not yet calibrated
};

export type ModulusSource = 'calibrated' | 'interpolated' | 'scaled' | 'gent';

/**
 * Effective modulus for a compound at a given hardness.
 * - On a calibration point: that value.
 * - Between two points: log-linear interpolation (modulus is ~exponential in hardness).
 * - Outside the calibrated range / single point: Gent curve scaled through the nearest point.
 * - No points: plain Gent.
 */
export function effectiveModulus(
	material: OringMaterial,
	shoreA: number
): { e: number; source: ModulusSource } {
	const pts = [...(MATERIALS[material] ?? [])].sort((a, b) => a[0] - b[0]);
	const gent = gentModulus(shoreA);
	if (pts.length === 0) return { e: gent, source: 'gent' };

	const exact = pts.find(([h]) => Math.abs(h - shoreA) < 1e-6);
	if (exact) return { e: exact[1], source: 'calibrated' };

	for (let i = 0; i < pts.length - 1; i++) {
		const [h0, e0] = pts[i];
		const [h1, e1] = pts[i + 1];
		if (shoreA > h0 && shoreA < h1) {
			const t = (shoreA - h0) / (h1 - h0);
			return {
				e: Math.exp(Math.log(e0) + t * (Math.log(e1) - Math.log(e0))),
				source: 'interpolated'
			};
		}
	}

	const [hN, eN] = shoreA < pts[0][0] ? pts[0] : pts[pts.length - 1];
	return { e: gent * (eN / gentModulus(hN)), source: 'scaled' };
}
