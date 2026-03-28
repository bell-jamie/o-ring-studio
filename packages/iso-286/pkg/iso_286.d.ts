/* tslint:disable */
/* eslint-disable */

export class Tolerance {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    lower: number;
    middle: number;
    upper: number;
}

export function grades(): string[];

export function holeDeviations(): string[];

export function limits(size: number, tolerance_class: string): Tolerance;

export function shaftDeviations(): string[];
