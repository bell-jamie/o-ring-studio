import type {
	TolerancedDimension,
	ResolvedDimension,
	RangeResult,
	PistonSealInputs,
	PistonSealResults,
	Status,
	AcceptanceCriteria
} from './types';

/** Resolve a toleranced dimension into min/nominal/max */
export function resolve(d: TolerancedDimension): ResolvedDimension {
	return {
		min: d.nominal + d.lowerTol,
		nominal: d.nominal,
		max: d.nominal + d.upperTol
	};
}

/**
 * Groove depth = (pistonDia - grooveDia) / 2
 * Min: smallest piston, largest groove dia
 * Max: largest piston, smallest groove dia
 */
export function calcGrooveDepth(
	pistonDia: ResolvedDimension,
	grooveDia: ResolvedDimension
): RangeResult {
	return {
		nominal: (pistonDia.nominal - grooveDia.nominal) / 2,
		min: (pistonDia.min - grooveDia.max) / 2,
		max: (pistonDia.max - grooveDia.min) / 2
	};
}

/**
 * Installed height = (boreDia - grooveDia) / 2
 * The radial gap from groove floor to bore wall.
 * Min: smallest bore, largest groove dia
 * Max: largest bore, smallest groove dia
 */
export function calcInstalledHeight(
	boreDia: ResolvedDimension,
	grooveDia: ResolvedDimension
): RangeResult {
	return {
		nominal: (boreDia.nominal - grooveDia.nominal) / 2,
		min: (boreDia.min - grooveDia.max) / 2,
		max: (boreDia.max - grooveDia.min) / 2
	};
}

/**
 * Stretch % = ((grooveDia - oRingID) / oRingID) × 100
 * Min stretch: min groove dia, max o-ring ID
 * Max stretch: max groove dia, min o-ring ID
 */
export function calcStretch(
	grooveDia: ResolvedDimension,
	oRingID: ResolvedDimension
): RangeResult {
	return {
		nominal: ((grooveDia.nominal - oRingID.nominal) / oRingID.nominal) * 100,
		min: ((grooveDia.min - oRingID.max) / oRingID.max) * 100,
		max: ((grooveDia.max - oRingID.min) / oRingID.min) * 100
	};
}

/**
 * Stretched cross-section: CS reduced by diametral stretch (volume conservation).
 * CS_s = CS × (ID / grooveDia)^(2/3)
 *
 * Min CS_s: smallest free CS, most stretch (min ID, max groove)
 * Max CS_s: largest free CS, least stretch (max ID, min groove)
 */
export function calcStretchedCS(
	cs: ResolvedDimension,
	oRingID: ResolvedDimension,
	grooveDia: ResolvedDimension
): RangeResult {
	const stretched = (csVal: number, idVal: number, gdVal: number) =>
		csVal * Math.pow(idVal / gdVal, 2 / 3);

	return {
		nominal: stretched(cs.nominal, oRingID.nominal, grooveDia.nominal),
		min: stretched(cs.min, oRingID.min, grooveDia.max),
		max: stretched(cs.max, oRingID.max, grooveDia.min)
	};
}

/**
 * Compression % = (CS_s - installedHeight) / CS_s × 100
 * Uses stretched cross-section (incl. R correction for stretch).
 * Min compression: min CS_s, max installed height
 * Max compression: max CS_s, min installed height
 */
export function calcCompression(
	installedHeight: RangeResult,
	stretchedCS: RangeResult
): RangeResult {
	return {
		nominal: ((stretchedCS.nominal - installedHeight.nominal) / stretchedCS.nominal) * 100,
		min: ((stretchedCS.min - installedHeight.max) / stretchedCS.min) * 100,
		max: ((stretchedCS.max - installedHeight.min) / stretchedCS.max) * 100
	};
}

/**
 * Fill % = oRingArea / grooveArea × 100
 * oRingArea = π(CS_s/2)² — uses stretched cross-section
 * grooveArea = width × depth - 2R²(1 - π/4)  (corner radii correction)
 * Min fill: min CS_s, max groove area (max width, max depth, max radii)
 * Max fill: max CS_s, min groove area (min width, min depth, min radii)
 */
export function calcFill(
	stretchedCS: RangeResult,
	grooveWidth: ResolvedDimension,
	grooveDepth: RangeResult,
	grooveRadii: ResolvedDimension
): RangeResult {
	const oRingArea = (csVal: number) => Math.PI * (csVal / 2) ** 2;
	const grooveArea = (w: number, d: number, r: number) =>
		w * d - 2 * r * r * (1 - Math.PI / 4);

	return {
		nominal: (oRingArea(stretchedCS.nominal) /
			grooveArea(grooveWidth.nominal, grooveDepth.nominal, grooveRadii.nominal)) * 100,
		min: (oRingArea(stretchedCS.min) /
			grooveArea(grooveWidth.max, grooveDepth.max, grooveRadii.max)) * 100,
		max: (oRingArea(stretchedCS.max) /
			grooveArea(grooveWidth.min, grooveDepth.min, grooveRadii.min)) * 100
	};
}

/** Master function: all inputs → all results */
export function calculateAll(inputs: PistonSealInputs): PistonSealResults {
	const boreDia = resolve(inputs.boreDia);
	const pistonDia = resolve(inputs.pistonDia);
	const grooveDia = resolve(inputs.grooveDia);
	const grooveWidth = resolve(inputs.grooveWidth);
	const grooveRadii = resolve(inputs.grooveRadii);
	const cs = resolve(inputs.oRingCS);
	const id = resolve(inputs.oRingID);

	const grooveDepth = calcGrooveDepth(pistonDia, grooveDia);
	const installedHeight = calcInstalledHeight(boreDia, grooveDia);
	const stretch = calcStretch(grooveDia, id);
	const stretchedCS = calcStretchedCS(cs, id, grooveDia);
	const compression = calcCompression(installedHeight, stretchedCS);
	const fill = calcFill(stretchedCS, grooveWidth, grooveDepth, grooveRadii);

	return { stretch, compression, fill, installedHeight, grooveDepth, stretchedCS };
}

/** Determine status of a value against acceptance criteria */
export function getStatus(value: number, criteria: AcceptanceCriteria): Status {
	if (value >= criteria.min && value <= criteria.max) return 'ok';
	const margin = (criteria.max - criteria.min) * 0.2;
	if (value >= criteria.min - margin && value <= criteria.max + margin) return 'warn';
	return 'error';
}

/** Get the worst status across min/nominal/max of a range result */
export function getRangeStatus(result: RangeResult, criteria: AcceptanceCriteria): Status {
	const statuses = [
		getStatus(result.min, criteria),
		getStatus(result.nominal, criteria),
		getStatus(result.max, criteria)
	];
	if (statuses.includes('error')) return 'error';
	if (statuses.includes('warn')) return 'warn';
	return 'ok';
}
