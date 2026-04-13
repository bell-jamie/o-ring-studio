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
		grooveDia, // groove diameter — needed for dynamic stretch calculation
		oRingId, // o-ring inner diameter (free state)
		boreDia, // bore diameter (housing ID for rod/face, bore ID for piston)
		sealType = 'piston'
	}: {
		cs: number;
		glandDepth: number;
		grooveWidth: number;
		clearance: number;
		stretchPercent: number;
		grooveRadii: number;
		grooveDia: number;
		oRingId: number;
		boreDia: number;
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
	const DT = 1 / 480;
	let simSpeed = $state(4);

	// ── User state (sim controls) ──────────────────────────────────────
	let dragging = $state(false);
	let faceSeated = $state(false);
	let faceAtSeat = $state(false);
	let showDebug = $state(false);
	let showSettings = $state(false);
	let friction = $state(0.3);
	let chamferAngle = $state(15);
	let chamferLength = $state(4.5);
	let chamferBoreRadius = $state(1.0);
	let physicsOn = $state(true);
	let shoreA = $state(70);
	// Gent's equation: Shore A hardness → Young's modulus (MPa)
	const youngsE = $derived((0.0981 * (56 + 7.62336 * shoreA)) / (0.137505 * (254 - 2.54 * shoreA)));

	let pDamp = $state(0.005);
	let structDamp = $state(0.5);
	let tangentialDamp = $state(1.0);
	let nParticles = $state(32);

	// ── Derived geometry ───────────────────────────────────────────────
	const r0 = $derived(cs / 2);
	// 2D area-preservation "bulk modulus". The 3D formula E/(3(1-2ν)) diverges
	// for incompressible rubber — wrong for a 2D slice where rubber flows out-of-plane.
	// ~80×E: strong enough to preserve area (match analytical compression) without exploding.
	const bulkMod = $derived(youngsE * 80);
	const segLen = $derived(2 * r0 * Math.sin(Math.PI / nParticles));
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
	const tRpx = $derived(0.1 * S);

	// Status card colours (match analytical ResultRow: emerald/amber/red)
	function statusColor(val: number, min: number, max: number): string {
		const margin = (max - min) * 0.2;
		if (val >= min && val <= max) return '#059669';
		if (val >= min - margin && val <= max + margin) return '#d97706';
		return '#dc2626';
	}
	const compColor = $derived(statusColor(sqEst * 100, isFace ? 13 : 10, isFace ? 36 : 35));
	const strColor = $derived(statusColor(dynamicStretch, isFace ? -2 : 2, isFace ? 3 : 8));
	// Chamfer must clear the o-ring protruding from the groove.
	// Rod seal: clearance is measured from bore ID inward to rod OD.
	//   No stretch: chamfer must clear oRingID/2 (half the free ID = inner radius from axis)
	//   Negative stretch: chamfer must clear grooveDia/2 - oRingCS (compressed ring inner edge)
	// Piston seal: chamfer must clear the protrusion above the groove = CS - grooveDepth
	// O-ring protrusion past groove opening into clearance gap.
	// Rod seal: free o-ring hangs below bore ID because oRingID < boreDia.
	//   Protrusion from bore ID = boreRadius - oRingInnerRadius
	//   boreRadius = grooveDia/2 - grooveDepth = grooveDia/2 - (glandDepth - clearance)
	//   No stretch: innerRadius = oRingID/2
	//   Negative stretch: innerRadius = boreRadius - cs (compressed to fit bore)
	// Piston seal: o-ring protrudes above piston surface = cs - grooveDepth
	const freeORingID = $derived(grooveDia / (1 + stretchPercent / 100));
	const boreRadius = $derived(grooveDia / 2 - (glandDepth - clearance));
	const oRingProtrusion = $derived.by(() => {
		if (sealType === 'rod') {
			if (grooveDia > oRingId + 2 * cs) {
				return boreDia / 2 - oRingId / 2;
			} else {
				return boreDia / 2 + cs - grooveDia / 2;
			}
		} else {
			// piston seal
			if (grooveDia < oRingId) {
				return cs + oRingId / 2 - boreDia / 2;
			} else {
				return cs + grooveDia / 2 - boreDia / 2;
			}
		}
	});
	const chamferColor = $derived(
		oRingProtrusion <= 0
			? '#059669'
			: chR >= oRingProtrusion * 1.2
				? '#059669'
				: chR >= oRingProtrusion
					? '#d97706'
					: '#dc2626'
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
	let dynamicStretch = $state(0);

	// ── SVG derived ────────────────────────────────────────────────────
	// Smooth closed Catmull-Rom spline through particle positions
	const oPath = $derived.by(() => {
		const n = renderPts.length;
		if (n < 3) return '';
		const sx = (i: number) => mmX(renderPts[((i % n) + n) % n].x);
		const sy = (i: number) => mmY(renderPts[((i % n) + n) % n].y);
		const t = 1 / 3; // tension (Catmull-Rom → cubic bezier control point fraction)
		let d = `M ${sx(0).toFixed(1)},${sy(0).toFixed(1)}`;
		for (let i = 0; i < n; i++) {
			const x0 = sx(i - 1),
				y0 = sy(i - 1);
			const x1 = sx(i),
				y1 = sy(i);
			const x2 = sx(i + 1),
				y2 = sy(i + 1);
			const x3 = sx(i + 2),
				y3 = sy(i + 2);
			const cp1x = x1 + (x2 - x0) * t;
			const cp1y = y1 + (y2 - y0) * t;
			const cp2x = x2 - (x3 - x1) * t;
			const cp2y = y2 - (y3 - y1) * t;
			d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
		}
		return d + ' Z';
	});
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

		const gRad = Math.min(grooveRadii, (glandDepth - clearance) * 0.45, grooveWidth * 0.45);
		// Top fillet radius at groove opening (wall ↔ rod/piston surface)
		const tRad = 0.1;
		const nArc = 4;

		// ── Rod/piston surface either side of groove (with top fillets) ──
		if (!isFace) {
			segs.push({
				x1: gLv - cs,
				y1: clearance,
				x2: gLv,
				y2: clearance,
				nx: 0,
				ny: -1,
				type: 'rod'
			});
			segs.push({
				x1: gRv,
				y1: clearance,
				x2: gRv + cs,
				y2: clearance,
				nx: 0,
				ny: -1,
				type: 'rod'
			});
		}

		// ── Groove floor ──
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
		}

		// ── Groove walls (shortened to leave room for top and bottom fillets) ──
		const wallTop = clearance + tRad;
		const wallBot = gRad > 0.01 ? glandDepth - gRad : glandDepth;
		if (wallTop < wallBot - 0.01) {
			segs.push({
				x1: gLv,
				y1: wallTop,
				x2: gLv,
				y2: wallBot,
				nx: 1,
				ny: 0,
				type: 'gwall'
			});
			segs.push({
				x1: gRv,
				y1: wallTop,
				x2: gRv,
				y2: wallBot,
				nx: -1,
				ny: 0,
				type: 'gwall'
			});
		}

		// ── Top fillets: wall ↔ rod surface (quarter circle, concave) ──
		// Concave fillets: normals point AWAY from center (into groove interior)
		// Left top fillet: concave, center at (gLv - tRad, clearance + tRad)
		{
			const cx = gLv - tRad,
				cy = clearance + tRad;
			for (let k = 0; k < nArc; k++) {
				const a0 = Math.PI + (k / nArc) * (Math.PI / 2);
				const a1 = Math.PI + ((k + 1) / nArc) * (Math.PI / 2);
				const amid = (a0 + a1) / 2;
				segs.push({
					x1: cx - tRad * Math.cos(a0),
					y1: cy + tRad * Math.sin(a0),
					x2: cx - tRad * Math.cos(a1),
					y2: cy + tRad * Math.sin(a1),
					nx: -Math.cos(amid),
					ny: Math.sin(amid),
					type: 'groove'
				});
			}
		}
		// Right top fillet: concave, center at (gRv + tRad, clearance + tRad)
		{
			const cx = gRv + tRad,
				cy = clearance + tRad;
			for (let k = 0; k < nArc; k++) {
				const a0 = (3 * Math.PI) / 2 + (k / nArc) * (Math.PI / 2);
				const a1 = (3 * Math.PI) / 2 + ((k + 1) / nArc) * (Math.PI / 2);
				const amid = (a0 + a1) / 2;
				segs.push({
					x1: cx - tRad * Math.cos(a0),
					y1: cy + tRad * Math.sin(a0),
					x2: cx - tRad * Math.cos(a1),
					y2: cy + tRad * Math.sin(a1),
					nx: -Math.cos(amid),
					ny: Math.sin(amid),
					type: 'groove'
				});
			}
		}

		// ── Bottom fillets (existing) ──
		if (gRad > 0.01) {
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
			const cxR = gRv - gRad,
				cyBR = glandDepth - gRad;
			for (let k = 0; k < nArc; k++) {
				const a0 = (k / nArc) * (Math.PI / 2);
				const a1 = ((k + 1) / nArc) * (Math.PI / 2);
				const amid = (a0 + a1) / 2;
				segs.push({
					x1: cxR + gRad * Math.cos(a0),
					y1: cyBR + gRad * Math.sin(a0),
					x2: cxR + gRad * Math.cos(a1),
					y2: cyBR + gRad * Math.sin(a1),
					nx: -Math.cos(amid),
					ny: -Math.sin(amid),
					type: 'groove'
				});
			}
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
		const pen = -((px - cx) * seg.nx + (py - cy) * seg.ny);
		// Ignore deep penetrations — particle is on the wrong side of a thin wall
		if (pen > segLen) return -1;
		return pen;
	}

	// Creates perimeter particles [0..n-1] + center particle [n]
	function createRing(cx: number, cy: number, r: number, n: number): Particle[] {
		const pts = Array.from({ length: n }, (_, i) => {
			const a = (i / n) * Math.PI * 2;
			return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), vx: 0, vy: 0 };
		});
		pts.push({ x: cx, y: cy, vx: 0, vy: 0 }); // center particle
		return pts;
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
		const spawnR = r0; // unstretched CS/2
		particles = createRing(0, glandDepth - cs / 2, spawnR, n);
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
	let seatedAtPixel: number | null = null; // pixel when plate first reached seated

	function onDown(e: PointerEvent) {
		e.preventDefault();
		(e.target as Element).setPointerCapture(e.pointerId);
		dragStartPixel = isFace ? e.clientY : e.clientX;
		// Anchor to actual position, not stale target (prevents teleport)
		dragStartMm = posX;
		targetX = posX;
		dragging = true;
		seatedAtPixel = null;
		if (isFace && faceSeated) faceSeated = false;
	}
	function onMove(e: PointerEvent) {
		if (!dragging) return;
		const pixel = isFace ? e.clientY : e.clientX;
		const sign = isFace ? -1 : 1;
		const raw = dragStartMm + ((pixel - dragStartPixel) / S) * sign;
		targetX = Math.max(minPosMm, Math.min(maxPosMm, raw));
		if (isFace) {
			const atSeat = posX >= maxPosMm - 0.1;
			faceAtSeat = atSeat;
			if (atSeat && seatedAtPixel === null) {
				// Record pixel position when plate first reaches seated
				seatedAtPixel = pixel;
			} else if (!atSeat) {
				seatedAtPixel = null;
			}
			// Latch when user has dragged half CS further past the seated point
			const lockDist = (cs / 2) * S; // half CS in pixels
			faceSeated = seatedAtPixel !== null && seatedAtPixel - pixel >= lockDist;
		}
	}
	function onUp() {
		seatedAtPixel = null;
		faceAtSeat = false;
		if (isFace && dragging && !faceSeated) {
			faceSeated = false;
		}
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
		let dbgFrame = 0;

		function step() {
			if (!running) return;
			const now = performance.now();
			acc += Math.min((now - lastT) / 1000, 0.05) * simSpeed;
			lastT = now;

			const pts = particles;
			const nPts = nParticles; // perimeter count; pts has nPts+1 (center at index nPts)
			if (pts.length !== nPts + 1) {
				animId = requestAnimationFrame(step);
				return;
			}

			const cL = chamferLength;
			const cA = chamferAngle;
			const csVal = cs;

			let lastStretchFrac = stretchPercent / 100;
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
				const nAll = nPts + 1; // perimeter + center
				const fx = new Float64Array(nAll);
				const fy = new Float64Array(nAll);
				const ci = nPts; // center particle index

				const sK = structK;
				const prK = bulkMod;
				const bK = bendK;
				const cK = contactK;
				const pm = 0.05;
				// Use chord length (not arc) so perimeter springs are at rest when spawned
				const rSeg = 2 * (csVal / 2) * Math.sin(Math.PI / nPts);
				const rSpoke = csVal / 2; // rest length of radial spokes
				// Rest area = polygon area at spawn (not π*r²) so pressure starts at zero
				const restArea = (nPts / 2) * (csVal / 2) ** 2 * Math.sin((2 * Math.PI) / nPts);
				// Dynamic stretch: as center particle moves radially, effective diameter changes
				// Piston: +Y = inward = smaller dia = less stretch (radialSign = -1)
				// Rod: +Y = outward = larger dia = more stretch (radialSign = +1)
				const radialSign = sealType === 'rod' ? 1 : -1;
				const cy = pts[ci].y;
				const spawnCy = glandDepth - csVal / 2; // nominal center Y (sitting on groove floor)
				const oRingID = grooveDia / (1 + stretchPercent / 100);
				const dy = cy - spawnCy;
				const rawStretchFrac = stretchPercent / 100 + (radialSign * 2 * dy) / oRingID;
				const stretchFrac = Math.max(0, rawStretchFrac);
				lastStretchFrac = rawStretchFrac;

				// Structural springs (perimeter) + structural damping
				const sDamp = structDamp * 2 * Math.sqrt(sK * pm);
				const tanDamp = tangentialDamp * 2 * Math.sqrt(sK * pm);
				for (let i = 0; i < nPts; i++) {
					const j = (i + 1) % nPts;
					const dx = pts[j].x - pts[i].x,
						dy = pts[j].y - pts[i].y;
					const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
					const f = sK * (d - rSeg);
					const ux = dx / d,
						uy = dy / d;
					const dvx = pts[j].vx - pts[i].vx,
						dvy = pts[j].vy - pts[i].vy;
					// Radial (along-spring) damping
					const vRel = dvx * ux + dvy * uy;
					const fDamp = sDamp * vRel;
					fx[i] += (f + fDamp) * ux;
					fy[i] += (f + fDamp) * uy;
					fx[j] -= (f + fDamp) * ux;
					fy[j] -= (f + fDamp) * uy;
					// Tangential damping — kills sliding/shuffling along the perimeter
					const tx = -uy,
						ty = ux;
					const vTan = dvx * tx + dvy * ty;
					const fTan = tanDamp * vTan;
					fx[i] += fTan * tx;
					fy[i] += fTan * ty;
					fx[j] -= fTan * tx;
					fy[j] -= fTan * ty;
				}

				// Radial spokes: center ↔ each perimeter particle
				// These directly resist compression — stiffer than perimeter springs
				// Normalize so total radial stiffness is independent of nParticles
				// (32 spokes at k each = same total as 16 spokes at 2k)
				const spokeK = (sK * 0.5 * 32) / nPts;
				const spokeDamp = structDamp * 2 * Math.sqrt(spokeK * pm);
				for (let i = 0; i < nPts; i++) {
					const dx = pts[i].x - pts[ci].x,
						dy = pts[i].y - pts[ci].y;
					const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
					const f = spokeK * (d - rSpoke);
					const ux = dx / d,
						uy = dy / d;
					const dvx = pts[i].vx - pts[ci].vx,
						dvy = pts[i].vy - pts[ci].vy;
					const vRel = dvx * ux + dvy * uy;
					const fDamp = spokeDamp * vRel;
					fx[ci] += (f + fDamp) * ux;
					fy[ci] += (f + fDamp) * uy;
					fx[i] -= (f + fDamp) * ux;
					fy[i] -= (f + fDamp) * uy;
				}

				// Hoop stress: circumferential strain → radial pressure.
				// Works in both tension (positive stretch → inward pressure → seats ring)
				// and compression (negative stretch → outward pressure → unseats ring).
				// 1) Radial force: squeezes/expands cross-section toward/away from centroid
				// 2) Seating force: net load on center particle
				// Face: stretch is circumferential (out of plane), no hoop force.
				if (Math.abs(rawStretchFrac) > 0.001 && sealType !== 'face') {
					const hoopPressure = (youngsE * rawStretchFrac * csVal) / r0;
					const hoopForce = hoopPressure * rSeg;
					// 1) Radial compression toward centroid
					let cxH = 0,
						cyH = 0;
					for (let i = 0; i < nPts; i++) {
						cxH += pts[i].x;
						cyH += pts[i].y;
					}
					cxH /= nPts;
					cyH /= nPts;
					for (let i = 0; i < nPts; i++) {
						const dx = pts[i].x - cxH,
							dy = pts[i].y - cyH;
						const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
						fx[i] -= hoopForce * (dx / d);
						fy[i] -= hoopForce * (dy / d);
					}
					// 2) Seating: total hoop load on center particle
					const seatDir = sealType === 'rod' ? -1 : 1;
					fy[ci] += hoopForce * nPts * seatDir;
				}

				// Bending resistance (perimeter only)
				for (let i = 0; i < nPts; i++) {
					const prev = (i - 1 + nPts) % nPts,
						next = (i + 1) % nPts;
					fx[i] += bK * ((pts[prev].x + pts[next].x) / 2 - pts[i].x);
					fy[i] += bK * ((pts[prev].y + pts[next].y) / 2 - pts[i].y);
				}

				// Internal pressure (bulk modulus — resists area change, perimeter only)
				const targetArea = restArea / Math.sqrt(1.0 + stretchFrac);
				const periPts = pts.slice(0, nPts);
				const pressure = prK * (1.0 - polyArea(periPts) / targetArea);
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

				// Contact + Coulomb friction (perimeter only — center is interior)
				let matingF = 0;
				const isMoving = (t: string) => t === 'bore' || t === 'chamfer' || t === 'face';
				const face = sealType === 'face';
				for (let i = 0; i < nPts; i++) {
					for (const seg of segs) {
						const pen = ptSegDist(pts[i].x, pts[i].y, seg);
						if (pen > 0) {
							if (showDebug && dbgFrame % 60 === 0 && acc < DT) {
								console.log(
									`  contact: p${i}=(${pts[i].x.toFixed(2)},${pts[i].y.toFixed(2)}) seg=${seg.type} (${seg.x1.toFixed(2)},${seg.y1.toFixed(2)})→(${seg.x2.toFixed(2)},${seg.y2.toFixed(2)}) n=(${seg.nx.toFixed(2)},${seg.ny.toFixed(2)}) pen=${pen.toFixed(4)}`
								);
							}
							const cF = cK * pen;
							fx[i] += cF * seg.nx;
							fy[i] += cF * seg.ny;
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

				// Debug: log once per frame (first substep only)
				if (showDebug && dbgFrame % 30 === 0 && acc < DT) {
					const p0 = pts[0],
						ctr = pts[ci];
					const sd = Math.sqrt((p0.x - ctr.x) ** 2 + (p0.y - ctr.y) ** 2);
					let netFx = 0,
						netFy = 0;
					for (let k = 0; k < nAll; k++) {
						netFx += fx[k];
						netFy += fy[k];
					}
					console.log(
						`[frame ${dbgFrame}]`,
						`p0=(${p0.x.toFixed(3)},${p0.y.toFixed(3)})`,
						`ctr=(${ctr.x.toFixed(3)},${ctr.y.toFixed(3)})`,
						`spoke=${sd.toFixed(4)}/${rSpoke.toFixed(4)}`,
						`\n  f0=(${fx[0].toFixed(2)},${fy[0].toFixed(2)})`,
						`fCtr=(${fx[ci].toFixed(2)},${fy[ci].toFixed(2)})`,
						`net=(${netFx.toFixed(2)},${netFy.toFixed(2)})`,
						`\n  prs=${pressure.toFixed(3)}`,
						`area=${polyArea(periPts).toFixed(2)}/${targetArea.toFixed(2)}`,
						`sK=${sK.toFixed(1)} spokeK=${spokeK.toFixed(1)} cK=${cK.toFixed(1)} prK=${prK.toFixed(1)}`,
						`hX=${hX.toFixed(3)}`
					);
				}

				// Integrate all particles (perimeter + center)
				// Light outer particles, heavy center particle
				const pmCenter = pm * nPts;
				const decay = Math.exp(-pDamp * DT * 480);
				for (let i = 0; i < nAll; i++) {
					const mi = i === ci ? pmCenter : pm;
					pts[i].vx = (pts[i].vx + (fx[i] / mi) * DT) * decay;
					pts[i].vy = (pts[i].vy + (fy[i] / mi) * DT) * decay;
					pts[i].x += pts[i].vx * DT;
					pts[i].y += pts[i].vy * DT;
				}

				// Moving part dynamics — critically-damped spring to cursor
				// Spring stiffness scales with material so harder o-rings feel stiffer
				const hMass = 0.3;
				const hK = contactK * 0.5; // scale with material so drag tracks o-ring stiffness
				const hDamp = 2 * Math.sqrt(hK * hMass); // critical damping
				const oRingReaction = matingF;
				if (dragging && isFace) {
					// Face seal: plate tracks cursor directly, no o-ring reaction during drag
					const sep = targetX - posX;
					vel += ((hK * sep - hDamp * vel) / hMass) * DT;
				} else if (dragging) {
					const sep = targetX - posX;
					vel += ((hK * sep - hDamp * vel + oRingReaction) / hMass) * DT;
				} else if (isFace && faceSeated) {
					// Face seal: lock plate when fully seated
					vel = 0;
				} else if (isFace) {
					// Face seal: just let o-ring reaction push plate back naturally
					vel += (oRingReaction / hMass) * DT;
					vel *= Math.exp(-10 * DT);
				} else {
					vel += (oRingReaction / hMass) * DT;
					vel *= Math.exp(-10 * DT);
				}
				posX += vel * DT;
				posX = Math.max(minPosMm, Math.min(maxPosMm, posX));
			}

			// Sync to render state
			if (sealType === 'face') {
				posYmm = posX; // for face seal, posX stores Y displacement
			} else {
				posXmm = posX;
			}
			// Only render perimeter particles (exclude center)
			renderPts = pts.slice(0, nPts).map((p) => ({ x: p.x, y: p.y }));

			let minY = Infinity,
				maxY = -Infinity;
			for (let i = 0; i < nPts; i++) {
				if (pts[i].y < minY) minY = pts[i].y;
				if (pts[i].y > maxY) maxY = pts[i].y;
			}
			const h = maxY - minY;
			// Measure compression against stretched CS (volume-conserved).
			// Use dynamic stretch (not nominal) so compression tracks actual ring state.
			const stretchedCS = csVal / Math.pow(1 + lastStretchFrac, 2 / 3);
			sqEst = h > 0 ? Math.max(0, 1 - h / stretchedCS) : 0;
			dynamicStretch = lastStretchFrac * 100;
			if (showDebug && dbgFrame % 60 === 0) {
				console.log(
					`[compression] h=${h.toFixed(4)} stretchedCS=${stretchedCS.toFixed(4)} ` +
						`cs=${csVal.toFixed(4)} stretch=${stretchPercent.toFixed(2)}% ` +
						`sim=${(sqEst * 100).toFixed(1)}% minY=${minY.toFixed(4)} maxY=${maxY.toFixed(4)}`
				);
			}

			dbgFrame++;
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
					d="M {gL - tRpx} {boreIdSvgY} A {tRpx} {tRpx} 0 0 0 {gL} {boreIdSvgY -
						tRpx} L {gL} {boreWallY + grRpx} A {grRpx} {grRpx} 0 0 1 {gL +
						grRpx} {boreWallY} L {gR - grRpx} {boreWallY} A {grRpx} {grRpx} 0 0 1 {gR} {boreWallY +
						grRpx} L {gR} {boreIdSvgY - tRpx} A {tRpx} {tRpx} 0 0 0 {gR + tRpx} {boreIdSvgY}"
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
				<!-- Groove corner fillets (bottom, convex — metal fill) -->
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
				<line x1={0} y1={boreIdSvgY} x2={gL - tRpx} y2={boreIdSvgY} class="surface-edge" />
				<line x1={gR + tRpx} y1={boreIdSvgY} x2={viewW} y2={boreIdSvgY} class="surface-edge" />
				<!-- Groove outline -->
				<path
					d="M {gL - tRpx} {boreIdSvgY} A {tRpx} {tRpx} 0 0 0 {gL} {boreIdSvgY -
						tRpx} L {gL} {boreWallY + grRpx} A {grRpx} {grRpx} 0 0 1 {gL +
						grRpx} {boreWallY} L {gR - grRpx} {boreWallY} A {grRpx} {grRpx} 0 0 1 {gR} {boreWallY +
						grRpx} L {gR} {boreIdSvgY - tRpx} A {tRpx} {tRpx} 0 0 0 {gR + tRpx} {boreIdSvgY}"
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
				<line
					x1={0}
					y1={plateSvgY}
					x2={viewW}
					y2={plateSvgY}
					class={faceSeated || faceAtSeat ? 'seated-edge' : 'surface-edge'}
				/>
				{#if faceSeated}
					<text x={viewW - 8} y={plateSvgY + 16} text-anchor="end" class="seated-label">SEATED</text
					>
				{:else if faceAtSeat}
					<text x={viewW - 8} y={plateSvgY + 16} text-anchor="end" class="seated-label"
						>DRAG UP TO LOCK</text
					>
				{/if}
			{:else if sealType === 'rod'}
				<!-- ═══ ROD SEAL LAYOUT: housing+groove at top, rod+chamfer at bottom ═══ -->

				<!-- Groove clearout (erases grid behind groove space) -->
				<path
					d="M {gL - tRpx} {boreIdSvgY} A {tRpx} {tRpx} 0 0 0 {gL} {boreIdSvgY -
						tRpx} L {gL} {boreWallY + grRpx} A {grRpx} {grRpx} 0 0 1 {gL +
						grRpx} {boreWallY} L {gR - grRpx} {boreWallY} A {grRpx} {grRpx} 0 0 1 {gR} {boreWallY +
						grRpx} L {gR} {boreIdSvgY - tRpx} A {tRpx} {tRpx} 0 0 0 {gR + tRpx} {boreIdSvgY}"
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
				<!-- Groove corner fillets (bottom, convex — metal fill at radii) -->
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
				<line x1={0} y1={boreIdSvgY} x2={gL - tRpx} y2={boreIdSvgY} class="surface-edge" />
				<line x1={gR + tRpx} y1={boreIdSvgY} x2={viewW} y2={boreIdSvgY} class="surface-edge" />
				<!-- Groove outline -->
				<path
					d="M {gL - tRpx} {boreIdSvgY} A {tRpx} {tRpx} 0 0 0 {gL} {boreIdSvgY -
						tRpx} L {gL} {boreWallY + grRpx} A {grRpx} {grRpx} 0 0 1 {gL +
						grRpx} {boreWallY} L {gR - grRpx} {boreWallY} A {grRpx} {grRpx} 0 0 1 {gR} {boreWallY +
						grRpx} L {gR} {boreIdSvgY - tRpx} A {tRpx} {tRpx} 0 0 0 {gR + tRpx} {boreIdSvgY}"
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
					d="M {gL - tRpx} {rodOdY} A {tRpx} {tRpx} 0 0 1 {gL} {rodOdY +
						tRpx} L {gL} {grooveBottomY - grRpx} A {grRpx} {grRpx} 0 0 0 {gL +
						grRpx} {grooveBottomY} L {gR -
						grRpx} {grooveBottomY} A {grRpx} {grRpx} 0 0 0 {gR} {grooveBottomY -
						grRpx} L {gR} {rodOdY + tRpx} A {tRpx} {tRpx} 0 0 1 {gR + tRpx} {rodOdY}"
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
				{@const stepX = gR + (viewW - gR) * 0.7}
				{@const stepH = (viewH - rodOdY) * 0.5}
				{@const shaftY = rodOdY + stepH}
				{@const filletR = Math.min(stepH * 0.4, 20)}
				{@const endFaceX = gL * 0.15}
				{@const endChamLen = (viewH - rodOdY) * 0.35}
				<!-- Left side: piston end face with chamfer -->
				<path
					d="M {endFaceX} {rodOdY + endChamLen} L {endFaceX +
						endChamLen} {rodOdY} L {gL} {rodOdY} L {gL} {viewH} L {endFaceX} {viewH} Z"
					fill="url(#{bottomHatch})"
					stroke="none"
				/>
				{@const sCham = filletR * 1.0}
				<!-- Right side: stepped piston (head → chamfer → shoulder → shaft) -->
				<path
					d="M {gR} {rodOdY} L {stepX - sCham} {rodOdY} L {stepX} {rodOdY +
						sCham} L {stepX} {shaftY - filletR} A {filletR} {filletR} 0 0 0 {stepX +
						filletR} {shaftY} L {viewW} {shaftY} L {viewW} {viewH} L {gR} {viewH} Z"
					fill="url(#{bottomHatch})"
					stroke="none"
				/>
				<!-- Under groove floor -->
				<rect
					x={gL}
					y={grooveBottomY}
					width={gR - gL}
					height={viewH - grooveBottomY}
					fill="url(#{bottomHatch})"
					stroke="none"
				/>
				<!-- End face -->
				<line
					x1={endFaceX}
					y1={rodOdY + endChamLen}
					x2={endFaceX}
					y2={viewH}
					class="surface-edge"
				/>
				<!-- Chamfer -->
				<line
					x1={endFaceX}
					y1={rodOdY + endChamLen}
					x2={endFaceX + endChamLen}
					y2={rodOdY}
					class="surface-edge"
				/>
				<!-- Piston head OD surface -->
				<line
					x1={endFaceX + endChamLen}
					y1={rodOdY}
					x2={gL - tRpx}
					y2={rodOdY}
					class="surface-edge"
				/>
				<line x1={gR + tRpx} y1={rodOdY} x2={stepX - sCham} y2={rodOdY} class="surface-edge" />
				<!-- Shoulder chamfer -->
				<line x1={stepX - sCham} y1={rodOdY} x2={stepX} y2={rodOdY + sCham} class="surface-edge" />
				<!-- Shoulder face -->
				<line
					x1={stepX}
					y1={rodOdY + sCham}
					x2={stepX}
					y2={shaftY - filletR}
					class="surface-edge"
				/>
				<!-- Concave fillet (inner corner) -->
				<path
					d="M {stepX} {shaftY - filletR} A {filletR} {filletR} 0 0 0 {stepX + filletR} {shaftY}"
					class="surface-edge"
					fill="none"
				/>
				<!-- Shaft surface -->
				<line x1={stepX + filletR} y1={shaftY} x2={viewW} y2={shaftY} class="surface-edge" />
				<!-- Groove corner fillets (bottom, convex — metal fill at radii) -->
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
					d="M {gL - tRpx} {rodOdY} A {tRpx} {tRpx} 0 0 1 {gL} {rodOdY +
						tRpx} L {gL} {grooveBottomY - grRpx} A {grRpx} {grRpx} 0 0 0 {gL +
						grRpx} {grooveBottomY} L {gR -
						grRpx} {grooveBottomY} A {grRpx} {grRpx} 0 0 0 {gR} {grooveBottomY -
						grRpx} L {gR} {rodOdY + tRpx} A {tRpx} {tRpx} 0 0 1 {gR + tRpx} {rodOdY}"
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
					{@const nLen = 8}
					<line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke={col} stroke-width="2" opacity="0.7" />
					<!-- Normal at start -->
					<line
						x1={sx1}
						y1={sy1}
						x2={sx1 + seg.nx * nLen}
						y2={sy1 + seg.ny * nFlip * nLen}
						stroke={col}
						stroke-width="1.5"
						opacity="0.6"
					/>
					<!-- Normal at midpoint -->
					<line
						x1={mx}
						y1={my}
						x2={mx + seg.nx * nLen}
						y2={my + seg.ny * nFlip * nLen}
						stroke={col}
						stroke-width="1.5"
						opacity="0.6"
					/>
					<circle
						cx={mx + seg.nx * nLen}
						cy={my + seg.ny * nFlip * nLen}
						r="2"
						fill={col}
						opacity="0.6"
					/>
					<!-- Normal at end -->
					<line
						x1={sx2}
						y1={sy2}
						x2={sx2 + seg.nx * nLen}
						y2={sy2 + seg.ny * nFlip * nLen}
						stroke={col}
						stroke-width="1.5"
						opacity="0.6"
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
		<!-- Status cards -->
		<div class="grid {isFace ? 'grid-cols-2' : 'grid-cols-3'} gap-2">
			{@render card('Compression', `${(sqEst * 100).toFixed(1)}%`, compColor)}
			{@render card('Stretch', `${dynamicStretch.toFixed(1)}%`, strColor)}
			{#if !isFace}
				{@render card('Chamfer depth', `${chR.toFixed(2)} mm`, chamferColor)}
			{/if}
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

		<!-- Material -->
		<div class="space-y-2">
			<p class="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">Material</p>
			{@render sliderRow(
				'Shore A',
				shoreA,
				30,
				90,
				5,
				'--chart-2',
				(v) => `${v.toFixed(0)} (${youngsE.toFixed(1)} MPa)`,
				(v) => (shoreA = v)
			)}
		</div>

		<!-- Toolbar: Reset, Debug, Settings toggle -->
		<div class="flex flex-wrap items-center gap-2">
			<button
				onclick={() => spawnRing(isFace ? -cs * 1.5 : -(chamferLength + cs))}
				class="rounded border border-border bg-background px-3 py-1 text-[10px] text-foreground hover:bg-muted"
			>
				Reset
			</button>
			<label class="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted-foreground">
				<input type="checkbox" bind:checked={showDebug} style="accent-color: var(--chart-1);" />
				Debug
			</label>
			<button
				onclick={() => (showSettings = !showSettings)}
				class="ml-auto rounded border border-border bg-background px-3 py-1 text-[10px] text-foreground hover:bg-muted"
			>
				{showSettings ? 'Hide' : 'Show'} settings
			</button>
		</div>

		<!-- Collapsible settings -->
		{#if showSettings}
			<div class="space-y-4 rounded-md border border-border bg-muted/20 p-3">
				<div class="space-y-2">
					<p class="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
						Damping
					</p>
					{@render sliderRow(
						'Particle',
						pDamp,
						0,
						0.01,
						0.001,
						'--chart-2',
						(v) => v.toFixed(3),
						(v) => (pDamp = v)
					)}
					{@render sliderRow(
						'Structural',
						structDamp,
						0,
						1.0,
						0.01,
						'--chart-2',
						(v) => v.toFixed(2),
						(v) => (structDamp = v)
					)}
					{@render sliderRow(
						'Tangential',
						tangentialDamp,
						0,
						5.0,
						0.05,
						'--chart-2',
						(v) => v.toFixed(2),
						(v) => (tangentialDamp = v)
					)}
				</div>
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
					{@render sliderRow(
						'Speed',
						simSpeed,
						0.2,
						10,
						0.2,
						'--chart-4',
						(v) => `${v.toFixed(1)}x`,
						(v) => (simSpeed = v)
					)}
				</div>
				<label class="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted-foreground">
					<input type="checkbox" bind:checked={physicsOn} style="accent-color: var(--chart-1);" />
					Physics enabled
				</label>
			</div>
		{/if}
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

{#snippet card(label: string, value: string, color: string)}
	<div class="rounded-md border border-border bg-muted/30 px-3 py-2">
		<div class="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
		<div class="mt-0.5 font-mono text-lg font-semibold" style="color: {color};">{value}</div>
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
	.seated-edge {
		stroke: var(--chart-1);
		stroke-width: 2.5px;
		opacity: 0.85;
		fill: none;
	}
	.seated-label {
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.08em;
		fill: var(--chart-1);
		opacity: 0.85;
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
