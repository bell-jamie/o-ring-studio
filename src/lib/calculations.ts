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
	const extrusionGap = calcExtrusionGap(boreDia, pistonDia);

	return { stretch, compression, fill, extrusionGap, installedHeight, grooveDepth, stretchedCS };
}

/**
 * Extrusion gap = (boreDia - pistonDia) / 2  (radial clearance)
 * Min: smallest bore, largest piston
 * Max: largest bore, smallest piston
 */
export function calcExtrusionGap(
	boreDia: ResolvedDimension,
	pistonDia: ResolvedDimension
): RangeResult {
	return {
		nominal: (boreDia.nominal - pistonDia.nominal) / 2,
		min: (boreDia.min - pistonDia.max) / 2,
		max: (boreDia.max - pistonDia.min) / 2
	};
}

/**
 * Apply piston eccentricity to concentric results.
 * Eccentricity 0 = concentric, 1 = fully side-loaded (gap closes on tight side).
 * Returns tight-side and loose-side result sets.
 */
export function applyEccentricity(
	base: PistonSealResults,
	inputs: PistonSealInputs,
	eccentricity: number
): { tight: PistonSealResults; loose: PistonSealResults } {
	if (eccentricity <= 0) return { tight: base, loose: base };

	const bore = resolve(inputs.boreDia);
	const piston = resolve(inputs.pistonDia);
	const grooveWidth = resolve(inputs.grooveWidth);
	const grooveRadii = resolve(inputs.grooveRadii);

	function offsetSide(sign: 1 | -1): PistonSealResults {
		// sign = -1 → tight/loaded side (piston shifts toward bore, gap closes)
		// sign = +1 → loose/unloaded side (piston shifts away, gap opens)
		//
		// Radial offset = eccentricity × (clearance / 2) at each tolerance extreme.
		// Installed height changes by this offset: tight side IH shrinks, loose side grows.
		const offsetNom = sign * eccentricity * base.extrusionGap.nominal;
		const offsetMin = sign * eccentricity * base.extrusionGap.min;
		const offsetMax = sign * eccentricity * base.extrusionGap.max;

		// Installed height shifts by offset
		const ih: RangeResult = {
			nominal: base.installedHeight.nominal + offsetNom,
			min: base.installedHeight.min + offsetMin,
			max: base.installedHeight.max + offsetMax
		};

		// Recompute compression with adjusted IH
		const compression: RangeResult = {
			nominal: ((base.stretchedCS.nominal - ih.nominal) / base.stretchedCS.nominal) * 100,
			min: ((base.stretchedCS.min - ih.max) / base.stretchedCS.min) * 100,
			max: ((base.stretchedCS.max - ih.min) / base.stretchedCS.max) * 100
		};

		// Groove depth doesn't change (groove is on piston, moves with it)
		const grooveDepth: RangeResult = {
			nominal: base.grooveDepth.nominal,
			min: base.grooveDepth.min,
			max: base.grooveDepth.max
		};
		const fill = calcFill(base.stretchedCS, grooveWidth, grooveDepth, grooveRadii);

		// Extrusion gap: base gap + offset (tight side shrinks, loose side grows)
		const extrusionGap: RangeResult = {
			nominal: base.extrusionGap.nominal + offsetNom,
			min: base.extrusionGap.min + offsetMin,
			max: base.extrusionGap.max + offsetMax
		};

		return {
			...base,
			installedHeight: ih,
			compression,
			fill,
			grooveDepth,
			extrusionGap
		};
	}

	return {
		tight: offsetSide(-1),
		loose: offsetSide(1)
	};
}

/** Round to the nearest "nice" machining number based on magnitude */
function roundNice(v: number, dir: 'nearest' | 'up' | 'down' = 'nearest'): number {
	const step = v >= 100 ? 1 : v >= 10 ? 0.5 : v >= 1 ? 0.1 : 0.05;
	// Use 1/step integer math to avoid floating-point artifacts
	const inv = Math.round(1 / step);
	if (dir === 'up') return Math.ceil(v * inv) / inv;
	if (dir === 'down') return Math.floor(v * inv) / inv;
	return Math.round(v * inv) / inv;
}

export interface GeneratedHousing {
	boreDia: number;
	pistonDia: number;
	grooveDia: number;
	grooveWidth: number;
}

/**
 * Generate housing dimensions for a given o-ring to hit target stretch/compression/fill.
 * All nominals are rounded to machinist-friendly numbers.
 *
 * @param cs       O-ring cross-section nominal (mm)
 * @param id       O-ring inner diameter nominal (mm)
 * @param targetStretch      Target stretch % (default 3)
 * @param targetCompression  Target compression % (default 20)
 * @param targetFill         Target fill % (default 75)
 * @param grooveRadii        Groove corner radii (default 0.3 mm)
 */
export function generateHousing(
	cs: number,
	id: number,
	targetStretch = 3,
	targetCompression = 20,
	targetFill = 75,
	grooveRadii = 0.3
): GeneratedHousing {
	// 1. Groove diameter — round to nearest, then recompute actual stretch
	const grooveDia = roundNice(id * (1 + targetStretch / 100));

	// 2. Recompute stretched CS from the actual rounded groove diameter
	const csStretched = cs * Math.pow(id / grooveDia, 2 / 3);

	// 3. Installed height for target compression
	//    compression% = (CS_s - IH) / CS_s × 100  →  IH = CS_s × (1 - comp/100)
	const ih = csStretched * (1 - targetCompression / 100);

	// 4. Bore & piston share the same nominal — round to nearest
	const boreDia = roundNice(grooveDia + 2 * ih);
	const pistonDia = boreDia;

	// 5. Groove width — use actual rounded groove depth for fill calculation
	const grooveDepth = (pistonDia - grooveDia) / 2;
	const oRingArea = Math.PI * (csStretched / 2) ** 2;
	const radiiCorrection = 2 * grooveRadii ** 2 * (1 - Math.PI / 4);
	const grooveAreaNeeded = oRingArea / (targetFill / 100);
	const widthExact = (grooveAreaNeeded + radiiCorrection) / grooveDepth;
	const grooveWidth = roundNice(Math.max(widthExact, cs * 1.1));

	return { boreDia, pistonDia, grooveDia, grooveWidth };
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
