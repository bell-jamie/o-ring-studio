import { limits as _limits, holeDeviations, shaftDeviations } from 'iso-286';

export type FitType = 'hole' | 'shaft';

export interface Iso286Tolerance {
	upper: number;
	lower: number;
}

/** Get upper/lower deviations (mm) for a nominal size + tolerance class (e.g. "H7", "h6") */
export function lookupIso286(nominal: number, toleranceClass: string): Iso286Tolerance {
	const tol = _limits(nominal, toleranceClass);
	const result: Iso286Tolerance = { upper: tol.upper, lower: tol.lower };
	tol.free();
	return result;
}

/** Common deviation letters for hole-basis fits */
export function holeClasses(): string[] {
	return holeDeviations();
}

/** Common deviation letters for shaft-basis fits */
export function shaftClasses(): string[] {
	return shaftDeviations();
}

/** Validate that a tolerance class string looks correct for the given fit type */
export function isValidClass(toleranceClass: string, fitType: FitType): boolean {
	const devs = fitType === 'hole' ? holeDeviations() : shaftDeviations();
	// Extract deviation letters (everything before the grade number)
	const match = toleranceClass.match(/^([A-Za-z]+)(\d+)$/);
	if (!match) return false;
	const [, deviation, grade] = match;
	const gradeNum = parseInt(grade);
	if (gradeNum < 1 || gradeNum > 18) return false;
	return devs.includes(deviation);
}
