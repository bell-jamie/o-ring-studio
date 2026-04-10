/** Seal geometry type */
export type SealType = 'piston' | 'rod' | 'face';

/** A dimension with nominal value and bilateral tolerances */
export interface TolerancedDimension {
	nominal: number;
	upperTol: number; // positive value, e.g. +0.05
	lowerTol: number; // negative value, e.g. -0.05
}

/** Resolved min/nominal/max from a TolerancedDimension */
export interface ResolvedDimension {
	min: number;
	nominal: number;
	max: number;
}

/** A calculated metric with min/nominal/max */
export interface RangeResult {
	min: number;
	nominal: number;
	max: number;
}

/** All seven input dimensions for the piston seal analysis */
export interface PistonSealInputs {
	boreDia: TolerancedDimension;
	pistonDia: TolerancedDimension;
	grooveDia: TolerancedDimension;
	grooveWidth: TolerancedDimension;
	grooveRadii: TolerancedDimension;
	oRingCS: TolerancedDimension;
	oRingID: TolerancedDimension;
}

/** All calculated output metrics */
export interface PistonSealResults {
	stretch: RangeResult;
	compression: RangeResult;
	fill: RangeResult;
	extrusionGap: RangeResult;
	installedHeight: RangeResult;
	grooveDepth: RangeResult;
	stretchedCS: RangeResult;
}

/** Input dimensions for a face seal analysis */
export interface FaceSealInputs {
	grooveOD: TolerancedDimension;
	grooveID: TolerancedDimension;
	housingHeight: TolerancedDimension;
	grooveRadii: TolerancedDimension;
	oRingCS: TolerancedDimension;
	oRingID: TolerancedDimension;
}

/** Calculated output metrics for a face seal */
export interface FaceSealResults {
	stretch: RangeResult;
	compression: RangeResult;
	fill: RangeResult;
	grooveWidth: RangeResult;
	stretchedCS: RangeResult;
}

/** Status assessment */
export type Status = 'ok' | 'warn' | 'error';

/** Acceptance criteria range */
export interface AcceptanceCriteria {
	min: number;
	max: number;
}

