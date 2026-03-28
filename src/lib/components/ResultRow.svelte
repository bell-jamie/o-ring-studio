<script lang="ts">
	import { CircleAlert, CircleCheck, TriangleAlert } from '@lucide/svelte';
	import { getStatus } from '$lib/calculations';
	import type { RangeResult, AcceptanceCriteria, Status } from '$lib/types';

	interface Props {
		label: string;
		result: RangeResult;
		criteria: AcceptanceCriteria;
		unit?: string;
		decimals?: number;
		/** Second result for eccentric/side-loaded display (stacked on same card) */
		secondResult?: RangeResult;
	}

	let { label, result, criteria, unit = '%', decimals = 1, secondResult }: Props = $props();

	const statusIcon: Record<Status, typeof CircleCheck> = {
		ok: CircleCheck,
		warn: TriangleAlert,
		error: CircleAlert
	};
	const statusColor: Record<Status, string> = {
		ok: 'text-emerald-600',
		warn: 'text-amber-500',
		error: 'text-destructive'
	};
	const statusBg: Record<Status, string> = {
		ok: 'bg-emerald-50 border-emerald-200',
		warn: 'bg-amber-50 border-amber-200',
		error: 'bg-red-50 border-red-200'
	};
	const statusDot: Record<Status, string> = {
		ok: 'bg-emerald-500',
		warn: 'bg-amber-500',
		error: 'bg-red-500'
	};

	function getWorst(...statuses: Status[]): Status {
		if (statuses.includes('error')) return 'error';
		if (statuses.includes('warn')) return 'warn';
		return 'ok';
	}

	// Primary result statuses
	const minStatus = $derived(getStatus(result.min, criteria));
	const nomStatus = $derived(getStatus(result.nominal, criteria));
	const maxStatus = $derived(getStatus(result.max, criteria));
	const worstStatus = $derived(getWorst(minStatus, nomStatus, maxStatus));

	// Second result statuses (when eccentric)
	const minStatus2 = $derived(secondResult ? getStatus(secondResult.min, criteria) : 'ok' as Status);
	const nomStatus2 = $derived(secondResult ? getStatus(secondResult.nominal, criteria) : 'ok' as Status);
	const maxStatus2 = $derived(secondResult ? getStatus(secondResult.max, criteria) : 'ok' as Status);
	const worstStatus2 = $derived(getWorst(minStatus2, nomStatus2, maxStatus2));

	// Overall card status includes both results
	const cardStatus = $derived(secondResult ? getWorst(worstStatus, worstStatus2) : worstStatus);

	const OverallIcon = $derived(statusIcon[cardStatus]);

	// Gauge bar positioning — shared range across both results so bars are comparable
	const allVals = $derived(
		secondResult
			? [result.min, result.max, secondResult.min, secondResult.max]
			: [result.min, result.max]
	);
	const pad = $derived((criteria.max - criteria.min) * 0.4);
	const vizMin = $derived(Math.min(criteria.min, ...allVals) - pad);
	const vizMax = $derived(Math.max(criteria.max, ...allVals) + pad);
	const span = $derived(vizMax - vizMin || 1);
	const pct = (v: number) => Math.max(0, Math.min(100, ((v - vizMin) / span) * 100));

	function fmt(val: number): string {
		return val.toFixed(decimals);
	}
</script>

{#snippet gauge(r: RangeResult, wStat: Status, mnStat: Status, nmStat: Status, mxStat: Status, sideLabel?: string)}
	{@const MnIcon = statusIcon[mnStat]}
	{@const MxIcon = statusIcon[mxStat]}

	{#if sideLabel}
		<div class="mt-2.5 mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
			{sideLabel}
		</div>
	{/if}

	<!-- Nominal hero -->
	<div class="text-center {sideLabel ? '' : 'mt-1.5'}">
		<span class="font-mono text-2xl font-bold tracking-tight {statusColor[nmStat]}">
			{fmt(r.nominal)}
		</span>
		<span class="text-sm text-muted-foreground">{unit}</span>
	</div>

	<!-- Min / Max flanking -->
	<div class="mt-0.5 flex items-center justify-between px-1">
		<div class="flex items-center gap-1">
			<MnIcon class="size-2.5 {statusColor[mnStat]}" />
			<span class="font-mono text-[11px] text-muted-foreground">
				{fmt(r.min)}{unit}
			</span>
		</div>
		<span class="text-[10px] text-muted-foreground/50">min / max</span>
		<div class="flex items-center gap-1">
			<span class="font-mono text-[11px] text-muted-foreground">
				{fmt(r.max)}{unit}
			</span>
			<MxIcon class="size-2.5 {statusColor[mxStat]}" />
		</div>
	</div>

	<!-- Gauge bar -->
	<div class="relative mt-1.5 h-1.5 rounded-full bg-muted">
		<!-- Acceptance zone -->
		<div
			class="absolute inset-y-0 rounded-full bg-emerald-400/25"
			style="left: {pct(criteria.min)}%; right: {100 - pct(criteria.max)}%"
		></div>
		<!-- Value range (min to max) -->
		<div
			class="absolute inset-y-0 rounded-full bg-current opacity-15 {statusColor[wStat]}"
			style="left: {pct(r.min)}%; right: {100 - pct(r.max)}%"
		></div>
		<!-- Min tick -->
		<div
			class="absolute top-1/2 h-3 w-px -translate-y-1/2 {statusDot[mnStat]} opacity-40"
			style="left: {pct(r.min)}%"
		></div>
		<!-- Max tick -->
		<div
			class="absolute top-1/2 h-3 w-px -translate-y-1/2 {statusDot[mxStat]} opacity-40"
			style="left: {pct(r.max)}%"
		></div>
		<!-- Nominal dot -->
		<div
			class="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background {statusDot[nmStat]}"
			style="left: {pct(r.nominal)}%"
		></div>
	</div>
{/snippet}

<div class="rounded-lg border {statusBg[cardStatus]} px-4 py-3">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<OverallIcon class="size-4 shrink-0 {statusColor[cardStatus]}" />
			<span class="text-sm font-medium text-foreground">{label}</span>
		</div>
		<span class="text-[10px] text-muted-foreground">
			Target {criteria.min}{unit} – {criteria.max}{unit}
		</span>
	</div>

	{#if secondResult}
		{@render gauge(result, worstStatus, minStatus, nomStatus, maxStatus, 'loaded')}
		{@render gauge(secondResult, worstStatus2, minStatus2, nomStatus2, maxStatus2, 'unloaded')}
	{:else}
		{@render gauge(result, worstStatus, minStatus, nomStatus, maxStatus)}
	{/if}
</div>
