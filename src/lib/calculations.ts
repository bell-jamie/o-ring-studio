import type {
	TolerancedDimension,
	ResolvedDimension,
	RangeResult,
	PistonSealInputs,
	PistonSealResults,
	FaceSealInputs,
	FaceSealResults,
	SealType,
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
export function calculateAll(inputs: PistonSealInputs, sealType: SealType = 'piston'): PistonSealResults {
	const boreDia = resolve(inputs.boreDia);
	const pistonDia = resolve(inputs.pistonDia); // rodDia for rod seal
	const grooveDia = resolve(inputs.grooveDia);
	const grooveWidth = resolve(inputs.grooveWidth);
	const grooveRadii = resolve(inputs.grooveRadii);
	const cs = resolve(inputs.oRingCS);
	const id = resolve(inputs.oRingID);

	// Piston seal: groove on piston → depth = (piston - groove) / 2, IH = (bore - groove) / 2
	// Rod seal: groove in housing → depth = (groove - bore) / 2, IH = (groove - rod) / 2
	const grooveDepth = sealType === 'piston'
		? calcGrooveDepth(pistonDia, grooveDia)
		: calcGrooveDepth(grooveDia, boreDia);
	const installedHeight = sealType === 'piston'
		? calcInstalledHeight(boreDia, grooveDia)
		: calcInstalledHeight(grooveDia, pistonDia);

	const stretch = calcStretch(grooveDia, id);
	const stretchedCS = calcStretchedCS(cs, id, grooveDia);
	const compression = calcCompression(installedHeight, stretchedCS);
	const fill = calcFill(stretchedCS, grooveWidth, grooveDepth, grooveRadii);
	const extrusionGap = calcExtrusionGap(boreDia, pistonDia);

	return { stretch, compression, fill, extrusionGap, installedHeight, grooveDepth, stretchedCS };
}

/**
 * Face seal: o-ring in a rectangular groove on a flat face, compressed axially.
 * Groove centerline = (OD + ID) / 2 — used for stretch calculation.
 * Groove width = (OD - ID) / 2 — derived, not a direct input.
 * Housing height = axial gap that compresses the o-ring.
 */
export function calculateFaceSeal(inputs: FaceSealInputs): FaceSealResults {
	const grooveOD = resolve(inputs.grooveOD);
	const grooveID = resolve(inputs.grooveID);
	const housingHeight = resolve(inputs.housingHeight);
	const grooveRadii = resolve(inputs.grooveRadii);
	const cs = resolve(inputs.oRingCS);
	const id = resolve(inputs.oRingID);

	// Groove width = (OD - ID) / 2
	const grooveWidth: RangeResult = {
		nominal: (grooveOD.nominal - grooveID.nominal) / 2,
		min: (grooveOD.min - grooveID.max) / 2,
		max: (grooveOD.max - grooveID.min) / 2
	};

	// Stretch references groove ID (o-ring expands to fit groove inner wall)
	const stretch = calcStretch(grooveID, id);

	// Face seal: stretch is circumferential, compression is axial — orthogonal.
	// Use free CS (no volume-conservation stretch correction).
	const csRange: RangeResult = { nominal: cs.nominal, min: cs.min, max: cs.max };

	// Axial compression: housing height is the installed height
	const ihRange: RangeResult = { nominal: housingHeight.nominal, min: housingHeight.min, max: housingHeight.max };
	const compression = calcCompression(ihRange, csRange);

	// Fill: o-ring area / groove cross-section area
	const fill = calcFill(csRange, grooveWidth as ResolvedDimension, ihRange, grooveRadii);

	return { stretch, compression, fill, grooveWidth, stretchedCS: csRange };
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
	const min = (boreDia.min - pistonDia.max) / 2;
	const max = (boreDia.max - pistonDia.min) / 2;
	return {
		nominal: (min + max) / 2,
		min,
		max
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

/**
 * Given a bore diameter, CS, and seal type, find the best standard o-ring ID
 * and derive all housing dimensions anchored to the given bore.
 *
 * Piston seal: pistonDia = boreDia (zero clearance), groove cut into piston
 * Rod seal:    rodDia = boreDia (zero clearance), groove cut into housing
 *
 * In both cases the piston/rod never exceeds the bore.
 */
export function generateFromBore(
	bore: number,
	cs: number,
	sealType: SealType,
	sizes: { id: number }[],
	targetStretch = 5,
	targetCompression = 20,
	targetFill = 65,
	grooveRadii = 0.3
): (GeneratedHousing & { oRingID: number }) | null {
	if (sizes.length === 0) return null;

	// Estimate ideal groove diameter from bore
	const ihApprox = cs * (1 - targetCompression / 100);
	const grooveDiaTarget =
		sealType === 'piston'
			? bore - 2 * ihApprox // piston seal: groove < bore
			: bore + 2 * ihApprox; // rod seal: groove > bore

	// Ideal o-ring ID for this groove (inverse of stretch)
	const idealID = grooveDiaTarget / (1 + targetStretch / 100);

	// Find closest standard ID
	let best = sizes[0];
	let bestDist = Math.abs(sizes[0].id - idealID);
	for (const s of sizes) {
		const d = Math.abs(s.id - idealID);
		if (d < bestDist) {
			best = s;
			bestDist = d;
		}
	}

	// Derive all dimensions anchored to the given bore
	const grooveDia = roundNice(best.id * (1 + targetStretch / 100));
	const csStretched = cs * Math.pow(best.id / grooveDia, 2 / 3);
	const ih = csStretched * (1 - targetCompression / 100);

	let boreDia: number, pistonDia: number, grooveDepth: number;

	if (sealType === 'piston') {
		// Groove on piston: grooveDia < pistonDia ≤ boreDia
		boreDia = bore;
		pistonDia = bore;
		grooveDepth = (pistonDia - grooveDia) / 2;
	} else {
		// Groove in housing: rodDia ≤ boreDia < grooveDia
		boreDia = bore;
		pistonDia = bore;
		grooveDepth = (grooveDia - boreDia) / 2;
	}

	if (grooveDepth <= 0) return null;

	const oRingArea = Math.PI * (csStretched / 2) ** 2;
	const radiiCorrection = 2 * grooveRadii ** 2 * (1 - Math.PI / 4);
	const grooveAreaNeeded = oRingArea / (targetFill / 100);
	const widthExact = (grooveAreaNeeded + radiiCorrection) / grooveDepth;
	const grooveWidth = roundNice(Math.max(widthExact, cs * 1.1));

	return { boreDia, pistonDia, grooveDia, grooveWidth, oRingID: best.id };
}

export interface GeneratedFaceSeal {
	grooveOD: number;
	grooveID: number;
	housingHeight: number;
	grooveRadii: number;
	oRingID: number;
}

/**
 * Generate face seal groove from o-ring (CS + ID known).
 * Derives grooveID from stretch, grooveOD from fill, housingHeight from compression.
 */
export function generateFaceSealFromORing(
	cs: number,
	id: number,
	targetStretch = 1,
	targetCompression = 20,
	targetFill = 65,
	grooveRadii = 0.3
): GeneratedFaceSeal {
	// Groove ID from stretch: grooveID = id * (1 + stretch/100)
	const grooveID = roundNice(id * (1 + targetStretch / 100));

	// Housing height from compression: IH = CS * (1 - comp/100)
	const housingHeight = roundNice(cs * (1 - targetCompression / 100), 'nearest');

	// Groove width from fill: width = (oRingArea / fill + radiiCorr) / grooveDepth
	// For face seal, grooveDepth = housingHeight
	const oRingArea = Math.PI * (cs / 2) ** 2;
	const radiiCorrection = 2 * grooveRadii ** 2 * (1 - Math.PI / 4);
	const grooveAreaNeeded = oRingArea / (targetFill / 100);
	const widthExact = (grooveAreaNeeded + radiiCorrection) / housingHeight;
	const grooveWidth = roundNice(Math.max(widthExact, cs * 1.1));

	// Groove OD = grooveID + 2 * grooveWidth
	const grooveOD = roundNice(grooveID + 2 * grooveWidth);

	return { grooveOD, grooveID, housingHeight, grooveRadii, oRingID: id };
}

/**
 * Generate face seal dimensions from groove ID (CS + grooveID known).
 * Picks the best standard o-ring, then derives grooveOD and housingHeight.
 */
export function generateFaceSealFromGrooveID(
	cs: number,
	grooveID: number,
	sizes: { id: number }[],
	targetStretch = 1,
	targetCompression = 20,
	targetFill = 65,
	grooveRadii = 0.3
): GeneratedFaceSeal | null {
	if (sizes.length === 0) return null;

	// Ideal o-ring ID: grooveID = id * (1 + stretch/100) → id = grooveID / (1 + stretch/100)
	const idealID = grooveID / (1 + targetStretch / 100);

	let best = sizes[0];
	let bestDist = Math.abs(sizes[0].id - idealID);
	for (const s of sizes) {
		const d = Math.abs(s.id - idealID);
		if (d < bestDist) {
			best = s;
			bestDist = d;
		}
	}

	return generateFaceSealFromORing(cs, best.id, targetStretch, targetCompression, targetFill, grooveRadii);
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
 * @param sealType           Piston or rod seal (default piston)
 */
export function generateHousing(
	cs: number,
	id: number,
	targetStretch = 5,
	targetCompression = 20,
	targetFill = 65,
	grooveRadii = 0.3,
	sealType: SealType = 'piston'
): GeneratedHousing {
	// 1. Groove diameter — round to nearest, then recompute actual stretch
	const grooveDia = roundNice(id * (1 + targetStretch / 100));

	// 2. Recompute stretched CS from the actual rounded groove diameter
	const csStretched = cs * Math.pow(id / grooveDia, 2 / 3);

	// 3. Installed height for target compression
	//    compression% = (CS_s - IH) / CS_s × 100  →  IH = CS_s × (1 - comp/100)
	const ih = csStretched * (1 - targetCompression / 100);

	let boreDia: number, pistonDia: number, grooveDepth: number;

	if (sealType === 'piston') {
		// Piston seal: bore/piston above groove
		boreDia = roundNice(grooveDia + 2 * ih);
		pistonDia = boreDia;
		grooveDepth = (pistonDia - grooveDia) / 2;
	} else {
		// Rod seal: rod/bore below groove
		pistonDia = roundNice(grooveDia - 2 * ih); // rodDia
		boreDia = pistonDia;
		grooveDepth = (grooveDia - boreDia) / 2;
	}

	// 5. Groove width — use actual rounded groove depth for fill calculation
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
