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

export interface ClassValidation {
	valid: boolean;
	/** Human-readable explanation, present only when `valid` is false */
	error?: string;
}

/**
 * Validate the format of a tolerance class string (deviation letter + IT grade)
 * for the given fit type. This checks the class in isolation — it does not check
 * whether a particular nominal size is in range (use `lookupIso286` for that).
 */
export function validateClass(toleranceClass: string, fitType: FitType): ClassValidation {
	const cls = toleranceClass.trim();
	if (!cls) return { valid: true }; // empty = no class chosen, fall back to manual tolerances

	const match = cls.match(/^([A-Za-z]+)(\d{1,2})$/);
	if (!match) {
		return { valid: false, error: 'Use a deviation letter + grade, e.g. H7' };
	}

	const [, deviation, grade] = match;
	const devs = fitType === 'hole' ? holeDeviations() : shaftDeviations();

	if (!devs.includes(deviation)) {
		// Hole fits are uppercase, shaft fits lowercase — flag a likely case mix-up.
		const swapped = fitType === 'hole' ? deviation.toUpperCase() : deviation.toLowerCase();
		if (devs.includes(swapped)) {
			const casing = fitType === 'hole' ? 'uppercase' : 'lowercase';
			return {
				valid: false,
				error: `${fitType === 'hole' ? 'Bore' : 'Shaft'} fits use ${casing}, e.g. ${swapped}${grade}`
			};
		}
		return { valid: false, error: `"${deviation}" is not a valid ${fitType} deviation` };
	}

	const gradeNum = parseInt(grade, 10);
	if (gradeNum < 1 || gradeNum > 18) {
		return { valid: false, error: 'Grade must be between IT1 and IT18' };
	}

	return { valid: true };
}
