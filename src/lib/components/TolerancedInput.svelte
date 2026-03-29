<script lang="ts">
	import type { FitType } from '$lib/iso286';
	import { lookupIso286, isValidClass } from '$lib/iso286';

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
	}

	let {
		label,
		nominal = $bindable(),
		upperTol = $bindable(),
		lowerTol = $bindable(),
		placeholder = '',
		isoLabel,
		fitType,
		defaultFitClass = ''
	}: Props = $props();

	let fitClass = $state((() => defaultFitClass)());
	let fitError = $state(false);

	// Auto-populate tolerances from ISO 286 when nominal or fitClass changes
	$effect(() => {
		const nom = parseFloat(nominal);
		if (fitClass && fitType && !isNaN(nom) && nom > 0) {
			if (isValidClass(fitClass, fitType)) {
				fitError = false;
				try {
					const tol = lookupIso286(nom, fitClass);
					upperTol = String(tol.upper);
					lowerTol = String(Math.abs(tol.lower));
				} catch {
					fitError = true;
				}
			} else {
				fitError = true;
			}
		} else {
			fitError = false;
		}
	});

	const inputBase =
		'rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';
</script>

<div class="space-y-1.5">
	<div class="flex items-center gap-2">
		<span class="text-sm text-muted-foreground">{label}</span>
		{#if isoLabel}
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
				placeholder={fitType === 'hole' ? 'H7' : 'h6'}
				bind:value={fitClass}
				class="{inputBase} w-14 text-center font-mono {fitError
					? 'border-destructive ring-destructive/30'
					: fitClass
						? 'border-primary/50'
						: ''}"
			/>
		{/if}
		<span class="text-xs text-muted-foreground">+</span>
		<input
			type="number"
			step="0.001"
			bind:value={upperTol}
			class="{inputBase} w-22"
		/>
		<span class="text-xs text-muted-foreground">&minus;</span>
		<input
			type="number"
			step="0.001"
			bind:value={lowerTol}
			class="{inputBase} w-22"
		/>
		<span class="w-6 shrink-0 text-xs text-muted-foreground">mm</span>
	</div>
</div>
