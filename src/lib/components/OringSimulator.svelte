<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { SealType } from '$lib/types';

	// ── Props (all required — parent renders conditionally) ────────────
	const {
		cs,
		glandDepth, // = installedHeight
		grooveWidth,
		clearance, // = (boreDia - pistonDia) / 2
		stretchPercent,
		grooveRadii,
		sealType = 'piston'
	}: {
		cs: number;
		glandDepth: number;
		grooveWidth: number;
		clearance: number;
		stretchPercent: number;
		grooveRadii: number;
		sealType?: SealType;
	} = $props();

	// Piston seal: top = bore (housing, moves), bottom = piston with groove
	// Rod seal: top = housing with groove, bottom = rod (moves)
	// Face seal: top = housing with groove, bottom = flat plate (moves)
	const isFace = $derived(sealType === 'face');
	const matingLabel = $derived(
		sealType === 'rod' ? 'rod' : sealType === 'face' ? 'plate' : 'housing'
	);
	const topHatch = 'sim-hB';
	const bottomHatch = 'sim-hR';
	// Face seal plate position in SVG — tracks posYmm
	let posYmm = $state(0);

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
	const housingShow = $derived(sealType === 'piston' ? cs * 0.71 : cs * 0.43);
	const rodBodyShow = $derived(sealType === 'piston' ? cs * 0.43 : cs * 0.71);
	const S = $derived(viewH / (housingShow + glandDepth + rodBodyShow));
	const boreWallY = $derived(housingShow * S);
	const rodOdY = $derived((housingShow + clearance) * S);
	const grooveBottomY = $derived((housingShow + glandDepth) * S);
	// Physics x=0 is at the groove center (fixed). Housing moves over it.
	const grooveSvgX = viewW * 0.5;
	const mmX = (x: number) => grooveSvgX + x * S;
	// Physics y → SVG y (flipped for rod/face seal: groove at top)
	const mmY = (y: number) => (sealType === 'piston' ? boreWallY + y * S : grooveBottomY - y * S);
	// Bore ID surface Y in SVG (rod seal: where groove opens, between groove and rod)
	const boreIdSvgY = $derived(boreWallY + (glandDepth - clearance) * S);

	// Moving part position in mm-space.
	// Piston/rod: X position (bore-chamfer junction, relative to groove center at x=0)
	// Face: Y position of plate (0 = at groove opening, positive = compressing into groove)
	let posXmm = $state(0);
	const minPosMm = $derived(isFace ? -cs * 2 : -(chamferLength + cs * 3));
	const maxPosMm = $derived(isFace ? clearance : grooveWidth + cs * 2);
	const gL = $derived(mmX(-grooveWidth / 2));
	const gR = $derived(mmX(grooveWidth / 2));
	const chX0 = $derived(mmX(posXmm)); // bore-chamfer junction in SVG (moves)
	const chX1 = $derived(mmX(posXmm + chamferLength)); // bore face in SVG (moves)
	// Face seal: plate SVG Y position (tracks posYmm)
	const plateSvgY = $derived(boreIdSvgY - posYmm * S);
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
		const d = rpx * Math.tan(halfAngle);
		const cdx = (chamferLength * S) / chLenSvg;
		const junctionX = chX0;
		if (sealType === 'rod') {
			// Rod seal: chamfer at bottom, extending downward from rod surface
			const cdy = (chR * S) / chLenSvg; // positive (downward)
			return {
				boreX: junctionX - d,
				boreY: grooveBottomY,
				chamX: junctionX + d * cdx,
				chamY: grooveBottomY + d * cdy,
				r: rpx
			};
		}
		// Piston seal: chamfer at top, extending upward from bore wall
		const cdy = (-chR * S) / chLenSvg; // negative (upward)
		return {
			boreX: junctionX - d,
			boreY: boreWallY,
			chamX: junctionX + d * cdx,
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
	let posX = 0; // housing junction x in mm (relative to groove center at x=0)
	let targetX = 0; // drag target in mm
	let vel = 0;
	let animId: number | null = null;

	// ── Render state (synced from physics each frame) ──────────────────
	let renderPts = $state<Array<{ x: number; y: number }>>([]);
	let sqEst = $state(0);

	// ── SVG derived ────────────────────────────────────────────────────
	const oPath = $derived(
		renderPts.length > 2
			? `M ${renderPts.map((p) => `${mmX(p.x).toFixed(1)},${mmY(p.y).toFixed(1)}`).join(' L ')} Z`
			: ''
	);
	const debugSegs = $derived(
		showDebug ? buildSegs(chamferLength, chamferAngle, isFace ? posYmm : posXmm) : []
	);

	// Static grid line indices
	const vLineCount = Math.ceil(viewW / 24) + 1;
	const hLineCount = Math.ceil(viewH / 24) + 1;

	// ── Sim helpers ────────────────────────────────────────────────────
	function buildSegs(chL: number, chA: number, movingPos: number): Seg[] {
		const gLv = -grooveWidth / 2; // groove left wall (fixed at origin)
		const gRv = grooveWidth / 2; // groove right wall (fixed at origin)
		const segs: Seg[] = [];

		if (isFace) {
			// ── Face seal: flat plate at variable Y ──
			const plateY = clearance + movingPos; // movingPos=0 → plate at groove opening; <0 → retracted
			segs.push({
				x1: gLv - 20,
				y1: plateY,
				x2: gRv + 20,
				y2: plateY,
				nx: 0,
				ny: 1,
				type: 'bore' // reuse 'bore' type so isHousing() identifies it as moving
			});
		} else {
			// ── Piston/rod: bore, chamfer, face — move with housingX ──
			const housingX = movingPos;
			const chRv = chL * Math.tan((chA * Math.PI) / 180);

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
				const halfAngle = (chA * Math.PI) / 360;
				const d = cbr * Math.tan(halfAngle);

				const boreTpX = housingX - d;
				const chamTpX = housingX + d * chUx;
				const chamTpY = d * chUy;

				const fcx = boreTpX;
				const fcy = -cbr;

				segs.push({
					x1: housingX - 40,
					y1: 0,
					x2: boreTpX,
					y2: 0,
					nx: 0,
					ny: 1,
					type: 'bore'
				});

				const nArc = 4;
				const aBore = Math.atan2(0 - fcy, boreTpX - fcx);
				const aCham = Math.atan2(chamTpY - fcy, chamTpX - fcx);
				let aStart = aBore;
				let aEnd = aCham;
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
					x2: housingX + chL,
					y2: -chRv,
					nx: chNx,
					ny: chNy,
					type: 'chamfer'
				});
			} else {
				segs.push({
					x1: housingX - 40,
					y1: 0,
					x2: housingX,
					y2: 0,
					nx: 0,
					ny: 1,
					type: 'bore'
				});
				if (chLen > 0.01) {
					segs.push({
						x1: housingX,
						y1: 0,
						x2: housingX + chL,
						y2: -chRv,
						nx: chNx,
						ny: chNy,
						type: 'chamfer'
					});
				}
			}

			// Bore end face
			segs.push({
				x1: housingX + chL,
				y1: -chRv,
				x2: housingX + chL,
				y2: -chRv - 10,
				nx: 1,
				ny: 0,
				type: 'face'
			});
		}

		// ── Piston/rod segments — fixed at origin (skip for face seal: plate replaces rod) ──

		if (!isFace) {
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
		}
		const gRad = Math.min(grooveRadii, (glandDepth - clearance) * 0.45, grooveWidth * 0.45);
		if (gRad > 0.01) {
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
			segs.push({
				x1: gLv,
				y1: clearance,
				x2: gLv,
				y2: glandDepth,
				nx: 1,
				ny: 0,
				type: 'gwall'
			});
			segs.push({
				x1: gRv,
				y1: clearance,
				x2: gRv,
				y2: glandDepth,
				nx: -1,
				ny: 0,
				type: 'gwall'
			});
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

	function spawnRing(housingXmm = posX, n = nParticles) {
		// Face seal: centre in groove; piston/rod: sit near groove floor
		const cy = isFace ? (clearance + glandDepth) / 2 : glandDepth - r0 * 1.1;
		const maxRx = grooveWidth / 2 - 0.05;
		const spawnR = Math.min(r0 * 0.95, maxRx > 0.1 ? maxRx : r0 * 0.5);
		particles = createRing(0, cy, spawnR, n);
		posX = housingXmm;
		vel = 0;
		targetX = housingXmm;
		posXmm = housingXmm;
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
	let dragStartPixel = 0;
	let dragStartMm = 0;

	function onDown(e: PointerEvent) {
		e.preventDefault();
		(e.target as Element).setPointerCapture(e.pointerId);
		dragStartPixel = isFace ? e.clientY : e.clientX;
		dragStartMm = posX;
		dragging = true;
	}
	function onMove(e: PointerEvent) {
		if (!dragging) return;
		const pixel = isFace ? e.clientY : e.clientX;
		const sign = isFace ? -1 : 1;
		const raw = dragStartMm + (pixel - dragStartPixel) * 0.05 * sign;
		targetX = Math.max(minPosMm, Math.min(maxPosMm, raw));
	}
	function onUp() {
		dragging = false;
	}

	// ── RAF physics loop ───────────────────────────────────────────────
	onMount(() => {
		// Start with moving part retracted
		const startPos = isFace ? -cs * 1.5 : -(chamferLength + cs);
		spawnRing(startPos);

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
				const hX = posX; // housing position this substep
				const hVel = vel; // housing velocity this substep

				if (!physicsOn) {
					posX = targetX;
					vel = 0;
					continue;
				}

				const segs = buildSegs(cL, cA, hX);
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
				// Only applies to piston/rod seals where the 2D cross-section is axial.
				// Face seal stretch is circumferential (out of plane), so no hoop force here.
				if (stretchFrac > 0.001 && sealType !== 'face') {
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

				// Contact + Coulomb friction (with relative velocity for moving segments)
				let matingF = 0; // reaction force on the moving part (x for piston/rod, y for face)
				const isMoving = (t: string) => t === 'bore' || t === 'chamfer' || t === 'face';
				const face = sealType === 'face';
				for (let i = 0; i < nPts; i++) {
					for (const seg of segs) {
						const pen = ptSegDist(pts[i].x, pts[i].y, seg);
						if (pen > 0) {
							const cF = cK * pen;
							fx[i] += cF * seg.nx;
							fy[i] += cF * seg.ny;
							// Relative velocity (moving segments have hVel in x or y)
							const surfVx = isMoving(seg.type) && !face ? hVel : 0;
							const surfVy = isMoving(seg.type) && face ? hVel : 0;
							const relVx = pts[i].vx - surfVx;
							const relVy = pts[i].vy - surfVy;
							const vn = relVx * seg.nx + relVy * seg.ny;
							const vtx = relVx - vn * seg.nx;
							const vty = relVy - vn * seg.ny;
							const vt = Math.sqrt(vtx * vtx + vty * vty);
							if (vt > 1e-8) {
								const fric = Math.min(friction * cF, vt * 100);
								fx[i] -= fric * (vtx / vt);
								fy[i] -= fric * (vty / vt);
								if (isMoving(seg.type)) {
									matingF += face ? fric * (vty / vt) : fric * (vtx / vt);
								}
							}
							if (isMoving(seg.type)) {
								matingF -= face ? cF * seg.ny : cF * seg.nx;
							}
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

				// Moving part dynamics (in mm-space)
				const hMass = 10;
				if (dragging) {
					const sep = targetX - posX;
					const raw = springK * sep;
					const sF = Math.sign(raw) * Math.min(Math.abs(raw), maxForce);
					vel += ((sF + matingF * 0.01) / hMass) * DT;
				} else {
					vel += ((matingF * 0.01) / hMass) * DT;
				}
				vel *= Math.exp((-80 / hMass) * DT);
				posX += vel * DT;
				posX = Math.max(minPosMm, Math.min(maxPosMm, posX));
			}

			// Sync to render state
			if (sealType === 'face') {
				posYmm = posX; // for face seal, posX stores Y displacement
			} else {
				posXmm = posX;
			}
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

			{#if sealType === 'face'}
				<!-- ═══ FACE SEAL LAYOUT: housing+groove at top, flat plate at bottom (moves vertically) ═══ -->

				<!-- Groove clearout -->
				<path
					d="M {gL} {boreIdSvgY} L {gL} {boreWallY + grRpx} A {grRpx} {grRpx} 0 0 1 {gL +
						grRpx} {boreWallY} L {gR - grRpx} {boreWallY} A {grRpx} {grRpx} 0 0 1 {gR} {boreWallY +
						grRpx} L {gR} {boreIdSvgY}"
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

				<!-- Housing body with groove (stationary, at top) -->
				<rect
					x={0}
					y={0}
					width={Math.max(0, gL)}
					height={boreIdSvgY}
					fill="url(#{topHatch})"
					stroke="none"
				/>
				<rect
					x={gR}
					y={0}
					width={Math.max(0, viewW - gR)}
					height={boreIdSvgY}
					fill="url(#{topHatch})"
					stroke="none"
				/>
				<rect
					x={gL}
					y={0}
					width={gR - gL}
					height={boreWallY}
					fill="url(#{topHatch})"
					stroke="none"
				/>
				<!-- Groove corner fillets -->
				<path
					d="M {gL} {boreWallY} L {gL} {boreWallY + grRpx} A {grRpx} {grRpx} 0 0 1 {gL +
						grRpx} {boreWallY} Z"
					fill="url(#{topHatch})"
					stroke="none"
				/>
				<path
					d="M {gR} {boreWallY} L {gR} {boreWallY + grRpx} A {grRpx} {grRpx} 0 0 0 {gR -
						grRpx} {boreWallY} Z"
					fill="url(#{topHatch})"
					stroke="none"
				/>
				<!-- Housing face lines (around groove opening) -->
				<line x1={0} y1={boreIdSvgY} x2={gL} y2={boreIdSvgY} class="surface-edge" />
				<line x1={gR} y1={boreIdSvgY} x2={viewW} y2={boreIdSvgY} class="surface-edge" />
				<!-- Groove outline -->
				<path
					d="M {gL} {boreIdSvgY} L {gL} {boreWallY + grRpx} A {grRpx} {grRpx} 0 0 1 {gL +
						grRpx} {boreWallY} L {gR - grRpx} {boreWallY} A {grRpx} {grRpx} 0 0 1 {gR} {boreWallY +
						grRpx} L {gR} {boreIdSvgY}"
					class="groove-outline"
				/>

				<!-- Flat plate (moving, at bottom) -->
				<rect
					x={0}
					y={plateSvgY}
					width={viewW}
					height={viewH - plateSvgY}
					fill="url(#{bottomHatch})"
					stroke="none"
				/>
				<line x1={0} y1={plateSvgY} x2={viewW} y2={plateSvgY} class="surface-edge" />
			{:else if sealType === 'rod'}
				<!-- ═══ ROD SEAL LAYOUT: housing+groove at top, rod+chamfer at bottom ═══ -->

				<!-- Groove clearout (erases grid behind groove space) -->
				<path
					d="M {gL} {boreIdSvgY} L {gL} {boreWallY + grRpx} A {grRpx} {grRpx} 0 0 1 {gL +
						grRpx} {boreWallY} L {gR - grRpx} {boreWallY} A {grRpx} {grRpx} 0 0 1 {gR} {boreWallY +
						grRpx} L {gR} {boreIdSvgY}"
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

				<!-- Housing body with groove (stationary, at top) -->
				<rect
					x={0}
					y={0}
					width={Math.max(0, gL)}
					height={boreIdSvgY}
					fill="url(#{topHatch})"
					stroke="none"
				/>
				<rect
					x={gR}
					y={0}
					width={Math.max(0, viewW - gR)}
					height={boreIdSvgY}
					fill="url(#{topHatch})"
					stroke="none"
				/>
				<rect
					x={gL}
					y={0}
					width={gR - gL}
					height={boreWallY}
					fill="url(#{topHatch})"
					stroke="none"
				/>
				<!-- Groove corner fillets (metal fill at radii) -->
				<path
					d="M {gL} {boreWallY} L {gL} {boreWallY + grRpx} A {grRpx} {grRpx} 0 0 1 {gL +
						grRpx} {boreWallY} Z"
					fill="url(#{topHatch})"
					stroke="none"
				/>
				<path
					d="M {gR} {boreWallY} L {gR} {boreWallY + grRpx} A {grRpx} {grRpx} 0 0 0 {gR -
						grRpx} {boreWallY} Z"
					fill="url(#{topHatch})"
					stroke="none"
				/>
				<!-- Bore ID surface lines -->
				<line x1={0} y1={boreIdSvgY} x2={gL} y2={boreIdSvgY} class="surface-edge" />
				<line x1={gR} y1={boreIdSvgY} x2={viewW} y2={boreIdSvgY} class="surface-edge" />
				<!-- Groove outline -->
				<path
					d="M {gL} {boreIdSvgY} L {gL} {boreWallY + grRpx} A {grRpx} {grRpx} 0 0 1 {gL +
						grRpx} {boreWallY} L {gR - grRpx} {boreWallY} A {grRpx} {grRpx} 0 0 1 {gR} {boreWallY +
						grRpx} L {gR} {boreIdSvgY}"
					class="groove-outline"
				/>

				<!-- Rod body with chamfer (moving, at bottom) -->
				{#if chFillet}
					<path
						d="M 0 {viewH} L 0 {grooveBottomY} L {chFillet.boreX} {chFillet.boreY} A {chFillet.r} {chFillet.r} 0 0 1 {chFillet.chamX} {chFillet.chamY} L {chX1} {grooveBottomY +
							chRpx} L {chX1} {viewH} Z"
						fill="url(#{bottomHatch})"
						stroke="none"
					/>
					<line
						x1={0}
						y1={grooveBottomY}
						x2={chFillet.boreX}
						y2={chFillet.boreY}
						class="surface-edge"
					/>
					<path
						d="M {chFillet.boreX} {chFillet.boreY} A {chFillet.r} {chFillet.r} 0 0 1 {chFillet.chamX} {chFillet.chamY}"
						class="surface-edge"
						fill="none"
					/>
					<line
						x1={chFillet.chamX}
						y1={chFillet.chamY}
						x2={chX1}
						y2={grooveBottomY + chRpx}
						class="chamfer-edge"
					/>
				{:else}
					<path
						d="M 0 {viewH} L 0 {grooveBottomY} L {chX0} {grooveBottomY} L {chX1} {grooveBottomY +
							chRpx} L {chX1} {viewH} Z"
						fill="url(#{bottomHatch})"
						stroke="none"
					/>
					<line x1={0} y1={grooveBottomY} x2={chX0} y2={grooveBottomY} class="surface-edge" />
					<line
						x1={chX0}
						y1={grooveBottomY}
						x2={chX1}
						y2={grooveBottomY + chRpx}
						class="chamfer-edge"
					/>
				{/if}
				<line x1={chX1} y1={grooveBottomY + chRpx} x2={chX1} y2={viewH} class="surface-edge" />
				<text
					x={chFillet ? (chFillet.chamX + chX1) / 2 + 5 : (chX0 + chX1) / 2 + 5}
					y={grooveBottomY + chRpx / 2 + 14}
					class="chamfer-label"
					text-anchor="middle">{chamferAngle}°</text
				>
			{:else}
				<!-- ═══ PISTON SEAL LAYOUT: bore+chamfer at top, piston+groove at bottom ═══ -->

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

				<!-- Bore wall + chamfer (moving, at top) -->
				{#if chFillet}
					<path
						d="M 0 0 L 0 {boreWallY} L {chFillet.boreX} {chFillet.boreY} A {chFillet.r} {chFillet.r} 0 0 0 {chFillet.chamX} {chFillet.chamY} L {chX1} {boreWallY -
							chRpx} L {chX1} 0 Z"
						fill="url(#{topHatch})"
						stroke="none"
					/>
					<line
						x1={0}
						y1={boreWallY}
						x2={chFillet.boreX}
						y2={chFillet.boreY}
						class="surface-edge"
					/>
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
						fill="url(#{topHatch})"
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

				<!-- Piston body with groove (stationary, at bottom) -->
				<rect
					x={0}
					y={rodOdY}
					width={Math.max(0, gL)}
					height={viewH - rodOdY}
					fill="url(#{bottomHatch})"
					stroke="none"
				/>
				<rect
					x={gR}
					y={rodOdY}
					width={Math.max(0, viewW - gR)}
					height={viewH - rodOdY}
					fill="url(#{bottomHatch})"
					stroke="none"
				/>
				<rect
					x={gL}
					y={grooveBottomY}
					width={gR - gL}
					height={viewH - grooveBottomY}
					fill="url(#{bottomHatch})"
					stroke="none"
				/>
				<line x1={0} y1={rodOdY} x2={gL} y2={rodOdY} class="surface-edge" />
				<line x1={gR} y1={rodOdY} x2={viewW} y2={rodOdY} class="surface-edge" />
				<!-- Groove corner fillets (metal fill at radii) -->
				<path
					d="M {gL} {grooveBottomY} L {gL} {grooveBottomY - grRpx} A {grRpx} {grRpx} 0 0 0 {gL +
						grRpx} {grooveBottomY} Z"
					fill="url(#{bottomHatch})"
					stroke="none"
				/>
				<path
					d="M {gR} {grooveBottomY} L {gR} {grooveBottomY - grRpx} A {grRpx} {grRpx} 0 0 1 {gR -
						grRpx} {grooveBottomY} Z"
					fill="url(#{bottomHatch})"
					stroke="none"
				/>
				<path
					d="M {gL} {rodOdY} L {gL} {grooveBottomY - grRpx} A {grRpx} {grRpx} 0 0 0 {gL +
						grRpx} {grooveBottomY} L {gR -
						grRpx} {grooveBottomY} A {grRpx} {grRpx} 0 0 0 {gR} {grooveBottomY -
						grRpx} L {gR} {rodOdY}"
					class="groove-outline"
				/>
			{/if}

			<!-- Debug overlay -->
			{#if showDebug}
				{@const nFlip = sealType === 'piston' ? 1 : -1}
				{#each renderPts as p, i (i)}
					<circle cx={mmX(p.x)} cy={mmY(p.y)} r="2" class="debug-dot" />
				{/each}
				{#each debugSegs as seg, i (i)}
					{@const sx1 = mmX(seg.x1)}
					{@const sy1 = mmY(seg.y1)}
					{@const sx2 = mmX(seg.x2)}
					{@const sy2 = mmY(seg.y2)}
					{@const mx = (sx1 + sx2) / 2}
					{@const my = (sy1 + sy2) / 2}
					{@const col = debugSegColor[seg.type] ?? '#ffff44'}
					<line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke={col} stroke-width="2" opacity="0.5" />
					<line
						x1={mx}
						y1={my}
						x2={mx + seg.nx * 10}
						y2={my + seg.ny * nFlip * 10}
						stroke={col}
						stroke-width="1"
						opacity="0.4"
					/>
					<circle
						cx={mx + seg.nx * 10}
						cy={my + seg.ny * nFlip * 10}
						r="2"
						fill={col}
						opacity="0.4"
					/>
				{/each}
			{/if}

			<!-- Drag hint -->
			{#if !dragging}
				<text x={viewW / 2} y={viewH - 6} class="drag-hint" text-anchor="middle">
					{#if isFace}▲ drag to move {matingLabel} ▼{:else}◄ drag to move {matingLabel} ►{/if}
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

		<!-- Lead-in geometry (piston/rod only) -->
		{#if !isFace}
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
		{/if}

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
				onclick={() => spawnRing(isFace ? -cs * 1.5 : -(chamferLength + cs))}
				class="rounded border border-border bg-background px-3 py-1 text-[10px] text-foreground hover:bg-muted"
			>
				Reset
			</button>
		</div>

		<!-- Status cards -->
		<div class="grid {isFace ? 'grid-cols-1' : 'grid-cols-2'} gap-2">
			{@render card(
				'Compression',
				`${(sqEst * 100).toFixed(1)}%`,
				sqEst > 0.25 ? 'var(--destructive)' : sqEst > 0.005 ? 'var(--chart-1)' : 'var(--chart-2)',
				sqEst > 0.25 ? 'Exceeds 25%' : sqEst > 0.15 ? 'Nominal' : sqEst > 0.005 ? 'Light' : 'None'
			)}
			{#if !isFace}
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
			{/if}
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
