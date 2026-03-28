<script lang="ts">
	import { onMount, untrack } from 'svelte';

	// ── Props (all required — parent renders conditionally) ────────────
	const {
		cs,
		glandDepth, // = installedHeight = (boreDia - grooveDia) / 2
		grooveWidth,
		clearance, // = (boreDia - pistonDia) / 2
		stretchPercent,
		grooveRadii
	}: {
		cs: number;
		glandDepth: number;
		grooveWidth: number;
		clearance: number;
		stretchPercent: number;
		grooveRadii: number;
	} = $props();

	// ── Sim constants ──────────────────────────────────────────────────
	const DT = 1 / 240;

	// ── User state (sim controls) ──────────────────────────────────────
	let dragging = $state(false);
	let showDebug = $state(false);
	let maxForce = $state(400);
	let friction = $state(0.3);
	let springK = $state(500);
	let chamferAngle = $state(15);
	let chamferLength = $state(4.5);
	let chamferBoreRadius = $state(1.0);
	let physicsOn = $state(true);
	let youngsE = $state(7);
	let poisson = $state(0.4995);
	let pDamp = $state(0.02);
	let structDamp = $state(0.5);
	let nParticles = $state(32);

	// ── Derived geometry ───────────────────────────────────────────────
	const r0 = $derived(cs / 2);
	const bulkMod = $derived(youngsE / (3 * (1 - 2 * poisson)));
	const segLen = $derived((2 * Math.PI * r0) / nParticles);
	const structK = $derived((youngsE * cs) / segLen);
	const bendK = $derived((youngsE * cs ** 3) / (12 * segLen));
	const contactK = $derived(structK * 50);
	const chR = $derived(chamferLength * Math.tan((chamferAngle * Math.PI) / 180));
	// Max fillet radius: tangent distance d = R*tan(halfAngle) must not exceed chamfer length
	const halfAngleRad = $derived((chamferAngle * Math.PI) / 360);
	const maxFilletRadius = $derived(
		halfAngleRad > 0.001 ? chamferLength / Math.tan(halfAngleRad) : 100
	);

	// ── View geometry ──────────────────────────────────────────────────
	const viewW = 560;
	const viewH = 300;
	// Housing / rod margins scale with CS so the ring always fills the view
	const housingShow = $derived(cs * 0.71); // ≈2.5 at cs=3.53
	const rodBodyShow = $derived(cs * 0.43); // ≈1.5 at cs=3.53
	const S = $derived(viewH / (housingShow + glandDepth + rodBodyShow));
	const boreWallY = $derived(housingShow * S);
	const rodOdY = $derived((housingShow + clearance) * S);
	const grooveBottomY = $derived((housingShow + glandDepth) * S);
	// Physics x=0 (bore-chamfer junction) is at a fixed SVG position.
	// Chamfer/face extend to the right; bore wall extends to the left.
	const originX = viewW * 0.38;
	const mmX = (x: number) => originX + x * S;

	// Piston position in mm-space (groove center, relative to bore-chamfer junction x=0).
	// Stored in mm so chamfer parameter changes don't shift the ring.
	let posXmm = $state(0);
	const minXmm = $derived(-grooveWidth - cs * 2);
	const maxXmm = $derived(chamferLength + cs * 3);
	const gL = $derived(mmX(posXmm - grooveWidth / 2));
	const gR = $derived(mmX(posXmm + grooveWidth / 2));
	const chX0 = originX; // bore-chamfer junction in SVG
	const chX1 = $derived(mmX(chamferLength)); // bore face in SVG
	const chRpx = $derived(chR * S);
	const chBRpx = $derived(Math.min(chamferBoreRadius, maxFilletRadius) * S);
	// Bore-chamfer fillet tangent points (in SVG coords).
	// Standard fillet: tangent distance from vertex = R * tan(halfAngle)
	// where halfAngle = chamferAngle / 2 (half the deviation from 180°).
	const chFillet = $derived.by(() => {
		const rpx = chBRpx;
		if (rpx < 1) return null;
		const chLenSvg = Math.sqrt((chamferLength * S) ** 2 + (chR * S) ** 2);
		if (chLenSvg < 1) return null;
		const halfAngle = (chamferAngle * Math.PI) / 360;
		const d = rpx * Math.tan(halfAngle); // tangent distance from junction in SVG px
		// Chamfer unit direction in SVG (right and up)
		const cdx = (chamferLength * S) / chLenSvg;
		const cdy = (-chR * S) / chLenSvg;
		return {
			// Bore tangent: d pixels LEFT of junction along bore wall
			boreX: originX - d,
			boreY: boreWallY,
			// Chamfer tangent: d pixels along chamfer from junction
			chamX: originX + d * cdx,
			chamY: boreWallY + d * cdy,
			r: rpx
		};
	});
	const grRpx = $derived(
		Math.min(grooveRadii * S, (grooveBottomY - rodOdY) * 0.45, grooveWidth * S * 0.45)
	);

	// ── Physics types ──────────────────────────────────────────────────
	type Particle = { x: number; y: number; vx: number; vy: number };
	type Seg = {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		nx: number;
		ny: number;
		type: string;
	};

	// ── Physics state (not reactive — mutated in RAF loop) ─────────────
	let particles: Particle[] = [];
	let posX = 0; // groove center in mm (physics x-space)
	let targetX = 0; // drag target in mm
	let vel = 0;
	let animId: number | null = null;

	// ── Render state (synced from physics each frame) ──────────────────
	let renderPts = $state<Array<{ x: number; y: number }>>([]);
	let sqEst = $state(0);

	// ── SVG derived ────────────────────────────────────────────────────
	const oPath = $derived(
		renderPts.length > 2
			? `M ${renderPts
					.map((p) => `${mmX(p.x).toFixed(1)},${(boreWallY + p.y * S).toFixed(1)}`)
					.join(' L ')} Z`
			: ''
	);
	const debugSegs = $derived(showDebug ? buildSegs(chamferLength, chamferAngle, posXmm) : []);

	// Static grid line indices
	const vLineCount = Math.ceil(viewW / 24) + 1;
	const hLineCount = Math.ceil(viewH / 24) + 1;

	// ── Sim helpers ────────────────────────────────────────────────────
	function buildSegs(chL: number, chA: number, pistonX: number): Seg[] {
		const chRv = chL * Math.tan((chA * Math.PI) / 180);
		const gLv = pistonX - grooveWidth / 2;
		const gRv = pistonX + grooveWidth / 2;
		const segs: Seg[] = [];

		// Chamfer direction unit vector (from bore toward face)
		const chLen = Math.sqrt(chL * chL + chRv * chRv);
		const chUx = chLen > 0.01 ? chL / chLen : 1;
		const chUy = chLen > 0.01 ? -chRv / chLen : 0;
		// Chamfer outward normal (points into bore opening)
		const chNx = chLen > 0.01 ? chRv / chLen : 0;
		const chNy = chLen > 0.01 ? chL / chLen : 1;

		// Bore-chamfer fillet radius (clamped to geometric max)
		const cbr = Math.min(chamferBoreRadius, maxFilletRadius);

		if (cbr > 0.01 && chLen > 0.01) {
			// Standard fillet: tangent distance from vertex = R * tan(halfAngle)
			// where halfAngle = chA/2 (half the deviation from a straight line).
			const halfAngle = (chA * Math.PI) / 360;
			const d = cbr * Math.tan(halfAngle);

			// Bore tangent: d along bore (leftward from junction at origin)
			const boreTpX = -d;
			// Chamfer tangent: d along chamfer (from junction toward face)
			const chamTpX = d * chUx;
			const chamTpY = d * chUy;

			// Center = bore tangent + cbr toward material (negative y = into wall)
			const fcx = boreTpX;
			const fcy = -cbr;

			segs.push({ x1: gLv - 20, y1: 0, x2: boreTpX, y2: 0, nx: 0, ny: 1, type: 'bore' });

			// Fillet arc (approximate with line segments)
			const nArc = 4;
			const aBore = Math.atan2(0 - fcy, boreTpX - fcx); // = atan2(cbr, 0) = π/2
			const aCham = Math.atan2(chamTpY - fcy, chamTpX - fcx);
			let aStart = aBore;
			let aEnd = aCham;
			// Ensure short arc
			while (aEnd < aStart) aEnd += 2 * Math.PI;
			if (aEnd - aStart > Math.PI) {
				aStart += 2 * Math.PI;
				[aStart, aEnd] = [aEnd, aStart];
			}
			for (let k = 0; k < nArc; k++) {
				const a0 = aStart + (k / nArc) * (aEnd - aStart);
				const a1 = aStart + ((k + 1) / nArc) * (aEnd - aStart);
				const amid = (a0 + a1) / 2;
				segs.push({
					x1: fcx + cbr * Math.cos(a0),
					y1: fcy + cbr * Math.sin(a0),
					x2: fcx + cbr * Math.cos(a1),
					y2: fcy + cbr * Math.sin(a1),
					nx: Math.cos(amid),
					ny: Math.sin(amid),
					type: 'bore'
				});
			}

			segs.push({
				x1: chamTpX,
				y1: chamTpY,
				x2: chL,
				y2: -chRv,
				nx: chNx,
				ny: chNy,
				type: 'chamfer'
			});
		} else {
			segs.push({ x1: gLv - 20, y1: 0, x2: 0, y2: 0, nx: 0, ny: 1, type: 'bore' });
			if (chLen > 0.01) {
				segs.push({ x1: 0, y1: 0, x2: chL, y2: -chRv, nx: chNx, ny: chNy, type: 'chamfer' });
			}
		}

		// Bore end face
		segs.push({ x1: chL, y1: -chRv, x2: chL, y2: -chRv - 10, nx: 1, ny: 0, type: 'face' });
		segs.push({
			x1: gLv - 20,
			y1: clearance,
			x2: gLv,
			y2: clearance,
			nx: 0,
			ny: 1,
			type: 'rod'
		});
		segs.push({
			x1: gRv,
			y1: clearance,
			x2: gRv + 20,
			y2: clearance,
			nx: 0,
			ny: 1,
			type: 'rod'
		});
		const gRad = Math.min(grooveRadii, (glandDepth - clearance) * 0.45, grooveWidth * 0.45);
		if (gRad > 0.01) {
			// Shortened groove bottom and walls
			segs.push({
				x1: gLv + gRad,
				y1: glandDepth,
				x2: gRv - gRad,
				y2: glandDepth,
				nx: 0,
				ny: -1,
				type: 'groove'
			});
			segs.push({
				x1: gLv,
				y1: clearance,
				x2: gLv,
				y2: glandDepth - gRad,
				nx: 1,
				ny: 0,
				type: 'gwall'
			});
			segs.push({
				x1: gRv,
				y1: clearance,
				x2: gRv,
				y2: glandDepth - gRad,
				nx: -1,
				ny: 0,
				type: 'gwall'
			});
			// Bottom-left fillet arc (approx with 4 segments)
			const nArc = 4;
			const cxL = gLv + gRad,
				cyB = glandDepth - gRad;
			for (let k = 0; k < nArc; k++) {
				const a0 = Math.PI - (k / nArc) * (Math.PI / 2);
				const a1 = Math.PI - ((k + 1) / nArc) * (Math.PI / 2);
				const amid = (a0 + a1) / 2;
				segs.push({
					x1: cxL + gRad * Math.cos(a0),
					y1: cyB + gRad * Math.sin(a0),
					x2: cxL + gRad * Math.cos(a1),
					y2: cyB + gRad * Math.sin(a1),
					nx: -Math.cos(amid),
					ny: -Math.sin(amid),
					type: 'groove'
				});
			}
			// Bottom-right fillet arc
			const cxR = gRv - gRad;
			for (let k = 0; k < nArc; k++) {
				const a0 = (k / nArc) * (Math.PI / 2);
				const a1 = ((k + 1) / nArc) * (Math.PI / 2);
				const amid = (a0 + a1) / 2;
				segs.push({
					x1: cxR + gRad * Math.cos(a0),
					y1: cyB + gRad * Math.sin(a0),
					x2: cxR + gRad * Math.cos(a1),
					y2: cyB + gRad * Math.sin(a1),
					nx: -Math.cos(amid),
					ny: -Math.sin(amid),
					type: 'groove'
				});
			}
		} else {
			segs.push({
				x1: gLv,
				y1: glandDepth,
				x2: gRv,
				y2: glandDepth,
				nx: 0,
				ny: -1,
				type: 'groove'
			});
			segs.push({ x1: gLv, y1: clearance, x2: gLv, y2: glandDepth, nx: 1, ny: 0, type: 'gwall' });
			segs.push({ x1: gRv, y1: clearance, x2: gRv, y2: glandDepth, nx: -1, ny: 0, type: 'gwall' });
		}
		return segs;
	}

	function ptSegDist(px: number, py: number, seg: Seg): number {
		const dx = seg.x2 - seg.x1,
			dy = seg.y2 - seg.y1;
		const lenSq = dx * dx + dy * dy;
		if (lenSq < 1e-8) return -1;
		const t = ((px - seg.x1) * dx + (py - seg.y1) * dy) / lenSq;
		if (t < 0 || t > 1) return -1;
		const cx = seg.x1 + t * dx,
			cy = seg.y1 + t * dy;
		return -((px - cx) * seg.nx + (py - cy) * seg.ny);
	}

	function createRing(cx: number, cy: number, r: number, n: number): Particle[] {
		return Array.from({ length: n }, (_, i) => {
			const a = (i / n) * Math.PI * 2;
			return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), vx: 0, vy: 0 };
		});
	}

	function polyArea(pts: Particle[]) {
		let a = 0;
		for (let i = 0; i < pts.length; i++) {
			const j = (i + 1) % pts.length;
			a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
		}
		return Math.abs(a) / 2;
	}

	function spawnRing(xmm = posX, n = nParticles) {
		const cy = (clearance + glandDepth) / 2;
		particles = createRing(xmm, cy, r0 * 0.95, n);
		posX = xmm;
		vel = 0;
		targetX = xmm;
		posXmm = xmm;
	}

	// ── Respawn on geometry prop changes ──────────────────────────────
	$effect(() => {
		// Track geometry props only — not sliders
		cs;
		glandDepth;
		grooveWidth;
		clearance;
		// Respawn ring; untrack prevents slider reads inside from becoming dependencies
		if (particles.length > 0) untrack(() => spawnRing(posX));
	});

	// ── Drag ──────────────────────────────────────────────────────────
	let dragStartPixelX = 0;
	let dragStartMm = 0;

	function onDown(e: PointerEvent) {
		e.preventDefault();
		(e.target as Element).setPointerCapture(e.pointerId);
		dragStartPixelX = e.clientX;
		dragStartMm = posX;
		dragging = true;
	}
	function onMove(e: PointerEvent) {
		if (!dragging) return;
		const raw = dragStartMm + (e.clientX - dragStartPixelX) * 0.05;
		targetX = Math.max(minXmm, Math.min(maxXmm, raw));
	}
	function onUp() {
		dragging = false;
	}

	// ── RAF physics loop ───────────────────────────────────────────────
	onMount(() => {
		// Start with ring inside bore (groove center at -grooveWidth = fully seated)
		const startX = chamferLength + cs;
		spawnRing(startX);

		let running = true;
		let lastT = performance.now();
		let acc = 0;

		function step() {
			if (!running) return;
			const now = performance.now();
			acc += Math.min((now - lastT) / 1000, 0.05);
			lastT = now;

			const pts = particles;
			const nPts = nParticles;
			if (pts.length !== nPts) {
				animId = requestAnimationFrame(step);
				return;
			}

			const cL = chamferLength;
			const cA = chamferAngle;
			const csVal = cs;

			while (acc >= DT) {
				acc -= DT;
				const pX = posX;

				if (!physicsOn) {
					const dx = targetX - pX;
					for (let i = 0; i < nPts; i++) {
						pts[i].x += dx;
						pts[i].vx = 0;
						pts[i].vy = 0;
					}
					posX = targetX;
					vel = 0;
					continue;
				}

				const segs = buildSegs(cL, cA, pX);
				const fx = new Float64Array(nPts);
				const fy = new Float64Array(nPts);

				const sK = structK;
				const prK = bulkMod;
				const bK = bendK;
				const cK = contactK;
				const pm = 0.05;
				const rSeg = (2 * Math.PI * (csVal / 2)) / nPts;
				const restArea = Math.PI * (csVal / 2) ** 2;
				const stretchFrac = stretchPercent / 100;

				// Structural springs (perimeter) + structural damping
				const sDamp = structDamp * 2 * Math.sqrt(sK * pm);
				for (let i = 0; i < nPts; i++) {
					const j = (i + 1) % nPts;
					const dx = pts[j].x - pts[i].x,
						dy = pts[j].y - pts[i].y;
					const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
					const f = sK * (d - rSeg);
					const ux = dx / d,
						uy = dy / d;
					// Relative velocity along spring axis
					const dvx = pts[j].vx - pts[i].vx,
						dvy = pts[j].vy - pts[i].vy;
					const vRel = dvx * ux + dvy * uy;
					const fDamp = sDamp * vRel;
					fx[i] += (f + fDamp) * ux;
					fy[i] += (f + fDamp) * uy;
					fx[j] -= (f + fDamp) * ux;
					fy[j] -= (f + fDamp) * uy;
				}

				// Hoop stress from installation stretch — radial inward force from ring tension.
				// Total force = E × cs × stretchFrac, distributed evenly across particles,
				// independent of particle count (sK would introduce an nPts² scaling bug).
				if (stretchFrac > 0.001) {
					const hoopForce = (youngsE * csVal * stretchFrac) / nPts;
					for (let i = 0; i < nPts; i++) fy[i] += hoopForce;
				}

				// Bending resistance
				for (let i = 0; i < nPts; i++) {
					const prev = (i - 1 + nPts) % nPts,
						next = (i + 1) % nPts;
					fx[i] += bK * ((pts[prev].x + pts[next].x) / 2 - pts[i].x);
					fy[i] += bK * ((pts[prev].y + pts[next].y) / 2 - pts[i].y);
				}

				// Internal pressure (bulk modulus — resists area change)
				const targetArea = restArea / Math.sqrt(1.0 + stretchFrac);
				const pressure = prK * (1.0 - polyArea(pts) / targetArea);
				for (let i = 0; i < nPts; i++) {
					const prev = (i - 1 + nPts) % nPts,
						next = (i + 1) % nPts;
					const ex = pts[next].x - pts[prev].x,
						ey = pts[next].y - pts[prev].y;
					const el = Math.sqrt(ex * ex + ey * ey) || 0.001;
					const edgeLen = el / 2;
					fx[i] += pressure * (ey / el) * edgeLen;
					fy[i] += pressure * (-ex / el) * edgeLen;
				}

				// Contact + Coulomb friction
				let pistonFx = 0;
				for (let i = 0; i < nPts; i++) {
					for (const seg of segs) {
						const pen = ptSegDist(pts[i].x, pts[i].y, seg);
						if (pen > 0) {
							const cF = cK * pen;
							fx[i] += cF * seg.nx;
							fy[i] += cF * seg.ny;
							const vn = pts[i].vx * seg.nx + pts[i].vy * seg.ny;
							const vtx = pts[i].vx - vn * seg.nx;
							const vty = pts[i].vy - vn * seg.ny;
							const vt = Math.sqrt(vtx * vtx + vty * vty);
							if (vt > 1e-8) {
								const fric = Math.min(friction * cF, vt * 100);
								fx[i] -= fric * (vtx / vt);
								fy[i] -= fric * (vty / vt);
							}
							if (seg.type === 'gwall') pistonFx -= cF * seg.nx;
						}
					}
				}

				// Integrate particles
				const decay = Math.exp(-pDamp * DT * 240);
				for (let i = 0; i < nPts; i++) {
					pts[i].vx = (pts[i].vx + (fx[i] / pm) * DT) * decay;
					pts[i].vy = (pts[i].vy + (fy[i] / pm) * DT) * decay;
					pts[i].x += pts[i].vx * DT;
					pts[i].y += pts[i].vy * DT;
				}

				// Piston dynamics (in mm-space)
				const pMass = 50;
				if (dragging) {
					const sep = targetX - posX;
					const raw = springK * sep;
					const sF = Math.sign(raw) * Math.min(Math.abs(raw), maxForce);
					vel += ((sF + pistonFx * 0.01) / pMass) * DT;
				} else {
					vel += ((pistonFx * 0.01) / pMass) * DT;
				}
				vel *= Math.exp((-80 / pMass) * DT);
				posX += vel * DT;
				posX = Math.max(minXmm, Math.min(maxXmm, posX));

				const shift = posX - pX;
				for (let i = 0; i < nPts; i++) pts[i].x += shift;
			}

			// Sync to render state
			posXmm = posX;
			renderPts = pts.map((p) => ({ x: p.x, y: p.y }));

			let minY = Infinity,
				maxY = -Infinity;
			for (const p of pts) {
				if (p.y < minY) minY = p.y;
				if (p.y > maxY) maxY = p.y;
			}
			const h = maxY - minY;
			sqEst = h > 0 ? Math.max(0, 1 - h / csVal) : 0;

			animId = requestAnimationFrame(step);
		}

		animId = requestAnimationFrame(step);
		return () => {
			running = false;
			if (animId) cancelAnimationFrame(animId);
		};
	});

	const debugSegColor: Record<string, string> = {
		bore: '#4488ff',
		chamfer: '#ff8844',
		face: '#ff4444',
		rod: '#44ff88',
		groove: '#8844ff',
		gwall: '#ffff44'
	};
</script>

<div class="flex flex-col gap-5 lg:flex-row lg:items-start">
	<!-- SVG Canvas -->
	<div class="shrink-0 overflow-hidden rounded-lg border border-border lg:w-[560px]">
		<svg
			viewBox="0 0 {viewW} {viewH}"
			width="100%"
			role="img"
			aria-label="O-ring soft body simulation"
			style="display:block; touch-action:none;"
			onpointerdown={onDown}
			onpointermove={onMove}
			onpointerup={onUp}
			onpointercancel={onUp}
		>
			<defs>
				<pattern
					id="sim-hB"
					patternUnits="userSpaceOnUse"
					width="6"
					height="6"
					patternTransform="rotate(45)"
				>
					<rect width="6" height="6" class="metal-bg" />
					<line x1="0" y1="0" x2="0" y2="6" class="hatch-line" stroke-width="0.7" />
				</pattern>
				<pattern
					id="sim-hR"
					patternUnits="userSpaceOnUse"
					width="6"
					height="6"
					patternTransform="rotate(-45)"
				>
					<rect width="6" height="6" class="metal-bg" />
					<line x1="0" y1="0" x2="0" y2="6" class="hatch-line" stroke-width="0.7" />
				</pattern>
				<linearGradient id="sim-oG" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="#4a4a4a" />
					<stop offset="45%" stop-color="#1a1a1a" />
					<stop offset="100%" stop-color="#333" />
				</linearGradient>
			</defs>

			<!-- Canvas background -->
			<rect width={viewW} height={viewH} class="canvas-bg" />

			<!-- Grid -->
			{#each { length: vLineCount } as _, i (i)}
				<line x1={i * 24} y1={0} x2={i * 24} y2={viewH} class="grid-line" />
			{/each}
			{#each { length: hLineCount } as _, j (j)}
				<line x1={0} y1={j * 24} x2={viewW} y2={j * 24} class="grid-line" />
			{/each}

			<!-- Groove clearout (erases grid behind open bore/groove space) -->
			<path
				d="M {gL} {rodOdY} L {gL} {grooveBottomY - grRpx} A {grRpx} {grRpx} 0 0 0 {gL +
					grRpx} {grooveBottomY} L {gR -
					grRpx} {grooveBottomY} A {grRpx} {grRpx} 0 0 0 {gR} {grooveBottomY -
					grRpx} L {gR} {rodOdY}"
				class="canvas-bg"
				stroke="none"
			/>

			<!-- O-ring body -->
			{#if oPath}
				<path
					d={oPath}
					class="oring-body"
					style="stroke: {sqEst > 0.25 ? 'var(--destructive)' : 'var(--muted-foreground)'}"
				/>
			{/if}

			<!-- Housing (bore wall + chamfer) -->
			{#if chFillet}
				<path
					d="M 0 0 L 0 {boreWallY} L {chFillet.boreX} {chFillet.boreY} A {chFillet.r} {chFillet.r} 0 0 0 {chFillet.chamX} {chFillet.chamY} L {chX1} {boreWallY -
						chRpx} L {chX1} 0 Z"
					fill="url(#sim-hB)"
					stroke="none"
				/>
				<line x1={0} y1={boreWallY} x2={chFillet.boreX} y2={chFillet.boreY} class="surface-edge" />
				<path
					d="M {chFillet.boreX} {chFillet.boreY} A {chFillet.r} {chFillet.r} 0 0 0 {chFillet.chamX} {chFillet.chamY}"
					class="surface-edge"
					fill="none"
				/>
				<line
					x1={chFillet.chamX}
					y1={chFillet.chamY}
					x2={chX1}
					y2={boreWallY - chRpx}
					class="chamfer-edge"
				/>
			{:else}
				<path
					d="M 0 0 L 0 {boreWallY} L {chX0} {boreWallY} L {chX1} {boreWallY - chRpx} L {chX1} 0 Z"
					fill="url(#sim-hB)"
					stroke="none"
				/>
				<line x1={0} y1={boreWallY} x2={chX0} y2={boreWallY} class="surface-edge" />
				<line x1={chX0} y1={boreWallY} x2={chX1} y2={boreWallY - chRpx} class="chamfer-edge" />
			{/if}
			<line x1={chX1} y1={boreWallY - chRpx} x2={chX1} y2={0} class="surface-edge" />
			<text
				x={chFillet ? (chFillet.chamX + chX1) / 2 + 5 : (chX0 + chX1) / 2 + 5}
				y={boreWallY - chRpx / 2 - 7}
				class="chamfer-label"
				text-anchor="middle">{chamferAngle}°</text
			>

			<!-- Rod / piston body -->
			<rect
				x={0}
				y={rodOdY}
				width={Math.max(0, gL)}
				height={viewH - rodOdY}
				fill="url(#sim-hR)"
				stroke="none"
			/>
			<rect
				x={gR}
				y={rodOdY}
				width={Math.max(0, viewW - gR)}
				height={viewH - rodOdY}
				fill="url(#sim-hR)"
				stroke="none"
			/>
			<rect
				x={gL}
				y={grooveBottomY}
				width={gR - gL}
				height={viewH - grooveBottomY}
				fill="url(#sim-hR)"
				stroke="none"
			/>
			<line x1={0} y1={rodOdY} x2={gL} y2={rodOdY} class="surface-edge" />
			<line x1={gR} y1={rodOdY} x2={viewW} y2={rodOdY} class="surface-edge" />
			<!-- Groove corner fillets (metal fill at radii) -->
			<path
				d="M {gL} {grooveBottomY} L {gL} {grooveBottomY - grRpx} A {grRpx} {grRpx} 0 0 0 {gL +
					grRpx} {grooveBottomY} Z"
				fill="url(#sim-hR)"
				stroke="none"
			/>
			<path
				d="M {gR} {grooveBottomY} L {gR} {grooveBottomY - grRpx} A {grRpx} {grRpx} 0 0 1 {gR -
					grRpx} {grooveBottomY} Z"
				fill="url(#sim-hR)"
				stroke="none"
			/>
			<path
				d="M {gL} {rodOdY} L {gL} {grooveBottomY - grRpx} A {grRpx} {grRpx} 0 0 0 {gL +
					grRpx} {grooveBottomY} L {gR -
					grRpx} {grooveBottomY} A {grRpx} {grRpx} 0 0 0 {gR} {grooveBottomY -
					grRpx} L {gR} {rodOdY}"
				class="groove-outline"
			/>

			<!-- Debug overlay -->
			{#if showDebug}
				{#each renderPts as p, i (i)}
					<circle cx={mmX(p.x)} cy={boreWallY + p.y * S} r="2" class="debug-dot" />
				{/each}
				{#each debugSegs as seg, i (i)}
					{@const sx1 = mmX(seg.x1)}
					{@const sy1 = boreWallY + seg.y1 * S}
					{@const sx2 = mmX(seg.x2)}
					{@const sy2 = boreWallY + seg.y2 * S}
					{@const mx = (sx1 + sx2) / 2}
					{@const my = (sy1 + sy2) / 2}
					{@const col = debugSegColor[seg.type] ?? '#ffff44'}
					<line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke={col} stroke-width="2" opacity="0.5" />
					<line
						x1={mx}
						y1={my}
						x2={mx + seg.nx * 10}
						y2={my + seg.ny * 10}
						stroke={col}
						stroke-width="1"
						opacity="0.4"
					/>
					<circle cx={mx + seg.nx * 10} cy={my + seg.ny * 10} r="2" fill={col} opacity="0.4" />
				{/each}
			{/if}

			<!-- Drag hint -->
			{#if !dragging}
				<text x={viewW / 2} y={viewH - 6} class="drag-hint" text-anchor="middle">
					◄ drag to move piston ►
				</text>
			{/if}
		</svg>
	</div>

	<!-- Controls panel -->
	<div class="flex-1 space-y-4 font-mono text-xs">
		<!-- Live geometry from calculator -->
		<div
			class="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px]"
		>
			<span class="text-muted-foreground">CS</span>
			<span class="font-medium text-foreground">{cs.toFixed(2)} mm</span>
			<span class="text-muted-foreground">Stretch</span>
			<span class="font-medium text-foreground">{stretchPercent.toFixed(1)}%</span>
			<span class="text-muted-foreground">Groove</span>
			<span class="font-medium text-foreground"
				>{grooveWidth.toFixed(2)} × {(glandDepth - clearance).toFixed(2)} mm</span
			>
		</div>

		<!-- Lead-in geometry -->
		<div class="space-y-2">
			<p class="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
				Lead-in chamfer
			</p>
			{@render sliderRow(
				'Angle',
				chamferAngle,
				5,
				45,
				1,
				'--chart-1',
				(v) => `${v}°`,
				(v) => (chamferAngle = v)
			)}
			{@render sliderRow(
				'Length',
				chamferLength,
				0.5,
				10,
				0.1,
				'--chart-1',
				(v) => `${v.toFixed(1)} mm`,
				(v) => (chamferLength = v)
			)}
			{@render sliderRow(
				'Radius',
				chamferBoreRadius,
				0,
				Math.max(maxFilletRadius, 0.1),
				0.05,
				'--chart-1',
				(v) => `${Math.min(v, maxFilletRadius).toFixed(2)} mm`,
				(v) => (chamferBoreRadius = v)
			)}
		</div>

		<!-- Material properties -->
		<div class="space-y-2">
			<p class="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">Material</p>
			{@render sliderRow(
				"Young's E",
				youngsE,
				1,
				50,
				0.5,
				'--chart-2',
				(v) => `${v.toFixed(1)} MPa`,
				(v) => (youngsE = v)
			)}
			{@render sliderRow(
				'Poisson ν',
				poisson,
				0.4,
				0.4999,
				0.001,
				'--chart-2',
				(v) => v.toFixed(4),
				(v) => (poisson = v)
			)}
			{@render sliderRow(
				'Damping',
				pDamp,
				0,
				0.2,
				0.005,
				'--chart-2',
				(v) => v.toFixed(3),
				(v) => (pDamp = v)
			)}
			{@render sliderRow(
				'Struct Damp',
				structDamp,
				0,
				1.0,
				0.01,
				'--chart-2',
				(v) => v.toFixed(2),
				(v) => (structDamp = v)
			)}
		</div>

		<!-- Simulation tuning -->
		<div class="space-y-2">
			<p class="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
				Simulation
			</p>
			{@render sliderRow(
				'Friction μ',
				friction,
				0.05,
				1.0,
				0.01,
				'--chart-1',
				(v) => v.toFixed(2),
				(v) => (friction = v)
			)}
			{@render sliderRow(
				'Max force',
				maxForce,
				10,
				600,
				5,
				'--destructive',
				(v) => `${v.toFixed(0)} N`,
				(v) => (maxForce = v)
			)}
			{@render sliderRow(
				'Drag K',
				springK,
				50,
				800,
				10,
				'--chart-3',
				(v) => `${v} N/m`,
				(v) => (springK = v)
			)}
			{@render sliderRow(
				'Segments',
				nParticles,
				8,
				64,
				4,
				'--chart-4',
				(v) => `${v.toFixed(0)}`,
				(v) => {
					nParticles = v;
					spawnRing(posX, v);
				}
			)}
		</div>

		<!-- Toggles + Reset -->
		<div class="flex flex-wrap items-center gap-4">
			<label class="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted-foreground">
				<input type="checkbox" bind:checked={showDebug} style="accent-color: var(--chart-1);" />
				Debug
			</label>
			<label class="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted-foreground">
				<input type="checkbox" bind:checked={physicsOn} style="accent-color: var(--chart-1);" />
				Physics
			</label>
			<button
				onclick={() => spawnRing(1.0)}
				class="rounded border border-border bg-background px-3 py-1 text-[10px] text-foreground hover:bg-muted"
			>
				Reset
			</button>
		</div>

		<!-- Status cards -->
		<div class="grid grid-cols-2 gap-2">
			{@render card(
				'Compression',
				`${(sqEst * 100).toFixed(1)}%`,
				sqEst > 0.25 ? 'var(--destructive)' : sqEst > 0.005 ? 'var(--chart-1)' : 'var(--chart-2)',
				sqEst > 0.25 ? 'Exceeds 25%' : sqEst > 0.15 ? 'Nominal' : sqEst > 0.005 ? 'Light' : 'None'
			)}
			{@render card(
				'Chamfer depth',
				`${chR.toFixed(2)} mm`,
				chR >= cs
					? 'var(--chart-2)'
					: chR >= glandDepth - clearance
						? 'var(--chart-1)'
						: 'var(--destructive)',
				chR >= cs ? '✓ Clears CS' : chR >= glandDepth - clearance ? '⚠ Tight' : '✗ Blocked'
			)}
		</div>
	</div>
</div>

{#snippet sliderRow(
	label: string,
	val: number,
	min: number,
	max: number,
	step: number,
	cssVar: string,
	fmt: (v: number) => string,
	set: (v: number) => void
)}
	<div class="flex items-center gap-2">
		<span class="w-20 shrink-0 text-[10px] text-muted-foreground">{label}</span>
		<input
			type="range"
			{min}
			{max}
			{step}
			value={val}
			oninput={(e) => set(parseFloat((e.target as HTMLInputElement).value))}
			style="accent-color: var({cssVar});"
			class="min-w-0 flex-1 cursor-pointer"
		/>
		<span class="w-16 shrink-0 text-right text-[10px]" style="color: var({cssVar});">
			{fmt(val)}
		</span>
	</div>
{/snippet}

{#snippet card(label: string, value: string, color: string, sub: string)}
	<div class="rounded-md border border-border bg-muted/30 px-3 py-2">
		<div class="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
		<div class="mt-0.5 font-mono text-lg font-semibold" style="color: {color};">{value}</div>
		<div class="text-[9px] text-muted-foreground">{sub}</div>
	</div>
{/snippet}

<style>
	/* SVG class-based theming — Svelte scopes these to this component */

	.canvas-bg {
		fill: var(--card);
	}
	.grid-line {
		stroke: var(--border);
		opacity: 0.5;
		fill: none;
	}
	.metal-bg {
		fill: var(--muted);
	}
	.hatch-line {
		stroke: var(--foreground);
		opacity: 0.12;
		fill: none;
	}
	.surface-edge {
		stroke: var(--foreground);
		stroke-width: 2px;
		opacity: 0.55;
		fill: none;
	}
	.chamfer-edge {
		stroke: var(--chart-1);
		stroke-width: 2.5px;
		fill: none;
	}
	.chamfer-label {
		fill: var(--chart-1);
		font-size: 10px;
		font-weight: 600;
	}
	.groove-outline {
		stroke: var(--muted-foreground);
		stroke-width: 1px;
		opacity: 0.4;
		fill: none;
	}
	.oring-body {
		fill: url(#sim-oG);
		stroke-width: 1.5px;
	}
	.drag-hint {
		fill: var(--muted-foreground);
		font-size: 10px;
		opacity: 0.35;
	}
	.debug-dot {
		fill: var(--chart-1);
		opacity: 0.6;
	}
</style>
