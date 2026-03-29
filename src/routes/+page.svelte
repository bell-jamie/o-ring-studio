<script lang="ts">
	import type { PistonSealInputs, PistonSealResults, AcceptanceCriteria } from '$lib/types';
	import { calculateAll, generateHousing, applyEccentricity } from '$lib/calculations';
	import { lookupCSTolerance, lookupIDTolerance, type OringClass } from '$lib/iso3601';
	import TolerancedInput from '$lib/components/TolerancedInput.svelte';
	import ResultRow from '$lib/components/ResultRow.svelte';
	import OringSimulator from '$lib/components/OringSimulator.svelte';
	import { ISO3601_SIZES, type SizeClass } from '$lib/iso3601-sizes';

	// Input state — strings for binding to number inputs
	let inputs = $state({
		boreDia: { nominal: '', upperTol: '', lowerTol: '' },
		pistonDia: { nominal: '', upperTol: '', lowerTol: '' },
		grooveDia: { nominal: '', upperTol: '', lowerTol: '' },
		grooveWidth: { nominal: '', upperTol: '0.1', lowerTol: '0.1' },
		grooveRadii: { nominal: '', upperTol: '0.1', lowerTol: '0.1' },
		oRingCS: { nominal: '', upperTol: '', lowerTol: '' },
		oRingID: { nominal: '', upperTol: '', lowerTol: '' }
	});

	// ISO 3601 auto-populate tolerances when nominal or class changes
	$effect(() => {
		const v = parseFloat(inputs.oRingCS.nominal);
		const cls: OringClass = sizeClass;
		if (!isNaN(v) && v > 0) {
			const tol = lookupCSTolerance(v, cls);
			if (tol) {
				inputs.oRingCS.upperTol = String(tol.upper);
				inputs.oRingCS.lowerTol = String(Math.abs(tol.lower));
			}
		}
	});
	$effect(() => {
		const v = parseFloat(inputs.oRingID.nominal);
		const cls: OringClass = sizeClass;
		if (!isNaN(v) && v > 0) {
			const tol = lookupIDTolerance(v, cls);
			if (tol) {
				inputs.oRingID.upperTol = String(tol.upper);
				inputs.oRingID.lowerTol = String(Math.abs(tol.lower));
			}
		}
	});

	function parseDim(d: { nominal: string; upperTol: string; lowerTol: string }) {
		const nom = parseFloat(d.nominal);
		const upper = parseFloat(d.upperTol);
		const lower = parseFloat(d.lowerTol);
		if (isNaN(nom) || isNaN(upper) || isNaN(lower)) return null;
		return { nominal: nom, upperTol: upper, lowerTol: -Math.abs(lower) };
	}

	const parsed = $derived(() => {
		const boreDia = parseDim(inputs.boreDia);
		const pistonDia = parseDim(inputs.pistonDia);
		const grooveDia = parseDim(inputs.grooveDia);
		const grooveWidth = parseDim(inputs.grooveWidth);
		const grooveRadii = parseDim(inputs.grooveRadii);
		const oRingCS = parseDim(inputs.oRingCS);
		const oRingID = parseDim(inputs.oRingID);
		if (
			!boreDia ||
			!pistonDia ||
			!grooveDia ||
			!grooveWidth ||
			!grooveRadii ||
			!oRingCS ||
			!oRingID
		)
			return null;
		return {
			boreDia,
			pistonDia,
			grooveDia,
			grooveWidth,
			grooveRadii,
			oRingCS,
			oRingID
		} as PistonSealInputs;
	});

	const results = $derived(parsed() ? calculateAll(parsed()!) : null);

	// Standard size — simple A/B toggle
	let sizeClass = $state<'A' | 'B'>('A');

	// CS options: Class A uses INCH_SIZES directly, Class B merges inch + metric with labels
	interface CSOption {
		cs: number;
		label: string;
		group?: string;
		sourceKey: SizeClass;
	}
	const csOptions = $derived.by((): CSOption[] => {
		if (sizeClass === 'A') {
			return ISO3601_SIZES['A'].map((g) => ({
				cs: g.cs,
				label: `${g.cs.toFixed(2)} mm`,
				sourceKey: 'A' as SizeClass
			}));
		}
		const inch = ISO3601_SIZES['B-in'].map((g) => ({
			cs: g.cs,
			label: `${g.cs.toFixed(2)} mm`,
			group: 'Inch-derived',
			sourceKey: 'B-in' as SizeClass
		}));
		const metric = ISO3601_SIZES['B-mm'].map((g) => ({
			cs: g.cs,
			label: `${g.cs.toFixed(1)} mm`,
			group: 'Metric',
			sourceKey: 'B-mm' as SizeClass
		}));
		return [...inch, ...metric];
	});

	// Find which CS option matches the current input
	const matchedCS = $derived.by(() => {
		const cs = parseFloat(inputs.oRingCS.nominal);
		if (isNaN(cs)) return null;
		return csOptions.find((o) => Math.abs(o.cs - cs) < 0.001) ?? null;
	});

	// Active size group for the matched CS
	const activeGroup = $derived.by(() => {
		if (!matchedCS) return null;
		const groups = ISO3601_SIZES[matchedCS.sourceKey];
		return groups.find((g) => Math.abs(g.cs - matchedCS.cs) < 0.001) ?? null;
	});

	// Find matched ID size (for dash number display)
	const matchedSize = $derived.by(() => {
		const id = parseFloat(inputs.oRingID.nominal);
		if (isNaN(id) || !activeGroup) return null;
		return activeGroup.sizes.find((s) => Math.abs(s.id - id) < 0.001) ?? null;
	});

	const canGenerate = $derived(() => {
		const cs = parseFloat(inputs.oRingCS.nominal);
		const id = parseFloat(inputs.oRingID.nominal);
		return !isNaN(cs) && cs > 0 && !isNaN(id) && id > 0;
	});

	function onGenerate() {
		const cs = parseFloat(inputs.oRingCS.nominal);
		const id = parseFloat(inputs.oRingID.nominal);
		if (isNaN(cs) || isNaN(id)) return;
		const h = generateHousing(cs, id, 5, 20, 65);
		inputs.grooveRadii.nominal = '0.3';
		inputs.boreDia.nominal = String(h.boreDia);
		inputs.pistonDia.nominal = String(h.pistonDia);
		inputs.grooveDia.nominal = String(h.grooveDia);
		inputs.grooveWidth.nominal = String(h.grooveWidth);
	}

	let eccentricity = $state(0);
	let showEccentricity = $state(false);
	let showDetails = $state(false);

	// Dark mode
	let dark = $state(false);

	function initTheme() {
		const stored = localStorage.getItem('theme');
		if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
			dark = true;
		}
		applyTheme();
	}

	function applyTheme() {
		document.documentElement.classList.toggle('dark', dark);
	}

	function toggleTheme() {
		dark = !dark;
		localStorage.setItem('theme', dark ? 'dark' : 'light');
		applyTheme();
	}

	// Disclaimer modal
	let disclaimerOpen = $state(false);

	$effect(() => {
		initTheme();
		if (!localStorage.getItem('disclaimerSeen')) {
			disclaimerOpen = true;
		}
	});

	function closeDisclaimer() {
		disclaimerOpen = false;
		localStorage.setItem('disclaimerSeen', 'true');
	}

	// Combobox state
	let csOpen = $state(false);
	let idOpen = $state(false);

	function comboSelect(field: 'oRingCS' | 'oRingID', value: string, close: () => void) {
		inputs[field].nominal = value;
		close();
	}

	const eccResults = $derived(
		results && parsed() && showEccentricity
			? applyEccentricity(results, parsed()!, eccentricity)
			: null
	);

	const extrusionGapMax = $derived.by(() => {
		const csVal = parseFloat(inputs.oRingCS.nominal);
		if (isNaN(csVal) || csVal <= 0) return 0.25;
		return Math.round(0.031 * Math.pow(csVal, 0.82) * 1000) / 1000;
	});

	const CRITERIA: Record<string, AcceptanceCriteria> = {
		stretch: { min: 2, max: 8 },
		compression: { min: 10, max: 35 },
		fill: { min: 0, max: 85 }
	};
	const extrusionGapCriteria = $derived<AcceptanceCriteria>({ min: 0, max: extrusionGapMax });
</script>

<div class="min-h-screen bg-background pb-24">
	<!-- Header -->
	<header class="border-b border-border bg-card">
		<div class="mx-auto max-w-5xl px-6 py-5">
			<h1 class="text-xl font-semibold text-foreground">O-Ring Studio</h1>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-8">
		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Inputs -->
			<div class="space-y-6">
				<!-- Hardware dimensions -->
				<section class="rounded-xl border border-border bg-card p-5">
					<h2 class="mb-4 text-sm font-medium text-foreground">Hardware Dimensions</h2>
					<div class="space-y-4">
						<TolerancedInput
							label="Bore Diameter"
							placeholder="-"
							fitType="hole"
							defaultFitClass="H8"
							bind:nominal={inputs.boreDia.nominal}
							bind:upperTol={inputs.boreDia.upperTol}
							bind:lowerTol={inputs.boreDia.lowerTol}
						/>
						<TolerancedInput
							label="Piston Diameter"
							placeholder="-"
							fitType="shaft"
							defaultFitClass="f7"
							bind:nominal={inputs.pistonDia.nominal}
							bind:upperTol={inputs.pistonDia.upperTol}
							bind:lowerTol={inputs.pistonDia.lowerTol}
						/>
						<TolerancedInput
							label="Groove Diameter"
							placeholder="-"
							fitType="shaft"
							defaultFitClass="h9"
							bind:nominal={inputs.grooveDia.nominal}
							bind:upperTol={inputs.grooveDia.upperTol}
							bind:lowerTol={inputs.grooveDia.lowerTol}
						/>
						<TolerancedInput
							label="Groove Width"
							placeholder="-"
							bind:nominal={inputs.grooveWidth.nominal}
							bind:upperTol={inputs.grooveWidth.upperTol}
							bind:lowerTol={inputs.grooveWidth.lowerTol}
						/>
						<TolerancedInput
							label="Groove Radii"
							placeholder="-"
							bind:nominal={inputs.grooveRadii.nominal}
							bind:upperTol={inputs.grooveRadii.upperTol}
							bind:lowerTol={inputs.grooveRadii.lowerTol}
						/>
					</div>
				</section>

				<!-- O-Ring dimensions -->
				<section class="rounded-xl border border-border bg-card p-5">
					<div class="mb-4 flex flex-col gap-2">
						<h2 class="text-sm font-medium text-foreground">O-Ring Dimensions</h2>
						<div class="flex items-center gap-2">
							<span class="text-[10px] text-muted-foreground">ISO 3601-1</span>
							{#if matchedSize?.dash}
								<span
									class="rounded bg-foreground px-1.5 py-0.5 font-mono text-[10px] font-bold text-background"
									>{matchedSize.dash}</span
								>
							{/if}
							<div class="ml-auto flex rounded border border-input text-[10px] font-medium">
								<button
									onclick={() => (sizeClass = 'A')}
									class="rounded-l px-2 py-0.5 transition-colors {sizeClass === 'A'
										? 'bg-primary text-primary-foreground'
										: 'text-muted-foreground hover:bg-muted'}">Class A</button
								>
								<button
									onclick={() => (sizeClass = 'B')}
									class="rounded-r border-l border-input px-2 py-0.5 transition-colors {sizeClass ===
									'B'
										? 'bg-primary text-primary-foreground'
										: 'text-muted-foreground hover:bg-muted'}">Class B</button
								>
							</div>
						</div>
					</div>
					<div class="space-y-4">
						<!-- CS row -->
						<div class="space-y-1.5">
							<span class="text-sm text-muted-foreground">Cross-Section</span>
							<div class="flex items-center gap-1.5">
								<!-- svelte-ignore a11y_role_has_required_aria_props -->
								<div class="relative min-w-0 flex-1" role="combobox">
									<input
										type="text"
										inputmode="decimal"
										placeholder="CS"
										bind:value={inputs.oRingCS.nominal}
										onclick={() => (csOpen = true)}
										onfocus={() => (csOpen = true)}
										onblur={() => setTimeout(() => (csOpen = false), 150)}
										class="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									/>
									{#if csOpen}
										<div
											class="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-card py-1 shadow-md"
										>
											{#if sizeClass === 'A'}
												{#each csOptions as opt (opt.cs)}
													<button
														type="button"
														onmousedown={(e) => {
															e.preventDefault();
															comboSelect('oRingCS', String(opt.cs), () => (csOpen = false));
														}}
														class="flex w-full px-2.5 py-1.5 text-left text-sm hover:bg-muted {String(
															opt.cs
														) === inputs.oRingCS.nominal
															? 'bg-muted font-medium'
															: 'text-foreground'}">{opt.cs}</button
													>
												{/each}
											{:else}
												{@const inchOpts = csOptions.filter((o) => o.group === 'Inch-derived')}
												{@const metricOpts = csOptions.filter((o) => o.group === 'Metric')}
												<div
													class="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
												>
													Inch-derived
												</div>
												{#each inchOpts as opt (opt.cs + opt.sourceKey)}
													<button
														type="button"
														onmousedown={(e) => {
															e.preventDefault();
															comboSelect('oRingCS', String(opt.cs), () => (csOpen = false));
														}}
														class="flex w-full px-2.5 py-1.5 text-left text-sm hover:bg-muted {String(
															opt.cs
														) === inputs.oRingCS.nominal
															? 'bg-muted font-medium'
															: 'text-foreground'}">{opt.cs}</button
													>
												{/each}
												<div
													class="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
												>
													Metric
												</div>
												{#each metricOpts as opt (opt.cs + opt.sourceKey)}
													<button
														type="button"
														onmousedown={(e) => {
															e.preventDefault();
															comboSelect('oRingCS', String(opt.cs), () => (csOpen = false));
														}}
														class="flex w-full px-2.5 py-1.5 text-left text-sm hover:bg-muted {String(
															opt.cs
														) === inputs.oRingCS.nominal
															? 'bg-muted font-medium'
															: 'text-foreground'}">{opt.cs}</button
													>
												{/each}
											{/if}
										</div>
									{/if}
								</div>
								<span class="text-xs text-muted-foreground">+</span>
								<input
									type="number"
									step="0.001"
									bind:value={inputs.oRingCS.upperTol}
									class="w-22 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
								/>
								<span class="text-xs text-muted-foreground">&minus;</span>
								<input
									type="number"
									step="0.001"
									bind:value={inputs.oRingCS.lowerTol}
									class="w-22 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
								/>
								<span class="w-6 shrink-0 text-xs text-muted-foreground">mm</span>
							</div>
						</div>

						<!-- ID row -->
						<div class="space-y-1.5">
							<span class="text-sm text-muted-foreground">Inner Diameter</span>
							<div class="flex items-center gap-1.5">
								<!-- svelte-ignore a11y_role_has_required_aria_props -->
								<div class="relative min-w-0 flex-1" role="combobox">
									<input
										type="text"
										inputmode="decimal"
										placeholder="ID"
										bind:value={inputs.oRingID.nominal}
										onclick={() => activeGroup && (idOpen = true)}
										onfocus={() => activeGroup && (idOpen = true)}
										onblur={() => setTimeout(() => (idOpen = false), 150)}
										class="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									/>
									{#if idOpen && activeGroup}
										<div
											class="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-card py-1 shadow-md"
										>
											{#each activeGroup.sizes as size (size.id)}
												<button
													type="button"
													onmousedown={(e) => {
														e.preventDefault();
														comboSelect('oRingID', String(size.id), () => (idOpen = false));
													}}
													class="flex w-full px-2.5 py-1.5 text-left text-sm hover:bg-muted {String(
														size.id
													) === inputs.oRingID.nominal
														? 'bg-muted font-medium'
														: 'text-foreground'}"
													>{size.id.toFixed(2)}{#if size.dash}<span
															class="ml-auto rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground"
															>{size.dash}</span
														>{/if}</button
												>
											{/each}
										</div>
									{/if}
								</div>
								<span class="text-xs text-muted-foreground">+</span>
								<input
									type="number"
									step="0.001"
									bind:value={inputs.oRingID.upperTol}
									class="w-22 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
								/>
								<span class="text-xs text-muted-foreground">&minus;</span>
								<input
									type="number"
									step="0.001"
									bind:value={inputs.oRingID.lowerTol}
									class="w-22 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
								/>
								<span class="w-6 shrink-0 text-xs text-muted-foreground">mm</span>
							</div>
						</div>

						{#if canGenerate()}
							<button
								onclick={onGenerate}
								class="mt-1 w-full rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
							>
								Auto-generate housing
							</button>
						{/if}
					</div>
				</section>
			</div>

			<!-- Results -->
			<div class="space-y-4">
				<section class="rounded-xl border border-border bg-card p-5">
					<div class="mb-4 flex items-center gap-2">
						<h2 class="text-sm font-medium text-foreground">Results</h2>
						<button
							type="button"
							onclick={() => {
								showEccentricity = !showEccentricity;
								if (!showEccentricity) eccentricity = 0;
							}}
							class="ml-auto rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors {showEccentricity
								? 'border-primary bg-primary/10 text-primary'
								: 'border-input text-muted-foreground hover:border-foreground/20 hover:text-foreground'}"
						>
							{showEccentricity ? 'Non-concentric' : 'Concentric'}
						</button>
					</div>

					{#if !results}
						<div class="rounded-lg border border-border bg-muted/40 px-4 py-10 text-center">
							<p class="text-sm text-muted-foreground">
								Enter all dimensions with tolerances to see results.
							</p>
						</div>
					{:else}
						{#if showEccentricity}
							<!-- Eccentricity slider -->
							<div class="mb-3">
								<label for="eccentricity-slider" class="flex items-center justify-between text-xs">
									<span class="text-muted-foreground">Piston eccentricity</span>
									<span class="font-mono text-foreground"
										>{(eccentricity * 100).toFixed(0)}%</span
									>
								</label>
								<input
									id="eccentricity-slider"
									type="range"
									min="0"
									max="1"
									step="0.01"
									bind:value={eccentricity}
									class="mt-0.5 w-full accent-primary"
								/>
								<div class="flex justify-between text-[10px] text-muted-foreground">
									<span>Concentric</span>
									<span>Fully eccentric</span>
								</div>
							</div>
						{/if}

						<div class="space-y-3">
							<ResultRow
								label="O-Ring Stretch"
								result={results.stretch}
								criteria={CRITERIA.stretch}
							/>

							<ResultRow
								label="Compression"
								result={eccResults ? eccResults.tight.compression : results.compression}
								criteria={CRITERIA.compression}
								secondResult={eccResults?.loose.compression}
							/>

							<ResultRow
								label="Groove Fill"
								result={eccResults ? eccResults.tight.fill : results.fill}
								criteria={CRITERIA.fill}
								secondResult={eccResults?.loose.fill}
							/>

							<ResultRow
								label="Extrusion Gap"
								result={eccResults ? eccResults.tight.extrusionGap : results.extrusionGap}
								criteria={extrusionGapCriteria}
								unit=" mm"
								decimals={3}
								secondResult={eccResults?.loose.extrusionGap}
							/>
						</div>
					{/if}
				</section>

				{#if results}
					<button
						onclick={() => (showDetails = !showDetails)}
						class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
					>
						<svg
							class="size-3.5 transition-transform {showDetails ? 'rotate-180' : ''}"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg
						>
						{showDetails ? 'Hide' : 'Show'} derived dimensions & formulas
					</button>
				{/if}

				{#if showDetails && results}
					<!-- Derived dimensions -->
					<section class="rounded-xl border border-border bg-card p-5">
						<h2 class="mb-3 text-sm font-medium text-foreground">Derived Dimensions</h2>
						<div class="space-y-2">
							<div
								class="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
							>
								<span class="text-sm text-muted-foreground">Groove Depth</span>
								<span class="font-mono text-xs text-foreground">
									{results.grooveDepth.min.toFixed(3)} /
									<span class="font-semibold">{results.grooveDepth.nominal.toFixed(3)}</span>
									/ {results.grooveDepth.max.toFixed(3)} mm
								</span>
							</div>
							<div
								class="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
							>
								<span class="text-sm text-muted-foreground">Installed Height</span>
								<span class="font-mono text-xs text-foreground">
									{results.installedHeight.min.toFixed(3)} /
									<span class="font-semibold">{results.installedHeight.nominal.toFixed(3)}</span>
									/ {results.installedHeight.max.toFixed(3)} mm
								</span>
							</div>
							<div
								class="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
							>
								<span class="text-sm text-muted-foreground">CS incl. stretch</span>
								<span class="font-mono text-xs text-foreground">
									{results.stretchedCS.min.toFixed(3)} /
									<span class="font-semibold">{results.stretchedCS.nominal.toFixed(3)}</span>
									/ {results.stretchedCS.max.toFixed(3)} mm
								</span>
							</div>
						</div>
					</section>

					<!-- Formulas -->
					<section class="rounded-xl border border-border bg-card p-5">
						<h2 class="mb-3 text-sm font-medium text-foreground">Formulas</h2>
						<dl class="space-y-2 text-xs text-muted-foreground">
							<div class="flex justify-between gap-4">
								<dt>Stretch %</dt>
								<dd class="font-mono text-right text-foreground">
									(grooveDia &minus; ID) / ID &times; 100
								</dd>
							</div>
							<div class="flex justify-between gap-4">
								<dt>Compression %</dt>
								<dd class="font-mono text-right text-foreground">
									(CS &minus; installedHt) / CS &times; 100
								</dd>
							</div>
							<div class="flex justify-between gap-4">
								<dt>Fill %</dt>
								<dd class="font-mono text-right text-foreground">
									&pi;(CS/2)&sup2; / grooveArea &times; 100
								</dd>
							</div>
							<div class="flex justify-between gap-4">
								<dt>Groove depth</dt>
								<dd class="font-mono text-right text-foreground">
									(pistonDia &minus; grooveDia) / 2
								</dd>
							</div>
							<div class="flex justify-between gap-4">
								<dt>Installed height</dt>
								<dd class="font-mono text-right text-foreground">
									(boreDia &minus; grooveDia) / 2
								</dd>
							</div>
							<div class="flex justify-between gap-4">
								<dt>Extrusion gap</dt>
								<dd class="font-mono text-right text-foreground">
									(boreDia &minus; pistonDia) / 2
								</dd>
							</div>
						</dl>
					</section>
				{/if}
			</div>
		</div>

		<!-- Simulation -->
		<section class="mt-6 rounded-xl border border-border bg-card p-5">
			<h2 class="mb-4 text-sm font-medium text-foreground">Simulation</h2>

			{#if !results || !parsed()}
				<div class="rounded-lg border border-border bg-muted/40 px-4 py-10 text-center">
					<p class="text-sm text-muted-foreground">Enter all dimensions to enable the simulator.</p>
				</div>
			{:else}
				<OringSimulator
					cs={parsed()!.oRingCS.nominal}
					glandDepth={results.installedHeight.nominal}
					grooveWidth={parsed()!.grooveWidth.nominal}
					clearance={(parsed()!.boreDia.nominal - parsed()!.pistonDia.nominal) / 2}
					stretchPercent={results.stretch.nominal}
					grooveRadii={parsed()!.grooveRadii.nominal}
				/>
			{/if}
		</section>
	</main>
</div>

<!-- Disclaimer modal -->
{#if disclaimerOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 transition-opacity"
		onclick={(e) => { if (e.target === e.currentTarget) closeDisclaimer(); }}
		onkeydown={(e) => { if (e.key === 'Escape') closeDisclaimer(); }}
	>
		<div class="w-[90%] max-w-[500px] rounded-xl border border-border bg-card p-8 shadow-lg">
			<h2 class="mb-4 text-2xl font-semibold text-foreground">Disclaimer</h2>
			<p class="mb-4 leading-relaxed text-muted-foreground">
				These tools are provided for educational and reference purposes only. The author accepts no
				liability for any decisions, designs, or outcomes resulting from the use of these calculators.
			</p>
			<p class="mb-4 leading-relaxed text-muted-foreground">
				Always verify results independently and consult qualified professionals for critical
				engineering applications.
			</p>
			<button
				onclick={closeDisclaimer}
				class="mt-2 w-full rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground transition-colors hover:brightness-90"
			>
				I Understand
			</button>
		</div>
	</div>
{/if}

<!-- Status bar -->
<footer class="fixed bottom-0 left-0 right-0 z-50 flex items-center border-t border-border bg-background py-4">
	<div class="relative mx-auto flex w-full max-w-5xl items-center justify-center px-8">
		<div class="absolute left-8">
			<button
				onclick={() => (disclaimerOpen = true)}
				class="flex items-center justify-center rounded-md border border-border px-2.5 py-1.5 text-muted-foreground transition-all duration-300 hover:border-primary hover:bg-primary/10 hover:text-primary"
				aria-label="View disclaimer"
				title="Disclaimer"
			>
				<svg class="size-4" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
				</svg>
			</button>
		</div>
		<div class="flex flex-wrap items-center justify-center gap-3">
			<span class="text-sm text-muted-foreground">&copy; 2025 James Bell</span>
			<span class="select-none text-sm text-muted-foreground/40">&middot;</span>
			<a
				href="https://github.com/bell-jamie"
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:text-primary"
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
				</svg>
				GitHub
			</a>
			<a
				href="https://www.linkedin.com/in/bell-jamie/"
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:text-primary"
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="currentColor">
					<path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
				</svg>
				LinkedIn
			</a>
			<a
				href="mailto:james.m.h.bell@icloud.com"
				class="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:text-primary"
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
					<polyline points="22,6 12,13 2,6" />
				</svg>
				Email
			</a>
		</div>
		<div class="absolute right-8">
			<button
				onclick={toggleTheme}
				class="flex items-center justify-center rounded-md border border-border px-2.5 py-1.5 text-muted-foreground transition-all duration-300 hover:border-primary hover:bg-primary/10 hover:text-primary"
				aria-label="Toggle dark mode"
				title="Toggle theme"
			>
				{#if dark}
					<svg class="size-4" fill="currentColor" viewBox="0 0 20 20">
						<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
					</svg>
				{:else}
					<svg class="size-4" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd" />
					</svg>
				{/if}
			</button>
		</div>
	</div>
</footer>
