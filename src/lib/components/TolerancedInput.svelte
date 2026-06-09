<script lang="ts">
	import { untrack } from 'svelte';
	import type { FitType } from '$lib/iso286';
	import { lookupIso286, validateClass } from '$lib/iso286';

	interface Props {
		label: string;
		nominal: string;
		upperTol: string;
		lowerTol: string;
		placeholder?: string;
		isoLabel?: string;
		/** ISO 286 fit type — if set, show a tolerance class picker */
		fitType?: FitType;
		/** Default tolerance class, e.g. "H8" or "f7" */
		defaultFitClass?: string;
		/**
		 * Selected ISO 286 fit class. Empty = custom (manual tolerances).
		 * Bindable so the parent can apply the default fit on "Generate".
		 */
		fitClass?: string;
	}

	let {
		label,
		nominal = $bindable(),
		upperTol = $bindable(),
		lowerTol = $bindable(),
		placeholder = '',
		isoLabel,
		fitType,
		defaultFitClass = '',
		// Start empty so both the fit-class and manual tolerance inputs are available;
		// the recommended class (defaultFitClass) is shown only as a placeholder hint.
		fitClass = $bindable('')
	}: Props = $props();

	// Empty string = no error; otherwise a human-readable message
	let fitError = $state('');

	// Reset to empty when the default changes (e.g. seal type toggle) — the fit
	// type may flip hole<->shaft, which would invalidate any class already typed.
	let prevDefault = untrack(() => defaultFitClass);
	$effect(() => {
		if (defaultFitClass !== prevDefault) {
			fitClass = '';
			prevDefault = defaultFitClass;
		}
	});

	// Validate the fit class and auto-populate tolerances from ISO 286 when
	// the nominal or fit class changes.
	$effect(() => {
		if (!fitType) return;

		// First validate the class on its own — this flags a bad deviation/grade
		// even before a nominal size has been entered.
		const check = validateClass(fitClass, fitType);
		if (!check.valid) {
			fitError = check.error ?? 'Invalid tolerance class';
			return;
		}

		// Class is well-formed; if we have a nominal, look up the deviations.
		const nom = parseFloat(nominal);
		if (fitClass && !isNaN(nom) && nom > 0) {
			try {
				const tol = lookupIso286(nom, fitClass);
				upperTol = String(tol.upper);
				lowerTol = String(Math.abs(tol.lower));
				fitError = '';
			} catch (e) {
				// e.g. "nominal size 5000 mm is out of range"
				fitError = e instanceof Error ? capitalize(e.message) : 'Out of ISO 286 range';
			}
		} else {
			fitError = '';
		}
	});

	function capitalize(s: string): string {
		return s.charAt(0).toUpperCase() + s.slice(1);
	}

	// ISO mode is active whenever a fit class is entered — the upper/lower
	// tolerances are then derived from ISO 286 and the manual fields are locked.
	// An empty fit class means the user is entering custom tolerances by hand.
	const isoActive = $derived(!!fitType && fitClass.trim().length > 0);

	const inputBase =
		'rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';
</script>

<div class="space-y-1.5">
	<div class="flex items-center gap-2">
		<span class="text-sm text-muted-foreground">{label}</span>
		{#if fitType}
			<div class="ml-auto flex items-center gap-1.5">
				<span
					class="rounded border border-transparent px-1.5 py-0.5 text-[10px] font-medium {isoActive
						? 'bg-primary/10 text-primary'
						: 'bg-muted text-muted-foreground'}"
				>
					{isoActive ? 'ISO 286' : 'Custom'}
				</span>
				{#if defaultFitClass}
					<button
						type="button"
						onclick={() => (fitClass = defaultFitClass)}
						title="Apply recommended ISO 286 fit ({defaultFitClass})"
						class="rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium transition-colors {fitClass ===
						defaultFitClass
							? 'border-transparent bg-primary/10 text-primary'
							: 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'}"
					>
						{defaultFitClass}
					</button>
				{/if}
			</div>
		{:else if isoLabel}
			<span class="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
				{isoLabel}
			</span>
		{/if}
	</div>
	<div class="flex items-center gap-1.5">
		<input
			type="number"
			step="0.01"
			{placeholder}
			bind:value={nominal}
			class="{inputBase} min-w-0 flex-1"
		/>
		{#if fitType}
			<input
				type="text"
				placeholder="ISO"
				bind:value={fitClass}
				aria-invalid={fitError ? 'true' : undefined}
				aria-label="{label} ISO 286 tolerance class"
				class="{inputBase} w-14 text-center font-mono {fitError
					? 'border-destructive ring-2 ring-destructive/30'
					: ''}"
			/>
		{/if}
		<span class="text-xs text-muted-foreground">+</span>
		<input
			type="number"
			step="0.001"
			bind:value={upperTol}
			readonly={isoActive}
			title={isoActive ? 'Derived from ISO 286 — clear the fit class to edit manually' : undefined}
			class="{inputBase} w-22 {isoActive ? 'cursor-default bg-muted text-muted-foreground' : ''}"
		/>
		<span class="text-xs text-muted-foreground">&minus;</span>
		<input
			type="number"
			step="0.001"
			bind:value={lowerTol}
			readonly={isoActive}
			title={isoActive ? 'Derived from ISO 286 — clear the fit class to edit manually' : undefined}
			class="{inputBase} w-22 {isoActive ? 'cursor-default bg-muted text-muted-foreground' : ''}"
		/>
		<span class="w-6 shrink-0 text-xs text-muted-foreground">mm</span>
	</div>
	{#if fitError}
		<p class="text-xs text-destructive">{fitError}</p>
	{/if}
</div>
