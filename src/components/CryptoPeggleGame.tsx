'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const BALL_R        = 7;
const PEG_R         = 11;
const GRAVITY       = 0.20;
const BALL_SPEED    = 11;
const MIN_SPEED     = 5.0;
const BUCKET_W      = 82;
const BUCKET_H      = 12;
const BUCKET_SPD    = 1.7;
const SHOTS_START   = 5;           // throws per game
const BALLS_PER_SHOT = 8;          // balls per throw
const BURST_INTERVAL = 4;          // frames between ball launches in a burst
const BURST_SPREAD   = 0.04;       // ±rad random wobble per ball so paths diverge
const HIT_COOL      = 4;
const WIND_MAX       = 0.013;
const BUCKET_BALL_PROB  = 0.25;          // non-lucky balls' chance of being bucket balls
const GOLD_GLOW_COLOR   = '#c8a000';    // bright gold for glow effects
const BOMB_CHANCE   = 0.08;   // blue→bomb conversion rate (level 5+)
const SPLIT_CHANCE  = 0.05;   // blue→split conversion rate (level 8+)
const MAGNET_FORCE  = 0.15;   // attraction accel per frame
const MAGNET_RANGE  = 110;    // pixels
const BH_PULL_FORCE = 0.72;   // black hole radial pull per frame
const BH_PULL_RANGE_FACTOR = 3.8; // pull range = zone.h * this
const BOMB_RADIUS   = 75;     // explosion radius
const BUMPER_FLASH  = 20;                                     // frames a bumper glows after hit
const FLASH_COLORS  = ['#f07a6a','#f4a84a','#f5d46a','#d4c86a','#f4b88a','#e88888','#d48aaa'] as const;
const WORMHOLE_CYCLE  = 210;  // frames per full appear/disappear cycle
const WORMHOLE_ACTIVE = 140;  // frames of active (visible) phase
const WORMHOLE_FADE   = 20;   // frames for fade-in and fade-out
const CHAIN_HP_BASE   = 5;    // weak-point HP at level 10
const CHAIN_HP_MAX    = 10;   // hard cap
const STUCK_FRAMES    = 220;  // frames without downward progress before rescue
const STUCK_PROGRESS  = 35;   // px of downward advance that resets the stuck timer
const BUMPER_DN_BIAS  = 1.2;  // vy added after bumper hit when ball is moving upward
const WIND_STORM      = 0.040; // strong storm wind force (level 12+)
const WIND_NARROW_MULT = 2.0;  // narrow zone: force multiplier vs wide
const WIND_NARROW_FRAC = 0.38; // narrow zone: width as fraction of W
const FREEZE_DUR       = 120;  // frames the freeze effect lasts
const FREEZE_SLOW      = 0.55; // speed multiplier on freeze hit
const LIGHTNING_RANGE  = 140;  // max cascade px distance for lightning peg
const SHIELD_HP        = 2;    // hits to clear a shield peg
const MUD_SLOW         = 0.14; // mud peg: speed multiplier on hit (nearly stops the ball)
const MUD_DUR          = 90;   // frames the mud slow (min-speed suppression) lasts
const MUD_REVIVE       = 22;   // frames of the mud "reform" animation after revival

// ── Deep-space hazards (pulsar lv24 / gravitational wave lv27 / vacuum decay lv29) ──
const PULSAR_FORCE     = 0.50;  // radiation-pressure accel at the core, decays along the beam
const PULSAR_BEAM_LEN  = 150;   // base beam length px (grows with level)
const PULSAR_BEAM_HALF = 10;    // beam half-thickness px (physics; visuals scatter to match)
const PULSAR_ROT       = 0.009; // beam rotation rad/frame
const GW_SPEED         = 5.5;   // wavefront expansion px/frame
const GW_BAND          = 26;    // half-thickness of the wavefront band px
const GW_BEND          = 0.055; // velocity rotation rad/frame while the wavefront passes
const VAC_R0           = 26;    // vacuum bubble spawn radius
const VAC_ANTIGRAV     = 1.5;   // inside the bubble: vy -= effGrav * this (net 0.5x upward)
const VAC_RESPAWN      = 110;   // frames between pop and regrowth
const WH_PUSH          = 0.55;  // white hole radial repulsion at the core (decays t*t), scales w/ level
const WH_RANGE         = 140;   // white hole push range px
const MAG_FORCE        = 1.6;   // magnetar flare outward impulse at the core (decays t*t)
const MAG_RANGE        = 170;   // magnetar flare radius px
const MAG_RELEASE      = 6;     // frames the flare pushes balls
const MAG_WARN         = 40;    // telegraph frames before a flare fires
const RP_PULL          = 0.35;  // rogue planet attraction at the core (decays t*t)
const RP_RANGE         = 130;   // rogue planet attraction range px
const RP_R             = 22;    // rogue planet solid bounce-body radius px
const QJ_HALF          = 16;    // quasar jet column half-width px
const QJ_FAN           = 0.12;  // quasar jet sideways spray (guarantees no vertical trap)
const MBH_PULL         = 0.5;   // micro BH attraction at the core (decays t*t)
const MBH_EVAP_FORCE   = 2.0;   // micro BH evaporation repulsion burst
const MBH_EVAP_RANGE   = 130;   // micro BH evaporation burst range px
const DM_RANGE         = 160;   // dark matter halo attraction range px
const DM_PULL          = 0.30;  // dark matter halo base attraction (decays t*t, +ramp to 0.60)
const ERGO_R0          = 45;    // ergosphere inner ring radius px
const ERGO_R1          = 95;    // ergosphere outer ring radius px
const ERGO_DRAG        = 0.5;   // ergosphere tangential drag at band centre (decays t*t, +ramp to 1.0)
const MR_HALF          = 14;    // magnetic reconnection line half-width px
const MR_HALFLEN       = 100;   // magnetic reconnection line half-length px
const MR_FORCE         = 1.4;   // magnetic reconnection snap ejection force at the crossing (decays t*t)
const MR_RELEASE       = 8;     // frames the snap ejects balls
const MR_WARN          = 30;    // telegraph frames before a snap
const SN_R_MIN         = 14;    // pre-supernova star min (post-collapse) bounce radius px
const SN_R_MAX         = 30;    // pre-supernova star max (pre-boom) bounce radius px
const SN_BOOM          = 12;    // frames the explosion shockwave pushes balls
const SN_SHRINK        = 20;    // frames the post-boom collapse fade takes
const SN_BOOM_RANGE    = 180;   // explosion outward-push range px
const SN_BOOM_FORCE    = 2.2;   // explosion outward-push force at the core (decays t*t)
const SN_WARN          = 45;    // telegraph frames before the boom (surface flecks + fast pulse)
const TS_RANGE         = 120;   // tidal stretch field range px
const TS_K_BASE        = 0.030; // tidal stretch base strength (ramps to 0.05 cap)
const TACHYON_ACCEL     = 0.35; // tachyon stream band acceleration (constant, clamped to BALL_SPEED*2)
const TACHYON_WIDTH_BASE = 60;  // tachyon stream base full band width px (grows with level)
const TACHYON_WIDTH_MAX  = 150; // tachyon stream full band width cap px
const VOID_RX_BASE      = 110;  // cosmic void base horizontal radius px
const VOID_RY_BASE      = 80;   // cosmic void base vertical radius px
const VOID_RX_MAX       = 150;  // cosmic void horizontal radius cap px
const VOID_RY_MAX       = 110;  // cosmic void vertical radius cap px
const VOID_DRAG         = 0.995; // cosmic void per-frame velocity drag
const AXION_W           = 110;  // axion wall length px
const AXION_H           = 14;   // axion wall thickness px
const AXION_SOLID       = 90;   // frames the wall is solid (collidable)
const AXION_GONE        = 120;  // frames the wall is fully intangible
const AXION_FADE        = 20;   // frames each materialize/dematerialize transition takes
const FRB_WARN          = 45;   // telegraph frames before a burst
const FRB_ANGLE         = 0.30; // FRB burst velocity-rotation angle (rad), sign randomized per fire
const FRB_RING_RANGE    = 130;  // FRB burst ring max radius px (visual only)
const AF_R              = 8;    // antimatter fleck radius px
const AF_SPEED          = 0.3;  // antimatter fleck drift speed px/frame
const AF_RESPAWN        = 30;   // frames a fleck stays gone after annihilating a ball
const AF_FADE           = 20;   // frames of the reform fade-in (tail end of AF_RESPAWN)
const QB_W              = 120;  // quantum tunneling barrier length px
const QB_H              = 12;   // quantum tunneling barrier thickness px
const QB_FLASH_DUR       = 9;   // frames the "solidify" flash lasts after a reflect
const TD_RADIUS          = 90;  // time dilation field radius px
const TD_SLOW            = 0.5; // time dilation speed multiplier on entry (halved in, doubled out)
const CS_LENGTH          = 180;  // cosmic string length px
const CS_HALFWIDTH       = 3;    // cosmic string collision half-width px (line thickness/2)
const CS_SHIFT_BASE      = 14;   // cosmic string base parallel-shift distance px (+1px per level over 48)
const CS_SHIFT_MAX       = 60;   // cosmic string shift distance cap px
const CS_GLINT_PERIOD    = 600;  // frames between glint traversals of the line
const CS_GLINT_SPEED     = 8;    // glint travel speed px/frame
const DE_RANGE           = 130;  // dark energy patch field range px
const DE_H_BASE          = 0.0022; // dark energy patch base "Hubble constant" (force = h * dist)
const DE_H_PER_LV        = 0.0001; // dark energy patch Hubble constant growth per level over 49
const DE_H_MAX           = 0.006;  // dark energy patch Hubble constant cap
const DE_LOOP_PERIOD     = 120;  // frames per expand-and-reset grid animation loop
const GTS_RADIUS_MIN     = 150;  // galactic tidal stream arc radius min px
const GTS_RADIUS_MAX     = 220;  // galactic tidal stream arc radius max px
const GTS_ARC_SPAN       = (100 * Math.PI) / 180; // galactic tidal stream arc angular span (rad)
const GTS_BAND_HALF      = 26;   // galactic tidal stream band half-width px
const GTS_FLOW_BASE      = 0.28; // galactic tidal stream base tangential force
const GTS_FLOW_PER_LV    = 0.01; // galactic tidal stream force growth per level over 51
const GTS_FLOW_MAX       = 0.50; // galactic tidal stream force cap
const GTS_STAR_COUNT     = 36;   // galactic tidal stream visual star-dot count
const GTS_STAR_SPEED     = 1.4;  // galactic tidal stream visual flow speed px/frame along the arc
const EMR_R              = 60;   // einstein mirror ring radius px (fixed, not level-scaled)
const EMR_HALFWIDTH      = 4;    // einstein mirror ring collision half-width px
const EMR_SHOCK_DUR      = 8;    // frames the crossing-point shockwave expands
const EMR_SHOCK_MAX_R    = 22;   // shockwave max radius px
const NS_RANGE           = 110;  // naked singularity field range px
const NS_FORCE           = 0.9;  // naked singularity force scale (fixed, not level-scaled)
const NS_RADIAL_BIAS     = 0.2;  // naked singularity constant outward mix (guarantees ejection)
const NS_FREEZE_PERIOD   = 90;   // frames between the "law of physics breaks" freeze frames
const HVS_SPEED_BASE     = 6.5;  // hypervelocity star base traversal speed px/frame (faster than any comet)
const HVS_SPEED_PER_LV   = 0.1;  // hypervelocity star speed growth per level over 54
const HVS_SPEED_CAP      = 3.0;  // hypervelocity star speed growth cap
const HVS_WAKE_LEN       = 120;  // hypervelocity star trailing wake length px
const HVS_WAKE_HALF      = 30;   // hypervelocity star trailing wake half-width px
const HVS_WAKE_FORCE     = 0.5;  // hypervelocity star wake drag force scale
const RBH_RANGE          = 120;  // rogue black hole pull range px
const RBH_FORCE          = 0.6;  // rogue black hole pull force scale
const RBH_ABSORB_R       = 10;   // rogue black hole absorption radius px
const RBH_LISS_AX        = 70;   // rogue black hole Lissajous drift amplitude x px
const RBH_LISS_AY        = 45;   // rogue black hole Lissajous drift amplitude y px
const RBH_LISS_FX        = 0.006;  // rogue black hole Lissajous drift frequency x
const RBH_LISS_FY        = 0.0043; // rogue black hole Lissajous drift frequency y
const ORC_R_MIN          = 60;   // odd radio circle min (respawn) radius px
const ORC_R_MAX          = 260;  // odd radio circle max radius px before it fades
const ORC_GROW_FRAMES    = 900;  // frames to expand from ORC_R_MIN to ORC_R_MAX
const ORC_BAND_HALF      = 18;   // odd radio circle collision band half-width px
const ORC_FORCE          = 0.35; // odd radio circle outward push force scale
const ORC_FADE_DUR       = 20;   // frames the full ring takes to fade out at max radius
const ORC_RECONDENSE_DUR = 20;   // frames the point cloud takes to converge back to center
const ORC_LIT_DUR        = 10;   // frames a crossed arc segment stays brightly lit
const ORC_LIT_BINS       = 12;   // number of 30°-wide arc segments around the ring (±15°)
const TDE_RANGE          = 130;  // tidal disruption event field range px
const TDE_TAN_FORCE      = 0.4;  // tidal disruption event tangential (in-winding) force scale
const TDE_INWARD_FORCE   = 0.15; // tidal disruption event radial inward pull scale
const TDE_JET_R          = 30;   // tidal disruption event jet-ejection radius px
const TDE_JET_VY         = 1.3;  // tidal disruption event forced upward jet accel per frame
const TDE_JET_VX_DAMP    = 0.9;  // tidal disruption event horizontal drift damping while jetting
const DF_ACCEL_BASE      = 0.012; // dark flow base per-frame drift accel (all balls, board-wide)
const DF_ACCEL_PER_LV    = 0.001; // dark flow accel growth per level over 58
const DF_ACCEL_MAX       = 0.03;  // dark flow accel cap
const DF_ANGULAR_SPEED   = 0.0004; // dark flow direction rotation rad/frame
const DF_BG_BIAS         = 0.05;  // dark flow background-dot drift bias px/frame
const GA_FORCE           = 0.22;  // great attractor pull strength scale
const GA_OFFSCREEN_X     = 140;   // great attractor source distance off-screen px
const GA_BREATHE_FREQ    = 0.01;  // great attractor breathing-coefficient frequency
const BC_GAS_R           = 26;    // bullet cluster gas blob collision radius px
const BC_DM_LAG          = 60;    // bullet cluster dark-matter blob lead distance ahead of gas blob px
const BC_DM_RANGE        = 110;   // bullet cluster dark-matter blob pull range px
const BC_DM_FORCE        = 0.3;   // bullet cluster dark-matter blob pull force scale
const BC_SPEED_BASE      = 3.2;   // bullet cluster traversal speed base px/frame
const BC_SPEED_PER_LV    = 0.05;  // bullet cluster speed growth per level over 61
const BC_SPEED_CAP       = 1.5;   // bullet cluster speed growth cap
const BAO_RADII          = [55, 110, 165]; // baryon acoustic oscillation ring base radii px
const BAO_BAND_HALF      = 14;    // baryon acoustic oscillation force band half-width px
const BAO_FORCE          = 0.18;  // baryon acoustic oscillation peak pull force (t*t taper within band)
const BAO_BREATHE_AMP    = 6;     // baryon acoustic oscillation ring breathing amplitude px
const BAO_BREATHE_FREQ   = 0.008; // baryon acoustic oscillation ring breathing frequency
const BAO_LIT_BINS       = 12;    // baryon acoustic oscillation lit-arc bin count per ring
const BAO_LIT_DUR        = 10;    // baryon acoustic oscillation lit-arc fade duration frames
const LB_HALF_WIDTH      = 30;    // laniakea basin streamline band half-width px
const LB_FORCE           = 0.25;  // laniakea basin tangential force scale
const LB_STREAM_PTS      = 24;    // laniakea basin streamline polyline point count
const LB_DOT_COUNT       = 14;    // laniakea basin flowing dots per streamline
const LB_DOT_SPEED       = 0.8;   // laniakea basin dot flow speed px/frame
const GWB_BASE_AMP       = 0.003;  // gravitational wave background base rotation amplitude rad
const GWB_AMP_PER_LV     = 0.0004; // gravitational wave background amplitude growth per level over 64
const CB_LEN             = 200;   // cosmic birefringence sheet length px
const CB_THICK           = 90;    // cosmic birefringence sheet thickness px
const CB_ROT             = 0.22;  // cosmic birefringence crossing rotation rad
const CB_FADE_DUR        = 10;    // cosmic birefringence crossing marker fade duration frames
const LRD_R              = 6;     // little red dot collision radius px
const LRD_ON_FRAMES      = 120;   // little red dot lit duration frames
const LRD_OFF_FRAMES     = 90;    // little red dot unlit duration frames
const LRD_FADE           = 12;    // little red dot fade-in/out duration frames
const LRD_PULL_RANGE     = 60;    // little red dot pull range px (while lit)
const LRD_PULL_FORCE     = 0.25;  // little red dot pull force scale (while lit)
const PBH_RANGE          = 70;    // primordial black hole pull range px
const PBH_FORCE          = 0.30;  // primordial black hole pull force scale
const PBH_MIN_DIST       = 120;   // primordial black hole minimum spacing between points px
const PBH_SHIMMER_PERIOD = 140;   // primordial black hole shimmer cycle length frames
const PBH_SHIMMER_DUR    = 3;     // primordial black hole shimmer visible duration frames
const DS_R_CORE          = 40;    // dark star interior-drag radius px
const DS_R_SHELL         = 60;    // dark star shell (radiation-pressure) outer radius px
const DS_R_VISUAL        = 48;    // dark star visual body radius px
const DS_DRAG            = 0.99;  // dark star interior velocity drag per frame
const DS_SHELL_FORCE     = 0.30;  // dark star shell outward radiation pressure peak force
const CMB_FORCE          = 0.020; // CMB anisotropy vertical force scale (hot=up, cold=down)
const CMB_DOT_SPACING    = 22;    // CMB anisotropy baked-dot grid spacing px
const CMB_ALPHA_MAX      = 0.10;  // CMB anisotropy peak dot alpha (cream ground must stay visible)
const HP_RING_R          = 40;    // hawking point ghost-ring radius px
const HP_RANGE           = 120;   // hawking point warmth-pulse radius px
const HP_FORCE           = 0.8;   // hawking point outward pulse force scale
const HP_RELEASE         = 10;    // hawking point pulse duration frames
const HP_WARN            = 30;    // hawking point pre-pulse telegraph frames
const HP_BLINK_OFF       = 2;     // hawking point full-blackout frames just before pulse
const CDA_RADIUS         = 90;    // cosmic dark ages ball-light radius px
const CDA_VEIL_ALPHA     = 0.85;  // cosmic dark ages veil opacity
const CDA_FADE_IN        = 30;    // cosmic dark ages veil fade-in frames at level start
const CDA_GHOST_DUR      = 20;    // cosmic dark ages afterglow duration when a ball exits
const QF_RANGE           = 100;   // quantum foam region radius px
const QF_ROT_AMP         = 0.03;  // quantum foam per-frame velocity rotation amplitude rad
const FW_R               = 80;    // black hole firewall arc radius px
const FW_SPAN            = Math.PI * 2 / 3; // black hole firewall central angle (120°)
const FW_HALFWIDTH       = 5;     // black hole firewall collision half-width px
const FW_SCRAMBLE        = 0.6;   // black hole firewall post-bounce direction scramble rad
const FW_HIT_COOL        = 8;     // black hole firewall hit cooldown frames
const FW_FLASH_DUR       = 3;     // black hole firewall hit-flash duration frames
const SR_RANGE           = 120;   // superradiance pull range px
const SR_PULL            = 0.4;   // superradiance radial attraction force scale
const SR_TAN_ACCEL       = 0.10;  // superradiance constant tangential acceleration
const SR_WAVE_DUR        = 12;    // superradiance amplification-wave duration frames
const SR_SPIN_DECAY      = 0.98;  // superradiance spin multiplier per emitted wave
const SR_SPIN_FLOOR      = 0.5;   // superradiance minimum spin multiplier
const NMB_RANGE          = 100;   // negative mass blob repulsion range px
const NMB_FORCE          = 0.45;  // negative mass blob outward push force scale
const NMB_CHASE          = 0.6;   // negative mass blob chase speed px/frame
const NMB_R_VISUAL       = 22;    // negative mass blob outline radius px
const BUC_RANGE          = 150;   // bubble-universe collision region radius px
const BUC_GRAV_SCALE     = 0.85;  // bubble-universe gravity magnitude multiplier
const BUC_TILT           = 18 * Math.PI / 180; // bubble-universe gravity tilt rad (±)
const BUC_EDGE_FLASH     = 10;    // bubble-universe entry/exit arc flash frames
const BUC_BALL_FLASH     = 2;     // bubble-universe ball chromatic-aberration frames
const BR_PERIOD          = 400;   // big-rip precursor seconds between expansion events frames
const BR_EVENT_DUR       = 20;    // big-rip expansion event duration frames
const BR_WARN            = 30;    // big-rip tear telegraph frames before event
const BR_H0              = 0.004; // big-rip initial Hubble-like expansion coeff
const BR_H_GROW          = 1.15;  // big-rip H multiplier per event
const BR_H_CAP           = 3;     // big-rip H multiplier cap (relative to BR_H0)
const CCC_BAND_H         = 20;    // conformal cyclic boundary band height px (below bucket)
const CCC_GOLD_DUR       = 10;    // conformal cyclic rebirth gold afterglow frames
const NOTHING_RANGE      = 110;   // the nothing region radius px

// ── Boss (re-armor boss, every 10th level) ──────────────────────────────────
const BOSS_R           = 30;   // core hit radius
const BOSS_HP_BASE     = 12;   // core HP at the first boss (level 10)
const BOSS_HP_PER_TIER = 5;    // extra HP per boss tier (each +10 levels)
const BOSS_ARMOR_COUNT = 8;    // shield pegs ringing the core
const BOSS_HIT_COOL    = 6;    // frames between core damage ticks

// ─── Seeded RNG (mulberry32) ──────────────────────────────────────────────────
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
// cosP/sinP = cos/sin(phase); cosP2/sinP2 = cos/sin of the dot family's secondary jitter phase
// (phase*1.27 for makeDot dots, phase*1.3 for wormhole aura dots). Precomputed once so the
// per-frame jitter sin(fK + phase) decomposes to sin(fK)*cosP + cos(fK)*sinP — no per-dot trig
// in the render loop. The identity is mathematically exact (FP differs at ~1 ulp), so the
// rendered output is perceptually identical.
interface Dot { x: number; y: number; size: number; alpha: number; phase: number; cosP: number; sinP: number; cosP2: number; sinP2: number }
interface BgDot { x: number; y: number; vx: number; vy: number; size: number; alpha: number; targetAlpha: number; age: number; maxAge: number }
interface BurstP  { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color?: string }
interface Burst   { particles: BurstP[] }
interface BreakP  { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }
interface PegBreak { particles: BreakP[] }
interface TrajPt  { x: number; y: number }
interface GravZone { x: number; y: number; w: number; h: number; flashTimer: number }
interface Comet { x: number; y: number; vx: number; vy: number; r: number; hitCool: number; respawnTimer: number; warnFromLeft: boolean; warnY: number; vanish: boolean; hitFlash: number; hitX: number; hitY: number }
interface Lens  { x: number; y: number; r: number; dir: 1 | -1; strength: number }
// Pulsar (lv24+): fixed neutron star whose twin radiation beams sweep like a lighthouse.
interface Pulsar { x: number; y: number; angle: number; rotSpeed: number; beamLen: number }
// Gravitational wave (lv27+): periodic ripple ring expanding from a distant merger.
// radius = -1 while dormant (timer counts down to the next wave).
interface GravWave { ex: number; ey: number; radius: number; timer: number; period: number; dir: 1 | -1 }
// Vacuum decay bubble (lv29+): slowly expanding true-vacuum sphere; gravity flips inside.
interface VacuumBubble { x: number; y: number; r: number; rMax: number; grow: number; respawnTimer: number; popFlash: number }
// White hole (lv23+): the time-reverse of a black hole — a pure radial repulsion, no absorption.
interface WhiteHole { x: number; y: number; strength: number }
// Magnetar (lv31+): neutron star that periodically flares, shoving every nearby ball outward.
// timer counts down to the next flare; releaseTimer > 0 means a flare is currently firing.
interface Magnetar { x: number; y: number; period: number; timer: number; releaseTimer: number }
// Rogue planet (lv32+): a starless world drifting across the field — a moving gravity well
// with a solid bounce body. It never stops, so its pull can never form a stable trap.
interface RoguePlanet { x: number; y: number; vx: number; vy: number; r: number; hitCool: number; ringTilt: number }
// Quasar jet (lv33+): a fixed plasma column that accelerates balls along its axis. A small
// sideways spray guarantees balls are ejected out the sides, so an up-jet can't hold a ball.
interface QuasarJet { bx: number; y0: number; y1: number; dir: 1 | -1; accel: number }
// Evaporating micro black hole (lv34+): a tiny BH that pulls (weakening as it shrinks), then
// evaporates in a repulsion burst and re-forms at another spot. No absorption → no trap.
interface MicroBH { x: number; y: number; life: number; maxLife: number; evap: number; dormant: number; spots: { x: number; y: number }[]; spotIdx: number }
// Dark matter halo (lv35+): a nearly invisible attraction source. Only a faint periodic
// shimmer betrays its position — otherwise you feel it only as the ball's path bending.
interface DarkHalo { x: number; y: number; strength: number; shimmer: number }
// Ergosphere (lv36+): a rotating BH's frame-dragging region — a ring band (r0..r1) where
// spacetime itself is dragged one way. Only balls inside the band feel a one-way tangential
// drag; the centre (a static, non-rotating core) and the outside are inert.
interface Ergosphere { x: number; y: number; r0: number; r1: number; strength: number; dir: 1 | -1 }
// Magnetic reconnection (lv37+): an X of two crossed field lines that's inert most of the
// time — it snaps periodically, ejecting balls outward along whichever line they're on.
// timer counts down to the next snap; releaseTimer > 0 means a snap is currently firing.
interface MagReconnection { x: number; y: number; angle: number; period: number; timer: number; releaseTimer: number }
// Pre-supernova star (lv38+): a solid bounce body that swells (r: 14→30) over its cycle,
// then explodes in an outward shockwave and collapses back to its minimum radius. The
// bounce radius always matches what's drawn, so "bigger = more dangerous" reads fairly.
interface PreSupernova { x: number; y: number; hitCool: number; hitFlash: number; period: number; timer: number; boomTimer: number; shrinkTimer: number }
// Tidal stretch field (lv39+): decomposes ball velocity into radial/tangential components
// and "combs" it toward the radial axis (amplify radial, damp tangential). Static, always on.
interface TidalStretch { x: number; y: number; strength: number }
// Tachyon stream (lv41+): a fixed diagonal band that accelerates any ball inside it along
// the band's direction (clamped to BALL_SPEED*2). Fully passable — no perpendicular bound.
interface TachyonStream { x: number; y: number; angle: number; halfWidth: number }
// Cosmic void (lv42+): a near-empty elliptical patch of low gravity + faint drag. Gravity
// is only halved (never zero), so a ball always sinks out eventually.
interface CosmicVoid { x: number; y: number; rx: number; ry: number }
// Axion phase wall (lv43+): an OBB membrane that cycles gone → fadeIn → solid → fadeOut →
// gone. Only the 'solid' phase collides (bumper-style reflection); the rest is intangible.
interface AxionWall { x: number; y: number; angle: number; phase: 'gone' | 'fadeIn' | 'solid' | 'fadeOut'; timer: number; hitCool: number; hitFlash: number }
// FRB source (lv44+): a fixed edge emitter that periodically rotates every ball's velocity
// by a fixed angle in one instant (speed-preserving, board-wide). burstAge drives the
// staggered ring visual after a fire; fired is true for exactly the firing frame.
interface FRBSource { x: number; y: number; period: number; timer: number; fireAngle: number; fired: boolean; burstAge: number }
// Antimatter fleck (lv45+): a slow drifting micro-mine that annihilates any ball it touches,
// then goes dormant for AF_RESPAWN frames (fading back in over the last AF_FADE of those)
// before reforming at a new position — never a repeat kill-camp spot.
interface AntimatterFleck { x: number; y: number; vx: number; vy: number; r: number; respawnTimer: number; gammaFlash: number }
// Quantum tunneling barrier (lv46+): an OBB that rolls a fresh 50/50 on first contact —
// reflect (bumper-style) or pass clean through. passingBalls locks the outcome per ball
// until it fully leaves the zone, so it can't re-roll mid-overlap.
interface QuantumBarrier { x: number; y: number; angle: number; reflectFlash: number; passingBalls: WeakSet<Ball> }
// Time dilation field (lv47+): a static circular field. Crossing the boundary halves the
// ball's speed (and doubles it back on exit); the per-ball `dilated` flag (on Ball) detects
// the transition so the impulsive speed change fires exactly once per crossing.
interface TimeDilation { x: number; y: number }
// Cosmic string (lv48+): an extremely thin (1px) relic line from an early-universe phase
// transition. Crossing it doesn't bounce the ball — it instantly shifts the ball a fixed
// distance along the line's own axis (velocity unchanged), like a miniature wormhole
// confined to translating along one line. dir is the fixed shift direction (chosen at gen).
// passingBalls locks the shift to fire once per crossing (cleared on exit) rather than a
// shared cooldown timer — a shift moves the ball only along the line's own axis, so a ball
// gliding near-parallel to the string can linger inside the same OBB for many frames; a
// shared hitCool would re-trigger it repeatedly (and block other balls meanwhile).
interface CosmicString {
  x: number; y: number; angle: number; dir: 1 | -1; shift: number;
  hitFlash: number; ghostFlash: number;
  ghostOldX: number; ghostOldY: number; ghostNewX: number; ghostNewY: number;
  passingBalls: WeakSet<Ball>;
}
// Dark energy patch (lv49+): a field whose push grows *with* distance rather than decaying —
// the exact inverse profile of the white hole (near-inert at the core, strongest at the range
// edge). h is this patch's per-level "Hubble constant" (force = h * dist, capped by DE_H_MAX).
interface DarkEnergyPatch { x: number; y: number; h: number; grid: { x: number; y: number }[] }
// Galactic tidal stream (lv51+): a river of stars flowing along a fixed arc — a bent version
// of the CME sweep. Balls inside the band (|dist-radius| < GTS_BAND_HALF) and within the
// arc's angular span get a one-way tangential push; there's no radial pull, so a ball just
// rides the current and is released once it drifts past the arc's end or off the band.
interface GalacticTidalStream { cx: number; cy: number; radius: number; angleStart: number; dir: 1 | -1; flow: number }
// Einstein mirror ring (lv52+): a thin ring line whose crossing mirror-reflects the ball's
// velocity about the ring's local tangent — normal (radial) component kept, tangential
// component flipped (v' = 2(v·n̂)n̂ - v), which preserves speed exactly. Unlike a peg/bumper's
// full normal-flip bounce, the ball keeps crossing in the same radial direction afterward.
// passingBalls locks the reflection to once per crossing (cleared on exit) — same rationale
// as the cosmic string: a ball grazing near-tangentially could otherwise linger in the thin
// band and re-trigger every few frames instead of firing once.
interface EinsteinMirrorRing {
  x: number; y: number;
  hitFlash: number; shockTimer: number; shockX: number; shockY: number;
  ghostFlash: number; ghostX: number; ghostY: number;
  passingBalls: WeakSet<Ball>;
}
// Naked singularity (lv53+): the rarest hazard at the galaxy's edge — a horizon-less point
// where the force direction itself flips chaotically with angle and time
// (sign = sin(3*theta + frame*0.02)), with a cubic core falloff (fiercest near the center)
// and a constant outward bias mixed in so the ball is always eventually ejected — no
// absorption, no trap, despite looking lawless. spinAngle is a persisted integral of the
// visual ring's oscillating rotation rate (see the draw block) — using frame directly as a
// substitute would make the apparent spin rate drift unboundedly at high frame counts.
interface NakedSingularity { x: number; y: number; spinAngle: number }
// Hypervelocity star (lv54+): a comet-like traveler that crosses and exits — reusing the
// comet's warn/traverse/respawn state machine — but with no solid body: it never bounces off
// a ball. Instead, a trailing gravitational wake drags any ball caught in it toward the
// star's direction of travel. The wake always exits the screen together with the star, so it
// can never linger indefinitely (its horizontal direction never reverses, guaranteeing exit).
interface HyperStar { x: number; y: number; vx: number; vy: number; respawnTimer: number; warnFromLeft: boolean; warnY: number }
// Bullet Cluster (lv61+): Zone B's first gimmick — a horizontally-traveling pair. An
// invisible dark-matter blob (continuous radial pull, never collides) leads BC_DM_LAG px
// AHEAD of a visible, hot gas blob (solid-bounce collision, no pull) that trails behind —
// mirroring the real Bullet Cluster, where dark matter passed through the collision
// unimpeded while the gas clouds collided and lagged. Only the gas blob's own state (x/vx/
// warnY as its fixed travel Y) is tracked; the DM blob's position is derived each frame as an
// offset ahead of the gas blob along the direction of travel, so a ball's trajectory bends in
// "empty space" first, then the visible blob's bounce arrives moments later. Purely
// horizontal (no vertical bounce) — reuses the HVS warn/traverse/respawn state machine.
interface BulletCluster { x: number; vx: number; hitCool: number; hitFlash: number; hitX: number; hitY: number; respawnTimer: number; warnFromLeft: boolean; warnY: number }
// Baryon Acoustic Oscillation (lv62+): three static concentric rings (the frozen sound waves
// of the early universe) at fixed base radii, each gently "breathing" ±BAO_BREATHE_AMP px out
// of phase with the others (120° apart) so the pulse visibly travels inward-to-outward. A
// ball within BAO_BAND_HALF px of a ring's current (breathing) radius is pulled toward that
// ring line — inward if outside it, outward if inside — never tangentially, so a ball can
// always roll free along the ring and eventually leave. litBins tracks, per ring, which 30°
// arc segment last felt contact (for the "only glows where you touched it" visual).
interface BaryonOscillation { x: number; y: number; litBins: number[][] }
// Laniakea Basin (lv63+): three curved streamline bands (quadratic-Bezier polylines,
// precomputed once at generation time so physics and draw always agree on the exact same
// path) converging on one shared sink point at a screen edge. A ball inside a band feels a
// purely tangential current toward the sink — the sink itself has no pull, so reaching it is
// just a normal wall-bounce, never an absorption or trap.
interface LaniakeaStream { pts: { x: number; y: number }[]; len: number }
// Cosmic Birefringence (lv65+): a tilted rectangular sheet (200x90) a ball passes freely
// through — no bounce, no force while inside. The moment it exits the FAR side, its velocity
// rotates by a fixed, direction-dependent angle: +0.22rad front-to-back, -0.22rad back-to-
// front (deterministic, speed-preserving). Uses Ball.bfSide (0 = not currently tracked/
// outside any sheet, else the sign of the sheet-local perpendicular coordinate the ball was
// last seen on) rather than a WeakSet, since Ball already carries a similar flag pattern for
// Time Dilation (`dilated`) and only one sheet is expected to matter to a given ball at once.
interface CosmicBirefringence { x: number; y: number; angle: number; hitFlash: number; hitX: number; hitY: number; hitAngle: number }
// Little Red Dot (lv71+): Zone C's first gimmick — a stationary tiny red dot that blinks on
// its own independent cycle (120f lit / 90f unlit, offset by a per-dot random `phase`). Only
// real while lit: solid bounce + weak pull, exactly like a miniature stationary comet+black-
// hole pair. Completely pass-through while unlit — that periodic dark window is the hazard's
// own release valve, so it can never trap a ball.
interface LittleRedDot { x: number; y: number; phase: number; hitCool: number; hitFlash: number; hitX: number; hitY: number }
// Primordial Black Hole (lv72+): several tiny, invisible, always-on weak attraction points
// scattered like a constellation (unlike the single large Dark Matter Halo, this is many
// small ones tugging at once) — a ball is caught in a multi-point tug-of-war and always
// eventually slips out between them. Each point periodically flashes a single 1px shimmer on
// its own offset phase, so points never all reveal themselves at once.
interface PrimordialBH { x: number; y: number; phase: number }
// Dark Star (lv73+): the session's first non-bouncing massive body — a huge soft "field"
// sphere with no solid boundary at all. A ball can freely pass through; the interior
// (dist<DS_R_CORE) just drags and slows it (cosmic-void-style effMinSpeed suppression, no
// gravity change), while the shell band (DS_R_CORE..DS_R_SHELL) pushes outward. Gravity
// stays fully active throughout, so a ball that sinks in is always eventually pushed back
// out and falls through — no absorption, no trap.
interface DarkStar { x: number; y: number }
// CMB Anisotropy (lv74+): a board-wide temperature map that gently lifts balls in hot
// spots and sinks them in cold spots (vy -= CMB_FORCE * T). The mottled warm/cool dots are
// baked once at generation; each frame only modulates their alpha in phase with T — no
// moving elements, just the quiet shimmer of the oldest light in the universe.
interface CmbDot { x: number; y: number; T: number }
interface CmbAnisotropy { phi1: number; phi2: number; phi3: number; dots: CmbDot[] }
// Hawking Point (lv75+): a nearly invisible ghost ring — the claimed CMB scar of a black
// hole that evaporated in a previous aeon (Penrose CCC). Idle = completely powerless.
// Every ~300f it fires a 10f "warmth pulse" that shoves nearby balls outward (magnetar-
// style impulsive repulsion). Never placed alongside other ring hazards (ORC / grav wave).
interface HawkingPoint { x: number; y: number; period: number; timer: number; releaseTimer: number }
// Cosmic Dark Ages afterglow: a shrinking light hole left where a ball just exited,
// so the veil closes over 20f instead of snapping shut.
interface CdaGhost { x: number; y: number; timer: number; vx: number; vy: number }
// Quantum Foam (lv81+): a region where spacetime itself jitters. Inside R=QF_RANGE the ball's
// velocity is rotated by a tiny deterministic noise each frame (speed-preserving random walk),
// and the ball's *drawn* position snaps to a 2px grid (real coords stay continuous) — spacetime
// pixelating at the Planck scale.
interface QuantumFoam { x: number; y: number }
// Black Hole Firewall (lv83+): a burning arc barrier at the event horizon. Contact reflects
// the ball (radial normal) then scrambles its heading by ±FW_SCRAMBLE (hash-peg style) so
// the bounce angle can never be trusted. Arc (not a closed ring) so it can never enclose.
interface Firewall {
  x: number; y: number;
  angle0: number; // arc start angle (central angle = FW_SPAN)
  hitCool: number; hitFlash: number;
}
// Superradiance / BH Bomb (lv85+): attraction + constant tangential acceleration so a ball
// that falls in speeds up as it orbits and is centrifugally flung out — capture is
// structurally impossible. Each orbit emits a white amplification wave that also slows
// the vortex's spin (energy stolen from the BH). Distinct from Ergosphere (#7): has pull
// AND accelerates.
interface Superradiance {
  x: number; y: number;
  dir: 1 | -1;
  spinMult: number;       // current spin rate multiplier (decays toward SR_SPIN_FLOOR)
  waveTimer: number;      // >0 while an amplification wave is expanding
  waveX: number; waveY: number; // wave origin (ball position at emit)
  occupied: boolean;      // true this frame if any ball is inside (drives visual spin-up)
  prevBallAng: WeakMap<Ball, number>; // last polar angle per ball (orbit-crossing detect)
}
// Negative Mass Blob (lv87+): a chasing repulsion source with no solid body. It seeks the
// nearest ball at NMB_CHASE px/f while pushing every ball in range outward (f=0.45*t*t).
// The ball is always shoved away faster than the blob can close — a runaway "push while
// chasing" pair that can never catch its prey. Stops at screen edges.
interface NegMassBlob { x: number; y: number; chasing: boolean; faceX: number; faceY: number }
// Bubble Universe Collision (lv91+): a circular scar where another bubble universe once
// collided with ours. Inside, gravity is tilted ±18° and scaled to 0.85x — "falling in a
// different universe." Gravity still exists, so the ball always sinks out eventually.
interface BubbleUniverse {
  x: number; y: number;
  tilt: number;           // signed gravity tilt rad (±BUC_TILT)
  edgeFlash: number;      // >0 while the contact arc rainbow-ripples
  edgeAng: number;        // angle of the most recent enter/exit contact
  insideBalls: WeakSet<Ball>; // membership for enter/exit detection
}
// Big Rip Precursor (lv93+): board-wide pulsed expansion that grows fiercer each cycle.
// Every BR_PERIOD frames a 20f event pushes every ball outward from the board center with
// f = H_rip * dist (farther = stronger). H_rip starts at BR_H0 and *= BR_H_GROW per event
// (cap BR_H_CAP * BR_H0). Pure repulsion — center is nearly inert.
interface BigRip {
  timer: number;          // countdown to next event (or remaining event frames when active)
  active: boolean;        // true during the 20f expansion window
  h: number;              // current H_rip coefficient
  eventCount: number;     // how many events have fired (drives tear thickness)
  bgStretch: number;      // 0..1 visual stretch of bgDots during the event
}
// Conformal Cyclic Boundary (lv95+): a thin band at the very bottom. A ball that falls
// through without hitting the bucket is reborn once at the top (speed preserved, 1x per
// ball). The only hazard that touches the ball economy — a deep-level mercy gimmick.
interface CccBoundary {
  streakTimer: number;    // >0 while the white rebirth streak is climbing
  streakX: number;        // x of the contact / rebirth column
  streakFromY: number;
}
// The Nothing (lv99+): a circular region of total force absence — no gravity, no hazard
// forces, no minSpeed/stuck while inside. Straight-line uniform motion only. Pegs and other
// hazards are kept out of the region at generation. Draw NOTHING inside (bgDots skipped).
interface TheNothing { x: number; y: number }
interface LaniakeaBasin { sinkX: number; sinkY: number; streams: LaniakeaStream[] }
// Rogue black hole (lv55+): the black-hole family's final form — the main black hole's pull
// formula, but centered on a point that drifts along a slow, deterministic Lissajous path
// instead of sitting in a fixed GravZone. A small absorption radius removes the ball (same
// as the main BH, unrelated to the clear condition); the well itself never stops moving, so
// a stable orbit can never form around it.
interface RogueBH { cx0: number; cy0: number; flashTimer: number }
// Odd Radio Circle (lv56+): a mysterious, super-slow "ghost" ring — an ultra-slow, continuous-
// push variant of the gravitational wave (that one rotates velocity impulsively as its
// wavefront passes; this one applies a gentle sustained outward push while a ball sits in the
// band). Cycles grow (r 60→260 over ~900f) → fadeOut (20f) → recondense (20f, a point cloud
// converging back to the center) → grow again. Never placed alongside a gravitational wave.
interface OddRadioCircle {
  x: number; y: number;
  radius: number;
  phase: 'grow' | 'fadeOut' | 'recondense';
  timer: number;
  litBins: number[]; // per-30°-arc brightness countdown ("only visible where a ball crossed")
}
// Tidal disruption event (lv57+): a star torn apart by a black hole — an in-winding vortex
// (lens-style tangential force + BH-style inward pull, added together) pulls balls toward
// the center, but any ball that gets close enough (dist<TDE_JET_R) is intercepted by a
// forced upward jet instead of the vortex terms. The jet always overrides the vortex, so the
// vortex's own endpoint is a guaranteed escape route, never a trap.
interface TidalDisruption { x: number; y: number; dir: 1 | -1 }
// Dark Flow (lv58+): a board-wide, nearly imperceptible drift applied to every ball
// regardless of position — the cosmological-scale analogue of wind. No dedicated light
// source; only a background dust-drift bias and faint edge dust streaks hint at its
// direction. Unlike wind's other hazards, this is NOT generated inside generateLevel's
// deterministic rng stream — it's decided in initLevel via Math.random(), the same way wind
// itself is (see the wind comment in initLevel), because it must avoid ever co-occurring
// with wind, and wind's own presence isn't known until after generateLevel returns.
interface DarkFlow { theta0: number; accel: number }
// Great Attractor (lv59+): a pull toward a fixed point OFF-SCREEN, decided at generation
// time (left or right wall). Unlike every prior point-attraction hazard (black holes, rogue
// black hole), the source itself is never on the board and never absorbs — only its pull is
// felt, and a dark "avoidance band" + dust streaks at the near wall hint at its direction.
interface GreatAttractor { x: number; y: number; side: 1 | -1 } // side: -1 = source left of screen, 1 = source right
interface Wormhole {
  cx: number; cy: number;
  w: number; h: number;
  angle: number;
  pairId: number;
  pairSlot: 0 | 1;
  cycleTimer: number;
  hitCool: number;
  flashTimer: number;
  dots: Dot[];
  auraDots: Dot[];
}
interface LightningArc {
  x1: number; y1: number;
  x2: number; y2: number;
  age: number; maxAge: number;
  pts: { x: number; y: number }[];
}
interface WallSegment {
  side: 'left' | 'right';
  yMin: number; yMax: number;
  type: 'warp' | 'void' | 'distort';
}
interface FogCloudDot { dx: number; dy: number; r: number }
interface FogCloud    {
  bx: number; by: number; spd: number; alpha: number; dots: FogCloudDot[];
  noiseTiers: [[number, number][], [number, number][], [number, number][]];
  // pre-baked sprite (fill + noise + rings) so per-frame cost is one drawImage; built lazily in render
  sprite?: HTMLCanvasElement; sox?: number; soy?: number; sw?: number; sh?: number; spriteDpr?: number;
  staticPool?: [number, number][]; // in-cloud positions (center-relative) sampled live for TV static flicker
}

type PegType = 'orange' | 'blue' | 'purple' | 'bomb' | 'split' | 'magnet' | 'chain-weak' | 'chain-node' | 'shield' | 'lightning' | 'hash' | 'freeze' | 'mud';
type Phase   = 'idle' | 'aiming' | 'firing' | 'levelclear' | 'gameover' | 'paused';

interface Peg {
  x: number; y: number;
  type: PegType;
  cleared: boolean;
  hitCool: number;
  dots: Dot[];
  chainId?: number;
  hp?: number;
  maxHp?: number;
  bossArmor?: boolean; // shield peg belonging to a boss's re-arming armor ring
  armorAngle?: number; // angle around the boss core (so armor can follow a moving boss)
  mudBroken?: boolean; // mud peg: destroyed this volley (revives before the next shot)
  mudAnim?: number;    // mud peg: frames remaining in the reform animation after revival
}

interface Boss {
  x: number; y: number; r: number;
  hp: number; maxHp: number;
  hitFlash: number;   // frames, flashes white on damage
  hitCool: number;    // frames, gates damage ticks
  rearmFlash: number; // frames, flashes when re-arming (triggered on fire)
  tier: number;       // floor(level/10): 1 at lv10, scales gimmicks
  vx: number;         // horizontal drift speed (0 = static, set from tier 2)
  armorR: number;     // radius of the armor ring (for repositioning followers)
  moveMinX: number; moveMaxX: number; // horizontal drift bounds
}

interface Bumper {
  cx: number; cy: number;
  w: number; h: number;
  angle: number;
  angularVel: number;
  dots: Dot[];
  hitFlash: number;
  hitCount: number;
  hitCool: number;
}

interface Ball { x: number; y: number; vx: number; vy: number; dots: Dot[]; isBucketBall: boolean; stuckTimer: number; stuckBaseY: number; freezeTimer: number; mudTimer: number; dilated: boolean; bfSide: number; bucFlash: number; reborn: boolean; goldTimer: number; }

interface GameState {
  phase: Phase;
  prePausePhase: Phase;
  pegs: Peg[];
  bumpers: Bumper[];
  balls: Ball[];           // all active balls
  burstRemaining: number;  // balls yet to be launched in current burst
  burstTimer: number;      // frames until next ball launch
  burstAngle: number;      // locked aim angle for the current burst
  burstLuckyIdx: number;   // index of the guaranteed bucket ball in current burst (-1 = none)
  burstBucketProb: number; // per-burst chance a ball is a bucket ball (dynamic refill throttle)
  bossRefillLeft: number;  // remaining boss-armor refills allowed this volley (cap 3)
  shotsLeft: number;
  score: number;
  level: number;
  aimAngle: number;
  bursts: Burst[];
  pegBreaks: PegBreak[];
  bgDots: BgDot[];
  bgClusterTimer: number;
  frame: number;
  W: number; H: number;
  launcherX: number; launcherY: number;
  bucketX: number; bucketDir: 1 | -1;
  bucketW: number; bucketSpd: number;
  windForce: number;
  windRange: number;  // px width of wind zone (W = full screen)
  windCenter: number; // center X of wind zone
  windRectY0: number; // top Y of dust rectangle (narrow wind only)
  windRectY1: number; // bottom Y of dust rectangle (narrow wind only)
  warpWalls: boolean;
  gravZones: GravZone[];
  wormholes: Wormhole[];
  comets: Comet[];
  lenses: Lens[];
  pulsars: Pulsar[];
  gravWaves: GravWave[];
  vacuums: VacuumBubble[];
  whiteHoles: WhiteHole[];
  magnetars: Magnetar[];
  roguePlanets: RoguePlanet[];
  quasarJets: QuasarJet[];
  microBHs: MicroBH[];
  darkHalos: DarkHalo[];
  ergospheres: Ergosphere[];
  magReconnections: MagReconnection[];
  preSupernovae: PreSupernova[];
  tidalStretches: TidalStretch[];
  tachyonStreams: TachyonStream[];
  cosmicVoids: CosmicVoid[];
  axionWalls: AxionWall[];
  frbSources: FRBSource[];
  antimatterFlecks: AntimatterFleck[];
  quantumBarriers: QuantumBarrier[];
  timeDilations: TimeDilation[];
  cosmicStrings: CosmicString[];
  darkEnergyPatches: DarkEnergyPatch[];
  galacticTidalStreams: GalacticTidalStream[];
  einsteinMirrorRings: EinsteinMirrorRing[];
  nakedSingularities: NakedSingularity[];
  hyperStars: HyperStar[];
  rogueBHs: RogueBH[];
  oddRadioCircles: OddRadioCircle[];
  tidalDisruptions: TidalDisruption[];
  darkFlow: DarkFlow | null;
  greatAttractor: GreatAttractor | null;
  bulletClusters: BulletCluster[];
  baryonOscillations: BaryonOscillation[];
  laniakeaBasins: LaniakeaBasin[];
  cosmicBirefringences: CosmicBirefringence[];
  littleRedDots: LittleRedDot[];
  primordialBHs: PrimordialBH[];
  darkStars: DarkStar[];
  cmbAnisotropy: CmbAnisotropy | null; // board-wide CMB temperature map (null = inactive)
  hawkingPoints: HawkingPoint[];
  cosmicDarkAgesActive: boolean; // this level has the inverted-fog dark veil (mutually exclusive with fog)
  cdaAlpha: number;              // cosmic dark ages veil fade-in progress 0..1
  cdaGhosts: CdaGhost[];         // shrinking light holes where balls just exited
  quantumFoams: QuantumFoam[];
  firewalls: Firewall[];
  superradiances: Superradiance[];
  negMassBlobs: NegMassBlob[];
  bubbleUniverses: BubbleUniverse[];
  bigRip: BigRip | null; // board-wide pulsed expansion (null = inactive)
  cccBoundary: CccBoundary | null; // conformal cyclic rebirth band (null = inactive)
  theNothings: TheNothing[];
  gwBackgroundActive: boolean; // this level has the board-wide gravitational wave background hum
  cmeActive: boolean;   // this level has a periodic CME shockwave
  cmePeriod: number;    // frames between sweeps
  cmeTimer: number;     // countdown to next sweep
  cmeY: number;         // current sweep-band Y (-1 = not sweeping)
  rng: () => number;
  levelClearTimer: number;
  orangeLeft: number;
  bucketGlowTimer: number;
  bucketFlashTimer: number;
  burstTime: number;
  fogActive: boolean;
  fogRevealTimer: number;
  fogAlpha: number;
  fogClouds: FogCloud[];
  lightningArcs: LightningArc[];
  wallSegments: WallSegment[];
  boss: Boss | null;
}

type Eip1193Provider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
type EIP6963Wallet   = { info: { uuid: string; name: string; icon: string; rdns: string }; provider: Eip1193Provider };

// ─── Dot helpers ──────────────────────────────────────────────────────────────
function rnd(n: number) { return (Math.random() - 0.5) * n; }

function makeDot(x: number, y: number, sizeW = 1.0): Dot {
  const s = Math.random();
  const d: Dot = {
    x: x + rnd(2),
    y: y + rnd(2),
    size: Math.max(1, Math.round((s < 0.55 ? 1 : s < 0.88 ? 2 : 3) * sizeW)),
    alpha: 0.58 + Math.random() * 0.42,
    phase: Math.random() * Math.PI * 2,
    cosP: 0, sinP: 0, cosP2: 0, sinP2: 0,
  };
  d.cosP  = Math.cos(d.phase);        d.sinP  = Math.sin(d.phase);
  d.cosP2 = Math.cos(d.phase * 1.27); d.sinP2 = Math.sin(d.phase * 1.27);
  return d;
}

function makePegDots(type: PegType): Dot[] {
  const dots: Dot[] = [];

  if (type === 'orange') {
    // Dense filled circle → solid ink mass
    for (let r = 1.5; r <= PEG_R + 1; r += 2.3) {
      const edgeFactor = r <= PEG_R ? 1.0 : 0.28;
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.6));
      for (let i = 0; i < count; i++) {
        if (Math.random() > edgeFactor) continue;
        const a = (i / count) * Math.PI * 2;
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.05));
      }
    }
    for (let i = 0; i < 10; i++) {
      const r2 = Math.sqrt(Math.random()) * PEG_R * 0.68;
      const a2 = Math.random() * Math.PI * 2;
      const d = makeDot(Math.cos(a2) * r2, Math.sin(a2) * r2);
      d.alpha *= 0.55;
      dots.push(d);
    }
  } else if (type === 'blue') {
    // Outline ring only → hollow look
    const count = Math.floor(2 * Math.PI * PEG_R / 3.0);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      dots.push(makeDot(Math.cos(a) * PEG_R, Math.sin(a) * PEG_R, 0.88));
    }
    const count2 = Math.floor(2 * Math.PI * (PEG_R - 4) / 4.2);
    for (let i = 0; i < count2; i++) {
      const a = (i / count2) * Math.PI * 2 + 0.4;
      const d = makeDot(Math.cos(a) * (PEG_R - 4), Math.sin(a) * (PEG_R - 4), 0.75);
      d.alpha *= 0.35;
      dots.push(d);
    }
  } else if (type === 'purple') {
    // Purple: filled but sparser, with slightly larger dots for distinct look
    for (let r = 1.5; r <= PEG_R + 1; r += 2.0) {
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.2));
      for (let i = 0; i < count; i++) {
        if (Math.random() > (r <= PEG_R ? 0.88 : 0.22)) continue;
        const a = (i / count) * Math.PI * 2;
        const d = makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.25);
        d.alpha *= 0.80;
        dots.push(d);
      }
    }
  } else if (type === 'bomb') {
    // Dense core + 4 starburst spikes at 45° → looks like an explosion marker
    for (let r = 1.5; r <= PEG_R; r += 2.2) {
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.4));
      for (let i = 0; i < count; i++) {
        if (Math.random() > 0.92) continue;
        const a = (i / count) * Math.PI * 2;
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.0));
      }
    }
    for (let arm = 0; arm < 4; arm++) {
      const a = arm * Math.PI / 2 + Math.PI / 4;
      for (let r = PEG_R; r <= PEG_R + 5; r += 2) {
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.2));
      }
    }
    dots.push({ x: 0, y: 0, size: 3, alpha: 1.0, phase: 0, cosP: 1, sinP: 0, cosP2: 1, sinP2: 0 });
  } else if (type === 'split') {
    // Outer ring + vertical divider → looks split in two
    const count = Math.floor(2 * Math.PI * PEG_R / 3.0);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      dots.push(makeDot(Math.cos(a) * PEG_R, Math.sin(a) * PEG_R, 0.9));
    }
    for (let y = -PEG_R + 2; y <= PEG_R - 2; y += 2.8) {
      dots.push(makeDot(0, y, 1.0));
    }
  } else if (type === 'chain-node') {
    // Double concentric rings → steel chain ring appearance
    const outerCount = Math.floor(2 * Math.PI * PEG_R / 2.5);
    for (let i = 0; i < outerCount; i++) {
      const a = (i / outerCount) * Math.PI * 2;
      dots.push(makeDot(Math.cos(a) * PEG_R, Math.sin(a) * PEG_R, 1.0));
    }
    const innerR = 5;
    const innerCount = Math.floor(2 * Math.PI * innerR / 2.5);
    for (let i = 0; i < innerCount; i++) {
      const a = (i / innerCount) * Math.PI * 2;
      dots.push(makeDot(Math.cos(a) * innerR, Math.sin(a) * innerR, 0.8));
    }
  } else if (type === 'chain-weak') {
    // Dense red-tinted core; HP ring is drawn dynamically in render loop
    for (let r = 1.5; r <= PEG_R; r += 2.0) {
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.4));
      for (let i = 0; i < count; i++) {
        if (Math.random() > 0.85) continue;
        const a = (i / count) * Math.PI * 2;
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.0));
      }
    }
    dots.push({ x: 0, y: 0, size: 3, alpha: 1.0, phase: 0, cosP: 1, sinP: 0, cosP2: 1, sinP2: 0 });
  } else if (type === 'shield') {
    // Dense filled core (blue-tinted); animated shield ring drawn in render loop
    for (let r = 1.5; r <= PEG_R; r += 2.2) {
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.5));
      for (let i = 0; i < count; i++) {
        if (Math.random() > 0.80) continue;
        const a = (i / count) * Math.PI * 2;
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.0));
      }
    }
    dots.push({ x: 0, y: 0, size: 2, alpha: 1.0, phase: 0, cosP: 1, sinP: 0, cosP2: 1, sinP2: 0 });
  } else if (type === 'lightning') {
    // 8-armed jagged star pattern
    for (let arm = 0; arm < 8; arm++) {
      const a = arm * Math.PI / 4;
      for (let r = 2; r <= PEG_R + 2; r += 2.5) {
        const offA = (r / PEG_R) * 0.18;
        dots.push(makeDot(Math.cos(a + offA) * r, Math.sin(a + offA) * r, 1.1));
      }
    }
    dots.push({ x: 0, y: 0, size: 3, alpha: 1.0, phase: 0, cosP: 1, sinP: 0, cosP2: 1, sinP2: 0 });
  } else if (type === 'hash') {
    // Hash symbol: 2 horizontal + 2 vertical bars
    for (let i = -10; i <= 10; i += 2) {
      dots.push(makeDot(i, -3.5, 0.9));
      dots.push(makeDot(i,  3.5, 0.9));
      dots.push(makeDot(-3.5, i, 0.9));
      dots.push(makeDot( 3.5, i, 0.9));
    }
  } else if (type === 'freeze') {
    // 6-armed snowflake with side branches
    for (let arm = 0; arm < 6; arm++) {
      const a = arm * Math.PI / 3;
      for (let r = 2; r <= PEG_R; r += 2.2) {
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.0));
        if (r > PEG_R * 0.42 && r < PEG_R * 0.72) {
          const ba = a + Math.PI / 6;
          const bl = r * 0.42;
          dots.push(makeDot(Math.cos(a) * r + Math.cos(ba) * bl, Math.sin(a) * r + Math.sin(ba) * bl, 0.8));
          dots.push(makeDot(Math.cos(a) * r - Math.cos(ba) * bl, Math.sin(a) * r - Math.sin(ba) * bl, 0.8));
        }
      }
    }
    dots.push({ x: 0, y: 0, size: 2, alpha: 1.0, phase: 0, cosP: 1, sinP: 0, cosP2: 1, sinP2: 0 });
  } else if (type === 'mud') {
    // mud: dense filled blob (rendered custom, but keep valid dots for the type)
    for (let r = 1.5; r <= PEG_R; r += 2.4) {
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.6));
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.0));
      }
    }
    dots.push({ x: 0, y: 0, size: 3, alpha: 1.0, phase: 0, cosP: 1, sinP: 0, cosP2: 1, sinP2: 0 });
  } else {
    // magnet: very dense filled circle + faint outer field ring
    for (let r = 1.5; r <= PEG_R; r += 1.9) {
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.0));
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.1));
      }
    }
    const fieldCount = Math.floor(2 * Math.PI * (PEG_R + 5) / 4.5);
    for (let i = 0; i < fieldCount; i++) {
      if (Math.random() > 0.55) continue;
      const a = (i / fieldCount) * Math.PI * 2;
      const d = makeDot(Math.cos(a) * (PEG_R + 5), Math.sin(a) * (PEG_R + 5), 0.8);
      d.alpha *= 0.45;
      dots.push(d);
    }
  }
  return dots;
}

function makeBallDots(): Dot[] {
  const dots: Dot[] = [];
  for (let r = 1; r <= BALL_R; r += 2.2) {
    const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.4));
    for (let i = 0; i < count; i++) {
      if (Math.random() > 0.86) continue;
      const a = (i / count) * Math.PI * 2;
      dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 0.92));
    }
  }
  dots.push({ x: 0, y: 0, size: 2, alpha: 0.90, phase: 0, cosP: 1, sinP: 0, cosP2: 1, sinP2: 0 });
  return dots;
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────
// Memoized unit-circle trig for evenly-spaced angles a = (i/n)*2π. The values are
// frame-invariant, so circular dot rings (black hole halos, accretion, etc.) can reuse
// them instead of recomputing Math.cos/sin every frame. Bit-identical to the inline form.
const _circleTrigCache = new Map<number, { cos: Float64Array; sin: Float64Array }>();
function circleTrig(n: number): { cos: Float64Array; sin: Float64Array } {
  let e = _circleTrigCache.get(n);
  if (!e) {
    const cos = new Float64Array(n), sin = new Float64Array(n);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; cos[i] = Math.cos(a); sin[i] = Math.sin(a); }
    e = { cos, sin };
    _circleTrigCache.set(n, e);
  }
  return e;
}

function drawDots(
  ctx: CanvasRenderingContext2D,
  dots: Dot[],
  cx: number, cy: number,
  rotAngle: number,
  frame: number,
  color: string,
  alphaMult = 1.0,
) {
  ctx.fillStyle = color;
  const cos = Math.cos(rotAngle), sin = Math.sin(rotAngle);
  // Shared per-frame trig; per-dot jitter uses the precomputed cos/sin of each dot's phase.
  const sA = Math.sin(frame * 0.038), cA = Math.cos(frame * 0.038);
  const sB = Math.sin(frame * 0.031), cB = Math.cos(frame * 0.031);
  for (const d of dots) {
    const jx = (sA * d.cosP  + cA * d.sinP)  * 0.55;
    const jy = (cB * d.cosP2 - sB * d.sinP2) * 0.55;
    const rx = (d.x + jx) * cos - (d.y + jy) * sin;
    const ry = (d.x + jx) * sin + (d.y + jy) * cos;
    ctx.globalAlpha = d.alpha * alphaMult;
    ctx.fillRect(Math.round(cx + rx - d.size * 0.5), Math.round(cy + ry - d.size * 0.5), d.size, d.size);
  }
  ctx.globalAlpha = 1;
}

// Anti-aliased solid circle: full-coverage pixels at alpha 1, edge pixels at fractional alpha.
function drawSolidCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  const cx = Math.round(x), cy = Math.round(y);
  for (let dy = -r; dy <= r; dy++) {
    const exactHw = Math.sqrt(Math.max(0, r * r - dy * dy));
    const fullHw  = Math.floor(exactHw);
    const frac    = exactHw - fullHw;
    ctx.globalAlpha = 1;
    ctx.fillRect(cx - fullHw, cy + dy, fullHw * 2 + 1, 1);
    if (frac > 0.01) {
      ctx.globalAlpha = frac;
      ctx.fillRect(cx - fullHw - 1, cy + dy, 1, 1);
      ctx.fillRect(cx + fullHw + 1, cy + dy, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// ─── Black hole render tables ─────────────────────────────────────────────────
// Every animated term in the black hole render has the form sin(frame*K + C) with K constant per
// layer and C constant per grain, so cos(C)/sin(C) are baked once per zone into typed arrays and
// the per-frame trig collapses to a handful of sin/cos per layer (angle-addition identity —
// mathematically exact, FP differs at ~1 ulp, output perceptually identical). Frame-invariant dot
// positions (halo rings, event horizon, accretion ring, influence ring) are precomputed with the
// identical FP expressions.
// Zones never move after generateLevel, so the tables are baked lazily on first draw and never
// invalidated (keyed by zone object via WeakMap).
const BH_GOLDEN = 2.39996; // golden angle (rad)

interface BHSwirl {
  n: number;
  rBase: Float64Array;               // radius base factor per grain
  wobC: Float64Array; wobS: Float64Array;   // cos/sin of radius-wobble phase
  w1C: Float64Array; w1S: Float64Array;     // cos/sin of wx wobble phase
  w2C: Float64Array; w2S: Float64Array;     // cos/sin of wy wobble phase
  alC: Float64Array; alS: Float64Array;     // cos/sin of alpha twinkle phase
  aB: Float64Array;                  // alpha base factor per grain
  color: string[];
  // veils: angle = a0 + t*aK (per-grain rotation speed); storms: uniform rotation of baked a0C/a0S
  a0?: Float64Array; aK?: Float64Array;
  a0C?: Float64Array; a0S?: Float64Array;
  sz?: Uint8Array;
}
interface BHTables {
  veilA: BHSwirl; veilB: BHSwirl; stormA: BHSwirl; stormB: BHSwirl;
  arm: { bx: Float64Array; by: Float64Array; j1C: Float64Array; j1S: Float64Array; j2C: Float64Array; j2S: Float64Array;
         k1C: Float64Array; k1S: Float64Array; k2C: Float64Array; k2S: Float64Array; sz: Uint8Array; aB: Float64Array; color: string[] };
  ten: { x0: Int32Array; j1C: Float64Array; j1S: Float64Array; j2C: Float64Array; j2S: Float64Array;
         wC: Float64Array; wS: Float64Array; aB: Float64Array; color: string[] };
  rings: { spd: number; color: string; bx: Float64Array; by: Float64Array; w1C: Float64Array; w1S: Float64Array;
           w2C: Float64Array; w2S: Float64Array; alC: Float64Array; alS: Float64Array }[];
  halo: { powV: number; sz: number; color: string; xs: Int32Array; ys: Int32Array }[];
  horizon: { alpha: number; xs: Int32Array; ys: Int32Array }[];
  acc: { factor: number; color: string; xs: Int32Array; ys: Int32Array; alC: Float64Array; alS: Float64Array }[];
  infX: Int32Array; infY: Int32Array; infAlC: Float64Array; infAlS: Float64Array;
}

function bakeBHSwirl(
  n: number, last: number,
  rBaseFn: (frac: number) => number,
  wobPhase: number, w1Phase: number, w2Phase: number, alPhase: number,
  aBFn: (frac: number) => number,
  colorFn: (frac: number) => string,
): BHSwirl {
  const s: BHSwirl = {
    n,
    rBase: new Float64Array(n), wobC: new Float64Array(n), wobS: new Float64Array(n),
    w1C: new Float64Array(n), w1S: new Float64Array(n), w2C: new Float64Array(n), w2S: new Float64Array(n),
    alC: new Float64Array(n), alS: new Float64Array(n), aB: new Float64Array(n), color: new Array<string>(n),
  };
  for (let i = 0; i < n; i++) {
    const frac = i / last;
    s.rBase[i] = rBaseFn(frac);
    s.wobC[i] = Math.cos(i * wobPhase); s.wobS[i] = Math.sin(i * wobPhase);
    s.w1C[i]  = Math.cos(i * w1Phase);  s.w1S[i]  = Math.sin(i * w1Phase);
    s.w2C[i]  = Math.cos(i * w2Phase);  s.w2S[i]  = Math.sin(i * w2Phase);
    s.alC[i]  = Math.cos(i * alPhase);  s.alS[i]  = Math.sin(i * alPhase);
    s.aB[i]   = aBFn(frac);
    s.color[i] = colorFn(frac);
  }
  return s;
}

const _bhTablesCache = new WeakMap<GravZone, BHTables>();

function getBHTables(zone: GravZone, cx: number, cy: number, maxR: number, bhRange: number): BHTables {
  let bh = _bhTablesCache.get(zone);
  if (bh) return bh;

  // Sand veil A (360 grains)
  const veilA = bakeBHSwirl(360, 359, frac => maxR * (0.14 + frac * 0.90), 2.7, 1.37, 2.11, 1.91,
    frac => 1 - frac * 0.50, frac => frac < 0.35 ? '#3a0016' : frac < 0.65 ? '#1e000a' : '#0c0006');
  veilA.a0 = new Float64Array(360); veilA.aK = new Float64Array(360);
  for (let i = 0; i < 360; i++) { veilA.a0[i] = i * BH_GOLDEN; veilA.aK[i] = 0.50 + (i / 359) * 0.28; }

  // Sand veil B (240 grains)
  const veilB = bakeBHSwirl(240, 239, frac => maxR * (0.20 + frac * 0.72), 3.3, 2.39, 1.73, 2.5,
    frac => 1 - frac * 0.55, frac => frac < 0.4 ? '#280010' : '#120007');
  veilB.a0 = new Float64Array(240); veilB.aK = new Float64Array(240);
  for (let i = 0; i < 240; i++) { veilB.a0[i] = i * BH_GOLDEN * 2; veilB.aK[i] = 0.35 + (i / 239) * 0.22; }

  // Inner storm A (280 grains, uniform counter-rotation)
  const stormA = bakeBHSwirl(280, 279, frac => maxR * (0.06 + frac * 0.66), 3.1, 1.91, 2.83, 2.3,
    frac => 1 - frac * 0.65, frac => frac < 0.28 ? '#620024' : frac < 0.58 ? '#3a0018' : '#1e000c');
  stormA.a0C = new Float64Array(280); stormA.a0S = new Float64Array(280); stormA.sz = new Uint8Array(280);
  for (let i = 0; i < 280; i++) {
    const a0 = i * BH_GOLDEN * 1.618;
    stormA.a0C[i] = Math.cos(a0); stormA.a0S[i] = Math.sin(a0);
    stormA.sz[i] = (i / 279) < 0.20 ? 2 : 1;
  }

  // Inner storm B (180 grains, uniform clockwise rotation)
  const stormB = bakeBHSwirl(180, 179, frac => maxR * (0.10 + frac * 0.55), 4.1, 3.14, 1.57, 1.7,
    frac => 1 - frac * 0.72, frac => frac < 0.35 ? '#440018' : '#220010');
  stormB.a0C = new Float64Array(180); stormB.a0S = new Float64Array(180);
  for (let i = 0; i < 180; i++) {
    const a0 = i * BH_GOLDEN * 0.618;
    stormB.a0C[i] = Math.cos(a0); stormB.a0S[i] = Math.sin(a0);
  }

  // 4 spiral arms × 90 dots (drawn in a rotated local frame)
  const arm = {
    bx: new Float64Array(360), by: new Float64Array(360),
    j1C: new Float64Array(360), j1S: new Float64Array(360), j2C: new Float64Array(360), j2S: new Float64Array(360),
    k1C: new Float64Array(360), k1S: new Float64Array(360), k2C: new Float64Array(360), k2S: new Float64Array(360),
    sz: new Uint8Array(360), aB: new Float64Array(360), color: new Array<string>(360),
  };
  for (let armI = 0; armI < 4; armI++) {
    for (let i = 0; i < 90; i++) {
      const idx  = armI * 90 + i;
      const frac = i / 89;
      const a    = frac * Math.PI * 2.2;
      const sr   = frac * maxR * 0.94 + maxR * 0.07;
      arm.bx[idx] = Math.cos(a) * sr; arm.by[idx] = Math.sin(a) * sr;
      arm.j1C[idx] = Math.cos(i * 3.7);  arm.j1S[idx] = Math.sin(i * 3.7);
      arm.j2C[idx] = Math.cos(armI * 1.1 + i * 1.37); arm.j2S[idx] = Math.sin(armI * 1.1 + i * 1.37);
      arm.k1C[idx] = Math.cos(i * 2.9);  arm.k1S[idx] = Math.sin(i * 2.9);
      arm.k2C[idx] = Math.cos(armI * 1.1 + i * 2.11); arm.k2S[idx] = Math.sin(armI * 1.1 + i * 2.11);
      arm.sz[idx]  = Math.max(1, Math.round(3.4 - frac * 2.4));
      arm.aB[idx]  = (1 - frac) * 0.82;
      arm.color[idx] = frac < 0.22 ? '#cc0022' : frac < 0.50 ? '#660033' : frac < 0.75 ? '#330022' : '#110011';
    }
  }

  // 16 tendrils × 36 dots (drawn in a rotated local frame)
  const ten = {
    x0: new Int32Array(576),
    j1C: new Float64Array(576), j1S: new Float64Array(576), j2C: new Float64Array(576), j2S: new Float64Array(576),
    wC: new Float64Array(576), wS: new Float64Array(576), aB: new Float64Array(576), color: new Array<string>(576),
  };
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 36; j++) {
      const idx  = i * 36 + j;
      const frac = j / 35;
      ten.x0[idx] = Math.round(maxR * (0.45 + frac * 0.58)) - 1;
      ten.j1C[idx] = Math.cos(j * 2.1 + i * 0.9); ten.j1S[idx] = Math.sin(j * 2.1 + i * 0.9);
      ten.j2C[idx] = Math.cos(i * 1.9 + j * 0.7); ten.j2S[idx] = Math.sin(i * 1.9 + j * 0.7);
      ten.wC[idx]  = Math.cos(i * 2.3 + j * 1.1); ten.wS[idx]  = Math.sin(i * 2.3 + j * 1.1);
      ten.aB[idx]  = (1 - frac) * 0.34;
      ten.color[idx] = frac < 0.5 ? '#550022' : '#220011';
    }
  }

  // 5 counter-rotating rings (48–112 dots)
  const rings: BHTables['rings'] = [];
  for (let ring = 0; ring < 5; ring++) {
    const rr   = maxR * (0.42 + ring * 0.13);
    const dotN = 48 + ring * 16;
    const tr   = circleTrig(dotN);
    const r = {
      spd: 3.0 + ring * 0.85,
      color: ring < 2 ? '#cc0033' : ring < 4 ? '#880022' : '#550018',
      bx: new Float64Array(dotN), by: new Float64Array(dotN),
      w1C: new Float64Array(dotN), w1S: new Float64Array(dotN), w2C: new Float64Array(dotN), w2S: new Float64Array(dotN),
      alC: new Float64Array(dotN), alS: new Float64Array(dotN),
    };
    for (let i = 0; i < dotN; i++) {
      r.bx[i] = tr.cos[i] * rr; r.by[i] = tr.sin[i] * rr;
      r.w1C[i] = Math.cos(ring * 0.7 + i * 1.73); r.w1S[i] = Math.sin(ring * 0.7 + i * 1.73);
      r.w2C[i] = Math.cos(ring * 0.7 + i * 2.39); r.w2S[i] = Math.sin(ring * 0.7 + i * 2.39);
      r.alC[i] = Math.cos(i * 0.7); r.alS[i] = Math.sin(i * 0.7);
    }
    rings.push(r);
  }

  // Halo rings: positions are frame-invariant; alpha = flicker * 0.88 * powV stays per-frame
  const halo: BHTables['halo'] = [];
  for (let ri = 0; ri < 11; ri++) {
    const r = maxR * (0.14 + ri * 0.09);
    if (r > maxR * 1.05) break;
    const powV     = Math.pow(Math.max(0, 1 - r / maxR), 1.2);
    const dotGap   = 3.5 + ri * 0.6;
    const dotCount = Math.max(4, Math.round(2 * Math.PI * r / dotGap));
    const sz       = Math.max(1, 3 - Math.floor(ri * 0.5));
    const tr       = circleTrig(dotCount);
    const xs = new Int32Array(dotCount), ys = new Int32Array(dotCount);
    for (let j = 0; j < dotCount; j++) {
      xs[j] = Math.round(cx + tr.cos[j] * r) - (sz >> 1);
      ys[j] = Math.round(cy + tr.sin[j] * r) - (sz >> 1);
    }
    halo.push({ powV, sz, color: ri < 4 ? '#1a0010' : ri < 7 ? '#0d000a' : '#000', xs, ys });
  }

  // Event horizon disc: fully frame-invariant
  const horizon: BHTables['horizon'] = [];
  for (let r = 0; r <= maxR * 0.14; r += 2.5) {
    const dotCount = Math.max(1, Math.round(2 * Math.PI * r / 3.0));
    const tr = circleTrig(dotCount);
    const xs = new Int32Array(dotCount), ys = new Int32Array(dotCount);
    for (let j = 0; j < dotCount; j++) {
      xs[j] = Math.round(cx + tr.cos[j] * r) - 1;
      ys[j] = Math.round(cy + tr.sin[j] * r) - 1;
    }
    horizon.push({ alpha: r < maxR * 0.16 ? 1.0 : 0.92, xs, ys });
  }

  // Accretion ring: 3 passes, positions frame-invariant, per-dot alpha twinkle decomposed
  const accR = maxR * 0.34;
  const acc: BHTables['acc'] = [];
  for (let pass = 0; pass < 3; pass++) {
    const rr   = accR + pass * 3.5;
    const dotN = 56 + pass * 18;
    const tr   = circleTrig(dotN);
    const xs = new Int32Array(dotN), ys = new Int32Array(dotN);
    const alC = new Float64Array(dotN), alS = new Float64Array(dotN);
    for (let i = 0; i < dotN; i++) {
      xs[i] = Math.round(cx + tr.cos[i] * rr) - 1;
      ys[i] = Math.round(cy + tr.sin[i] * rr) - 1;
      alC[i] = Math.cos(i * 0.4); alS[i] = Math.sin(i * 0.4);
    }
    acc.push({ factor: pass === 0 ? 0.85 : pass === 1 ? 0.50 : 0.28, color: pass === 0 ? '#ee0033' : pass === 1 ? '#bb0022' : '#880018', xs, ys, alC, alS });
  }

  // Influence range ring (physics pull boundary)
  const infN = 48, infTr = circleTrig(infN);
  const infX = new Int32Array(infN), infY = new Int32Array(infN);
  const infAlC = new Float64Array(infN), infAlS = new Float64Array(infN);
  for (let i = 0; i < infN; i++) {
    infX[i] = Math.round(cx + infTr.cos[i] * bhRange) - 1;
    infY[i] = Math.round(cy + infTr.sin[i] * bhRange) - 1;
    infAlC[i] = Math.cos(i * 0.4); infAlS[i] = Math.sin(i * 0.4);
  }

  bh = { veilA, veilB, stormA, stormB, arm, ten, rings, halo, horizon, acc, infX, infY, infAlC, infAlS };
  _bhTablesCache.set(zone, bh);
  return bh;
}

// ─── Background dots ──────────────────────────────────────────────────────────
function spawnBgDot(W: number, H: number): BgDot {
  const maxAge = 180 + Math.random() * 240;
  return {
    x: Math.random() * W, y: Math.random() * H,
    vx: rnd(0.20), vy: rnd(0.20),
    size: Math.random() < 0.6 ? 1 : Math.random() < 0.85 ? 2 : 3,
    alpha: 0, targetAlpha: 0.06 + Math.random() * 0.14,
    age: 0, maxAge,
  };
}

function spawnBgCluster(W: number, H: number, cx: number, cy: number, count: number): BgDot[] {
  return Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 45;
    const maxAge = 120 + Math.random() * 200;
    return {
      x: Math.min(W - 2, Math.max(2, cx + Math.cos(a) * r)),
      y: Math.min(H - 2, Math.max(2, cy + Math.sin(a) * r)),
      vx: Math.cos(a) * (0.06 + Math.random() * 0.15),
      vy: Math.sin(a) * (0.06 + Math.random() * 0.15),
      size: Math.random() < 0.5 ? 1 : 2,
      alpha: 0, targetAlpha: 0.08 + Math.random() * 0.14,
      age: 0, maxAge,
    };
  });
}

function initBgDots(W: number, H: number): BgDot[] {
  return Array.from({ length: 200 }, () => {
    const d = spawnBgDot(W, H);
    d.age = Math.random() * d.maxAge;
    d.alpha = d.targetAlpha;
    return d;
  });
}

// Offscreen veil buffer for Cosmic Dark Ages (main canvas is alpha:false, so holes must be
// punched on a separate canvas before a single blit). Recreated when W/H/dpr change.
let _cdaVeil: HTMLCanvasElement | null = null;
let _cdaVeilW = 0, _cdaVeilH = 0, _cdaVeilDpr = 0;
function getCdaVeil(W: number, H: number, dpr: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!_cdaVeil || _cdaVeilW !== W || _cdaVeilH !== H || _cdaVeilDpr !== dpr) {
    _cdaVeil = document.createElement('canvas');
    _cdaVeil.width  = Math.max(1, Math.ceil(W * dpr));
    _cdaVeil.height = Math.max(1, Math.ceil(H * dpr));
    _cdaVeilW = W; _cdaVeilH = H; _cdaVeilDpr = dpr;
  }
  const c = _cdaVeil.getContext('2d');
  if (!c) return null;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return c;
}

// ─── Fog cloud sprite baking ──────────────────────────────────────────────────
// Renders fill + noise stipple + outer/inner/fringe rings into an offscreen canvas ONCE.
// Per-frame the render loop just drawImages the sprite at its scrolled position, which
// removes the ~160k isExterior distance checks + ~60k trig calls + 24 ctx.clip()/frame.
// Internal layer alphas are baked in; the blit applies ca = fogAlpha * cloud.alpha on top.
// Layers composite into the sprite first, then the merged result composites at ca — visually
// equivalent to the previous live `ca * layerAlpha` per-layer compositing (not bit-identical
// where layers overlap, but imperceptible for scrolling fog).
function bakeFogCloudSprite(cloud: FogCloud, dpr: number): void {
  if (typeof document === 'undefined') return;
  const dots = cloud.dots;
  const MARG = 16; // room for fringe (r+12) and rounding
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of dots) {
    if (d.dx - d.r - MARG < minX) minX = d.dx - d.r - MARG;
    if (d.dy - d.r - MARG < minY) minY = d.dy - d.r - MARG;
    if (d.dx + d.r + MARG > maxX) maxX = d.dx + d.r + MARG;
    if (d.dy + d.r + MARG > maxY) maxY = d.dy + d.r + MARG;
  }
  const sw = Math.ceil(maxX - minX), sh = Math.ceil(maxY - minY);
  const cv = document.createElement('canvas');
  cv.width  = Math.max(1, Math.ceil(sw * dpr));
  cv.height = Math.max(1, Math.ceil(sh * dpr));
  const c = cv.getContext('2d');
  if (!c) return;
  c.scale(dpr, dpr);
  const ox = -minX, oy = -minY; // sprite-local origin offset
  const cd = dots.map((d) => ({ dx: d.dx + ox, dy: d.dy + oy, r: d.r }));

  // cloud fill
  c.beginPath();
  for (const d of cd) { c.moveTo(d.dx + d.r, d.dy); c.arc(d.dx, d.dy, d.r, 0, Math.PI * 2); }
  c.fillStyle = '#1e1630'; c.globalAlpha = 1; c.fill();

  // noise stipple (positions are center-relative → shift by ox/oy)
  const [nt0, nt1, nt2] = cloud.noiseTiers;
  c.fillStyle = '#0a0616'; c.globalAlpha = 0.62; for (const [nx, ny] of nt0) c.fillRect(Math.round(nx + ox), Math.round(ny + oy), 2, 2);
  c.fillStyle = '#140e26'; c.globalAlpha = 0.78; for (const [nx, ny] of nt1) c.fillRect(Math.round(nx + ox), Math.round(ny + oy), 2, 2);
  c.fillStyle = '#2e2048'; c.globalAlpha = 0.95; for (const [nx, ny] of nt2) c.fillRect(Math.round(nx + ox), Math.round(ny + oy), 3, 3);

  const isExt = (skip: number, bpx: number, bpy: number): boolean => {
    for (let j = 0; j < cd.length; j++) {
      if (j === skip) continue;
      const e = cd[j]; const ex = bpx - e.dx, ey = bpy - e.dy;
      if (ex * ex + ey * ey < e.r * e.r) return false;
    }
    return true;
  };

  // rings — baked at a fixed phase (frozen trembling; imperceptible while the cloud scrolls)
  for (let di = 0; di < cd.length; di++) {
    const d = cd[di], px = d.dx, py = d.dy;
    const outerN = Math.max(12, Math.floor(2 * Math.PI * d.r / 4.0));
    c.fillStyle = '#0f0f0d';
    for (let si = 0; si < outerN; si++) {
      const a = (si / outerN) * Math.PI * 2;
      const bpx = px + Math.cos(a) * d.r, bpy = py + Math.sin(a) * d.r;
      if (isExt(di, bpx, bpy)) { const sz = si % 6 === 0 ? 2 : 1; c.globalAlpha = 0.72 + (si % 3) * 0.09; c.fillRect(Math.round(bpx) - 1, Math.round(bpy) - 1, sz, sz); }
    }
    const innerR = d.r - 4;
    if (innerR > 10) {
      const innerN = Math.max(8, Math.floor(2 * Math.PI * innerR / 5.5));
      c.fillStyle = '#3a1060';
      for (let si = 0; si < innerN; si++) {
        const a = (si / innerN) * Math.PI * 2 + 0.5;
        const bpx = px + Math.cos(a) * innerR, bpy = py + Math.sin(a) * innerR;
        if (isExt(di, bpx, bpy)) { c.globalAlpha = 0.55 + (si % 2) * 0.15; c.fillRect(Math.round(bpx) - 1, Math.round(bpy) - 1, 1, 1); }
      }
    }
    const fringeN = Math.max(8, Math.floor(2 * Math.PI * d.r / 7.0));
    c.fillStyle = '#6010b0';
    for (let si = 0; si < fringeN; si++) {
      const a = (si / fringeN) * Math.PI * 2;
      const fringeR = d.r + 5 + Math.sin(si * 2.0) * 7;
      const bpx = px + Math.cos(a) * fringeR, bpy = py + Math.sin(a) * fringeR;
      if (isExt(di, bpx, bpy)) { c.globalAlpha = 0.14 + Math.abs(Math.sin(si * 1.9)) * 0.14; c.fillRect(Math.round(bpx) - 1, Math.round(bpy) - 1, 1, 1); }
    }
  }

  // dedicated random in-cloud pool for live TV static (smooth snow, center-relative coords)
  const pool: [number, number][] = [];
  for (let a = 0; a < 3000 && pool.length < 500; a++) {
    const px = minX + Math.random() * (maxX - minX);
    const py = minY + Math.random() * (maxY - minY);
    for (const d of dots) { const ex = px - d.dx, ey = py - d.dy; if (ex * ex + ey * ey < d.r * d.r) { pool.push([px, py]); break; } }
  }

  cloud.sprite = cv; cloud.sox = minX; cloud.soy = minY; cloud.sw = sw; cloud.sh = sh; cloud.spriteDpr = dpr;
  cloud.staticPool = pool;
}

// ─── Velocity-scaled burst ────────────────────────────────────────────────────
// Intensity scales from 0 (dead slow) to 1 (full speed). The visible difference
// between a graze and a direct fast hit is the whole point of this system.
//
//  speed  3  → intensity 0.09 →  9 particles, speed×1.0  (gentle poof)
//  speed 10  → intensity 0.53 → 31 particles, speed×3.4  (solid burst)
//  speed 18  → intensity 1.00 → 55 particles, speed×6.0  (explosive scatter)
function spawnBurst(g: GameState, cx: number, cy: number, bvx: number, bvy: number, color?: string) {
  const speed     = Math.sqrt(bvx * bvx + bvy * bvy);
  const intensity = Math.min(1.0, Math.max(0, (speed - 1.5) / 16.5));
  const count     = Math.round(4 + intensity * 51);
  const spdScale  = 0.5 + intensity * 5.5;
  const lifeScale = 0.40 + intensity * 0.60;

  const particles: BurstP[] = Array.from({ length: count }, () => {
    const a    = Math.random() * Math.PI * 2;
    const spd  = (0.3 + Math.random() * 3.8) * spdScale;
    const life = Math.round((10 + Math.random() * 28) * lifeScale);
    return {
      x: cx + rnd(5), y: cy + rnd(5),
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life, maxLife: life,
      size: Math.random() < 0.44 ? 1 : Math.random() < 0.80 ? 2 : 3,
      color,
    };
  });
  g.bursts.push({ particles });
}

// ─── Peg break animation (plays when ball exits and lit pegs are cleared) ─────
// Radially symmetric shatter: all dots fly outward simultaneously.
// Orange (filled) → many particles from the interior.
// Blue  (outline) → fewer particles arranged in a ring.
function spawnPegBreak(g: GameState, peg: Peg) {
  const isFilled = peg.type !== 'blue' && peg.type !== 'chain-node';
  const count    = peg.type === 'orange'     ? 28
                 : peg.type === 'purple'     ? 22
                 : peg.type === 'chain-weak' ? 22
                 : peg.type === 'chain-node' ? 10
                 : 14;
  const particles: BreakP[] = Array.from({ length: count }, (_, i) => {
    const a       = (i / count) * Math.PI * 2 + rnd(0.45);
    const startR  = isFilled
      ? PEG_R * (0.15 + Math.random() * 0.70)   // scatter from interior
      : PEG_R * (0.70 + Math.random() * 0.40);   // ring surface
    const spd     = 1.2 + Math.random() * 3.2;
    const life    = Math.round(28 + Math.random() * 24);
    return {
      x: peg.x + Math.cos(a) * startR * 0.5,
      y: peg.y + Math.sin(a) * startR * 0.5,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - 0.5, // slight upward bias for visual flair
      life, maxLife: life,
      size: Math.random() < 0.30 ? 1 : Math.random() < 0.78 ? 2 : 3,
    };
  });
  g.pegBreaks.push({ particles });
}

// ─── Bucket-catch rainbow burst ───────────────────────────────────────────────
function spawnBucketBurst(g: GameState, cx: number, cy: number) {
  // Wave 1: heavy gold fountain (shoots straight up)
  const goldParticles: BurstP[] = Array.from({ length: 55 }, () => {
    const a    = -Math.PI / 2 + rnd(1.1);
    const spd  = 5.0 + Math.random() * 11.0;
    const life = Math.round(50 + Math.random() * 35);
    return {
      x: cx + rnd(16), y: cy,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life, maxLife: life,
      size: Math.random() < 0.2 ? 4 : Math.random() < 0.6 ? 6 : 9,
      color: Math.random() < 0.55 ? GOLD_GLOW_COLOR : Math.random() < 0.7 ? '#f5d46a' : '#ffe8a0',
    };
  });
  // Wave 2: rainbow explosion ring (denser, faster, bigger)
  const rainbowColors = ['#f07a6a','#f4a84a','#f5d46a','#81c784','#80deea','#90caf9','#ce93d8'];
  const ringParticles: BurstP[] = Array.from({ length: 88 }, (_, i) => {
    const a    = (i / 88) * Math.PI * 2 + rnd(0.15);
    const spd  = 4.5 + Math.random() * 9.0;
    const life = Math.round(38 + Math.random() * 28);
    return {
      x: cx + rnd(6), y: cy + rnd(4),
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 3.5,
      life, maxLife: life,
      size: Math.random() < 0.2 ? 4 : Math.random() < 0.6 ? 6 : 8,
      color: rainbowColors[i % rainbowColors.length],
    };
  });
  // Wave 3: fast shockwave ring (bright gold, very short life)
  const shockParticles: BurstP[] = Array.from({ length: 60 }, (_, i) => {
    const a    = (i / 60) * Math.PI * 2;
    const spd  = 10.0 + Math.random() * 8.0;
    const life = Math.round(10 + Math.random() * 8);
    return {
      x: cx, y: cy,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life, maxLife: life,
      size: 3,
      color: '#ffe8a0',
    };
  });
  g.bursts.push({ particles: [...goldParticles, ...ringParticles, ...shockParticles] });
}

// ─── Black hole ball absorption burst ────────────────────────────────────────
function spawnBHAbsorb(g: GameState, cx: number, cy: number) {
  const particles: BurstP[] = [];
  for (let i = 0; i < 22; i++) {
    const a   = Math.random() * Math.PI * 2;
    const spd = 0.8 + Math.random() * 2.2;
    const col = Math.random() < 0.5 ? '#330022' : Math.random() < 0.7 ? '#220033' : '#440011';
    particles.push({ x: cx, y: cy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 18 + Math.random() * 10, maxLife: 28, size: 2 + Math.round(Math.random() * 2), color: col });
  }
  g.bursts.push({ particles });
}

// ─── Wormhole teleport burst ──────────────────────────────────────────────────
function spawnWHBurst(g: GameState, cx: number, cy: number) {
  const particles: BurstP[] = [];
  for (let i = 0; i < 18; i++) {
    const a   = Math.random() * Math.PI * 2;
    const spd = 1.8 + Math.random() * 3.2;
    const col = Math.random() < 0.55 ? '#aa44ff' : Math.random() < 0.6 ? '#6622cc' : '#dd88ff';
    particles.push({ x: cx, y: cy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 14 + Math.random() * 10, maxLife: 24, size: 2, color: col });
  }
  g.bursts.push({ particles });
}

// ─── Bomb rainbow fireworks burst ────────────────────────────────────────────
function spawnBombBurst(g: GameState, cx: number, cy: number) {
  const rainbow = ['#ff4444','#ff8844','#ffdd44','#44ee44','#44ddff','#6688ff','#dd44ff','#ff44aa'] as const;

  // Wave 1: instant white shockwave ring
  const shock: BurstP[] = Array.from({ length: 80 }, (_, i) => {
    const a   = (i / 80) * Math.PI * 2;
    const spd = 13.0 + Math.random() * 7.0;
    const life = Math.round(7 + Math.random() * 5);
    return { x: cx, y: cy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life, maxLife: life, size: 2, color: '#ffffff' };
  });

  // Wave 2: 8 rainbow debris streams radiating outward
  const debris: BurstP[] = [];
  for (let s = 0; s < 8; s++) {
    const baseA = (s / 8) * Math.PI * 2;
    const col   = rainbow[s];
    for (let p = 0; p < 14; p++) {
      const a   = baseA + rnd(0.40);
      const spd = 2.5 + Math.random() * 10.0;
      const life = Math.round(38 + Math.random() * 32);
      debris.push({ x: cx + rnd(8), y: cy + rnd(8), vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 1.5, life, maxLife: life, size: Math.random() < 0.3 ? 3 : Math.random() < 0.7 ? 5 : 7, color: col });
    }
  }

  // Wave 3: slow rainbow sparkle cloud (longer life, floats upward)
  const sparkle: BurstP[] = Array.from({ length: 60 }, (_, i) => {
    const a   = (i / 60) * Math.PI * 2 + rnd(0.25);
    const spd = 1.0 + Math.random() * 4.5;
    const life = Math.round(50 + Math.random() * 40);
    return { x: cx + rnd(12), y: cy + rnd(12), vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 2.5, life, maxLife: life, size: 2, color: rainbow[i % rainbow.length] };
  });

  g.bursts.push({ particles: [...shock, ...debris, ...sparkle] });
}

// ─── Bumper dot generation ────────────────────────────────────────────────────
function makeBumperDots(w: number, h: number): Dot[] {
  const dots: Dot[] = [];
  const hw = w * 0.5, hh = h * 0.5;
  // Interior fill (sparse stipple)
  for (let x = -hw + 2; x <= hw - 2; x += 2.8) {
    for (let y = -hh + 1.5; y <= hh - 1.5; y += 2.8) {
      if (Math.random() > 0.60) continue;
      dots.push(makeDot(x, y, 1.10));
    }
  }
  // Top / bottom edge reinforcement (denser, gives clear outline)
  for (let x = -hw; x <= hw; x += 2.0) {
    dots.push(makeDot(x, -hh, 1.05));
    dots.push(makeDot(x,  hh, 1.05));
  }
  // End caps
  for (let y = -hh; y <= hh; y += 2.2) {
    dots.push(makeDot(-hw, y, 1.0));
    dots.push(makeDot( hw, y, 1.0));
  }
  return dots;
}

// ─── Wormhole aura dot generation ────────────────────────────────────────────
function makeWormholeAura(w: number): Dot[] {
  const dots: Dot[] = [];
  const halfW = w * 0.5 + 16;
  const halfH = 22;
  for (let i = 0; i < 80; i++) {
    const x = (Math.random() * 2 - 1) * halfW;
    const y = (Math.random() * 2 - 1) * halfH;
    const distFromBar = Math.max(0, Math.abs(y) - 3);
    if (Math.random() > Math.exp(-distFromBar * 0.11)) continue;
    const size  = Math.random() < 0.55 ? 1 : 2;
    const alpha = 0.28 + Math.random() * 0.48;
    const phase = Math.random() * Math.PI * 2;
    // Aura dots use a secondary jitter phase of phase*1.3 (not 1.27) — see the aura draw loop.
    dots.push({ x, y, size, alpha, phase, cosP: Math.cos(phase), sinP: Math.sin(phase), cosP2: Math.cos(phase * 1.3), sinP2: Math.sin(phase * 1.3) });
  }
  return dots;
}

// ─── Dark energy patch expanding-grid dot generation ─────────────────────────
// Evenly spaced interior lattice points, kept within 70% of the radius so the expand
// animation (see the draw loop) has room to grow outward without spilling past the boundary.
function makeDarkEnergyGrid(r: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const spacing = 16;
  for (let x = -r; x <= r; x += spacing) {
    for (let y = -r; y <= r; y += spacing) {
      if (x * x + y * y > (r * 0.7) * (r * 0.7)) continue;
      pts.push({ x, y });
    }
  }
  return pts;
}

// ─── OBB overlap test (no reflection) ────────────────────────────────────────
function testBallOBB(ball: Ball, cx: number, cy: number, w: number, h: number, angle: number): boolean {
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const dx = ball.x - cx, dy = ball.y - cy;
  const lx =  cosA * dx + sinA * dy;
  const ly = -sinA * dx + cosA * dy;
  return Math.abs(lx) <= w * 0.5 + BALL_R && Math.abs(ly) <= h * 0.5 + BALL_R;
}

// ─── Closest point on a polyline (for streamline-based hazards) ──────────────
// Returns the perpendicular distance from (px,py) to the nearest segment, plus a unit
// tangent vector pointing from that segment's start toward its end (direction of flow).
function closestOnPolyline(px: number, py: number, pts: { x: number; y: number }[]): { dist: number; tx: number; ty: number } {
  let best = Infinity, btx = 1, bty = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i].x, ay = pts[i].y, bx = pts[i + 1].x, by = pts[i + 1].y;
    const sx = bx - ax, sy = by - ay;
    const segLen2 = sx * sx + sy * sy;
    let t = segLen2 > 0 ? ((px - ax) * sx + (py - ay) * sy) / segLen2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + sx * t, cy = ay + sy * t;
    const dx = px - cx, dy = py - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < best) {
      best = d;
      const sl = Math.sqrt(segLen2) || 1;
      btx = sx / sl; bty = sy / sl;
    }
  }
  return { dist: best, tx: btx, ty: bty };
}

// ─── Bumper–ball collision (OBB vs circle) ────────────────────────────────────
// Transforms ball into the bumper's local frame, tests AABB, then reflects.
function collideBallBumper(ball: Ball, bumper: Bumper): boolean {
  const cosA = Math.cos(bumper.angle), sinA = Math.sin(bumper.angle);
  const dx = ball.x - bumper.cx, dy = ball.y - bumper.cy;
  // Rotate into local frame (rotate by -angle)
  const lx =  cosA * dx + sinA * dy;
  const ly = -sinA * dx + cosA * dy;

  const hw = bumper.w * 0.5 + BALL_R;
  const hh = bumper.h * 0.5 + BALL_R;
  if (Math.abs(lx) > hw || Math.abs(ly) > hh) return false;

  // Penetration depth on each axis → nearest face normal
  const ox = hw - Math.abs(lx);
  const oy = hh - Math.abs(ly);
  let nlx: number, nly: number, push: number;
  if (ox < oy) { nlx = lx >= 0 ? 1 : -1; nly = 0; push = ox; }
  else          { nlx = 0; nly = ly >= 0 ? 1 : -1; push = oy; }

  // Rotate normal back to world frame (rotate by +angle)
  const wnx = cosA * nlx - sinA * nly;
  const wny = sinA * nlx + cosA * nly;

  const vDotN = ball.vx * wnx + ball.vy * wny;
  if (vDotN > 0) return false; // already separating

  // Reflect and push out
  ball.vx -= 2 * vDotN * wnx;
  ball.vy -= 2 * vDotN * wny;
  ball.x  += wnx * push;
  ball.y  += wny * push;
  return true;
}

// ─── Lightning arc helper ─────────────────────────────────────────────────────
function makeLightningPath(x1: number, y1: number, x2: number, y2: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const jx = i > 0 && i < n ? (Math.random() - 0.5) * 26 : 0;
    const jy = i > 0 && i < n ? (Math.random() - 0.5) * 26 : 0;
    pts.push({ x: x1 + (x2 - x1) * t + jx, y: y1 + (y2 - y1) * t + jy });
  }
  return pts;
}

// ─── Level generation ─────────────────────────────────────────────────────────
// Milestone levels: every 10th = boss spike, other multiples of 5 = special.
type SpecialKind = 'special' | 'boss' | null;
function specialKind(level: number): SpecialKind {
  if (level % 10 === 0) return 'boss';
  if (level % 5 === 0)  return 'special';
  return null;
}

// Hidden dynamic-refill throttle: the more ammo you're holding, the less likely
// fired balls become catchable "bucket balls" — keeps the player near the edge
// without touching any visible payout. Lower levels are more lenient (higher band).
// Boss/special levels are exempt (they demand lots of ammo) → factor 1.
function refillFactor(level: number, shots: number): number {
  if (specialKind(level)) return 1;
  const bandTop = Math.max(7, 13 - Math.floor(level * 0.35));
  return Math.max(0.25, Math.min(1, (bandTop - shots) / bandTop));
}

function generateLevel(W: number, H: number, launcherY: number, rng: () => number, level = 1): { pegs: Peg[], orangeTotal: number, bumpers: Bumper[], gravZones: GravZone[], wormholes: Wormhole[], wallSegments: WallSegment[], boss: Boss | null, comets: Comet[], lenses: Lens[], cme: { active: boolean; period: number }, pulsars: Pulsar[], gravWaves: GravWave[], vacuums: VacuumBubble[], whiteHoles: WhiteHole[], magnetars: Magnetar[], roguePlanets: RoguePlanet[], quasarJets: QuasarJet[], microBHs: MicroBH[], darkHalos: DarkHalo[], ergospheres: Ergosphere[], magReconnections: MagReconnection[], preSupernovae: PreSupernova[], tidalStretches: TidalStretch[], tachyonStreams: TachyonStream[], cosmicVoids: CosmicVoid[], axionWalls: AxionWall[], frbSources: FRBSource[], antimatterFlecks: AntimatterFleck[], quantumBarriers: QuantumBarrier[], timeDilations: TimeDilation[], cosmicStrings: CosmicString[], darkEnergyPatches: DarkEnergyPatch[], galacticTidalStreams: GalacticTidalStream[], einsteinMirrorRings: EinsteinMirrorRing[], nakedSingularities: NakedSingularity[], hyperStars: HyperStar[], rogueBHs: RogueBH[], oddRadioCircles: OddRadioCircle[], tidalDisruptions: TidalDisruption[], greatAttractor: GreatAttractor | null, bulletClusters: BulletCluster[], baryonOscillations: BaryonOscillation[], laniakeaBasins: LaniakeaBasin[], gwBackgroundActive: boolean, cosmicBirefringences: CosmicBirefringence[], littleRedDots: LittleRedDot[], primordialBHs: PrimordialBH[], darkStars: DarkStar[], cmbAnisotropy: CmbAnisotropy | null, hawkingPoints: HawkingPoint[], quantumFoams: QuantumFoam[], firewalls: Firewall[], superradiances: Superradiance[], negMassBlobs: NegMassBlob[], bubbleUniverses: BubbleUniverse[], bigRip: BigRip | null, cccBoundary: CccBoundary | null, theNothings: TheNothing[] } {
  const pegs: Peg[] = [];
  const topPad    = launcherY + 65;
  const bottomPad = H * 0.18;
  const playH     = H - topPad - bottomPad;
  const playW     = W * 0.86;
  const rows      = 11;
  const BASE_COLS = 9;
  const STEP_X    = playW / BASE_COLS;
  const startX    = (W - (BASE_COLS - 1) * STEP_X) / 2;
  const STEP_Y    = playH / rows;

  // Special / boss levels pack the board denser with more orange targets.
  const special    = specialKind(level);
  const fillThresh = special === 'boss' ? 0.93 : special ? 0.89 : 0.82; // higher = fuller board
  const orangeP    = special === 'boss' ? 0.50 : special ? 0.45 : 0.38;
  const minOrange  = special === 'boss' ? 20   : special ? 16   : 12;

  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * STEP_X * 0.5;
    const cols   = row % 2 === 0 ? BASE_COLS : BASE_COLS - 1;
    for (let col = 0; col < cols; col++) {
      if (rng() > fillThresh) continue;
      const x = startX + col * STEP_X + offset + rnd(STEP_X * 0.20);
      const y = topPad + row * STEP_Y + STEP_Y * 0.5 + rnd(STEP_Y * 0.18);
      const tooClose = pegs.some(p => { const dx = p.x - x, dy = p.y - y; return dx*dx + dy*dy < (PEG_R * 2.5) ** 2; });
      if (tooClose) continue;
      const tr   = rng();
      const type: PegType = tr < orangeP ? 'orange' : tr < 0.97 ? 'blue' : 'purple';
      pegs.push({ x, y, type, cleared: false, hitCool: 0, dots: makePegDots(type) });
    }
  }

  // Guarantee a minimum number of orange pegs (higher on special/boss levels)
  const orangeCount = pegs.filter(p => p.type === 'orange').length;
  if (orangeCount < minOrange) {
    const blues = pegs.filter(p => p.type === 'blue');
    let toConvert = Math.min(minOrange - orangeCount, blues.length);
    while (toConvert > 0 && blues.length > 0) {
      const idx = Math.floor(rng() * blues.length);
      blues[idx].type = 'orange';
      blues[idx].dots = makePegDots('orange');
      blues.splice(idx, 1);
      toConvert--;
    }
  }

  // ── Gimmick pegs (bomb / split / magnet) ─────────────────────────────────
  // Use a dedicated rng (1 main rng call) to keep peg layout deterministic.
  const gimmickRng = makeRng((rng() * 0x100000000) >>> 0);
  if (level >= 5) {
    for (const peg of pegs) {
      if (peg.type === 'blue' && gimmickRng() < BOMB_CHANCE) {
        peg.type = 'bomb'; peg.dots = makePegDots('bomb');
      }
    }
  }
  if (level >= 8) {
    for (const peg of pegs) {
      if (peg.type === 'blue' && gimmickRng() < SPLIT_CHANCE) {
        peg.type = 'split'; peg.dots = makePegDots('split');
      }
    }
  }
  if (level >= 6) {
    const magnetCount = Math.min(3, 1 + Math.floor(gimmickRng() * (level - 4) / 3));
    const blues = pegs.filter(p => p.type === 'blue');
    for (let m = 0; m < magnetCount && blues.length > 0; m++) {
      const idx = Math.floor(gimmickRng() * blues.length);
      blues[idx].type = 'magnet'; blues[idx].dots = makePegDots('magnet');
      blues.splice(idx, 1);
    }
  }

  // ── Gravity zones (level 7+, 60% chance) ──────────────────────────────────
  const gravZones: GravZone[] = [];
  if (level >= 7 && gimmickRng() < 0.6) {
    const zoneW = W * 0.55;
    const zoneH = 55;
    const zoneX = (W - zoneW) * (0.1 + gimmickRng() * 0.8);
    const zoneY = topPad + playH * (0.25 + gimmickRng() * 0.40);
    gravZones.push({ x: zoneX, y: zoneY, w: zoneW, h: zoneH, flashTimer: 0 });
  }

  // ── Bumpers (count and angle range scale with level) ──────────────────────
  // Level 1-2: 3, Level 3-5: 4, Level 6-8: 5, Level 9+: 6 (capped)
  // Angle range: ±58° at level 1 → ±72° at level 7+ (capped)
  // Level 3+: some bumpers rotate
  const bumperCount = Math.min(6, 3 + Math.floor(level / 3));
  const angleRange  = Math.min(Math.PI * 0.80, Math.PI * (0.65 + (level - 1) * 0.025));
  const bPositions  = Array.from({ length: bumperCount }, (_, i) => (i + 1) / (bumperCount + 1));
  const bumperRng   = makeRng((rng() * 0x100000000) >>> 0);
  const xJitter     = W * Math.max(0.04, 0.12 - bumperCount * 0.01);
  const maxW        = Math.max(4, 28 - bumperCount * 3);
  const bumpers: Bumper[] = [];
  for (let i = 0; i < bumperCount; i++) {
    const cx = W * bPositions[i] + (bumperRng() - 0.5) * xJitter;
    const cy = topPad + playH * (0.28 + bumperRng() * 0.42);
    const angle = (bumperRng() - 0.5) * angleRange;
    const w = 52 + Math.floor(bumperRng() * maxW);
    const rotProb = level >= 3 ? Math.min(0.8, (level - 2) * 0.15) : 0;
    const angularVel = bumperRng() < rotProb ? (bumperRng() - 0.5) * 0.030 : 0;
    bumpers.push({ cx, cy, w, h: 10, angle, angularVel, dots: makeBumperDots(w, 10), hitFlash: 0, hitCount: 0, hitCool: 0 });
  }

  // ── Wormholes (level 9+, always in pairs) ────────────────────────────────────
  const wormholes: Wormhole[] = [];
  if (level >= 9) {
    const pairCount = level >= 12 ? 2 : 1;
    const whRng = makeRng((rng() * 0x100000000) >>> 0);
    for (let p = 0; p < pairCount; p++) {
      const cycleOffset = Math.floor(whRng() * WORMHOLE_CYCLE);
      for (let slot = 0; slot < 2; slot++) {
        const cx    = W * (0.15 + whRng() * 0.70);
        const cy    = topPad + playH * (0.15 + whRng() * 0.68);
        const angle = (whRng() - 0.5) * Math.PI * 0.75;
        const w     = 36 + Math.floor(whRng() * 14); // thinner than bumper (52+)
        wormholes.push({ cx, cy, w, h: 5, angle, pairId: p, pairSlot: slot as 0 | 1, cycleTimer: cycleOffset, hitCool: 0, flashTimer: 0, dots: makeBumperDots(w, 5), auraDots: makeWormholeAura(w) });
      }
    }
  }

  // ── Chain peg groups (level 10+) ─────────────────────────────────────────
  if (level >= 10) {
    const chainRng    = makeRng((rng() * 0x100000000) >>> 0);
    const groupCount  = level >= 15 ? 2 : 1;
    const maxHp       = Math.min(CHAIN_HP_MAX, CHAIN_HP_BASE + Math.floor((level - 10) / 5));

    for (let g = 0; g < groupCount; g++) {
      const chainId   = g;
      const nodeCount = 2 + Math.floor(chainRng() * 4); // 2–5 nodes
      const wcx       = W * (0.2 + chainRng() * 0.6);
      const wcy       = topPad + playH * (0.25 + chainRng() * 0.45);
      const clusterR  = 44 + chainRng() * 18;

      pegs.push({ x: wcx, y: wcy, type: 'chain-weak', cleared: false, hitCool: 0,
        dots: makePegDots('chain-weak'), chainId, hp: maxHp, maxHp });

      for (let n = 0; n < nodeCount; n++) {
        const angle = (n / nodeCount) * Math.PI * 2 + chainRng() * 0.5;
        const nx = Math.max(PEG_R + 5, Math.min(W - PEG_R - 5, wcx + Math.cos(angle) * clusterR));
        const ny = Math.max(topPad + PEG_R + 5, Math.min(topPad + playH - PEG_R - 5, wcy + Math.sin(angle) * clusterR));
        pegs.push({ x: nx, y: ny, type: 'chain-node', cleared: false, hitCool: 0,
          dots: makePegDots('chain-node'), chainId });
      }
    }
  }

  // ── Shield pegs (level 13+): 2-hit pegs, taken from blue pool ────────────
  if (level >= 13) {
    const shieldCount = Math.min(3, 1 + Math.floor(gimmickRng() * 2));
    const blues = pegs.filter(p => p.type === 'blue');
    for (let s = 0; s < shieldCount && blues.length > 0; s++) {
      const idx = Math.floor(gimmickRng() * blues.length);
      blues[idx].type = 'shield'; blues[idx].dots = makePegDots('shield');
      blues[idx].hp = SHIELD_HP; blues[idx].maxHp = SHIELD_HP;
      blues.splice(idx, 1);
    }
  }

  // ── Lightning pegs (level 19+): cascade clear on hit ─────────────────────
  if (level >= 19) {
    const lightningCount = Math.min(2, 1 + Math.floor(gimmickRng() * 2));
    const blues2 = pegs.filter(p => p.type === 'blue');
    for (let l = 0; l < lightningCount && blues2.length > 0; l++) {
      const idx = Math.floor(gimmickRng() * blues2.length);
      blues2[idx].type = 'lightning'; blues2[idx].dots = makePegDots('lightning');
      blues2.splice(idx, 1);
    }
  }

  // ── Hash pegs (level 22+): randomize ball direction on hit ───────────────
  if (level >= 22) {
    const hashCount = Math.min(3, 1 + Math.floor(gimmickRng() * 2));
    const blues3 = pegs.filter(p => p.type === 'blue');
    for (let h = 0; h < hashCount && blues3.length > 0; h++) {
      const idx = Math.floor(gimmickRng() * blues3.length);
      blues3[idx].type = 'hash'; blues3[idx].dots = makePegDots('hash');
      blues3.splice(idx, 1);
    }
  }

  // ── Freeze pegs (level 25+): slow ball for FREEZE_DUR frames ─────────────
  if (level >= 25) {
    const blues4 = pegs.filter(p => p.type === 'blue');
    const freezeCount = Math.min(2, Math.floor(gimmickRng() * 3));
    for (let f = 0; f < freezeCount && blues4.length > 0; f++) {
      const idx = Math.floor(gimmickRng() * blues4.length);
      blues4[idx].type = 'freeze'; blues4[idx].dots = makePegDots('freeze');
      blues4.splice(idx, 1);
    }
  }

  // ── Mud pegs (level 26+): 0-3 sticky pegs that kill a ball's momentum, break
  // on hit, and revive before the next shot. Introduced once new-gimmick unlocks
  // have run out (freeze @25 is the last), so it reads as the final new peg type.
  if (level >= 26) {
    const mudBlues = pegs.filter(p => p.type === 'blue');
    const mudCount = Math.floor(gimmickRng() * 4); // 0..3
    for (let m = 0; m < mudCount && mudBlues.length > 0; m++) {
      const idx = Math.floor(gimmickRng() * mudBlues.length);
      mudBlues[idx].type = 'mud'; mudBlues[idx].dots = makePegDots('mud');
      mudBlues[idx].mudBroken = false; mudBlues[idx].mudAnim = 0;
      mudBlues.splice(idx, 1);
    }
  }

  // ── Boss core + re-arming armor ring (boss levels) ───────────────────────────
  let boss: Boss | null = null;
  if (special === 'boss') {
    const tier      = Math.floor(level / 10);                        // 1 at lv10, 2 at lv20...
    const bx        = W / 2;
    const by        = topPad + playH * 0.58;                         // lower-centre of the play field
    const armorR    = BOSS_R + PEG_R + 7;
    const armorN    = BOSS_ARMOR_COUNT + Math.min(4, tier - 1);      // 8..12 shields
    const armorHp   = tier >= 3 ? 3 : SHIELD_HP;                     // tougher armor from lv30
    const moveSpeed = tier >= 2 ? Math.min(2.2, 0.6 + (tier - 2) * 0.4) : 0; // drift from lv20
    const moveSpan  = moveSpeed > 0 ? W * 0.18 : 0;
    const moveMinX  = bx - moveSpan, moveMaxX = bx + moveSpan;
    const maxHp     = BOSS_HP_BASE + Math.max(0, tier - 1) * BOSS_HP_PER_TIER;
    // carve a clean arena covering the horizontal sweep (capsule footprint)
    const clearR = armorR + PEG_R + 4;
    for (let i = pegs.length - 1; i >= 0; i--) {
      const cxClamped = Math.max(moveMinX, Math.min(moveMaxX, pegs[i].x));
      const ddx = pegs[i].x - cxClamped, ddy = pegs[i].y - by;
      if (ddx * ddx + ddy * ddy < clearR * clearR) pegs.splice(i, 1);
    }
    boss = {
      x: bx, y: by, r: BOSS_R, hp: maxHp, maxHp,
      hitFlash: 0, hitCool: 0, rearmFlash: 0,
      tier, vx: moveSpeed, armorR, moveMinX, moveMaxX,
    };
    for (let i = 0; i < armorN; i++) {
      const a = (i / armorN) * Math.PI * 2 - Math.PI / 2;
      pegs.push({ x: bx + Math.cos(a) * armorR, y: by + Math.sin(a) * armorR, type: 'shield', cleared: false, hitCool: 0, dots: makePegDots('shield'), hp: armorHp, maxHp: armorHp, bossArmor: true, armorAngle: a });
    }
  }

  // ── Partial wall segments ─────────────────────────────────────────────────
  const wallSegments: WallSegment[] = [];
  const wallRng = makeRng((rng() * 0x100000000) >>> 0);
  const segH = 70;
  const segYMin = topPad + playH * 0.15;
  const segYMax = topPad + playH * 0.80 - segH;

  // Ball-vanishing wall (red haze): a partial wall segment at a fully random spot
  // whose spawn chance rises a little every level. Rolled first so it is never
  // crowded out of the 2-segment cap by warp/distort at high levels.
  const voidProb = Math.min(0.55, Math.max(0, (level - 1) * 0.015));
  if (wallRng() < voidProb) {
    const side = wallRng() < 0.5 ? 'left' : 'right';
    const yMin = segYMin + wallRng() * (segYMax - segYMin);
    wallSegments.push({ side, yMin, yMax: yMin + segH, type: 'void' });
  }
  // Second red wall: only when a first one spawned and there is no black hole this
  // level. With no black hole it uses the SAME probability as the first wall.
  // Placed on the opposite wall so the two traps are visually distinct.
  const firstVoid = wallSegments.find(s => s.type === 'void');
  if (
    gravZones.length === 0 &&
    firstVoid &&
    wallSegments.length < 2 &&
    wallRng() < voidProb
  ) {
    const side: 'left' | 'right' = firstVoid.side === 'left' ? 'right' : 'left';
    const yMin = segYMin + wallRng() * (segYMax - segYMin);
    wallSegments.push({ side, yMin, yMax: yMin + segH, type: 'void' });
  }
  if (level >= 14 && wallRng() < 0.30 && wallSegments.length < 2) {
    const side = wallRng() < 0.5 ? 'left' : 'right';
    const yMin = segYMin + wallRng() * (segYMax - segYMin);
    wallSegments.push({ side, yMin, yMax: yMin + segH, type: 'warp' });
  }
  if (level >= 16 && wallRng() < 0.30 && wallSegments.length < 2) {
    const side = wallRng() < 0.5 ? 'left' : 'right';
    const yMin = segYMin + wallRng() * (segYMax - segYMin);
    wallSegments.push({ side, yMin, yMax: yMin + segH, type: 'distort' });
  }

  // ── Space hazards: comets, gravitational lenses, CME (each a level-gated 50% roll) ──
  const hazardRng = makeRng((rng() * 0x100000000) >>> 0);
  // Comet (lv12+): blue deflector that bounces around the field. Up to 3, each an
  // extra probabilistic roll that gets more likely as levels rise.
  const comets: Comet[] = [];
  if (level >= 12 && hazardRng() < 0.5) {
    let cometCount = 1;
    if (level >= 16 && hazardRng() < 0.45) cometCount++;                       // 2nd
    if (cometCount === 2 && level >= 22 && hazardRng() < 0.35) cometCount++;   // 3rd
    for (let c = 0; c < cometCount; c++) {
      // start off-screen; entry edge/height are pre-decided so the runtime can telegraph them
      comets.push({
        x: -100, y: -100, vx: 0, vy: 0, r: 18, hitCool: 0,
        respawnTimer: 30 + Math.floor(hazardRng() * 40),
        warnFromLeft: hazardRng() < 0.5,
        warnY: (launcherY + 60) + hazardRng() * ((H - launcherY) * 0.45),
        vanish: false, hitFlash: 0, hitX: 0, hitY: 0,
      });
    }
  }
  // Red comet (lv18+): destroys any ball it touches; crosses and exits (not bouncing).
  // Up to 2 — the 2nd is a rare, high-level-only extra roll.
  if (level >= 18 && hazardRng() < 0.4) {
    let redCount = 1;
    if (level >= 26 && hazardRng() < 0.3) redCount++;   // 2nd red comet
    for (let c = 0; c < redCount; c++) {
      comets.push({
        x: -100, y: -100, vx: 0, vy: 0, r: 18, hitCool: 0,
        respawnTimer: 30 + Math.floor(hazardRng() * 40),
        warnFromLeft: hazardRng() < 0.5,
        warnY: (launcherY + 60) + hazardRng() * ((H - launcherY) * 0.45),
        vanish: true, hitFlash: 0, hitX: 0, hitY: 0,
      });
    }
  }
  // Gravitational lens (lv15+): tangential swirl that bends ball paths. 2 lenses from lv28.
  const lenses: Lens[] = [];
  if (level >= 15 && hazardRng() < 0.5) {
    const lensCount = level >= 28 ? 2 : 1;
    const strength  = 0.45 + Math.min(1.1, (level - 15) * 0.03);
    for (let l = 0; l < lensCount; l++) {
      const lx = W * (0.20 + hazardRng() * 0.60);
      const ly = topPad + playH * (0.20 + hazardRng() * 0.55);
      lenses.push({ x: lx, y: ly, r: 62, dir: hazardRng() < 0.5 ? 1 : -1, strength });
    }
  }
  // CME (lv20+): periodic top→bottom shockwave sweep. Period shrinks with level.
  const cme = { active: false, period: 0 };
  if (level >= 20 && hazardRng() < 0.5) {
    cme.active = true;
    cme.period = Math.max(180, 380 - level * 5);
  }

  // ── Deep-space hazards (lv24+): each gets its own rng stream, seeded after all
  // existing draws, so adding/tuning one never shifts older levels' layouts.
  // Pulsar (lv24+): rotating twin radiation beams push balls outward.
  const pulsarRng = makeRng((rng() * 0x100000000) >>> 0);
  const pulsars: Pulsar[] = [];
  if (level >= 24 && pulsarRng() < 0.5) {
    pulsars.push({
      x: W * (0.25 + pulsarRng() * 0.50),
      y: topPad + playH * (0.25 + pulsarRng() * 0.45),
      angle: pulsarRng() * Math.PI,
      rotSpeed: (pulsarRng() < 0.5 ? 1 : -1) * PULSAR_ROT,
      beamLen: PULSAR_BEAM_LEN + Math.min(70, Math.max(0, (level - 24) * 6)),
    });
  }
  // Gravitational wave (lv27+): periodic ripple ring bends every ball it passes.
  const gwRng = makeRng((rng() * 0x100000000) >>> 0);
  const gravWaves: GravWave[] = [];
  if (level >= 27 && gwRng() < 0.5) {
    gravWaves.push({
      ex: W * (0.15 + gwRng() * 0.70),
      ey: topPad + playH * (0.10 + gwRng() * 0.35),
      radius: -1,
      period: Math.max(220, 400 - level * 5),
      timer: 120 + Math.floor(gwRng() * 120),
      dir: gwRng() < 0.5 ? 1 : -1,
    });
  }
  // Vacuum decay bubble (lv29+): expanding sphere of "wrong physics" (gravity flips inside).
  const vacRng = makeRng((rng() * 0x100000000) >>> 0);
  const vacuums: VacuumBubble[] = [];
  if (level >= 29 && vacRng() < 0.5) {
    vacuums.push({
      x: W * (0.25 + vacRng() * 0.50),
      y: topPad + playH * (0.30 + vacRng() * 0.40),
      r: VAC_R0,
      rMax: 90 + Math.min(40, Math.max(0, (level - 29) * 4)),
      grow: 0.085,
      respawnTimer: 0,
      popFlash: 0,
    });
  }
  // White hole (lv23+): radial repulsion, the visual/physical inverse of the black hole.
  const whiteHoleRng = makeRng((rng() * 0x100000000) >>> 0);
  const whiteHoles: WhiteHole[] = [];
  if (level >= 23 && whiteHoleRng() < 0.5) {
    whiteHoles.push({
      x: W * (0.25 + whiteHoleRng() * 0.50),
      y: topPad + playH * (0.25 + whiteHoleRng() * 0.45),
      strength: WH_PUSH + Math.min(0.55, Math.max(0, (level - 23) * 0.03)),
    });
  }
  // Magnetar (lv31+): periodic starquake flare that shoves nearby balls outward.
  const magnetarRng = makeRng((rng() * 0x100000000) >>> 0);
  const magnetars: Magnetar[] = [];
  if (level >= 31 && magnetarRng() < 0.5) {
    magnetars.push({
      x: W * (0.25 + magnetarRng() * 0.50),
      y: topPad + playH * (0.25 + magnetarRng() * 0.45),
      period: Math.max(180, 300 - Math.max(0, (level - 31) * 8)),
      timer: 90 + Math.floor(magnetarRng() * 90),
      releaseTimer: 0,
    });
  }
  // Rogue planet (lv32+): a drifting gravity well with a solid bounce body.
  const roguePlanetRng = makeRng((rng() * 0x100000000) >>> 0);
  const roguePlanets: RoguePlanet[] = [];
  if (level >= 32 && roguePlanetRng() < 0.45) {
    const spd = 0.35 + Math.max(0, (level - 32) * 0.01);
    roguePlanets.push({
      x: W * (0.30 + roguePlanetRng() * 0.40),
      y: topPad + playH * (0.25 + roguePlanetRng() * 0.30),
      vx: (roguePlanetRng() < 0.5 ? 1 : -1) * spd * (0.7 + roguePlanetRng() * 0.4),
      vy: (roguePlanetRng() < 0.5 ? 1 : -1) * spd * (0.4 + roguePlanetRng() * 0.3),
      r: RP_R,
      hitCool: 0,
      ringTilt: roguePlanetRng() * Math.PI,
    });
  }
  // Quasar jet (lv33+): a fixed plasma column that flings balls along its axis.
  const quasarJetRng = makeRng((rng() * 0x100000000) >>> 0);
  const quasarJets: QuasarJet[] = [];
  if (level >= 33 && quasarJetRng() < 0.45) {
    const y0   = topPad + playH * (0.15 + quasarJetRng() * 0.25);
    const jlen = playH * (0.35 + quasarJetRng() * 0.25);
    quasarJets.push({
      bx: W * (0.25 + quasarJetRng() * 0.50),
      y0,
      y1: y0 + jlen,
      dir: quasarJetRng() < 0.5 ? 1 : -1,
      accel: 0.30 + Math.min(0.30, Math.max(0, (level - 33) * 0.015)),
    });
  }
  // Evaporating micro black hole (lv34+): shrinking pull → evaporation burst → re-form.
  const microBHRng = makeRng((rng() * 0x100000000) >>> 0);
  const microBHs: MicroBH[] = [];
  if (level >= 34 && microBHRng() < 0.45) {
    const spotCount = 2 + Math.floor(microBHRng() * 2); // 2-3 re-form sites
    const spots: { x: number; y: number }[] = [];
    for (let s = 0; s < spotCount; s++) {
      spots.push({
        x: W * (0.20 + microBHRng() * 0.60),
        y: topPad + playH * (0.20 + microBHRng() * 0.50),
      });
    }
    const maxLife = Math.max(360, 700 - Math.max(0, (level - 34) * 15));
    microBHs.push({
      x: spots[0].x, y: spots[0].y,
      life: maxLife, maxLife,
      evap: 0, dormant: 0,
      spots, spotIdx: 0,
    });
  }
  // Dark matter halo (lv35+): a nearly invisible attraction source (magnet-style, enlarged).
  const darkHaloRng = makeRng((rng() * 0x100000000) >>> 0);
  const darkHalos: DarkHalo[] = [];
  if (level >= 35 && darkHaloRng() < 0.45) {
    darkHalos.push({
      x: W * (0.25 + darkHaloRng() * 0.50),
      y: topPad + playH * (0.25 + darkHaloRng() * 0.45),
      strength: DM_PULL + Math.min(0.30, Math.max(0, (level - 35) * 0.015)),
      shimmer: 60 + Math.floor(darkHaloRng() * 90),
    });
  }
  // Ergosphere (lv36+): a ring band where a one-way tangential drag drags balls around it
  // (a rotating BH's frame-dragging region). The centre stays inert — only the band pulls.
  const ergoRng = makeRng((rng() * 0x100000000) >>> 0);
  const ergospheres: Ergosphere[] = [];
  if (level >= 36 && ergoRng() < 0.45) {
    ergospheres.push({
      x: W * (0.25 + ergoRng() * 0.50),
      y: topPad + playH * (0.25 + ergoRng() * 0.45),
      r0: ERGO_R0,
      r1: ERGO_R1,
      strength: ERGO_DRAG + Math.min(0.5, Math.max(0, (level - 36) * 0.02)),
      dir: ergoRng() < 0.5 ? 1 : -1,
    });
  }
  // Magnetic reconnection (lv37+): an X of field lines, inert until a periodic snap ejects
  // balls outward along whichever line they're on. Fully passable between snaps.
  const mrRng = makeRng((rng() * 0x100000000) >>> 0);
  const magReconnections: MagReconnection[] = [];
  if (level >= 37 && mrRng() < 0.45) {
    const mrPeriod = Math.max(200, 320 - (level - 37) * 10);
    magReconnections.push({
      x: W * (0.25 + mrRng() * 0.50),
      y: topPad + playH * (0.25 + mrRng() * 0.45),
      angle: mrRng() * Math.PI * 2,
      period: mrPeriod,
      timer: mrPeriod,
      releaseTimer: 0,
    });
  }
  // Pre-supernova star (lv38+): a solid body that swells (14→30) over its cycle, explodes
  // outward, then collapses back to its minimum radius and starts swelling again.
  const snRng = makeRng((rng() * 0x100000000) >>> 0);
  const preSupernovae: PreSupernova[] = [];
  if (level >= 38 && snRng() < 0.45) {
    const snPeriod = Math.max(360, 600 - (level - 38) * 8);
    preSupernovae.push({
      x: W * (0.25 + snRng() * 0.50),
      y: topPad + playH * (0.25 + snRng() * 0.45),
      hitCool: 0,
      hitFlash: 0,
      period: snPeriod,
      timer: snPeriod,
      boomTimer: 0,
      shrinkTimer: 0,
    });
  }
  // Tidal stretch field (lv39+): a static field that combs ball velocity toward the radial
  // axis (amplify radial, damp tangential, clamped to BALL_SPEED*2). Radially-dominant
  // balls speed up and tangentially-dominant ones slow down, so balls always pass through
  // or get flung out — never held.
  const tsRng = makeRng((rng() * 0x100000000) >>> 0);
  const tidalStretches: TidalStretch[] = [];
  if (level >= 39 && tsRng() < 0.45) {
    tidalStretches.push({
      x: W * (0.25 + tsRng() * 0.50),
      y: topPad + playH * (0.25 + tsRng() * 0.45),
      strength: Math.min(0.05, TS_K_BASE + Math.max(0, (level - 39) * 0.002)),
    });
  }
  // Tachyon stream (lv41+): a fixed diagonal band that accelerates any ball inside it along
  // the band direction. Fully passable (no along-axis bound, only a perpendicular one).
  const tcRng = makeRng((rng() * 0x100000000) >>> 0);
  const tachyonStreams: TachyonStream[] = [];
  if (level >= 41 && tcRng() < 0.45) {
    tachyonStreams.push({
      x: W * (0.3 + tcRng() * 0.4),
      y: topPad + playH * (0.3 + tcRng() * 0.4),
      angle: tcRng() * Math.PI * 2,
      halfWidth: Math.min(TACHYON_WIDTH_MAX, TACHYON_WIDTH_BASE + (level - 41) * 3) / 2,
    });
  }
  // Cosmic void (lv42+): a near-empty elliptical patch of low gravity + faint drag. Gravity
  // is only halved (never zero), so a ball always sinks out — stuck-rescue is the backstop.
  const voidRng = makeRng((rng() * 0x100000000) >>> 0);
  const cosmicVoids: CosmicVoid[] = [];
  if (level >= 42 && voidRng() < 0.45) {
    const growth = Math.min(1, (level - 42) * 0.03);
    cosmicVoids.push({
      x: W * (0.3 + voidRng() * 0.4),
      y: topPad + playH * (0.3 + voidRng() * 0.4),
      rx: VOID_RX_BASE + (VOID_RX_MAX - VOID_RX_BASE) * growth,
      ry: VOID_RY_BASE + (VOID_RY_MAX - VOID_RY_BASE) * growth,
    });
  }
  // Axion phase wall (lv43+): an OBB membrane that cycles gone → fadeIn → solid → fadeOut →
  // gone. Only 'solid' collides; the rest is intangible, so a wall can never trap a ball.
  // Max 2 per level, and a second wall is kept off-parallel from the first.
  const axionRng = makeRng((rng() * 0x100000000) >>> 0);
  const axionWalls: AxionWall[] = [];
  if (level >= 43 && axionRng() < 0.45) {
    const count = axionRng() < 0.3 ? 2 : 1;
    const usedAngles: number[] = [];
    for (let i = 0; i < count; i++) {
      let angle = axionRng() * Math.PI;
      if (usedAngles.length) {
        const first = usedAngles[0];
        let diff = Math.abs(angle - first) % Math.PI;
        if (diff > Math.PI / 2) diff = Math.PI - diff;
        if (diff < 0.7) angle = (first + Math.PI / 2) % Math.PI; // force off-parallel
      }
      usedAngles.push(angle);
      axionWalls.push({
        x: W * (0.25 + axionRng() * 0.5),
        y: topPad + playH * (0.25 + axionRng() * 0.5),
        angle,
        phase: 'gone',
        timer: 1 + Math.floor(axionRng() * AXION_GONE), // desync multiple walls' cycles
        hitCool: 0,
        hitFlash: 0,
      });
    }
  }
  // FRB source (lv44+): a fixed edge emitter that periodically rotates every ball's
  // velocity by a fixed angle in one instant. Speed-preserving, so it can't create a trap.
  const frbRng = makeRng((rng() * 0x100000000) >>> 0);
  const frbSources: FRBSource[] = [];
  if (level >= 44 && frbRng() < 0.40) {
    const period = Math.max(240, 400 - (level - 44) * 10);
    frbSources.push({
      x: frbRng() < 0.5 ? 4 : W - 4,
      y: topPad + playH * (0.2 + frbRng() * 0.6),
      period,
      timer: period,
      fireAngle: 0,
      fired: false,
      burstAge: -1,
    });
  }
  // Antimatter fleck (lv45+): a slow drifting micro-mine that annihilates any ball it
  // touches (like a red comet, but a stationary-ish lurker instead of a fast crosser).
  // Skipped on levels that already have a red comet to avoid two similar "instant kill"
  // hazards competing for attention.
  const afRng = makeRng((rng() * 0x100000000) >>> 0);
  const antimatterFlecks: AntimatterFleck[] = [];
  const hasRedComet = comets.some(c => c.vanish);
  if (level >= 45 && !hasRedComet && afRng() < 0.40) {
    const count = afRng() < 0.4 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const a = afRng() * Math.PI * 2;
      antimatterFlecks.push({
        x: W * (0.15 + afRng() * 0.7),
        y: topPad + playH * (0.2 + afRng() * 0.6),
        vx: Math.cos(a) * AF_SPEED,
        vy: Math.sin(a) * AF_SPEED,
        r: AF_R,
        respawnTimer: 0,
        gammaFlash: 0,
      });
    }
  }
  // Quantum tunneling barrier (lv46+): rolls a fresh 50/50 on first contact — reflect or
  // pass clean through. Never placed near-horizontal (no dish-shaped catch platform).
  const qbRng = makeRng((rng() * 0x100000000) >>> 0);
  const quantumBarriers: QuantumBarrier[] = [];
  if (level >= 46 && qbRng() < 0.40) {
    let angle = qbRng() * Math.PI;
    if (Math.abs(angle) < 0.35 || Math.abs(angle - Math.PI) < 0.35) {
      angle += (Math.PI / 2) * (qbRng() < 0.5 ? 1 : -1);
    }
    quantumBarriers.push({
      x: W * (0.25 + qbRng() * 0.5),
      y: topPad + playH * (0.25 + qbRng() * 0.5),
      angle,
      reflectFlash: 0,
      passingBalls: new WeakSet<Ball>(),
    });
  }
  // Time dilation field (lv47+): a static circular field that halves ball speed inside
  // (doubling it back on exit). Gravity is also halved while inside — never zeroed, so
  // the ball always sinks out.
  const tdRng = makeRng((rng() * 0x100000000) >>> 0);
  const timeDilations: TimeDilation[] = [];
  if (level >= 47 && tdRng() < 0.40) {
    timeDilations.push({
      x: W * (0.3 + tdRng() * 0.4),
      y: topPad + playH * (0.3 + tdRng() * 0.4),
    });
  }

  // Cosmic string (lv48+): a relic 1px line whose crossing instantly shifts the ball a fixed
  // distance along the line's own axis (velocity unchanged) — a miniature, always-on
  // teleport confined to translating along one line. shift grows +1px per level over 48.
  const csRng = makeRng((rng() * 0x100000000) >>> 0);
  const cosmicStrings: CosmicString[] = [];
  if (level >= 48 && csRng() < 0.40) {
    cosmicStrings.push({
      x: W * (0.25 + csRng() * 0.5),
      y: topPad + playH * (0.25 + csRng() * 0.5),
      angle: csRng() * Math.PI,
      dir: csRng() < 0.5 ? 1 : -1,
      shift: Math.min(CS_SHIFT_MAX, CS_SHIFT_BASE + (level - 48)),
      hitFlash: 0,
      ghostFlash: 0,
      ghostOldX: 0, ghostOldY: 0, ghostNewX: 0, ghostNewY: 0,
      passingBalls: new WeakSet<Ball>(),
    });
  }

  // Dark energy patch (lv49+): a field whose repulsion grows *with* distance rather than
  // decaying — the exact inverse profile of the white hole (weak at the core, strongest at
  // the range edge). The ball is simply carried outward and released, never trapped.
  const deRng = makeRng((rng() * 0x100000000) >>> 0);
  const darkEnergyPatches: DarkEnergyPatch[] = [];
  if (level >= 49 && deRng() < 0.40) {
    darkEnergyPatches.push({
      x: W * (0.25 + deRng() * 0.5),
      y: topPad + playH * (0.25 + deRng() * 0.5),
      h: Math.min(DE_H_MAX, DE_H_BASE + Math.max(0, level - 49) * DE_H_PER_LV),
      grid: makeDarkEnergyGrid(DE_RANGE),
    });
  }

  // Galactic tidal stream (lv51+): a river of stars flowing along a fixed arc; balls inside
  // the band get a one-way tangential push (no radial pull), so they just ride the current
  // and are ejected at the arc's end. A bent version of the CME sweep.
  const gtsRng = makeRng((rng() * 0x100000000) >>> 0);
  const galacticTidalStreams: GalacticTidalStream[] = [];
  if (level >= 51 && gtsRng() < 0.40) {
    galacticTidalStreams.push({
      cx: W * (0.25 + gtsRng() * 0.5),
      cy: topPad + playH * (0.25 + gtsRng() * 0.5),
      radius: GTS_RADIUS_MIN + gtsRng() * (GTS_RADIUS_MAX - GTS_RADIUS_MIN),
      angleStart: gtsRng() * Math.PI * 2,
      dir: gtsRng() < 0.5 ? 1 : -1,
      flow: Math.min(GTS_FLOW_MAX, GTS_FLOW_BASE + Math.max(0, level - 51) * GTS_FLOW_PER_LV),
    });
  }

  // Einstein mirror ring (lv52+): a fixed-radius ring line whose crossing mirror-reflects
  // velocity about the local tangent (speed-preserving). Not level-scaled per spec.
  const emrRng = makeRng((rng() * 0x100000000) >>> 0);
  const einsteinMirrorRings: EinsteinMirrorRing[] = [];
  if (level >= 52 && emrRng() < 0.40) {
    einsteinMirrorRings.push({
      x: W * (0.25 + emrRng() * 0.5),
      y: topPad + playH * (0.25 + emrRng() * 0.5),
      hitFlash: 0, shockTimer: 0, shockX: 0, shockY: 0,
      ghostFlash: 0, ghostX: 0, ghostY: 0,
      passingBalls: new WeakSet<Ball>(),
    });
  }

  // Naked singularity (lv53+): a chaotic-but-deterministic force whose direction flips with
  // angle+time; a constant outward bias guarantees eventual ejection. Rarest hazard here.
  const nsRng = makeRng((rng() * 0x100000000) >>> 0);
  const nakedSingularities: NakedSingularity[] = [];
  if (level >= 53 && nsRng() < 0.35) {
    nakedSingularities.push({
      x: W * (0.3 + nsRng() * 0.4),
      y: topPad + playH * (0.3 + nsRng() * 0.4),
      spinAngle: 0,
    });
  }

  // Hypervelocity star (lv54+): comet-like crossing traveler with no solid body — a trailing
  // gravitational wake drags balls toward its direction of travel instead of a bounce.
  const hvsRng = makeRng((rng() * 0x100000000) >>> 0);
  const hyperStars: HyperStar[] = [];
  if (level >= 54 && hvsRng() < 0.45) {
    hyperStars.push({
      x: -100, y: -100, vx: 0, vy: 0,
      respawnTimer: 30 + Math.floor(hvsRng() * 40),
      warnFromLeft: hvsRng() < 0.5,
      warnY: (launcherY + 60) + hvsRng() * ((H - launcherY) * 0.45),
    });
  }

  // Rogue black hole (lv55+): a homeless supermassive BH ejected by a galaxy-merger kick,
  // drifting on a slow Lissajous path. Reuses the main BH's pull formula, just with a
  // moving center (see the physics section) instead of a fixed GravZone.
  const rbhRng = makeRng((rng() * 0x100000000) >>> 0);
  const rogueBHs: RogueBH[] = [];
  if (level >= 55 && rbhRng() < 0.45) {
    rogueBHs.push({
      cx0: W * (0.3 + rbhRng() * 0.4),
      cy0: topPad + playH * (0.3 + rbhRng() * 0.35),
      flashTimer: 0,
    });
  }

  // Odd Radio Circle (lv56+): an ultra-slow ghost ring applying a gentle sustained outward
  // push. Never placed on a level that already rolled a gravitational wave, to avoid two
  // ring-shaped hazards competing for attention.
  const orcRng = makeRng((rng() * 0x100000000) >>> 0);
  const oddRadioCircles: OddRadioCircle[] = [];
  if (level >= 56 && gravWaves.length === 0 && orcRng() < 0.45) {
    oddRadioCircles.push({
      x: W * (0.3 + orcRng() * 0.4),
      y: topPad + playH * (0.3 + orcRng() * 0.4),
      radius: ORC_R_MIN,
      phase: 'grow',
      timer: 0,
      litBins: new Array(ORC_LIT_BINS).fill(0),
    });
  }

  // Tidal disruption event (lv57+): an in-winding vortex (lens tangent + BH inward pull)
  // whose own endpoint is a forced upward jet — the vortex can only ever deliver a ball to
  // the jet, never trap it.
  const tdeRng = makeRng((rng() * 0x100000000) >>> 0);
  const tidalDisruptions: TidalDisruption[] = [];
  if (level >= 57 && tdeRng() < 0.45) {
    tidalDisruptions.push({
      x: W * (0.3 + tdeRng() * 0.4),
      y: topPad + playH * (0.3 + tdeRng() * 0.4),
      dir: tdeRng() < 0.5 ? 1 : -1,
    });
  }

  // Great Attractor (lv59+): a pull toward a point off-screen (left or right wall, generation-
  // time decision) — the first point-attraction hazard whose source is never on the board and
  // never absorbs. Zone A (lv54-59)'s last gimmick.
  const gaRng = makeRng((rng() * 0x100000000) >>> 0);
  let greatAttractor: GreatAttractor | null = null;
  if (level >= 59 && gaRng() < 0.45) {
    const side: 1 | -1 = gaRng() < 0.5 ? -1 : 1;
    greatAttractor = {
      x: side === -1 ? -GA_OFFSCREEN_X : W + GA_OFFSCREEN_X,
      y: H * 0.4,
      side,
    };
  }

  // Bullet Cluster (lv61+): Zone B's first gimmick — see interface comment above for the
  // DM-leads/gas-trails design. Reuses the HVS warn/traverse/respawn state machine, purely
  // horizontal (no vy field at all).
  const bcRng = makeRng((rng() * 0x100000000) >>> 0);
  const bulletClusters: BulletCluster[] = [];
  if (level >= 61 && bcRng() < 0.45) {
    bulletClusters.push({
      x: -100, vx: 0,
      hitCool: 0, hitFlash: 0, hitX: 0, hitY: 0,
      respawnTimer: 30 + Math.floor(bcRng() * 40),
      warnFromLeft: bcRng() < 0.5,
      warnY: (launcherY + 60) + bcRng() * ((H - launcherY) * 0.45),
    });
  }

  // Baryon Acoustic Oscillation (lv62+): three static concentric rings — see interface
  // comment above. Center placed with margin for the outer ring (165px) to mostly stay
  // on-board.
  const baoRng = makeRng((rng() * 0x100000000) >>> 0);
  const baryonOscillations: BaryonOscillation[] = [];
  if (level >= 62 && baoRng() < 0.45) {
    baryonOscillations.push({
      x: W * (0.35 + baoRng() * 0.30),
      y: topPad + playH * (0.30 + baoRng() * 0.35),
      litBins: [new Array(BAO_LIT_BINS).fill(0), new Array(BAO_LIT_BINS).fill(0), new Array(BAO_LIT_BINS).fill(0)],
    });
  }

  // Laniakea Basin (lv63+): three curved streamlines converging on one shared sink point at a
  // screen edge — see interface comment above. Sink side and each stream's start angle/
  // curvature are all drawn from the dedicated stream so layout stays deterministic per level.
  const lbRng = makeRng((rng() * 0x100000000) >>> 0);
  const laniakeaBasins: LaniakeaBasin[] = [];
  if (level >= 63 && lbRng() < 0.45) {
    const side = Math.floor(lbRng() * 4); // 0=top, 1=right, 2=bottom, 3=left
    let sinkX: number, sinkY: number;
    if (side === 0)      { sinkX = W * (0.2 + lbRng() * 0.6); sinkY = topPad; }
    else if (side === 1) { sinkX = W; sinkY = topPad + playH * (0.2 + lbRng() * 0.6); }
    else if (side === 2) { sinkX = W * (0.2 + lbRng() * 0.6); sinkY = topPad + playH; }
    else                 { sinkX = 0; sinkY = topPad + playH * (0.2 + lbRng() * 0.6); }
    const cx = W / 2, cy = topPad + playH / 2;
    const streams: LaniakeaStream[] = [];
    for (let s = 0; s < 3; s++) {
      const startAngle = (s / 3) * Math.PI * 2 + lbRng() * 0.6;
      const startR = Math.min(W, playH) * (0.55 + lbRng() * 0.25);
      const startX = cx + Math.cos(startAngle) * startR;
      const startY = cy + Math.sin(startAngle) * startR;
      const mdx = sinkX - startX, mdy = sinkY - startY;
      const mlen = Math.sqrt(mdx * mdx + mdy * mdy) || 1;
      const nx = -mdy / mlen, ny = mdx / mlen; // perpendicular unit, for curvature offset
      const curveMag = (60 + lbRng() * 60) * (lbRng() < 0.5 ? 1 : -1);
      const ctrlX = (startX + sinkX) / 2 + nx * curveMag;
      const ctrlY = (startY + sinkY) / 2 + ny * curveMag;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < LB_STREAM_PTS; i++) {
        const t = i / (LB_STREAM_PTS - 1);
        const omt = 1 - t;
        pts.push({
          x: omt * omt * startX + 2 * omt * t * ctrlX + t * t * sinkX,
          y: omt * omt * startY + 2 * omt * t * ctrlY + t * t * sinkY,
        });
      }
      let len = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      }
      streams.push({ pts, len });
    }
    laniakeaBasins.push({ sinkX, sinkY, streams });
  }

  // Gravitational wave background (lv64+): the polar opposite of the wavefront-style gravity
  // wave (lv27) — instead of a periodic ripple that passes through, EVERY ball's velocity gets
  // a constant tiny sinusoidal rotation every single frame, board-wide, all the time (speed is
  // preserved — it's a rotation, not an acceleration). Never on the same level as the
  // wavefront version, since both compete for the same "gravitational wave" concept.
  const gwbRng = makeRng((rng() * 0x100000000) >>> 0);
  const gwBackgroundActive = level >= 64 && gravWaves.length === 0 && gwbRng() < 0.45;

  // Cosmic Birefringence (lv65+): a tilted pass-through sheet — see interface comment above.
  // Zone B's final gimmick.
  const cbRng = makeRng((rng() * 0x100000000) >>> 0);
  const cosmicBirefringences: CosmicBirefringence[] = [];
  if (level >= 65 && cbRng() < 0.40) {
    cosmicBirefringences.push({
      x: W * (0.25 + cbRng() * 0.5),
      y: topPad + playH * (0.25 + cbRng() * 0.5),
      angle: cbRng() * Math.PI,
      hitFlash: 0, hitX: 0, hitY: 0, hitAngle: 0,
    });
  }

  // Little Red Dot (lv71+): Zone C's first gimmick — see interface comment above. Skipped on
  // levels that already have a red comet, to avoid two similar hazards competing for
  // attention (same exclusion the Antimatter Fleck hazard already uses).
  const lrdRng = makeRng((rng() * 0x100000000) >>> 0);
  const littleRedDots: LittleRedDot[] = [];
  const hasRedCometLRD = comets.some(c => c.vanish);
  if (level >= 71 && !hasRedCometLRD && lrdRng() < 0.45) {
    const lrdCount = 4 + Math.floor(lrdRng() * 3); // 4-6
    for (let i = 0; i < lrdCount; i++) {
      littleRedDots.push({
        x: W * (0.15 + lrdRng() * 0.7),
        y: topPad + playH * (0.15 + lrdRng() * 0.7),
        phase: Math.floor(lrdRng() * (LRD_ON_FRAMES + LRD_OFF_FRAMES)),
        hitCool: 0, hitFlash: 0, hitX: 0, hitY: 0,
      });
    }
  }

  // Primordial Black Hole (lv72+): several tiny invisible pull points — see interface comment
  // above. Generation rejects candidates closer than PBH_MIN_DIST to any already-placed point
  // (bounded attempts, so a very cramped board just yields fewer points rather than hanging).
  const pbhRng = makeRng((rng() * 0x100000000) >>> 0);
  const primordialBHs: PrimordialBH[] = [];
  if (level >= 72 && pbhRng() < 0.45) {
    const pbhCount = 3 + Math.floor(pbhRng() * 3); // 3-5
    let pbhAttempts = 0;
    while (primordialBHs.length < pbhCount && pbhAttempts < 200) {
      pbhAttempts++;
      const px = W * (0.12 + pbhRng() * 0.76);
      const py = topPad + playH * (0.12 + pbhRng() * 0.76);
      let pbhOk = true;
      for (const p of primordialBHs) {
        const pdx = px - p.x, pdy = py - p.y;
        if (pdx * pdx + pdy * pdy < PBH_MIN_DIST * PBH_MIN_DIST) { pbhOk = false; break; }
      }
      if (pbhOk) {
        primordialBHs.push({ x: px, y: py, phase: Math.floor(pbhRng() * PBH_SHIMMER_PERIOD) });
      }
    }
  }

  // Dark Star (lv73+): a huge soft field-only body — see interface comment above.
  const dsRng = makeRng((rng() * 0x100000000) >>> 0);
  const darkStars: DarkStar[] = [];
  if (level >= 73 && dsRng() < 0.45) {
    darkStars.push({
      x: W * (0.25 + dsRng() * 0.5),
      y: topPad + playH * (0.25 + dsRng() * 0.5),
    });
  }

  // CMB Anisotropy (lv74+): board-wide temperature map. Bake a sparse mottled-dot field once
  // so each frame only modulates alpha — never re-evaluates sin for every pixel.
  const cmbRng = makeRng((rng() * 0x100000000) >>> 0);
  let cmbAnisotropy: CmbAnisotropy | null = null;
  if (level >= 74 && cmbRng() < 0.40) {
    const phi1 = cmbRng() * Math.PI * 2;
    const phi2 = cmbRng() * Math.PI * 2;
    const phi3 = cmbRng() * Math.PI * 2;
    const dots: CmbDot[] = [];
    const y0 = topPad;
    const y1 = H - bottomPad;
    for (let y = y0; y < y1; y += CMB_DOT_SPACING) {
      for (let x = 8; x < W - 8; x += CMB_DOT_SPACING) {
        // Jitter each grid point slightly so the map doesn't look like a lattice.
        const jx = x + (cmbRng() - 0.5) * CMB_DOT_SPACING * 0.6;
        const jy = y + (cmbRng() - 0.5) * CMB_DOT_SPACING * 0.6;
        const T = Math.sin(jx * 0.030 + phi1) * Math.cos(jy * 0.024 + phi2)
                + 0.5 * Math.sin(jx * 0.011 - jy * 0.017 + phi3);
        dots.push({ x: jx, y: jy, T });
      }
    }
    cmbAnisotropy = { phi1, phi2, phi3, dots };
  }

  // Hawking Point (lv75+): ghost rings that periodically fire a warmth pulse. Skip if this
  // level already has a ring-family hazard (grav wave / ORC) so rings don't stack.
  const hpRng = makeRng((rng() * 0x100000000) >>> 0);
  const hawkingPoints: HawkingPoint[] = [];
  if (level >= 75 && gravWaves.length === 0 && oddRadioCircles.length === 0 && hpRng() < 0.40) {
    const hpCount = 1 + (hpRng() < 0.45 ? 1 : 0); // 1-2
    for (let i = 0; i < hpCount; i++) {
      hawkingPoints.push({
        x: W * (0.20 + hpRng() * 0.60),
        y: topPad + playH * (0.20 + hpRng() * 0.55),
        period: 300,
        timer: 120 + Math.floor(hpRng() * 150),
        releaseTimer: 0,
      });
    }
  }

  // Quantum Foam (lv81+): a Planck-scale jitter region — velocity noise + display snap.
  const qfRng = makeRng((rng() * 0x100000000) >>> 0);
  const quantumFoams: QuantumFoam[] = [];
  if (level >= 81 && qfRng() < 0.40) {
    quantumFoams.push({
      x: W * (0.25 + qfRng() * 0.50),
      y: topPad + playH * (0.25 + qfRng() * 0.50),
    });
  }

  // Black Hole Firewall (lv83+): a burning arc barrier — reflect + scramble.
  const fwRng = makeRng((rng() * 0x100000000) >>> 0);
  const firewalls: Firewall[] = [];
  if (level >= 83 && fwRng() < 0.40) {
    firewalls.push({
      x: W * (0.25 + fwRng() * 0.50),
      y: topPad + playH * (0.25 + fwRng() * 0.50),
      angle0: fwRng() * Math.PI * 2,
      hitCool: 0,
      hitFlash: 0,
    });
  }

  // Superradiance (lv85+): pull + tangential accel — orbit speeds up until flung out.
  // Never co-placed with an ergosphere (same BH-family tangential force niche).
  const srRng = makeRng((rng() * 0x100000000) >>> 0);
  const superradiances: Superradiance[] = [];
  if (level >= 85 && ergospheres.length === 0 && srRng() < 0.40) {
    superradiances.push({
      x: W * (0.25 + srRng() * 0.50),
      y: topPad + playH * (0.25 + srRng() * 0.50),
      dir: srRng() < 0.5 ? 1 : -1,
      spinMult: 1,
      waveTimer: 0, waveX: 0, waveY: 0,
      occupied: false,
      prevBallAng: new WeakMap(),
    });
  }

  // Negative Mass Blob (lv87+): a chasing hole that pushes balls away — never catches them.
  const nmbRng = makeRng((rng() * 0x100000000) >>> 0);
  const negMassBlobs: NegMassBlob[] = [];
  if (level >= 87 && nmbRng() < 0.35) {
    negMassBlobs.push({
      x: W * (0.30 + nmbRng() * 0.40),
      y: topPad + playH * (0.30 + nmbRng() * 0.40),
      chasing: false,
      faceX: 0, faceY: 0,
    });
  }

  // Bubble Universe Collision (lv91+): a scar where gravity tilts and weakens.
  const bucRng = makeRng((rng() * 0x100000000) >>> 0);
  const bubbleUniverses: BubbleUniverse[] = [];
  if (level >= 91 && bucRng() < 0.40) {
    bubbleUniverses.push({
      x: W * (0.25 + bucRng() * 0.50),
      y: topPad + playH * (0.25 + bucRng() * 0.50),
      tilt: (bucRng() < 0.5 ? 1 : -1) * BUC_TILT,
      edgeFlash: 0, edgeAng: 0,
      insideBalls: new WeakSet(),
    });
  }

  // Big Rip Precursor (lv93+): board-wide pulsed expansion that grows fiercer each cycle.
  // Skip if a local dark-energy patch is already present (same "distance-proportional
  // repulsion" niche — keep them on separate levels).
  const brRng = makeRng((rng() * 0x100000000) >>> 0);
  let bigRip: BigRip | null = null;
  if (level >= 93 && darkEnergyPatches.length === 0 && brRng() < 0.40) {
    bigRip = {
      timer: 200 + Math.floor(brRng() * 150),
      active: false,
      h: BR_H0,
      eventCount: 0,
      bgStretch: 0,
    };
  }

  // Conformal Cyclic Boundary (lv95+): bottom rebirth band — 1 rebirth per ball.
  const cccRng = makeRng((rng() * 0x100000000) >>> 0);
  let cccBoundary: CccBoundary | null = null;
  if (level >= 95 && cccRng() < 0.40) {
    cccBoundary = { streakTimer: 0, streakX: 0, streakFromY: 0 };
  }

  // The Nothing (lv99+): a circular void of total force absence. Clear pegs that land
  // inside so the blank circle stays empty (collisions would break the "no physics" feel).
  const nothingRng = makeRng((rng() * 0x100000000) >>> 0);
  const theNothings: TheNothing[] = [];
  if (level >= 99 && nothingRng() < 0.35) {
    const nx = W * (0.25 + nothingRng() * 0.50);
    const ny = topPad + playH * (0.30 + nothingRng() * 0.40);
    theNothings.push({ x: nx, y: ny });
    for (let i = pegs.length - 1; i >= 0; i--) {
      const p = pegs[i];
      const dx = p.x - nx, dy = p.y - ny;
      if (dx * dx + dy * dy < NOTHING_RANGE * NOTHING_RANGE) pegs.splice(i, 1);
    }
  }

  return { pegs, orangeTotal: pegs.filter(p => p.type === 'orange').length, bumpers, gravZones, wormholes, wallSegments, boss, comets, lenses, cme, pulsars, gravWaves, vacuums, whiteHoles, magnetars, roguePlanets, quasarJets, microBHs, darkHalos, ergospheres, magReconnections, preSupernovae, tidalStretches, tachyonStreams, cosmicVoids, axionWalls, frbSources, antimatterFlecks, quantumBarriers, timeDilations, cosmicStrings, darkEnergyPatches, galacticTidalStreams, einsteinMirrorRings, nakedSingularities, hyperStars, rogueBHs, oddRadioCircles, tidalDisruptions, greatAttractor, bulletClusters, baryonOscillations, laniakeaBasins, gwBackgroundActive, cosmicBirefringences, littleRedDots, primordialBHs, darkStars, cmbAnisotropy, hawkingPoints, quantumFoams, firewalls, superradiances, negMassBlobs, bubbleUniverses, bigRip, cccBoundary, theNothings };
}

// ─── Trajectory preview ───────────────────────────────────────────────────────
// Runs every frame while aiming, so the points are written into a persistent module-level
// buffer instead of allocating a fresh array per call. Returns the number of valid points.
const TRAJ_MAX = 90;
const _trajBuf: TrajPt[] = Array.from({ length: TRAJ_MAX }, () => ({ x: 0, y: 0 }));

function computeTrajectory(sx: number, sy: number, vx: number, vy: number, pegs: Peg[], W: number, windForce = 0, warpWalls = false, windRange = W, windCenter = W / 2, windRectY0 = 0, windRectY1 = 0): number {
  let n = 0;
  let x = sx, y = sy, tvx = vx, tvy = vy;
  const windHalf = windRange / 2;
  const isNarrowWind = windRange < W;
  for (let i = 0; i < TRAJ_MAX; i++) {
    tvy += GRAVITY;
    const inWindX = windForce !== 0 && Math.abs(x - windCenter) <= windHalf;
    const inWindY = !isNarrowWind || (y >= windRectY0 && y <= windRectY1);
    if (inWindX && inWindY) tvx += windForce;
    tvx = Math.max(-BALL_SPEED * 2, Math.min(BALL_SPEED * 2, tvx));
    x  += tvx; y += tvy;
    if (warpWalls) {
      if (x < -BALL_R)      x += W + BALL_R * 2;
      if (x > W + BALL_R)   x -= W + BALL_R * 2;
    } else {
      if (x - BALL_R < 0)  { x = BALL_R;     tvx =  Math.abs(tvx); }
      if (x + BALL_R > W)  { x = W - BALL_R; tvx = -Math.abs(tvx); }
    }
    _trajBuf[n].x = x; _trajBuf[n].y = y; n++;
    let hit = false;
    for (const p of pegs) {
      if (p.cleared || p.type === 'magnet') continue;
      const dx = x - p.x, dy = y - p.y;
      if (dx*dx + dy*dy < (BALL_R + PEG_R) ** 2) { hit = true; break; }
    }
    if (hit || y > sy + 520) break;
  }
  return n;
}

// ─── Translations ─────────────────────────────────────────────────────────────
const LANGS = {
  en: {
    miniGame:            'Mini Game',
    tagline1:            'Clear all the orange pegs.',
    tagline2:            'Drag to aim, release to fire.',
    startPlaying:        'Start Playing',
    levelLabel:          'Level',
    targetsLabel:        'Targets',
    shotsLabel:          'Shots',
    scoreLabel:          'Score',
    paused:              'PAUSED',
    resume:              'Resume',
    retire:              'Retire',
    confirmRetireText:   'Are you sure you want to retire?',
    confirmRetireSub:    'Your current score can be recorded.',
    retireConfirm:       'Retire',
    cancel:              'Cancel',
    gameOver:            'Game Over',
    retiredLabel:        'Retired',
    levelSummary:        (ret: boolean, lv: number, left: number) =>
      `${ret ? 'Retired at' : 'Reached'} Level ${lv}  -  ${left} target${left !== 1 ? 's' : ''} remaining`,
    playAgain:           'Play Again',
    share:               'Share',
    scoreZero:           'Score 0 cannot be recorded on-chain.',
    connectWallet:       'Connect Wallet',
    connecting:          'Connecting...',
    recordOnChain:       'Record On-Chain',
    recording:           'Recording...',
    failedRetry:         'Failed - Retry',
    disconnect:          'Disconnect',
    scoreRecorded:       'Score recorded on Base',
    viewOnBasescan:      'View on Basescan',
    selectWallet:        'Select Wallet',
    fcWalletName:        'Farcaster Wallet',
    fcWalletSub:         'Built-in',
    noWallets:           'No wallets detected. Install Rabby or MetaMask and reload.',
    walletCancel:        'Cancel',
    cleared:             'CLEARED',
    bossLabel:           'BOSS',
    specialLabel:        'SPECIAL',
  },
  ja: {
    miniGame:            'ミニゲーム',
    tagline1:            'オレンジのペグを全部消せ。',
    tagline2:            'ドラッグで狙いを定め、離して発射。',
    startPlaying:        'スタート',
    levelLabel:          'レベル',
    targetsLabel:        '残りペグ',
    shotsLabel:          '残弾',
    scoreLabel:          'スコア',
    paused:              '一時停止',
    resume:              '再開',
    retire:              'リタイア',
    confirmRetireText:   '本当にリタイアしますか？',
    confirmRetireSub:    '現在のスコアを記録できます。',
    retireConfirm:       'リタイア',
    cancel:              'キャンセル',
    gameOver:            'ゲームオーバー',
    retiredLabel:        'リタイア',
    levelSummary:        (ret: boolean, lv: number, left: number) =>
      `レベル${lv}${ret ? 'でリタイア' : '到達'} - 残り${left}ペグ`,
    playAgain:           'もう一度',
    share:               'シェア',
    scoreZero:           'スコア0はオンチェーンに記録できません。',
    connectWallet:       'ウォレット接続',
    connecting:          '接続中...',
    recordOnChain:       'オンチェーンに記録',
    recording:           '記録中...',
    failedRetry:         '失敗 - 再試行',
    disconnect:          '切断',
    scoreRecorded:       'Baseにスコアを記録しました',
    viewOnBasescan:      'Basescanで確認',
    selectWallet:        'ウォレット選択',
    fcWalletName:        'Farcasterウォレット',
    fcWalletSub:         '内蔵',
    noWallets:           'ウォレットが見つかりません。RabbyまたはMetaMaskをインストールしてリロードしてください。',
    walletCancel:        'キャンセル',
    cleared:             'クリア！',
    bossLabel:           'ボス',
    specialLabel:        'スペシャル',
  },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────
export function DotShotGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const rafRef    = useRef(0);

  const G = useRef<GameState>({
    phase: 'idle', prePausePhase: 'aiming',
    pegs: [], bumpers: [],
    balls: [],
    burstRemaining: 0, burstTimer: 0, burstAngle: 0, burstLuckyIdx: 0, burstBucketProb: BUCKET_BALL_PROB, bossRefillLeft: 0,
    shotsLeft: SHOTS_START, score: 0, level: 1,
    aimAngle: 0,
    bursts: [], pegBreaks: [],
    bgDots: [], bgClusterTimer: 0,
    frame: 0,
    W: 390, H: 780,
    launcherX: 195, launcherY: 60,
    bucketX: 155, bucketDir: 1,
    bucketW: BUCKET_W, bucketSpd: BUCKET_SPD,
    windForce: 0, windRange: 390, windCenter: 195, windRectY0: 0, windRectY1: 0,
    warpWalls: false,
    gravZones: [],
    wormholes: [],
    comets: [],
    lenses: [],
    pulsars: [],
    gravWaves: [],
    vacuums: [],
    whiteHoles: [],
    magnetars: [],
    roguePlanets: [],
    quasarJets: [],
    microBHs: [],
    darkHalos: [],
    ergospheres: [],
    magReconnections: [],
    preSupernovae: [],
    tidalStretches: [],
    tachyonStreams: [],
    cosmicVoids: [],
    axionWalls: [],
    frbSources: [],
    antimatterFlecks: [],
    quantumBarriers: [],
    timeDilations: [],
    cosmicStrings: [],
    darkEnergyPatches: [],
    galacticTidalStreams: [],
    einsteinMirrorRings: [],
    nakedSingularities: [],
    hyperStars: [],
    rogueBHs: [],
    oddRadioCircles: [],
    tidalDisruptions: [],
    darkFlow: null,
    greatAttractor: null,
    bulletClusters: [],
    baryonOscillations: [],
    laniakeaBasins: [],
    cosmicBirefringences: [],
    littleRedDots: [],
    primordialBHs: [],
    darkStars: [],
    cmbAnisotropy: null,
    hawkingPoints: [],
    cosmicDarkAgesActive: false,
    cdaAlpha: 0,
    cdaGhosts: [],
    quantumFoams: [],
    firewalls: [],
    superradiances: [],
    negMassBlobs: [],
    bubbleUniverses: [],
    bigRip: null,
    cccBoundary: null,
    theNothings: [],
    gwBackgroundActive: false,
    cmeActive: false, cmePeriod: 0, cmeTimer: 0, cmeY: -1,
    rng: () => 0,
    levelClearTimer: 0,
    orangeLeft: 0,
    bucketGlowTimer: 0,
    bucketFlashTimer: 0,
    burstTime: 0,
    fogActive: false,
    fogRevealTimer: 0,
    fogAlpha: 0,
    fogClouds: [],
    lightningArcs: [],
    wallSegments: [],
    boss: null,
  });

  const preventNextFire = useRef(false);

  const [phase,      setPhase]      = useState<Phase>('idle');
  const [shotsLeft,  setShotsLeft]  = useState(SHOTS_START);
  const [score,      setScore]      = useState(0);
  const [level,      setLevel]      = useState(1);
  const [orangeLeft, setOrangeLeft] = useState(0);
  const [warpWalls,  setWarpWalls]  = useState(false);
  const [retired,       setRetired]       = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [txState,    setTxState]    = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [txHash,     setTxHash]     = useState<string | null>(null);
  const [walletAddress,    setWalletAddress]    = useState<string | null>(null);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [showWalletModal,  setShowWalletModal]  = useState(false);
  const [detectedWallets,  setDetectedWallets]  = useState<EIP6963Wallet[]>([]);
  const [inFarcaster,      setInFarcaster]      = useState(false);
  const [lang,             setLang]             = useState<'en' | 'ja'>('en');
  const [speed,            setSpeed]            = useState<1|2|3>(1);
  const [refillPopup,      setRefillPopup]      = useState<{ n: number; key: number } | null>(null);
  const selectedProviderRef = useRef<Eip1193Provider | null>(null);
  const t = LANGS[lang];

  // ── Size sync ────────────────────────────────────────────────────────────
  const syncSize = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const W = el.clientWidth  || 390;
    const H = el.clientHeight || 780;
    const g = G.current;
    g.W = W; g.H = H;
    g.launcherX = W / 2;
    g.launcherY = H * 0.08;
    g.bucketX   = Math.min(g.bucketX, W - g.bucketW);
  }, []);

  // ── Init level ───────────────────────────────────────────────────────────
  const initLevel = useCallback((lv: number) => {
    const g = G.current;
    const { pegs, orangeTotal, bumpers, gravZones, wormholes, wallSegments, boss, comets, lenses, cme, pulsars, gravWaves, vacuums, whiteHoles, magnetars, roguePlanets, quasarJets, microBHs, darkHalos, ergospheres, magReconnections, preSupernovae, tidalStretches, tachyonStreams, cosmicVoids, axionWalls, frbSources, antimatterFlecks, quantumBarriers, timeDilations, cosmicStrings, darkEnergyPatches, galacticTidalStreams, einsteinMirrorRings, nakedSingularities, hyperStars, rogueBHs, oddRadioCircles, tidalDisruptions, greatAttractor, bulletClusters, baryonOscillations, laniakeaBasins, gwBackgroundActive, cosmicBirefringences, littleRedDots, primordialBHs, darkStars, cmbAnisotropy, hawkingPoints, quantumFoams, firewalls, superradiances, negMassBlobs, bubbleUniverses, bigRip, cccBoundary, theNothings } = generateLevel(g.W, g.H, g.launcherY, g.rng, lv);
    g.level          = lv;
    g.pegs           = pegs;
    g.boss           = boss;
    g.bumpers        = bumpers;
    g.orangeLeft     = orangeTotal;
    g.balls          = [];
    g.burstRemaining = 0;
    g.burstTimer     = 0;
    g.bursts         = [];
    g.pegBreaks      = [];
    g.phase          = 'aiming';
    g.levelClearTimer = 0;
    g.bucketGlowTimer = 0;
    g.bucketFlashTimer = 0;
    g.burstTime = 0;
    g.bucketW   = Math.max(40, BUCKET_W - (lv - 1) * 5);
    g.bucketSpd = Math.min(3.5, BUCKET_SPD + (lv - 1) * 0.2);
    g.bucketX   = g.W / 2 - g.bucketW / 2;
    g.gravZones    = gravZones;
    g.wormholes    = wormholes;
    g.wallSegments = wallSegments;
    g.comets       = comets;
    g.lenses       = lenses;
    g.pulsars      = pulsars;
    g.gravWaves    = gravWaves;
    g.vacuums      = vacuums;
    g.whiteHoles   = whiteHoles;
    g.magnetars    = magnetars;
    g.roguePlanets = roguePlanets;
    g.quasarJets   = quasarJets;
    g.microBHs     = microBHs;
    g.darkHalos    = darkHalos;
    g.ergospheres  = ergospheres;
    g.magReconnections = magReconnections;
    g.preSupernovae = preSupernovae;
    g.tidalStretches = tidalStretches;
    g.tachyonStreams = tachyonStreams;
    g.cosmicVoids  = cosmicVoids;
    g.axionWalls   = axionWalls;
    g.frbSources   = frbSources;
    g.antimatterFlecks = antimatterFlecks;
    g.quantumBarriers = quantumBarriers;
    g.timeDilations = timeDilations;
    g.cosmicStrings = cosmicStrings;
    g.darkEnergyPatches = darkEnergyPatches;
    g.galacticTidalStreams = galacticTidalStreams;
    g.einsteinMirrorRings = einsteinMirrorRings;
    g.nakedSingularities = nakedSingularities;
    g.hyperStars   = hyperStars;
    g.rogueBHs     = rogueBHs;
    g.oddRadioCircles = oddRadioCircles;
    g.tidalDisruptions = tidalDisruptions;
    g.greatAttractor = greatAttractor;
    g.bulletClusters = bulletClusters;
    g.baryonOscillations = baryonOscillations;
    g.laniakeaBasins = laniakeaBasins;
    g.gwBackgroundActive = gwBackgroundActive;
    g.cosmicBirefringences = cosmicBirefringences;
    g.littleRedDots = littleRedDots;
    g.primordialBHs = primordialBHs;
    g.darkStars = darkStars;
    g.cmbAnisotropy = cmbAnisotropy;
    g.hawkingPoints = hawkingPoints;
    g.quantumFoams = quantumFoams;
    g.firewalls = firewalls;
    g.superradiances = superradiances;
    g.negMassBlobs = negMassBlobs;
    g.bubbleUniverses = bubbleUniverses;
    g.bigRip = bigRip;
    g.cccBoundary = cccBoundary;
    g.theNothings = theNothings;
    g.cmeActive    = cme.active;
    g.cmePeriod    = cme.period;
    g.cmeTimer     = cme.period;
    g.cmeY         = -1;
    g.lightningArcs = [];
    // Fog gimmick: from Lv17+, probability ramps with level; forced on boss levels.
    // Always consume one rng() so the layout stream stays stable regardless of branch.
    const fogRoll = g.rng();
    const fogProb = Math.min(0.7, 0.35 + Math.max(0, lv - 17) * 0.03);
    g.fogActive      = lv >= 17 && (specialKind(lv) === 'boss' || fogRoll < fogProb);
    g.fogRevealTimer = g.fogActive ? 90 : 0;
    g.fogAlpha       = 0;
    if (g.fogActive) {
      const fogTop = Math.round(g.launcherY + 24);
      const areaH  = g.H - fogTop;
      const bufW   = g.W + 200;
      const count  = 20 + Math.round(Math.random() * 8); // 20-28 clouds
      g.fogClouds  = Array.from({ length: count }, () => {
        const numDots = 5 + Math.round(Math.random() * 5); // 5-10 blobs per cloud
        const dots: FogCloudDot[] = [{ dx: 0, dy: 0, r: 45 + Math.random() * 30 }]; // larger base
        for (let di = 1; di < numDots; di++) {
          const par   = dots[Math.floor(Math.random() * dots.length)];
          const angle = Math.random() * Math.PI * 2;
          const r     = 32 + Math.random() * 32; // 32-64px
          const dist  = (par.r + r) * (0.40 + Math.random() * 0.45);
          dots.push({ dx: par.dx + Math.cos(angle) * dist, dy: par.dy + Math.sin(angle) * dist * 0.55, r });
        }
        // Pre-bake noise positions: rejection-sample inside blob shapes
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const d of dots) {
          minX = Math.min(minX, d.dx - d.r); maxX = Math.max(maxX, d.dx + d.r);
          minY = Math.min(minY, d.dy - d.r); maxY = Math.max(maxY, d.dy + d.r);
        }
        const bboxW = maxX - minX, bboxH = maxY - minY;
        // pre-sort 180 noise points into 3 colour tiers so render can batch by tier (3 state-changes per cloud)
        const noiseTarget = 180;
        const t0: [number, number][] = [], t1: [number, number][] = [], t2: [number, number][] = [];
        for (let attempt = 0; attempt < noiseTarget * 10 && (t0.length + t1.length + t2.length) < noiseTarget; attempt++) {
          const px = minX + Math.random() * bboxW;
          const py = minY + Math.random() * bboxH;
          for (const d of dots) {
            const ex = px - d.dx, ey = py - d.dy;
            if (ex * ex + ey * ey < d.r * d.r) {
              const nt = Math.random();
              if (nt > 0.68) t2.push([px, py]);
              else if (nt > 0.36) t1.push([px, py]);
              else t0.push([px, py]);
              break;
            }
          }
        }
        return {
          bx:   Math.random() * bufW,
          by:   fogTop + 0.02 * areaH + Math.random() * 0.96 * areaH,
          spd:  (Math.random() < 0.5 ? 1 : -1) * (0.18 + Math.random() * 0.38),
          alpha: 0.25 + Math.random() * 0.75,
          dots,
          noiseTiers: [t0, t1, t2],
        };
      });
    } else {
      g.fogClouds = [];
    }
    // Cosmic Dark Ages (lv77+): inverted fog — a dark veil with light-holes around balls.
    // Mutually exclusive with fog (same level never has both). Decided here (after fog) with
    // Math.random so generateLevel's deterministic stream is untouched — same pattern as wind.
    g.cosmicDarkAgesActive = false;
    g.cdaAlpha = 0;
    g.cdaGhosts = [];
    if (lv >= 77 && !g.fogActive && Math.random() < 0.40) {
      g.cosmicDarkAgesActive = true;
    }
    g.warpWalls = lv <= 2 ? false : g.rng() < 0.5;
    // Loop walls wrap balls around the edges, so partial wall gimmicks (warp/distort/
    // vanish segments) have no effect there — drop them to avoid dead/confusing visuals.
    if (g.warpWalls) g.wallSegments = [];
    // Wind is now a per-level chance (rises with level), so some levels are calm.
    // The whether-wind decision uses Math.random; the level's peg/hazard layout is
    // already fixed here (wind is set after generateLevel), so g.rng isn't perturbed.
    const windProb = Math.min(0.75, 0.35 + (lv - 4) * 0.025);
    if (lv >= 4 && Math.random() < windProb) {
      const dir      = lv % 2 === 0 ? 1 : -1;
      const isNarrow = Math.random() < 0.5;
      const base     = lv >= 12 ? WIND_STORM : Math.min(WIND_MAX, (lv - 3) * 0.003);
      if (isNarrow) {
        const narrowW    = Math.round(g.W * WIND_NARROW_FRAC);
        g.windForce  = base * WIND_NARROW_MULT * dir;
        g.windRange  = narrowW;
        g.windCenter = Math.round(narrowW / 2 + g.rng() * (g.W - narrowW));
        // Random rectangle for dust: 30-55% of play area height, random vertical position
        const playTop = Math.round(g.H * 0.08 + 16);
        const playH   = g.H - playTop;
        const rectH   = Math.round(playH * (0.30 + g.rng() * 0.25));
        g.windRectY0  = playTop + Math.round(g.rng() * (playH - rectH));
        g.windRectY1  = g.windRectY0 + rectH;
      } else {
        g.windForce  = base * dir;
        g.windRange  = g.W;
        g.windCenter = Math.round(g.W / 2);
        g.windRectY0 = 0; g.windRectY1 = 0;
      }
    } else {
      g.windForce  = 0;
      g.windRange  = g.W;
      g.windCenter = Math.round(g.W / 2);
      g.windRectY0 = 0; g.windRectY1 = 0;
    }
    // Dark Flow (lv58+): decided the same way as wind above (Math.random(), not g.rng) since
    // it must never co-occur with wind and wind's own presence isn't known until this point.
    // The level's peg/hazard layout is already fixed by generateLevel, so this doesn't
    // perturb g.rng's determinism (same reasoning as the wind block above).
    if (lv >= 58 && g.windForce === 0 && Math.random() < 0.45) {
      g.darkFlow = {
        theta0: Math.random() * Math.PI * 2,
        accel: Math.min(DF_ACCEL_MAX, DF_ACCEL_BASE + Math.max(0, lv - 58) * DF_ACCEL_PER_LV),
      };
    } else {
      g.darkFlow = null;
    }
    setLevel(lv);
    setOrangeLeft(orangeTotal);
    setWarpWalls(g.warpWalls);
    setPhase('aiming');
  }, []);

  // ── Start game ───────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    syncSize();
    const g = G.current;
    g.rng       = makeRng(Date.now());
    if (g.bgDots.length === 0) g.bgDots = initBgDots(g.W, g.H);
    g.shotsLeft = SHOTS_START;
    g.score     = 0;
    g.bucketDir = 1;
    setShotsLeft(SHOTS_START);
    setScore(0);
    setRetired(false);
    setConfirmRetire(false);
    setTxState('idle');
    setTxHash(null);
    preventNextFire.current = true; // block the pointerUp that follows this tap
    initLevel(1);
  }, [syncSize, initLevel]);

  // ── Pause / Resume ───────────────────────────────────────────────────────
  const handlePause = useCallback(() => {
    const g = G.current;
    if (g.phase !== 'aiming' && g.phase !== 'firing') return;
    g.prePausePhase = g.phase;
    g.phase = 'paused';
    setPhase('paused');
  }, []);

  const handleResume = useCallback(() => {
    const g = G.current;
    if (g.phase !== 'paused') return;
    setConfirmRetire(false);
    g.phase = g.prePausePhase;
    setPhase(g.prePausePhase);
  }, []);

  // ── Retire (only from pause menu) ────────────────────────────────────────
  const handleRetire = useCallback(() => {
    const g = G.current;
    if (g.phase !== 'paused') return;
    g.balls = [];
    g.burstRemaining = 0;
    g.phase = 'gameover';
    setConfirmRetire(false);
    setRetired(true);
    setPhase('gameover');
  }, []);

  // ── Start burst ───────────────────────────────────────────────────────────
  const fireBall = useCallback(() => {
    const g = G.current;
    if (g.phase !== 'aiming' || g.shotsLeft <= 0) return;
    // Boss re-armor happens ONLY when the player fires the next shot (not on a timer).
    const b = g.boss;
    if (b && b.hp > 0) {
      const enraged  = b.hp <= b.maxHp * 0.30;
      const armorHp  = b.tier >= 3 ? 3 : SHIELD_HP;
      const restoreN = (b.tier >= 3 ? 2 : 1) + (enraged ? 1 : 0);
      const downed = g.pegs.filter(p => p.bossArmor && p.cleared);
      let restored = 0;
      for (let k = 0; k < restoreN && downed.length > 0; k++) {
        const idx = Math.floor(Math.random() * downed.length);
        const tpeg = downed[idx]; downed.splice(idx, 1);
        tpeg.cleared = false; tpeg.hp = armorHp; tpeg.hitCool = 0; restored++;
        if (tpeg.armorAngle !== undefined) {
          tpeg.x = b.x + Math.cos(tpeg.armorAngle) * b.armorR;
          tpeg.y = b.y + Math.sin(tpeg.armorAngle) * b.armorR;
        }
      }
      if (restored > 0) b.rearmFlash = 18;
    }
    // Dynamic refill throttle (hidden): fewer bucket balls when you're flush.
    const f = refillFactor(g.level, g.shotsLeft);
    g.burstBucketProb = BUCKET_BALL_PROB * f;
    g.burstLuckyIdx   = f >= 0.6 ? Math.floor(Math.random() * BALLS_PER_SHOT) : -1; // guaranteed catch only when low-ish
    g.bossRefillLeft  = 3; // boss armor breaks can refill up to +3 this volley
    g.burstAngle     = g.aimAngle;
    g.burstRemaining = BALLS_PER_SHOT;
    g.burstTimer     = 0; // launch first ball immediately
    g.burstTime      = 0;
    g.shotsLeft--;
    g.phase = 'firing';
    setShotsLeft(g.shotsLeft);
    setPhase('firing');
  }, []);

  // Boss gimmick: breaking a boss-armor shield refills a shot, capped at 3/volley.
  const armorRefill = useCallback(() => {
    const g = G.current;
    if (g.bossRefillLeft <= 0) return;
    g.bossRefillLeft--;
    g.shotsLeft++;
    setShotsLeft(g.shotsLeft);
    setRefillPopup({ n: 1, key: g.frame });
  }, []);

  // ── Update aim angle from pointer position ────────────────────────────────
  const updateAim = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    const g  = G.current;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const raw = Math.atan2(px - g.launcherX, py - g.launcherY);
    // clamp to ±82° from vertical; always fires downward
    g.aimAngle = Math.max(-1.43, Math.min(1.43, raw));
  }, []);

  // ── Pointer events ───────────────────────────────────────────────────────
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (G.current.phase !== 'aiming') return;
    updateAim(e.clientX, e.clientY, (e.currentTarget as HTMLElement).getBoundingClientRect());
  }, [updateAim]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const g = G.current;
    if (g.phase === 'idle') { startGame(); return; }
    if (g.phase === 'aiming') {
      updateAim(e.clientX, e.clientY, (e.currentTarget as HTMLElement).getBoundingClientRect());
    }
  }, [startGame, updateAim]);

  const handlePointerUp = useCallback(() => {
    // Discard the pointerUp that follows game-start to prevent instant firing
    if (preventNextFire.current) { preventNextFire.current = false; return; }
    if (G.current.phase === 'aiming') fireBall();
  }, [fireBall]);

  // ── Render loop ──────────────────────────────────────────────────────────
  const loopFnRef = useRef<() => void>(() => {});
  const speedRef  = useRef<1|2|3>(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // alpha:false — every rendered frame paints the full canvas opaque cream first and the
    // wrapper div behind it is the same cream, so an opaque backing store is safe and lets the
    // browser skip alpha compositing of the canvas layer. Invariant: loop() must always run the
    // background fill before returning, or the opaque store would expose black instead of cream.
    // Cache once — getContext per frame is wasteful.
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    // An opaque backing store defaults to black; paint it cream before the first rAF so the
    // stretched canvas never flashes black between mount and the first loop() frame.
    ctx.fillStyle = '#ede9df';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const loop = () => {
      const g = G.current;

      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== g.W * dpr || canvas.height !== g.H * dpr) {
        canvas.width  = g.W * dpr;
        canvas.height = g.H * dpr;
        ctx.scale(dpr, dpr);
      }
      const steps = (g.phase === 'aiming' || g.phase === 'firing') ? speedRef.current : 1;
      for (let _step = 0; _step < steps; _step++) {
      const { W, H, launcherX, launcherY } = g;
      g.frame++;

      // ── Background fill ──────────────────────────────────────────────────
      ctx.fillStyle = '#ede9df';
      ctx.fillRect(0, 0, W, H);

      // ── Background floating dot clusters ─────────────────────────────────
      if (g.phase !== 'idle') {
        g.bgClusterTimer--;
        if (g.bgClusterTimer <= 0 && g.bgDots.length < 300) {
          g.bgClusterTimer = 55 + Math.floor(Math.random() * 70);
          const cx = 60 + Math.random() * (W - 120);
          const cy = 60 + Math.random() * (H - 120);
          g.bgDots.push(...spawnBgCluster(W, H, cx, cy, 10 + Math.floor(Math.random() * 10)));
        }
      }
      ctx.fillStyle = '#0f0f0d';
      const bg = g.bgDots;
      // Dark Flow: bias the background dust's drift toward the current flow direction — its
      // only "visible" trace, since the hazard has no dedicated light source of its own.
      let dfBiasX = 0, dfBiasY = 0;
      if (g.darkFlow) {
        const dfAngle = g.darkFlow.theta0 + g.frame * DF_ANGULAR_SPEED;
        dfBiasX = Math.cos(dfAngle) * DF_BG_BIAS;
        dfBiasY = Math.sin(dfAngle) * DF_BG_BIAS;
      }
      for (let bi = 0; bi < bg.length; bi++) {
        const d = bg[bi];
        d.age++; d.x += d.vx + dfBiasX; d.y += d.vy + dfBiasY;
        if (d.x < -8)    d.x = W + 4;
        if (d.x > W + 8) d.x = -4;
        if (d.y < -8)    d.y = H + 4;
        if (d.y > H + 8) d.y = -4;
        const p = d.age / d.maxAge;
        if (p < 0.15)      d.alpha = Math.min(d.targetAlpha, d.alpha + d.targetAlpha / (d.maxAge * 0.15));
        else if (p > 0.75) d.alpha = Math.max(0, d.alpha - d.targetAlpha / (d.maxAge * 0.25));
        // Big Rip: visually stretch bgDots outward from board center during the event
        // (draw offset only — real positions are not permanently mutated).
        let drawDx = 0, drawDy = 0;
        if (g.bigRip && g.bigRip.bgStretch > 0) {
          const s = 1 + g.bigRip.bgStretch * 0.35;
          drawDx = (d.x - W / 2) * (s - 1);
          drawDy = (d.y - H / 2) * (s - 1);
        }
        ctx.globalAlpha = d.alpha;
        // The Nothing: skip drawing bgDots inside the blank circle — the absence of ink
        // is the only evidence the region exists (no border, no decoration).
        let skipBg = false;
        for (const tn of g.theNothings) {
          const dx = d.x - tn.x, dy = d.y - tn.y;
          if (dx * dx + dy * dy < NOTHING_RANGE * NOTHING_RANGE) { skipBg = true; break; }
        }
        if (!skipBg) ctx.fillRect(Math.round(d.x + drawDx), Math.round(d.y + drawDy), d.size, d.size);
        if (d.age >= d.maxAge) bg[bi] = spawnBgDot(W, H); // replace in place, no per-frame realloc
      }
      ctx.globalAlpha = 1;

      // Dark Flow: faint edge dust streaks hinting at the flow direction — no other visible
      // trace, per spec ("something unseen pulling everything," not a drawn hazard object).
      if (g.darkFlow) {
        const dfAngle = g.darkFlow.theta0 + g.frame * DF_ANGULAR_SPEED;
        const dcos = Math.cos(dfAngle), dsin = Math.sin(dfAngle);
        const perim = 2 * (W + H);
        ctx.fillStyle = '#0f0f0d';
        for (let i = 0; i < 14; i++) {
          const edgeT = (i / 14 + g.frame * 0.0006) % 1;
          const d = edgeT * perim;
          let ex: number, ey: number;
          if (d < W)              { ex = d;              ey = 0; }
          else if (d < W + H)     { ex = W;               ey = d - W; }
          else if (d < 2 * W + H) { ex = W - (d - W - H); ey = H; }
          else                    { ex = 0;               ey = H - (d - 2 * W - H); }
          ctx.globalAlpha = 0.1;
          ctx.fillRect(Math.round(ex + dcos * i * 3), Math.round(ey + dsin * i * 3), 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      if (g.phase === 'idle') break;

      // ── Wall indicators ──────────────────────────────────────────────────
      if (!g.warpWalls) {
        ctx.save();
        ctx.strokeStyle = 'rgba(15,15,13,0.28)';
        ctx.lineWidth   = 2;
        ctx.setLineDash([6, 8]);
        ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(1, H);    ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W - 1, 0); ctx.lineTo(W - 1, H); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // ── Bumpers ───────────────────────────────────────────────────────────
      for (const bumper of g.bumpers) {
        if (bumper.angularVel) bumper.angle += bumper.angularVel;
        if (bumper.hitFlash > 0) bumper.hitFlash--;
        if (bumper.hitCool  > 0) bumper.hitCool--;

        if (bumper.hitFlash > 0) {
          const t      = bumper.hitFlash / BUMPER_FLASH;
          const pulse  = 0.5 + Math.abs(Math.sin(g.frame * 0.6)) * 0.5;
          const hitIdx = bumper.hitCount % FLASH_COLORS.length;
          const color1 = FLASH_COLORS[hitIdx];
          const color2 = FLASH_COLORS[(hitIdx + 1) % FLASH_COLORS.length];
          const cos    = Math.cos(bumper.angle), sin = Math.sin(bumper.angle);

          // Soft bloom: draw each dot 3× at expanding sizes with fading alpha
          // outer pass uses complementary color for two-tone glow
          const bloomPasses = [
            { extra: 4, aFactor: 0.15, color: color2 },
            { extra: 2, aFactor: 0.28, color: color1 },
            { extra: 1, aFactor: 0.52, color: color1 },
          ] as const;
          const sA = Math.sin(g.frame * 0.038), cA = Math.cos(g.frame * 0.038);
          const sB = Math.sin(g.frame * 0.031), cB = Math.cos(g.frame * 0.031);
          for (const pass of bloomPasses) {
            ctx.fillStyle = pass.color;
            for (const d of bumper.dots) {
              const jx = (sA * d.cosP  + cA * d.sinP)  * 0.55;
              const jy = (cB * d.cosP2 - sB * d.sinP2) * 0.55;
              const rx = (d.x + jx) * cos - (d.y + jy) * sin;
              const ry = (d.x + jx) * sin + (d.y + jy) * cos;
              const sz = d.size + pass.extra;
              ctx.globalAlpha = d.alpha * t * pulse * pass.aFactor;
              ctx.fillRect(Math.round(bumper.cx + rx - sz * 0.5),
                           Math.round(bumper.cy + ry - sz * 0.5), sz, sz);
            }
          }
          ctx.globalAlpha = 1;

          // Core dots in flash color
          drawDots(ctx, bumper.dots, bumper.cx, bumper.cy, bumper.angle, g.frame, color1, 1.0);
        } else {
          drawDots(ctx, bumper.dots, bumper.cx, bumper.cy, bumper.angle, g.frame, '#0f0f0d', 1.0);
        }
      }

      // ── Boss update: movement, re-armor, enrage (scales with boss tier) ──────
      if (g.boss && g.boss.hp > 0 && (g.phase === 'aiming' || g.phase === 'firing')) {
        const b = g.boss;
        if (b.hitFlash   > 0) b.hitFlash--;
        if (b.hitCool    > 0) b.hitCool--;
        if (b.rearmFlash > 0) b.rearmFlash--;
        const enraged = b.hp <= b.maxHp * 0.30;
        // Movement (tier 2+): drift horizontally, faster when enraged; armor follows.
        if (b.vx !== 0) {
          b.x += b.vx * (enraged ? 1.5 : 1);
          if (b.x <= b.moveMinX) { b.x = b.moveMinX; b.vx =  Math.abs(b.vx); }
          if (b.x >= b.moveMaxX) { b.x = b.moveMaxX; b.vx = -Math.abs(b.vx); }
          for (const p of g.pegs) {
            if (!p.bossArmor || p.armorAngle === undefined) continue;
            p.x = b.x + Math.cos(p.armorAngle) * b.armorR;
            p.y = b.y + Math.sin(p.armorAngle) * b.armorR;
          }
        }
        // Re-armor itself is triggered on fire (see fireBall), not on a timer.
      }

      // ── Grav zones (black hole, swirling sand storm) ─────────────────────
      for (const zone of g.gravZones) {
        if (zone.flashTimer > 0) zone.flashTimer--;
        const cx      = zone.x + zone.w / 2;
        const cy      = zone.y + zone.h / 2;
        const maxR    = zone.h * 1.55;
        const bhRange = zone.h * BH_PULL_RANGE_FACTOR; // physics pull radius
        const bh      = getBHTables(zone, cx, cy, maxR, bhRange);

        // ── Influence range ring: sparse dots at physics pull boundary ──────
        {
          const pulse = 0.14 + Math.sin(g.frame * 0.07) * 0.06;
          const s11 = Math.sin(g.frame * 0.11), c11 = Math.cos(g.frame * 0.11);
          ctx.fillStyle = '#440011';
          for (let i = 0; i < 48; i++) {
            ctx.globalAlpha = pulse * (0.7 + (s11 * bh.infAlC[i] + c11 * bh.infAlS[i]) * 0.3);
            ctx.fillRect(bh.infX[i], bh.infY[i], 2, 2);
          }
          ctx.globalAlpha = 1;
        }
        const t       = g.frame * 0.010; // very slow base rotation
        const f       = g.frame;         // shorthand for wobble phases
        const flicker = 0.80 + Math.sin(f * 0.19) * 0.20;

        // ── Sand veil A: outer fibonacci dust (360 grains) + wobble ──────────
        {
          const va = bh.veilA;
          const sW = Math.sin(t * 0.18),  cW = Math.cos(t * 0.18);
          const s1 = Math.sin(f * 0.053), c1 = Math.cos(f * 0.053);
          const s2 = Math.sin(f * 0.047), c2 = Math.cos(f * 0.047);
          const sT = Math.sin(t * 0.07),  cT = Math.cos(t * 0.07);
          for (let i = 0; i < 360; i++) {
            const r = va.rBase[i] * (0.91 + (sW * va.wobC[i] + cW * va.wobS[i]) * 0.09);
            if (r > maxR * 1.04) continue;
            const angle = va.a0![i] + t * va.aK![i];
            const wx    = (s1 * va.w1C[i] + c1 * va.w1S[i]) * 3.5;
            const wy    = (c2 * va.w2C[i] - s2 * va.w2S[i]) * 3.5;
            ctx.globalAlpha = flicker * va.aB[i] * (0.32 + (sT * va.alC[i] + cT * va.alS[i]) * 0.14);
            ctx.fillStyle   = va.color[i];
            ctx.fillRect(Math.round(cx + Math.cos(angle) * r + wx), Math.round(cy + Math.sin(angle) * r + wy), 1, 1);
          }
        }

        // ── Sand veil B: second offset dust cloud (240 grains) + wobble ──────
        {
          const vb = bh.veilB;
          const sW = Math.sin(t * 0.14),  cW = Math.cos(t * 0.14);
          const s1 = Math.sin(f * 0.061), c1 = Math.cos(f * 0.061);
          const s2 = Math.sin(f * 0.044), c2 = Math.cos(f * 0.044);
          const sT = Math.sin(t * 0.09),  cT = Math.cos(t * 0.09);
          for (let i = 0; i < 240; i++) {
            const r = vb.rBase[i] * (0.89 + (sW * vb.wobC[i] + cW * vb.wobS[i]) * 0.11);
            if (r > maxR * 1.02) continue;
            const angle = vb.a0![i] + t * vb.aK![i] + Math.PI;
            const wx    = (s1 * vb.w1C[i] + c1 * vb.w1S[i]) * 2.8;
            const wy    = (c2 * vb.w2C[i] - s2 * vb.w2S[i]) * 2.8;
            ctx.globalAlpha = flicker * vb.aB[i] * (0.22 + (sT * vb.alC[i] + cT * vb.alS[i]) * 0.10);
            ctx.fillStyle   = vb.color[i];
            ctx.fillRect(Math.round(cx + Math.cos(angle) * r + wx), Math.round(cy + Math.sin(angle) * r + wy), 1, 1);
          }
        }

        // ── Inner storm A: counter-spiral (280 grains) + wobble ───────────────
        {
          const sa = bh.stormA;
          const sW = Math.sin(t * 0.24),  cW = Math.cos(t * 0.24);
          const sR = Math.sin(t * 1.4),   cR = Math.cos(t * 1.4);
          const s1 = Math.sin(f * 0.058), c1 = Math.cos(f * 0.058);
          const s2 = Math.sin(f * 0.051), c2 = Math.cos(f * 0.051);
          const sT = Math.sin(t * 0.12),  cT = Math.cos(t * 0.12);
          for (let i = 0; i < 280; i++) {
            const r  = sa.rBase[i] * (0.87 + (sW * sa.wobC[i] + cW * sa.wobS[i]) * 0.13);
            const ca = sa.a0C![i] * cR + sa.a0S![i] * sR; // cos(a0 - t*1.4)
            const sn = sa.a0S![i] * cR - sa.a0C![i] * sR; // sin(a0 - t*1.4)
            const wx = (s1 * sa.w1C[i] + c1 * sa.w1S[i]) * 2.5;
            const wy = (c2 * sa.w2C[i] - s2 * sa.w2S[i]) * 2.5;
            const sz = sa.sz![i], half = sz >> 1;
            ctx.globalAlpha = flicker * sa.aB[i] * (0.60 + (sT * sa.alC[i] + cT * sa.alS[i]) * 0.24);
            ctx.fillStyle   = sa.color[i];
            ctx.fillRect(Math.round(cx + ca * r + wx) - half, Math.round(cy + sn * r + wy) - half, sz, sz);
          }
        }

        // ── Inner storm B: clockwise fast layer (180 grains) + wobble ─────────
        {
          const sb = bh.stormB;
          const sW = Math.sin(t * 0.30),  cW = Math.cos(t * 0.30);
          const sR = Math.sin(t * 2.1),   cR = Math.cos(t * 2.1);
          const s1 = Math.sin(f * 0.067), c1 = Math.cos(f * 0.067);
          const s2 = Math.sin(f * 0.055), c2 = Math.cos(f * 0.055);
          const sT = Math.sin(t * 0.16),  cT = Math.cos(t * 0.16);
          for (let i = 0; i < 180; i++) {
            const r  = sb.rBase[i] * (0.90 + (sW * sb.wobC[i] + cW * sb.wobS[i]) * 0.10);
            const ca = sb.a0C![i] * cR - sb.a0S![i] * sR; // cos(a0 + t*2.1)
            const sn = sb.a0S![i] * cR + sb.a0C![i] * sR; // sin(a0 + t*2.1)
            const wx = (s1 * sb.w1C[i] + c1 * sb.w1S[i]) * 2.2;
            const wy = (c2 * sb.w2C[i] - s2 * sb.w2S[i]) * 2.2;
            ctx.globalAlpha = flicker * sb.aB[i] * (0.45 + (sT * sb.alC[i] + cT * sb.alS[i]) * 0.18);
            ctx.fillStyle   = sb.color[i];
            ctx.fillRect(Math.round(cx + ca * r + wx), Math.round(cy + sn * r + wy), 1, 1);
          }
        }

        ctx.globalAlpha = 1;

        // ── Halo rings (original 11 rings) — static, non-rotating ────────────
        for (const ring of bh.halo) {
          const alpha = flicker * 0.88 * ring.powV;
          if (alpha < 0.02) continue;
          ctx.globalAlpha = alpha;
          ctx.fillStyle   = ring.color;
          const { xs, ys, sz } = ring;
          for (let j = 0; j < xs.length; j++) ctx.fillRect(xs[j], ys[j], sz, sz);
        }

        // ── 4 spiral arms (90 dots/arm) + wobble jitter ───────────────────────
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t);
        {
          const am = bh.arm;
          const sJ = Math.sin(t * 0.28),  cJ = Math.cos(t * 0.28);
          const s1 = Math.sin(f * 0.053), c1 = Math.cos(f * 0.053);
          const sK = Math.sin(t * 0.23),  cK = Math.cos(t * 0.23);
          const s2 = Math.sin(f * 0.047), c2 = Math.cos(f * 0.047);
          for (let arm = 0; arm < 4; arm++) {
            ctx.rotate(Math.PI / 2);
            for (let i = 0; i < 90; i++) {
              const idx = arm * 90 + i;
              const jx = (sJ * am.j1C[idx] + cJ * am.j1S[idx]) * 4.0 + (s1 * am.j2C[idx] + c1 * am.j2S[idx]) * 4.0;
              const jy = (cK * am.k1C[idx] - sK * am.k1S[idx]) * 3.5 + (c2 * am.k2C[idx] - s2 * am.k2S[idx]) * 4.0;
              const sz = am.sz[idx];
              ctx.globalAlpha = am.aB[idx] * flicker;
              ctx.fillStyle   = am.color[idx];
              ctx.fillRect(Math.round(am.bx[idx] + jx) - (sz >> 1), Math.round(am.by[idx] + jy) - (sz >> 1), sz, sz);
            }
          }
        }
        ctx.restore();

        // ── 16 outer tendrils (36 dots each) + wobble ─────────────────────────
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-t * 1.95);
        {
          const tn = bh.ten;
          const sJ = Math.sin(t * 0.38),  cJ = Math.cos(t * 0.38);
          const s1 = Math.sin(f * 0.059), c1 = Math.cos(f * 0.059);
          const sW = Math.sin(f * 0.043), cW = Math.cos(f * 0.043);
          for (let i = 0; i < 16; i++) {
            ctx.rotate(Math.PI / 8);
            for (let j = 0; j < 36; j++) {
              const idx = i * 36 + j;
              const jitter   = (sJ * tn.j1C[idx] + cJ * tn.j1S[idx]) * 3.5
                             + (s1 * tn.j2C[idx] + c1 * tn.j2S[idx]) * 3.0;
              const wobAlong = Math.round((cW * tn.wC[idx] - sW * tn.wS[idx]) * 2.5);
              ctx.globalAlpha = tn.aB[idx] * flicker;
              ctx.fillStyle   = tn.color[idx];
              ctx.fillRect(tn.x0[idx] + wobAlong, Math.round(jitter), 1, 1);
            }
          }
        }
        ctx.restore();

        // ── 5 counter-rotating rings (48–112 dots) + wobble ───────────────────
        {
          const s1 = Math.sin(f * 0.053), c1 = Math.cos(f * 0.053);
          const s2 = Math.sin(f * 0.047), c2 = Math.cos(f * 0.047);
          const sT = Math.sin(f * 0.09),  cT = Math.cos(f * 0.09);
          for (const ring of bh.rings) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-t * ring.spd);
            ctx.fillStyle = ring.color;
            const dotN = ring.bx.length;
            for (let i = 0; i < dotN; i++) {
              const wx = (s1 * ring.w1C[i] + c1 * ring.w1S[i]) * 2.5;
              const wy = (c2 * ring.w2C[i] - s2 * ring.w2S[i]) * 2.5;
              ctx.globalAlpha = flicker * (0.26 + (sT * ring.alC[i] + cT * ring.alS[i]) * 0.16);
              ctx.fillRect(Math.round(ring.bx[i] + wx) - 1, Math.round(ring.by[i] + wy) - 1, 2, 2);
            }
            ctx.restore();
          }
        }

        // ── Event horizon: solid near-black disc (smaller) ────────────────
        ctx.fillStyle = '#080004';
        for (const run of bh.horizon) {
          ctx.globalAlpha = run.alpha;
          const { xs, ys } = run;
          for (let j = 0; j < xs.length; j++) ctx.fillRect(xs[j], ys[j], 2, 2);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#000';
        ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2);

        // ── Accretion ring: triple-pass blood-red ─────────────────────────
        {
          const accPulse = (0.72 + Math.sin(g.frame * 0.11) * 0.28) * flicker;
          const s13 = Math.sin(g.frame * 0.13), c13 = Math.cos(g.frame * 0.13);
          for (const pass of bh.acc) {
            ctx.fillStyle = pass.color;
            const dotN = pass.xs.length;
            for (let i = 0; i < dotN; i++) {
              ctx.globalAlpha = accPulse * pass.factor * (0.68 + (s13 * pass.alC[i] + c13 * pass.alS[i]) * 0.32);
              ctx.fillRect(pass.xs[i], pass.ys[i], 2, 2);
            }
          }
        }
        // ── Purple flash on ball absorption ───────────────────────────────
        if (zone.flashTimer > 0) {
          const ft  = zone.flashTimer / 36; // 1→0 as it fades
          const exp = 1 - ft;               // 0→1 expansion progress

          // Expanding shockwave ring (grows from centre outward)
          const waveR = bhRange * exp * 0.82;
          const waveA = Math.min(1, ft < 0.35 ? ft * 2.5 : ft * 0.95);
          ctx.fillStyle = '#cc88ff';
          for (let i = 0; i < 72; i++) {
            const a = (i / 72) * Math.PI * 2;
            ctx.globalAlpha = waveA * (0.65 + Math.sin(i * 1.7) * 0.35);
            ctx.fillRect(Math.round(cx + Math.cos(a) * waveR) - 1, Math.round(cy + Math.sin(a) * waveR) - 1, 2, 2);
          }

          // 6 static glow rings (bright → fade)
          const glowColors = ['#ffffff', '#ff99ff', '#ee44ff', '#bb22ee', '#8800bb', '#550088'] as const;
          for (let ri = 0; ri < 6; ri++) {
            const fr   = maxR * (0.09 + ri * 0.19);
            const dotN = 44 + ri * 8;
            const sz   = ri < 2 ? 3 : 2;
            ctx.fillStyle = glowColors[ri];
            for (let i = 0; i < dotN; i++) {
              const a = (i / dotN) * Math.PI * 2;
              ctx.globalAlpha = ft * (0.95 - ri * 0.09) * (0.72 + Math.sin(i * 1.7) * 0.28);
              ctx.fillRect(Math.round(cx + Math.cos(a) * fr) - (sz >> 1), Math.round(cy + Math.sin(a) * fr) - (sz >> 1), sz, sz);
            }
          }

          // Core white burst (only first ~12 frames, ft > 0.67)
          if (ft > 0.67) {
            const coreT = (ft - 0.67) / 0.33;
            ctx.fillStyle = '#ffffff';
            for (let r = 2; r <= maxR * 0.48; r += 2.5) {
              const dc = Math.max(1, Math.round(2 * Math.PI * r / 2.8));
              ctx.globalAlpha = coreT * (1 - r / (maxR * 0.48)) * 0.92;
              for (let j = 0; j < dc; j++) {
                const a = (j / dc) * Math.PI * 2;
                ctx.fillRect(Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 2, 2);
              }
            }
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Wormholes ────────────────────────────────────────────────────────
      for (const wh of g.wormholes) {
        wh.cycleTimer = (wh.cycleTimer + 1) % WORMHOLE_CYCLE;
        if (wh.hitCool   > 0) wh.hitCool--;
        if (wh.flashTimer > 0) wh.flashTimer--;

        const cosA = Math.cos(wh.angle), sinA = Math.sin(wh.angle);

        // ── Teleport flash (drawn even during invisible phase) ────────────
        if (wh.flashTimer > 0) {
          const ft  = wh.flashTimer / 28;  // 1→0
          const exp = 1 - ft;               // 0→1 (expansion)

          // Outer expanding oval shockwave
          const rA  = wh.w * 0.5 + 4 + exp * 42;
          const rB  = 6 + exp * 28;
          const ringCol = ft > 0.6 ? '#ffffff' : ft > 0.3 ? '#ee88ff' : '#aa33ff';
          ctx.fillStyle = ringCol;
          for (let i = 0; i < 56; i++) {
            const a  = (i / 56) * Math.PI * 2;
            const lx = Math.cos(a) * rA, ly = Math.sin(a) * rB;
            const wx = wh.cx + lx * cosA - ly * sinA;
            const wy = wh.cy + lx * sinA + ly * cosA;
            ctx.globalAlpha = ft * 0.92;
            const sz = ft > 0.55 ? 3 : 2;
            ctx.fillRect(Math.round(wx) - (sz >> 1), Math.round(wy) - (sz >> 1), sz, sz);
          }

          // Inner oval ring (white, slightly smaller)
          if (ft > 0.2) {
            const rA2 = wh.w * 0.5 + 2 + exp * 20;
            const rB2 = 3 + exp * 14;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 36; i++) {
              const a  = (i / 36) * Math.PI * 2;
              const lx = Math.cos(a) * rA2, ly = Math.sin(a) * rB2;
              const wx = wh.cx + lx * cosA - ly * sinA;
              const wy = wh.cy + lx * sinA + ly * cosA;
              ctx.globalAlpha = ((ft - 0.2) / 0.8) * 0.80;
              ctx.fillRect(Math.round(wx) - 1, Math.round(wy) - 1, 2, 2);
            }
          }

          // Core bar bright glow (dense scanline fill along the bar)
          const coreCol = ft > 0.65 ? '#ffffff' : ft > 0.35 ? '#ddaaff' : '#aa55ff';
          ctx.fillStyle = coreCol;
          const hw = wh.w * 0.5 + 3, hh = 5;
          for (let bx = -hw; bx <= hw; bx += 2.0) {
            for (let by = -hh; by <= hh; by += 2.0) {
              const wx = wh.cx + bx * cosA - by * sinA;
              const wy = wh.cy + bx * sinA + by * cosA;
              ctx.globalAlpha = ft * 0.95;
              ctx.fillRect(Math.round(wx), Math.round(wy), 1, 1);
            }
          }
          ctx.globalAlpha = 1;
        }

        const ct = wh.cycleTimer;
        if (ct >= WORMHOLE_ACTIVE) continue; // invisible phase, skip normal draw

        let fadeAlpha = 1.0;
        if (ct < WORMHOLE_FADE)
          fadeAlpha = (ct + 1) / WORMHOLE_FADE;
        else if (ct >= WORMHOLE_ACTIVE - WORMHOLE_FADE)
          fadeAlpha = (WORMHOLE_ACTIVE - ct) / WORMHOLE_FADE;

        // Aura dots (purple mowa mowa cloud) — aura cosP2/sinP2 hold cos/sin(phase*1.3)
        const sJ = Math.sin(g.frame * 0.042), cJ = Math.cos(g.frame * 0.042);
        const sK = Math.sin(g.frame * 0.037), cK = Math.cos(g.frame * 0.037);
        const sL = Math.sin(g.frame * 0.055), cL = Math.cos(g.frame * 0.055);
        for (const d of wh.auraDots) {
          const jx = (sJ * d.cosP  + cJ * d.sinP)  * 1.4;
          const jy = (cK * d.cosP2 - sK * d.sinP2) * 1.4;
          const lx = d.x + jx, ly = d.y + jy;
          const ax = wh.cx + lx * cosA - ly * sinA;
          const ay = wh.cy + lx * sinA + ly * cosA;
          const col = d.phase < 2.1 ? '#6622cc' : d.phase < 4.2 ? '#aa44ff' : '#dd88ff';
          ctx.fillStyle = col;
          ctx.globalAlpha = d.alpha * fadeAlpha * (0.6 + (sL * d.cosP + cL * d.sinP) * 0.4);
          ctx.fillRect(Math.round(ax), Math.round(ay), d.size, d.size);
        }
        ctx.globalAlpha = 1;

        // Bar dots (purple, pulsing slightly out-of-phase per pair)
        const pulse = 0.72 + Math.sin(g.frame * 0.09 + wh.pairId * Math.PI) * 0.28;
        drawDots(ctx, wh.dots, wh.cx, wh.cy, wh.angle, g.frame, '#9933ee', fadeAlpha * pulse);
      }

      // ── Wind dust (non-storm): drifting streaks across the wind zone ─────
      // Handles BOTH the narrow rectangle and full-screen wind (previously the
      // full-screen case drew nothing, making the wind nearly invisible).
      if (g.windForce !== 0 && Math.abs(g.windForce) < WIND_STORM) {
        const dir      = g.windForce > 0 ? 1 : -1;
        const isNarrow = g.windRange < g.W;
        const zOff = isNarrow ? Math.round(g.windCenter - g.windRange / 2) : 0;
        const zW   = isNarrow ? g.windRange : W;
        const yTop = isNarrow ? g.windRectY0 : Math.round(H * 0.08 + 16);
        const zH   = isNarrow ? Math.max(1, g.windRectY1 - g.windRectY0) : (H - yTop);
        const windNormF = Math.min(1, Math.abs(g.windForce) / (WIND_MAX * WIND_NARROW_MULT));
        const COUNT = isNarrow ? 80 : 130;

        // Dotted border only around the localized (narrow) zone.
        if (isNarrow) {
          ctx.fillStyle = '#7a5830';
          for (let by = yTop; by < g.windRectY1; by += 6) {
            ctx.globalAlpha = 0.30;
            ctx.fillRect(zOff,          Math.round(by), 1, 3);
            ctx.fillRect(zOff + zW - 1, Math.round(by), 1, 3);
          }
          for (let bx = zOff; bx < zOff + zW; bx += 6) {
            ctx.globalAlpha = 0.30;
            ctx.fillRect(Math.round(bx), yTop,              3, 1);
            ctx.fillRect(Math.round(bx), g.windRectY1 - 1, 3, 1);
          }
          ctx.globalAlpha = 1;
        }

        // Drifting sand streaks — length points in the wind direction (clear motion cue).
        const dsh = (n: number) => ((n * 1664525 + 1013904223) >>> 0) / 0x100000000;
        for (let i = 0; i < COUNT; i++) {
          const h1 = dsh(i * 2053);
          const h2 = dsh(i * 2053 + 7919);
          const h3 = dsh(i * 2053 + 15731);
          const h4 = dsh(i * 2053 + 23557);
          const spdBase = h4 < 0.40 ? 0.6 + h4 * 2.5 : 3.0 + h4 * 5.0;
          const spd = spdBase * (0.20 + windNormF * 0.80);
          const spX = dir * spd;
          const spY = (h3 - 0.5) * 0.45;
          const baseY = (i + h2) / COUNT * zH;
          const px = zOff + ((h1 * zW + spX * g.frame) % zW + zW) % zW;
          const py = yTop  + ((baseY   + spY * g.frame) % zH  + zH) % zH;
          const streakLen = Math.round(3 + spd * 1.4);
          const sx = dir > 0 ? Math.round(px) : Math.round(px) - streakLen;
          ctx.fillStyle   = h1 < 0.48 ? '#8a5a28' : '#b58044';
          ctx.globalAlpha = 0.40 + h2 * 0.50;
          ctx.fillRect(sx, Math.round(py), streakLen, spd > 4 ? 2 : 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Great Attractor: dark avoidance band + dust streaks flowing into the off-screen
      // pull, accelerating and fading as they approach the wall. The source itself is never
      // drawn (§2.28: 見えない巨大さの演出) — only its effect on the dust is visible.
      if (g.greatAttractor) {
        const gaBreathe = 0.5 + 0.5 * Math.sin(g.frame * GA_BREATHE_FREQ);
        const gaDir = g.greatAttractor.side; // -1 = pulled toward left wall, 1 = toward right wall
        const GA_BAND_W = 22;

        ctx.fillStyle = '#3a362e';
        ctx.globalAlpha = 0.2;
        ctx.fillRect(gaDir === -1 ? 0 : W - GA_BAND_W, 0, GA_BAND_W, H);
        ctx.globalAlpha = 1;

        const gah = (n: number) => ((n * 1664525 + 1013904223) >>> 0) / 0x100000000;
        const GA_COUNT = Math.round(40 * (0.5 + gaBreathe * 0.7));
        for (let i = 0; i < GA_COUNT; i++) {
          const h1 = gah(i * 733 + 11);
          const h2 = gah(i * 733 + 191);
          const h3 = gah(i * 733 + 337);
          const cycleFrames = 260 - h3 * 120;
          const prog = (((g.frame + h1 * cycleFrames) % cycleFrames) + cycleFrames) % cycleFrames / cycleFrames;
          const eased = prog * prog; // ease-in: slow start, fast finish — reads as acceleration
          const dist = (1 - eased) * W; // distance from the near wall
          const px = gaDir === -1 ? dist : W - dist;
          const py = h2 * H;
          const streakLen = Math.round(2 + eased * 5);
          const sx = gaDir === -1 ? Math.round(px) : Math.round(px) - streakLen;
          ctx.fillStyle   = '#5a5648';
          ctx.globalAlpha = (0.15 + gaBreathe * 0.35) * (1 - eased * 0.9);
          ctx.fillRect(sx, Math.round(py), streakLen, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Sand storm particles (level 12+, zone-aware) ─────────────────────
      if (Math.abs(g.windForce) >= WIND_STORM) {
        const dir  = g.windForce > 0 ? 1 : -1;
        const zW   = g.windRange;
        const zOff = Math.round(g.windCenter - zW / 2);
        const sh   = (n: number) => ((n * 1664525 + 1013904223) >>> 0) / 0x100000000;
        for (let i = 0; i < 65; i++) {
          const h1 = sh(i), h2 = sh(i + 1000), h3 = sh(i + 2000), h4 = sh(i + 3000);
          const spX = dir * (1.5 + h3 * 2.5);
          const spY = (h4 - 0.5) * 0.8;
          const px  = zOff + ((h1 * zW + spX * g.frame) % zW + zW) % zW;
          const py  = ((h2 * H  + spY * g.frame) % H  + H)  % H;
          ctx.fillStyle   = h1 < 0.55 ? '#907050' : '#b09270';
          ctx.globalAlpha = 0.18 + h2 * 0.32;
          ctx.fillRect(Math.round(px), Math.round(py), h3 < 0.28 ? 2 : 1, h3 < 0.28 ? 2 : 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Chain connections (drawn beneath pegs) ───────────────────────────
      {
        const drawnChains = new Set<number>();
        for (const peg of g.pegs) {
          if (peg.cleared || peg.chainId === undefined || drawnChains.has(peg.chainId)) continue;
          drawnChains.add(peg.chainId);
          const group = g.pegs.filter(p => !p.cleared && p.chainId === peg.chainId);
          const weak  = group.find(p => p.type === 'chain-weak');
          if (!weak) continue;
          for (const node of group) {
            if (node === weak) continue;
            const dx   = node.x - weak.x, dy = node.y - weak.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const steps = Math.floor(dist / 4);
            ctx.fillStyle = '#5c2a00';
            for (let s = 3; s < steps - 3; s++) {
              if (s % 3 === 0) continue; // dashed gap
              const t = s / steps;
              ctx.globalAlpha = 0.55;
              ctx.fillRect(Math.round(weak.x + dx * t) - 1, Math.round(weak.y + dy * t) - 1, 2, 2);
            }
          }
          ctx.globalAlpha = 1;
        }
      }

      // ── Wall segment markers ──────────────────────────────────────────────
      for (const seg of g.wallSegments) {
        if (seg.type === 'warp') {
          // Blue pulse bar
          const wPulse = 0.5 + Math.abs(Math.sin(g.frame * 0.07)) * 0.5;
          ctx.fillStyle = '#4466ff';
          for (let sy = seg.yMin; sy < seg.yMax; sy += 4) {
            ctx.globalAlpha = 0.50 * wPulse;
            ctx.fillRect(seg.side === 'left' ? 0 : W - 4, Math.round(sy), 4, 2);
          }
        } else if (seg.type === 'void') {
          // Ball-vanishing zone: red haze (モヤモヤ) — soft glow band + drifting red dots.
          const segH2  = seg.yMax - seg.yMin;
          const spread = 16;
          const isLeft = seg.side === 'left';
          const vPulse = 0.6 + Math.abs(Math.sin(g.frame * 0.06)) * 0.4;
          const glow = ctx.createLinearGradient(isLeft ? 0 : W, 0, isLeft ? spread : W - spread, 0);
          glow.addColorStop(0, `rgba(216,30,30,${(0.30 * vPulse).toFixed(3)})`);
          glow.addColorStop(1, 'rgba(216,30,30,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(isLeft ? 0 : W - spread, seg.yMin, spread, segH2);
          const msh = (n: number) => ((n * 1664525 + 1013904223) >>> 0) / 0x100000000;
          for (let i = 0; i < 34; i++) {
            const h1 = msh(i * 7 + 13);
            const h2 = msh(i * 7 + 37);
            const h3 = msh(i * 7 + 71);
            const drift = (h3 - 0.5) * 0.6;
            const py = seg.yMin + ((h2 * segH2 + drift * g.frame) % segH2 + segH2) % segH2;
            const px = isLeft ? h1 * spread : W - h1 * spread;
            ctx.fillStyle   = h1 < 0.30 ? '#ff4a4a' : h1 < 0.66 ? '#c81818' : '#7a0c0c';
            ctx.globalAlpha = (0.20 + h2 * 0.45) * vPulse;
            const sz = h3 < 0.25 ? 3 : h3 < 0.6 ? 2 : 1;
            ctx.fillRect(Math.round(px), Math.round(py), sz, sz);
          }
        } else {
          // distort: same color as normal wall (background) — invisible trap
          ctx.fillStyle = '#ede9df';
          ctx.globalAlpha = 1;
          ctx.fillRect(seg.side === 'left' ? 0 : W - 4, seg.yMin, 4, seg.yMax - seg.yMin);
        }
        ctx.globalAlpha = 1;
      }

      // ── Gravitational lenses: swirling distortion rings ──────────────────
      for (const lens of g.lenses) {
        const spin = g.frame * 0.03 * lens.dir;
        for (let ring = 0; ring < 3; ring++) {
          const rr = lens.r * (0.4 + ring * 0.28);
          const n  = Math.max(10, Math.round(2 * Math.PI * rr / 6));
          ctx.fillStyle = ring === 0 ? '#c9a8ff' : ring === 1 ? '#8a6cff' : '#5a3ca0';
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + spin * (ring + 1) * 0.5;
            ctx.globalAlpha = 0.32 + (i % 2) * 0.24;
            ctx.fillRect(Math.round(lens.x + Math.cos(a) * rr) - 1, Math.round(lens.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        ctx.fillStyle = '#e0d0ff';
        ctx.globalAlpha = 0.2 + Math.abs(Math.sin(g.frame * 0.05)) * 0.2;
        ctx.fillRect(Math.round(lens.x) - 2, Math.round(lens.y) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── Galactic tidal streams: a sparse river of star dots flowing along the arc ────────
      for (const gts of g.galacticTidalStreams) {
        const arcLen = gts.radius * GTS_ARC_SPAN;
        for (let i = 0; i < GTS_STAR_COUNT; i++) {
          const spacing = arcLen / GTS_STAR_COUNT;
          let along = (g.frame * GTS_STAR_SPEED * gts.dir + i * spacing) % arcLen;
          if (along < 0) along += arcLen;
          const t = along / arcLen;
          const a = gts.angleStart + t * GTS_ARC_SPAN;
          const radial = ((i * 13) % (GTS_BAND_HALF * 2)) - GTS_BAND_HALF;
          const px = gts.cx + Math.cos(a) * (gts.radius + radial);
          const py = gts.cy + Math.sin(a) * (gts.radius + radial);
          const size = i % 3 === 0 ? 2 : 1;
          const twinkle = 0.35 + Math.abs(Math.sin(g.frame * 0.05 + i)) * 0.35;
          ctx.fillStyle = i % 2 === 0 ? '#f0e8d0' : '#e0d0a0';
          ctx.globalAlpha = twinkle;
          ctx.fillRect(Math.round(px), Math.round(py), size, size);
        }
        ctx.globalAlpha = 1;
      }

      // ── Laniakea Basin: three streams of dots flowing along fixed curved paths toward a
      // shared sink point, fading out just before they'd reach it (never visibly looping). ──
      for (const lb of g.laniakeaBasins) {
        for (let si = 0; si < lb.streams.length; si++) {
          const stream = lb.streams[si];
          const pts = stream.pts;
          const segCount = pts.length - 1;
          const spacingPx = stream.len / LB_DOT_COUNT;
          for (let i = 0; i < LB_DOT_COUNT; i++) {
            let alongPx = (g.frame * LB_DOT_SPEED + i * spacingPx + si * 71) % stream.len;
            if (alongPx < 0) alongPx += stream.len;
            const along = alongPx / stream.len; // 0 (start) → 1 (sink)
            const fi = along * segCount;
            const idx = Math.max(0, Math.min(segCount - 1, Math.floor(fi)));
            const frac = fi - idx;
            const px = pts[idx].x + (pts[idx + 1].x - pts[idx].x) * frac;
            const py = pts[idx].y + (pts[idx + 1].y - pts[idx].y) * frac;
            const fadeNear = along > 0.85 ? Math.max(0, (1 - along) / 0.15) : 1;
            const isGalaxy = i % 5 === 0;
            const size = isGalaxy ? 2 : 1;
            ctx.fillStyle = '#8a9ab8';
            ctx.globalAlpha = (isGalaxy ? 0.6 : 0.35) * fadeNear;
            ctx.fillRect(Math.round(px) - (size > 1 ? 1 : 0), Math.round(py) - (size > 1 ? 1 : 0), size, size);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Gravitational wave background: four corner marker dots, pulsing in perfect unison
      // (the eeriness is that they're NOT staggered — the whole universe trembles as one).
      // No other decoration by design (per spec: "動きの少なさ"が演出, don't add more). ───────
      if (g.gwBackgroundActive) {
        const gwbPulse = 0.4 + 0.6 * Math.abs(Math.sin(g.frame * 0.06));
        const gwbMargin = 10;
        ctx.fillStyle = '#9a7ad8';
        ctx.globalAlpha = gwbPulse;
        ctx.fillRect(gwbMargin, gwbMargin, 3, 3);
        ctx.fillRect(W - gwbMargin - 3, gwbMargin, 3, 3);
        ctx.fillRect(gwbMargin, H - gwbMargin - 3, 3, 3);
        ctx.fillRect(W - gwbMargin - 3, H - gwbMargin - 3, 3, 3);
        ctx.globalAlpha = 1;
      }

      // ── CMB Anisotropy: Planck-style mottled warm/cool dots baked at generation.
      // Each frame only modulates alpha in phase with T (k=0.005) — no moving elements. ──
      if (g.cmbAnisotropy) {
        const cmbPulse = Math.sin(g.frame * 0.005);
        for (const d of g.cmbAnisotropy.dots) {
          // Hot (T>0) = warm cream-orange; cold (T<0) = cool blue-grey. Alpha scales with |T|
          // and breathes slowly with the same phase as the temperature field itself.
          const a = Math.min(CMB_ALPHA_MAX, Math.abs(d.T) * 0.07) * (0.75 + 0.25 * cmbPulse * Math.sign(d.T || 1));
          if (a <= 0.01) continue;
          ctx.fillStyle = d.T >= 0 ? '#e8c8a0' : '#a8c8e0';
          ctx.globalAlpha = a;
          ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Cosmic Birefringence: a tilted lavender polarization grid (parallel dot stripes,
      // slowly flowing, each with its own blink phase) with a rotating cross marker that
      // flashes and fades at the exact point/angle of each crossing. ─────────────────────────
      for (const cb of g.cosmicBirefringences) {
        if (cb.hitFlash > 0) cb.hitFlash--;
        const cbCos = Math.cos(cb.angle), cbSin = Math.sin(cb.angle);
        const CB_STRIPES = 5, CB_DOT_SPACING = 8;
        ctx.fillStyle = '#c8b8e8';
        for (let s = 0; s < CB_STRIPES; s++) {
          const sly = -CB_THICK * 0.5 + (s + 0.5) * (CB_THICK / CB_STRIPES);
          const flicker = 0.35 + 0.3 * Math.sin(g.frame * 0.02 + s * 1.3);
          const nDots = Math.floor(CB_LEN / CB_DOT_SPACING);
          for (let i = 0; i < nDots; i++) {
            const slx = -CB_LEN * 0.5 + ((i * CB_DOT_SPACING + g.frame * 0.3) % CB_LEN);
            const px = cb.x + cbCos * slx - cbSin * sly;
            const py = cb.y + cbSin * slx + cbCos * sly;
            ctx.globalAlpha = flicker;
            ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
          }
        }
        ctx.globalAlpha = 1;

        if (cb.hitFlash > 0) {
          const cbFt = cb.hitFlash / CB_FADE_DUR;
          const armLen = 6;
          const cca = Math.cos(cb.hitAngle), csa = Math.sin(cb.hitAngle);
          ctx.fillStyle = '#e8d8ff';
          ctx.globalAlpha = cbFt;
          for (let d = -armLen; d <= armLen; d += 2) {
            ctx.fillRect(Math.round(cb.hitX + cca * d) - 1, Math.round(cb.hitY + csa * d) - 1, 2, 2);
            ctx.fillRect(Math.round(cb.hitX - csa * d) - 1, Math.round(cb.hitY + cca * d) - 1, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
      }

      // ── Comets: moving deflectors (update + draw) ────────────────────────
      for (const comet of g.comets) {
        if (comet.hitCool > 0) comet.hitCool--;
        // Red (vanish) comets destroy balls; blue ones deflect. Palette branches on that.
        const warnCol = comet.vanish ? '#ff5a5a' : '#8fd3f4';
        const tailA   = comet.vanish ? '#ff8a6a' : '#9fd8f5';
        const tailB   = comet.vanish ? '#d83a3a' : '#5aa9df';
        const tailC   = comet.vanish ? '#a01818' : '#3f86c4';
        const coreCol = comet.vanish ? '#a01818' : '#1e4fa0';
        const hiCol   = comet.vanish ? '#ff7a6a' : '#5aa0ff';
        // Hit ripple: a bold bright shockwave from the impact point in the comet's colour.
        if (comet.hitFlash > 0) {
          comet.hitFlash--;
          const F = 26;
          const rt = 1 - comet.hitFlash / F;                          // 0 → 1
          const baseCol   = comet.vanish ? '#ff2a2a' : '#2a86ff';
          const brightCol = comet.vanish ? '#ffe2d4' : '#eaf6ff';
          // early white-hot flash burst at the centre
          if (rt < 0.45) {
            const fa = 1 - rt / 0.45;
            ctx.fillStyle = brightCol;
            const fr = comet.r * (0.7 + rt * 1.6);
            for (let i = 0; i < 20; i++) {
              const a = (i / 20) * Math.PI * 2;
              ctx.globalAlpha = fa * 0.9;
              ctx.fillRect(Math.round(comet.hitX + Math.cos(a) * fr) - 1, Math.round(comet.hitY + Math.sin(a) * fr) - 1, 3, 3);
            }
            ctx.globalAlpha = fa;
            ctx.fillRect(Math.round(comet.hitX) - 4, Math.round(comet.hitY) - 4, 8, 8);
          }
          // bold expanding double-tone ring
          const rr = comet.r + rt * 90;
          const n  = Math.max(32, Math.round(2 * Math.PI * rr / 4.2));
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
            ctx.globalAlpha = (1 - rt) * 0.95;
            ctx.fillStyle = brightCol;
            ctx.fillRect(Math.round(comet.hitX + ca * rr) - 1, Math.round(comet.hitY + sa * rr) - 1, 3, 3);
            ctx.globalAlpha = (1 - rt) * 0.7;
            ctx.fillStyle = baseCol;
            ctx.fillRect(Math.round(comet.hitX + ca * (rr - 5)) - 1, Math.round(comet.hitY + sa * (rr - 5)) - 1, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
        if (comet.respawnTimer > 0) {
          comet.respawnTimer--;
          // Approach warning: telegraph the entry edge + height for the last ~40 frames.
          if (comet.respawnTimer <= 40) {
            const wpulse = 0.4 + Math.abs(Math.sin(g.frame * 0.25)) * 0.6;
            const wx  = comet.warnFromLeft ? 0 : W - 8;
            ctx.fillStyle = warnCol;
            for (let yy = comet.warnY - 16; yy <= comet.warnY + 16; yy += 3) {
              ctx.globalAlpha = wpulse * Math.max(0, 0.75 - Math.abs(yy - comet.warnY) / 40);
              ctx.fillRect(wx, Math.round(yy), 8, 2);
            }
            // inward-pointing chevron ">"
            ctx.globalAlpha = wpulse;
            const dir = comet.warnFromLeft ? 1 : -1;
            const bx  = comet.warnFromLeft ? 12 : W - 12;
            for (let k = 0; k < 5; k++) {
              ctx.fillRect(Math.round(bx + dir * k * 3) - 1, Math.round(comet.warnY - k * 2) - 1, 2, 2);
              ctx.fillRect(Math.round(bx + dir * k * 3) - 1, Math.round(comet.warnY + k * 2) - 1, 2, 2);
            }
            ctx.globalAlpha = 1;
          }
          if (comet.respawnTimer === 0) {
            const spd = 2.4 + Math.min(2.6, g.level * 0.05);
            comet.x  = comet.warnFromLeft ? -30 : W + 30;
            comet.y  = comet.warnY;
            comet.vx = (comet.warnFromLeft ? 1 : -1) * spd * (0.7 + Math.random() * 0.5);
            comet.vy = (Math.random() < 0.5 ? 1 : -1) * spd * (0.3 + Math.random() * 0.4);
          }
          continue;
        }
        comet.x += comet.vx;
        comet.y += comet.vy;
        // Top/bottom bounce keeps both kinds in the play field (vy guards let a comet
        // still fly in cleanly on its first entry from off-screen).
        if (comet.y < launcherY + 40 && comet.vy < 0) comet.vy = Math.abs(comet.vy);
        if (comet.y > H - 80         && comet.vy > 0) comet.vy = -Math.abs(comet.vy);
        if (comet.vanish) {
          // Red: cross and exit, then respawn + re-telegraph (transient, less oppressive).
          if (comet.x < -60 || comet.x > W + 60) {
            comet.respawnTimer = 50 + Math.floor(Math.random() * 50);
            comet.warnFromLeft = Math.random() < 0.5;
            comet.warnY        = (launcherY + 60) + Math.random() * ((H - launcherY) * 0.45);
            continue;
          }
        } else {
          // Blue: bounce off the left/right screen edges (stays on screen).
          if (comet.x < comet.r     && comet.vx < 0) { comet.x = comet.r;     comet.vx =  Math.abs(comet.vx); }
          if (comet.x > W - comet.r && comet.vx > 0) { comet.x = W - comet.r; comet.vx = -Math.abs(comet.vx); }
        }
        const cang = Math.atan2(comet.vy, comet.vx);
        for (let ti = 1; ti <= 28; ti++) {
          const td = ti * 4;
          const tx = comet.x - Math.cos(cang) * td + (Math.random() - 0.5) * 5;
          const ty = comet.y - Math.sin(cang) * td + (Math.random() - 0.5) * 5;
          ctx.fillStyle = ti < 8 ? tailA : ti < 18 ? tailB : tailC;
          ctx.globalAlpha = (1 - ti / 29) * 0.85;
          const tsz = ti < 10 ? 4 : ti < 20 ? 3 : 2;
          ctx.fillRect(Math.round(tx) - Math.floor(tsz / 2), Math.round(ty) - Math.floor(tsz / 2), tsz, tsz);
        }
        // solid nucleus — dark-on-cream contrast makes the head clearly visible
        drawSolidCircle(ctx, comet.x, comet.y, comet.r * 0.8, coreCol);
        ctx.fillStyle = hiCol;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(Math.round(comet.x) - 4, Math.round(comet.y) - 4, 8, 8);
        ctx.fillStyle = '#eaf4ff';
        ctx.globalAlpha = 1;
        ctx.fillRect(Math.round(comet.x) - 2, Math.round(comet.y) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── Hypervelocity stars: cross-and-exit travelers with no solid body (update + draw).
      // Reuses the comet's warn/traverse/respawn state machine (see above) but never bounces
      // off a ball — the trailing gravitational wake (applied in the physics section) is the
      // only interaction. Doppler palette: short blue-shifted tail ahead, long red-shifted
      // tail behind. ──────────────────────────────────────────────────────────────────────
      for (const hv of g.hyperStars) {
        if (hv.respawnTimer > 0) {
          hv.respawnTimer--;
          if (hv.respawnTimer <= 40) {
            const wpulse = 0.4 + Math.abs(Math.sin(g.frame * 0.25)) * 0.6;
            const wx = hv.warnFromLeft ? 0 : W - 8;
            ctx.fillStyle = '#ffffff';
            for (let yy = hv.warnY - 16; yy <= hv.warnY + 16; yy += 3) {
              ctx.globalAlpha = wpulse * Math.max(0, 0.75 - Math.abs(yy - hv.warnY) / 40);
              ctx.fillRect(wx, Math.round(yy), 8, 2);
            }
            ctx.globalAlpha = wpulse;
            const dir = hv.warnFromLeft ? 1 : -1;
            const bx  = hv.warnFromLeft ? 12 : W - 12;
            for (let k = 0; k < 5; k++) {
              ctx.fillRect(Math.round(bx + dir * k * 3) - 1, Math.round(hv.warnY - k * 2) - 1, 2, 2);
              ctx.fillRect(Math.round(bx + dir * k * 3) - 1, Math.round(hv.warnY + k * 2) - 1, 2, 2);
            }
            ctx.globalAlpha = 1;
          }
          if (hv.respawnTimer === 0) {
            const spd = HVS_SPEED_BASE + Math.min(HVS_SPEED_CAP, Math.max(0, g.level - 54) * HVS_SPEED_PER_LV);
            hv.x  = hv.warnFromLeft ? -30 : W + 30;
            hv.y  = hv.warnY;
            hv.vx = (hv.warnFromLeft ? 1 : -1) * spd * (0.85 + Math.random() * 0.3);
            hv.vy = (Math.random() < 0.5 ? 1 : -1) * spd * (0.15 + Math.random() * 0.2);
          }
          continue;
        }
        hv.x += hv.vx;
        hv.y += hv.vy;
        if (hv.y < launcherY + 40 && hv.vy < 0) hv.vy = Math.abs(hv.vy);
        if (hv.y > H - 80         && hv.vy > 0) hv.vy = -Math.abs(hv.vy);
        // Horizontal direction never reverses, so the star always eventually exits the
        // opposite edge — the wake can never linger on screen indefinitely.
        if (hv.x < -60 || hv.x > W + 60) {
          hv.respawnTimer = 50 + Math.floor(Math.random() * 50);
          hv.warnFromLeft = Math.random() < 0.5;
          hv.warnY        = (launcherY + 60) + Math.random() * ((H - launcherY) * 0.45);
          continue;
        }
        const hang = Math.atan2(hv.vy, hv.vx);
        // forward blue-shifted tail: short and dense
        for (let ti = 1; ti <= 8; ti++) {
          const td = ti * 3;
          const tx = hv.x + Math.cos(hang) * td + (Math.random() - 0.5) * 3;
          const ty = hv.y + Math.sin(hang) * td + (Math.random() - 0.5) * 3;
          ctx.fillStyle = '#6ab8ff';
          ctx.globalAlpha = (1 - ti / 9) * 0.85;
          ctx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 2, 2);
        }
        // backward red-shifted tail: long, comet-style multi-tone
        for (let ti = 1; ti <= 28; ti++) {
          const td = ti * 4;
          const tx = hv.x - Math.cos(hang) * td + (Math.random() - 0.5) * 5;
          const ty = hv.y - Math.sin(hang) * td + (Math.random() - 0.5) * 5;
          ctx.fillStyle = ti < 8 ? '#ff8a6a' : ti < 18 ? '#ff6a5a' : '#a01818';
          ctx.globalAlpha = (1 - ti / 29) * 0.85;
          const tsz = ti < 10 ? 4 : ti < 20 ? 3 : 2;
          ctx.fillRect(Math.round(tx) - Math.floor(tsz / 2), Math.round(ty) - Math.floor(tsz / 2), tsz, tsz);
        }
        // white-hot core — visual only, no collision hitbox
        drawSolidCircle(ctx, hv.x, hv.y, 10, '#ffffff');
        ctx.fillStyle = '#eaf6ff';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(Math.round(hv.x) - 3, Math.round(hv.y) - 3, 6, 6);
        ctx.globalAlpha = 1;
      }

      // ── Bullet Cluster: DM+gas pair (update + draw for the visible gas blob; the DM blob
      // is derived from the gas blob's position/direction each frame and is invisible except
      // for a rare shimmer — its pull is applied in the physics section). Purely horizontal,
      // reusing the HVS warn/traverse/respawn state machine (see interface comment). ────────
      for (const bc of g.bulletClusters) {
        if (bc.hitCool > 0) bc.hitCool--;
        if (bc.hitFlash > 0) {
          bc.hitFlash--;
          const brt = 1 - bc.hitFlash / 8;
          ctx.fillStyle = '#ffe2ea';
          ctx.globalAlpha = (1 - brt) * 0.9;
          const bfr = BC_GAS_R * (1 + brt * 1.2);
          const bfn = 16;
          for (let i = 0; i < bfn; i++) {
            const a = (i / bfn) * Math.PI * 2;
            ctx.fillRect(Math.round(bc.hitX + Math.cos(a) * bfr) - 1, Math.round(bc.hitY + Math.sin(a) * bfr) - 1, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
        if (bc.respawnTimer > 0) {
          bc.respawnTimer--;
          if (bc.respawnTimer <= 40) {
            const wpulse = 0.4 + Math.abs(Math.sin(g.frame * 0.25)) * 0.6;
            const wx = bc.warnFromLeft ? 0 : W - 8;
            ctx.fillStyle = '#ff7a9a';
            for (let yy = bc.warnY - 16; yy <= bc.warnY + 16; yy += 3) {
              ctx.globalAlpha = wpulse * Math.max(0, 0.75 - Math.abs(yy - bc.warnY) / 40);
              ctx.fillRect(wx, Math.round(yy), 8, 2);
            }
            ctx.globalAlpha = wpulse;
            const dir = bc.warnFromLeft ? 1 : -1;
            const bx  = bc.warnFromLeft ? 12 : W - 12;
            for (let k = 0; k < 5; k++) {
              ctx.fillRect(Math.round(bx + dir * k * 3) - 1, Math.round(bc.warnY - k * 2) - 1, 2, 2);
              ctx.fillRect(Math.round(bx + dir * k * 3) - 1, Math.round(bc.warnY + k * 2) - 1, 2, 2);
            }
            ctx.globalAlpha = 1;
          }
          if (bc.respawnTimer === 0) {
            const spd = BC_SPEED_BASE + Math.min(BC_SPEED_CAP, Math.max(0, g.level - 61) * BC_SPEED_PER_LV);
            bc.x  = bc.warnFromLeft ? -30 - BC_DM_LAG : W + 30 + BC_DM_LAG;
            bc.vx = (bc.warnFromLeft ? 1 : -1) * spd;
          }
          continue;
        }
        bc.x += bc.vx;
        // Horizontal direction never reverses, so the pair always eventually exits the
        // opposite edge together — neither blob can linger on screen indefinitely.
        if (bc.x < -60 - BC_DM_LAG || bc.x > W + 60 + BC_DM_LAG) {
          bc.respawnTimer = 60 + Math.floor(Math.random() * 60);
          bc.warnFromLeft = Math.random() < 0.5;
          bc.warnY        = (launcherY + 60) + Math.random() * ((H - launcherY) * 0.45);
          continue;
        }
        const bcDir = Math.sign(bc.vx) || 1;
        const dmX   = bc.x + bcDir * BC_DM_LAG;

        // DM blob: invisible — a rare 1px shimmer is the only hint it's there at all.
        if (g.frame % 60 === 0) {
          ctx.fillStyle = '#c9d4ff';
          ctx.globalAlpha = 0.5;
          ctx.fillRect(Math.round(dmX) - 1, Math.round(bc.warnY) - 1, 1, 1);
          ctx.globalAlpha = 1;
        }

        // Gas blob: pulsing shockwave arc + directional dot tail (dense ahead, sparse behind).
        const bpulse = 0.5 + 0.5 * Math.sin(g.frame * 0.12);
        ctx.fillStyle = '#ff7a9a';
        const arcN = 14;
        for (let i = 0; i < arcN; i++) {
          const a = (i / arcN) * Math.PI * 2;
          ctx.globalAlpha = 0.35 + bpulse * 0.4;
          ctx.fillRect(Math.round(bc.x + Math.cos(a) * BC_GAS_R) - 1, Math.round(bc.warnY + Math.sin(a) * BC_GAS_R) - 1, 2, 2);
        }
        for (let ti = 1; ti <= 14; ti++) {
          const td = ti * 3;
          const tx = bc.x - bcDir * td + (Math.random() - 0.5) * 4;
          const ty = bc.warnY + (Math.random() - 0.5) * 4;
          ctx.fillStyle   = ti < 5 ? '#ffb0c0' : '#ff7a9a';
          ctx.globalAlpha = (1 - ti / 15) * 0.7;
          ctx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 2, 2);
        }
        drawSolidCircle(ctx, bc.x, bc.warnY, BC_GAS_R * 0.6, '#ff4d73');
        ctx.globalAlpha = 1;
      }

      // ── CME: periodic top→bottom shockwave sweep (update + draw) ─────────
      if (g.cmeActive) {
        const WARN = 40, SWEEP_SPD = 8, BAND = 52;
        if (g.cmeY < 0) {
          g.cmeTimer--;
          if (g.cmeTimer <= WARN && g.cmeTimer > 0) {
            const wt = 1 - g.cmeTimer / WARN;
            ctx.fillStyle = '#ff7a1a';
            ctx.globalAlpha = (0.15 + Math.abs(Math.sin(g.frame * 0.3)) * 0.25) * wt;
            ctx.fillRect(0, launcherY + 30, W, 6);
            ctx.globalAlpha = 1;
          }
          if (g.cmeTimer <= 0) g.cmeY = launcherY + 34;
        } else {
          g.cmeY += SWEEP_SPD;
          for (let i = 0; i < 70; i++) {
            const bx = Math.random() * W;
            const by = g.cmeY - Math.random() * BAND;
            const edge = by > g.cmeY - 10;
            ctx.fillStyle = edge ? '#ffe680' : (Math.random() < 0.5 ? '#ff8a1a' : '#d83a10');
            ctx.globalAlpha = edge ? 0.85 : 0.35 + Math.random() * 0.3;
            ctx.fillRect(Math.round(bx), Math.round(by), edge ? 2 : 1, edge ? 2 : 1);
          }
          ctx.globalAlpha = 1;
          if (g.cmeY > H) { g.cmeY = -1; g.cmeTimer = g.cmePeriod; }
        }
      }

      // ── Pulsars: rotating twin radiation beams (update + draw) ────────────
      for (const pu of g.pulsars) {
        pu.angle += pu.rotSpeed;
        const pux = Math.cos(pu.angle), puy = Math.sin(pu.angle);
        const pPulse = 0.55 + Math.abs(Math.sin(g.frame * 0.22)) * 0.45; // fast pulsar blink
        // twin beams: dotted, fading with distance, slight sinuous wobble.
        // A perpendicular scatter column widens the visual to match the physics band.
        for (let side = -1; side <= 1; side += 2) {
          for (let d = 10; d < pu.beamLen; d += 5) {
            const fade = 1 - d / pu.beamLen;
            const wob  = Math.sin(g.frame * 0.15 + d * 0.3) * 2;
            const bxp  = pu.x + pux * d * side - puy * wob;
            const byp  = pu.y + puy * d * side + pux * wob;
            ctx.fillStyle = d < 40 ? '#b8ecff' : '#28b8e8';
            ctx.globalAlpha = fade * pPulse * 0.8;
            ctx.fillRect(Math.round(bxp) - 1, Math.round(byp) - 1, 2, 2);
            // fringe dots at the physics-band edges (alternating sides)
            const fr3 = (d % 10 < 5 ? 1 : -1) * (PULSAR_BEAM_HALF - 2);
            ctx.globalAlpha = fade * pPulse * 0.35;
            ctx.fillRect(Math.round(bxp - puy * fr3), Math.round(byp + pux * fr3), 1, 1);
          }
        }
        // counter-rotating halo ring
        ctx.fillStyle = '#28b8e8';
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 - pu.angle * 2;
          ctx.globalAlpha = 0.35 + (i % 2) * 0.25;
          ctx.fillRect(Math.round(pu.x + Math.cos(a) * 12) - 1, Math.round(pu.y + Math.sin(a) * 12) - 1, 2, 2);
        }
        // core: tiny white-hot neutron star
        ctx.globalAlpha = 1;
        drawSolidCircle(ctx, pu.x, pu.y, 5, '#0a2a3a');
        ctx.fillStyle = pPulse > 0.8 ? '#ffffff' : '#b8ecff';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(Math.round(pu.x) - 2, Math.round(pu.y) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── Gravitational waves: expanding spacetime ripple (update + draw) ───
      for (const gw of g.gravWaves) {
        const gwMaxR = Math.sqrt(W * W + H * H); // ring covers the board from any epicenter
        if (gw.radius < 0) {
          gw.timer--;
          if (gw.timer <= 0) gw.radius = 4; // first wave uses the level-seeded dir
        } else {
          gw.radius += GW_SPEED;
          if (gw.radius > gwMaxR) {
            gw.radius = -1;
            gw.timer  = gw.period;
            gw.dir    = Math.random() < 0.5 ? 1 : -1; // later waves re-roll (runtime-only)
          }
        }
        // epicenter: two tiny orbiting dots — the distant merging pair emitting the waves
        const oa = g.frame * 0.11;
        ctx.fillStyle = '#4a5578';
        ctx.globalAlpha = 0.75;
        ctx.fillRect(Math.round(gw.ex + Math.cos(oa) * 4) - 1, Math.round(gw.ey + Math.sin(oa) * 4) - 1, 3, 3);
        ctx.fillRect(Math.round(gw.ex - Math.cos(oa) * 4) - 1, Math.round(gw.ey - Math.sin(oa) * 4) - 1, 3, 3);
        ctx.globalAlpha = 1;
        if (gw.radius >= 0) {
          // wavefront ring + one trailing echo (dot count capped for perf)
          for (let ring = 0; ring < 2; ring++) {
            const rr = gw.radius - ring * 14;
            if (rr <= 0) continue;
            const n = Math.min(200, Math.max(24, Math.round(2 * Math.PI * rr / 9)));
            ctx.fillStyle = ring === 0 ? '#8a94b8' : '#b8bed4';
            for (let i = 0; i < n; i++) {
              const a  = (i / n) * Math.PI * 2;
              const rx = gw.ex + Math.cos(a) * rr;
              const ry = gw.ey + Math.sin(a) * rr;
              if (rx < -4 || rx > W + 4 || ry < -4 || ry > H + 4) continue;
              ctx.globalAlpha = (ring === 0 ? 0.7 : 0.35) * (0.6 + (i % 3) * 0.2);
              ctx.fillRect(Math.round(rx) - 1, Math.round(ry) - 1, 2, 2);
            }
          }
          ctx.globalAlpha = 1;
        }
      }

      // ── Vacuum decay bubbles: expanding true-vacuum (update + draw) ───────
      for (const vb of g.vacuums) {
        if (vb.popFlash > 0) vb.popFlash--;
        if (vb.respawnTimer > 0) {
          vb.respawnTimer--;
          if (vb.respawnTimer === 0) vb.r = VAC_R0; // reseed and grow again
        } else {
          vb.r += vb.grow;
          if (vb.r >= vb.rMax) {
            spawnBurst(g, vb.x, vb.y, 10, 10, '#38c890');
            vb.popFlash = 20;
            vb.respawnTimer = VAC_RESPAWN;
          }
        }
        if (vb.popFlash > 0) {
          const pt2 = 1 - vb.popFlash / 20;
          ctx.fillStyle = '#a0f0d0';
          for (let i = 0; i < 30; i++) {
            const a  = (i / 30) * Math.PI * 2;
            const rr = vb.rMax * (0.3 + pt2 * 0.9);
            ctx.globalAlpha = (1 - pt2) * 0.7;
            ctx.fillRect(Math.round(vb.x + Math.cos(a) * rr) - 1, Math.round(vb.y + Math.sin(a) * rr) - 1, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
        if (vb.respawnTimer > 0) continue;
        // membrane: shimmering eerie-green ring
        const vn = Math.max(20, Math.round(2 * Math.PI * vb.r / 6));
        const vShimmer = 0.6 + Math.abs(Math.sin(g.frame * 0.06)) * 0.4;
        ctx.fillStyle = '#38c890';
        for (let i = 0; i < vn; i++) {
          const a   = (i / vn) * Math.PI * 2 + g.frame * 0.004;
          const wob = Math.sin(g.frame * 0.08 + i * 1.7) * 1.5;
          ctx.globalAlpha = vShimmer * (0.5 + (i % 2) * 0.35);
          ctx.fillRect(Math.round(vb.x + Math.cos(a) * (vb.r + wob)) - 1, Math.round(vb.y + Math.sin(a) * (vb.r + wob)) - 1, 2, 2);
        }
        // interior: sparse pale specks drifting upward — physics is "wrong" in here
        ctx.fillStyle = '#a0f0d0';
        for (let i = 0; i < 12; i++) {
          const cyc = (g.frame * 0.5 + i * 41) % (vb.r * 2);
          const sdy = vb.r - cyc; // +r → -r as frames advance: specks rise
          const hw  = Math.sqrt(Math.max(0, vb.r * vb.r - sdy * sdy)) * 0.85;
          const fx  = Math.sin(i * 12.9898 + 78.233); // stable per-speck lane in [-1,1]
          ctx.globalAlpha = 0.45;
          ctx.fillRect(Math.round(vb.x + fx * hw) - 1, Math.round(vb.y + sdy) - 1, 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── White holes: radial ejection swirl (the black hole's mirror) ─────
      for (const wh of g.whiteHoles) {
        const wr = WH_RANGE;
        const corePulse = 0.6 + Math.abs(Math.sin(g.frame * 0.08)) * 0.4;
        // 3 arms of dots streaming outward from the core, counter-rotating vs the black hole.
        // Icy blue reads as self-luminous on the cream field (the cold mirror of the BH's red).
        for (let arm = 0; arm < 3; arm++) {
          for (let d = 0; d < 14; d++) {
            const prog = ((g.frame * 0.8 + d * 10) % 120) / 120;       // 0→1 marching outward
            const rr   = 8 + prog * (wr - 8);
            const a    = (arm / 3) * Math.PI * 2 - g.frame * 0.02 + prog * 1.6; // counter-rot swirl
            ctx.fillStyle   = prog < 0.35 ? '#2f8fe8' : '#6ab6f2';
            ctx.globalAlpha = (1 - prog) * 0.85;                        // fade at the outer edge
            ctx.fillRect(Math.round(wh.x + Math.cos(a) * rr) - 1, Math.round(wh.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        // bright inner ring (anti-horizon), counter-rotating
        ctx.fillStyle = '#1e78d8';
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 - g.frame * 0.03;
          ctx.globalAlpha = 0.5 + (i % 2) * 0.4;
          ctx.fillRect(Math.round(wh.x + Math.cos(a) * 14) - 1, Math.round(wh.y + Math.sin(a) * 14) - 1, 2, 2);
        }
        // white-hot core with a blue rim so it stays visible on cream
        drawSolidCircle(ctx, wh.x, wh.y, 7, '#1663c0');
        drawSolidCircle(ctx, wh.x, wh.y, 4, '#bfe0ff');
        ctx.fillStyle   = '#ffffff';
        ctx.globalAlpha = corePulse;
        ctx.fillRect(Math.round(wh.x) - 2, Math.round(wh.y) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── Magnetars: periodic starquake flare (update + draw) ──────────────
      for (const mg of g.magnetars) {
        // advance the charge/release cycle (once per frame, not per ball)
        if (mg.releaseTimer > 0) {
          mg.releaseTimer--;
        } else {
          mg.timer--;
          if (mg.timer <= 0) {
            mg.releaseTimer = MAG_RELEASE;
            mg.timer = mg.period;
            spawnBurst(g, mg.x, mg.y, 12, 12, '#ffe020'); // omnidirectional flare spark
          }
        }
        const charging  = mg.releaseTimer <= 0 && mg.timer <= MAG_WARN;
        const corePulse = 0.4 + Math.abs(Math.sin(g.frame * (charging ? 0.25 : 0.05))) * 0.6;
        // magnetic field arches: 3 counter-rotating dot rings, brightening while charging
        ctx.fillStyle = charging ? '#ffe020' : '#e0a818';
        for (let ring = 0; ring < 3; ring++) {
          const rr = 14 + ring * 9;
          const n  = 12 + ring * 3;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + g.frame * 0.01 * (ring % 2 === 0 ? 1 : -1);
            ctx.globalAlpha = corePulse * (0.45 + (i % 2) * 0.3) * (charging ? 1 : 0.7);
            ctx.fillRect(Math.round(mg.x + Math.cos(a) * rr) - 1, Math.round(mg.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        // release shockwave ring
        if (mg.releaseTimer > 0) {
          const rt = 1 - mg.releaseTimer / MAG_RELEASE;
          ctx.fillStyle = '#ffcf1a';
          for (let i = 0; i < 44; i++) {
            const a  = (i / 44) * Math.PI * 2;
            const rr = rt * MAG_RANGE;
            ctx.globalAlpha = (1 - rt) * 0.9;
            ctx.fillRect(Math.round(mg.x + Math.cos(a) * rr) - 1, Math.round(mg.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        ctx.globalAlpha = 1;
        // iron-grey neutron core with a flaring center
        drawSolidCircle(ctx, mg.x, mg.y, 6, '#2a2a30');
        ctx.fillStyle   = (charging || corePulse > 0.85) ? '#fff2b0' : '#ffcf1a';
        ctx.globalAlpha = corePulse;
        ctx.fillRect(Math.round(mg.x) - 2, Math.round(mg.y) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── Hawking Points: ghost rings that periodically fire a warmth pulse ──
      for (const hp of g.hawkingPoints) {
        if (hp.releaseTimer > 0) {
          hp.releaseTimer--;
        } else {
          hp.timer--;
          if (hp.timer <= 0) {
            hp.releaseTimer = HP_RELEASE;
            hp.timer = hp.period;
          }
        }
        // Pre-pulse: full blackout for HP_BLINK_OFF frames (the "held breath").
        const preBlink = hp.releaseTimer <= 0 && hp.timer <= HP_WARN && hp.timer > HP_WARN - HP_BLINK_OFF;
        if (!preBlink) {
          // Idle ghost ring: ultra-slow alpha breathe 0.10–0.15.
          const ghostA = 0.10 + 0.05 * (0.5 + 0.5 * Math.sin(g.frame * 0.004));
          ctx.fillStyle = '#d8d0c0';
          const hn = 28;
          for (let i = 0; i < hn; i++) {
            const a = (i / hn) * Math.PI * 2;
            ctx.globalAlpha = ghostA * (0.7 + (i % 2) * 0.3);
            ctx.fillRect(
              Math.round(hp.x + Math.cos(a) * HP_RING_R) - 1,
              Math.round(hp.y + Math.sin(a) * HP_RING_R) - 1,
              2, 2,
            );
          }
        }
        // Pulse shockwave: white-hot ring expanding over HP_RELEASE frames.
        if (hp.releaseTimer > 0) {
          const rt = 1 - hp.releaseTimer / HP_RELEASE;
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 40; i++) {
            const a = (i / 40) * Math.PI * 2;
            const rr = HP_RING_R + rt * (HP_RANGE - HP_RING_R);
            ctx.globalAlpha = (1 - rt) * 0.85;
            ctx.fillRect(
              Math.round(hp.x + Math.cos(a) * rr) - 1,
              Math.round(hp.y + Math.sin(a) * rr) - 1,
              2, 2,
            );
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Quantum Foam: Planck-scale jitter region (pair-creation dots + fuzzy boundary) ──
      for (const qf of g.quantumFoams) {
        // Pair-creation / annihilation: 2-3 white+black 1px pairs appear for 3f at random spots.
        const pairCount = 2 + (g.frame % 2);
        for (let p = 0; p < pairCount; p++) {
          const seed = ((g.frame / 3) | 0) * 374761393 + p * 668265263;
          const u1 = ((Math.imul(seed ^ (seed >>> 13), 1274126177) >>> 0) / 0x100000000);
          const u2 = ((Math.imul((seed + 1) ^ ((seed + 1) >>> 13), 1274126177) >>> 0) / 0x100000000);
          const pr = Math.sqrt(u1) * QF_RANGE * 0.9;
          const pa = u2 * Math.PI * 2;
          const px = qf.x + Math.cos(pa) * pr;
          const py = qf.y + Math.sin(pa) * pr;
          const life = g.frame % 3; // 0,1,2 within the 3f window
          const a = 0.7 - life * 0.2;
          ctx.globalAlpha = a;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
          ctx.fillStyle = '#0f0f0d';
          ctx.fillRect(Math.round(px + 2), Math.round(py), 1, 1);
        }
        // Fuzzy boundary: dashed circle whose radius jitters deterministically each frame.
        const bn = 36;
        for (let i = 0; i < bn; i++) {
          if (i % 3 === 0) continue; // dashed gap
          const a = (i / bn) * Math.PI * 2;
          const wob = Math.sin(g.frame * 0.37 + i * 1.9) * 3.5;
          const rr = QF_RANGE + wob;
          ctx.fillStyle = '#6a6a80';
          ctx.globalAlpha = 0.35 + 0.15 * Math.sin(g.frame * 0.11 + i);
          ctx.fillRect(Math.round(qf.x + Math.cos(a) * rr), Math.round(qf.y + Math.sin(a) * rr), 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Black Hole Firewall: burning arc barrier (white⇄orange flicker + bit stream) ──
      for (const fw of g.firewalls) {
        if (fw.hitCool  > 0) fw.hitCool--;
        if (fw.hitFlash > 0) fw.hitFlash--;
        const fwDots = 28;
        for (let i = 0; i < fwDots; i++) {
          const a = fw.angle0 + (i / (fwDots - 1)) * FW_SPAN;
          // Fast white⇄orange flicker (k=0.33, catalog's fastest).
          const flick = Math.sin(g.frame * 0.33 + i * 1.7) > 0;
          ctx.fillStyle = fw.hitFlash > 0 ? '#ffffff' : (flick ? '#ffffff' : '#ff9a30');
          ctx.globalAlpha = fw.hitFlash > 0 ? 1 : 0.75 + (i % 2) * 0.2;
          const px = fw.x + Math.cos(a) * FW_R;
          const py = fw.y + Math.sin(a) * FW_R;
          ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
        }
        // 0/1-style bit stream flowing along the arc (spd 2).
        for (let b = 0; b < 8; b++) {
          const bt = ((g.frame * 2 + b * 11) % (FW_SPAN * FW_R)) / FW_R;
          const ba = fw.angle0 + bt;
          if (bt > FW_SPAN) continue;
          ctx.fillStyle = (b + g.frame) % 2 === 0 ? '#ffffff' : '#ff9a30';
          ctx.globalAlpha = 0.9;
          ctx.fillRect(
            Math.round(fw.x + Math.cos(ba) * (FW_R + 4)),
            Math.round(fw.y + Math.sin(ba) * (FW_R + 4)),
            1, 1,
          );
        }
        ctx.globalAlpha = 1;
      }

      // ── Rogue planets: a starless world drifting through the field (update + draw) ──
      for (const rp of g.roguePlanets) {
        if (rp.hitCool > 0) rp.hitCool--;
        rp.x += rp.vx; rp.y += rp.vy;
        // drift and bounce off all four edges of the play field so it roams continuously
        if (rp.x < rp.r         && rp.vx < 0) rp.vx = Math.abs(rp.vx);
        if (rp.x > W - rp.r     && rp.vx > 0) rp.vx = -Math.abs(rp.vx);
        if (rp.y < launcherY + 40 + rp.r && rp.vy < 0) rp.vy = Math.abs(rp.vy);
        if (rp.y > H - 70 - rp.r         && rp.vy > 0) rp.vy = -Math.abs(rp.vy);
        // pale tilted ring (debris), non-luminous, breathing slowly — drawn behind the body
        const ringBreath = 1 + Math.sin(g.frame * 0.02) * 0.04;
        const ct = Math.cos(rp.ringTilt), st = Math.sin(rp.ringTilt);
        ctx.fillStyle = '#8890a0';
        for (let i = 0; i < 22; i++) {
          const a  = (i / 22) * Math.PI * 2 + g.frame * 0.004;
          const ex = Math.cos(a) * (rp.r + 8) * ringBreath;
          const ey = Math.sin(a) * (rp.r + 8) * 0.4 * ringBreath; // flattened into an ellipse
          const rx = ex * ct - ey * st;
          const ry = ex * st + ey * ct;
          ctx.globalAlpha = 0.45 + (i % 2) * 0.25;
          ctx.fillRect(Math.round(rp.x + rx) - 1, Math.round(rp.y + ry) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
        // dark navy body — the only non-luminous hazard (a cold, stray world)
        drawSolidCircle(ctx, rp.x, rp.y, rp.r, '#20283a');
        // faint surface stipple that turns slowly with the planet
        ctx.fillStyle = '#2e3850';
        for (let i = 0; i < 10; i++) {
          const a  = (i / 10) * Math.PI * 2 + g.frame * 0.004;
          const rr = rp.r * 0.55;
          ctx.globalAlpha = 0.6;
          ctx.fillRect(Math.round(rp.x + Math.cos(a) * rr) - 1, Math.round(rp.y + Math.sin(a) * rr) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Quasar jets: fixed plasma column, dots streaming along the axis (draw) ──
      for (const qj of g.quasarJets) {
        const len     = qj.y1 - qj.y0;
        const nozzleY = qj.dir === 1 ? qj.y0 : qj.y1;
        const jetPulse = 0.5 + Math.abs(Math.sin(g.frame * 0.18)) * 0.5; // fast "danger" pulse
        // plasma stream: dense dots flow from the nozzle to the tip, widening + fading as they go
        for (let i = 0; i < 70; i++) {
          const along = (g.frame * 2.5 + i * 8) % len;    // 0 at nozzle → len at tip
          const prog  = along / len;
          const py    = nozzleY + qj.dir * along;
          const lane  = ((i * 2654435761) >>> 0) / 0xffffffff; // stable pseudo-random lane 0..1
          const spread = (lane * 2 - 1) * QJ_HALF * (0.4 + prog * 0.6);
          ctx.fillStyle   = prog < 0.35 ? '#c0a0ff' : '#8a5adc';
          ctx.globalAlpha = (1 - prog * 0.8) * 0.8;
          ctx.fillRect(Math.round(qj.bx + spread) - 1, Math.round(py) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
        // bright nozzle core
        drawSolidCircle(ctx, qj.bx, nozzleY, 5, '#5a2a9a');
        ctx.fillStyle   = '#e0c8ff';
        ctx.globalAlpha = jetPulse;
        ctx.fillRect(Math.round(qj.bx) - 2, Math.round(nozzleY) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── Evaporating micro black holes: shrink → evaporate → re-form (update + draw) ──
      for (const mb of g.microBHs) {
        // advance the life/evaporation/dormant state machine (once per frame)
        if (mb.dormant > 0) {
          mb.dormant--;
          if (mb.dormant === 0) {
            mb.spotIdx = (mb.spotIdx + 1) % mb.spots.length; // re-form at the next site
            mb.x = mb.spots[mb.spotIdx].x;
            mb.y = mb.spots[mb.spotIdx].y;
            mb.life = mb.maxLife;
            mb.evap = 0;
            spawnBurst(g, mb.x, mb.y, 5, 5, '#c0d0ff'); // materialization shimmer
          }
        } else if (mb.evap > 0) {
          mb.evap--;
          if (mb.evap === 0) mb.dormant = 90;
        } else {
          mb.life--;
          if (mb.life <= 0) { mb.evap = 12; spawnBurst(g, mb.x, mb.y, 14, 14, '#ffffff'); }
        }
        if (mb.dormant > 0) continue; // invisible while evaporated
        if (mb.evap > 0) {
          // evaporation: white shockwave, no core
          const et = 1 - mb.evap / 12;
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 36; i++) {
            const a  = (i / 36) * Math.PI * 2;
            const rr = et * MBH_EVAP_RANGE;
            ctx.globalAlpha = (1 - et) * 0.85;
            ctx.fillRect(Math.round(mb.x + Math.cos(a) * rr) - 1, Math.round(mb.y + Math.sin(a) * rr) - 1, 2, 2);
          }
          ctx.globalAlpha = 1;
          continue;
        }
        const lifeRatio = mb.life / mb.maxLife;
        const nearEvap  = mb.life <= 45; // telegraph: whitens before evaporation
        const swirlR    = 8 + lifeRatio * 8; // visibly shrinks as it evaporates
        // blood-red accretion swirl (fast, busy rotation = a small BH)
        ctx.fillStyle = '#8a1420';
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + g.frame * 0.03;
          ctx.globalAlpha = 0.45 + (i % 2) * 0.3;
          ctx.fillRect(Math.round(mb.x + Math.cos(a) * swirlR) - 1, Math.round(mb.y + Math.sin(a) * swirlR) - 1, 2, 2);
        }
        // Hawking radiation: white sparks, more frequent as the BH shrinks
        ctx.fillStyle = nearEvap ? '#ffffff' : '#ffd0d0';
        const sparks = Math.round((1 - lifeRatio) * 8) + (nearEvap ? 4 : 0);
        for (let i = 0; i < sparks; i++) {
          const a  = Math.random() * Math.PI * 2;
          const rr = swirlR * (0.5 + Math.random());
          ctx.globalAlpha = 0.5 + Math.random() * 0.4;
          ctx.fillRect(Math.round(mb.x + Math.cos(a) * rr), Math.round(mb.y + Math.sin(a) * rr), 1, 1);
        }
        ctx.globalAlpha = 1;
        // maroon event-horizon core (whitens as it nears evaporation)
        drawSolidCircle(ctx, mb.x, mb.y, 4, nearEvap ? '#d04040' : '#2a0810');
        ctx.globalAlpha = 1;
      }

      // ── Dark matter halos: invisible pull, only a rare faint shimmer (update + draw) ──
      for (const dh of g.darkHalos) {
        dh.shimmer--;
        if (dh.shimmer <= 0) dh.shimmer = 90 + Math.floor(Math.random() * 60); // next reveal 90-150f
        // reveal a faint indigo ring during the last 40 frames of the cycle (smooth bump).
        // Kept ghostly, but perceptible enough to be a fair "there is something here" cue.
        if (dh.shimmer < 40) {
          const a  = Math.sin(Math.PI * (40 - dh.shimmer) / 40) * 0.35; // peak alpha 0.35
          const rr = DM_RANGE * 0.55;
          ctx.fillStyle = '#8a96d8';
          for (let i = 0; i < 44; i++) {
            const ang = (i / 44) * Math.PI * 2;
            ctx.globalAlpha = a * (0.6 + (i % 2) * 0.4);
            ctx.fillRect(Math.round(dh.x + Math.cos(ang) * rr) - 1, Math.round(dh.y + Math.sin(ang) * rr) - 1, 2, 2);
          }
          // brief brighter centre flash so the reveal clearly points to the pull source
          ctx.globalAlpha = a * 1.6;
          ctx.fillRect(Math.round(dh.x) - 1, Math.round(dh.y) - 1, 3, 3);
          ctx.globalAlpha = 1;
        }
      }

      // ── Primordial black holes: almost no drawing at all — each point flashes a single 1px
      // shimmer on its own offset phase, and that's the only evidence any of them exist. ────
      for (const pbh of g.primordialBHs) {
        const pbhCyclePos = (g.frame + pbh.phase) % PBH_SHIMMER_PERIOD;
        if (pbhCyclePos < PBH_SHIMMER_DUR) {
          ctx.fillStyle = '#8a8ae0';
          ctx.globalAlpha = 0.8;
          ctx.fillRect(Math.round(pbh.x), Math.round(pbh.y), 1, 1);
          ctx.globalAlpha = 1;
        }
      }

      // ── Dark Star: a huge soft fuzzy point-cloud sphere with no solid boundary — the
      // session's first non-bouncing massive body. Slow whole-body breathing, sparse interior
      // white sparks (DM annihilation), and a faint outward dot-flow across the shell. ───────
      for (const ds of g.darkStars) {
        const dsBreathe = 0.85 + 0.15 * Math.sin(g.frame * 0.006);
        const dsR = DS_R_VISUAL * dsBreathe;
        const dsN = 90;
        ctx.fillStyle = '#f0d8b0';
        for (let i = 0; i < dsN; i++) {
          const h1 = ((i * 2654435761) >>> 0) / 4294967296;
          const h2 = ((i * 2246822519 + 12345) >>> 0) / 4294967296;
          const rr = dsR * Math.sqrt(h1); // uniform disc fill
          const a = h2 * Math.PI * 2;
          ctx.globalAlpha = 0.10 + 0.10 * (1 - rr / dsR);
          ctx.fillRect(Math.round(ds.x + Math.cos(a) * rr) - 1, Math.round(ds.y + Math.sin(a) * rr) - 1, 1, 1);
        }
        const dsShellN = 40;
        for (let i = 0; i < dsShellN; i++) {
          const a = (i / dsShellN) * Math.PI * 2;
          const flowR = DS_R_CORE + ((g.frame * 0.3 + i * 3) % (DS_R_SHELL - DS_R_CORE));
          ctx.globalAlpha = 0.25;
          ctx.fillRect(Math.round(ds.x + Math.cos(a) * flowR) - 1, Math.round(ds.y + Math.sin(a) * flowR) - 1, 1, 1);
        }
        if (g.frame % 10 === 0) {
          const sa = Math.random() * Math.PI * 2;
          const sr = Math.random() * DS_R_CORE * 0.8;
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.8;
          ctx.fillRect(Math.round(ds.x + Math.cos(sa) * sr) - 1, Math.round(ds.y + Math.sin(sa) * sr) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Superradiance: blood-red vortex that accelerates orbiting balls, emitting
      // white amplification waves and slowing its own spin as energy is stolen ──
      for (const sr of g.superradiances) {
        if (sr.waveTimer > 0) sr.waveTimer--;
        const baseK = sr.occupied ? 0.035 : 0.02;
        const spinK = baseK * sr.spinMult * sr.dir;
        // Blood-red rotating rings (BH family palette).
        for (let ring = 0; ring < 3; ring++) {
          const rr = 18 + ring * 22;
          const n = 16 + ring * 6;
          ctx.fillStyle = ring === 0 ? '#c01818' : '#8a1010';
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + g.frame * spinK * (ring % 2 === 0 ? 1 : -0.7);
            ctx.globalAlpha = 0.45 + (i % 2) * 0.25;
            ctx.fillRect(Math.round(sr.x + Math.cos(a) * rr) - 1, Math.round(sr.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        // Dark core
        drawSolidCircle(ctx, sr.x, sr.y, 6, '#1a0808');
        // Amplification wave expanding from the ball that completed an orbit.
        if (sr.waveTimer > 0) {
          const wt = 1 - sr.waveTimer / SR_WAVE_DUR;
          const wr = 8 + wt * 50;
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 28; i++) {
            const a = (i / 28) * Math.PI * 2;
            ctx.globalAlpha = (1 - wt) * 0.85;
            ctx.fillRect(
              Math.round(sr.waveX + Math.cos(a) * wr) - 1,
              Math.round(sr.waveY + Math.sin(a) * wr) - 1,
              2, 2,
            );
          }
        }
        ctx.globalAlpha = 1;
        // occupied is set during physics (previous frame); clear for next physics pass.
        sr.occupied = false;
      }

      // ── Negative Mass Blob: a chasing "hole" (outline only, brighter interior) ──
      for (const nmb of g.negMassBlobs) {
        // Chase nearest live ball at NMB_CHASE px/f; stop at screen edges.
        let nearest: Ball | null = null;
        let nearestD2 = Infinity;
        for (const b of g.balls) {
          if (b.y > H + 40) continue;
          const d2 = (b.x - nmb.x) ** 2 + (b.y - nmb.y) ** 2;
          if (d2 < nearestD2) { nearestD2 = d2; nearest = b; }
        }
        if (nearest && nearestD2 > 0) {
          const d = Math.sqrt(nearestD2);
          nmb.faceX = (nearest.x - nmb.x) / d;
          nmb.faceY = (nearest.y - nmb.y) / d;
          nmb.x += nmb.faceX * NMB_CHASE;
          nmb.y += nmb.faceY * NMB_CHASE;
          nmb.chasing = true;
        } else {
          // Ease face back toward zero so the outline returns to a circle over ~3f.
          nmb.faceX *= 0.5;
          nmb.faceY *= 0.5;
          nmb.chasing = false;
        }
        // Clamp to play field (never leave the screen).
        nmb.x = Math.max(NMB_R_VISUAL, Math.min(W - NMB_R_VISUAL, nmb.x));
        nmb.y = Math.max(launcherY + 40 + NMB_R_VISUAL, Math.min(H - 70 - NMB_R_VISUAL, nmb.y));

        // Hollow outline: denser behind, sparser ahead while chasing ("hole stretches").
        const breath = 1 + Math.sin(g.frame * 0.03) * 0.04;
        const nDots = 28;
        ctx.fillStyle = '#d8d0c0';
        for (let i = 0; i < nDots; i++) {
          const a = (i / nDots) * Math.PI * 2;
          // Density bias: skip more dots on the forward side while chasing.
          if (nmb.chasing) {
            const forward = nmb.faceX * Math.cos(a) + nmb.faceY * Math.sin(a);
            if (forward > 0.2 && i % 3 !== 0) continue; // sparse ahead
            if (forward < -0.2 && i % 2 === 0) { /* denser behind: draw extra below */ }
          }
          const rr = NMB_R_VISUAL * breath;
          ctx.globalAlpha = 0.55 + 0.2 * Math.sin(g.frame * 0.03 + i);
          ctx.fillRect(
            Math.round(nmb.x + Math.cos(a) * rr) - 1,
            Math.round(nmb.y + Math.sin(a) * rr) - 1,
            2, 2,
          );
        }
        // Interior slightly brighter than cream — a hole, not a shadow.
        ctx.fillStyle = '#f4f0e6';
        ctx.globalAlpha = 0.35;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + g.frame * 0.01;
          const rr = NMB_R_VISUAL * 0.45;
          ctx.fillRect(Math.round(nmb.x + Math.cos(a) * rr), Math.round(nmb.y + Math.sin(a) * rr), 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Bubble Universe Collision: interference-fringe ring + blue-shifted interior ──
      for (const bu of g.bubbleUniverses) {
        if (bu.edgeFlash > 0) bu.edgeFlash--;
        // Interference fringe: alternating pink/cyan dots, phase-inverted slow blink.
        const bn = 48;
        for (let i = 0; i < bn; i++) {
          const a = (i / bn) * Math.PI * 2;
          const phase = Math.sin(g.frame * 0.01 + (i % 2 === 0 ? 0 : Math.PI));
          const on = phase > 0;
          if (i % 2 === 0) {
            ctx.fillStyle = on ? '#e8a0c8' : '#a0c8e8';
          } else {
            ctx.fillStyle = on ? '#a0c8e8' : '#e8a0c8';
          }
          ctx.globalAlpha = 0.55 + 0.25 * Math.abs(phase);
          ctx.fillRect(
            Math.round(bu.x + Math.cos(a) * BUC_RANGE) - 1,
            Math.round(bu.y + Math.sin(a) * BUC_RANGE) - 1,
            2, 2,
          );
        }
        // Sparse blue-shifted interior dots (another universe's color) — static.
        ctx.fillStyle = '#a0b8d8';
        for (let i = 0; i < 18; i++) {
          const h1 = ((i * 2654435761) >>> 0) / 4294967296;
          const h2 = ((i * 2246822519 + 99) >>> 0) / 4294967296;
          const rr = BUC_RANGE * 0.85 * Math.sqrt(h1);
          const a = h2 * Math.PI * 2;
          ctx.globalAlpha = 0.12;
          ctx.fillRect(Math.round(bu.x + Math.cos(a) * rr), Math.round(bu.y + Math.sin(a) * rr), 1, 1);
        }
        // Entry/exit rainbow ripple on the contact arc.
        if (bu.edgeFlash > 0) {
          const et = bu.edgeFlash / BUC_EDGE_FLASH;
          const rainbow = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa', '#f783ac'];
          for (let i = 0; i < 9; i++) {
            const a = bu.edgeAng + (i - 4) * 0.08;
            ctx.fillStyle = rainbow[i % rainbow.length];
            ctx.globalAlpha = et * 0.9;
            ctx.fillRect(
              Math.round(bu.x + Math.cos(a) * BUC_RANGE) - 1,
              Math.round(bu.y + Math.sin(a) * BUC_RANGE) - 1,
              2, 2,
            );
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Big Rip Precursor: board-wide pulsed expansion + edge tears ──
      if (g.bigRip) {
        const br = g.bigRip;
        br.timer--;
        if (!br.active) {
          if (br.timer <= 0) {
            br.active = true;
            br.timer = BR_EVENT_DUR;
            br.eventCount++;
            br.bgStretch = Math.min(1, br.bgStretch + 0.12);
          } else {
            br.bgStretch = Math.max(0, br.bgStretch - 0.08);
          }
        } else {
          br.bgStretch = Math.min(1, br.bgStretch + 0.12);
          if (br.timer <= 0) {
            br.active = false;
            br.timer = BR_PERIOD;
            // Grow H after each event so the *next* pulse is fiercer (first uses BR_H0).
            br.h = Math.min(BR_H0 * BR_H_CAP, br.h * BR_H_GROW);
          }
        }
        // Edge tears: telegraph (fade in) BR_WARN before event; thicken with eventCount;
        // stay faintly lit once H has hit the cap.
        const atCap = br.h >= BR_H0 * BR_H_CAP - 1e-9;
        const warning = !br.active && br.timer <= BR_WARN;
        const tearA = br.active ? 0.9
                    : warning   ? (1 - br.timer / BR_WARN) * 0.7
                    : atCap     ? 0.15
                    : 0;
        if (tearA > 0.01) {
          const thick = Math.min(3, 1 + Math.floor(br.eventCount / 2));
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = tearA;
          // top / bottom
          ctx.fillRect(0, 0, W, thick);
          ctx.fillRect(0, H - thick, W, thick);
          // left / right
          ctx.fillRect(0, 0, thick, H);
          ctx.fillRect(W - thick, 0, thick, H);
          ctx.globalAlpha = 1;
        }
      }

      // ── Conformal Cyclic Boundary: faint rainbow horizon + rebirth streak ──
      if (g.cccBoundary) {
        const ccc = g.cccBoundary;
        const rainbow = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa', '#f783ac'];
        const bandY = H - CCC_BAND_H / 2;
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < Math.ceil(W / 6); i++) {
          const px = ((i * 6 + g.frame * 0.1) % W + W) % W;
          ctx.fillStyle = rainbow[i % rainbow.length];
          ctx.fillRect(Math.round(px), Math.round(bandY), 1, 1);
        }
        ctx.globalAlpha = 1;
        if (ccc.streakTimer > 0) {
          ccc.streakTimer--;
          const st = 1 - ccc.streakTimer / 6;
          const sy = ccc.streakFromY + (g.launcherY + 8 - ccc.streakFromY) * st;
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.9;
          ctx.fillRect(Math.round(ccc.streakX) - 1, Math.round(sy) - 2, 2, 4);
          ctx.globalAlpha = 1;
        }
      }

      // The Nothing: intentionally draws NOTHING. The blank circle of missing bgDots
      // (handled above) is the only evidence. Do not add a border or decoration.

      // ── Ergospheres: frame-dragging ring band (double ring spins at different speeds,
      // same direction; a static black core marks the non-rotating BH itself) ──
      for (const eg of g.ergospheres) {
        const bandCenter = (eg.r0 + eg.r1) / 2;
        // outer ring — slow
        const outerSpin = g.frame * 0.012 * eg.dir;
        ctx.fillStyle = '#5a2a8a';
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * Math.PI * 2 + outerSpin;
          ctx.globalAlpha = 0.5 + (i % 2) * 0.3;
          ctx.fillRect(Math.round(eg.x + Math.cos(a) * eg.r1) - 1, Math.round(eg.y + Math.sin(a) * eg.r1) - 1, 2, 2);
        }
        // inner ring — faster, same direction
        const innerSpin = g.frame * 0.03 * eg.dir;
        for (let i = 0; i < 32; i++) {
          const a = (i / 32) * Math.PI * 2 + innerSpin;
          ctx.globalAlpha = 0.45 + (i % 2) * 0.3;
          ctx.fillRect(Math.round(eg.x + Math.cos(a) * eg.r0) - 1, Math.round(eg.y + Math.sin(a) * eg.r0) - 1, 2, 2);
        }
        // tangential flow streaks inside the band
        ctx.fillStyle = '#7a4ab0';
        const streakSpin = (g.frame * 1.2 * eg.dir) / bandCenter;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + streakSpin;
          ctx.globalAlpha = 0.35;
          ctx.fillRect(Math.round(eg.x + Math.cos(a) * bandCenter) - 1, Math.round(eg.y + Math.sin(a) * bandCenter) - 1, 1, 1);
        }
        ctx.globalAlpha = 1;
        // static black core — the non-rotating BH itself
        drawSolidCircle(ctx, eg.x, eg.y, 8, '#0a0a12');
      }

      // ── Magnetic reconnection: X of field lines, inert until a periodic snap (update + draw) ──
      for (const mr of g.magReconnections) {
        // advance the charge/release cycle (once per frame, not per ball)
        if (mr.releaseTimer > 0) {
          mr.releaseTimer--;
        } else {
          mr.timer--;
          if (mr.timer <= 0) {
            mr.releaseTimer = MR_RELEASE;
            mr.timer = mr.period;
            spawnBurst(g, mr.x, mr.y, 10, 10, '#e040a0');
          }
        }
        const snapping   = mr.releaseTimer > 0;
        const charging   = !snapping && mr.timer <= MR_WARN;
        const flowSpd    = snapping ? 4 : (charging ? 1.2 : 0.4);
        const dotsPerDir = 14;
        const step       = MR_HALFLEN / dotsPerDir;
        const dirs       = [mr.angle, mr.angle + Math.PI, mr.angle + Math.PI / 2, mr.angle + Math.PI * 1.5];
        ctx.fillStyle = snapping || charging ? '#e040a0' : '#701854';
        for (const da of dirs) {
          const dx = Math.cos(da), dy = Math.sin(da);
          for (let i = 0; i < dotsPerDir; i++) {
            // at rest, dots drift inward toward the crossing; a snap reverses them outward
            const raw = snapping
              ? (g.frame * flowSpd + i * step) % MR_HALFLEN
              : MR_HALFLEN - ((g.frame * flowSpd + i * step) % MR_HALFLEN);
            const px = mr.x + dx * raw, py = mr.y + dy * raw;
            const pulse = charging ? (0.5 + Math.abs(Math.sin(g.frame * 0.3)) * 0.5)
                                    : (0.35 + Math.abs(Math.sin(g.frame * 0.03 + i)) * 0.25);
            ctx.globalAlpha = snapping ? 0.9 : pulse;
            const sz = snapping ? 2 : 1;
            ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, sz, sz);
          }
        }
        ctx.globalAlpha = 1;
        if (charging || snapping) drawSolidCircle(ctx, mr.x, mr.y, 3, '#e040a0');
      }

      // ── Pre-supernova stars: swell → boom → collapse cycle (update + draw) ──
      for (const sn of g.preSupernovae) {
        // advance the swell/boom/shrink cycle (once per frame, not per ball)
        if (sn.hitCool  > 0) sn.hitCool--;
        if (sn.hitFlash > 0) sn.hitFlash--;
        if (sn.boomTimer > 0) {
          sn.boomTimer--;
          if (sn.boomTimer === 0) sn.shrinkTimer = SN_SHRINK;
        } else if (sn.shrinkTimer > 0) {
          sn.shrinkTimer--;
        } else {
          sn.timer--;
          if (sn.timer <= 0) {
            sn.boomTimer = SN_BOOM;
            sn.timer = sn.period;
            spawnBurst(g, sn.x, sn.y, 14, 14, '#ffffff');
            spawnBurst(g, sn.x, sn.y, 10, 10, '#ff6a30');
          }
        }
        const snR = sn.boomTimer > 0 ? SN_R_MAX
          : sn.shrinkTimer > 0 ? SN_R_MIN + (sn.shrinkTimer / SN_SHRINK) * (SN_R_MAX - SN_R_MIN)
          : SN_R_MIN + (1 - sn.timer / sn.period) * (SN_R_MAX - SN_R_MIN);
        const growT    = (snR - SN_R_MIN) / (SN_R_MAX - SN_R_MIN); // 0 (calm) → 1 (about to pop)
        const charging = sn.boomTimer <= 0 && sn.shrinkTimer <= 0 && sn.timer <= SN_WARN;
        const flicker  = 0.06 + growT * 0.16 + (charging ? 0.06 : 0); // k: 0.06 → 0.22, faster near boom
        const bodyR    = snR * (1 + Math.sin(g.frame * 0.03) * 0.03); // slow breathing

        // stippled convective body — deepens from red toward orange as it swells
        const coreColor = sn.hitFlash > 0 ? '#ffffff' : (growT > 0.5 ? '#ff6a30' : '#d84a20');
        for (let ring = 1; ring <= 3; ring++) {
          const rr = bodyR * (ring / 3);
          const n  = Math.max(8, Math.round(2 * Math.PI * rr / 4));
          for (let i = 0; i < n; i++) {
            const a     = (i / n) * Math.PI * 2;
            const flick = 0.5 + Math.abs(Math.sin(g.frame * flicker + i * 1.7 + ring)) * 0.5;
            const fleck = charging && Math.sin(g.frame * 0.5 + i * 3.1 + ring) > 0.7;
            ctx.fillStyle   = fleck ? '#ffffff' : coreColor;
            ctx.globalAlpha = 0.35 + flick * 0.45;
            ctx.fillRect(Math.round(sn.x + Math.cos(a) * rr) - 1, Math.round(sn.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        ctx.globalAlpha = 1;
        drawSolidCircle(ctx, sn.x, sn.y, bodyR * 0.35, sn.hitFlash > 0 ? '#ffffff' : '#5a1408');

        // boom shockwave ring (white → red-orange, expands to the full push range)
        if (sn.boomTimer > 0) {
          const bt = 1 - sn.boomTimer / SN_BOOM;
          ctx.fillStyle = bt < 0.4 ? '#ffffff' : '#ff6a30';
          for (let i = 0; i < 48; i++) {
            const a  = (i / 48) * Math.PI * 2;
            const rr = bt * SN_BOOM_RANGE;
            ctx.globalAlpha = (1 - bt) * 0.85;
            ctx.fillRect(Math.round(sn.x + Math.cos(a) * rr) - 1, Math.round(sn.y + Math.sin(a) * rr) - 1, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
      }

      // ── Tidal stretch fields: radial streaks flowing outward + a pulsing core ──
      for (const ts of g.tidalStretches) {
        const corePulse = 0.5 + Math.abs(Math.sin(g.frame * 0.10)) * 0.5;
        ctx.fillStyle = '#4a7aa8';
        const nStreaks = 16;
        for (let i = 0; i < nStreaks; i++) {
          const a  = (i / nStreaks) * Math.PI * 2;
          const dx = Math.cos(a), dy = Math.sin(a);
          // several dots per streak flowing outward, denser near the centre
          for (let j = 0; j < 5; j++) {
            const along = (g.frame * 1.0 + j * 24) % TS_RANGE;
            const prog  = along / TS_RANGE;
            ctx.globalAlpha = (1 - prog) * 0.6;
            ctx.fillRect(Math.round(ts.x + dx * along) - 1, Math.round(ts.y + dy * along) - 1, 1, 1);
          }
        }
        ctx.globalAlpha = 1;
        drawSolidCircle(ctx, ts.x, ts.y, 5, '#2a4a68');
        ctx.fillStyle   = '#8ab0d8';
        ctx.globalAlpha = corePulse;
        ctx.fillRect(Math.round(ts.x) - 2, Math.round(ts.y) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── Tachyon streams: fast streak flow inside a diagonal band + static amber edges ──
      for (const tc of g.tachyonStreams) {
        const dirx = Math.cos(tc.angle), diry = Math.sin(tc.angle);
        const perpx = -diry, perpy = dirx;
        const halfLen = Math.hypot(W, H); // long enough to span the whole board

        // amber edge dashes (static), one line on each side of the band
        ctx.fillStyle = '#d8a030';
        for (let side = -1; side <= 1; side += 2) {
          for (let i = -20; i <= 20; i++) {
            const along = i * (halfLen / 20);
            const px = tc.x + dirx * along + perpx * tc.halfWidth * side;
            const py = tc.y + diry * along + perpy * tc.halfWidth * side;
            if (px < 0 || px > W || py < 0 || py > H) continue;
            ctx.globalAlpha = 0.5;
            ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 1, 1);
          }
        }

        // fast streak flow (catalog's fastest, spd 6). Causality reversed: the dim tail
        // dot leads ahead of the flow direction, the bright head dot trails behind it.
        ctx.fillStyle = '#ffffff';
        const nStreaks = 40;
        for (let i = 0; i < nStreaks; i++) {
          const lane   = ((i * 2654435761) >>> 0) / 0xffffffff; // stable pseudo-random lane 0..1
          const offset = (lane * 2 - 1) * tc.halfWidth * 0.85;
          const along  = ((g.frame * 6 + i * 37) % (halfLen * 2)) - halfLen;
          const px = tc.x + dirx * along + perpx * offset;
          const py = tc.y + diry * along + perpy * offset;
          if (px < -10 || px > W + 10 || py < -10 || py > H + 10) continue;
          const leadPx = px + dirx * 3, leadPy = py + diry * 3;
          ctx.globalAlpha = 0.35;
          ctx.fillRect(Math.round(leadPx) - 1, Math.round(leadPy) - 1, 1, 1);
          ctx.globalAlpha = 0.85;
          ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Cosmic voids: near-nothingness — only a faint dashed boundary hints it's there ──
      for (const cv of g.cosmicVoids) {
        const pulse = 0.20 + Math.abs(Math.sin(g.frame * 0.015)) * 0.05; // barely perceptible
        ctx.fillStyle = '#b8b4a8';
        const nDash = 48;
        for (let i = 0; i < nDash; i++) {
          if (i % 2 === 0) continue; // dashed
          const a  = (i / nDash) * Math.PI * 2;
          const px = cv.x + Math.cos(a) * cv.rx;
          const py = cv.y + Math.sin(a) * cv.ry;
          ctx.globalAlpha = pulse;
          ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Dark energy patches: an expanding-lattice loop visualizes the distance-proportional
      // push (the white hole's inverse profile) + a static dashed pink boundary ────────────
      for (const de of g.darkEnergyPatches) {
        const loopT = (g.frame % DE_LOOP_PERIOD) / DE_LOOP_PERIOD;
        const k = 1 - (1 - loopT) * (1 - loopT); // ease-out: fast start, decelerating growth
        ctx.fillStyle = '#c8a8a0';
        for (const p of de.grid) {
          const px = de.x + p.x * (1 + k * 0.35);
          const py = de.y + p.y * (1 + k * 0.35);
          ctx.globalAlpha = 0.22 * (1 - k * 0.4);
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
        ctx.globalAlpha = 1;
        // static dashed boundary (redshift hint) — doesn't move with the loop
        ctx.fillStyle = '#e88878';
        const nDash = 40;
        for (let i = 0; i < nDash; i++) {
          if (i % 2 === 0) continue;
          const a = (i / nDash) * Math.PI * 2;
          ctx.globalAlpha = 0.35;
          ctx.fillRect(Math.round(de.x + Math.cos(a) * DE_RANGE) - 1, Math.round(de.y + Math.sin(a) * DE_RANGE) - 1, 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Naked singularities: a broken vortex of blood-red/white dots with an oscillating,
      // sometimes-reversing spin — and a total 1-frame freeze every NS_FREEZE_PERIOD frames
      // (the "law of physics breaks" beat) ─────────────────────────────────────────────────
      for (const ns of g.nakedSingularities) {
        const frozen = g.frame % NS_FREEZE_PERIOD === 0;
        if (!frozen) ns.spinAngle += 0.05 * Math.sin(g.frame * 0.013);
        drawSolidCircle(ctx, ns.x, ns.y, 12, '#0f0f0d');
        const nDots = 30;
        for (let ring = 0; ring < 2; ring++) {
          const rr = 18 + ring * 14;
          for (let i = 0; i < nDots; i++) {
            const a = (i / nDots) * Math.PI * 2 + ns.spinAngle * (ring === 0 ? 1 : -1.3);
            ctx.fillStyle = i % 2 === 0 ? '#c01030' : '#ffffff';
            ctx.globalAlpha = frozen ? 0.5 : 0.3 + Math.abs(Math.sin(g.frame * 0.19 + i * 3)) * 0.5;
            ctx.fillRect(Math.round(ns.x + Math.cos(a) * rr) - 1, Math.round(ns.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Rogue black holes: a miniature version of the main BH's blood-red vortex,
      // drifting on a slow Lissajous path with an accretion-dot tail trailing behind its
      // current direction of travel ("a black hole that lost its home") ───────────────────
      for (const rbh of g.rogueBHs) {
        if (rbh.flashTimer > 0) rbh.flashTimer--;
        const rcx = rbh.cx0 + Math.sin(g.frame * RBH_LISS_FX) * RBH_LISS_AX;
        const rcy = rbh.cy0 + Math.sin(g.frame * RBH_LISS_FY) * RBH_LISS_AY;
        // instantaneous drift direction (derivative of the parametric position)
        const rvx = Math.cos(g.frame * RBH_LISS_FX) * RBH_LISS_AX * RBH_LISS_FX;
        const rvy = Math.cos(g.frame * RBH_LISS_FY) * RBH_LISS_AY * RBH_LISS_FY;
        const rvlen = Math.sqrt(rvx * rvx + rvy * rvy) || 1;
        const rdirx = rvx / rvlen, rdiry = rvy / rvlen;
        // accretion tail trailing behind the direction of travel
        for (let ti = 1; ti <= 10; ti++) {
          const td = ti * 5;
          const tx = rcx - rdirx * td + (Math.random() - 0.5) * 3;
          const ty = rcy - rdiry * td + (Math.random() - 0.5) * 3;
          ctx.fillStyle = ti < 4 ? '#c01030' : '#6a0030';
          ctx.globalAlpha = (1 - ti / 11) * 0.6;
          ctx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 1, 1);
        }
        ctx.globalAlpha = 1;
        // rotating blood-red dot ring (same rotation rate as the main BH's vortex, k=0.02)
        const spin = g.frame * 0.02;
        ctx.fillStyle = '#c01030';
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2 + spin;
          ctx.globalAlpha = 0.35 + (i % 2) * 0.25;
          ctx.fillRect(Math.round(rcx + Math.cos(a) * 16) - 1, Math.round(rcy + Math.sin(a) * 16) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
        // dark core matching the absorption radius
        drawSolidCircle(ctx, rcx, rcy, RBH_ABSORB_R, '#1a0006');
        // absorption flash — reuses the same beat as spawnBHAbsorb's ripple
        if (rbh.flashTimer > 0) {
          const ft = rbh.flashTimer / 36;
          const fr = (1 - ft) * 50;
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = ft * 0.8;
          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2;
            ctx.fillRect(Math.round(rcx + Math.cos(a) * fr) - 1, Math.round(rcy + Math.sin(a) * fr) - 1, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
      }

      // ── Odd Radio Circles: a barely-visible ultra-slow expanding ghost ring (update +
      // draw). Cycle: grow (r 60→260, ~900f) → fadeOut (20f) → recondense (20f, points
      // converge to the center) → grow again. Base alpha is capped at 0.3 and fades further
      // as the ring expands — "only detectable by radio," almost invisible except where a
      // ball has just crossed it. ──────────────────────────────────────────────────────────
      for (const orc of g.oddRadioCircles) {
        for (let bi = 0; bi < orc.litBins.length; bi++) if (orc.litBins[bi] > 0) orc.litBins[bi]--;

        if (orc.phase === 'grow') {
          orc.radius += (ORC_R_MAX - ORC_R_MIN) / ORC_GROW_FRAMES;
          if (orc.radius >= ORC_R_MAX) { orc.radius = ORC_R_MAX; orc.phase = 'fadeOut'; orc.timer = ORC_FADE_DUR; }
        } else if (orc.phase === 'fadeOut') {
          orc.timer--;
          if (orc.timer <= 0) { orc.phase = 'recondense'; orc.timer = ORC_RECONDENSE_DUR; }
        } else { // recondense
          orc.timer--;
          if (orc.timer <= 0) { orc.phase = 'grow'; orc.radius = ORC_R_MIN; }
        }

        const baseAlpha = orc.phase === 'grow'    ? Math.min(0.3, ORC_BAND_HALF / orc.radius)
                         : orc.phase === 'fadeOut' ? Math.min(0.3, ORC_BAND_HALF / orc.radius) * (orc.timer / ORC_FADE_DUR)
                         :                           0; // recondense draws its own effect below

        if (orc.phase !== 'recondense' && baseAlpha > 0.002) {
          ctx.fillStyle = '#9a7ad8';
          const nDots = Math.max(24, Math.round((2 * Math.PI * orc.radius) / 8));
          for (let i = 0; i < nDots; i++) {
            const a = (i / nDots) * Math.PI * 2;
            ctx.globalAlpha = baseAlpha * (0.6 + (i % 2) * 0.3);
            ctx.fillRect(Math.round(orc.x + Math.cos(a) * orc.radius) - 1, Math.round(orc.y + Math.sin(a) * orc.radius) - 1, 1, 1);
          }
          ctx.globalAlpha = 1;
        }

        // brighter lit arcs where a ball just crossed ("only visible where it's felt")
        const binWidth = (Math.PI * 2) / ORC_LIT_BINS;
        for (let bi = 0; bi < orc.litBins.length; bi++) {
          if (orc.litBins[bi] <= 0) continue;
          const lt = orc.litBins[bi] / ORC_LIT_DUR;
          const binCenter = bi * binWidth;
          ctx.fillStyle = '#c8b0f0';
          for (let s = -3; s <= 3; s++) {
            const a = binCenter + (s / 3) * (binWidth / 2);
            ctx.globalAlpha = lt * 0.8;
            ctx.fillRect(Math.round(orc.x + Math.cos(a) * orc.radius) - 1, Math.round(orc.y + Math.sin(a) * orc.radius) - 1, 2, 2);
          }
          ctx.globalAlpha = 1;
        }

        // recondense: a point cloud converging inward from the outer radius to the center
        if (orc.phase === 'recondense') {
          const rt = 1 - orc.timer / ORC_RECONDENSE_DUR; // 0 → 1
          const rr = ORC_R_MAX * (1 - rt);
          ctx.fillStyle = '#9a7ad8';
          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2;
            ctx.globalAlpha = 0.25 * rt;
            ctx.fillRect(Math.round(orc.x + Math.cos(a) * rr) - 1, Math.round(orc.y + Math.sin(a) * rr) - 1, 1, 1);
          }
          ctx.globalAlpha = 1;
        }
      }

      // ── Baryon Acoustic Oscillation: three static concentric rings, quietly breathing out
      // of phase (120° apart) so the pulse reads as traveling from the inner ring outward —
      // a "frozen sound wave" that never moves, fades, or respawns. ─────────────────────────
      for (const bao of g.baryonOscillations) {
        for (let ri = 0; ri < BAO_RADII.length; ri++) {
          for (let bi = 0; bi < bao.litBins[ri].length; bi++) if (bao.litBins[ri][bi] > 0) bao.litBins[ri][bi]--;
        }
        for (let ri = 0; ri < BAO_RADII.length; ri++) {
          const baPhase = ri * (Math.PI * 2 / 3);
          const baEffR = BAO_RADII[ri] + BAO_BREATHE_AMP * Math.sin(g.frame * BAO_BREATHE_FREQ + baPhase);
          ctx.fillStyle = '#b8a888';
          const nDots = Math.max(24, Math.round((2 * Math.PI * baEffR) / 7));
          for (let i = 0; i < nDots; i++) {
            const a = (i / nDots) * Math.PI * 2;
            const flicker = 0.5 + 0.5 * Math.sin(g.frame * 0.01 + i * 1.7 + ri * 5);
            ctx.globalAlpha = 0.22 + flicker * 0.18;
            ctx.fillRect(Math.round(bao.x + Math.cos(a) * baEffR) - 1, Math.round(bao.y + Math.sin(a) * baEffR) - 1, 1, 1);
          }
          ctx.globalAlpha = 1;

          // brighter lit arc where a ball just touched this ring
          const baBinWidth = (Math.PI * 2) / BAO_LIT_BINS;
          for (let bi = 0; bi < bao.litBins[ri].length; bi++) {
            if (bao.litBins[ri][bi] <= 0) continue;
            const balt = bao.litBins[ri][bi] / BAO_LIT_DUR;
            const binCenter = bi * baBinWidth;
            ctx.fillStyle = '#e8d8b0';
            for (let s = -3; s <= 3; s++) {
              const a = binCenter + (s / 3) * (baBinWidth / 2);
              ctx.globalAlpha = balt * 0.85;
              ctx.fillRect(Math.round(bao.x + Math.cos(a) * baEffR) - 1, Math.round(bao.y + Math.sin(a) * baEffR) - 1, 2, 2);
            }
            ctx.globalAlpha = 1;
          }
        }
      }

      // ── Tidal disruption events: an in-winding white spiral around a dark core, with a
      // pale-blue jet pillar streaming upward (the star's remnant, ripped apart and half-
      // ejected) ───────────────────────────────────────────────────────────────────────────
      for (const tde of g.tidalDisruptions) {
        // inward spiral dot stream
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 24; i++) {
          const prog = ((g.frame * 1.8 + i * 14) % TDE_RANGE) / TDE_RANGE; // 0 (edge) → 1 (core)
          const rr = TDE_RANGE * (1 - prog);
          const a = (i / 24) * Math.PI * 2 + tde.dir * prog * 4; // winds inward as it approaches
          ctx.globalAlpha = (1 - prog) * 0.7;
          ctx.fillRect(Math.round(tde.x + Math.cos(a) * rr) - 1, Math.round(tde.y + Math.sin(a) * rr) - 1, 1, 1);
        }
        ctx.globalAlpha = 1;
        // dark static core (torn star's remnant)
        drawSolidCircle(ctx, tde.x, tde.y, TDE_JET_R * 0.6, '#1a1420');
        // upward jet pillar of dot flow
        ctx.fillStyle = '#8fd3f4';
        for (let i = 0; i < 14; i++) {
          const jprog = ((g.frame * 3 + i * 8) % 100) / 100;
          const jy = tde.y - jprog * 90;
          ctx.globalAlpha = (1 - jprog) * 0.55;
          ctx.fillRect(Math.round(tde.x + (Math.random() - 0.5) * 4) - 1, Math.round(jy) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Axion walls: phase-shifting OBB membrane (update + draw) ──────────
      // Cycle: gone → fadeIn → solid → fadeOut → gone. Only 'solid' collides (handled in
      // the sub-step loop); this block just advances the cycle and renders each phase.
      for (const aw of g.axionWalls) {
        if (aw.hitCool  > 0) aw.hitCool--;
        if (aw.hitFlash > 0) aw.hitFlash--;
        aw.timer--;
        if (aw.timer <= 0) {
          if (aw.phase === 'gone')        { aw.phase = 'fadeIn';  aw.timer = AXION_FADE;  }
          else if (aw.phase === 'fadeIn')   { aw.phase = 'solid';   aw.timer = AXION_SOLID; }
          else if (aw.phase === 'solid')    { aw.phase = 'fadeOut'; aw.timer = AXION_FADE;  }
          else                                { aw.phase = 'gone';    aw.timer = AXION_GONE;  }
        }

        const cosA = Math.cos(aw.angle), sinA = Math.sin(aw.angle);
        const crumbling = aw.phase === 'solid' && aw.timer <= 10; // pre-vanish telegraph
        let alpha: number, jitterAmp: number, driftY: number;
        if (aw.phase === 'gone') {
          alpha = 0.05; jitterAmp = 0; driftY = 0;
        } else if (aw.phase === 'fadeIn') {
          const t = 1 - aw.timer / AXION_FADE; // 0 → 1, scattered → aligned
          alpha = 0.05 + t * 0.95;
          jitterAmp = (1 - t) * 10;
          driftY = 0;
        } else if (aw.phase === 'solid') {
          alpha = 1;
          jitterAmp = crumbling ? 2.4 : 1.2;
          driftY = 0;
        } else { // fadeOut
          const t = 1 - aw.timer / AXION_FADE; // 0 → 1, aligned → dispersing
          alpha = 1 - t * 0.95;
          jitterAmp = 1.2 + t * 8;
          driftY = t * 12;
        }

        const nDots = 14;
        for (let i = 0; i < nDots; i++) {
          const lx     = (i / (nDots - 1) - 0.5) * AXION_W;
          const jitter = Math.sin(g.frame * 0.4 + i * 2.3) * jitterAmp;
          const wx = aw.x + cosA * lx - sinA * jitter;
          const wy = aw.y + sinA * lx + cosA * jitter + driftY;
          const pulse = 0.6 + Math.abs(Math.sin(g.frame * 0.08 + i)) * 0.4;
          ctx.fillStyle   = aw.hitFlash > 0 ? '#ffffff' : (i % 3 === 0 ? '#c8b8e8' : '#e8e4f0');
          ctx.globalAlpha = alpha * pulse;
          ctx.fillRect(Math.round(wx) - 1, Math.round(wy) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── FRB sources: edge emitter with a periodic instantaneous burst (update + draw) ──
      for (const frb of g.frbSources) {
        frb.fired = false;
        if (frb.burstAge >= 0) {
          frb.burstAge++;
          if (frb.burstAge > 20) frb.burstAge = -1;
        }
        frb.timer--;
        if (frb.timer <= 0) {
          frb.fired     = true;
          frb.burstAge  = 0;
          frb.fireAngle = (Math.random() < 0.5 ? -1 : 1) * FRB_ANGLE;
          frb.timer     = frb.period;
        }

        const charging = frb.burstAge < 0 && frb.timer <= FRB_WARN;
        let sourceOn: boolean;
        if (frb.fired) {
          sourceOn = true;
        } else if (charging) {
          const wt       = 1 - frb.timer / FRB_WARN; // 0 → 1 as the burst approaches
          const interval = Math.max(2, Math.round(16 * (1 - wt)) + 2);
          sourceOn = (g.frame % interval) < interval / 2;
        } else {
          sourceOn = ((g.frame >> 4) & 0b1011) !== 0; // morse-like irregular flicker
        }
        ctx.fillStyle = '#58c8e8';
        if (sourceOn) {
          ctx.globalAlpha = frb.fired ? 1 : (charging ? 0.9 : 0.5);
          ctx.fillRect(Math.round(frb.x) - 2, Math.round(frb.y) - 2, 4, 4);
        }
        ctx.globalAlpha = 1;

        // 3 concentric shockwave rings, staggered 4f apart, each animating over 12f
        if (frb.burstAge >= 0) {
          for (let ring = 0; ring < 3; ring++) {
            const localAge = frb.burstAge - ring * 4;
            if (localAge < 0 || localAge > 12) continue;
            const rt = localAge / 12;
            const rr = rt * FRB_RING_RANGE;
            for (let i = 0; i < 40; i++) {
              const a = (i / 40) * Math.PI * 2;
              ctx.globalAlpha = (1 - rt) * 0.8;
              ctx.fillRect(Math.round(frb.x + Math.cos(a) * rr) - 1, Math.round(frb.y + Math.sin(a) * rr) - 1, 2, 2);
            }
          }
          ctx.globalAlpha = 1;
        }
      }

      // ── Little Red Dots: tiny stationary red dots that blink on independent cycles. Fade-in
      // leads with the gas-cocoon halo (core catches up after), fade-out leads with the core
      // fading first while the halo lingers a moment longer — per spec, the whole gimmick IS
      // the blink, so nothing else is drawn while unlit. ─────────────────────────────────────
      for (const lrd of g.littleRedDots) {
        if (lrd.hitCool > 0) lrd.hitCool--;
        if (lrd.hitFlash > 0) lrd.hitFlash--;
        const lrdCyclePos = (g.frame + lrd.phase) % (LRD_ON_FRAMES + LRD_OFF_FRAMES);
        if (lrdCyclePos < LRD_ON_FRAMES) {
          let haloA = 1, coreA = 1;
          const half = LRD_FADE / 2;
          if (lrdCyclePos < LRD_FADE) {
            haloA = Math.min(1, lrdCyclePos / half);
            coreA = Math.max(0, (lrdCyclePos - half) / half);
          } else if (lrdCyclePos >= LRD_ON_FRAMES - LRD_FADE) {
            const ft = lrdCyclePos - (LRD_ON_FRAMES - LRD_FADE);
            coreA = Math.max(0, 1 - ft / half);
            haloA = ft < half ? 1 : Math.max(0, 1 - (ft - half) / half);
          }
          const haloBreathe = 0.7 + 0.3 * Math.sin(g.frame * 0.04);
          const corePulse   = 0.7 + 0.3 * Math.sin(g.frame * 0.09);
          if (haloA > 0) {
            const haloR = LRD_R * 2.2, haloN = 10;
            ctx.fillStyle = '#e85a3a';
            for (let i = 0; i < haloN; i++) {
              const a = (i / haloN) * Math.PI * 2;
              ctx.globalAlpha = haloA * 0.5 * haloBreathe;
              ctx.fillRect(Math.round(lrd.x + Math.cos(a) * haloR) - 1, Math.round(lrd.y + Math.sin(a) * haloR) - 1, 2, 2);
            }
          }
          if (coreA > 0) {
            ctx.fillStyle = '#c02818';
            ctx.globalAlpha = coreA * corePulse;
            ctx.fillRect(Math.round(lrd.x) - LRD_R / 2, Math.round(lrd.y) - LRD_R / 2, LRD_R, LRD_R);
          }
          ctx.globalAlpha = 1;
        }
        if (lrd.hitFlash > 0) {
          ctx.fillStyle = '#ff6a4a';
          ctx.globalAlpha = lrd.hitFlash / 6;
          ctx.fillRect(Math.round(lrd.hitX) - 2, Math.round(lrd.hitY) - 2, 4, 4);
          ctx.globalAlpha = 1;
        }
      }

      // ── Antimatter flecks: drifting micro-mine (update + draw) ────────────
      for (const af of g.antimatterFlecks) {
        if (af.gammaFlash > 0) af.gammaFlash--;
        if (af.respawnTimer > 0) {
          af.respawnTimer--;
          if (af.respawnTimer === 0) {
            // reform at a new drifting position elsewhere on the board
            af.x = W * (0.15 + Math.random() * 0.7);
            af.y = launcherY + 60 + Math.random() * (H - launcherY - 130);
            const a = Math.random() * Math.PI * 2;
            af.vx = Math.cos(a) * AF_SPEED;
            af.vy = Math.sin(a) * AF_SPEED;
          }
        } else {
          af.x += af.vx; af.y += af.vy;
          if (af.x < af.r && af.vx < 0) af.vx = Math.abs(af.vx);
          if (af.x > W - af.r && af.vx > 0) af.vx = -Math.abs(af.vx);
          if (af.y < launcherY + 40 + af.r && af.vy < 0) af.vy = Math.abs(af.vy);
          if (af.y > H - 70 - af.r && af.vy > 0) af.vy = -Math.abs(af.vy);
        }

        // gamma-ray spark: two brief vertical lines at the annihilation point
        if (af.gammaFlash > 0) {
          const gt = af.gammaFlash / 6;
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = gt;
          for (let d = -1; d <= 1; d += 2) {
            for (let s = 4; s <= 20; s += 4) {
              ctx.fillRect(Math.round(af.x) - 1, Math.round(af.y + d * s) - 1, 2, 2);
            }
          }
          ctx.globalAlpha = 1;
        }

        if (af.respawnTimer > AF_FADE) continue; // fully gone — nothing more to draw

        // reform fade-in (last AF_FADE frames of the dormant window) + a collapsing ring
        const fadeT = af.respawnTimer > 0 ? 1 - af.respawnTimer / AF_FADE : 1;
        if (af.respawnTimer > 0) {
          const rr = af.r + (1 - fadeT) * 30;
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            ctx.globalAlpha = (1 - fadeT) * 0.6;
            ctx.fillRect(Math.round(af.x + Math.cos(a) * rr) - 1, Math.round(af.y + Math.sin(a) * rr) - 1, 1, 1);
          }
          ctx.globalAlpha = 1;
        }

        // inverted-dot motif: black ring body with a fast-pulsing white core (danger signal)
        drawSolidCircle(ctx, af.x, af.y, af.r, '#0f0f0d');
        const corePulse = 0.5 + Math.abs(Math.sin(g.frame * 0.3)) * 0.5;
        ctx.fillStyle   = '#ffffff';
        ctx.globalAlpha = fadeT * corePulse;
        ctx.fillRect(Math.round(af.x) - 2, Math.round(af.y) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── Quantum tunneling barriers: dashed dots flicker in/out of existence (update + draw) ──
      for (const qb of g.quantumBarriers) {
        if (qb.reflectFlash > 0) qb.reflectFlash--;
        const cosA   = Math.cos(qb.angle), sinA = Math.sin(qb.angle);
        const solidT = qb.reflectFlash / QB_FLASH_DUR; // 1 → 0, fully lit while high
        const nDots  = 20;
        ctx.fillStyle = '#3a4a9a';
        for (let i = 0; i < nDots; i++) {
          const lx      = (i / (nDots - 1) - 0.5) * QB_W;
          const flicker = Math.sin(g.frame * 0.11 + i * 7) > 0; // quantum in/out flicker
          if (solidT <= 0 && !flicker) continue;
          const wx = qb.x + cosA * lx;
          const wy = qb.y + sinA * lx;
          ctx.globalAlpha = solidT > 0 ? (0.6 + solidT * 0.4) : 0.55;
          ctx.fillRect(Math.round(wx) - 1, Math.round(wy) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Time dilation fields: clock-face arcs rotating at the catalog's slowest pace ──
      for (const td of g.timeDilations) {
        const pulse = 0.5 + Math.abs(Math.sin(g.frame * 0.02)) * 0.5;
        ctx.fillStyle = '#c89030';
        for (let ring = 0; ring < 3; ring++) {
          const rr = TD_RADIUS * (0.4 + ring * 0.28);
          const n  = 16 + ring * 6;
          const spin = g.frame * 0.002 * (ring % 2 === 0 ? 1 : -1); // near-imperceptible rotation
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + spin;
            ctx.globalAlpha = pulse * (0.35 + (i % 2) * 0.25);
            ctx.fillRect(Math.round(td.x + Math.cos(a) * rr) - 1, Math.round(td.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Cosmic strings: near-static 1px lines — only the end knots jitter, plus a rare
      // glint traversal and a 2f vibration + 1f ball afterimage on crossing ────────────
      for (const cs of g.cosmicStrings) {
        const csCos = Math.cos(cs.angle), csSin = Math.sin(cs.angle);
        const halfLen = CS_LENGTH * 0.5;
        const vib = cs.hitFlash > 0 ? (cs.hitFlash % 2 === 0 ? 1 : -1) : 0; // ±1px 2f vibration
        if (cs.hitFlash > 0) cs.hitFlash--;
        const perpX = -csSin, perpY = csCos;
        ctx.fillStyle = '#fffaf0';
        ctx.globalAlpha = 0.85;
        for (let t = -halfLen; t <= halfLen; t += 1) {
          const px = cs.x + csCos * t + perpX * vib;
          const py = cs.y + csSin * t + perpY * vib;
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
        ctx.globalAlpha = 1;
        // end knots: small dot clusters with a tiny independent jitter
        for (const end of [-1, 1] as const) {
          const kx = cs.x + csCos * halfLen * end;
          const ky = cs.y + csSin * halfLen * end;
          const jx = Math.sin(g.frame * 0.17 + end) * 1.1;
          const jy = Math.cos(g.frame * 0.13 + end) * 1.1;
          ctx.globalAlpha = 0.9;
          ctx.fillRect(Math.round(kx + jx) - 1, Math.round(ky + jy) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
        // rare glint traveling the line's length once per cycle
        const glintDist = (g.frame % CS_GLINT_PERIOD) * CS_GLINT_SPEED;
        if (glintDist <= CS_LENGTH) {
          const gx = cs.x + csCos * (-halfLen + glintDist);
          const gy = cs.y + csSin * (-halfLen + glintDist);
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.9;
          ctx.fillRect(Math.round(gx) - 1, Math.round(gy) - 1, 2, 2);
          ctx.globalAlpha = 1;
        }
        // 1f ball afterimage at the old + new crossing positions
        if (cs.ghostFlash > 0) {
          ctx.fillStyle = '#fffaf0';
          ctx.globalAlpha = 0.5;
          ctx.fillRect(Math.round(cs.ghostOldX) - BALL_R, Math.round(cs.ghostOldY) - BALL_R, BALL_R * 2, BALL_R * 2);
          ctx.fillRect(Math.round(cs.ghostNewX) - BALL_R, Math.round(cs.ghostNewY) - BALL_R, BALL_R * 2, BALL_R * 2);
          ctx.globalAlpha = 1;
          cs.ghostFlash--;
        }
      }

      // ── Einstein mirror rings: thin silver ring + two orbiting lensed-image points ────────
      for (const emr of g.einsteinMirrorRings) {
        if (emr.hitFlash   > 0) emr.hitFlash--;
        if (emr.shockTimer > 0) emr.shockTimer--;
        if (emr.ghostFlash > 0) emr.ghostFlash--;
        const flashing = emr.hitFlash > 0;
        ctx.fillStyle = flashing ? '#ffffff' : '#d8dce8';
        const nDots = 48;
        for (let i = 0; i < nDots; i++) {
          const a = (i / nDots) * Math.PI * 2;
          ctx.globalAlpha = flashing ? 0.95 : 0.5 + (i % 2) * 0.2;
          ctx.fillRect(Math.round(emr.x + Math.cos(a) * EMR_R) - 1, Math.round(emr.y + Math.sin(a) * EMR_R) - 1, 1, 1);
        }
        ctx.globalAlpha = 1;
        // two bright lensed-image points orbiting the ring at symmetric (opposite) positions
        const spin = g.frame * 0.02;
        ctx.fillStyle = '#ffffff';
        for (const off of [0, Math.PI]) {
          const a = spin + off;
          ctx.globalAlpha = 0.85;
          ctx.fillRect(Math.round(emr.x + Math.cos(a) * EMR_R) - 1, Math.round(emr.y + Math.sin(a) * EMR_R) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
        // expanding silver shockwave ring from the crossing point
        if (emr.shockTimer > 0) {
          const st = 1 - emr.shockTimer / EMR_SHOCK_DUR;
          const sr = st * EMR_SHOCK_MAX_R;
          ctx.fillStyle = '#eef0f8';
          ctx.globalAlpha = (1 - st) * 0.7;
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            ctx.fillRect(Math.round(emr.shockX + Math.cos(a) * sr) - 1, Math.round(emr.shockY + Math.sin(a) * sr) - 1, 1, 1);
          }
          ctx.globalAlpha = 1;
        }
        // mirror-image ball ghost at the ring-symmetric (point-reflected) position, 1 frame
        if (emr.ghostFlash > 0) {
          ctx.fillStyle = '#d8dce8';
          ctx.globalAlpha = 0.6;
          ctx.fillRect(Math.round(emr.ghostX) - BALL_R, Math.round(emr.ghostY) - BALL_R, BALL_R * 2, BALL_R * 2);
          ctx.globalAlpha = 1;
        }
      }

      // ── Boss core ─────────────────────────────────────────────────────────
      if (g.boss && g.boss.hp > 0) {
        const b   = g.boss;
        const fr2 = g.frame;
        const pulse = 0.5 + Math.abs(Math.sin(fr2 * 0.06)) * 0.5;
        const flash = b.hitFlash > 0 ? b.hitFlash / 10 : 0;
        const enraged = b.hp <= b.maxHp * 0.30;
        // menacing aura — intensifies when enraged (HP < 30%)
        ctx.fillStyle = enraged ? '#ff1a3a' : '#6a0030';
        const auraR = enraged ? b.r + 9 : b.r + 6;
        for (let i = 0; i < 40; i++) {
          const a  = (i / 40) * Math.PI * 2;
          const ar = auraR + Math.sin(fr2 * (enraged ? 0.12 : 0.05) + i) * (enraged ? 5 : 3);
          ctx.globalAlpha = enraged ? (0.18 + pulse * 0.22) : (0.10 + pulse * 0.12);
          ctx.fillRect(Math.round(b.x + Math.cos(a) * ar) - 1, Math.round(b.y + Math.sin(a) * ar) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
        // filled core body
        drawSolidCircle(ctx, b.x, b.y, b.r, flash > 0 ? '#ff5a33' : '#2a0a18');
        // inner detail rings (dot stipple)
        for (let ring = 1; ring <= 2; ring++) {
          const rr = b.r * (0.40 + ring * 0.22);
          const n  = Math.round(2 * Math.PI * rr / 4);
          ctx.fillStyle = ring === 1 ? '#c01040' : '#7a0828';
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + fr2 * (ring === 1 ? 0.01 : -0.008);
            ctx.globalAlpha = 0.5 + (i % 2) * 0.3;
            ctx.fillRect(Math.round(b.x + Math.cos(a) * rr) - 1, Math.round(b.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        // single bright eye
        ctx.globalAlpha = 0.7 + pulse * 0.3;
        ctx.fillStyle = flash > 0 ? '#ffffff' : '#ff4466';
        ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4);
        // re-arm shockwave ring
        if (b.rearmFlash > 0) {
          const rt = 1 - b.rearmFlash / 18;
          ctx.fillStyle = '#66aaff';
          for (let i = 0; i < 36; i++) {
            const a = (i / 36) * Math.PI * 2;
            const rr = (b.r + 10) + rt * 30;
            ctx.globalAlpha = (1 - rt) * 0.7;
            ctx.fillRect(Math.round(b.x + Math.cos(a) * rr) - 1, Math.round(b.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        // HP ring: one segment per maxHp, lit = remaining hp
        const ringR = b.r + 11;
        for (let i = 0; i < b.maxHp; i++) {
          const a  = (i / b.maxHp) * Math.PI * 2 - Math.PI / 2;
          const hx = Math.round(b.x + Math.cos(a) * ringR);
          const hy = Math.round(b.y + Math.sin(a) * ringR);
          ctx.globalAlpha = i < b.hp ? 1 : 0.35;
          ctx.fillStyle   = i < b.hp ? '#ff3344' : '#3a0a14';
          ctx.fillRect(hx - 2, hy - 2, 4, 4);
        }
        ctx.globalAlpha = 1;
      }

      // ── Lightning arcs ────────────────────────────────────────────────────
      g.lightningArcs = g.lightningArcs.filter(arc => arc.age < arc.maxAge);
      for (const arc of g.lightningArcs) {
        arc.age++;
        const arcFade = 1 - arc.age / arc.maxAge;
        ctx.fillStyle = arc.age < arc.maxAge * 0.35 ? '#ffffff' : '#ffee44';
        for (let i = 0; i < arc.pts.length - 1; i++) {
          const pt = arc.pts[i];
          ctx.globalAlpha = arcFade * 0.90;
          ctx.fillRect(Math.round(pt.x) - 1, Math.round(pt.y) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Pegs ─────────────────────────────────────────────────────────────
      const bombPulse = 0.55 + Math.abs(Math.sin(g.frame * 0.14)) * 0.45; // ~2.7 beats/sec
      for (const peg of g.pegs) {
        if (peg.cleared) continue;
        if (peg.hitCool > 0) peg.hitCool--;

        if (peg.type === 'bomb') {
          const pulse  = bombPulse;
          // Outer glow ring (expands/contracts)
          const outerR = PEG_R + 3 + pulse * 4;
          const oCount = Math.max(6, Math.round(2 * Math.PI * outerR / 3.5));
          ctx.fillStyle = '#ff2200';
          for (let i = 0; i < oCount; i++) {
            const a = (i / oCount) * Math.PI * 2;
            ctx.globalAlpha = pulse * 0.28;
            ctx.fillRect(Math.round(peg.x + Math.cos(a) * outerR) - 1, Math.round(peg.y + Math.sin(a) * outerR) - 1, 2, 2);
          }
          // Inner glow ring
          const innerR = PEG_R + 1;
          const iCount = Math.max(6, Math.round(2 * Math.PI * innerR / 3.0));
          for (let i = 0; i < iCount; i++) {
            const a = (i / iCount) * Math.PI * 2;
            ctx.globalAlpha = pulse * 0.55;
            ctx.fillRect(Math.round(peg.x + Math.cos(a) * innerR) - 1, Math.round(peg.y + Math.sin(a) * innerR) - 1, 1, 1);
          }
          ctx.globalAlpha = 1;
          drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, '#cc1100', pulse);
        } else {
          if (peg.type === 'magnet') {
            drawSolidCircle(ctx, peg.x, peg.y, PEG_R, '#000000');
          } else if (peg.type === 'chain-node') {
            drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, '#8090a8', 1.0);
          } else if (peg.type === 'chain-weak') {
            const hpRatio = (peg.hp ?? 1) / (peg.maxHp ?? 1);
            const cx = Math.round(peg.x), cy = Math.round(peg.y);
            // Body: shifts dark rust → bright red as HP drops
            const bodyCol = hpRatio > 0.6 ? '#380c00' : hpRatio > 0.3 ? '#5a1600' : '#8a2200';
            drawSolidCircle(ctx, peg.x, peg.y, PEG_R, bodyCol);
            // Crosshair target symbol: "aim here"
            const aimCol = hpRatio > 0.6 ? '#b82000' : hpRatio > 0.3 ? '#d03000' : '#ff4400';
            ctx.fillStyle = aimCol;
            ctx.globalAlpha = 0.85;
            ctx.fillRect(cx - 7, cy - 1, 15, 2);  // horizontal bar
            ctx.fillRect(cx - 1, cy - 7,  2, 15); // vertical bar
            // HP ring: 3x3 segments, high contrast
            const ringR   = PEG_R + 7;
            const maxSegs = peg.maxHp ?? CHAIN_HP_BASE;
            const litSegs = peg.hp   ?? (peg.maxHp ?? CHAIN_HP_BASE);
            for (let i = 0; i < maxSegs; i++) {
              const a  = (i / maxSegs) * Math.PI * 2 - Math.PI / 2;
              const hx = Math.round(peg.x + Math.cos(a) * ringR);
              const hy = Math.round(peg.y + Math.sin(a) * ringR);
              ctx.fillStyle   = i < litSegs ? '#ff3300' : '#1e0400';
              ctx.globalAlpha = i < litSegs ? 1.0 : 0.40;
              ctx.fillRect(hx - 1, hy - 1, 3, 3);
            }
            ctx.globalAlpha = 1;
          } else if (peg.type === 'shield') {
            // Blue core + animated shield ring when hp >= 2
            drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, '#0a2040', 1.0);
            if ((peg.hp ?? SHIELD_HP) >= SHIELD_HP) {
              const shRingR = PEG_R + 5;
              const shCount = Math.round(2 * Math.PI * shRingR / 3.5);
              const shPulse = 0.55 + Math.abs(Math.sin(g.frame * 0.11)) * 0.45;
              ctx.fillStyle = '#4488ff';
              for (let i = 0; i < shCount; i++) {
                const sa = (i / shCount) * Math.PI * 2 + g.frame * 0.025;
                ctx.globalAlpha = shPulse * 0.72;
                ctx.fillRect(Math.round(peg.x + Math.cos(sa) * shRingR) - 1, Math.round(peg.y + Math.sin(sa) * shRingR) - 1, 2, 2);
              }
              ctx.globalAlpha = 1;
            }
          } else if (peg.type === 'lightning') {
            // Electric glow ring + bright core
            const ePulse = 0.45 + Math.abs(Math.sin(g.frame * 0.24 + peg.x * 0.04)) * 0.55;
            ctx.fillStyle = '#ffee22';
            for (let i = 0; i < 8; i++) {
              const ea = (i / 8) * Math.PI * 2 + g.frame * 0.07;
              const esr = PEG_R + 4 + Math.sin(g.frame * 0.33 + i) * 2;
              ctx.globalAlpha = ePulse * 0.55;
              ctx.fillRect(Math.round(peg.x + Math.cos(ea) * esr) - 1, Math.round(peg.y + Math.sin(ea) * esr) - 1, 2, 2);
            }
            ctx.globalAlpha = 1;
            drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, '#201800', ePulse * 0.5 + 0.5);
          } else if (peg.type === 'freeze') {
            // Ice-blue snowflake with shimmer
            const fpulse = 0.7 + Math.abs(Math.sin(g.frame * 0.07 + peg.y * 0.03)) * 0.3;
            drawDots(ctx, peg.dots, peg.x, peg.y, g.frame * 0.008, g.frame, '#001830', fpulse);
            ctx.fillStyle = '#88ccff';
            ctx.globalAlpha = fpulse * 0.35;
            ctx.fillRect(Math.round(peg.x) - 1, Math.round(peg.y) - 1, 2, 2);
            ctx.globalAlpha = 1;
          } else if (peg.type === 'hash') {
            drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, '#18103a', 1.0);
          } else if (peg.type === 'mud') {
            if (peg.mudBroken) {
              // broken: faint mud-puddle residue marking where it will reform
              ctx.fillStyle = '#4a2f18';
              for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                ctx.globalAlpha = 0.14;
                ctx.fillRect(Math.round(peg.x + Math.cos(a) * PEG_R * 0.7) - 1, Math.round(peg.y + Math.sin(a) * PEG_R * 0.35 + 3) - 1, 2, 1);
              }
              ctx.globalAlpha = 1;
            } else {
              // solid / reforming: gloopy dark-brown blob (scales up while reviving, slow ooze wobble)
              const s   = (peg.mudAnim && peg.mudAnim > 0) ? 1 - peg.mudAnim / MUD_REVIVE : 1;
              const wob = 1 + Math.sin(g.frame * 0.06 + peg.x * 0.05) * 0.06;
              drawSolidCircle(ctx, peg.x, peg.y, Math.max(1, PEG_R * s * wob), '#4a2f18');
              ctx.fillStyle = '#8a5a2e';
              for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2 + g.frame * 0.01;
                const rr = PEG_R * s * 0.5;
                ctx.globalAlpha = 0.6;
                ctx.fillRect(Math.round(peg.x + Math.cos(a) * rr) - 1, Math.round(peg.y + Math.sin(a) * rr) - 1, 2, 2);
              }
              ctx.fillStyle = '#6a4423';
              ctx.globalAlpha = 0.9;
              ctx.fillRect(Math.round(peg.x) - 2, Math.round(peg.y) - 2, 3, 3);
              ctx.globalAlpha = 1;
              if (peg.mudAnim && peg.mudAnim > 0) {
                const rt = 1 - peg.mudAnim / MUD_REVIVE;
                ctx.fillStyle = '#6a4423';
                for (let i = 0; i < 6; i++) {
                  const a = (i / 6) * Math.PI * 2;
                  const rr = PEG_R * (0.4 + rt * 0.9);
                  ctx.globalAlpha = (1 - rt) * 0.7;
                  ctx.fillRect(Math.round(peg.x + Math.cos(a) * rr) - 1, Math.round(peg.y + Math.sin(a) * rr - rt * 4) - 1, 2, 2);
                }
                ctx.globalAlpha = 1;
                peg.mudAnim--;
              }
            }
          } else {
            const col = peg.type === 'orange' ? '#1a1205'
                      : peg.type === 'blue'   ? '#0c1520'
                      : peg.type === 'purple' ? '#180c1a'
                      :                         '#08082a'; // split
            drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, col, 1.0);
          }
        }
      }

      // ── Fog: cosmic dark mist ─────────────────────────────────────────────
      if (g.fogActive && g.fogAlpha > 0 && g.fogClouds.length > 0) {
        const bufW    = W + 200;
        const fr      = g.frame;
        const fogTop  = Math.round(launcherY + 24);

        // clip fog rendering to below fogTop — prevents any dark pixel from bleeding into the launcher area
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, fogTop, W, H - fogTop);
        ctx.clip();

        // ambient haze — single gradient fogTop→bottom so no visible mid-screen color band
        {
          const hazeGr = ctx.createLinearGradient(0, fogTop + 80, 0, H);
          hazeGr.addColorStop(0, 'rgba(26,20,48,0)');
          hazeGr.addColorStop(1, 'rgba(26,20,48,1)');
          ctx.globalAlpha = g.fogAlpha * 0.22;
          ctx.fillStyle   = hazeGr;
          ctx.fillRect(0, fogTop, W, H - fogTop);
        }

        const staticDefs: [string, number, number, number][] = [
          ['#ffffff', 0.70, 35, 2],  // white flash
          ['#f0ecff', 0.50, 55, 1],  // bright snow
          ['#c0a0ff', 0.28, 65, 2],  // light purple grain
          ['#201440', 0.42, 50, 2],  // dark purple
          ['#050210', 0.55, 30, 1],  // near-black
        ];
        for (const cloud of g.fogClouds) {
          const cx = ((cloud.bx + cloud.spd * fr) % bufW + bufW) % bufW - 100;
          const cy = cloud.by;
          const ca = g.fogAlpha * cloud.alpha;
          if (ca < 0.01) continue;

          // build sprite once (or rebuild if device pixel ratio changed)
          if (!cloud.sprite || cloud.spriteDpr !== dpr) bakeFogCloudSprite(cloud, dpr);
          if (!cloud.sprite) continue;

          // blit pre-baked cloud (fill + noise + rings) — one cheap drawImage per cloud
          ctx.globalAlpha = ca;
          ctx.drawImage(cloud.sprite, cx + cloud.sox!, cy + cloud.soy!, cloud.sw!, cloud.sh!);

          // TV static (live, no clip): sample baked in-cloud positions, fresh random each frame
          const pool = cloud.staticPool!;
          const pl = pool.length;
          if (pl > 0) {
            for (const [col, af, count, sz] of staticDefs) {
              ctx.fillStyle   = col;
              ctx.globalAlpha = ca * af;
              const half = sz >> 1;
              for (let i = 0; i < count; i++) {
                const p = pool[(Math.random() * pl) | 0];
                ctx.fillRect(Math.round(cx + p[0]) - half, Math.round(cy + p[1]) - half, sz, sz);
              }
            }
          }
        }

        ctx.restore(); // release fog clip

        // top boundary: tight 70px cream fade — avoids height-based opacity variation in fog below
        const fadeGr = ctx.createLinearGradient(0, fogTop, 0, fogTop + 70);
        fadeGr.addColorStop(0, '#ede9df');
        fadeGr.addColorStop(1, 'rgba(237,233,223,0)');
        ctx.fillStyle   = fadeGr;
        ctx.globalAlpha = g.fogAlpha;
        ctx.fillRect(0, fogTop, W, 70);
        ctx.globalAlpha = 1;
      }

      // ── Wind indicator ────────────────────────────────────────────────────
      if (g.windForce !== 0) {
        const dir      = g.windForce > 0 ? 1 : -1;
        const isNarrow = g.windRange < g.W;
        const isStorm  = Math.abs(g.windForce) >= WIND_STORM;
        const normF    = Math.min(1, Math.abs(g.windForce) / (isNarrow ? WIND_MAX * WIND_NARROW_MULT : WIND_MAX));
        const chevN    = Math.round(2 + normF * 3);              // 2..5 chevrons by strength
        const sz       = isStorm ? 8 : 5 + Math.round(normF * 3); // bigger when stronger
        const indX     = isNarrow ? g.windCenter : (dir > 0 ? W * 0.30 : W * 0.70);
        const indY     = launcherY - 18;
        ctx.fillStyle  = isStorm ? '#b03010' : isNarrow ? '#a05010' : '#7a5020';
        const pulse    = 0.6 + Math.abs(Math.sin(g.frame * 0.12)) * 0.4;
        for (let k = 0; k < chevN; k++) {
          const cx = indX + dir * k * (sz + 2);
          ctx.globalAlpha = pulse * (0.45 + k / chevN * 0.55);
          // ">" / "<" chevron pointing in the wind direction
          for (let j = 0; j <= sz; j++) {
            const arm = Math.round(j * 0.7);
            ctx.fillRect(Math.round(cx + dir * j) - 1, Math.round(indY - arm) - 1, 2, 2);
            ctx.fillRect(Math.round(cx + dir * j) - 1, Math.round(indY + arm) - 1, 2, 2);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Trajectory preview ───────────────────────────────────────────────
      if (g.phase === 'aiming') {
        const vx = Math.sin(g.aimAngle) * BALL_SPEED;
        const vy = Math.cos(g.aimAngle) * BALL_SPEED;
        const trajN = computeTrajectory(launcherX, launcherY + 8, vx, vy, g.pegs, W, g.windForce, g.warpWalls, g.windRange, g.windCenter, g.windRectY0, g.windRectY1);
        ctx.fillStyle = '#0f0f0d';
        for (let i = 0; i < trajN; i += 3) {
          const fade = (1 - i / trajN) * 0.38;
          ctx.globalAlpha = fade;
          ctx.fillRect(Math.round(_trajBuf[i].x - 1), Math.round(_trajBuf[i].y - 1), 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Launcher ring ────────────────────────────────────────────────────
      ctx.fillStyle = '#0f0f0d';
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
        ctx.globalAlpha = 0.48;
        ctx.fillRect(
          Math.round(launcherX + Math.cos(a) * 8 - 1.5),
          Math.round(launcherY + Math.sin(a) * 8 - 1.5),
          3, 3,
        );
      }
      // Aim arm
      if (g.phase === 'aiming') {
        const ax = launcherX + Math.sin(g.aimAngle) * 20;
        const ay = launcherY + Math.cos(g.aimAngle) * 20;
        ctx.strokeStyle = '#0f0f0d';
        ctx.globalAlpha = 0.50;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(launcherX, launcherY);
        ctx.lineTo(ax, ay);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // ── Burst: launch balls one by one ───────────────────────────────────
      if (g.phase === 'firing' && g.burstRemaining > 0) {
        g.burstTimer--;
        if (g.burstTimer <= 0) {
          const wobble       = (Math.random() - 0.5) * BURST_SPREAD;
          const angle        = g.burstAngle + wobble;
          const ballIdx      = BALLS_PER_SHOT - g.burstRemaining;
          const isBucketBall = ballIdx === g.burstLuckyIdx || Math.random() < g.burstBucketProb;
          g.balls.push({
            x: g.launcherX,
            y: g.launcherY + 8,
            vx: Math.sin(angle) * BALL_SPEED,
            vy: Math.cos(angle) * BALL_SPEED,
            dots: makeBallDots(),
            isBucketBall,
            stuckTimer: 0, stuckBaseY: g.launcherY + 8, freezeTimer: 0, mudTimer: 0, dilated: false, bfSide: 0, bucFlash: 0, reborn: false, goldTimer: 0,
          });
          g.burstRemaining--;
          g.burstTimer = BURST_INTERVAL;
        }
      }

      // ── Ball physics & collision (all active balls) ───────────────────────
      if (g.phase === 'firing') {
        g.burstTime++;
        // Speed ramp: gravity and minimum speed increase over time so slow balls
        // don't stall. Caps at +75% gravity and +4 px/s min after ~8 seconds.
        const gravBoost   = Math.min(GRAVITY * 0.75, g.burstTime * 0.00028);
        const dynMinSpeed = MIN_SPEED + Math.min(4.0, g.burstTime * 0.007);
        const bucketTop = H - 44;
        const alive: Ball[] = [];

        for (const ball of g.balls) {
          // Freeze / mud timer decay
          if (ball.freezeTimer > 0) ball.freezeTimer--;
          if (ball.mudTimer > 0) ball.mudTimer--;
          // Cosmic void membership: checked once so the effMinSpeed suppression below and
          // the gravity/drag effect further down agree on the same "inside" test.
          let inCosmicVoid = false;
          for (const cv of g.cosmicVoids) {
            const cvdx = (ball.x - cv.x) / cv.rx, cvdy = (ball.y - cv.y) / cv.ry;
            if (cvdx * cvdx + cvdy * cvdy < 1) { inCosmicVoid = true; break; }
          }
          // Dark Star core membership: checked once, same pattern as cosmic void above, so the
          // effMinSpeed suppression and the drag effect further down agree on the same test.
          let inDarkStarCore = false;
          for (const ds of g.darkStars) {
            const dsdx = ball.x - ds.x, dsdy = ball.y - ds.y;
            if (dsdx * dsdx + dsdy * dsdy < DS_R_CORE * DS_R_CORE) { inDarkStarCore = true; break; }
          }
          // The Nothing: detect early so stuck-rescue is frozen (straight paths must not be
          // "rescued" into a curve) and continuous forces are skipped further down.
          let inNothing = false;
          for (const tn of g.theNothings) {
            const tdx = ball.x - tn.x, tdy = ball.y - tn.y;
            if (tdx * tdx + tdy * tdy < NOTHING_RANGE * NOTHING_RANGE) { inNothing = true; break; }
          }
          // Time dilation: detect the enter/exit transition once, so the impulsive speed
          // change (halve on enter, double on exit) fires exactly once per crossing rather
          // than every frame while inside.
          let nowInDilation = false;
          for (const td of g.timeDilations) {
            const tddx = ball.x - td.x, tddy = ball.y - td.y;
            if (tddx * tddx + tddy * tddy < TD_RADIUS * TD_RADIUS) { nowInDilation = true; break; }
          }
          if (nowInDilation && !ball.dilated) {
            ball.vx *= TD_SLOW; ball.vy *= TD_SLOW;
            ball.dilated = true;
          } else if (!nowInDilation && ball.dilated) {
            ball.vx /= TD_SLOW; ball.vy /= TD_SLOW;
            const dspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (dspd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / dspd; ball.vx *= sc; ball.vy *= sc; }
            ball.dilated = false;
          }
          // While frozen, stuck in mud, drifting in a cosmic void, time-dilated, or inside a
          // Dark Star's core, suppress dynMinSpeed so the slow isn't overridden
          const effMinSpeed = ball.mudTimer > 0   ? Math.min(dynMinSpeed, BALL_SPEED * MUD_SLOW * 1.2)
                            : ball.freezeTimer > 0 ? Math.min(dynMinSpeed, BALL_SPEED * FREEZE_SLOW * 0.95)
                            : inCosmicVoid         ? Math.min(dynMinSpeed, BALL_SPEED * 0.35)
                            : ball.dilated         ? Math.min(dynMinSpeed, BALL_SPEED * 0.30)
                            : inDarkStarCore       ? Math.min(dynMinSpeed, BALL_SPEED * 0.35)
                            :                        dynMinSpeed;

          // Stuck detection: freeze entirely inside The Nothing (straight paths must not be
          // "rescued" into a curve). Outside, reset when the ball advances downward enough.
          if (inNothing) {
            ball.stuckTimer = 0;
            ball.stuckBaseY = ball.y;
          } else {
            ball.stuckTimer++;
            if (ball.y > ball.stuckBaseY + STUCK_PROGRESS) {
              ball.stuckTimer = 0;
              ball.stuckBaseY = ball.y;
            }
            // Rescue: force downward with random horizontal jitter after prolonged stall
            if (ball.stuckTimer >= STUCK_FRAMES) {
              ball.vy = Math.abs(ball.vy) * 0.7 + 3.0;
              ball.vx += (Math.random() - 0.5) * 5;
              ball.stuckTimer = 0;
              ball.stuckBaseY = ball.y;
              if (ball.freezeTimer > 0) ball.freezeTimer = 0; // rescue clears freeze
              if (ball.mudTimer > 0)    ball.mudTimer = 0;    // rescue clears mud slow
            }
          }

          // Gravity + black hole radial pull
          const effGrav = GRAVITY + gravBoost;
          // The Nothing: total force absence — skip gravity and every hazard force below.
          // Straight-line uniform motion only; peg/wall collisions still apply later.
          // (inNothing was computed earlier, above stuck detection.)
          if (inNothing) {
            // Skip all continuous forces; fall through to substep movement/collisions.
          } else {
          // Bubble Universe: inside the scar, gravity is tilted ±18° and scaled to 0.85x.
          // Gravity still exists (just pointed differently), so the ball always sinks out.
          let inBubbleU = false;
          for (const bu of g.bubbleUniverses) {
            const bdx = ball.x - bu.x, bdy = ball.y - bu.y;
            const inside = bdx * bdx + bdy * bdy < BUC_RANGE * BUC_RANGE;
            if (inside && !bu.insideBalls.has(ball)) {
              bu.insideBalls.add(ball);
              bu.edgeFlash = BUC_EDGE_FLASH;
              bu.edgeAng = Math.atan2(bdy, bdx);
              ball.bucFlash = BUC_BALL_FLASH;
            } else if (!inside && bu.insideBalls.has(ball)) {
              bu.insideBalls.delete(ball);
              bu.edgeFlash = BUC_EDGE_FLASH;
              bu.edgeAng = Math.atan2(bdy, bdx);
              ball.bucFlash = BUC_BALL_FLASH;
            }
            if (inside) {
              const gMag = effGrav * BUC_GRAV_SCALE;
              ball.vx += Math.sin(bu.tilt) * gMag;
              ball.vy += Math.cos(bu.tilt) * gMag;
              inBubbleU = true;
            }
          }
          if (!inBubbleU) ball.vy += effGrav;
          if (ball.bucFlash > 0) ball.bucFlash--;
          let absorbed = false;
          for (const zone of g.gravZones) {
            const bhCx  = zone.x + zone.w / 2;
            const bhCy  = zone.y + zone.h / 2;
            const bhRange = zone.h * BH_PULL_RANGE_FACTOR;
            const bhEhR   = zone.h * 0.27;
            const dx = bhCx - ball.x, dy = bhCy - ball.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 >= bhRange * bhRange || dist2 === 0) continue;
            const dist = Math.sqrt(dist2);
            if (dist < bhEhR) {
              spawnBHAbsorb(g, ball.x, ball.y);
              zone.flashTimer = 36;
              absorbed = true; break;
            }
            const t = 1 - dist / bhRange;
            const strength = BH_PULL_FORCE * t * t;
            ball.vx += (dx / dist) * strength;
            ball.vy += (dy / dist) * strength;
          }

          // Rogue black hole: same pull-and-absorb shape as the main BH above, but centered
          // on a point that drifts along a slow, deterministic Lissajous path. The well
          // itself keeps moving, so a stable orbit can never form around it.
          for (const rbh of g.rogueBHs) {
            const rcx = rbh.cx0 + Math.sin(g.frame * RBH_LISS_FX) * RBH_LISS_AX;
            const rcy = rbh.cy0 + Math.sin(g.frame * RBH_LISS_FY) * RBH_LISS_AY;
            const rdx = rcx - ball.x, rdy = rcy - ball.y;
            const rdist2 = rdx * rdx + rdy * rdy;
            if (rdist2 >= RBH_RANGE * RBH_RANGE || rdist2 === 0) continue;
            const rdist = Math.sqrt(rdist2);
            if (rdist < RBH_ABSORB_R) {
              spawnBHAbsorb(g, ball.x, ball.y);
              rbh.flashTimer = 36;
              absorbed = true; break;
            }
            const rt = 1 - rdist / RBH_RANGE;
            const rstrength = RBH_FORCE * rt * rt;
            ball.vx += (rdx / rdist) * rstrength;
            ball.vy += (rdy / rdist) * rstrength;
          }
          if (absorbed) {
            if (g.cosmicDarkAgesActive) g.cdaGhosts.push({ x: ball.x, y: ball.y, timer: CDA_GHOST_DUR, vx: ball.vx, vy: ball.vy });
            ball.y = H + 100; continue;
          }

          // Great Attractor: a pull toward a fixed point OFF-SCREEN (never absorbs, never even
          // drawn). Range = board width, but since the source sits GA_OFFSCREEN_X beyond the
          // wall, the far ~1/3 of the board feels nothing at all — matches spec's literal R=W.
          // No-trap guarantee is gravity (0.20/frame), not the breathing coefficient: even at
          // the near wall the vertical pull component peaks well under gravity, so a ball only
          // ever slides down the wall and exits rather than pinning. Breathing just keeps the
          // pull from feeling constant, not from feeling unbeatable.
          if (g.greatAttractor) {
            const gaDx = g.greatAttractor.x - ball.x, gaDy = g.greatAttractor.y - ball.y;
            const gaDist2 = gaDx * gaDx + gaDy * gaDy;
            const gaRange = g.W;
            if (gaDist2 < gaRange * gaRange && gaDist2 > 0) {
              const gaDist = Math.sqrt(gaDist2);
              const gaT = 1 - gaDist / gaRange;
              const gaBreathe = 0.5 + 0.5 * Math.sin(g.frame * GA_BREATHE_FREQ);
              const gaStrength = GA_FORCE * gaT * gaT * gaBreathe;
              ball.vx += (gaDx / gaDist) * gaStrength;
              ball.vy += (gaDy / gaDist) * gaStrength;
            }
          }

          // Bullet Cluster dark-matter blob: an invisible point pull leading BC_DM_LAG px
          // ahead of the visible gas blob (in the direction of travel) — same radial pull
          // shape as a black hole, but never absorbs and never collides. A ball crossing the
          // pair's path bends here first; the visible gas blob's bounce (substep collision
          // section below) arrives moments later since it trails behind.
          for (const bc of g.bulletClusters) {
            if (bc.respawnTimer > 0) continue;
            const bcDir = Math.sign(bc.vx) || 1;
            const dmX = bc.x + bcDir * BC_DM_LAG;
            const bmdx = dmX - ball.x, bmdy = bc.warnY - ball.y;
            const bmdist2 = bmdx * bmdx + bmdy * bmdy;
            if (bmdist2 >= BC_DM_RANGE * BC_DM_RANGE || bmdist2 === 0) continue;
            const bmdist = Math.sqrt(bmdist2);
            const bmt = 1 - bmdist / BC_DM_RANGE;
            const bmstrength = BC_DM_FORCE * bmt * bmt;
            ball.vx += (bmdx / bmdist) * bmstrength;
            ball.vy += (bmdy / bmdist) * bmstrength;
          }

          // Odd Radio Circle: an ultra-slow ghost ring — the ring itself barely moves within
          // a single frame, so it behaves like a slowly-widening wall. Outward push only, so
          // it can never trap a ball; the force is only felt during the 'grow' phase (a
          // fading/recondensing ring isn't physically "there" any more than it's visible).
          for (const orc of g.oddRadioCircles) {
            if (orc.phase !== 'grow') continue;
            const odx = ball.x - orc.x, ody = ball.y - orc.y;
            const odist2 = odx * odx + ody * ody;
            if (odist2 === 0) continue;
            const odist = Math.sqrt(odist2);
            const obandDist = Math.abs(odist - orc.radius);
            if (obandDist >= ORC_BAND_HALF) continue;
            const ot = 1 - obandDist / ORC_BAND_HALF;
            const of = ORC_FORCE * ot * ot;
            ball.vx += (odx / odist) * of;
            ball.vy += (ody / odist) * of;
            // light up the ±15° arc where the ball crossed ("only visible where it's felt")
            const oangle = Math.atan2(ody, odx);
            const binWidth = (Math.PI * 2) / ORC_LIT_BINS;
            const obin = (Math.round(oangle / binWidth) % ORC_LIT_BINS + ORC_LIT_BINS) % ORC_LIT_BINS;
            orc.litBins[obin] = ORC_LIT_DUR;
          }

          // Baryon Acoustic Oscillation: three static concentric rings, each gently breathing
          // out of phase. Force is purely radial (toward whichever side of the band the ball
          // is on) — never tangential — so a ball can always roll freely along the ring and
          // is never trapped; only a light course-correction toward the ring line itself.
          for (const bao of g.baryonOscillations) {
            const badx = ball.x - bao.x, bady = ball.y - bao.y;
            const badist2 = badx * badx + bady * bady;
            if (badist2 === 0) continue;
            const badist = Math.sqrt(badist2);
            for (let ri = 0; ri < BAO_RADII.length; ri++) {
              const baPhase = ri * (Math.PI * 2 / 3);
              const baEffR = BAO_RADII[ri] + BAO_BREATHE_AMP * Math.sin(g.frame * BAO_BREATHE_FREQ + baPhase);
              const baBandDist = Math.abs(badist - baEffR);
              if (baBandDist >= BAO_BAND_HALF) continue;
              const bat = 1 - baBandDist / BAO_BAND_HALF;
              const baf = BAO_FORCE * bat * bat * (badist > baEffR ? -1 : 1);
              ball.vx += (badx / badist) * baf;
              ball.vy += (bady / badist) * baf;
              // light up the arc segment where the ball crossed this ring
              const baAngle = Math.atan2(bady, badx);
              const baBinWidth = (Math.PI * 2) / BAO_LIT_BINS;
              const baBin = (Math.round(baAngle / baBinWidth) % BAO_LIT_BINS + BAO_LIT_BINS) % BAO_LIT_BINS;
              bao.litBins[ri][baBin] = BAO_LIT_DUR;
            }
          }

          // Tidal disruption event: an in-winding vortex (tangent + inward pull, like a
          // lens and black hole added together) whose own endpoint is a forced upward jet.
          // The jet check runs first and, once triggered, completely overrides the vortex
          // terms for this hazard — the vortex can only ever deliver a ball to the jet.
          for (const tde of g.tidalDisruptions) {
            const tddx = ball.x - tde.x, tddy = ball.y - tde.y;
            const tddist2 = tddx * tddx + tddy * tddy;
            if (tddist2 >= TDE_RANGE * TDE_RANGE || tddist2 === 0) continue;
            const tddist = Math.sqrt(tddist2);
            if (tddist < TDE_JET_R) {
              ball.vy -= TDE_JET_VY;
              ball.vx *= TDE_JET_VX_DAMP;
              if (g.frame % 3 === 0) spawnBurst(g, ball.x, ball.y, ball.vx * 0.2, ball.vy * 0.2, '#8fd3f4');
              continue;
            }
            const tdt   = 1 - tddist / TDE_RANGE;
            const tdTan = TDE_TAN_FORCE * tdt * tdt;
            const tdIn  = TDE_INWARD_FORCE * tdt * tdt;
            ball.vx += (-tddy / tddist) * tdTan * tde.dir;
            ball.vy += ( tddx / tddist) * tdTan * tde.dir;
            ball.vx += (-tddx / tddist) * tdIn;
            ball.vy += (-tddy / tddist) * tdIn;
          }

          // Gravitational lens: tangential (swirl) force that bends the path around it.
          for (const lens of g.lenses) {
            const ldx = ball.x - lens.x, ldy = ball.y - lens.y;
            const ldist2 = ldx * ldx + ldy * ldy;
            const lrange = lens.r * 2.4;
            if (ldist2 >= lrange * lrange || ldist2 === 0) continue;
            const ldist = Math.sqrt(ldist2);
            const lt = 1 - ldist / lrange;
            const lf = lens.strength * lt * lt;
            // tangent = perpendicular to the radial direction, signed by swirl dir
            ball.vx += (-ldy / ldist) * lf * lens.dir;
            ball.vy += ( ldx / ldist) * lf * lens.dir;
            // slight inward component so paths curve around rather than fling off
            ball.vx += (-ldx / ldist) * lf * 0.25;
            ball.vy += (-ldy / ldist) * lf * 0.25;
          }

          // Galactic tidal stream: a one-way tangential current confined to a band around a
          // fixed arc. No radial pull (unlike the lens above) — a ball just rides the current
          // and is released once it drifts off the band or past the arc's angular span.
          for (const gts of g.galacticTidalStreams) {
            const gdx = ball.x - gts.cx, gdy = ball.y - gts.cy;
            const gdist2 = gdx * gdx + gdy * gdy;
            if (gdist2 === 0) continue;
            const gdist = Math.sqrt(gdist2);
            const gbandDist = Math.abs(gdist - gts.radius);
            if (gbandDist >= GTS_BAND_HALF) continue;
            let gtheta = Math.atan2(gdy, gdx) - gts.angleStart;
            gtheta = ((gtheta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            if (gtheta > GTS_ARC_SPAN) continue;
            const gt = 1 - gbandDist / GTS_BAND_HALF;
            const gf = gts.flow * gt * gt;
            ball.vx += (-gdy / gdist) * gf * gts.dir;
            ball.vy += ( gdx / gdist) * gf * gts.dir;
            // sparse pale-gold trailing glow while riding the current (throttled — this runs
            // once per frame for every ball in the band, so a full-rate burst would be spammy)
            if (g.frame % 4 === 0) spawnBurst(g, ball.x, ball.y, ball.vx * 0.1, ball.vy * 0.1, '#e0d0a0');
          }

          // Laniakea Basin: purely tangential current along one of three precomputed curved
          // streamlines, always flowing toward the shared sink point. The sink itself has no
          // pull — reaching it is just a normal wall-bounce, never an absorption or trap.
          for (const lb of g.laniakeaBasins) {
            for (const stream of lb.streams) {
              const { dist: lbDist, tx: lbTx, ty: lbTy } = closestOnPolyline(ball.x, ball.y, stream.pts);
              if (lbDist >= LB_HALF_WIDTH) continue;
              const lbt = 1 - lbDist / LB_HALF_WIDTH;
              const lbf = LB_FORCE * lbt * lbt;
              ball.vx += lbTx * lbf;
              ball.vy += lbTy * lbf;
              if (g.frame % 4 === 0) spawnBurst(g, ball.x, ball.y, ball.vx * 0.1, ball.vy * 0.1, '#8a9ab8');
            }
          }

          // Wind (zone-aware, Y-bounded for narrow wind to match visual rect)
          if (g.windForce !== 0 && Math.abs(ball.x - g.windCenter) <= g.windRange / 2) {
            const inWindY = g.windRange >= g.W || (ball.y >= g.windRectY0 && ball.y <= g.windRectY1);
            if (inWindY) {
              ball.vx += g.windForce;
              ball.vx = Math.max(-BALL_SPEED * 2, Math.min(BALL_SPEED * 2, ball.vx));
            }
          }

          // Dark Flow: a board-wide, nearly imperceptible drift applied to every ball
          // regardless of position. Direction slowly rotates (period ~15,700 frames), so it
          // never pushes in one direction indefinitely; magnitude is ~1/15 of gravity —
          // small enough that the game's existing speed clamps already bound it, no
          // dedicated clamp needed here.
          if (g.darkFlow) {
            const dfAngle = g.darkFlow.theta0 + g.frame * DF_ANGULAR_SPEED;
            ball.vx += Math.cos(dfAngle) * g.darkFlow.accel;
            ball.vy += Math.sin(dfAngle) * g.darkFlow.accel;
          }

          // CMB Anisotropy: board-wide temperature map. Hot spots lift (negative vy), cold
          // spots sink. Amplitude is 1/10 of gravity by design — drifts the ball but can
          // never stall it (the map is fixed, so there is no equilibrium point).
          if (g.cmbAnisotropy) {
            const cmb = g.cmbAnisotropy;
            const cmbT = Math.sin(ball.x * 0.030 + cmb.phi1) * Math.cos(ball.y * 0.024 + cmb.phi2)
                       + 0.5 * Math.sin(ball.x * 0.011 - ball.y * 0.017 + cmb.phi3);
            ball.vy -= CMB_FORCE * cmbT;
          }

          // Big Rip Precursor: during the expansion window, shove every ball outward from
          // the board center with f = H_rip * dist (farther = stronger). Pure repulsion —
          // the center is nearly inert, so no trap is possible.
          if (g.bigRip && g.bigRip.active) {
            const cx = W / 2, cy = H / 2;
            const rdx = ball.x - cx, rdy = ball.y - cy;
            const rd = Math.sqrt(rdx * rdx + rdy * rdy);
            if (rd > 0.5) {
              const rf = g.bigRip.h * rd;
              ball.vx += (rdx / rd) * rf;
              ball.vy += (rdy / rd) * rf;
              const rSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
              if (rSpd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / rSpd; ball.vx *= sc; ball.vy *= sc; }
            }
          }

          // CME shockwave: while a sweep band passes over the ball, shove it down + outward.
          if (g.cmeY >= 0 && ball.y >= g.cmeY - 52 && ball.y <= g.cmeY) {
            const cmePush = 0.8 + Math.min(1.4, (g.level - 20) * 0.03);
            ball.vy += cmePush;
            ball.vx += (ball.x < W / 2 ? -1 : 1) * 0.5;
          }

          // Pulsar: balls caught in either radiation beam get pushed outward along it.
          for (const pu of g.pulsars) {
            const pdx = ball.x - pu.x, pdy = ball.y - pu.y;
            const pd2 = pdx * pdx + pdy * pdy;
            if (pd2 >= pu.beamLen * pu.beamLen || pd2 === 0) continue;
            const pux = Math.cos(pu.angle), puy = Math.sin(pu.angle);
            const along = pdx * pux + pdy * puy;           // signed distance along the beam axis
            const perp  = Math.abs(pdx * puy - pdy * pux); // distance from the beam line
            if (perp > PULSAR_BEAM_HALF) continue;
            const pf  = PULSAR_FORCE * (1 - Math.abs(along) / pu.beamLen);
            const sgn = along >= 0 ? 1 : -1;               // twin beams share one axis
            ball.vx += pux * sgn * pf;
            ball.vy += puy * sgn * pf;
          }

          // Gravitational wave: while the wavefront band passes over the ball, rotate
          // its velocity — a speed-preserving bend (spacetime jiggles the path), so it
          // can never stall a ball or create a softlock.
          for (const gw of g.gravWaves) {
            if (gw.radius < 0) continue;
            const gdx = ball.x - gw.ex, gdy = ball.y - gw.ey;
            const gd  = Math.sqrt(gdx * gdx + gdy * gdy);
            if (Math.abs(gd - gw.radius) > GW_BAND) continue;
            const gca = Math.cos(GW_BEND * gw.dir), gsa = Math.sin(GW_BEND * gw.dir);
            const nvx = ball.vx * gca - ball.vy * gsa;
            ball.vy   = ball.vx * gsa + ball.vy * gca;
            ball.vx   = nvx;
          }

          // Gravitational wave background: the polar opposite of the wavefront ripple above —
          // no band, no position check, applies to every ball every frame. A constant tiny
          // speed-preserving rotation (never an acceleration), so it can never stall a ball;
          // it only ever makes long shots harder to predict, never impossible.
          if (g.gwBackgroundActive) {
            const gwbIdx  = g.balls.indexOf(ball);
            const gwbAmp  = GWB_BASE_AMP + Math.max(0, g.level - 64) * GWB_AMP_PER_LV;
            const gwbTh   = gwbAmp * Math.sin(g.frame * 0.07 + gwbIdx * 2.1);
            const gwbCos  = Math.cos(gwbTh), gwbSin = Math.sin(gwbTh);
            const gwbNvx  = ball.vx * gwbCos - ball.vy * gwbSin;
            ball.vy       = ball.vx * gwbSin + ball.vy * gwbCos;
            ball.vx       = gwbNvx;
          }

          // Quantum Foam: inside the region, rotate velocity by a tiny deterministic noise
          // each frame (speed-preserving). Average rotation is zero so the ball statistically
          // keeps going — it just jitters like spacetime at the Planck scale.
          for (const qf of g.quantumFoams) {
            const qdx = ball.x - qf.x, qdy = ball.y - qf.y;
            if (qdx * qdx + qdy * qdy >= QF_RANGE * QF_RANGE) continue;
            const qfIdx = g.balls.indexOf(ball);
            const qfTh  = QF_ROT_AMP * Math.sin(g.frame * 0.31 + qfIdx * 1.7);
            const qfC = Math.cos(qfTh), qfS = Math.sin(qfTh);
            const qfNvx = ball.vx * qfC - ball.vy * qfS;
            ball.vy     = ball.vx * qfS + ball.vy * qfC;
            ball.vx     = qfNvx;
          }

          // Cosmic Birefringence: a pass-through sheet with no force while inside — only the
          // moment of exiting the far side fires a one-time, direction-dependent, speed-
          // preserving rotation. bfSide resets to 0 (untracked) once the ball leaves the OBB
          // entirely, so a fresh pass-through is required to fire again; the very first touch
          // of a side only records it (no fire) to avoid a false trigger on entry.
          for (const cb of g.cosmicBirefringences) {
            const cbCos = Math.cos(cb.angle), cbSin = Math.sin(cb.angle);
            const cbdx = ball.x - cb.x, cbdy = ball.y - cb.y;
            const cblx =  cbCos * cbdx + cbSin * cbdy;
            const cbly = -cbSin * cbdx + cbCos * cbdy;
            if (Math.abs(cblx) > CB_LEN * 0.5 || Math.abs(cbly) > CB_THICK * 0.5) {
              ball.bfSide = 0;
              continue;
            }
            const cbSide = cbly >= 0 ? 1 : -1;
            if (ball.bfSide === 0) {
              ball.bfSide = cbSide;
            } else if (cbSide !== ball.bfSide) {
              const cbRot = ball.bfSide === 1 ? CB_ROT : -CB_ROT; // front(1)->back: +0.22; back->front(1): -0.22
              const cbRc = Math.cos(cbRot), cbRs = Math.sin(cbRot);
              const cbNvx = ball.vx * cbRc - ball.vy * cbRs;
              ball.vy = ball.vx * cbRs + ball.vy * cbRc;
              ball.vx = cbNvx;
              cb.hitFlash = CB_FADE_DUR; cb.hitX = ball.x; cb.hitY = ball.y; cb.hitAngle = cbRot;
              ball.bfSide = cbSide;
            }
          }

          // Little Red Dot pull: a weak radial attraction, only felt while the dot is lit
          // (the blink cycle itself, not this force, is what guarantees release).
          for (const lrd of g.littleRedDots) {
            const lrdCyclePos = (g.frame + lrd.phase) % (LRD_ON_FRAMES + LRD_OFF_FRAMES);
            if (lrdCyclePos >= LRD_ON_FRAMES) continue;
            const ldx = lrd.x - ball.x, ldy = lrd.y - ball.y;
            const ldist2 = ldx * ldx + ldy * ldy;
            if (ldist2 >= LRD_PULL_RANGE * LRD_PULL_RANGE || ldist2 === 0) continue;
            const ldist = Math.sqrt(ldist2);
            const lt = 1 - ldist / LRD_PULL_RANGE;
            const lf = LRD_PULL_FORCE * lt * lt;
            ball.vx += (ldx / ldist) * lf;
            ball.vy += (ldy / ldist) * lf;
          }

          // Primordial black holes: several small always-on pull points. Individually weak
          // and never absorbing, so a ball caught between two or more is only ever tugged, not
          // held — the multi-point tug-of-war always eventually lets it slip through a gap.
          for (const pbh of g.primordialBHs) {
            const pdx = pbh.x - ball.x, pdy = pbh.y - ball.y;
            const pd2 = pdx * pdx + pdy * pdy;
            if (pd2 >= PBH_RANGE * PBH_RANGE || pd2 === 0) continue;
            const pd = Math.sqrt(pd2);
            const pt = 1 - pd / PBH_RANGE;
            const pf = PBH_FORCE * pt * pt;
            ball.vx += (pdx / pd) * pf;
            ball.vy += (pdy / pd) * pf;
            if (g.frame % 4 === 0) spawnBurst(g, ball.x, ball.y, 0, 0, '#6a6ad0');
          }

          // Dark Star shell: outward radiation pressure in the band between the core and the
          // visual surface. Combined with gravity and the core drag above, a ball that sinks
          // toward the center is always eventually pushed back out through this shell.
          for (const ds of g.darkStars) {
            const sdx = ball.x - ds.x, sdy = ball.y - ds.y;
            const sdist2 = sdx * sdx + sdy * sdy;
            if (sdist2 === 0) continue;
            const sdist = Math.sqrt(sdist2);
            if (sdist < DS_R_CORE || sdist > DS_R_SHELL) continue;
            const sBandHalf = (DS_R_SHELL - DS_R_CORE) / 2;
            const sBandCenter = (DS_R_CORE + DS_R_SHELL) / 2;
            const st = 1 - Math.abs(sdist - sBandCenter) / sBandHalf;
            const sf = DS_SHELL_FORCE * st * st;
            ball.vx += (sdx / sdist) * sf;
            ball.vy += (sdy / sdist) * sf;
          }

          // Vacuum decay bubble: inside the membrane gravity flips to a net 0.5x upward
          // buoyancy. Sideways momentum still carries balls out, and the bubble's pop
          // cycle (rMax → burst → respawn) guarantees any loiterer is released.
          for (const vb of g.vacuums) {
            if (vb.respawnTimer > 0) continue;
            const vdx = ball.x - vb.x, vdy = ball.y - vb.y;
            if (vdx * vdx + vdy * vdy < vb.r * vb.r) {
              ball.vy -= effGrav * VAC_ANTIGRAV;
            }
          }

          // Cosmic void / time dilation: both halve gravity while the ball is inside. Apply
          // the halving at most once even if both zones overlap (inCosmicVoid && ball.dilated),
          // so gravity is never fully cancelled out — it just takes a little longer to sink out.
          if (inCosmicVoid || ball.dilated) {
            ball.vy -= effGrav * 0.5;
          }
          if (inCosmicVoid) {
            ball.vx *= VOID_DRAG;
            ball.vy *= VOID_DRAG;
          }

          // Dark Star core: drag only — gravity stays fully active (unlike cosmic void/time
          // dilation above), so a ball that sinks in always keeps falling and is pushed back
          // out by the shell force below; it can never simply hang motionless inside.
          if (inDarkStarCore) {
            ball.vx *= DS_DRAG;
            ball.vy *= DS_DRAG;
          }

          // White hole: radial repulsion (the black hole's mirror). No absorption, so the
          // ball is only ever pushed away — it can never be trapped.
          for (const wh of g.whiteHoles) {
            const wdx = ball.x - wh.x, wdy = ball.y - wh.y;
            const wd2 = wdx * wdx + wdy * wdy;
            if (wd2 >= WH_RANGE * WH_RANGE || wd2 === 0) continue;
            const wd = Math.sqrt(wd2);
            const wt = 1 - wd / WH_RANGE;
            const wf = wh.strength * wt * wt;
            ball.vx += (wdx / wd) * wf;
            ball.vy += (wdy / wd) * wf;
          }

          // Dark energy patch: repulsion that grows *with* distance — the exact inverse of
          // the white hole's near=strong/far=weak decay. Near the core the push is
          // negligible; it peaks at the range boundary, so the ball is only ever carried
          // outward and released — it can never be trapped. Unlike every other radial force
          // here, it does NOT taper to zero at the range edge (growing toward the boundary
          // and tapering to zero there are mutually exclusive) — the cutoff at DE_RANGE is
          // an intentional hard edge, not an oversight.
          for (const de of g.darkEnergyPatches) {
            const edx = ball.x - de.x, edy = ball.y - de.y;
            const ed2 = edx * edx + edy * edy;
            if (ed2 >= DE_RANGE * DE_RANGE || ed2 === 0) continue;
            const ed = Math.sqrt(ed2);
            const ef = de.h * ed;
            ball.vx += (edx / ed) * ef;
            ball.vy += (edy / ed) * ef;
          }

          // Naked singularity: direction flips chaotically with angle+time (deterministic —
          // reproducible with the same frame/angle, but reads as lawless), cubic core falloff,
          // plus a constant outward bias so the ball is always eventually ejected (no
          // absorption, so it can never be trapped despite the erratic push).
          for (const ns of g.nakedSingularities) {
            const sdx = ball.x - ns.x, sdy = ball.y - ns.y;
            const sd2 = sdx * sdx + sdy * sdy;
            if (sd2 >= NS_RANGE * NS_RANGE || sd2 === 0) continue;
            const sd = Math.sqrt(sd2);
            const snx = sdx / sd, sny = sdy / sd;
            const st = 1 - sd / NS_RANGE;
            const sf = NS_FORCE * st * st * st; // cubic — fiercest near the core
            const theta = Math.atan2(sdy, sdx);
            const sign = Math.sin(3 * theta + g.frame * 0.02) >= 0 ? 1 : -1;
            ball.vx += -sny * sf * sign + snx * sf * NS_RADIAL_BIAS;
            ball.vy +=  snx * sf * sign + sny * sf * NS_RADIAL_BIAS;
            if (g.frame % 5 === 0) spawnBurst(g, ball.x, ball.y, 0, 0, '#c01030');
          }

          // Hypervelocity star gravitational wake: drags any ball caught in the trailing
          // band toward the star's current direction of travel. No solid body — the star
          // never bounces off a ball — and the wake always exits the screen with the star
          // (its horizontal direction never reverses), so it can never linger indefinitely.
          for (const hv of g.hyperStars) {
            if (hv.respawnTimer > 0) continue;
            const hspd = Math.sqrt(hv.vx * hv.vx + hv.vy * hv.vy);
            if (hspd === 0) continue;
            const hdx = hv.vx / hspd, hdy = hv.vy / hspd; // unit vector along travel direction
            const hrx = ball.x - hv.x, hry = ball.y - hv.y;
            const halong = -(hrx * hdx + hry * hdy); // distance behind the star (0 = at the star)
            if (halong < 0 || halong > HVS_WAKE_LEN) continue;
            const hperp = hrx * -hdy + hry * hdx; // perpendicular offset from the wake axis
            if (Math.abs(hperp) > HVS_WAKE_HALF + BALL_R) continue;
            const ht = 1 - halong / HVS_WAKE_LEN;
            const hf = HVS_WAKE_FORCE * ht * ht;
            ball.vx += hdx * hf;
            ball.vy += hdy * hf;
            if (g.frame % 4 === 0) spawnBurst(g, ball.x, ball.y, 0, 0, '#ff6a5a');
          }

          // Magnetar: during the brief flare (releaseTimer > 0, advanced in the draw block),
          // shove every ball in range outward. Impulsive repulsion only, so no trap.
          for (const mg of g.magnetars) {
            if (mg.releaseTimer <= 0) continue;
            const gdx = ball.x - mg.x, gdy = ball.y - mg.y;
            const gd2 = gdx * gdx + gdy * gdy;
            if (gd2 >= MAG_RANGE * MAG_RANGE || gd2 === 0) continue;
            const gd = Math.sqrt(gd2);
            const gt = 1 - gd / MAG_RANGE;
            const gf = MAG_FORCE * gt * gt;
            ball.vx += (gdx / gd) * gf;
            ball.vy += (gdy / gd) * gf;
          }

          // Hawking Point: same impulsive-outward pattern as the magnetar, but quieter and
          // rarer (10f pulse every ~300f). Completely inert between pulses.
          for (const hp of g.hawkingPoints) {
            if (hp.releaseTimer <= 0) continue;
            const hdx = ball.x - hp.x, hdy = ball.y - hp.y;
            const hd2 = hdx * hdx + hdy * hdy;
            if (hd2 >= HP_RANGE * HP_RANGE || hd2 === 0) continue;
            const hd = Math.sqrt(hd2);
            const ht = 1 - hd / HP_RANGE;
            const hf = HP_FORCE * ht * ht;
            ball.vx += (hdx / hd) * hf;
            ball.vy += (hdy / hd) * hf;
            // Warm 1px sparks on the first frame of the pulse only (spec: 2 sparks on push).
            if (hp.releaseTimer === HP_RELEASE) spawnBurst(g, ball.x, ball.y, 0, 0, '#e8d8c0');
          }

          // Rogue planet: drifting attraction well (pull toward the planet). No absorption,
          // and the well itself moves every frame, so a stable capture orbit can't form.
          for (const rp of g.roguePlanets) {
            const rdx = rp.x - ball.x, rdy = rp.y - ball.y;
            const rd2 = rdx * rdx + rdy * rdy;
            if (rd2 >= RP_RANGE * RP_RANGE || rd2 === 0) continue;
            const rd = Math.sqrt(rd2);
            const rt = 1 - rd / RP_RANGE;
            const rf = RP_PULL * rt * rt;
            ball.vx += (rdx / rd) * rf;
            ball.vy += (rdy / rd) * rf;
          }

          // Quasar jet: inside the plasma column, accelerate the ball along the jet axis
          // (strongest at the nozzle) plus a small sideways spray. The spray guarantees the
          // ball drifts out the side, so even an up-jet can never hold it (no trap).
          for (const qj of g.quasarJets) {
            if (Math.abs(ball.x - qj.bx) > QJ_HALF) continue;
            if (ball.y < qj.y0 || ball.y > qj.y1) continue;
            const len        = qj.y1 - qj.y0;
            const fromNozzle = qj.dir === 1 ? (ball.y - qj.y0) : (qj.y1 - ball.y);
            const qt         = 1 - fromNozzle / len;                     // 1 at nozzle → 0 at tip
            ball.vy += qj.dir * qj.accel * (0.35 + 0.65 * Math.max(0, qt));
            ball.vx += (ball.x >= qj.bx ? 1 : -1) * QJ_FAN;
            const qspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (qspd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / qspd; ball.vx *= sc; ball.vy *= sc; }
          }

          // Evaporating micro black hole: pull toward it while alive (range shrinks as it
          // evaporates); during the evaporation burst it repels instead. No absorption, and
          // it periodically vanishes/re-forms, so it can never permanently hold a ball.
          for (const mb of g.microBHs) {
            if (mb.dormant > 0) continue;
            const mdx = mb.x - ball.x, mdy = mb.y - ball.y; // toward the BH
            const md2 = mdx * mdx + mdy * mdy;
            if (mb.evap > 0) {
              if (md2 >= MBH_EVAP_RANGE * MBH_EVAP_RANGE || md2 === 0) continue;
              const md = Math.sqrt(md2);
              const mt = 1 - md / MBH_EVAP_RANGE;
              const mf = MBH_EVAP_FORCE * mt * mt;
              ball.vx -= (mdx / md) * mf; // push outward (away from the BH)
              ball.vy -= (mdy / md) * mf;
            } else {
              const R = 40 + (mb.life / mb.maxLife) * 80; // range shrinks as it evaporates
              if (md2 >= R * R || md2 === 0) continue;
              const md = Math.sqrt(md2);
              const mt = 1 - md / R;
              const mf = MBH_PULL * mt * mt;
              ball.vx += (mdx / md) * mf; // pull inward
              ball.vy += (mdy / md) * mf;
            }
          }

          // Dark matter halo: an invisible, weak attraction (no core, no absorption). The
          // ball just curves toward it — you can't see why, which is the whole point.
          for (const dh of g.darkHalos) {
            const hdx = dh.x - ball.x, hdy = dh.y - ball.y;
            const hd2 = hdx * hdx + hdy * hdy;
            if (hd2 >= DM_RANGE * DM_RANGE || hd2 === 0) continue;
            const hd = Math.sqrt(hd2);
            const ht = 1 - hd / DM_RANGE;
            const hf = dh.strength * ht * ht;
            ball.vx += (hdx / hd) * hf;
            ball.vy += (hdy / hd) * hf;
          }

          // Ergosphere: frame-dragging ring band. Only balls inside r0..r1 feel a one-way
          // tangential drag (plus a slight inward pull); the centre and the outside are inert,
          // so a ball can only ever be swept around the band, never held.
          for (const eg of g.ergospheres) {
            const gdx2 = ball.x - eg.x, gdy2 = ball.y - eg.y;
            const gd2b = gdx2 * gdx2 + gdy2 * gdy2;
            if (gd2b === 0) continue;
            const gdb = Math.sqrt(gd2b);
            if (gdb < eg.r0 || gdb > eg.r1) continue;
            const bandCenter = (eg.r0 + eg.r1) / 2;
            const halfWidth  = (eg.r1 - eg.r0) / 2;
            const egt = 1 - Math.abs(gdb - bandCenter) / halfWidth;
            const egf = eg.strength * egt * egt;
            ball.vx += (-gdy2 / gdb) * egf * eg.dir;
            ball.vy += ( gdx2 / gdb) * egf * eg.dir;
            ball.vx += (-gdx2 / gdb) * egf * 0.15;
            ball.vy += (-gdy2 / gdb) * egf * 0.15;
          }

          // Superradiance: radial pull + constant tangential accel. A ball that falls in
          // speeds up as it orbits and is centrifugally flung out — capture is structurally
          // impossible. BALL_SPEED*2 clamp prevents substep explosion. Crossing the +x axis
          // in the spin direction emits a white amplification wave and slows the vortex spin.
          for (const sr of g.superradiances) {
            const sdx = sr.x - ball.x, sdy = sr.y - ball.y; // toward center
            const sd2 = sdx * sdx + sdy * sdy;
            if (sd2 >= SR_RANGE * SR_RANGE || sd2 === 0) {
              sr.prevBallAng.delete(ball);
              continue;
            }
            const sd = Math.sqrt(sd2);
            const st = 1 - sd / SR_RANGE;
            const sf = SR_PULL * st * st;
            ball.vx += (sdx / sd) * sf;
            ball.vy += (sdy / sd) * sf;
            // Unit radial OUT from center; tangential = rotate 90° by spin dir.
            const cx = -sdx / sd, cy = -sdy / sd;
            ball.vx += (-cy) * sr.dir * SR_TAN_ACCEL;
            ball.vy += ( cx) * sr.dir * SR_TAN_ACCEL;
            const sSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (sSpd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / sSpd; ball.vx *= sc; ball.vy *= sc; }
            sr.occupied = true;
            const ang = Math.atan2(-sdy, -sdx);
            const prev = sr.prevBallAng.get(ball);
            if (prev !== undefined && sr.waveTimer <= 0) {
              const crossed = sr.dir > 0
                ? (prev < 0 && ang >= 0 && ang - prev < Math.PI)
                : (prev >= 0 && ang < 0 && prev - ang < Math.PI);
              if (crossed) {
                sr.waveTimer = SR_WAVE_DUR;
                sr.waveX = ball.x; sr.waveY = ball.y;
                sr.spinMult = Math.max(SR_SPIN_FLOOR, sr.spinMult * SR_SPIN_DECAY);
              }
            }
            sr.prevBallAng.set(ball, ang);
          }

          // Negative Mass Blob: outward push only. The blob itself chases in the draw block
          // (slower than any shove), so a ball is always driven away faster than the hole
          // can close — capture is impossible by construction.
          for (const nmb of g.negMassBlobs) {
            const ndx = ball.x - nmb.x, ndy = ball.y - nmb.y;
            const nd2 = ndx * ndx + ndy * ndy;
            if (nd2 >= NMB_RANGE * NMB_RANGE || nd2 === 0) continue;
            const nd = Math.sqrt(nd2);
            const nt = 1 - nd / NMB_RANGE;
            const nf = NMB_FORCE * nt * nt;
            ball.vx += (ndx / nd) * nf;
            ball.vy += (ndy / nd) * nf;
            const nSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (nSpd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / nSpd; ball.vx *= sc; ball.vy *= sc; }
          }

          // Magnetic reconnection: inert X of field lines that only acts during the brief
          // snap (releaseTimer > 0, advanced in the draw block) — ejecting balls outward
          // along whichever line they're sitting on. Fully passable between snaps.
          for (const mr of g.magReconnections) {
            if (mr.releaseTimer <= 0) continue;
            const mrAngles = [mr.angle, mr.angle + Math.PI / 2];
            for (const la of mrAngles) {
              const lax = Math.cos(la), lay = Math.sin(la);
              const rdx = ball.x - mr.x, rdy = ball.y - mr.y;
              const along = rdx * lax + rdy * lay;
              const perp  = Math.abs(rdx * lay - rdy * lax);
              if (perp > MR_HALF || Math.abs(along) > MR_HALFLEN) continue;
              const mt  = 1 - Math.abs(along) / MR_HALFLEN;
              const mf  = MR_FORCE * mt * mt;
              const sgn = along >= 0 ? 1 : -1;
              ball.vx += lax * sgn * mf;
              ball.vy += lay * sgn * mf;
            }
          }

          // Pre-supernova star: during the 12f boom (boomTimer > 0, advanced in the draw
          // block), shove every nearby ball outward. Impulsive only — swelling and bounce
          // are handled by the solid body in the sub-step loop above.
          for (const sn of g.preSupernovae) {
            if (sn.boomTimer <= 0) continue;
            const bdx = ball.x - sn.x, bdy = ball.y - sn.y;
            const bd2 = bdx * bdx + bdy * bdy;
            if (bd2 >= SN_BOOM_RANGE * SN_BOOM_RANGE || bd2 === 0) continue;
            const bd = Math.sqrt(bd2);
            const bt = 1 - bd / SN_BOOM_RANGE;
            const bf = SN_BOOM_FORCE * bt * bt;
            ball.vx += (bdx / bd) * bf;
            ball.vy += (bdy / bd) * bf;
          }

          // Tidal stretch field: decompose velocity into radial/tangential parts and comb
          // it toward the radial axis (amplify radial, damp tangential). For a radially-
          // dominant ball this is a net energy gain each frame (the radial/tangential decay
          // don't cancel), so — as with wind/quasar jets — clamp the result to BALL_SPEED*2
          // to keep it from running away on repeated passes.
          for (const ts of g.tidalStretches) {
            const tdx = ball.x - ts.x, tdy = ball.y - ts.y;
            const td2 = tdx * tdx + tdy * tdy;
            if (td2 >= TS_RANGE * TS_RANGE || td2 === 0) continue;
            const td  = Math.sqrt(td2);
            const tt  = 1 - td / TS_RANGE;
            const tk  = ts.strength * tt * tt;
            const tnx = tdx / td, tny = tdy / td;
            const vr  = ball.vx * tnx + ball.vy * tny; // radial component (scalar along d̂)
            const vrx = vr * tnx, vry = vr * tny;
            const vtx = ball.vx - vrx, vty = ball.vy - vry; // tangential remainder
            ball.vx = vrx * (1 + tk) + vtx * (1 - tk);
            ball.vy = vry * (1 + tk) + vty * (1 - tk);
            const tspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (tspd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / tspd; ball.vx *= sc; ball.vy *= sc; }
          }

          // Tachyon stream: inside the band (perpendicular distance only — the band spans
          // the whole field, so there's no along-axis bound), accelerate along its direction.
          // Fully passable in the perpendicular sense; clamped like wind so it can't run away.
          for (const tc of g.tachyonStreams) {
            const tcx = Math.cos(tc.angle), tcy = Math.sin(tc.angle);
            const tdx2 = ball.x - tc.x, tdy2 = ball.y - tc.y;
            const perp = Math.abs(tdx2 * tcy - tdy2 * tcx);
            if (perp > tc.halfWidth) continue;
            ball.vx += tcx * TACHYON_ACCEL;
            ball.vy += tcy * TACHYON_ACCEL;
            const tcspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (tcspd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / tcspd; ball.vx *= sc; ball.vy *= sc; }
          }

          // FRB source: on the exact firing frame (fired, advanced in the draw block),
          // rotate every ball's velocity by a fixed angle — speed-preserving, board-wide,
          // so it can never stall or trap a ball.
          for (const frb of g.frbSources) {
            if (!frb.fired) continue;
            const fca = Math.cos(frb.fireAngle), fsa = Math.sin(frb.fireAngle);
            const fnvx = ball.vx * fca - ball.vy * fsa;
            ball.vy = ball.vx * fsa + ball.vy * fca;
            ball.vx = fnvx;
          }

          // Magnet attraction
          for (const peg of g.pegs) {
            if (peg.cleared || peg.type !== 'magnet') continue;
            const mdx = peg.x - ball.x, mdy = peg.y - ball.y;
            const mdist2 = mdx * mdx + mdy * mdy;
            if (mdist2 < MAGNET_RANGE * MAGNET_RANGE && mdist2 > 0) {
              const mdist = Math.sqrt(mdist2);
              const strength = MAGNET_FORCE * (1 - mdist / MAGNET_RANGE);
              ball.vx += (mdx / mdist) * strength;
              ball.vy += (mdy / mdist) * strength;
            }
          }
          } // end !inNothing continuous-force block

          // Sub-step movement: split frame into ≤BALL_R px steps so the ball
          // never skips over thin collision zones (bumpers, wormhole bars).
          {
            const spd0 = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            const substeps = Math.max(1, Math.ceil(spd0 / BALL_R));
            const sx = ball.vx / substeps;
            const sy = ball.vy / substeps;
            let teleported = false;

            for (let sub = 0; sub < substeps; sub++) {
              ball.x += sx;
              ball.y += sy;

              // Wall bounces / warp / wall segments
              if (g.warpWalls) {
                if (ball.x < -BALL_R)    ball.x = W + BALL_R;
                if (ball.x > W + BALL_R) ball.x = -BALL_R;
              } else {
                const hitLeft  = ball.x - BALL_R < 0;
                const hitRight = ball.x + BALL_R > W;
                if (hitLeft || hitRight) {
                  const hitSide: 'left' | 'right' = hitLeft ? 'left' : 'right';
                  const seg = g.wallSegments.find(s => s.side === hitSide && ball.y >= s.yMin && ball.y <= s.yMax);
                  if (seg) {
                    if (seg.type === 'void') {
                      if (g.cosmicDarkAgesActive) g.cdaGhosts.push({ x: ball.x, y: ball.y, timer: CDA_GHOST_DUR, vx: ball.vx, vy: ball.vy });
                      ball.y = H + 100; // remove ball from play
                    } else if (seg.type === 'warp') {
                      ball.x = hitLeft ? W - BALL_R - 1 : BALL_R + 1;
                      ball.vx = hitLeft ? Math.abs(ball.vx) : -Math.abs(ball.vx);
                    } else { // distort
                      ball.x = hitLeft ? BALL_R : W - BALL_R;
                      ball.vx = hitLeft ? Math.abs(ball.vx) : -Math.abs(ball.vx);
                      const dSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                      const dAngle = Math.atan2(ball.vy, ball.vx) + (Math.random() - 0.5) * 1.1;
                      ball.vx = Math.cos(dAngle) * dSpd;
                      ball.vy = Math.sin(dAngle) * dSpd;
                    }
                  } else {
                    if (hitLeft)  { ball.x = BALL_R;     ball.vx =  Math.abs(ball.vx); }
                    if (hitRight) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }
                  }
                }
              }

              // Bumper collisions
              for (const bumper of g.bumpers) {
                if (collideBallBumper(ball, bumper)) {
                  spawnBurst(g, ball.x, ball.y, ball.vx * 0.35, ball.vy * 0.35);
                  bumper.hitFlash = BUMPER_FLASH;
                  if (bumper.hitCool === 0) { bumper.hitCount++; bumper.hitCool = HIT_COOL; }
                  const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                  if (spd < effMinSpeed) { const sc = effMinSpeed / spd; ball.vx *= sc; ball.vy *= sc; }
                  // Downward bias: gradually push upward-moving balls toward the field
                  if (ball.vy < 0) ball.vy += BUMPER_DN_BIAS;
                }
              }

              // Comet collision: red (vanish) comets destroy the ball; blue ones deflect it
              // (reflect + carry momentum so the bounce direction is unpredictable).
              for (const comet of g.comets) {
                if (comet.hitCool > 0 || comet.respawnTimer > 0) continue;
                const cdx = ball.x - comet.x, cdy = ball.y - comet.y;
                const cd2 = cdx * cdx + cdy * cdy;
                const crr = BALL_R + comet.r;
                if (cd2 >= crr * crr) continue;
                // emit a ripple + colored spark burst at the comet (ripple drawn in render loop)
                comet.hitFlash = 26; comet.hitX = comet.x; comet.hitY = comet.y;
                spawnBurst(g, comet.x, comet.y, 8, 8, comet.vanish ? '#ff5a5a' : '#8fd3f4');
                if (comet.vanish) {
                  spawnBurst(g, ball.x, ball.y, 12, 12, '#ff5a5a'); // big red ball-destruction pop
                  if (g.cosmicDarkAgesActive) g.cdaGhosts.push({ x: ball.x, y: ball.y, timer: CDA_GHOST_DUR, vx: ball.vx, vy: ball.vy });
                  ball.y = H + 100; // destroy the ball
                  comet.hitCool = HIT_COOL;
                  break;
                }
                const cd = Math.sqrt(cd2) || 1;
                const cnx = cdx / cd, cny = cdy / cd;
                const cdot = ball.vx * cnx + ball.vy * cny;
                ball.vx -= 2 * cdot * cnx;
                ball.vy -= 2 * cdot * cny;
                ball.x  += cnx * (crr - cd + 1.5);
                ball.y  += cny * (crr - cd + 1.5);
                ball.vx += comet.vx * 0.6; // carry some of the comet's momentum
                ball.vy += comet.vy * 0.6;
                const cspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (cspd < effMinSpeed) { const sc = effMinSpeed / cspd; ball.vx *= sc; ball.vy *= sc; }
                comet.hitCool = HIT_COOL;
                spawnBurst(g, ball.x, ball.y, ball.vx * 0.3, ball.vy * 0.3, '#8fd3f4');
              }

              // Bullet Cluster gas blob collision: solid bounce (like a comet), carries some
              // of the blob's momentum. The dark-matter blob (continuous-force section above)
              // never collides — only this visible half of the pair does.
              for (const bc of g.bulletClusters) {
                if (bc.hitCool > 0 || bc.respawnTimer > 0) continue;
                const bdx = ball.x - bc.x, bdy = ball.y - bc.warnY;
                const bd2 = bdx * bdx + bdy * bdy;
                const brr = BALL_R + BC_GAS_R;
                if (bd2 >= brr * brr) continue;
                bc.hitFlash = 8; bc.hitX = bc.x; bc.hitY = bc.warnY;
                spawnBurst(g, bc.x, bc.warnY, 8, 8, '#ff7a9a');
                const bd = Math.sqrt(bd2) || 1;
                const bnx = bdx / bd, bny = bdy / bd;
                const bdot = ball.vx * bnx + ball.vy * bny;
                ball.vx -= 2 * bdot * bnx;
                ball.vy -= 2 * bdot * bny;
                ball.x  += bnx * (brr - bd + 1.5);
                ball.y  += bny * (brr - bd + 1.5);
                ball.vx += bc.vx * 0.6; // carry some of the gas blob's momentum
                const bspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (bspd < effMinSpeed) { const sc = effMinSpeed / bspd; ball.vx *= sc; ball.vy *= sc; }
                bc.hitCool = HIT_COOL;
                spawnBurst(g, ball.x, ball.y, ball.vx * 0.3, ball.vy * 0.3, '#ff7a9a');
              }

              // Little Red Dot collision: solid bounce, only while lit (unlit = pass-through,
              // handled by the cycle check below skipping the whole block). Stationary, so no
              // momentum to carry — a plain reflection, like a tiny fixed comet.
              for (const lrd of g.littleRedDots) {
                if (lrd.hitCool > 0) continue;
                const lrdCyclePos = (g.frame + lrd.phase) % (LRD_ON_FRAMES + LRD_OFF_FRAMES);
                if (lrdCyclePos >= LRD_ON_FRAMES) continue;
                const ldx = ball.x - lrd.x, ldy = ball.y - lrd.y;
                const ld2 = ldx * ldx + ldy * ldy;
                const lrr = BALL_R + LRD_R;
                if (ld2 >= lrr * lrr) continue;
                lrd.hitFlash = 6; lrd.hitX = ball.x; lrd.hitY = ball.y;
                spawnBurst(g, ball.x, ball.y, 6, 6, '#c02818');
                const ld = Math.sqrt(ld2) || 1;
                const lnx = ldx / ld, lny = ldy / ld;
                const ldot = ball.vx * lnx + ball.vy * lny;
                ball.vx -= 2 * ldot * lnx;
                ball.vy -= 2 * ldot * lny;
                ball.x  += lnx * (lrr - ld + 1.5);
                ball.y  += lny * (lrr - ld + 1.5);
                const lspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (lspd < effMinSpeed) { const sc = effMinSpeed / lspd; ball.vx *= sc; ball.vy *= sc; }
                lrd.hitCool = HIT_COOL;
              }

              // Antimatter fleck: annihilates any ball it touches (like a red comet, but a
              // slow stationary-ish lurker). Goes dormant afterward (advanced in the draw
              // block) so it can't chain-kill from the same spot.
              for (const af of g.antimatterFlecks) {
                if (af.respawnTimer > 0) continue;
                const fdx = ball.x - af.x, fdy = ball.y - af.y;
                const fd2 = fdx * fdx + fdy * fdy;
                const frr = BALL_R + af.r;
                if (fd2 >= frr * frr) continue;
                spawnBurst(g, af.x, af.y, 10, 10, '#ffffff');
                spawnBurst(g, ball.x, ball.y, 12, 12, '#ffffff');
                if (g.cosmicDarkAgesActive) g.cdaGhosts.push({ x: ball.x, y: ball.y, timer: CDA_GHOST_DUR, vx: ball.vx, vy: ball.vy });
                ball.y = H + 100; // annihilate the ball
                af.respawnTimer = AF_RESPAWN;
                af.gammaFlash = 6;
                break;
              }

              // Rogue planet: solid-body bounce (reflect + carry the planet's drift). In the
              // sub-step loop so fast balls can't tunnel through the r=22 world.
              for (const rp of g.roguePlanets) {
                if (rp.hitCool > 0) continue;
                const pdx = ball.x - rp.x, pdy = ball.y - rp.y;
                const pd2 = pdx * pdx + pdy * pdy;
                const prr = BALL_R + rp.r;
                if (pd2 >= prr * prr) continue;
                const pd = Math.sqrt(pd2) || 1;
                const pnx = pdx / pd, pny = pdy / pd;
                const pdot = ball.vx * pnx + ball.vy * pny;
                ball.vx -= 2 * pdot * pnx;
                ball.vy -= 2 * pdot * pny;
                ball.x  += pnx * (prr - pd + 1.5);
                ball.y  += pny * (prr - pd + 1.5);
                ball.vx += rp.vx * 0.5; // carry a little of the planet's drift
                ball.vy += rp.vy * 0.5;
                const pspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (pspd < effMinSpeed) { const sc = effMinSpeed / pspd; ball.vx *= sc; ball.vy *= sc; }
                rp.hitCool = HIT_COOL;
                spawnBurst(g, ball.x, ball.y, ball.vx * 0.3, ball.vy * 0.3, '#3a4a68');
              }

              // Pre-supernova star: solid bounce body whose radius swells (14→30) with its
              // cycle. The hitbox always matches the drawn radius, so "bigger = more
              // dangerous" is a fair, visible warning. In the sub-step loop so fast balls
              // can't tunnel through it at any size.
              for (const sn of g.preSupernovae) {
                if (sn.hitCool > 0) continue;
                const snR = sn.boomTimer > 0 ? SN_R_MAX
                  : sn.shrinkTimer > 0 ? SN_R_MIN + (sn.shrinkTimer / SN_SHRINK) * (SN_R_MAX - SN_R_MIN)
                  : SN_R_MIN + (1 - sn.timer / sn.period) * (SN_R_MAX - SN_R_MIN);
                const sdx = ball.x - sn.x, sdy = ball.y - sn.y;
                const sd2 = sdx * sdx + sdy * sdy;
                const srr = BALL_R + snR;
                if (sd2 >= srr * srr) continue;
                const sd = Math.sqrt(sd2) || 1;
                const snx = sdx / sd, sny = sdy / sd;
                const sdot = ball.vx * snx + ball.vy * sny;
                ball.vx -= 2 * sdot * snx;
                ball.vy -= 2 * sdot * sny;
                ball.x  += snx * (srr - sd + 1.5);
                ball.y  += sny * (srr - sd + 1.5);
                const sspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (sspd < effMinSpeed) { const sc = effMinSpeed / sspd; ball.vx *= sc; ball.vy *= sc; }
                sn.hitCool  = HIT_COOL;
                sn.hitFlash = 8;
                spawnBurst(g, ball.x, ball.y, ball.vx * 0.3, ball.vy * 0.3, '#d84a20');
              }

              // Axion phase wall: intangible except during the ~90f 'solid' phase (advanced
              // in the draw block). Bumper-style OBB reflection only while materialized —
              // fadeIn/fadeOut/gone are always fully passable, so a wall can never trap a ball.
              for (const aw of g.axionWalls) {
                if (aw.phase !== 'solid' || aw.hitCool > 0) continue;
                if (!testBallOBB(ball, aw.x, aw.y, AXION_W, AXION_H, aw.angle)) continue;
                const acosA = Math.cos(aw.angle), asinA = Math.sin(aw.angle);
                const adx = ball.x - aw.x, ady = ball.y - aw.y;
                const alx =  acosA * adx + asinA * ady;
                const aly = -asinA * adx + acosA * ady;
                const ahw = AXION_W * 0.5 + BALL_R;
                const ahh = AXION_H * 0.5 + BALL_R;
                const aox = ahw - Math.abs(alx);
                const aoy = ahh - Math.abs(aly);
                let anlx: number, anly: number, apush: number;
                if (aox < aoy) { anlx = alx >= 0 ? 1 : -1; anly = 0; apush = aox; }
                else            { anlx = 0; anly = aly >= 0 ? 1 : -1; apush = aoy; }
                const awnx = acosA * anlx - asinA * anly;
                const awny = asinA * anlx + acosA * anly;
                const avDotN = ball.vx * awnx + ball.vy * awny;
                if (avDotN > 0) continue; // already separating
                ball.vx -= 2 * avDotN * awnx;
                ball.vy -= 2 * avDotN * awny;
                ball.x  += awnx * apush;
                ball.y  += awny * apush;
                const aspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (aspd < effMinSpeed) { const sc = effMinSpeed / aspd; ball.vx *= sc; ball.vy *= sc; }
                aw.hitCool  = HIT_COOL;
                aw.hitFlash = 6;
                spawnBurst(g, ball.x, ball.y, ball.vx * 0.3, ball.vy * 0.3, '#e8e4f0');
              }

              // Black Hole Firewall: arc barrier — radial normal reflection, then scramble
              // heading by ±FW_SCRAMBLE so the bounce angle can never be trusted (hash-peg
              // style). Arc (not a closed ring) so it can never enclose a ball.
              for (const fw of g.firewalls) {
                if (fw.hitCool > 0) continue;
                const fdx = ball.x - fw.x, fdy = ball.y - fw.y;
                const fdist2 = fdx * fdx + fdy * fdy;
                if (fdist2 === 0) continue;
                const fdist = Math.sqrt(fdist2);
                if (Math.abs(fdist - FW_R) > FW_HALFWIDTH + BALL_R) continue;
                // Angle within the arc? Normalize relative angle into [0, 2π).
                let fAng = Math.atan2(fdy, fdx) - fw.angle0;
                fAng = ((fAng % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
                if (fAng > FW_SPAN) continue;
                // Radial outward normal (from center through contact point).
                const fnx = fdx / fdist, fny = fdy / fdist;
                const fvDotN = ball.vx * fnx + ball.vy * fny;
                // Reflect regardless of approach side (horizon burns from either side).
                ball.vx -= 2 * fvDotN * fnx;
                ball.vy -= 2 * fvDotN * fny;
                // Push out of the band along the radial normal toward the nearer edge.
                const fBandSign = fdist >= FW_R ? 1 : -1;
                const fOverlap = (FW_HALFWIDTH + BALL_R) - Math.abs(fdist - FW_R);
                ball.x += fnx * fBandSign * fOverlap;
                ball.y += fny * fBandSign * fOverlap;
                // Scramble heading by ±FW_SCRAMBLE (keep speed, force downward-ish like hash).
                const fSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                const fBase = Math.atan2(ball.vy, ball.vx);
                const fScram = fBase + (Math.random() * 2 - 1) * FW_SCRAMBLE;
                ball.vx = Math.cos(fScram) * fSpd;
                ball.vy = Math.abs(Math.sin(fScram)) * fSpd; // prefer downward
                const fSpd2 = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (fSpd2 < effMinSpeed) { const sc = effMinSpeed / fSpd2; ball.vx *= sc; ball.vy *= sc; }
                fw.hitCool = FW_HIT_COOL;
                fw.hitFlash = FW_FLASH_DUR;
                spawnBurst(g, ball.x, ball.y, ball.vx * 0.3, ball.vy * 0.3, '#ffffff');
                spawnBurst(g, ball.x, ball.y, ball.vx * 0.2, ball.vy * 0.2, '#ff9a30');
              }

              // Quantum tunneling barrier: on first contact, roll once — 50% reflects
              // (bumper-style), 50% passes clean through. passingBalls locks the outcome
              // per ball until it fully leaves the zone, so it can't re-roll mid-overlap.
              for (const qb of g.quantumBarriers) {
                const qInside = testBallOBB(ball, qb.x, qb.y, QB_W, QB_H, qb.angle);
                if (!qInside) { qb.passingBalls.delete(ball); continue; }
                if (qb.passingBalls.has(ball)) continue;
                if (Math.random() < 0.5) {
                  qb.passingBalls.add(ball);
                  spawnBurst(g, ball.x, ball.y, 2, 2, '#3a4a9a'); // faint ripple — barrier is unaffected
                  continue;
                }
                const qcosA = Math.cos(qb.angle), qsinA = Math.sin(qb.angle);
                const qdx = ball.x - qb.x, qdy = ball.y - qb.y;
                const qlx =  qcosA * qdx + qsinA * qdy;
                const qly = -qsinA * qdx + qcosA * qdy;
                const qhw = QB_W * 0.5 + BALL_R;
                const qhh = QB_H * 0.5 + BALL_R;
                const qox = qhw - Math.abs(qlx);
                const qoy = qhh - Math.abs(qly);
                let qnlx: number, qnly: number, qpush: number;
                if (qox < qoy) { qnlx = qlx >= 0 ? 1 : -1; qnly = 0; qpush = qox; }
                else            { qnlx = 0; qnly = qly >= 0 ? 1 : -1; qpush = qoy; }
                const qwnx = qcosA * qnlx - qsinA * qnly;
                const qwny = qsinA * qnlx + qcosA * qnly;
                const qvDotN = ball.vx * qwnx + ball.vy * qwny;
                if (qvDotN > 0) { qb.passingBalls.add(ball); continue; } // already separating — lock the roll anyway
                ball.vx -= 2 * qvDotN * qwnx;
                ball.vy -= 2 * qvDotN * qwny;
                ball.x  += qwnx * qpush;
                ball.y  += qwny * qpush;
                const qspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (qspd < effMinSpeed) { const sc = effMinSpeed / qspd; ball.vx *= sc; ball.vy *= sc; }
                qb.passingBalls.add(ball); // also lock out re-roll while still overlapping post-bounce
                qb.reflectFlash = QB_FLASH_DUR;
                spawnBurst(g, ball.x, ball.y, ball.vx * 0.3, ball.vy * 0.3, '#ffffff');
              }

              // Einstein mirror ring: crossing the thin ring line mirror-reflects velocity
              // about the local tangent (normal/radial component kept, tangential flipped —
              // v' = 2(v·n̂)n̂ - v, speed-preserving). Unlike a peg/bumper's full normal-flip
              // bounce, the radial component is unchanged, so the ball keeps moving through
              // the band in the same direction and clears it within a few frames.
              for (const emr of g.einsteinMirrorRings) {
                const mdx = ball.x - emr.x, mdy = ball.y - emr.y;
                const mdist2 = mdx * mdx + mdy * mdy;
                if (mdist2 === 0) continue;
                const mdist = Math.sqrt(mdist2);
                const mInside = Math.abs(mdist - EMR_R) < EMR_HALFWIDTH + BALL_R;
                if (!mInside) { emr.passingBalls.delete(ball); continue; }
                if (emr.passingBalls.has(ball)) continue;
                emr.passingBalls.add(ball);
                const mnx = mdx / mdist, mny = mdy / mdist;
                const mdot = ball.vx * mnx + ball.vy * mny;
                ball.vx = 2 * mdot * mnx - ball.vx;
                ball.vy = 2 * mdot * mny - ball.vy;
                const mspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (mspd < effMinSpeed) { const sc = effMinSpeed / mspd; ball.vx *= sc; ball.vy *= sc; }
                emr.hitFlash    = 1;
                emr.shockTimer  = EMR_SHOCK_DUR;
                emr.shockX      = ball.x;
                emr.shockY      = ball.y;
                emr.ghostFlash  = 1;
                emr.ghostX      = 2 * emr.x - ball.x;
                emr.ghostY      = 2 * emr.y - ball.y;
                spawnBurst(g, ball.x, ball.y, ball.vx * 0.3, ball.vy * 0.3, '#d8dce8');
              }

              // Wormhole teleportation (inside sub-step to catch thin bars at high speed).
              // Physics hitbox uses aura dimensions (w+32, h=44) so the full visible
              // cloud area is interactive. cycleTimer is not checked so balls can always
              // teleport regardless of the visual fade phase.
              for (const wh of g.wormholes) {
                if (wh.hitCool > 0) continue;
                if (!testBallOBB(ball, wh.cx, wh.cy, wh.w + 32, 44, wh.angle)) continue;
                const partner = g.wormholes.find(
                  o => o.pairId === wh.pairId && o.pairSlot !== wh.pairSlot
                );
                if (!partner || partner.hitCool > 0) continue;
                spawnWHBurst(g, ball.x, ball.y);
                spawnWHBurst(g, partner.cx, partner.cy);
                ball.x = partner.cx;
                ball.y = Math.min(partner.cy + 6, H - 60);
                wh.hitCool         = 30;
                partner.hitCool    = 30;
                wh.flashTimer      = 28;
                partner.flashTimer = 28;
                teleported = true;
                break;
              }

              // Cosmic string teleport-shift (mirrors the wormhole pattern above): crossing
              // the 1px line doesn't bounce the ball — it instantly shifts the ball a fixed
              // distance along the line's own axis. Velocity is untouched, only position moves.
              // passingBalls (not a shared cooldown) locks the shift to once per crossing: the
              // shift only moves the ball along the line's own axis, so a ball gliding
              // near-parallel to the string can stay inside the same OBB for many frames —
              // a shared timer would re-trigger it repeatedly instead of firing once.
              if (!teleported) for (const cs of g.cosmicStrings) {
                const csInside = testBallOBB(ball, cs.x, cs.y, CS_LENGTH, CS_HALFWIDTH * 2, cs.angle);
                if (!csInside) { cs.passingBalls.delete(ball); continue; }
                if (cs.passingBalls.has(ball)) continue;
                cs.passingBalls.add(ball);
                const csCos = Math.cos(cs.angle), csSin = Math.sin(cs.angle);
                const oldX = ball.x, oldY = ball.y;
                ball.x += csCos * cs.shift * cs.dir;
                ball.y += csSin * cs.shift * cs.dir;
                ball.x = Math.max(BALL_R, Math.min(W - BALL_R, ball.x));
                cs.ghostOldX  = oldX;
                cs.ghostOldY  = oldY;
                cs.ghostNewX  = ball.x;
                cs.ghostNewY  = ball.y;
                cs.hitFlash   = 2;
                cs.ghostFlash = 1;
                spawnBurst(g, ball.x, ball.y, 0, 0, '#fffaf0');
                teleported = true;
                break;
              }
              if (teleported) break;
            }
          }

          // Peg collision
          for (const peg of g.pegs) {
            if (peg.cleared || peg.hitCool > 0 || peg.mudBroken) continue;
            const dx = ball.x - peg.x, dy = ball.y - peg.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 >= (BALL_R + PEG_R) ** 2) continue;

            const dist = Math.sqrt(dist2) || 1; // dead-center overlap guard (same as comet/boss)
            const nx = dx / dist, ny = dy / dist;

            // Reflect ball
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx -= 2 * dot * nx;
            ball.vy -= 2 * dot * ny;
            ball.x  += nx * (BALL_R + PEG_R - dist + 1.5);
            ball.y  += ny * (BALL_R + PEG_R - dist + 1.5);

            const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (spd < effMinSpeed) { const sc = effMinSpeed / spd; ball.vx *= sc; ball.vy *= sc; }

            if (peg.type === 'magnet') {
              // Permanent obstacle — never clears, only cooldown
              peg.hitCool = HIT_COOL;
            } else if (peg.type === 'chain-node') {
              // Indestructible node — bounce only
              peg.hitCool = HIT_COOL;
            } else if (peg.type === 'chain-weak') {
              peg.hitCool = HIT_COOL;
              peg.hp = (peg.hp ?? 1) - 1;
              if (peg.hp <= 0) {
                for (const cp of g.pegs) {
                  if (cp.chainId === peg.chainId && !cp.cleared) {
                    spawnPegBreak(g, cp);
                    cp.cleared = true;
                    cp.hitCool = HIT_COOL;
                  }
                }
                g.score += 80;
                setScore(g.score);
              }
            } else if (peg.type === 'shield') {
              peg.hitCool = HIT_COOL;
              peg.hp = (peg.hp ?? SHIELD_HP) - 1;
              if (peg.hp <= 0) {
                spawnPegBreak(g, peg);
                peg.cleared = true;
                g.score += 30;
                setScore(g.score);
                if (peg.bossArmor) armorRefill();
              } else {
                spawnBurst(g, peg.x, peg.y, 0, 0);
              }
            } else if (peg.type === 'hash') {
              spawnPegBreak(g, peg);
              peg.cleared = true;
              peg.hitCool = HIT_COOL;
              // Randomize ball direction (keep speed, ensure downward)
              const hashSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
              const hashAngle = Math.random() * Math.PI * 2;
              ball.vx = Math.cos(hashAngle) * hashSpd;
              ball.vy = Math.abs(Math.sin(hashAngle)) * hashSpd;
              g.score += 20;
              setScore(g.score);
            } else if (peg.type === 'freeze') {
              spawnPegBreak(g, peg);
              peg.cleared = true;
              peg.hitCool = HIT_COOL;
              // Slow ball and start freeze timer
              const freezeSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * FREEZE_SLOW;
              const freezeAngle = Math.atan2(ball.vy, ball.vx);
              ball.vx = Math.cos(freezeAngle) * freezeSpd;
              ball.vy = Math.sin(freezeAngle) * freezeSpd;
              ball.freezeTimer = FREEZE_DUR;
              g.score += 20;
              setScore(g.score);
            } else if (peg.type === 'mud') {
              // Kill the ball's momentum, break the peg (revives before next shot).
              const mudSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * MUD_SLOW;
              const mudAngle = Math.atan2(ball.vy, ball.vx);
              ball.vx = Math.cos(mudAngle) * mudSpd;
              ball.vy = Math.sin(mudAngle) * mudSpd;
              ball.mudTimer = MUD_DUR;
              peg.mudBroken = true;                                  // not cleared → revives
              spawnBurst(g, peg.x, peg.y, 9, 9, '#5a3a1e');          // brown mud splat
              g.score += 10;
              setScore(g.score);
            } else if (peg.type === 'lightning') {
              spawnPegBreak(g, peg);
              peg.cleared = true;
              peg.hitCool = HIT_COOL;
              g.score += 20;
              // Cascade: find 2 nearest non-cleared non-chain-node pegs in range
              const lcandidates = g.pegs
                .filter(p => !p.cleared && p !== peg && p.type !== 'chain-node')
                .map(p => ({ p, d2: (p.x - peg.x) ** 2 + (p.y - peg.y) ** 2 }))
                .filter(({ d2 }) => d2 <= LIGHTNING_RANGE ** 2)
                .sort((a, b) => a.d2 - b.d2)
                .slice(0, 2)
                .map(({ p }) => p);
              for (const lt of lcandidates) {
                if (lt.cleared) continue;
                g.lightningArcs.push({ x1: peg.x, y1: peg.y, x2: lt.x, y2: lt.y, age: 0, maxAge: 22, pts: makeLightningPath(peg.x, peg.y, lt.x, lt.y) });
                if (lt.type === 'shield') {
                  lt.hp = (lt.hp ?? SHIELD_HP) - 1; lt.hitCool = HIT_COOL;
                  if ((lt.hp ?? 0) <= 0) { spawnPegBreak(g, lt); lt.cleared = true; g.score += 30; if (lt.bossArmor) armorRefill(); }
                } else {
                  spawnPegBreak(g, lt); lt.cleared = true; lt.hitCool = HIT_COOL;
                  if (lt.type === 'orange') { g.orangeLeft--; g.score += 100; }
                  else if (lt.type === 'purple') { g.shotsLeft++; g.score += 50; }
                  else if (lt.type === 'chain-weak') {
                    for (const cp of g.pegs) {
                      if (cp.chainId === lt.chainId && !cp.cleared) { spawnPegBreak(g, cp); cp.cleared = true; cp.hitCool = HIT_COOL; }
                    }
                    g.score += 80;
                  } else { g.score += 10; }
                }
                // 2nd-level cascade if the zapped peg is also a cleared lightning peg
                if (lt.type === 'lightning' && lt.cleared) {
                  const lc2 = g.pegs
                    .filter(p => !p.cleared && p !== lt && p.type !== 'chain-node')
                    .map(p => ({ p, d2: (p.x - lt.x) ** 2 + (p.y - lt.y) ** 2 }))
                    .filter(({ d2 }) => d2 <= LIGHTNING_RANGE ** 2)
                    .sort((a, b) => a.d2 - b.d2)
                    .slice(0, 2)
                    .map(({ p }) => p);
                  for (const lt2 of lc2) {
                    if (lt2.cleared) continue;
                    g.lightningArcs.push({ x1: lt.x, y1: lt.y, x2: lt2.x, y2: lt2.y, age: 0, maxAge: 22, pts: makeLightningPath(lt.x, lt.y, lt2.x, lt2.y) });
                    if (lt2.type === 'shield') {
                      lt2.hp = (lt2.hp ?? SHIELD_HP) - 1; lt2.hitCool = HIT_COOL;
                      if ((lt2.hp ?? 0) <= 0) { spawnPegBreak(g, lt2); lt2.cleared = true; g.score += 30; if (lt2.bossArmor) armorRefill(); }
                    } else {
                      spawnPegBreak(g, lt2); lt2.cleared = true; lt2.hitCool = HIT_COOL;
                      if (lt2.type === 'orange') { g.orangeLeft--; g.score += 100; }
                      else if (lt2.type === 'purple') { g.shotsLeft++; g.score += 50; }
                      else if (lt2.type === 'chain-weak') {
                        for (const cp of g.pegs) {
                          if (cp.chainId === lt2.chainId && !cp.cleared) { spawnPegBreak(g, cp); cp.cleared = true; cp.hitCool = HIT_COOL; }
                        }
                        g.score += 80;
                      } else { g.score += 10; }
                    }
                  }
                }
              }
              setScore(g.score);
              setOrangeLeft(g.orangeLeft);
              setShotsLeft(g.shotsLeft);
            } else {
              spawnPegBreak(g, peg);
              peg.cleared = true;
              peg.hitCool = HIT_COOL;

              if (peg.type === 'bomb') {
                g.score += 50;
                spawnBombBurst(g, peg.x, peg.y);
                // Chain explosion
                const br2 = BOMB_RADIUS ** 2;
                for (const other of g.pegs) {
                  if (other.cleared || other === peg) continue;
                  const ex = other.x - peg.x, ey = other.y - peg.y;
                  if (ex * ex + ey * ey < br2) {
                    if (other.type === 'chain-weak') {
                      // Bomb on weak point → instant chain destroy
                      for (const cp of g.pegs) {
                        if (cp.chainId === other.chainId && !cp.cleared) {
                          spawnPegBreak(g, cp);
                          cp.cleared = true; cp.hitCool = HIT_COOL;
                        }
                      }
                      g.score += 80;
                      setScore(g.score);
                    } else if (other.type === 'chain-node') {
                      // Bomb has no effect on chain nodes
                    } else {
                      spawnPegBreak(g, other);
                      other.cleared = true; other.hitCool = HIT_COOL;
                      if (other.type === 'orange') { g.orangeLeft--; g.score += 100; }
                      else if (other.type === 'purple') { g.shotsLeft++; g.score += 50; }
                      else { g.score += 10; }
                      if (other.bossArmor) armorRefill();
                    }
                  }
                }
                setOrangeLeft(g.orangeLeft);
                setShotsLeft(g.shotsLeft);
              } else if (peg.type === 'split') {
                g.score += 30;
                // Spawn 2 balls at ±36° from current direction
                const bspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                const ba   = Math.atan2(ball.vy, ball.vx);
                const sa   = Math.PI / 5;
                alive.push({ x: ball.x, y: ball.y, vx: Math.cos(ba + sa) * bspd, vy: Math.sin(ba + sa) * bspd, dots: makeBallDots(), isBucketBall: false, stuckTimer: 0, stuckBaseY: ball.y, freezeTimer: 0, mudTimer: 0, dilated: false, bfSide: 0, bucFlash: 0, reborn: false, goldTimer: 0 });
                alive.push({ x: ball.x, y: ball.y, vx: Math.cos(ba - sa) * bspd, vy: Math.sin(ba - sa) * bspd, dots: makeBallDots(), isBucketBall: false, stuckTimer: 0, stuckBaseY: ball.y, freezeTimer: 0, mudTimer: 0, dilated: false, bfSide: 0, bucFlash: 0, reborn: false, goldTimer: 0 });
              } else if (peg.type === 'orange') {
                g.orangeLeft--; g.score += 100;
                setOrangeLeft(g.orangeLeft);
              } else if (peg.type === 'purple') {
                g.shotsLeft++; g.score += 50;
                setShotsLeft(g.shotsLeft);
              } else {
                g.score += 10;
              }
              setScore(g.score);
            }
          }

          // Boss core collision — solid body (always bounces), damage gated by cooldown
          if (g.boss && g.boss.hp > 0) {
            const b = g.boss;
            const bdx = ball.x - b.x, bdy = ball.y - b.y;
            const bd2 = bdx * bdx + bdy * bdy;
            const rr  = BALL_R + b.r;
            if (bd2 < rr * rr) {
              const bd = Math.sqrt(bd2) || 1;
              const nx = bdx / bd, ny = bdy / bd;
              const dotp = ball.vx * nx + ball.vy * ny;
              ball.vx -= 2 * dotp * nx;
              ball.vy -= 2 * dotp * ny;
              ball.x  += nx * (rr - bd + 1.5);
              ball.y  += ny * (rr - bd + 1.5);
              const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
              if (spd < effMinSpeed) { const sc = effMinSpeed / spd; ball.vx *= sc; ball.vy *= sc; }
              if (b.hitCool === 0) {
                b.hp--; b.hitFlash = 10; b.hitCool = BOSS_HIT_COOL;
                g.score += 60;
                spawnBurst(g, ball.x, ball.y, ball.vx * 0.4, ball.vy * 0.4);
                if (b.hp <= 0) {
                  // DEFEAT: shockwave wipes the board with a cascade of breaks
                  for (const p of g.pegs) {
                    if (p.cleared) continue;
                    spawnPegBreak(g, p);
                    p.cleared = true; p.hitCool = HIT_COOL;
                  }
                  g.orangeLeft = 0;
                  for (let i = 0; i < 10; i++) {
                    const a = (i / 10) * Math.PI * 2;
                    spawnBurst(g, b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r, Math.cos(a) * 6, Math.sin(a) * 6);
                  }
                  g.bucketFlashTimer = 18;
                  g.score += 2500;
                  setOrangeLeft(0);
                }
                setScore(g.score);
              } else {
                spawnBurst(g, ball.x, ball.y, 0, 0);
              }
            }
          }

          // Bucket catch
          if (
            ball.y + BALL_R > bucketTop &&
            ball.y - BALL_R < bucketTop + BUCKET_H &&
            ball.x > g.bucketX && ball.x < g.bucketX + g.bucketW
          ) {
            if (ball.isBucketBall) {
              g.shotsLeft++;
              setShotsLeft(g.shotsLeft);
              const bCx = g.bucketX + g.bucketW / 2;
              spawnBucketBurst(g, bCx, bucketTop);
              g.bucketGlowTimer = 45;
              g.bucketFlashTimer = 14;
            }
            ball.y = H + 60;
          }

          if (ball.y <= H + 40) {
            // Quantum Foam display snap: real coords stay continuous; only the drawn
            // position locks to a 2px grid while inside the foam ("spacetime pixelates").
            let drawX = ball.x, drawY = ball.y;
            for (const qf of g.quantumFoams) {
              const qdx = ball.x - qf.x, qdy = ball.y - qf.y;
              if (qdx * qdx + qdy * qdy < QF_RANGE * QF_RANGE) {
                drawX = Math.round(ball.x / 2) * 2;
                drawY = Math.round(ball.y / 2) * 2;
                break;
              }
            }
            if (ball.isBucketBall) {
              const pulse = 0.7 + Math.sin(g.frame * 0.18) * 0.3;
              const bloomPasses = [
                { extra: 7, aFactor: 0.07, color: '#ffe8a0' },
                { extra: 3, aFactor: 0.16, color: '#f5d46a' },
                { extra: 1, aFactor: 0.36, color: GOLD_GLOW_COLOR },
              ] as const;
              const sA = Math.sin(g.frame * 0.038), cA = Math.cos(g.frame * 0.038);
              const sB = Math.sin(g.frame * 0.031), cB = Math.cos(g.frame * 0.031);
              for (const pass of bloomPasses) {
                ctx.fillStyle = pass.color;
                for (const d of ball.dots) {
                  const jx = (sA * d.cosP  + cA * d.sinP)  * 0.55;
                  const jy = (cB * d.cosP2 - sB * d.sinP2) * 0.55;
                  const sz = d.size + pass.extra;
                  ctx.globalAlpha = d.alpha * pass.aFactor * pulse;
                  ctx.fillRect(Math.round(drawX + d.x + jx - sz * 0.5), Math.round(drawY + d.y + jy - sz * 0.5), sz, sz);
                }
              }
              ctx.globalAlpha = 1;
              drawDots(ctx, ball.dots, drawX, drawY, 0, g.frame, GOLD_GLOW_COLOR, 1.0);
            } else if (ball.goldTimer > 0) {
              // CCC rebirth gold afterglow (shortened bucket-ball bloom).
              ball.goldTimer--;
              const gt = ball.goldTimer / CCC_GOLD_DUR;
              ctx.fillStyle = '#ffe8a0';
              ctx.globalAlpha = gt * 0.2;
              ctx.fillRect(Math.round(drawX) - 6, Math.round(drawY) - 6, 12, 12);
              ctx.globalAlpha = 1;
              drawDots(ctx, ball.dots, drawX, drawY, 0, g.frame, GOLD_GLOW_COLOR, 1.0);
            } else {
              drawDots(ctx, ball.dots, drawX, drawY, 0, g.frame, '#0f0f0d', 1.0);
            }
            // Bubble-universe chromatic afterimage (2f) — the ball as seen from the other side.
            if (ball.bucFlash > 0) {
              ctx.fillStyle = '#a0c8e8';
              ctx.globalAlpha = 0.45 * (ball.bucFlash / BUC_BALL_FLASH);
              ctx.fillRect(Math.round(drawX - 3) - 1, Math.round(drawY) - 1, 2, 2);
              ctx.fillStyle = '#e8a0c8';
              ctx.fillRect(Math.round(drawX + 3) - 1, Math.round(drawY) - 1, 2, 2);
              ctx.globalAlpha = 1;
            }
            // Ice crystal overlay when frozen
            if (ball.freezeTimer > 0) {
              const iceAlpha = Math.min(1, ball.freezeTimer / 30) * 0.85;
              ctx.fillStyle = '#88ccff';
              for (let arm = 0; arm < 6; arm++) {
                const ia = arm * Math.PI / 3 + g.frame * 0.025;
                const ilen = BALL_R + 4;
                ctx.globalAlpha = iceAlpha;
                ctx.fillRect(Math.round(drawX + Math.cos(ia) * ilen) - 1, Math.round(drawY + Math.sin(ia) * ilen) - 1, 2, 2);
                ctx.fillRect(Math.round(drawX + Math.cos(ia) * (ilen - 3)) - 1, Math.round(drawY + Math.sin(ia) * (ilen - 3)) - 1, 1, 1);
              }
              ctx.globalAlpha = 1;
            }
            // Mud clumps clinging to the ball while slowed
            if (ball.mudTimer > 0) {
              const mudAlpha = Math.min(1, ball.mudTimer / 30) * 0.9;
              for (let c = 0; c < 7; c++) {
                const ca = c * (Math.PI * 2 / 7) + Math.sin(c * 3.1) * 0.4;
                const clen = BALL_R + 1 + (c % 3);
                const drip = Math.max(0, Math.sin(g.frame * 0.05 + c)) * 2; // gooey sag
                ctx.fillStyle   = c % 2 === 0 ? '#4a2f18' : '#6a4423';
                ctx.globalAlpha = mudAlpha;
                ctx.fillRect(Math.round(drawX + Math.cos(ca) * clen) - 1, Math.round(drawY + Math.sin(ca) * clen + drip) - 1, 3, 3);
              }
              ctx.globalAlpha = 1;
            }
            alive.push(ball);
          } else if (g.cccBoundary && !ball.reborn && ball.y < H + 90) {
            // Conformal Cyclic Boundary: first fall-through rebirths at the top once.
            const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            const rebirthX = 40 + Math.random() * (W - 80);
            g.cccBoundary.streakTimer = 6;
            g.cccBoundary.streakX = ball.x;
            g.cccBoundary.streakFromY = Math.min(ball.y, H - 10);
            ball.x = rebirthX;
            ball.y = g.launcherY + 8;
            // Preserve speed magnitude; aim mostly downward with a slight random lean.
            const ang = (Math.random() - 0.5) * 0.6;
            ball.vx = Math.sin(ang) * spd;
            ball.vy = Math.abs(Math.cos(ang)) * spd;
            ball.reborn = true;
            ball.goldTimer = CCC_GOLD_DUR;
            ball.stuckTimer = 0;
            ball.stuckBaseY = ball.y;
            spawnBurst(g, rebirthX, ball.y, 8, 8, '#ffffff');
            spawnBurst(g, rebirthX, ball.y, 6, 6, '#c8a000');
            alive.push(ball);
          } else if (g.cosmicDarkAgesActive && ball.y < H + 90) {
            // Natural/bucket exit (y≈H+60). Mid-board deaths set y=H+100 and already
            // spawned a ghost at the true death point above — skip them here.
            g.cdaGhosts.push({ x: ball.x, y: Math.min(ball.y, H - 20), timer: CDA_GHOST_DUR, vx: ball.vx, vy: ball.vy });
          }
        }
        g.balls = alive;

        // All balls exited and burst finished → next phase
        if (g.balls.length === 0 && g.burstRemaining === 0) {
          if (g.orangeLeft <= 0 && (!g.boss || g.boss.hp <= 0)) {
            g.phase = 'levelclear';
            g.levelClearTimer = 95;
            setPhase('levelclear');
          } else if (g.shotsLeft <= 0) {
            g.phase = 'gameover';
            setPhase('gameover');
          } else {
            g.phase = 'aiming';
            setPhase('aiming');
            // Balls have all dropped → revive broken mud pegs before the next shot
            // (mudAnim plays the reform animation during aiming).
            for (const p of g.pegs) {
              if (p.type === 'mud' && p.mudBroken) { p.mudBroken = false; p.mudAnim = MUD_REVIVE; }
            }
          }
        }
      }

      // ── Fog reveal timer + alpha update ──────────────────────────────────
      if (g.fogActive && g.phase !== 'paused') {
        if (g.fogRevealTimer > 0) g.fogRevealTimer--;
        // Fade in during aiming (after reveal window), fade out during firing
        if (g.fogRevealTimer <= 0 && g.phase === 'aiming') {
          g.fogAlpha = Math.min(1, g.fogAlpha + 0.10); // ~10 frames to full
        } else {
          g.fogAlpha = Math.max(0, g.fogAlpha - 0.050); // ~20 frames to clear
        }
      } else {
        g.fogAlpha = 0;
      }

      // ── Cosmic Dark Ages: fade-in + afterglow decay + veil draw (after balls) ──
      // Drawn here so the veil sits on top of pegs/hazards while light-holes stay
      // aligned with the just-updated ball positions. Physics-free vision gimmick.
      if (g.cosmicDarkAgesActive && g.phase !== 'paused') {
        g.cdaAlpha = Math.min(1, g.cdaAlpha + 1 / CDA_FADE_IN);
        for (let gi = g.cdaGhosts.length - 1; gi >= 0; gi--) {
          g.cdaGhosts[gi].timer--;
          if (g.cdaGhosts[gi].timer <= 0) g.cdaGhosts.splice(gi, 1);
        }
      } else {
        g.cdaAlpha = 0;
        g.cdaGhosts = [];
      }
      if (g.cosmicDarkAgesActive && g.cdaAlpha > 0) {
        const cdaTop = Math.round(launcherY + 24);
        const veil = getCdaVeil(W, H, dpr);
        if (veil && _cdaVeil) {
          veil.clearRect(0, 0, W, H);
          // Solid dark veil below the launcher (completely still — no fog-like shimmer).
          veil.globalCompositeOperation = 'source-over';
          veil.globalAlpha = CDA_VEIL_ALPHA;
          veil.fillStyle = '#0a0c18';
          veil.fillRect(0, cdaTop, W, H - cdaTop);
          // Punch light-holes around every live ball (and any afterglow ghosts).
          // globalAlpha must be 1 here — destination-out under 0.85 would leave a residual veil.
          veil.globalCompositeOperation = 'destination-out';
          veil.globalAlpha = 1;
          const punch = (x: number, y: number, r: number, a: number) => {
            const grd = veil.createRadialGradient(x, y, r * 0.25, x, y, r);
            grd.addColorStop(0, `rgba(0,0,0,${a})`);
            grd.addColorStop(0.55, `rgba(0,0,0,${a * 0.7})`);
            grd.addColorStop(1, 'rgba(0,0,0,0)');
            veil.fillStyle = grd;
            veil.beginPath();
            veil.arc(x, y, r, 0, Math.PI * 2);
            veil.fill();
          };
          for (const ball of g.balls) {
            const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            const stretch = Math.min(12, spd * 0.6);
            const bx = ball.x - (spd > 0.1 ? (ball.vx / spd) * stretch * 0.3 : 0);
            const by = ball.y - (spd > 0.1 ? (ball.vy / spd) * stretch * 0.3 : 0);
            punch(bx, by, CDA_RADIUS + stretch * 0.15, 1);
          }
          for (const gh of g.cdaGhosts) {
            const gt = gh.timer / CDA_GHOST_DUR;
            punch(gh.x, gh.y, CDA_RADIUS * gt, gt);
          }
          veil.globalCompositeOperation = 'source-over';
          veil.globalAlpha = 1;
          ctx.globalAlpha = g.cdaAlpha;
          ctx.drawImage(_cdaVeil, 0, 0, W, H);
          ctx.globalAlpha = 1;
          // Warm first-star glow rim around each ball (on top of the veil).
          for (const ball of g.balls) {
            const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            const jitter = Math.sin(g.frame * 0.31 + ball.x * 0.07) * 1.5;
            const rimR = CDA_RADIUS * 0.55 + jitter;
            ctx.fillStyle = '#f0e0c0';
            for (let i = 0; i < 16; i++) {
              const a = (i / 16) * Math.PI * 2 + g.frame * 0.01;
              const rr = rimR + (i % 3) * 2;
              const backX = spd > 0.1 ? -(ball.vx / spd) * 4 : 0;
              const backY = spd > 0.1 ? -(ball.vy / spd) * 4 : 0;
              ctx.globalAlpha = 0.18 * g.cdaAlpha;
              ctx.fillRect(
                Math.round(ball.x + backX + Math.cos(a) * rr) - 1,
                Math.round(ball.y + backY + Math.sin(a) * rr) - 1,
                2, 2,
              );
            }
          }
          ctx.globalAlpha = 1;
        }
      }

      // ── Bucket ───────────────────────────────────────────────────────────
      if (g.phase === 'aiming' || g.phase === 'firing') {
        g.bucketX += g.bucketSpd * g.bucketDir;
        if (g.bucketX <= 0)               { g.bucketX = 0;                g.bucketDir =  1; }
        if (g.bucketX + g.bucketW >= W)   { g.bucketX = W - g.bucketW;   g.bucketDir = -1; }
      }
      const bY = H - 44;
      const bucketPulse = 0.78 + Math.sin(g.frame * 0.12) * 0.22;

      // Glow aura when recently caught a bucket ball
      if (g.bucketGlowTimer > 0) {
        g.bucketGlowTimer--;
        const t = g.bucketGlowTimer / 45;
        ctx.fillStyle = '#ffe8a0';
        ctx.globalAlpha = t * 0.16 * bucketPulse;
        ctx.fillRect(g.bucketX - 12, bY - 10, g.bucketW + 24, BUCKET_H + 20);
        ctx.fillStyle = '#f5d46a';
        ctx.globalAlpha = t * 0.28 * bucketPulse;
        ctx.fillRect(g.bucketX - 6, bY - 5, g.bucketW + 12, BUCKET_H + 10);
        ctx.fillStyle = GOLD_GLOW_COLOR;
        ctx.globalAlpha = t * 0.42 * bucketPulse;
        ctx.fillRect(g.bucketX - 2, bY - 2, g.bucketW + 4, BUCKET_H + 4);
        ctx.globalAlpha = 1;
      }

      // Core bucket (bright gold, denser dots)
      ctx.fillStyle = GOLD_GLOW_COLOR;
      for (let bx = g.bucketX; bx < g.bucketX + g.bucketW; bx += 4) {
        ctx.globalAlpha = 0.75 * bucketPulse;
        ctx.fillRect(Math.round(bx), bY, 2, 2);
        ctx.fillRect(Math.round(bx), bY + BUCKET_H, 2, 2);
      }
      for (let by = bY; by <= bY + BUCKET_H; by += 3) {
        ctx.globalAlpha = 0.75 * bucketPulse;
        ctx.fillRect(Math.round(g.bucketX),                 Math.round(by), 2, 2);
        ctx.fillRect(Math.round(g.bucketX + g.bucketW - 2), Math.round(by), 2, 2);
      }
      ctx.globalAlpha = 1;

      // ── Low-ammo danger: pulsing red edge vignette when shots run low ──────
      if ((g.phase === 'aiming' || g.phase === 'firing') && g.shotsLeft > 0 && g.shotsLeft <= 2) {
        const danger = g.shotsLeft === 1 ? 1 : 0.6;
        const pulse  = 0.45 + 0.55 * Math.abs(Math.sin(g.frame * (g.shotsLeft === 1 ? 0.16 : 0.10)));
        const peak   = (0.5 * danger * pulse).toFixed(3);
        const band   = 64;
        // top
        let gr = ctx.createLinearGradient(0, 0, 0, band);
        gr.addColorStop(0, `rgba(216,30,30,${peak})`); gr.addColorStop(1, 'rgba(216,30,30,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, band);
        // bottom
        gr = ctx.createLinearGradient(0, H, 0, H - band);
        gr.addColorStop(0, `rgba(216,30,30,${peak})`); gr.addColorStop(1, 'rgba(216,30,30,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, H - band, W, band);
        // left
        gr = ctx.createLinearGradient(0, 0, band, 0);
        gr.addColorStop(0, `rgba(216,30,30,${peak})`); gr.addColorStop(1, 'rgba(216,30,30,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, band, H);
        // right
        gr = ctx.createLinearGradient(W, 0, W - band, 0);
        gr.addColorStop(0, `rgba(216,30,30,${peak})`); gr.addColorStop(1, 'rgba(216,30,30,0)');
        ctx.fillStyle = gr; ctx.fillRect(W - band, 0, band, H);
        ctx.globalAlpha = 1;
      }

      // ── Level clear countdown → next level ────────────────────────────────
      if (g.phase === 'levelclear') {
        g.levelClearTimer--;
        if (g.levelClearTimer <= 0) {
          const sk = specialKind(g.level);
          // Clear replenishment tightens with level: <5 → +5, 5-9 → +4, 10+ → +3.
          const refill = g.level >= 10 ? 3 : g.level >= 5 ? 4 : 5;
          g.score += g.shotsLeft * 200 + (sk === 'boss' ? 3000 : sk === 'special' ? 1500 : 0);
          g.shotsLeft += refill;
          setScore(g.score);
          setShotsLeft(g.shotsLeft);
          setRefillPopup({ n: refill, key: g.frame }); // floating "+N", fades out
          initLevel(g.level + 1);
        }
      }

      // ── Bursts ────────────────────────────────────────────────────────────
      // Dead particles/bursts are compacted in place (write-index pass) instead of
      // rebuilding fresh arrays every frame — same elements, same order, no GC churn.
      let burstW = 0;
      for (const burst of g.bursts) {
        const ps = burst.particles;
        let pw = 0;
        for (const p of ps) {
          p.x  += p.vx; p.y  += p.vy;
          p.vy += 0.22; // gravity drag on particles
          p.vx *= 0.98;
          p.life--;
          if (p.life > 0) {
            const fade = Math.min(1, p.life / Math.max(1, p.maxLife * 0.5));
            ctx.fillStyle   = p.color ?? '#0f0f0d';
            ctx.globalAlpha = fade * 0.85;
            ctx.fillRect(
              Math.round(p.x - p.size * 0.5),
              Math.round(p.y - p.size * 0.5),
              p.size, p.size,
            );
            ps[pw++] = p;
          }
        }
        ps.length = pw;
        if (pw > 0) g.bursts[burstW++] = burst;
      }
      g.bursts.length = burstW;
      ctx.globalAlpha = 1;

      // ── Peg break animations ──────────────────────────────────────────────
      ctx.fillStyle = '#0f0f0d';
      let pbW = 0;
      for (const pb of g.pegBreaks) {
        const ps = pb.particles;
        let pw = 0;
        for (const p of ps) {
          p.x  += p.vx; p.y  += p.vy;
          p.vy += 0.14; // lighter gravity than burst
          p.vx *= 0.97;
          p.life--;
          if (p.life > 0) {
            const fade = Math.min(1, p.life / Math.max(1, p.maxLife * 0.55));
            ctx.globalAlpha = fade * 0.92;
            ctx.fillRect(
              Math.round(p.x - p.size * 0.5),
              Math.round(p.y - p.size * 0.5),
              p.size, p.size,
            );
            ps[pw++] = p;
          }
        }
        ps.length = pw;
        if (pw > 0) g.pegBreaks[pbW++] = pb;
      }
      g.pegBreaks.length = pbW;
      ctx.globalAlpha = 1;

      // Screen flash on bucket catch
      if (g.bucketFlashTimer > 0) {
        g.bucketFlashTimer--;
        const ft = g.bucketFlashTimer / 14;
        ctx.fillStyle = '#f5d46a';
        ctx.globalAlpha = ft * 0.28;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      } // end steps loop
      rafRef.current = requestAnimationFrame(loop);
    };

    loopFnRef.current = loop;
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [initLevel]);

  // ── Visibility change ────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => {
      if (document.hidden) cancelAnimationFrame(rafRef.current);
      else { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(loopFnRef.current); }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  // ── Resize ───────────────────────────────────────────────────────────────
  useEffect(() => {
    syncSize();
    const ro = new ResizeObserver(() => syncSize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [syncSize]);

  // ── EIP-6963 wallet detection ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const addWallet = (detail: EIP6963Wallet) => {
      if (!detail?.info?.uuid) return;
      setDetectedWallets(prev => prev.some(w => w.info.uuid === detail.info.uuid) ? prev : [...prev, detail]);
    };
    const handler = (e: Event) => addWallet((e as CustomEvent).detail as EIP6963Wallet);
    window.addEventListener('eip6963:announceProvider', handler);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    const win = window as { ethereum?: Eip1193Provider & { isRabby?: boolean; isMetaMask?: boolean; isCoinbaseWallet?: boolean; isBraveWallet?: boolean } };
    if (win.ethereum) {
      const eth  = win.ethereum;
      const name = eth.isRabby ? 'Rabby' : eth.isCoinbaseWallet ? 'Coinbase Wallet' : eth.isBraveWallet ? 'Brave Wallet' : eth.isMetaMask ? 'MetaMask' : 'Injected Wallet';
      addWallet({ info: { uuid: 'legacy', name, icon: '', rdns: 'window.ethereum' }, provider: eth });
    }
    return () => window.removeEventListener('eip6963:announceProvider', handler);
  }, []);

  // ── Farcaster context ─────────────────────────────────────────────────────
  useEffect(() => {
    import('@farcaster/miniapp-sdk').then(({ sdk }) => {
      sdk.actions.ready().catch(() => {});
      sdk.context.then(ctx => { if (ctx?.user?.fid) setInFarcaster(true); }).catch(() => {});
    }).catch(() => {});
  }, []);

  // ── Wallet connect ────────────────────────────────────────────────────────
  const handleConnectWallet   = useCallback(() => setShowWalletModal(true), []);

  const connectWithProvider = useCallback(async (wallet: 'farcaster' | EIP6963Wallet) => {
    setShowWalletModal(false);
    setWalletConnecting(true);
    try {
      let provider: Eip1193Provider;
      if (wallet === 'farcaster') {
        const { sdk } = await import('@farcaster/miniapp-sdk');
        const p = sdk.wallet.ethProvider;
        if (!p) throw new Error('no provider');
        provider = p as Eip1193Provider;
      } else {
        provider = wallet.provider;
      }
      selectedProviderRef.current = provider;
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      if (accounts[0]) setWalletAddress(accounts[0]);
    } catch (err) { console.error(err); }
    finally { setWalletConnecting(false); }
  }, []);

  // ── Record score on-chain ─────────────────────────────────────────────────
  const handleRecordScore = useCallback(async () => {
    if (txState !== 'idle' && txState !== 'error') return;
    setTxState('pending');
    try {
      const provider = selectedProviderRef.current;
      if (!provider) throw new Error('no wallet');

      // Switch to Base mainnet; add it first if missing (4902)
      try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
      } catch (switchErr) {
        const code = (switchErr as { code?: number }).code;
        if (code === 4001) throw switchErr; // user rejected
        if (code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x2105',
              chainName: 'Base',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://mainnet.base.org'],
              blockExplorerUrls: ['https://basescan.org'],
            }],
          });
        }
        // other errors (e.g. already on Base) — continue
      }

      const { createWalletClient, custom } = await import('viem');
      const { base }                       = await import('viem/chains');
      const { CONTRACT_ADDRESS, LEADERBOARD_ABI } = await import('@/lib/contract');
      const { DATA_SUFFIX }                = await import('@/lib/attribution');

      console.log('[DotShot] submitScore →', CONTRACT_ADDRESS, 'score:', G.current.score, 'level:', G.current.level);

      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider as Parameters<typeof custom>[0]),
      });
      const address = (walletAddress ?? (await walletClient.getAddresses())[0]) as `0x${string}`;
      const hash = await walletClient.writeContract({
        account: address,
        address: CONTRACT_ADDRESS,
        abi: LEADERBOARD_ABI,
        functionName: 'submitScore',
        args: [BigInt(G.current.score), BigInt(G.current.level)],
        dataSuffix: DATA_SUFFIX, // ERC-8021 builder attribution for Base Build tracking
      });
      setTxHash(hash);
      setTxState('success');
    } catch (err) { console.error('[DotShot] tx error:', err); setTxState('error'); }
  }, [txState, walletAddress]);

  // ── Share on Farcaster ────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    const g      = G.current;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const url    = appUrl ? `${appUrl}/share?score=${g.score}&level=${g.level}` : '';
    try {
      const { sdk } = await import('@farcaster/miniapp-sdk');
      await sdk.actions.composeCast({
        text: `I scored ${g.score} pts in DotShot (Level ${g.level})! Can you beat me?`,
        embeds: url ? [url] : [],
      });
    } catch { /* not in Farcaster */ }
  }, []);

  // ── Styles ────────────────────────────────────────────────────────────────
  const FONT  = `"Helvetica Neue", Arial, sans-serif`;
  const CREAM = '#ede9df';
  const INK   = '#0f0f0d';
  const MUTED = '#7a7670';

  const pillBtn = (filled: boolean): React.CSSProperties => ({
    padding: '13px 34px',
    border: `1.5px solid ${filled ? INK : 'rgba(15,15,13,0.45)'}`,
    borderRadius: 9999,
    background: filled ? INK : 'transparent',
    color: filled ? CREAM : INK,
    fontSize: 14, fontWeight: 700,
    fontFamily: FONT, letterSpacing: '0.04em',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  });

  const labelStyle: React.CSSProperties = {
    color: MUTED, fontSize: 10, fontWeight: 700,
    letterSpacing: '0.16em', fontFamily: FONT,
    textTransform: 'uppercase', marginBottom: 10,
  };

  const WalletIcon = () => (
    <svg width="20" height="20" viewBox="0 0 1000 1000" fill="none">
      <path d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z" fill="white"/>
      <path d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.444H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z" fill="white"/>
      <path d="M675.556 746.667C663.283 746.667 653.333 756.616 653.333 768.889V795.556H648.889C636.616 795.556 626.667 805.505 626.667 817.778V844.444H875.556V817.778C875.556 805.505 865.606 795.556 853.333 795.556H848.889V768.889C848.889 756.616 838.94 746.667 826.667 746.667V351.111H851.111L880 253.333H702.222V746.667H675.556Z" fill="white"/>
    </svg>
  );

  return (
    <div style={{ width: '100%', height: '100dvh', display: 'flex', justifyContent: 'center', background: '#0f0f0d' }}>
    <div
      ref={wrapRef}
      style={{
        width: '100%', maxWidth: 430, height: '100dvh',
        position: 'relative',
        background: CREAM, overflow: 'hidden',
        touchAction: 'none', userSelect: 'none',
      }}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />

      {/* ── IDLE ──────────────────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 36px 64px', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: 28, left: 36 }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>{t.miniGame}</span>
          </div>
          <button
            style={{ position: 'absolute', top: 24, right: 36, background: 'transparent', border: `1px solid rgba(15,15,13,0.22)`, borderRadius: 9999, color: MUTED, fontSize: 11, fontFamily: FONT, fontWeight: 700, cursor: 'pointer', padding: '4px 10px', WebkitTapHighlightColor: 'transparent', letterSpacing: '0.06em', pointerEvents: 'all' }}
            onPointerDown={(e) => { e.stopPropagation(); setLang(l => l === 'en' ? 'ja' : 'en'); }}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {lang === 'en' ? 'JA' : 'EN'}
          </button>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ color: INK, fontSize: 'clamp(58px, 17vw, 98px)', fontWeight: 900, lineHeight: 0.87, fontFamily: FONT, margin: 0, letterSpacing: '-0.025em' }}>
              DOT<br />SHOT
            </h1>
          </div>
          <p style={{ color: MUTED, fontSize: 15, fontFamily: FONT, lineHeight: 1.65, marginBottom: 40, maxWidth: 270 }}>
            {t.tagline1}<br />
            {t.tagline2}
          </p>
          <div style={{ pointerEvents: 'all' }}>
            <button
              style={pillBtn(true)}
              onPointerDown={(e) => { e.stopPropagation(); startGame(); }}
              onPointerUp={(e) => e.stopPropagation()}
            >
              {t.startPlaying}
            </button>
          </div>
        </div>
      )}

      {/* ── PLAYING HUD ───────────────────────────────────────────────────── */}
      {(phase === 'aiming' || phase === 'firing') && (
        <>
          <div style={{ position: 'absolute', top: 42, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ ...labelStyle, textAlign: 'center' }}>{warpWalls ? 'LOOP' : 'WALL'}</div>
            <div style={{ width: 36, height: 3, borderRadius: 2, background: warpWalls ? '#6688ff' : '#c8a000' }} />
          </div>
          <div style={{ position: 'absolute', top: 20, left: 22, pointerEvents: 'none' }}>
            <div style={labelStyle}>{t.levelLabel}</div>
            <div style={{ color: INK, fontSize: 42, fontWeight: 900, lineHeight: 1, fontFamily: FONT }}>{level}</div>
            {specialKind(level) && (
              <div style={{ marginTop: 5, display: 'inline-flex', alignSelf: 'flex-start', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', fontFamily: FONT, padding: '2px 7px', borderRadius: 9999, color: specialKind(level) === 'boss' ? '#ede9df' : '#0f0f0d', background: specialKind(level) === 'boss' ? '#c8a000' : 'rgba(15,15,13,0.10)' }}>
                {specialKind(level) === 'boss' ? t.bossLabel : t.specialLabel}
              </div>
            )}
          </div>
          <div style={{ position: 'absolute', top: 20, right: 22, textAlign: 'right', pointerEvents: 'none' }}>
            <div style={labelStyle}>{t.targetsLabel}</div>
            <div style={{ color: INK, fontSize: 42, fontWeight: 900, lineHeight: 1, fontFamily: FONT }}>{orangeLeft}</div>
          </div>
          <div style={{ position: 'absolute', bottom: 54, left: 22, pointerEvents: 'none' }}>
            <div style={labelStyle}>{t.shotsLabel}</div>
            <div style={{ color: shotsLeft > 0 && shotsLeft <= 2 ? '#d81e1e' : INK, fontSize: 34, fontWeight: 900, lineHeight: 1, fontFamily: FONT, transformOrigin: 'left center', animation: shotsLeft > 0 && shotsLeft <= 2 ? 'ammoLow 0.6s ease-in-out infinite' : 'none' }}>{shotsLeft}</div>
            {refillPopup && (
              <div
                key={refillPopup.key}
                onAnimationEnd={() => setRefillPopup(null)}
                style={{ position: 'absolute', left: 0, bottom: 48, color: '#c8a000', fontSize: 22, fontWeight: 900, fontFamily: FONT, whiteSpace: 'nowrap', animation: 'refillPop 1.5s ease-out forwards' }}
              >
                +{refillPopup.n}
              </div>
            )}
          </div>
          <div style={{ position: 'absolute', bottom: 54, right: 22, textAlign: 'right', pointerEvents: 'none' }}>
            <div style={labelStyle}>{t.scoreLabel}</div>
            <div style={{ color: INK, fontSize: 34, fontWeight: 900, lineHeight: 1, fontFamily: FONT }}>{score}</div>
          </div>
          <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'all', display: 'flex', gap: 8 }}>
            <button
              style={{ background: 'transparent', border: `1px solid rgba(15,15,13,0.22)`, borderRadius: 9999, color: MUTED, fontSize: 13, fontFamily: FONT, fontWeight: 700, cursor: 'pointer', padding: '5px 14px', WebkitTapHighlightColor: 'transparent', letterSpacing: '0.06em' }}
              onPointerDown={(e) => { e.stopPropagation(); handlePause(); }}
              onPointerUp={(e) => e.stopPropagation()}
            >
              II
            </button>
            <button
              style={{ background: speed > 1 ? INK : 'transparent', border: `1px solid rgba(15,15,13,0.22)`, borderRadius: 9999, color: speed > 1 ? '#ede9df' : MUTED, fontSize: 13, fontFamily: FONT, fontWeight: 700, cursor: 'pointer', padding: '5px 14px', WebkitTapHighlightColor: 'transparent', letterSpacing: '0.06em' }}
              onPointerDown={(e) => { e.stopPropagation(); setSpeed(s => { const n: 1|2|3 = s === 1 ? 2 : s === 2 ? 3 : 1; speedRef.current = n; return n; }); }}
              onPointerUp={(e) => e.stopPropagation()}
            >
              ×{speed}
            </button>
          </div>
        </>
      )}

      {/* ── PAUSE ─────────────────────────────────────────────────────────── */}
      {phase === 'paused' && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(237,233,223,0.93)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, zIndex: 10, pointerEvents: 'all' }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {!confirmRetire ? (
            <>
              <div style={{ ...labelStyle, marginBottom: 0 }}>{t.paused}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                <button style={{ ...pillBtn(true), minWidth: 180 }} onPointerDown={(e) => { e.stopPropagation(); handleResume(); }}>{t.resume}</button>
                <button style={{ ...pillBtn(false), minWidth: 180 }} onPointerDown={(e) => { e.stopPropagation(); setConfirmRetire(true); }}>{t.retire}</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ color: INK, fontSize: 15, fontFamily: FONT, textAlign: 'center', margin: 0, padding: '0 40px', lineHeight: 1.6 }}>
                {t.confirmRetireText}<br />
                <span style={{ color: MUTED, fontSize: 13 }}>{t.confirmRetireSub}</span>
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button style={pillBtn(true)} onPointerDown={(e) => { e.stopPropagation(); handleRetire(); }}>{t.retireConfirm}</button>
                <button style={pillBtn(false)} onPointerDown={(e) => { e.stopPropagation(); setConfirmRetire(false); }}>{t.cancel}</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── LEVEL CLEAR ───────────────────────────────────────────────────── */}
      {phase === 'levelclear' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center' }}>
            {specialKind(level) && (
              <div style={{ fontSize: 'clamp(18px, 5vw, 26px)', fontWeight: 900, fontFamily: FONT, letterSpacing: '0.18em', marginBottom: 10, color: specialKind(level) === 'boss' ? '#c8a000' : INK }}>
                {specialKind(level) === 'boss' ? t.bossLabel : t.specialLabel}
              </div>
            )}
            <div style={{ color: INK, fontSize: 'clamp(50px, 14vw, 78px)', fontWeight: 900, fontFamily: FONT, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {lang === 'ja' ? `レベル${level}` : `LEVEL ${level}`}<br />
              <span style={{ fontSize: '0.50em', letterSpacing: '0.12em', color: MUTED }}>{t.cleared}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── WALLET MODAL ──────────────────────────────────────────────────── */}
      {showWalletModal && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(237,233,223,0.88)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 24px 56px', zIndex: 20 }}
          onPointerDown={(e) => { e.stopPropagation(); setShowWalletModal(false); }}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div
            style={{ background: CREAM, border: `1.5px solid rgba(15,15,13,0.18)`, borderRadius: 20, padding: '20px 18px', display: 'flex', flexDirection: 'column' }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <div style={{ ...labelStyle, marginBottom: 16 }}>{t.selectWallet}</div>
            {inFarcaster && (
              <button
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', borderBottom: detectedWallets.length > 0 ? `1px solid rgba(15,15,13,0.1)` : 'none', padding: '12px 0', cursor: 'pointer', width: '100%', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}
                onPointerDown={(e) => { e.stopPropagation(); connectWithProvider('farcaster'); }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 9, background: '#7c65c1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <WalletIcon />
                </div>
                <div>
                  <div style={{ color: INK, fontSize: 14, fontWeight: 700, fontFamily: FONT }}>{t.fcWalletName}</div>
                  <div style={{ color: MUTED, fontSize: 11, fontFamily: FONT, marginTop: 2 }}>{t.fcWalletSub}</div>
                </div>
              </button>
            )}
            {detectedWallets.map((wallet, i) => (
              <button
                key={wallet.info.uuid}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', borderBottom: i < detectedWallets.length - 1 ? `1px solid rgba(15,15,13,0.1)` : 'none', padding: '12px 0', cursor: 'pointer', width: '100%', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}
                onPointerDown={(e) => { e.stopPropagation(); connectWithProvider(wallet); }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 9, overflow: 'hidden', flexShrink: 0, background: '#e8e4da', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {wallet.info.icon?.startsWith('data:image/')
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={wallet.info.icon} alt={wallet.info.name} width={38} height={38} style={{ display: 'block' }} />
                    : <div style={{ color: INK, fontSize: 14, fontWeight: 700 }}>{wallet.info.name[0]}</div>}
                </div>
                <div>
                  <div style={{ color: INK, fontSize: 14, fontWeight: 700, fontFamily: FONT }}>{wallet.info.name}</div>
                  <div style={{ color: MUTED, fontSize: 11, fontFamily: FONT, marginTop: 2 }}>{wallet.info.rdns}</div>
                </div>
              </button>
            ))}
            {!inFarcaster && detectedWallets.length === 0 && (
              <div style={{ color: MUTED, fontSize: 13, fontFamily: FONT, padding: '12px 0', lineHeight: 1.6 }}>
                {t.noWallets}
              </div>
            )}
            <button
              style={{ marginTop: 14, padding: '12px 0', background: 'transparent', border: `1px solid rgba(15,15,13,0.25)`, borderRadius: 9999, color: MUTED, fontSize: 13, fontFamily: FONT, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
              onPointerDown={(e) => { e.stopPropagation(); setShowWalletModal(false); }}
            >
              {t.walletCancel}
            </button>
          </div>
        </div>
      )}

      {/* ── GAME OVER ─────────────────────────────────────────────────────── */}
      {phase === 'gameover' && (
        <div
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 36px 64px', background: 'rgba(237,233,223,0.88)', pointerEvents: 'all', containerType: 'inline-size' }}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div style={{ position: 'absolute', top: 26, left: 28 }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>{retired ? t.retiredLabel : t.gameOver}</span>
          </div>
          <button
            style={{ position: 'absolute', top: 24, right: 28, background: 'transparent', border: `1px solid rgba(15,15,13,0.22)`, borderRadius: 9999, color: MUTED, fontSize: 11, fontFamily: FONT, fontWeight: 700, cursor: 'pointer', padding: '4px 10px', WebkitTapHighlightColor: 'transparent', letterSpacing: '0.06em', pointerEvents: 'all' }}
            onPointerDown={(e) => { e.stopPropagation(); setLang(l => l === 'en' ? 'ja' : 'en'); }}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {lang === 'en' ? 'JA' : 'EN'}
          </button>
          {walletAddress && (
            <div style={{ position: 'absolute', top: 22, right: 90, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: MUTED, fontSize: 10, fontFamily: FONT, letterSpacing: '0.06em' }}>
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
              <button
                style={{ background: 'transparent', border: `1px solid rgba(15,15,13,0.25)`, borderRadius: 9999, color: MUTED, fontSize: 10, fontFamily: FONT, padding: '3px 10px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                onPointerDown={(e) => { e.stopPropagation(); setWalletAddress(null); setTxState('idle'); setTxHash(null); selectedProviderRef.current = null; }}
              >
                {t.disconnect}
              </button>
            </div>
          )}
          <div style={{ marginBottom: 6, maxWidth: '100%' }}>
            <div style={labelStyle}>{t.scoreLabel}</div>
            <div style={{ color: INK, fontSize: 'clamp(56px, 22cqw, 120px)', fontWeight: 900, lineHeight: 0.86, fontFamily: FONT, letterSpacing: '-0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip' }}>
              {score}
            </div>
          </div>
          <p style={{ color: MUTED, fontSize: 15, fontFamily: FONT, marginBottom: 10 }}>
            {t.levelSummary(retired, level, orangeLeft)}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <button style={pillBtn(true)} onPointerDown={(e) => { e.stopPropagation(); startGame(); }} onPointerUp={(e) => e.stopPropagation()}>{t.playAgain}</button>
            <button style={pillBtn(false)} onPointerDown={(e) => { e.stopPropagation(); handleShare(); }}>{t.share}</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {score === 0 ? (
                <span style={{ color: MUTED, fontSize: 12, fontFamily: FONT }}>{t.scoreZero}</span>
              ) : (
                <>
                  {!walletAddress && txState === 'idle' && (
                    <button
                      style={{ ...pillBtn(false), opacity: walletConnecting ? 0.5 : 1 }}
                      onPointerDown={(e) => { e.stopPropagation(); handleConnectWallet(); }}
                    >
                      {walletConnecting ? t.connecting : t.connectWallet}
                    </button>
                  )}
                  {walletAddress && txState !== 'success' && (
                    <button
                      style={{ ...pillBtn(false), opacity: txState === 'pending' ? 0.5 : 1, pointerEvents: txState === 'pending' ? 'none' : 'auto' }}
                      onPointerDown={(e) => { e.stopPropagation(); handleRecordScore(); }}
                    >
                      {txState === 'idle' ? t.recordOnChain : txState === 'pending' ? t.recording : t.failedRetry}
                    </button>
                  )}
                </>
              )}
              {txState === 'success' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ color: MUTED, fontSize: 12, fontFamily: FONT, letterSpacing: '0.08em' }}>{t.scoreRecorded}</span>
                  {txHash && (
                    <button
                      style={{ ...pillBtn(false), fontSize: 12 }}
                      onPointerDown={async (e) => {
                        e.stopPropagation();
                        try { const { sdk } = await import('@farcaster/miniapp-sdk'); await sdk.actions.openUrl(`https://basescan.org/tx/${txHash}`); } catch { /* no-op */ }
                      }}
                    >
                      {t.viewOnBasescan}
                    </button>
                  )}
                </div>
              )}
            </div>
        </div>
      )}
    </div>
    </div>
  );
}
