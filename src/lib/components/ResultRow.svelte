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
	}

	let { label, result, criteria, unit = '%', decimals = 1 }: Props = $props();

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

	const minStatus = $derived(getStatus(result.min, criteria));
	const nomStatus = $derived(getStatus(result.nominal, criteria));
	const maxStatus = $derived(getStatus(result.max, criteria));
	const worstStatus = $derived<Status>(
		[minStatus, nomStatus, maxStatus].includes('error')
			? 'error'
			: [minStatus, nomStatus, maxStatus].includes('warn')
				? 'warn'
				: 'ok'
	);

	const OverallIcon = $derived(statusIcon[worstStatus]);

	const entries = $derived([
		{ lbl: 'Min', val: result.min, s: minStatus },
		{ lbl: 'Nom', val: result.nominal, s: nomStatus },
		{ lbl: 'Max', val: result.max, s: maxStatus }
	]);

	function fmt(val: number): string {
		return val.toFixed(decimals);
	}
</script>

<div class="rounded-lg border {statusBg[worstStatus]} px-4 py-3">
	<div class="mb-2 flex items-center gap-2">
		<OverallIcon class="size-4 shrink-0 {statusColor[worstStatus]}" />
		<span class="text-sm font-medium text-foreground">{label}</span>
	</div>

	<div class="grid grid-cols-3 gap-2 text-center">
		{#each entries as entry (entry.lbl)}
			{@const ValIcon = statusIcon[entry.s]}
			<div class="rounded-md border border-border/50 bg-background/60 px-2 py-1.5">
				<div class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
					{entry.lbl}
				</div>
				<div class="flex items-center justify-center gap-1">
					<ValIcon class="size-3 {statusColor[entry.s]}" />
					<span class="font-mono text-sm font-semibold text-foreground">
						{fmt(entry.val)}{unit}
					</span>
				</div>
			</div>
		{/each}
	</div>

	<div class="mt-2 text-center text-[10px] text-muted-foreground">
		Target: {criteria.min}–{criteria.max}{unit}
	</div>
</div>
