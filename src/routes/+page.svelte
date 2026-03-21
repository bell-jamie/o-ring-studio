<script lang="ts">
	import type { PistonSealInputs, PistonSealResults, AcceptanceCriteria } from '$lib/types';
	import { calculateAll } from '$lib/calculations';
	import { lookupCSTolerance, lookupIDTolerance } from '$lib/iso3601';
	import TolerancedInput from '$lib/components/TolerancedInput.svelte';
	import ResultRow from '$lib/components/ResultRow.svelte';

	// Input state — strings for binding to number inputs
	let inputs = $state({
		boreDia: { nominal: '', upperTol: '', lowerTol: '' },
		pistonDia: { nominal: '', upperTol: '', lowerTol: '' },
		grooveDia: { nominal: '', upperTol: '', lowerTol: '' },
		grooveWidth: { nominal: '', upperTol: '0.1', lowerTol: '0.1' },
		grooveRadii: { nominal: '0.3', upperTol: '0.1', lowerTol: '0.1' },
		oRingCS: { nominal: '', upperTol: '', lowerTol: '' },
		oRingID: { nominal: '', upperTol: '', lowerTol: '' }
	});

	// ISO 3601 auto-populate for CS tolerances
	let csIsoOverridden = $state(false);
	$effect(() => {
		const nom = parseFloat(inputs.oRingCS.nominal);
		if (!isNaN(nom) && nom > 0 && !csIsoOverridden) {
			const tol = lookupCSTolerance(nom);
			if (tol) {
				inputs.oRingCS.upperTol = String(tol.upper);
				inputs.oRingCS.lowerTol = String(Math.abs(tol.lower));
			}
		}
	});

	// ISO 3601 auto-populate for ID tolerances
	let idIsoOverridden = $state(false);
	$effect(() => {
		const nom = parseFloat(inputs.oRingID.nominal);
		if (!isNaN(nom) && nom > 0 && !idIsoOverridden) {
			const tol = lookupIDTolerance(nom);
			if (tol) {
				inputs.oRingID.upperTol = String(tol.upper);
				inputs.oRingID.lowerTol = String(Math.abs(tol.lower));
			}
		}
	});

	// Reset ISO override when nominal changes
	$effect(() => {
		void inputs.oRingCS.nominal;
		csIsoOverridden = false;
	});
	$effect(() => {
		void inputs.oRingID.nominal;
		idIsoOverridden = false;
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
		if (!boreDia || !pistonDia || !grooveDia || !grooveWidth || !grooveRadii || !oRingCS || !oRingID)
			return null;
		return { boreDia, pistonDia, grooveDia, grooveWidth, grooveRadii, oRingCS, oRingID } as PistonSealInputs;
	});

	const results = $derived(parsed() ? calculateAll(parsed()!) : null);

	const CRITERIA: Record<string, AcceptanceCriteria> = {
		stretch: { min: 2, max: 8 },
		compression: { min: 10, max: 35 },
		fill: { min: 0, max: 85 }
	};
</script>

<div class="min-h-screen bg-background">
	<!-- Header -->
	<header class="border-b border-border bg-card">
		<div class="mx-auto max-w-5xl px-6 py-5">
			<div>
				<h1 class="text-xl font-semibold text-foreground">O-Ring Compression Calculator</h1>
				<p class="mt-0.5 text-sm text-muted-foreground">
					Piston seal tolerance-stack analysis
				</p>
			</div>
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
							placeholder="e.g. 120.000"
							fitType="hole"
							defaultFitClass="H8"
							bind:nominal={inputs.boreDia.nominal}
							bind:upperTol={inputs.boreDia.upperTol}
							bind:lowerTol={inputs.boreDia.lowerTol}
						/>
						<TolerancedInput
							label="Piston Diameter"
							placeholder="e.g. 119.600"
							fitType="shaft"
							defaultFitClass="f7"
							bind:nominal={inputs.pistonDia.nominal}
							bind:upperTol={inputs.pistonDia.upperTol}
							bind:lowerTol={inputs.pistonDia.lowerTol}
						/>
						<TolerancedInput
							label="Groove Diameter"
							placeholder="e.g. 113.000"
							fitType="shaft"
							defaultFitClass="h9"
							bind:nominal={inputs.grooveDia.nominal}
							bind:upperTol={inputs.grooveDia.upperTol}
							bind:lowerTol={inputs.grooveDia.lowerTol}
						/>
						<TolerancedInput
							label="Groove Width"
							placeholder="e.g. 4.750"
							bind:nominal={inputs.grooveWidth.nominal}
							bind:upperTol={inputs.grooveWidth.upperTol}
							bind:lowerTol={inputs.grooveWidth.lowerTol}
						/>
						<TolerancedInput
							label="Groove Radii"
							placeholder="e.g. 0.400"
							bind:nominal={inputs.grooveRadii.nominal}
							bind:upperTol={inputs.grooveRadii.upperTol}
							bind:lowerTol={inputs.grooveRadii.lowerTol}
						/>
					</div>
				</section>

				<!-- O-Ring dimensions -->
				<section class="rounded-xl border border-border bg-card p-5">
					<h2 class="mb-4 text-sm font-medium text-foreground">O-Ring Dimensions</h2>
					<div class="space-y-4">
						<TolerancedInput
							label="Cross-Section (CS)"
							placeholder="e.g. 3.530"
							isoLabel="ISO 3601-1"
							bind:nominal={inputs.oRingCS.nominal}
							bind:upperTol={inputs.oRingCS.upperTol}
							bind:lowerTol={inputs.oRingCS.lowerTol}
						/>
						<TolerancedInput
							label="Inner Diameter (ID)"
							placeholder="e.g. 106.000"
							isoLabel="ISO 3601-1"
							bind:nominal={inputs.oRingID.nominal}
							bind:upperTol={inputs.oRingID.upperTol}
							bind:lowerTol={inputs.oRingID.lowerTol}
						/>
					</div>
				</section>
			</div>

			<!-- Results -->
			<div class="space-y-4">
				<section class="rounded-xl border border-border bg-card p-5">
					<h2 class="mb-4 text-sm font-medium text-foreground">Results</h2>

					{#if !results}
						<div class="rounded-lg border border-border bg-muted/40 px-4 py-10 text-center">
							<p class="text-sm text-muted-foreground">
								Enter all dimensions with tolerances to see results.
							</p>
						</div>
					{:else}
						<div class="space-y-3">
							<ResultRow
								label="O-Ring Stretch"
								result={results.stretch}
								criteria={CRITERIA.stretch}
							/>
							<ResultRow
								label="Compression"
								result={results.compression}
								criteria={CRITERIA.compression}
							/>
							<ResultRow
								label="Groove Fill"
								result={results.fill}
								criteria={CRITERIA.fill}
							/>
						</div>
					{/if}
				</section>

				<!-- Derived dimensions -->
				{#if results}
					<section class="rounded-xl border border-border bg-card p-5">
						<h2 class="mb-3 text-sm font-medium text-foreground">Derived Dimensions</h2>
						<div class="space-y-2">
							<div class="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
								<span class="text-sm text-muted-foreground">Groove Depth</span>
								<span class="font-mono text-xs text-foreground">
									{results.grooveDepth.min.toFixed(3)} / <span class="font-semibold">{results.grooveDepth.nominal.toFixed(3)}</span> / {results.grooveDepth.max.toFixed(3)} mm
								</span>
							</div>
							<div class="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
								<span class="text-sm text-muted-foreground">Installed Height</span>
								<span class="font-mono text-xs text-foreground">
									{results.installedHeight.min.toFixed(3)} / <span class="font-semibold">{results.installedHeight.nominal.toFixed(3)}</span> / {results.installedHeight.max.toFixed(3)} mm
								</span>
							</div>
							<div class="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
								<span class="text-sm text-muted-foreground">CS incl. stretch</span>
								<span class="font-mono text-xs text-foreground">
									{results.stretchedCS.min.toFixed(3)} / <span class="font-semibold">{results.stretchedCS.nominal.toFixed(3)}</span> / {results.stretchedCS.max.toFixed(3)} mm
								</span>
							</div>
						</div>
					</section>
				{/if}

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
					</dl>
				</section>
			</div>
		</div>

		<!-- Cross-section visualisation -->
		<section class="mt-6 rounded-xl border border-border bg-card p-5">
			<h2 class="mb-4 text-sm font-medium text-foreground">Cross-Section</h2>

			{#if !results}
				<div class="rounded-lg border border-border bg-muted/40 px-4 py-10 text-center">
					<p class="text-sm text-muted-foreground">Enter valid dimensions to see cross-section.</p>
				</div>
			{:else}
				{@const ih = results.installedHeight.nominal}
				{@const gd = results.grooveDepth.nominal}
				{@const csVal = parseFloat(inputs.oRingCS.nominal)}
				{@const gwVal = parseFloat(inputs.grooveWidth.nominal)}
				{@const rVal = parseFloat(inputs.grooveRadii.nominal)}
				{@const svgW = 400}
				{@const svgH = 230}
				{@const plateTh = 35}
				{@const topY = plateTh + 10}
				{@const maxGH = 120}
				{@const maxGW = 200}
				{@const totalH = ih + gd}
				{@const scale = Math.min(maxGW / gwVal, maxGH / totalH) * 0.8}
				{@const ihPx = ih * scale}
				{@const gdPx = gd * scale}
				{@const csPx = csVal * scale}
				{@const gwPx = gwVal * scale}
				{@const rPx = Math.min(rVal * scale, gdPx / 2, gwPx / 4)}
				{@const cx = svgW / 2}
				{@const boreY = topY}
				{@const pistonTop = topY + ihPx}
				{@const grooveFloor = pistonTop + gdPx}
				{@const grooveL = cx - gwPx / 2}
				{@const grooveR = cx + gwPx / 2}
				{@const btmPlateBot = Math.max(grooveFloor + plateTh, svgH - 10)}
				{@const ry = ihPx / 2}
				{@const rxRaw = ry > 0 ? (csPx / 2) * (csPx / 2) / ry : csPx / 2}
				{@const rx = Math.min(rxRaw, gwPx / 2 + 8)}
				{@const eCy = boreY + ihPx / 2}
				{@const circR = csPx / 2}
				{@const circCy = grooveFloor - circR}
				{@const dimX = grooveR + 24}
				{@const dimX2 = grooveR + 52}
				{@const dimYBot = grooveFloor + 20}
				{@const sqX = grooveL - 24}
				{@const sqPx = csPx - ihPx}
				{@const csTop = circCy - circR}
				{@const csBot = circCy + circR}
				<svg viewBox="0 0 {svgW} {svgH}" class="mx-auto w-full max-w-lg" role="img" aria-label="Piston seal cross-section">
					<defs>
						<pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
							<line x1="0" y1="0" x2="0" y2="6" class="stroke-muted-foreground/30" stroke-width="1" />
						</pattern>
						<clipPath id="below-bore">
							<rect x="0" y={boreY} width={svgW} height={svgH - boreY} />
						</clipPath>
					</defs>

					<!-- Bore wall (top) -->
					<rect x="0" y="0" width={svgW} height={boreY} fill="url(#hatch)" class="stroke-foreground/20" stroke-width="0.5" />
					<line x1="0" y1={boreY} x2={svgW} y2={boreY} class="stroke-foreground/60" stroke-width="1.5" />

					<!-- Piston body with groove -->
					<path
						d="M 0,{pistonTop} L {grooveL},{pistonTop} L {grooveL},{grooveFloor - rPx} A {rPx},{rPx} 0 0 1 {grooveL + rPx},{grooveFloor} L {grooveR - rPx},{grooveFloor} A {rPx},{rPx} 0 0 1 {grooveR},{grooveFloor - rPx} L {grooveR},{pistonTop} L {svgW},{pistonTop} L {svgW},{btmPlateBot} L 0,{btmPlateBot} Z"
						fill="url(#hatch)"
						class="stroke-foreground/20"
						stroke-width="0.5"
					/>
					<!-- Groove outline -->
					<path
						d="M {grooveL},{pistonTop} L {grooveL},{grooveFloor - rPx} A {rPx},{rPx} 0 0 1 {grooveL + rPx},{grooveFloor} L {grooveR - rPx},{grooveFloor} A {rPx},{rPx} 0 0 1 {grooveR},{grooveFloor - rPx} L {grooveR},{pistonTop}"
						fill="none"
						class="stroke-foreground/60"
						stroke-width="1.5"
					/>
					<!-- Piston top surface -->
					<line x1="0" y1={pistonTop} x2={svgW} y2={pistonTop} class="stroke-foreground/40" stroke-width="1" />

					<!-- Dashed circle: uncompressed o-ring -->
					<circle
						cx={cx}
						cy={circCy}
						r={circR}
						fill="none"
						stroke-dasharray="4 3"
						class="stroke-muted-foreground/40"
						stroke-width="1"
						clip-path="url(#below-bore)"
					/>

					<!-- Compressed o-ring (ellipse) -->
					<ellipse
						cx={cx}
						cy={eCy}
						{rx}
						{ry}
						fill="oklch(0.55 0.15 250 / 0.25)"
						class="stroke-primary"
						stroke-width="2"
					/>

					<!-- Dimension: groove width -->
					<line x1={grooveL} y1={dimYBot} x2={grooveR} y2={dimYBot} class="stroke-muted-foreground" stroke-width="1" />
					<line x1={grooveL} y1={dimYBot - 4} x2={grooveL} y2={dimYBot + 4} class="stroke-muted-foreground" stroke-width="1" />
					<line x1={grooveR} y1={dimYBot - 4} x2={grooveR} y2={dimYBot + 4} class="stroke-muted-foreground" stroke-width="1" />
					<line x1={grooveL} y1={grooveFloor} x2={grooveL} y2={dimYBot + 4} class="stroke-muted-foreground/40" stroke-width="0.5" stroke-dasharray="2 2" />
					<line x1={grooveR} y1={grooveFloor} x2={grooveR} y2={dimYBot + 4} class="stroke-muted-foreground/40" stroke-width="0.5" stroke-dasharray="2 2" />
					<text x={cx} y={dimYBot + 14} text-anchor="middle" class="fill-foreground text-[10px] font-mono">
						Width: {gwVal.toFixed(2)} mm
					</text>

					<!-- Dimension: installed height (bore to piston) -->
					<line x1={dimX} y1={boreY} x2={dimX} y2={pistonTop} class="stroke-muted-foreground" stroke-width="1" />
					<line x1={dimX - 4} y1={boreY} x2={dimX + 4} y2={boreY} class="stroke-muted-foreground" stroke-width="1" />
					<line x1={dimX - 4} y1={pistonTop} x2={dimX + 4} y2={pistonTop} class="stroke-muted-foreground" stroke-width="1" />
					<text x={dimX + 6} y={(boreY + pistonTop) / 2 + 3} class="fill-foreground text-[10px] font-mono" dominant-baseline="middle">
						IH: {ih.toFixed(2)}
					</text>

					<!-- Dimension: groove depth -->
					<line x1={dimX} y1={pistonTop} x2={dimX} y2={grooveFloor} class="stroke-muted-foreground" stroke-width="1" />
					<line x1={dimX - 4} y1={grooveFloor} x2={dimX + 4} y2={grooveFloor} class="stroke-muted-foreground" stroke-width="1" />
					<text x={dimX + 6} y={(pistonTop + grooveFloor) / 2 + 3} class="fill-foreground text-[10px] font-mono" dominant-baseline="middle">
						GD: {gd.toFixed(2)}
					</text>

					<!-- Dimension: CS -->
					<line x1={dimX2} y1={csTop} x2={dimX2} y2={csBot} class="stroke-primary" stroke-width="1" />
					<line x1={dimX2 - 4} y1={csTop} x2={dimX2 + 4} y2={csTop} class="stroke-primary" stroke-width="1" />
					<line x1={dimX2 - 4} y1={csBot} x2={dimX2 + 4} y2={csBot} class="stroke-primary" stroke-width="1" />
					<text x={dimX2 + 6} y={(csTop + csBot) / 2 + 3} class="fill-primary text-[10px] font-mono" dominant-baseline="middle">
						CS: {csVal.toFixed(2)}
					</text>

					<!-- Squeeze -->
					{#if sqPx > 4}
						<line x1={sqX} y1={csTop} x2={sqX} y2={boreY} class="stroke-destructive" stroke-width="1" />
						<line x1={sqX - 4} y1={csTop} x2={sqX + 4} y2={csTop} class="stroke-destructive" stroke-width="1" />
						<line x1={sqX - 4} y1={boreY} x2={sqX + 4} y2={boreY} class="stroke-destructive" stroke-width="1" />
						<text x={sqX - 6} y={(csTop + boreY) / 2 + 3} text-anchor="end" class="fill-destructive text-[10px] font-mono" dominant-baseline="middle">
							Sq: {(csVal - ih).toFixed(2)}
						</text>
					{/if}

					<!-- Legend -->
					<line x1="12" y1={svgH - 12} x2="28" y2={svgH - 12} stroke-dasharray="4 3" class="stroke-muted-foreground/40" stroke-width="1" />
					<text x="32" y={svgH - 9} class="fill-muted-foreground text-[9px]">Uncompressed</text>
					<line x1="110" y1={svgH - 12} x2="126" y2={svgH - 12} class="stroke-primary" stroke-width="2" />
					<text x="130" y={svgH - 9} class="fill-muted-foreground text-[9px]">Compressed</text>
				</svg>
			{/if}
		</section>
	</main>
</div>
