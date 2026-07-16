'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X402_PRICE_CONTINUE, X402_PRICE_EXTRA, x402PriceLabel as x402PriceOf } from '@/lib/x402Prices';
import {
  RUN_SAVE_VERSION,
  clearRun,
  isBoardSizeCompatible,
  loadRun,
  saveRun,
  serializeGameState,
  type RunSnapshot,
} from '@/lib/runSave';

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
const X402_CONTINUE_MAX = 3;       // paid continues per run
const X402_EXTRA_MAX    = 10;      // paid extra shots per run
const X402_CONTINUE_SHOTS = 3;     // shots granted by continue
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
const FREEZE_RADIUS    = 95;   // ice-scatter radius when a freeze peg breaks
const FREEZE_PEG_COLOR = '#1a90d8'; // freeze peg body (readable ice blue on cream)
const FREEZE_BALL_COLOR = '#3ab0f0'; // frozen ball fill
const FREEZE_ICE_COLORS = ['#88ccff', '#b8e8ff', '#4aa8e8', '#e0f6ff', '#2a88c8'] as const;
const LIGHTNING_RANGE  = 140;  // max cascade px distance for lightning peg
const SHIELD_HP        = 2;    // hits to clear a shield peg
const MUD_SLOW         = 0.14; // mud peg: speed multiplier on hit (nearly stops the ball)
const MUD_DUR          = 90;   // frames the mud slow (min-speed suppression) lasts
const MUD_REVIVE       = 22;   // frames of the mud "reform" animation after revival
// New peg types (batch K) — all drawn from the blue pool, so they never affect the
// orange clear condition (詰み厳禁). See generateLevel peg-conversion block.
const NEUTRON_HP       = 2;    // neutron peg: hits to clear
const NEUTRON_DAMP     = 0.5;  // neutron peg: immediate per-hit speed multiplier (impact)
const NEUTRON_SLOW     = 0.38; // neutron peg: min-speed floor multiplier during the drag window
const NEUTRON_DUR      = 50;   // neutron peg: frames the heavy drag (lowered min-speed) lasts
const NEUTRON_SCORE    = 40;   // neutron peg: score on clear
const PAIR_SCORE       = 20;   // pair-production peg: score on clear (plus the blue it births)
const PAIR_SPAWN_TRIES = 12;   // pair-production: attempts to find a free spot for the new blue
const ENTANGLE_SCORE   = 10;   // quantum-entangled peg: score per peg (a pair clears for 20)
const REDSHIFT_BASE    = 45;   // redshift peg: score at level start
const REDSHIFT_MIN     = 8;    // redshift peg: floor score once fully decayed
const REDSHIFT_WINDOW  = 1800; // frames over which the redshift score decays to the floor

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
const EMR_SHOCK_DUR      = 14;   // frames the crossing-point shockwave expands
const EMR_SHOCK_MAX_R    = 28;   // shockwave max radius px
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
const CB_FADE_DUR        = 18;    // cosmic birefringence crossing marker fade duration frames
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
const CMB_ALPHA_MAX      = 0.34;  // CMB anisotropy peak dot alpha (readable warm/cool mottling)
const FX_TRAIL_DUR       = 6;     // ball force-trail feedback frames
const FX_TWIST_DUR       = 10;    // ball velocity-twist arc feedback frames
const FX_FIELD_DUR       = 12;    // ball field enter/exit tint frames
const HP_RING_R          = 40;    // hawking point ghost-ring radius px
const HP_RANGE           = 120;   // hawking point warmth-pulse radius px
const HP_FORCE           = 0.8;   // hawking point outward pulse force scale
const HP_RELEASE         = 10;    // hawking point pulse duration frames
const HP_WARN            = 30;    // hawking point pre-pulse telegraph frames
const HP_BLINK_OFF       = 2;     // hawking point full-blackout frames just before pulse
// Pop III.1 Flash (lv122+): brief early-universe ionization flash → recombination drag
const POP31_FORCE        = 0.55;  // outward flash impulse at patch core (t*t)
const POP31_RELEASE      = 8;     // ionization flash duration frames
const POP31_WARN         = 20;    // pre-flash telegraph frames
const POP31_RECOMB       = 40;    // recombination drag duration after flash
const POP31_DRAG         = 0.992; // in-patch velocity drag during recombination
const POP31_PERIOD       = 260;   // frames between flashes
const POP31_MIN_SEP      = 90;    // minimum patch center separation px
const POP31_R_MIN        = 48;    // patch radius min px
const POP31_R_MAX        = 70;    // patch radius max px
// Runaway SMBH bow shock (lv126+): moving tip with V-shaped bow push + cooling wake drag
const RBHS_SPEED         = 2.8;   // tip travel px/frame
const RBHS_BOW_LEN       = 55;    // V half-length along heading
const RBHS_BOW_HALF      = 28;    // V half-width at tip base
const RBHS_BOW_FORCE     = 0.55;  // push along heading in bow band
const RBHS_WAKE_LEN      = 160;   // wake length behind tip
const RBHS_WAKE_HALF     = 22;    // wake half-width
const RBHS_WAKE_DRAG     = 0.985; // velocity drag in wake (cooling entrainment)
const RBHS_TIP_R         = 8;     // visual tip radius
const PHANTOM_LEN        = 210;   // phantom crossing membrane length px
const PHANTOM_THICK      = 18;    // phantom membrane half-thickness (band force) px
const PHANTOM_FORCE      = 0.10;  // continuous band force magnitude
const PHANTOM_CROSS_FX   = 10;    // flash frames on wSign flip
// Alens lensing anomaly field (lv133+): board-wide micro velocity twist
const ALENS_BASE_AMP     = 0.004; // base rotation amplitude rad
const ALENS_AMP_PER_LV   = 0.0003; // amplitude growth per level over 133
const ALENS_AMP_MAX      = 0.012; // hard cap on rotation amplitude
const ALENS_FX_FLOOR     = 4;     // keep fxTwist visible while field applies
// Big Ring uLSS (lv136+): large hollow ring with tangential-only band flow
const BIGRING_R          = 130;   // big ring nominal radius px
const BIGRING_HALF_W     = 18;    // big ring force-band half-width px
const BIGRING_FORCE      = 0.22;  // tangential force scale in band (t*t)
const BIGRING_BREATHE    = 2;     // visual radius breathe amplitude px
const BIGRING_BREATHE_K  = 0.002; // visual breathe angular frequency
// Patchy kSZ kick (lv139+): magnetar-style ellipse patches with fixed-axis wind impulses
const KSZ_KICK           = 0.55;  // fixed-axis velocity kick during release
const KSZ_RELEASE        = 6;     // kick duration frames
const KSZ_WARN           = 24;    // telegraph frames before kick
const KSZ_PERIOD_MIN     = 200;   // min frames between kicks
const KSZ_PERIOD_MAX     = 280;   // max frames between kicks
const KSZ_RX_MIN         = 50;    // ellipse semi-axis min px
const KSZ_RX_MAX         = 75;    // ellipse semi-axis max px
const KSZ_MIN_SEP        = 100;   // minimum patch center separation px
// Subsolar PBH echo merger (lv142+): two micro-pulls approach, then a brief mass-deficit
// echo nulls gravity near the merge before the pair recondenses elsewhere.
const SPBH_RANGE         = 55;    // weak pull radius per component px
const SPBH_FORCE         = 0.28;  // weak radial pull scale (t*t)
const SPBH_ECHO_DUR      = 10;    // gravity-null echo frames
const SPBH_ECHO_RANGE    = 90;    // echo null-gravity radius from midpoint px
const SPBH_DORMANT       = 120;   // frames before recondensation
const SPBH_APPROACH      = 0.18;  // approach speed px/frame toward partner
const SPBH_MERGE_DIST    = 16;    // start echo when components closer than this
const SPBH_PAIR_SEP0     = 70;    // initial separation px
// Quintom-B breathing gravity (lv146+): board-wide gravity scale oscillates slowly
// (DESI dynamical DE w0/wa motif). Exclusive with bigRip / phantom / DE patches.
const QUINTOM_K          = 0.003; // extremely slow breathe frequency
const QUINTOM_AMP        = 0.12;  // gravity scale = 1 + AMP*sin → ~0.88..1.12
// Black Hole Star cocoon (lv150+): JWST LRD "BH★" dense-gas photosphere.
// Shell drag + periodic tear pulse. Exclusive with littleRedDots.
const BHS_CORE_R         = 12;    // visual core radius px
const BHS_SHELL_IN       = 28;    // drag shell inner radius
const BHS_SHELL_OUT      = 48;    // drag shell outer radius
const BHS_DRAG           = 0.985; // per-frame speed mul inside shell
const BHS_TEAR_R         = 70;    // tear pulse range
const BHS_TEAR_FORCE     = 0.45;  // outward tear force scale
const BHS_TEAR_DUR       = 8;     // tear duration frames
const BHS_PERIOD         = 280;   // frames between tears
// Dual-H0 seam (lv153+): board split by a tilted seam into heavy/light gravity bands.
// Crossing the seam applies a one-shot speed-preserving twist. Exclusive with alens / gwBackground.
const DH0_HEAVY          = 1.10;  // gravity mul on the "late-universe" side
const DH0_LIGHT          = 0.90;  // gravity mul on the "CMB-ladder" side
const DH0_TWIST          = 0.08;  // rad of velocity rotation on seam cross
// Hellings-Downs correlation hum (lv156+): pair-angle-dependent speed-preserving twist.
// Exclusive with gwBackground / alens / gravWaves.
const HD_BASE_AMP        = 0.002; // base rotation amplitude rad
const HD_AMP_PER_LV      = 0.00025;
const HD_AMP_MAX         = 0.006;
const HD_FX_FLOOR        = 4;     // keep fxTwist visible while hum applies
// SIDM final-parsec spike (lv159+): dual fixed cores + inter-core tangential friction.
// Exclusive with chirpBinary / bulletClusters. Visual approach only (physics fixed).
const SIDM_SEP           = 92;    // fixed physical core separation px
const SIDM_BAND_HALF     = 26;    // half-width of inter-core friction band
const SIDM_TANG_FORCE    = 0.20;  // tangential friction scale (t*t)
const SIDM_CORE_R        = 40;    // weak inward pull radius per core
const SIDM_CORE_PULL     = 0.15;  // weak inward pull scale (t*t)
// Neutrino mass null band (lv162+): DESI vs lab Σmν tension — gravity mass term fades in-band.
// Exclusive with Quintom / dualH0 (gravity-mod family).
const NUNULL_HALF        = 22;    // band half-width px
const NUNULL_LEN         = 220;   // band length px
const NUNULL_GRAV        = 0.55;  // gravity mul inside band
const NUNULL_DRAG        = 0.992; // mild velocity drag inside band
// Two-component DM segregation (lv165+): heavy inward core + light outward shell.
// Exclusive with sidmSpike / darkHalos / primordialBHs.
const TCDM_INNER         = 36;    // heavy-component inward shell radius
const TCDM_OUTER         = 70;    // light-component outward shell outer radius
const TCDM_IN_FORCE      = 0.22;  // inward pull scale (t*t)
const TCDM_OUT_FORCE     = 0.18;  // outward push scale (t*t)
// Free-streaming softening (lv168+): erase high-frequency velocity jitter inside ellipse.
// Exclusive with silkDampingClouds / quantumFoams.
const FSSOFT_RX          = 95;
const FSSOFT_RY          = 70;
const FSSOFT_BLEND       = 0.08;  // mix toward previous-frame velocity
// Overmassive mimic core (lv171+): large visual cocoon, weak true pull; brief reveal burst.
// Exclusive with bhStarCocoons / microBHs.
const OMM_VIS_R          = 42;    // visual cocoon radius
const OMM_RANGE          = 55;    // force range
const OMM_FORCE_WEAK     = 0.16;  // everyday weak pull (t*t)
const OMM_FORCE_BURST    = 0.55;  // reveal-burst pull (t*t)
const OMM_BURST_DUR      = 8;     // burst frames
const OMM_PERIOD         = 220;   // frames between bursts
// FRB microlens IMBH (lv174+): thin caustic arc kick + twist on first cross.
// Exclusive with axionMicrolenses / gravitationalCaustics.
const FRBML_R            = 38;    // caustic arc radius px
const FRBML_HALF         = 8;     // band half-width px
const FRBML_SPAN         = 1.1;   // arc central angle rad
const FRBML_KICK         = 0.35;  // along-heading speed kick
const FRBML_TWIST        = 0.12;  // velocity rotation rad
const FRBML_FLASH        = 6;     // dual-ghost flash frames
// Primordial B-field baryon clumps (lv177+): weak mutual aggregation + outer micro-repel.
// Exclusive with cmbAnisotropy / pop31Flash.
const PMF_RANGE          = 50;    // clump aggregation range
const PMF_FORCE          = 0.12;  // toward midpoint (t*t)
const PMF_OUT_IN         = 50;    // outer-band start
const PMF_OUT_OUT        = 70;    // outer-band end
const PMF_OUT_FORCE      = 0.08;  // mild outward (t*t)
// IDE energy siphon band (lv182+): dwell raises gravity, fades outward micro-push.
// Exclusive with Quintom / nuNull / dualH0.
const IDESIP_HALF        = 24;
const IDESIP_LEN         = 220;
const IDESIP_GRAV_AMP    = 0.10;  // max gravity mul boost from dwell
const IDESIP_PUSH        = 0.08;  // outward micro-force scale (fades with dwell)
const IDESIP_U_RISE      = 0.012; // dwell rise per frame in band
const IDESIP_U_FALL      = 0.020; // dwell fall per frame outside
// Vacuum decay leak (lv188+): periodic weak inward pull, then recharge. Exclusive with vacuums / bigRip.
const VACLEAK_R          = 90;
const VACLEAK_PULL       = 0.20;  // peak inward force scale
const VACLEAK_T          = 240;   // active sin^2 window frames
const VACLEAK_REST       = 40;    // powerless recharge frames after peak window
// Gravity echo delay (lv191+): delayed speed-preserving micro-twist from a fixed epicenter.
// Exclusive with hdHum / alens / gravWaves / gwBackground.
const GRAVECHO_DELAY     = 90;    // frames of ring-buffer delay
const GRAVECHO_RANGE     = 140;   // echo influence radius
const GRAVECHO_AMP       = 0.004; // max Δθ scale * echo sample
const GRAVECHO_SENSE     = 80;    // radius used to sample "source perturbation"
// Momentum-only dark coupling (lv185+): pair-wise tangential velocity align. Exclusive with hdHum / alens / gwb.
const MOMCOUP_R          = 120;
const MOMCOUP_BLEND      = 0.985; // retain fraction of tangential offset from pair mean
// Boson star soft caustic (lv194+): hollow lens; thin rim folds heading once. Exclusive with frbML / axionML / caustics.
const BOSON_R            = 48;
const BOSON_HALF         = 6;     // rim half-width px
const BOSON_FOLD         = 0.14;  // heading fold rad (speed-preserving)
const BOSON_GHOST        = 8;     // centroid ghost flash frames
// Intrinsic alignment contaminant (lv197+): fake shear — align toward fixed axis. Exclusive with alens / shear / hdHum.
const IACONT_RX          = 110;
const IACONT_RY          = 72;
const IACONT_ROT         = 0.010; // Δθ = ROT * sin(2α)
// Sign-switching IDE seam (lv202+): weak pull/push reverses across a tilted seam.
// Exclusive with ideSiphon / Quintom / nuNull / dualH0.
const SIGNIDE_LEN        = 240;
const SIGNIDE_HALF       = 18;    // visual half-width of stitch
const SIGNIDE_RANGE      = 90;    // force falloff range from seam line
const SIGNIDE_FORCE      = 0.12;  // peak force scale (t*t)
const SIGNIDE_PERIOD     = 220;   // timer-mode flip period
const PHBELT_HALF        = 10;    // phantom crossing belt half-width
const PHBELT_LO          = 0.90;  // gravity scale on one side of belt
const PHBELT_HI          = 1.10;  // gravity scale on the other side
const MBIAS_RX           = 105;
const MBIAS_RY           = 68;
const MBIAS_PERIOD       = 6;     // apply speed scale every N frames
const MBIAS_M            = 0.03;  // |m| multiplicative bias
const VARCOUP_BASE       = 0.04;  // mean |coupling| amplitude
const VARCOUP_K          = 0.008; // sin(frame*k) drift rate
const PHOTOZ_LEN         = 160;
const PHOTOZ_HALF        = 5;     // OBB half-thickness
const PHOTOZ_SHIFT       = 36;    // catastrophic depth jump px
const PHOTOZ_RATE        = 0.20;  // catastrophic outlier probability
const BLUEHUM_AMP        = 0.0035; // peak twist amplitude (speed-preserving)
const BLUEHUM_W0         = 0.04;   // base angular frequency
const BLUEHUM_W_SLOPE    = 0.05;   // extra ω from depth (y/H)
const S8SEAM_HEAVY       = 1.06;  // DES-like structure-growth side
const S8SEAM_LIGHT       = 0.94;  // KiDS-like structure-growth side
const S8SEAM_TWIST       = 0.08;  // one-shot cross twist (rad)
const ISOBIRE_BETA       = 0.0025; // isotropic handed micro-twist per frame


const CDA_VEIL_ALPHA     = 1.0;   // cosmic dark ages: fully opaque black (nothing shows through)
const CDA_FADE_IN        = 30;    // cosmic dark ages veil fade-in frames at level start
const CDA_GHOST_DUR      = 20;    // cosmic dark ages afterglow duration when a ball exits
const CDA_AIM_COLOR      = '#e8e4dc'; // aim/trajectory color on the black veil (readable cream)
const CDA_LIGHT_BALL_R   = 78;    // soft light radius around live balls
const CDA_LIGHT_LAUNCH_R = 95;    // soft light radius around the launcher
const CDA_LIGHT_HIT_R    = 72;    // soft light radius around hit pegs / hazards
const CDA_LIGHT_HIT_DUR  = 180;   // frames a hit-reveal light lingers
const CDA_LIGHT_MERGE    = 28;    // merge new reveal into nearby existing light (px)
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
const CSHEAR_RX          = 108;   // cosmic shear field ellipse long radius px
const CSHEAR_RY          = 76;    // cosmic shear field ellipse short radius px
const CSHEAR_ROT         = 0.012; // cosmic shear maximum speed-preserving rotation per frame
const CSHEAR_DOTS        = 22;    // sparse weak-lensing galaxy glyphs in the field
const CLS_ARM_LEN        = 70;    // collisionless shock V-arm length px
const CLS_ARM_SPREAD     = 0.55;  // collisionless shock V half-angle rad
const CLS_HALF           = 5;     // collisionless shock arm hit half-width px
const CLS_VN_MULT        = 1.25;  // collisionless shock normal boost multiplier
const CLS_VN_BIAS        = 1.0;   // collisionless shock minimum forward normal impulse
const CLS_SPEED          = 5.5;   // collisionless shock traverse speed px/frame
const CLS_WARN           = 36;    // collisionless shock entry telegraph frames
const CLS_RESPAWN_MIN    = 180;   // collisionless shock off-screen respawn min frames
const CLS_RESPAWN_MAX    = 260;   // collisionless shock off-screen respawn max frames
const SILK_RX            = 100;   // silk damping cloud ellipse long radius px
const SILK_RY            = 70;    // silk damping cloud ellipse short radius px
const SILK_ACROSS        = 0.975; // silk damping per-frame short-axis velocity multiplier
const SILK_MIN_SPD       = BALL_SPEED * 0.38; // silk damping minimum speed floor
const SILK_DOTS          = 28;    // silk cloud dot count
const SILK_DRIFT         = 0.25;  // silk dot along-axis drift px/frame
const PDG_LEN            = 190;   // planck diffraction grating OBB length px
const PDG_THICK          = 70;    // planck diffraction grating OBB thickness px
const PDG_FLASH          = 12;    // planck diffraction hit flash frames
const PDG_ORDER_DEG      = [-60, -30, 0, 30, 60]; // diffraction orders deg
const VC_R               = 115;   // vacuum cherenkov domain radius px
const VC_THRESH          = BALL_SPEED * 1.10; // speed threshold to trigger cherenkov braking
const VC_INTERVAL        = 12;    // frames between cherenkov emission events
const VC_SCALE           = 0.92;  // per-event speed multiplier
const VC_RECOIL          = 0.055; // alternating recoil rotation rad relative to priority axis
const VC_MIN_SPD         = BALL_SPEED * 0.85; // cherenkov braking speed floor
const VC_BURST_DUR       = 6;     // cherenkov cone flash frames
const CTC_OUTER_R        = 92;    // closed timelike curve outer ring radius px
const CTC_INNER_R        = 54;    // closed timelike curve inner ring radius px
const CTC_GAP_FRAC       = 0.20;  // fraction of ring missing (gap arc)
const CTC_WAIT           = 48;    // frames before timelike rewind fires
const CTC_PUSH           = 6;     // px push-out along recorded velocity on rewind
const CTC_WARP_DUR       = 6;     // rewind dot-stream animation frames
const CAUSTIC_HALFW      = 5;     // gravitational caustic fold-line half-width px
const CAUSTIC_AMP        = 1.35;  // gravitational caustic normal-component boost
const CAUSTIC_FLASH      = 6;     // gravitational caustic hit flash frames
const CAUSTIC_DOTS       = 16;    // gravitational caustic fold-line gold dots
const CAUSTIC_PTS        = 24;    // gravitational caustic polyline sample count
const REION_PERIOD       = 300;   // reionization front cycle frames
const REION_BAND         = 36;    // reionization front band thickness px
const REION_DRAG_X       = 0.97;  // reionization in-band horizontal drag
const REION_PUSH_Y       = 0.06;  // reionization in-band downward push
const REION_MIN_SPD      = BALL_SPEED * 0.40; // reionization speed floor
const REION_WARN         = 30;    // reionization telegraph frames
const REION_SWEEP_SPD    = 4;     // reionization front descent px/frame
const NEUT_RX            = 100;   // neutrino oscillation ellipse long radius px
const NEUT_RY            = 72;    // neutrino oscillation ellipse short radius px
const NEUT_AMP           = 0.065; // neutrino flavor oscillation rotation amplitude rad
const NEUT_FREQ          = 0.09;  // neutrino oscillation temporal frequency
const NEUT_PHASE         = 1.4;   // neutrino oscillation per-ball phase step
const GWM_PERIOD         = 480;   // gravitational wave memory cycle frames
const GWM_BAND           = 16;    // gwm wavefront band half-width px
const GWM_R0             = 50;    // gwm ring start radius px
const GWM_R1             = 240;   // gwm ring end radius px
const GWM_SPEED          = 0.40;  // gwm expansion px/frame
const GWM_KICK           = 0.10;  // gwm speed-preserving kick rad
const GWM_BIAS           = 0.004; // gwm residual bias force
const GWM_MEM_DUR        = 90;    // gwm memory residue frames
const ECROSS_R           = 58;    // einstein cross image radius from hub px
const ECROSS_PULL        = 0.14;  // einstein cross per-image pull force
const ECROSS_RANGE       = 85;    // einstein cross pull range px
const ZENO_RX            = 108;   // quantum zeno observation ellipse long radius px
const ZENO_RY            = 76;    // quantum zeno observation ellipse short radius px
const ZENO_SCALE         = 0.93;  // quantum zeno observed-frame velocity scale
const ZENO_DUTY_FREQ     = 0.16;  // quantum zeno observation duty sin frequency
const CHIRP_PERIOD       = 180;   // trans-solar chirp inspiral period frames
const CHIRP_AMP          = 0.08;  // chirp velocity amplitude modulation (±8%)
const CHIRP_HARM         = 8;     // chirp harmonic multiplier on phase
const CHIRP_ORB_R        = 38;    // chirp binary initial orbital radius px
const CHIRP_ORB_SPEED    = 0.045; // chirp orbital angular speed base
const FDM_RX             = 95;    // fuzzy dark matter soliton ellipse long radius px
const FDM_RY             = 68;    // fuzzy dark matter soliton ellipse short radius px
const FDM_BEAT_AMP       = 0.12;  // FDM tangential beat force amplitude
const FDM_BEAT_FREQ      = 0.07;  // FDM beat temporal frequency
const FDM_K              = 2.4;   // FDM angular wave number on theta
const AXION_RANGE        = 75;    // axion microlens tangential force range px
const AXION_FORCE        = 0.11;  // axion microlens tangential force scale
const AXION_MIN_DIST     = 140;   // axion microlens minimum spacing px
const AXION_SHIMMER_PERIOD = 160; // axion microlens shimmer cycle frames
const AXION_SHIMMER_DUR  = 4;     // axion microlens shimmer visible duration frames
const HORIZON_BAND       = 28;    // cosmological horizon entropy edge band width px
const HORIZON_PUSH       = 0.09;  // cosmological horizon inward push force scale
const HOLO_LEN           = 200;   // holographic RG sheet length px
const HOLO_THICK         = 85;    // holographic RG sheet thickness px
const HOLO_SCALE_STEP    = 0.04;  // per-rgLayer velocity scale step
const HOLO_FLASH         = 10;    // holographic RG crossing flash frames
const ENTROPIC_H0        = 0.0015; // mass-horizon entropic drag initial H
const ENTROPIC_H_RAMP    = 0.000002; // entropic H per-frame ramp
const ENTROPIC_H_MAX     = 0.004; // entropic H cap
const ENTROPIC_FLOOR     = 0.92;  // entropic velocity scale floor
const ENTROPIC_SPOKES    = 24;    // entropic visual radial spoke count

// ── Boss (re-armor boss, every 10th level) ──────────────────────────────────
const BOSS_R           = 30;   // core hit radius
const BOSS_HP_BASE     = 12;   // core HP at the first boss (level 10)
const BOSS_ARMOR_COUNT = 8;    // shield pegs ringing the core
const BOSS_HIT_COOL    = 6;    // frames between core damage ticks
const BOSS_HP_SOFTCAP  = 28;   // late-game core HP ceiling (tier 9+); motion carries late difficulty

/** Core HP by boss tier: gentle early growth, then soft-cap (complex motion replaces HP bloat). */
function bossCoreHp(tier: number): number {
  const t = Math.max(1, tier);
  if (t <= 5) return BOSS_HP_BASE + (t - 1) * 3; // 12,15,18,21,24
  return Math.min(BOSS_HP_SOFTCAP, 24 + (t - 5)); // 25,26,27,28…
}

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

/** Revive WeakSet/WeakMap fields that JSON cannot carry (aiming checkpoint has no balls). */
function reviveHazardWeakFields(g: GameState) {
  const withPassing = [
    g.collisionlessShocks,
    g.gravitationalCaustics,
    g.gravWaveMemories,
    g.quantumBarriers,
    g.cosmicStrings,
    g.einsteinMirrorRings,
    g.frbMicrolenses,
    g.bosonCaustics,
    g.photoZGates,
  ] as { passingBalls?: WeakSet<Ball> }[][];
  for (const arr of withPassing) {
    for (const h of arr) h.passingBalls = new WeakSet();
  }
  if (g.dualH0Seam) g.dualH0Seam.lastSide = new WeakMap();
  for (const s of g.s8Seams) s.lastSide = new WeakMap();
  for (const sr of g.superradiances) sr.prevBallAng = new WeakMap();
  for (const bu of g.bubbleUniverses) bu.insideBalls = new WeakSet();
  g.ctcStates = new WeakMap();
  g.ctcUsed = new WeakSet();
  g.holoSides = new WeakMap();
  g.gwMemories = new WeakMap();
}

/** Apply a serialized aiming snapshot onto the live GameState (always restores to aiming). */
function hydrateGameState(g: GameState, data: Record<string, unknown>) {
  const skip = new Set([
    'rng', 'chainGroups', 'ctcStates', 'ctcUsed', 'holoSides', 'gwMemories',
    'balls', 'bursts', 'pegBreaks', 'bgDots', 'firePulse', 'wrongPeg',
    'lightningArcs', 'cdaGhosts', 'cdaLights',
  ]);
  for (const key of Object.keys(data)) {
    if (skip.has(key)) continue;
    (g as unknown as Record<string, unknown>)[key] = data[key];
  }

  g.phase = 'aiming';
  g.prePausePhase = 'aiming';
  g.balls = [];
  g.burstRemaining = 0;
  g.burstTimer = 0;
  g.bursts = [];
  g.pegBreaks = [];
  g.lightningArcs = [];
  g.cdaGhosts = [];
  g.cdaLights = [];
  g.firePulse = null;
  g.wrongPeg = null;
  g.wrongFrames = 0;
  g.levelClearTimer = 0;
  g.rng = makeRng((Date.now() ^ (Math.random() * 0x100000000)) >>> 0);
  g.bgDots = initBgDots(g.W, g.H);

  const cg = new Map<number, Peg[]>();
  for (const p of g.pegs) {
    p.entanglePartner = null;
    if (p.chainId === undefined) continue;
    let arr = cg.get(p.chainId);
    if (!arr) { arr = []; cg.set(p.chainId, arr); }
    arr.push(p);
  }
  g.chainGroups = cg;

  const byEnt = new Map<number, Peg[]>();
  for (const p of g.pegs) {
    if (p.entangleId === undefined) continue;
    let arr = byEnt.get(p.entangleId);
    if (!arr) { arr = []; byEnt.set(p.entangleId, arr); }
    arr.push(p);
  }
  for (const pair of byEnt.values()) {
    if (pair.length >= 2) {
      pair[0].entanglePartner = pair[1];
      pair[1].entanglePartner = pair[0];
    }
  }

  reviveHazardWeakFields(g);

  for (const cloud of g.fogClouds) {
    delete cloud.sprite;
    delete cloud.spriteDpr;
    delete cloud.sox;
    delete cloud.soy;
    delete cloud.sw;
    delete cloud.sh;
  }
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
interface BreakP  { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color?: string }
interface PegBreak { particles: BreakP[] }
interface TrajPt  { x: number; y: number }
interface GravZone { x: number; y: number; w: number; h: number; flashTimer: number; pulsing?: boolean }
// Comet variants (draw + plain-physics only): orbitPhase set = one nucleus of a braided
// binary pair (lv45+); returns = a red comet that comes back once, one lane lower (lv50+).
interface Comet { x: number; y: number; vx: number; vy: number; r: number; hitCool: number; respawnTimer: number; warnFromLeft: boolean; warnY: number; vanish: boolean; hitFlash: number; hitX: number; hitY: number; orbitPhase?: number; returns?: boolean; returned?: boolean }
interface Lens  { x: number; y: number; r: number; dir: 1 | -1; strength: number }
// Pulsar (lv24+): fixed neutron star whose twin radiation beams sweep like a lighthouse.
// beams = 3 (lv54+ variant): three ONE-WAY beams at 120° instead of the two-way axis.
interface Pulsar { x: number; y: number; angle: number; rotSpeed: number; beamLen: number; beams?: number }
// Gravitational wave (lv27+): periodic ripple ring expanding from a distant merger.
// radius = -1 while dormant (timer counts down to the next wave).
interface GravWave { ex: number; ey: number; radius: number; timer: number; period: number; dir: 1 | -1 }
// Vacuum decay bubble (lv29+): slowly expanding true-vacuum sphere; gravity flips inside.
interface VacuumBubble { x: number; y: number; r: number; rMax: number; grow: number; respawnTimer: number; popFlash: number }
// White hole (lv23+): the time-reverse of a black hole — a pure radial repulsion, no absorption.
interface WhiteHole { x: number; y: number; strength: number }
// Magnetar (lv31+): neutron star that periodically flares, shoving every nearby ball outward.
// timer counts down to the next flare; releaseTimer > 0 means a flare is currently firing.
// cx0/cy0 set (lv63+ variant): the star drifts on the rogue-BH Lissajous path around them.
interface Magnetar { x: number; y: number; period: number; timer: number; releaseTimer: number; cx0?: number; cy0?: number }
// Rogue planet (lv32+): a starless world drifting across the field — a moving gravity well
// with a solid bounce body. It never stops, so its pull can never form a stable trap.
interface RoguePlanet { x: number; y: number; vx: number; vy: number; r: number; hitCool: number; ringTilt: number }
// Quasar jet (lv33+): a fixed plasma column that accelerates balls along its axis. A small
// sideways spray guarantees balls are ejected out the sides, so an up-jet can't hold a ball.
interface QuasarJet { bx: number; y0: number; y1: number; dir: 1 | -1; accel: number }
// Evaporating micro black hole (lv34+): a tiny BH that pulls (weakening as it shrinks), then
// evaporates in a repulsion burst and re-forms at another spot. No absorption → no trap.
interface MicroBH { x: number; y: number; life: number; maxLife: number; evap: number; dormant: number; spots: { x: number; y: number }[]; spotIdx: number }
// Dark matter halo (lv48+): a nearly invisible attraction source. Only a faint periodic
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
// Tachyon stream (lv88+): a fixed diagonal band that accelerates any ball inside it along
// the band's direction (clamped to BALL_SPEED*2). Fully passable — no perpendicular bound.
interface TachyonStream { x: number; y: number; angle: number; halfWidth: number }
// Cosmic void (lv42+): a near-empty elliptical patch of low gravity + faint drag. Gravity
// is only halved (never zero), so a ball always sinks out eventually.
interface CosmicVoid { x: number; y: number; rx: number; ry: number }
// Cosmic shear field (lv62+): weak lensing aligns velocity directions with a fixed large-
// scale-structure axis. The centre is only an ellipse origin for membership; it exerts no
// radial pull. Rotation preserves speed exactly, so gravity always carries the ball back out.
interface CosmicShearDot { u: number; v: number; size: number; phase: number; warm: boolean }
interface CosmicShear { x: number; y: number; rx: number; ry: number; axis: number; dots: CosmicShearDot[] }
// Collisionless shock (lv67+): a thin V-shaped plasma front that sweeps horizontally.
// Crossing an arm refracts the ball forward (tangent kept, normal boosted) without bouncing.
// passingBalls locks one crossing per arm approach until the ball clears the band.
interface CollisionlessShock {
  x: number; y: number; vx: number; vy: number;
  armSpread: number; armLen: number;
  respawnTimer: number; warnFromLeft: boolean; warnY: number;
  hitFlash: number; hitX: number; hitY: number;
  passingBalls: WeakSet<Ball>;
}
// Silk damping cloud (lv72+): an elliptical patch that damps only the short-axis velocity
// component each frame (photon diffusion smoothing small-scale wiggles). Long-axis speed
// and gravity are untouched; a speed floor prevents stuck.
interface SilkDot { u: number; v: number; size: number; warm: boolean; phase: number }
interface SilkDampingCloud { x: number; y: number; rx: number; ry: number; axis: number; dots: SilkDot[] }
// Planck diffraction grating (lv82+): pass-through OBB that quantizes exit velocity to one
// of five discrete diffraction orders on far-side crossing (speed preserved).
interface PlanckDiffractionGrating { x: number; y: number; angle: number; hitFlash: number; hitX: number; hitY: number; hitOrder: number }
interface VacuumCherenkovDomain { x: number; y: number; axis: number; burstTimer: number; burstX: number; burstY: number; burstVx: number; burstVy: number; burstFlip: number }
interface ClosedTimelikeCurve { x: number; y: number; gapAngle: number; warpLeft: number; warpFromX: number; warpFromY: number; warpToX: number; warpToY: number }
interface CtcState { snapX: number; snapY: number; snapVx: number; snapVy: number; waitLeft: number; anchorLeft: number }
// Gravitational lensing caustic (lv65+): a static fold-line polyline. Crossing amplifies the
// bright-side normal velocity once (tangent kept). passingBalls locks one fire per approach.
interface GravitationalCaustic {
  pts: { x: number; y: number }[];
  brightSide: 1 | -1;
  hitFlash: number; hitX: number; hitY: number;
  passingBalls: WeakSet<Ball>;
}
// Neutrino flavor oscillation (lv78+): elliptical patch that applies a speed-preserving
// flavor-mixing rotation each frame (sin-phased, mean-zero).
interface NeutrinoOscillation { x: number; y: number; rx: number; ry: number; axis: number }
// Gravitational wave memory (lv85+): slow expanding ring kick + WeakMap residual bias.
// Mutually exclusive with classic gravWaves on the same level.
interface GravWaveMemory {
  ex: number; ey: number; radius: number; timer: number; period: number;
  passingBalls: WeakSet<Ball>;
}
interface GwMemoryResidue { remain: number; bx: number; by: number }
// Einstein cross (lv94+): hub + 4 lensed images applying weak vector-summed pulls.
interface EinsteinCross { cx: number; cy: number; hubAngle: number; images: { x: number; y: number }[] }
// Quantum Zeno observation sector (lv98+): during observation duty windows, in-ellipse
// velocity is scaled (evolution suppressed). Exclusive with The Nothing.
interface QuantumZenoSector { x: number; y: number; rx: number; ry: number; axis: number }
// Trans-solar chirp binary (lv100+): inspiraling pair whose chirp phase modulates every
// ball's speed magnitude (±8%, direction preserved). Board-wide continuous force.
interface TransSolarChirp { cx: number; cy: number; timer: number; period: number; phaseOffset: number; mergeFlash: number }
// Fuzzy dark matter soliton (lv104+): elliptical core with tangential interference beat
// (wave-optics edge tell). Speed nearly preserved; radial force is zero.
interface FuzzySoliton { x: number; y: number; rx: number; ry: number; axis: number }
// Axion star microlens cluster (lv108+): nearly invisible points applying tangential sin
// interference (Tier 4 shimmer tell). Exclusive radial pull is intentionally absent.
interface AxionMicrolens { x: number; y: number; phase: number }
// Holographic RG sheet (lv116+): OBB layer crossings change Ball.rgLayer; velocity is scaled
// by (1 - rgLayer * HOLO_SCALE_STEP) each frame. Exit resets layer.
interface HolographicRGSheet { x: number; y: number; angle: number; hitFlash: number; hitX: number; hitY: number; hitAngle: number }
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
// Quantum tunneling barrier (lv84+): an OBB that rolls a fresh 50/50 on first contact —
// reflect (bumper-style) or pass clean through. passingBalls locks the outcome per ball
// until it fully leaves the zone, so it can't re-roll mid-overlap.
interface QuantumBarrier { x: number; y: number; angle: number; reflectFlash: number; passingBalls: WeakSet<Ball> }
// Time dilation field (lv52+): a static circular field. Crossing the boundary halves the
// ball's speed (and doubles it back on exit); the per-ball `dilated` flag (on Ball) detects
// the transition so the impulsive speed change fires exactly once per crossing.
interface TimeDilation { x: number; y: number }
// Cosmic string (lv86+): an extremely thin (1px) relic line from an early-universe phase
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
// Hypervelocity star (lv66+): a comet-like traveler that crosses and exits — reusing the
// comet's warn/traverse/respawn state machine — but with no solid body: it never bounces off
// a ball. Instead, a trailing gravitational wake drags any ball caught in it toward the
// star's direction of travel. The wake always exits the screen together with the star, so it
// can never linger indefinitely (its horizontal direction never reverses, guaranteeing exit).
interface HyperStar { x: number; y: number; vx: number; vy: number; respawnTimer: number; warnFromLeft: boolean; warnY: number }
// Bullet Cluster (lv64+): Zone B's first gimmick — a horizontally-traveling pair. An
// invisible dark-matter blob (continuous radial pull, never collides) leads BC_DM_LAG px
// AHEAD of a visible, hot gas blob (solid-bounce collision, no pull) that trails behind —
// mirroring the real Bullet Cluster, where dark matter passed through the collision
// unimpeded while the gas clouds collided and lagged. Only the gas blob's own state (x/vx/
// warnY as its fixed travel Y) is tracked; the DM blob's position is derived each frame as an
// offset ahead of the gas blob along the direction of travel, so a ball's trajectory bends in
// "empty space" first, then the visible blob's bounce arrives moments later. Purely
// horizontal (no vertical bounce) — reuses the HVS warn/traverse/respawn state machine.
interface BulletCluster { x: number; vx: number; hitCool: number; hitFlash: number; hitX: number; hitY: number; respawnTimer: number; warnFromLeft: boolean; warnY: number }
// Baryon Acoustic Oscillation (lv63+): three static concentric rings (the frozen sound waves
// of the early universe) at fixed base radii, each gently "breathing" ±BAO_BREATHE_AMP px out
// of phase with the others (120° apart) so the pulse visibly travels inward-to-outward. A
// ball within BAO_BAND_HALF px of a ring's current (breathing) radius is pulled toward that
// ring line — inward if outside it, outward if inside — never tangentially, so a ball can
// always roll free along the ring and eventually leave. litBins tracks, per ring, which 30°
// arc segment last felt contact (for the "only glows where you touched it" visual).
interface BaryonOscillation { x: number; y: number; litBins: number[][] }
// Laniakea Basin (lv61+): three curved streamline bands (quadratic-Bezier polylines,
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
// Little Red Dot (lv68+): Zone C's first gimmick — a stationary tiny red dot that blinks on
// its own independent cycle (120f lit / 90f unlit, offset by a per-dot random `phase`). Only
// real while lit: solid bounce + weak pull, exactly like a miniature stationary comet+black-
// hole pair. Completely pass-through while unlit — that periodic dark window is the hazard's
// own release valve, so it can never trap a ball.
interface LittleRedDot { x: number; y: number; phase: number; hitCool: number; hitFlash: number; hitX: number; hitY: number }
// Primordial Black Hole (lv76+): several tiny, invisible, always-on weak attraction points
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
// Pop III.1 Flash (lv122+): synchronized ionization patches (The Flash at z~20) — brief
// outward shove, then a short recombination drag. Exclusive with reionization front & fog.
interface Pop31Patch { x: number; y: number; r: number }
interface Pop31Flash {
  patches: Pop31Patch[];
  period: number;
  timer: number;
  releaseTimer: number;
  recombTimer: number;
}
// Runaway SMBH bow shock (lv126+): a recoiling supermassive black hole punching through the
// IGM — V-shaped bow shove ahead of the tip, cooling entrainment drag in the wake behind.
// No solid bounce / no absorption. Exclusive with rogueBHs and red vanish comets.
interface RunawaySMBH {
  x: number; y: number;       // tip position
  vx: number; vy: number;     // constant heading (normalized * RBHS_SPEED)
  spawnX: number; spawnY: number;
  respawnTimer: number;       // >0 = parked offscreen waiting to re-enter
}
// Phantom Crossing Membrane (lv130+): a thin tilted band whose midline crossing flips the
// ball's "equation-of-state" sign (wSign). Inside the thick band, wSign>0 gently pulls toward
// the midline (quintessence-like) and wSign<0 pushes away (phantom). Exclusive with bigRip
// and dark-energy patches. Uses Ball.phantomSide like bfSide for one-shot cross detection.
interface PhantomMembrane {
  cx: number; cy: number;
  len: number; thick: number;
  angle: number;
  flashTimer: number;
}
// Big Ring uLSS (lv136+): a large hollow ring whose thin band carries a one-way tangential
// current (no radial force). Hollow interior is inert. Exclusive with ORC / BAO (same ring family).
interface BigRing {
  cx: number; cy: number;
  r: number;       // ~130
  halfW: number;   // 18
  dir: 1 | -1;     // tangential flow direction
}
// Patchy kSZ kick (lv139+): elliptical kinetic-SZ wind patches. Brief fixed-axis impulse
// (not outward from center). Exclusive with Pop III.1 flash on the same level.
interface KszPatch {
  cx: number; cy: number;
  rx: number; ry: number; // ellipse ~50-75
  axis: number;           // kick direction angle (fixed)
  period: number;         // ~200-280
  timer: number;
  releaseTimer: number;   // 6 when firing
}
// Subsolar PBH echo merger (lv142+): two weak pulls approach → brief gravity-null echo →
// dormant → recondense. Exclusive with microBHs / primordialBHs. Inspired by S251112cm.
interface SubsolarPbhEcho {
  x1: number; y1: number;
  x2: number; y2: number;
  phase: 0 | 1 | 2; // 0=approach, 1=echo, 2=dormant
  timer: number;    // echo/dormant countdown
}
// Black Hole Star cocoon (lv150+): dense gas envelope around a young BH.
// Shell drag + periodic asymmetric tear pulse. Exclusive with littleRedDots.
interface BhStarCocoon {
  x: number; y: number;
  timer: number;     // countdown to next tear
  tearTimer: number; // >0 while tearing
  tearAng: number;   // gap facing angle (fixed per cocoon)
}
// Dual-H0 seam (lv153+): a tilted divider splitting the board into two gravity scales
// (H0 tension motif). Seam cross → one-shot ±DH0_TWIST velocity rotation (WeakMap tracks side).
// Exclusive with alens / gwBackground (global-twist family).
interface DualH0Seam {
  cx: number; cy: number;
  angle: number; // seam tangent angle; normal = angle + π/2
  lastSide: WeakMap<Ball, number>; // +1 / -1 of last known side
}
// SIDM final-parsec spike (lv159+): two fixed cores with an inter-core tangential
// friction band (DM-assisted inspiral motif). Visual positions creep closer; physics fixed.
// Exclusive with chirpBinary / bulletClusters.
interface SidmSpike {
  x1: number; y1: number;
  x2: number; y2: number;
  dir: 1 | -1; // tangential flow sense along the binary axis
}
// Neutrino mass null band (lv162+): tilted OBB where the gravity mass term is suppressed
// (DESI Σmν vs oscillation lower-bound tension). Exclusive with Quintom / dualH0.
interface NuNullBand {
  cx: number; cy: number;
  angle: number;
  len: number;
  halfW: number;
}
// Two-component DM segregation (lv165+): radius-reversed dual halo (heavy in / light out).
// Exclusive with sidmSpike / darkHalos / primordialBHs.
interface TcDmHalo {
  x: number; y: number;
}
// Free-streaming softening (lv168+): warm-DM-like path smoothing inside an ellipse.
// Exclusive with silkDampingClouds / quantumFoams.
interface FsSoftField {
  x: number; y: number;
  rx: number; ry: number;
}
// Overmassive mimic core (lv171+): apparent mass >> dynamical mass most of the time.
// Exclusive with bhStarCocoons / microBHs.
interface OmmCore {
  x: number; y: number;
  timer: number;
  burstTimer: number;
}
// FRB microlens IMBH (lv174+): thin arc caustic; one kick+twist per approach.
interface FrbMicrolens {
  x: number; y: number;
  ang0: number;
  flashTimer: number;
  passingBalls: WeakSet<Ball>;
}
// Primordial B-field baryon clump nucleus (lv177+).
interface PmfClump {
  x: number; y: number;
  phase: number; // visual creep phase
}
// IDE energy siphon band (lv182+): DE→DM energy transfer as dwell-scaled gravity boost.
interface IdeSiphonBand {
  cx: number; cy: number;
  angle: number;
  len: number;
  halfW: number;
}
// Vacuum decay leak (lv188+): static circle, periodic weak inward seep (no absorb, no antigrav).
interface VacLeak {
  x: number; y: number;
  age: number; // frames into T+REST cycle
}
// Gravity echo delay (lv191+): ring-buffered past perturbation applied as delayed micro-twist.
interface GravEcho {
  x: number; y: number;
  buf: number[]; // length GRAVECHO_DELAY
  write: number;
}
// Boson star soft caustic (lv194+): extended lens — interior inert, rim folds heading once.
interface BosonCaustic {
  x: number; y: number;
  ghostTimer: number;
  ghostX: number; ghostY: number;
  passingBalls: WeakSet<Ball>;
}
// Intrinsic alignment contaminant (lv197+): false shear that parallels headings to a fixed axis.
interface IaContam {
  x: number; y: number;
  rx: number; ry: number;
  axis: number;
}
// Sign-switching IDE seam (lv202+): pull/push flips across (or with) the seam.
interface SignIdeSeam {
  cx: number; cy: number;
  angle: number;
  len: number;
  halfW: number;
  mode: 'sides' | 'timer';
  signFlip: 1 | -1;
  timer: number;
  blinkTimer: number;
}
// Phantom Crossing Belt (lv208+): thin horizontal band; gravity scale flips on cross.
interface PhantomBelt {
  y: number;
  halfW: number;
  flashTimer: number;
}
// Multiplicative shear bias veil (lv211+): speed-only miscalibration inside an ellipse.
interface MBiasVeil {
  x: number; y: number;
  rx: number; ry: number;
  axis: number;
  m: number; // +MBIAS_M or -MBIAS_M
}
// Catastrophic photo-z gate (lv214+): thin OBB; 20% depth jump along heading (speed kept).
interface PhotoZGate {
  x: number; y: number;
  angle: number;
  passingBalls: WeakSet<Ball>;
  flashTimer: number;
}
// S8 bifurcation seam (lv222+): gravity growth amplitude splits across a tilted seam.
interface S8Seam {
  cx: number; cy: number;
  angle: number;
  lastSide: WeakMap<Ball, number>;
}

interface CdaGhost { x: number; y: number; timer: number; vx: number; vy: number }
// Soft light holes punched through the Cosmic Dark Ages veil (hit pegs / hazards linger).
interface CdaLight { x: number; y: number; timer: number; r: number }
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
// Rogue black hole (lv69+): the black-hole family's final form — the main black hole's pull
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
  // Exit = next slot in the same pairId, cyclic: (pairSlot+1) % chainLen. A plain pair
  // is the chainLen-2 case; the lv47+ triple variant sets chainLen 3 (one-way A→B→C→A).
  pairSlot: number;
  chainLen?: number;
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

type PegType = 'orange' | 'blue' | 'purple' | 'bomb' | 'split' | 'magnet' | 'chain-weak' | 'chain-node' | 'shield' | 'lightning' | 'hash' | 'freeze' | 'mud' | 'neutron' | 'pair' | 'entangle' | 'redshift';
type Phase   = 'idle' | 'aiming' | 'firing' | 'levelclear' | 'gameover' | 'paused';
// Anomaly specials (every 5th non-boss level): the rolled hazards are replaced by one
// curated, single-theme composition. Wordless — the board itself is the announcement.
type AnomalyKind = 'meteorShower' | 'dipole' | 'colony' | 'silence' | 'redDay' | 'signFlipDay' | 'calibrationDay';

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
  goldArmor?: boolean; // rare golden boss-armor: breaking it refills +1 shot
  armorAngle?: number; // angle around the boss core (so armor can follow a moving boss)
  mudBroken?: boolean; // mud peg: destroyed this volley (revives before the next shot)
  mudAnim?: number;    // mud peg: frames remaining in the reform animation after revival
  entangleId?: number; // quantum-entangled peg: clearing one clears the partner sharing this id
  entanglePartner?: Peg | null; // mutual link set at generate time (avoids per-frame find)
}

interface Boss {
  x: number; y: number; r: number;
  hp: number; maxHp: number;
  hitFlash: number;   // frames, flashes white on damage
  hitCool: number;    // frames, gates damage ticks
  rearmFlash: number; // frames, flashes when re-arming (triggered on fire)
  tier: number;       // floor(level/10): 1 at lv10, scales gimmicks
  vx: number;         // horizontal drift (tier 2 ping-pong) or unused for path-driven tiers
  armorR: number;     // radius of the armor ring (for repositioning followers)
  moveMinX: number; moveMaxX: number; // horizontal drift bounds (lower-half arena)
  moveMinY: number; moveMaxY: number; // vertical bounds — always screen midline and below
  homeX: number; homeY: number;       // orbit / path center (lower-centre)
  phase: number;      // path phase accumulator
  omega: number;      // base angular rate for elliptical / alien paths
  ampX: number; ampY: number; // path amplitudes (clamped into bounds)
  phaseLag: number;   // Lissajous Y phase offset
  stutterTimer: number; // frames remaining of freeze (tier 5+)
  nextStutter: number;  // frames until next stutter
  blinkCool: number;    // cooldown before next short-range shift (tier 7+)
  pathDir: number;      // +1 / -1 for ping-pong and stutter reverses
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

interface Ball { x: number; y: number; vx: number; vy: number; dots: Dot[]; isBucketBall: boolean; stuckTimer: number; stuckBaseY: number; freezeTimer: number; mudTimer: number; neutronTimer: number; dilated: boolean; bfSide: number; pdgSide: number; rgLayer: number; vcTimer: number; vcFlip: number; bucFlash: number; reborn: boolean; goldTimer: number; inVoid: boolean; wSign: number; phantomSide: number; fsPrevVx: number; fsPrevVy: number; ideSiphonU: number; fxTrail: number; fxTrailColor: string; fxTwist: number; fxField: number; fxFieldColor: string; }

interface GameState {
  phase: Phase;
  prePausePhase: Phase;
  pegs: Peg[];
  chainGroups: Map<number, Peg[]>; // chainId → pegs (built once per level)
  bumpers: Bumper[];
  balls: Ball[];           // all active balls
  burstRemaining: number;  // balls yet to be launched in current burst
  burstTimer: number;      // frames until next ball launch
  burstAngle: number;      // locked aim angle for the current burst
  burstLuckyIdx: number;   // index of the guaranteed bucket ball in current burst (-1 = none)
  burstBucketProb: number; // per-burst chance a ball is a bucket ball (dynamic refill throttle)
  shotsLeft: number;
  score: number;
  level: number;
  aimAngle: number;
  bursts: Burst[];
  pegBreaks: PegBreak[];
  bgDots: BgDot[];
  bgClusterTimer: number;
  frame: number;
  levelStartFrame: number; // g.frame at the current level's start (redshift score decay reference)
  anomalyKind: AnomalyKind | null; // curated special-level composition (null = normal level)
  firePulse: { x: number; y: number; timer: number } | null; // deep-level "pressure" recoil of nearby dust on fire (draw offset only)
  unobservedTimer: number; // lv75+: countdown between quiet dust rearrangements while the player watches the ball
  wrongTimer: number;      // lv80+: countdown to the next 2-frame wrongness event
  wrongKind: number;       // 0 = peg blinks out, 1 = peg flickers hazard-red, 2 = bucket heartbeat skips
  wrongPeg: Peg | null;    // the peg misbehaving right now (identity match; stale refs are harmless)
  wrongFrames: number;     // frames the current wrongness stays visible
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
  cosmicShears: CosmicShear[];
  collisionlessShocks: CollisionlessShock[];
  silkDampingClouds: SilkDampingCloud[];
  planckGratings: PlanckDiffractionGrating[];
  vacuumCherenkovDomains: VacuumCherenkovDomain[];
  closedTimelikeCurves: ClosedTimelikeCurve[];
  ctcStates: WeakMap<Ball, CtcState>;
  ctcUsed: WeakSet<Ball>;
  gravitationalCaustics: GravitationalCaustic[];
  neutrinoOscillations: NeutrinoOscillation[];
  gravWaveMemories: GravWaveMemory[];
  gwMemories: WeakMap<Ball, GwMemoryResidue>;
  einsteinCrosses: EinsteinCross[];
  quantumZenoSectors: QuantumZenoSector[];
  chirpBinary: TransSolarChirp | null;
  fuzzySolitons: FuzzySoliton[];
  axionMicrolenses: AxionMicrolens[];
  holographicRGSheets: HolographicRGSheet[];
  holoSides: WeakMap<Ball, number>;
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
  cdaLights: CdaLight[];         // lingering reveal lights around hit pegs / hazards
  quantumFoams: QuantumFoam[];
  firewalls: Firewall[];
  superradiances: Superradiance[];
  negMassBlobs: NegMassBlob[];
  bubbleUniverses: BubbleUniverse[];
  bigRip: BigRip | null; // board-wide pulsed expansion (null = inactive)
  cccBoundary: CccBoundary | null; // conformal cyclic rebirth band (null = inactive)
  theNothings: TheNothing[];
  gwBackgroundActive: boolean; // this level has the board-wide gravitational wave background hum
  horizonEntropyActive: boolean; // lv112+ four-edge inward entropy flow (exclusive with greatAttractor)
  entropicDragActive: boolean; // lv119+ board-wide distance-proportional velocity drag (exclusive with bigRip)
  pop31Flash: Pop31Flash | null; // lv122+ Pop III.1 flash ionization patches (exclusive with reion/fog)
  runawaySMBHs: RunawaySMBH[]; // lv126+ runaway SMBH bow shocks (exclusive with rogueBHs / red comets)
  phantomMembranes: PhantomMembrane[]; // lv130+ phantom crossing membranes (exclusive with bigRip / DE patches)
  alensActive: boolean; // lv133+ board-wide Alens micro-twist field (exclusive with gravWaves / gwBackground)
  bigRings: BigRing[]; // lv136+ Big Ring uLSS tangential band (exclusive with ORC / BAO)
  kszPatches: KszPatch[]; // lv139+ patchy kSZ fixed-axis kicks (exclusive with #66 pop31Flash)
  subsolarPbhEcho: SubsolarPbhEcho | null; // lv142+ subsolar PBH echo merger (exclusive with microBHs / PBHs)
  quintomBreathActive: boolean; // lv146+ board-wide Quintom gravity breathe (exclusive with bigRip / phantom / DE)
  bhStarCocoons: BhStarCocoon[]; // lv150+ BH-star cocoons (exclusive with littleRedDots)
  dualH0Seam: DualH0Seam | null; // lv153+ dual-H0 gravity seam (exclusive with alens / gwBackground)
  hdHumActive: boolean; // lv156+ Hellings-Downs correlation hum (exclusive with gwBackground / alens / gravWaves)
  sidmSpike: SidmSpike | null; // lv159+ SIDM final-parsec spike (exclusive with chirpBinary / bulletClusters)
  nuNullBands: NuNullBand[]; // lv162+ neutrino mass null bands (exclusive with Quintom / dualH0)
  tcDmHalos: TcDmHalo[]; // lv165+ two-component DM segregation (exclusive with sidmSpike / darkHalos / PBH)
  fsSoftFields: FsSoftField[]; // lv168+ free-streaming softening (exclusive with silk / quantumFoam)
  ommCores: OmmCore[]; // lv171+ overmassive mimic cores (exclusive with bhStar / microBH)
  frbMicrolenses: FrbMicrolens[]; // lv174+ FRB microlens IMBHs (exclusive with axionML / caustics)
  pmfClumps: PmfClump[]; // lv177+ primordial B-field baryon clumps (exclusive with cmb / pop31)
  ideSiphonBands: IdeSiphonBand[]; // lv182+ IDE energy siphon (exclusive with Quintom / nuNull / dualH0)
  vacLeaks: VacLeak[]; // lv188+ vacuum decay leak (exclusive with vacuums / bigRip)
  gravEcho: GravEcho | null; // lv191+ gravity echo delay (exclusive with hdHum / alens / gravWaves / gwb)
  momCoupActive: boolean; // lv185+ momentum-only dark coupling (exclusive with hdHum / alens / gwb)
  bosonCaustics: BosonCaustic[]; // lv194+ boson star soft caustic (exclusive with frbML / axionML / caustics)
  iaContams: IaContam[]; // lv197+ intrinsic alignment contaminant (exclusive with alens / cosmicShears / hdHum)
  signIdeSeams: SignIdeSeam[]; // lv202+ sign-switching IDE seam (exclusive with ideSiphon / Quintom / nuNull / dualH0)
  phantomBelts: PhantomBelt[]; // lv208+ phantom crossing belt (exclusive with phantom / Quintom / bigRip)
  mBiasVeils: MBiasVeil[]; // lv211+ multiplicative shear bias (exclusive with ia / alens / shear)
  varCoupActive: boolean; // lv205+ variable coupling drift (exclusive with Quintom / dualH0 / ideSiphon / signIde)
  photoZGates: PhotoZGate[]; // lv214+ catastrophic photo-z gate (exclusive with strings / holo / pdg)
  blueHumActive: boolean; // lv217+ blue-tilted primordial hum (exclusive with hdHum / alens / gwb / echo / gravWaves)
  s8Seams: S8Seam[]; // lv222+ S8 bifurcation seam (exclusive with dualH0 / nuNull / signIde / varCoup)
  isoBireActive: boolean; // lv231+ isotropic cosmic birefringence drift
  isoBireBeta: number; // +ISOBIRE_BETA or -ISOBIRE_BETA
  cmeActive: boolean;   // this level has a periodic CME shockwave
  cmePeriod: number;    // frames between sweeps
  cmeTimer: number;     // countdown to next sweep
  cmeY: number;         // current sweep-band Y (-1 = not sweeping)
  reionActive: boolean; // this level has a reionization ionization front
  reionPeriod: number;
  reionTimer: number;
  reionY: number;       // current front Y (-1 = waiting)
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
  // Slow-burn depth atmosphere (wordless cues; never labels "space")
  depthCrackKind: 0 | 7 | 9 | 12 | 15 | 17; // early unlock crack cue (0 = none)
  depthCrackTimer: number;
  depthWhisperKind: 0 | 54 | 61 | 71 | 81 | 91 | 100 | 120; // zone-boundary whisper (0 = none)
  depthWhisperTimer: number;
  depthWhispersSeen: number; // bit flags for whispers already shown this run
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
  } else if (type === 'neutron') {
    // neutron star: dense heavy core + a tight nucleon shell (animated glow drawn in loop)
    for (let r = 1.5; r <= PEG_R; r += 2.0) {
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.2));
      for (let i = 0; i < count; i++) {
        if (Math.random() > 0.9) continue;
        const a = (i / count) * Math.PI * 2;
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.0));
      }
    }
    dots.push({ x: 0, y: 0, size: 4, alpha: 1.0, phase: 0, cosP: 1, sinP: 0, cosP2: 1, sinP2: 0 });
  } else if (type === 'pair') {
    // pair production: a core with a mirrored ghost twin offset to one side (hints "births a copy")
    for (let r = 1.5; r <= PEG_R - 1; r += 2.2) {
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.6));
      for (let i = 0; i < count; i++) {
        if (Math.random() > 0.82) continue;
        const a = (i / count) * Math.PI * 2;
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.0));
      }
    }
    // faint plus/minus tick marks — a "+/-" charge-pair glyph
    for (let i = -3; i <= 3; i += 2) { const d = makeDot(i, -PEG_R * 0.45, 0.8); d.alpha *= 0.7; dots.push(d); }
    { const d = makeDot(0, -PEG_R * 0.45 - 2, 0.8); d.alpha *= 0.7; dots.push(d); const e = makeDot(0, -PEG_R * 0.45 + 2, 0.8); e.alpha *= 0.7; dots.push(e); }
    for (let i = -3; i <= 3; i += 2) { const d = makeDot(i, PEG_R * 0.45, 0.8); d.alpha *= 0.7; dots.push(d); }
  } else if (type === 'entangle') {
    // entanglement: two small linked rings (a "knot" — partner tether drawn in loop)
    for (const cxo of [-4, 4]) {
      const rr = 5.5;
      const cnt = Math.floor(2 * Math.PI * rr / 2.4);
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * Math.PI * 2;
        dots.push(makeDot(cxo + Math.cos(a) * rr, Math.sin(a) * rr, 0.95));
      }
    }
    dots.push({ x: 0, y: 0, size: 2, alpha: 0.9, phase: 0, cosP: 1, sinP: 0, cosP2: 1, sinP2: 0 });
  } else if (type === 'redshift') {
    // redshift: filled disc (color shifts blue→copper with level age, applied in loop)
    for (let r = 1.5; r <= PEG_R; r += 2.2) {
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.5));
      for (let i = 0; i < count; i++) {
        if (Math.random() > 0.84) continue;
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


// ─── Slow-burn depth atmosphere (wordless; never names "space") ───────────────
// Continuous 0..1 depth factor from level. Early levels barely move; deep levels
// thin and slow the cream-board ink dust so the board feels emptier over time.
function depthFactor(level: number): number {
  return Math.max(0, Math.min(1, (level - 1) / 98));
}
function depthSmooth(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}
/** Drift speed scale: 1 at lv1 → ~0.15 at lv99 */
function depthDriftScale(level: number): number {
  return 1 - 0.85 * depthSmooth(depthFactor(level));
}
/** Alpha scale for bg dust: 1 at lv1 → ~0.35 at lv99 */
function depthAlphaScale(level: number): number {
  return 1 - 0.65 * depthSmooth(depthFactor(level));
}
/** Lifetime scale: 1 at lv1 → ~1.9 at lv99 (slower turnover) */
function depthLifeScale(level: number): number {
  return 1 + 0.9 * depthSmooth(depthFactor(level));
}
/** Soft cap on bgDots count: 300 early → ~120 deep */
function depthBgCap(level: number): number {
  return Math.round(300 - 180 * depthSmooth(depthFactor(level)));
}
/** Edge bias 0..1 starting around mid-game (lv54+) */
function depthEdgeBias(level: number): number {
  return depthSmooth(Math.max(0, (level - 40) / 50));
}
/** Central hollow radius factor 0..1 (lv77+) — skip drawing near board center */
function depthHollow(level: number): number {
  return depthSmooth(Math.max(0, (level - 70) / 29));
}
// The paper never changes color — cream at every depth (2026-07-13: the depth-darkening
// palette was removed by owner decision). Depth is spoken through the dust instead.
const PAPER_SURFACE = '#ede9df';
/** Marine snow 0..1: how strongly background dust falls straight down (lv30 → lv90). */
function depthSnowT(level: number): number {
  return depthSmooth(Math.max(0, (level - 30) / 60));
}
/** How many unlabeled depth-meter dots are lit (0..7). Grows from early levels. */

/** Extra intensity 0..cap from levels since unlock (~20 levels to full). */
function hazardAgeBoost(level: number, unlockLv: number, cap = 0.35): number {
  if (level < unlockLv) return 0;
  return Math.min(cap, ((level - unlockLv) / 20) * cap);
}

/** How "wrong" a hazard looks: 0 at its unlock level (a textbook object), 1 forty levels
 *  deeper (the same phenomenon, no longer holding its shape). Draw-only — never physics. */
function exoticT(level: number, unlockLv: number): number {
  return depthSmooth(Math.max(0, (level - unlockLv) / 40));
}
/** Deterministic per-dot dropout for exotic decay — stable per index so the gaps sit
 *  still instead of flickering (max 25% of dots at full exoticT). The seed is stirred
 *  with a large odd constant so twin structures (paired beams, wormhole mouths, rings
 *  with equal dot counts) never share the same gap pattern. */
function exoticSkip(i: number, seed: number, t: number): boolean {
  if (t <= 0) return false;
  // Murmur-style finalizer: multiply + shift AFTER combining so the seed avalanches
  // into the top bits (plain add/xor stirring left twin structures — paired beams,
  // wormhole mouths — sharing the exact same gap pattern).
  let x = (i ^ Math.imul(seed, 0x27d4eb2f)) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 2654435761) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  return x / 4294967296 < t * 0.25;
}
/** Per-dot phase-shifted slow wobble added to a dot's polar angle at full exoticT (radians). */
function exoticJitter(frame: number, i: number, t: number): number {
  if (t <= 0) return 0;
  return Math.sin(frame * 0.0173 + i * 2.7) * t * 0.22;
}
// ─── Zone texture signatures (W6): each depth zone renders its hazards with a shared
// material grammar. Zone C (early universe): coarse old-print grain — ~1 in 5 dots
// prints fat. Zone D (Planck regime): coordinates snap to a 2px grid (spacetime
// pixelates, same idiom as the quantum foam). Zone E (outside the universe): outlines
// no longer close. All draw-only.
function zoneCoarse(i: number): boolean {
  return (Math.imul(i + 11, 2654435761) >>> 0) % 5 === 0;
}
function zoneSnap(v: number): number {
  return Math.round(v / 2) * 2;
}
/** Zone F (lv100+): holographic layer shear — offset a draw coord by ±1..2px per layer index.
 *  Draw-only; keeps closed rings from looking like UI stripes. */
function zoneLayerShift(v: number, frame: number, i: number, layer = 0): number {
  const wobble = Math.sin(frame * 0.005 + i * 0.37 + layer * 1.1) * (1 + (layer % 3));
  return v + wobble;
}
/** Zone G (lv120+): phase tear — drop a dot for 1 frame on a slow cadence (draw-only). */
function zonePhaseTear(i: number, frame: number): boolean {
  const phase = (frame + i * 17) % 47;
  return phase === 0 || phase === 23;
}

function depthMeterLit(level: number): number {
  if (level < 4) return 1;
  if (level < 12) return 2;
  if (level < 24) return 3;
  if (level < 54) return 4;
  if (level < 71) return 5;
  if (level < 81) return 6;
  return 7;
}

const DEPTH_CRACK_DUR = 48;   // frames for early unlock crack cues
const DEPTH_WHISPER_DUR = 150; // frames for zone-boundary wordless cues (~2.5s)

// ─── Background dots ──────────────────────────────────────────────────────────
function spawnBgDot(W: number, H: number, level = 1): BgDot {
  const life = depthLifeScale(level);
  const drift = depthDriftScale(level);
  const aScale = depthAlphaScale(level);
  const edge = depthEdgeBias(level);
  // Prefer edges as depth grows (leaving the crowded middle behind).
  let x = Math.random() * W, y = Math.random() * H;
  if (edge > 0.05 && Math.random() < edge * 0.55) {
    const side = Math.floor(Math.random() * 4);
    const inset = 8 + Math.random() * (28 + edge * 40);
    if (side === 0) { x = Math.random() * W; y = inset; }
    else if (side === 1) { x = Math.random() * W; y = H - inset; }
    else if (side === 2) { x = inset; y = Math.random() * H; }
    else { x = W - inset; y = Math.random() * H; }
  }
  // Deep levels: snap a fraction of dots toward a 2px grid (quiet "pixel grain").
  if (level >= 81 && Math.random() < depthSmooth((level - 81) / 18) * 0.7) {
    x = Math.round(x / 2) * 2;
    y = Math.round(y / 2) * 2;
  }
  const maxAge = (180 + Math.random() * 240) * life;
  // Marine snow: with depth the drift aligns downward — by lv90 the dust falls slowly
  // and almost straight, like snow settling in still water (color and count unchanged).
  const snow = depthSnowT(level);
  const vx0 = rnd(0.20) * drift, vy0 = rnd(0.20) * drift;
  const fall = (0.05 + Math.random() * 0.15) * drift;
  return {
    x, y,
    vx: vx0 * (1 - snow * 0.85),
    vy: vy0 + (fall - vy0) * snow,
    size: Math.random() < 0.6 ? 1 : Math.random() < 0.85 ? 2 : 3,
    alpha: 0, targetAlpha: (0.06 + Math.random() * 0.14) * aScale,
    age: 0, maxAge,
  };
}

function spawnBgCluster(W: number, H: number, cx: number, cy: number, count: number, level = 1): BgDot[] {
  const life = depthLifeScale(level);
  const drift = depthDriftScale(level);
  const aScale = depthAlphaScale(level);
  const snow = depthSnowT(level); // marine snow: cluster dots also settle downward at depth
  return Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 45;
    const maxAge = (120 + Math.random() * 200) * life;
    const spd = (0.06 + Math.random() * 0.15) * drift;
    const fall = (0.05 + Math.random() * 0.15) * drift;
    return {
      x: Math.min(W - 2, Math.max(2, cx + Math.cos(a) * r)),
      y: Math.min(H - 2, Math.max(2, cy + Math.sin(a) * r)),
      vx: Math.cos(a) * spd * (1 - snow * 0.85),
      vy: Math.sin(a) * spd + (fall - Math.sin(a) * spd) * snow,
      size: Math.random() < 0.5 ? 1 : 2,
      alpha: 0, targetAlpha: (0.08 + Math.random() * 0.14) * aScale,
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
  if (g.cosmicDarkAgesActive) cdaReveal(g, cx, cy);
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

/** Punch a soft reveal hole through the Cosmic Dark Ages veil at a hit site. */
function cdaReveal(g: GameState, x: number, y: number, r: number = CDA_LIGHT_HIT_R) {
  if (!g.cosmicDarkAgesActive) return;
  const merge2 = CDA_LIGHT_MERGE * CDA_LIGHT_MERGE;
  for (const L of g.cdaLights) {
    const dx = L.x - x, dy = L.y - y;
    if (dx * dx + dy * dy < merge2) {
      L.x = x; L.y = y;
      L.timer = CDA_LIGHT_HIT_DUR;
      L.r = Math.max(L.r, r);
      return;
    }
  }
  g.cdaLights.push({ x, y, timer: CDA_LIGHT_HIT_DUR, r });
}

// Offscreen veil for Cosmic Dark Ages (black + destination-out light holes).
let _cdaMask: HTMLCanvasElement | null = null;
let _cdaMaskCtx: CanvasRenderingContext2D | null = null;

function getCdaMaskCtx(W: number, H: number, dpr: number): CanvasRenderingContext2D {
  const bw = Math.max(1, Math.ceil(W * dpr));
  const bh = Math.max(1, Math.ceil(H * dpr));
  if (!_cdaMask || _cdaMask.width !== bw || _cdaMask.height !== bh) {
    _cdaMask = document.createElement('canvas');
    _cdaMask.width = bw;
    _cdaMask.height = bh;
    _cdaMaskCtx = _cdaMask.getContext('2d')!;
  }
  const m = _cdaMaskCtx!;
  m.setTransform(dpr, 0, 0, dpr, 0, 0);
  m.globalCompositeOperation = 'source-over';
  m.globalAlpha = 1;
  m.clearRect(0, 0, W, H);
  return m;
}

function cdaPunchLight(m: CanvasRenderingContext2D, x: number, y: number, r: number, strength: number) {
  if (strength <= 0 || r <= 0) return;
  const grd = m.createRadialGradient(x, y, 0, x, y, r);
  const s = Math.min(1, Math.max(0, strength));
  grd.addColorStop(0, `rgba(0,0,0,${s})`);
  grd.addColorStop(0.45, `rgba(0,0,0,${s * 0.55})`);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  m.fillStyle = grd;
  m.beginPath();
  m.arc(x, y, r, 0, Math.PI * 2);
  m.fill();
}


// Brief ball-side feedback when a continuous force or twist actually moves the shot.
function pulseForceFx(ball: Ball, color: string) {
  ball.fxTrail = FX_TRAIL_DUR;
  ball.fxTrailColor = color;
}
function pulseTwistFx(ball: Ball) {
  ball.fxTwist = FX_TWIST_DUR;
}
function pulseFieldFx(ball: Ball, color: string) {
  ball.fxField = FX_FIELD_DUR;
  ball.fxFieldColor = color;
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
                 : peg.type === 'freeze'     ? 22
                 : 14;
  const iceBreak = peg.type === 'freeze';
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
      color: iceBreak ? FREEZE_ICE_COLORS[i % FREEZE_ICE_COLORS.length] : undefined,
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

// Ice scatter when a freeze peg shatters — ring of shards + drifting frost cloud.
function spawnFreezeBurst(g: GameState, cx: number, cy: number) {
  const ring: BurstP[] = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    const spd = 6.5 + Math.random() * 5.5;
    const life = Math.round(14 + Math.random() * 10);
    return {
      x: cx, y: cy,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life, maxLife: life,
      size: Math.random() < 0.4 ? 2 : 3,
      color: FREEZE_ICE_COLORS[i % FREEZE_ICE_COLORS.length],
    };
  });
  const shards: BurstP[] = Array.from({ length: 36 }, (_, i) => {
    const a = Math.random() * Math.PI * 2;
    const spd = 2.0 + Math.random() * 7.0;
    const life = Math.round(28 + Math.random() * 28);
    return {
      x: cx + rnd(6), y: cy + rnd(6),
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 1.2,
      life, maxLife: life,
      size: Math.random() < 0.35 ? 2 : Math.random() < 0.7 ? 3 : 4,
      color: FREEZE_ICE_COLORS[i % FREEZE_ICE_COLORS.length],
    };
  });
  g.bursts.push({ particles: [...ring, ...shards] });
}

// Apply freeze slow to a ball (idempotent refresh of the timer).
function applyFreezeToBall(ball: Ball) {
  const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * FREEZE_SLOW;
  const ang = Math.atan2(ball.vy, ball.vx);
  ball.vx = Math.cos(ang) * spd;
  ball.vy = Math.sin(ang) * spd;
  ball.freezeTimer = FREEZE_DUR;
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
function closestOnPolyline(px: number, py: number, pts: { x: number; y: number }[]): { dist: number; tx: number; ty: number; cx: number; cy: number } {
  let best = Infinity, btx = 1, bty = 0, bcx = px, bcy = py;
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
      bcx = cx; bcy = cy;
    }
  }
  return { dist: best, tx: btx, ty: bty, cx: bcx, cy: bcy };
}

// Perpendicular distance from a point to a finite segment, plus the segment unit tangent.
function ballSegmentProximity(
  px: number, py: number, ax: number, ay: number, bx: number, by: number, pad: number,
): { dist: number; tx: number; ty: number; cx: number; cy: number } | null {
  const sx = bx - ax, sy = by - ay;
  const segLen2 = sx * sx + sy * sy;
  if (segLen2 === 0) return null;
  let t = ((px - ax) * sx + (py - ay) * sy) / segLen2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + sx * t, cy = ay + sy * t;
  const dx = px - cx, dy = py - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > pad) return null;
  const sl = Math.sqrt(segLen2);
  return { dist, tx: sx / sl, ty: sy / sl, cx, cy };
}

function quantizePdgVelocity(vx: number, vy: number, sheetAngle: number): { vx: number; vy: number; orderDeg: number } {
  const spd = Math.sqrt(vx * vx + vy * vy);
  if (spd < 1e-8) return { vx, vy, orderDeg: 0 };
  const normalAng = sheetAngle + Math.PI / 2;
  let rel = Math.atan2(vy, vx) - normalAng;
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  let bestDeg = PDG_ORDER_DEG[0], bestD = Infinity;
  for (const deg of PDG_ORDER_DEG) {
    const o = deg * Math.PI / 180;
    let d = Math.abs(rel - o);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d < bestD) { bestD = d; bestDeg = deg; }
  }
  const na = normalAng + bestDeg * Math.PI / 180;
  return { vx: Math.cos(na) * spd, vy: Math.sin(na) * spd, orderDeg: bestDeg };
}

function ctcBallInBand(ctc: ClosedTimelikeCurve, ball: Ball): boolean {
  const dx = ball.x - ctc.x, dy = ball.y - ctc.y;
  const dist2 = dx * dx + dy * dy;
  if (dist2 < CTC_INNER_R * CTC_INNER_R || dist2 > CTC_OUTER_R * CTC_OUTER_R) return false;
  let rel = Math.atan2(dy, dx) - ctc.gapAngle;
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  const gapHalf = Math.PI * CTC_GAP_FRAC;
  return Math.abs(rel) >= gapHalf;
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
  // Band shrinks with level → fewer free bucket-ball refills as you go deeper.
  const bandTop = Math.max(5, 12 - Math.floor(level * 0.28));
  return Math.max(0.18, Math.min(1, (bandTop - shots) / bandTop));
}

/** Shots granted on level clear — tightens with depth so ammo does not inflate forever. */
function clearShotRefill(level: number): number {
  if (level < 5)  return 5;
  if (level < 10) return 4;
  if (level < 25) return 3;
  if (level < 50) return 2;
  return 1;
}

const GOLD_ARMOR_CHANCE    = 0.12; // early bosses: rare golden armor plates that refill +1 when broken
const GOLD_ARMOR_ALWAYS_LV = 50;   // mid-game+: exactly one living gold plate on each fire / spawn

/** Mid-game bosses: keep exactly one uncleared gold armor plate (refill target). */
function ensureOneGoldBossArmor(pegs: Peg[], pick: () => number = Math.random) {
  const living: Peg[] = [];
  for (const p of pegs) {
    if (p.bossArmor && !p.cleared) living.push(p);
  }
  if (living.length === 0) return;
  const golds = living.filter(p => p.goldArmor);
  if (golds.length === 1) return;
  for (const p of golds) p.goldArmor = false;
  living[Math.floor(pick() * living.length)].goldArmor = true;
}

// Playtest helpers (?debug=1): force eligible hazards to spawn so every gimmick can be confronted.
let DEBUG_FORCE_HAZARDS = false;
/** Hellings-Downs overlap reduction function Γ(θ). θ in radians. */
function hellingsDowns(theta: number): number {
  if (theta < 1e-4) return 0.5;
  const x = (1 - Math.cos(theta)) * 0.5;
  return 0.5 - 0.25 * x + 1.5 * x * Math.log(x);
}

function hazChance(r: () => number, p: number, unlockLv = 0, level = 999): boolean {
  // Force only on the unlock level itself so deep boards don't pile every prior hazard.
  if (DEBUG_FORCE_HAZARDS && unlockLv > 0 && level === unlockLv) { r(); return true; }
  if (DEBUG_FORCE_HAZARDS && unlockLv === 0) { r(); return true; }
  let eff = p;
  if (unlockLv > 0 && level > unlockLv) {
    const age = level - unlockLv;
    // Soft decay then plateau at ≥60% of unlock rate — unlocked gimmicks keep randomly
    // reappearing instead of vanishing from deep boards.
    eff = p * Math.max(0.60, 1 - age * 0.012);
  }
  // Mild crowding past mid-game: each individual roll thins a bit so the board stays
  // readable, while the large unlocked pool still yields random reappearances.
  // (2026-07-13: floors relaxed 0.50/0.40→0.60/0.55 so deep boards stay busier.)
  if (level >= 35 && unlockLv > 0 && level !== unlockLv) {
    eff *= Math.max(0.55, 1 - (level - 35) * 0.004);
  }
  return r() < eff;
}

function generateLevel(W: number, H: number, launcherY: number, rng: () => number, level = 1): { pegs: Peg[], orangeTotal: number, bumpers: Bumper[], gravZones: GravZone[], wormholes: Wormhole[], wallSegments: WallSegment[], boss: Boss | null, comets: Comet[], lenses: Lens[], cme: { active: boolean; period: number }, pulsars: Pulsar[], gravWaves: GravWave[], vacuums: VacuumBubble[], whiteHoles: WhiteHole[], magnetars: Magnetar[], roguePlanets: RoguePlanet[], quasarJets: QuasarJet[], microBHs: MicroBH[], darkHalos: DarkHalo[], ergospheres: Ergosphere[], magReconnections: MagReconnection[], preSupernovae: PreSupernova[], tidalStretches: TidalStretch[], tachyonStreams: TachyonStream[], cosmicVoids: CosmicVoid[], cosmicShears: CosmicShear[], collisionlessShocks: CollisionlessShock[], silkDampingClouds: SilkDampingCloud[], planckGratings: PlanckDiffractionGrating[], vacuumCherenkovDomains: VacuumCherenkovDomain[], closedTimelikeCurves: ClosedTimelikeCurve[], gravitationalCaustics: GravitationalCaustic[], neutrinoOscillations: NeutrinoOscillation[], gravWaveMemories: GravWaveMemory[], einsteinCrosses: EinsteinCross[], quantumZenoSectors: QuantumZenoSector[], chirpBinary: TransSolarChirp | null, fuzzySolitons: FuzzySoliton[], axionMicrolenses: AxionMicrolens[], holographicRGSheets: HolographicRGSheet[], axionWalls: AxionWall[], frbSources: FRBSource[], antimatterFlecks: AntimatterFleck[], quantumBarriers: QuantumBarrier[], timeDilations: TimeDilation[], cosmicStrings: CosmicString[], darkEnergyPatches: DarkEnergyPatch[], galacticTidalStreams: GalacticTidalStream[], einsteinMirrorRings: EinsteinMirrorRing[], nakedSingularities: NakedSingularity[], hyperStars: HyperStar[], rogueBHs: RogueBH[], oddRadioCircles: OddRadioCircle[], tidalDisruptions: TidalDisruption[], greatAttractor: GreatAttractor | null, bulletClusters: BulletCluster[], baryonOscillations: BaryonOscillation[], laniakeaBasins: LaniakeaBasin[], gwBackgroundActive: boolean, horizonEntropyActive: boolean, entropicDragActive: boolean, pop31Flash: Pop31Flash | null, runawaySMBHs: RunawaySMBH[], phantomMembranes: PhantomMembrane[], alensActive: boolean, bigRings: BigRing[], kszPatches: KszPatch[], subsolarPbhEcho: SubsolarPbhEcho | null, quintomBreathActive: boolean, bhStarCocoons: BhStarCocoon[], dualH0Seam: DualH0Seam | null, hdHumActive: boolean, sidmSpike: SidmSpike | null, nuNullBands: NuNullBand[], tcDmHalos: TcDmHalo[], fsSoftFields: FsSoftField[], ommCores: OmmCore[], frbMicrolenses: FrbMicrolens[], pmfClumps: PmfClump[], ideSiphonBands: IdeSiphonBand[], vacLeaks: VacLeak[], gravEcho: GravEcho | null, momCoupActive: boolean, bosonCaustics: BosonCaustic[], iaContams: IaContam[], signIdeSeams: SignIdeSeam[], phantomBelts: PhantomBelt[], mBiasVeils: MBiasVeil[], varCoupActive: boolean, photoZGates: PhotoZGate[], blueHumActive: boolean, s8Seams: S8Seam[], isoBireActive: boolean, isoBireBeta: number, cosmicBirefringences: CosmicBirefringence[], littleRedDots: LittleRedDot[], primordialBHs: PrimordialBH[], darkStars: DarkStar[], cmbAnisotropy: CmbAnisotropy | null, hawkingPoints: HawkingPoint[], quantumFoams: QuantumFoam[], firewalls: Firewall[], superradiances: Superradiance[], negMassBlobs: NegMassBlob[], bubbleUniverses: BubbleUniverse[], bigRip: BigRip | null, cccBoundary: CccBoundary | null, theNothings: TheNothing[], anomalyKind: AnomalyKind | null, reion: { active: boolean; period: number; timer: number } } {
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
  // Normal levels also ramp density/orange with depth so each stage feels harder.
  const special    = specialKind(level);
  const depthRamp  = Math.min(1, Math.max(0, (level - 1) / 80)); // 0→1 across ~lv80
  const fillThresh = special === 'boss' ? 0.93
                   : special            ? 0.89
                   : Math.min(0.90, 0.80 + depthRamp * 0.10);
  const orangeP    = special === 'boss' ? 0.50
                   : special            ? 0.45
                   : Math.min(0.48, 0.34 + depthRamp * 0.12);
  const minOrange  = special === 'boss' ? 20
                   : special            ? 16
                   : Math.min(22, 11 + Math.floor(level / 8));

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
  if (level >= 7 && hazChance(gimmickRng, 0.6, 7, level)) {
    const zoneW = W * 0.55;
    const zoneH = 55;
    const zoneX = (W - zoneW) * (0.1 + gimmickRng() * 0.8);
    const zoneY = topPad + playH * (0.25 + gimmickRng() * 0.40);
    gravZones.push({
      x: zoneX, y: zoneY, w: zoneW, h: zoneH, flashTimer: 0,
      // Pulsing variant (lv60+, 40%): the well breathes — its pull swells and relaxes
      // on a slow cycle (0.2x..1.0x). Absorption radius is untouched.
      pulsing: level >= 60 && hazChance(gimmickRng, 0.4),
    });
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
    const whRng = makeRng((rng() * 0x100000000) >>> 0);
    // Cap at 2 pairs; past lv40 still allow a 2nd pair at reduced odds so wormholes reappear.
    const pairCount = level >= 12
      ? (level >= 40 ? (whRng() < 0.45 ? 2 : 1) : 2)
      : 1;
    for (let p = 0; p < pairCount; p++) {
      const cycleOffset = Math.floor(whRng() * WORMHOLE_CYCLE);
      for (let slot = 0; slot < 2; slot++) {
        const cx    = W * (0.15 + whRng() * 0.70);
        const cy    = topPad + playH * (0.15 + whRng() * 0.68);
        const angle = (whRng() - 0.5) * Math.PI * 0.75;
        const w     = 36 + Math.floor(whRng() * 14); // thinner than bumper (52+)
        wormholes.push({ cx, cy, w, h: 5, angle, pairId: p, pairSlot: slot, cycleTimer: cycleOffset, hitCool: 0, flashTimer: 0, dots: makeBumperDots(w, 5), auraDots: makeWormholeAura(w) });
      }
    }
    // Triple-chain variant (lv47+, 40%): pair 0 gains a third mouth and becomes a one-way
    // cycle A→B→C→A — you can no longer ride the same hole back where you came from.
    if (level >= 47 && hazChance(whRng, 0.4)) {
      // Keep the 3rd mouth off the other mouths' hitboxes (w+32 ≈ 82) so exiting a hole
      // can't chain straight into the next one (rejection sampling, tail-stream draws).
      let cx = W * 0.5, cy = topPad + playH * 0.5;
      for (let attempt = 0; attempt < 10; attempt++) {
        cx = W * (0.15 + whRng() * 0.70);
        cy = topPad + playH * (0.15 + whRng() * 0.68);
        if (wormholes.every(o => (o.cx - cx) ** 2 + (o.cy - cy) ** 2 >= 90 * 90)) break;
      }
      const angle = (whRng() - 0.5) * Math.PI * 0.75;
      const w     = 36 + Math.floor(whRng() * 14);
      wormholes.push({ cx, cy, w, h: 5, angle, pairId: 0, pairSlot: 2, chainLen: 3, cycleTimer: wormholes[0].cycleTimer, hitCool: 0, flashTimer: 0, dots: makeBumperDots(w, 5), auraDots: makeWormholeAura(w) });
      for (const wh of wormholes) if (wh.pairId === 0) wh.chainLen = 3;
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

  // ── Exotic peg types (batch K) — appended strictly AFTER the mud block so
  //    gimmickRng consumption stays tail-only: existing peg selection never shifts.
  //    All are taken from the blue pool (blue-equivalent = clear-condition safe).
  // ── Neutron pegs (level 28+): 2-hit heavy dampers that sap ball momentum ──
  if (level >= 28) {
    const nBlues = pegs.filter(p => p.type === 'blue');
    const nCount = Math.min(2, Math.floor(gimmickRng() * 3)); // 0..2
    for (let n = 0; n < nCount && nBlues.length > 0; n++) {
      const idx = Math.floor(gimmickRng() * nBlues.length);
      nBlues[idx].type = 'neutron'; nBlues[idx].dots = makePegDots('neutron');
      nBlues[idx].hp = NEUTRON_HP; nBlues[idx].maxHp = NEUTRON_HP;
      nBlues.splice(idx, 1);
    }
  }
  // ── Pair-production pegs (level 31+): clearing one births a fresh blue nearby ──
  if (level >= 31) {
    const pBlues = pegs.filter(p => p.type === 'blue');
    const pCount = Math.min(2, 1 + Math.floor(gimmickRng() * 2)); // 1..2
    for (let p = 0; p < pCount && pBlues.length > 0; p++) {
      const idx = Math.floor(gimmickRng() * pBlues.length);
      pBlues[idx].type = 'pair'; pBlues[idx].dots = makePegDots('pair');
      pBlues.splice(idx, 1);
    }
  }
  // ── Quantum-entangled pegs (level 34+): clearing one clears its partner ───
  if (level >= 34) {
    const eBlues = pegs.filter(p => p.type === 'blue');
    const ePairs = Math.min(2, 1 + Math.floor(gimmickRng() * 2)); // 1..2 pairs
    for (let e = 0; e < ePairs && eBlues.length >= 2; e++) {
      const i1 = Math.floor(gimmickRng() * eBlues.length);
      const a  = eBlues.splice(i1, 1)[0];
      const i2 = Math.floor(gimmickRng() * eBlues.length);
      const b  = eBlues.splice(i2, 1)[0];
      const eid = 900 + e; // unique within the level (compared only among entangle pegs)
      a.type = 'entangle'; a.dots = makePegDots('entangle'); a.entangleId = eid;
      b.type = 'entangle'; b.dots = makePegDots('entangle'); b.entangleId = eid;
      a.entanglePartner = b;
      b.entanglePartner = a;
    }
  }
  // ── Redshift pegs (level 38+): score decays over the level's elapsed time ─
  if (level >= 38) {
    const rBlues = pegs.filter(p => p.type === 'blue');
    const rCount = Math.min(3, 1 + Math.floor(gimmickRng() * 2)); // 1..3
    for (let r = 0; r < rCount && rBlues.length > 0; r++) {
      const idx = Math.floor(gimmickRng() * rBlues.length);
      rBlues[idx].type = 'redshift'; rBlues[idx].dots = makePegDots('redshift');
      rBlues.splice(idx, 1);
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
    // Drift / path speed scales with tier (tier 1 stays static).
    const moveSpeed = tier >= 2 ? Math.min(2.2, 0.6 + (tier - 2) * 0.4) : 0;
    const moveSpanX = tier >= 2 ? W * 0.28 : 0;
    const moveMinX  = Math.max(armorR + 4, bx - moveSpanX);
    const moveMaxX  = Math.min(W - armorR - 4, bx + moveSpanX);
    // Always confined to the lower half of the screen (midline and below).
    const moveMinY  = H * 0.5 + armorR;
    const moveMaxY  = H - 44 - armorR - 8;
    const homeY     = Math.max(moveMinY, Math.min(moveMaxY, by));
    const maxHp     = bossCoreHp(tier);
    // Path amplitudes fit inside the lower-half arena.
    const ampX = tier >= 3 ? Math.min(moveSpanX * 0.92, (moveMaxX - moveMinX) * 0.45) : moveSpanX;
    const ampY = tier >= 3 ? Math.min((moveMaxY - moveMinY) * 0.38, 55 + tier * 4) : 0;
    const omega = tier >= 3 ? 0.018 + Math.min(0.012, (tier - 3) * 0.002) : 0;
    const phaseLag = tier >= 3 ? Math.PI * 0.55 : 0;
    // Carve a clean arena covering the full movement rectangle (expanded by clearR).
    const clearR = armorR + PEG_R + 4;
    for (let i = pegs.length - 1; i >= 0; i--) {
      const px = pegs[i].x, py = pegs[i].y;
      const cxClamped = Math.max(moveMinX, Math.min(moveMaxX, px));
      const cyClamped = Math.max(moveMinY, Math.min(moveMaxY, py));
      const ddx = px - cxClamped, ddy = py - cyClamped;
      if (ddx * ddx + ddy * ddy < clearR * clearR) pegs.splice(i, 1);
    }
    boss = {
      x: bx, y: homeY, r: BOSS_R, hp: maxHp, maxHp,
      hitFlash: 0, hitCool: 0, rearmFlash: 0,
      tier, vx: moveSpeed, armorR, moveMinX, moveMaxX, moveMinY, moveMaxY,
      homeX: bx, homeY,
      phase: 0, omega, ampX, ampY, phaseLag,
      stutterTimer: 0,
      nextStutter: tier >= 5 ? 90 : 0,
      blinkCool: tier >= 7 ? 120 : 0,
      pathDir: 1,
    };
    // Dedicated stream so gold rolls do not shift wall/hazard layout.
    const bossArmorRng = makeRng((rng() * 0x100000000) >>> 0);
    const alwaysGold = level >= GOLD_ARMOR_ALWAYS_LV;
    for (let i = 0; i < armorN; i++) {
      const a = (i / armorN) * Math.PI * 2 - Math.PI / 2;
      pegs.push({
        x: bx + Math.cos(a) * armorR, y: homeY + Math.sin(a) * armorR,
        type: 'shield', cleared: false, hitCool: 0, dots: makePegDots('shield'),
        hp: armorHp, maxHp: armorHp, bossArmor: true,
        goldArmor: alwaysGold ? false : bossArmorRng() < GOLD_ARMOR_CHANCE,
        armorAngle: a,
      });
    }
    if (alwaysGold) ensureOneGoldBossArmor(pegs, bossArmorRng);
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
    const side = hazChance(wallRng, 0.5) ? 'left' : 'right';
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
  if (level >= 14 && hazChance(wallRng, 0.30, 14, level) && wallSegments.length < 2) {
    const side = hazChance(wallRng, 0.5) ? 'left' : 'right';
    const yMin = segYMin + wallRng() * (segYMax - segYMin);
    wallSegments.push({ side, yMin, yMax: yMin + segH, type: 'warp' });
  }
  if (level >= 16 && hazChance(wallRng, 0.30, 16, level) && wallSegments.length < 2) {
    const side = hazChance(wallRng, 0.5) ? 'left' : 'right';
    const yMin = segYMin + wallRng() * (segYMax - segYMin);
    wallSegments.push({ side, yMin, yMax: yMin + segH, type: 'distort' });
  }

  // ── Space hazards: comets, gravitational lenses, CME (each a level-gated 50% roll) ──
  const hazardRng = makeRng((rng() * 0x100000000) >>> 0);
  // Comet (lv12+): blue deflector that bounces around the field. Up to 3, each an
  // extra probabilistic roll that gets more likely as levels rise.
  const comets: Comet[] = [];
  if (level >= 12 && hazChance(hazardRng, 0.5, 12, level)) {
    let cometCount = 1;
    if (level >= 16 && hazChance(hazardRng, 0.45, 16, level)) cometCount++;                       // 2nd
    if (cometCount === 2 && level >= 22 && hazChance(hazardRng, 0.35, 22, level)) cometCount++;   // 3rd
    for (let c = 0; c < cometCount; c++) {
      // start off-screen; entry edge/height are pre-decided so the runtime can telegraph them
      comets.push({
        x: -100, y: -100, vx: 0, vy: 0, r: 18, hitCool: 0,
        respawnTimer: 30 + Math.floor(hazardRng() * 40),
        warnFromLeft: hazChance(hazardRng, 0.5),
        warnY: (launcherY + 60) + hazardRng() * ((H - launcherY) * 0.45),
        vanish: false, hitFlash: 0, hitX: 0, hitY: 0,
      });
    }
    // Binary variant (lv45+, 40%): the first blue comet enters as a braided pair — two
    // nuclei weaving around the shared path. Each nucleus is an ordinary comet body
    // (plain bounce physics); only the weave offset is new.
    if (level >= 45 && hazChance(hazardRng, 0.4)) {
      const lead = comets[0];
      lead.orbitPhase = 0;
      comets.push({ ...lead, orbitPhase: Math.PI });
    }
  }
  // Red comet (lv18+): destroys any ball it touches; crosses and exits (not bouncing).
  // Up to 2 — the 2nd is a rare, high-level-only extra roll.
  if (level >= 18 && hazChance(hazardRng, 0.4, 18, level)) {
    let redCount = 1;
    if (level >= 26 && hazChance(hazardRng, 0.3, 26, level)) redCount++;   // 2nd red comet
    for (let c = 0; c < redCount; c++) {
      comets.push({
        x: -100, y: -100, vx: 0, vy: 0, r: 18, hitCool: 0,
        respawnTimer: 30 + Math.floor(hazardRng() * 40),
        warnFromLeft: hazChance(hazardRng, 0.5),
        warnY: (launcherY + 60) + hazardRng() * ((H - launcherY) * 0.45),
        vanish: true, hitFlash: 0, hitX: 0, hitY: 0,
        // Returning variant (lv50+, 40%): after crossing, it comes back once — one lane
        // lower, from the side it just left — before its normal respawn cycle.
        returns: level >= 50 && hazChance(hazardRng, 0.4),
      });
    }
  }
  // Gravitational lens (lv15+): tangential swirl that bends ball paths. 2 lenses from lv28.
  const lenses: Lens[] = [];
  if (level >= 15 && hazChance(hazardRng, 0.5, 15, level)) {
    const lensCount = level >= 28 ? 2 : 1;
    const strength  = 0.45 + Math.min(1.1, (level - 15) * 0.03);
    for (let l = 0; l < lensCount; l++) {
      const lx = W * (0.20 + hazardRng() * 0.60);
      const ly = topPad + playH * (0.20 + hazardRng() * 0.55);
      lenses.push({ x: lx, y: ly, r: 62, dir: hazChance(hazardRng, 0.5) ? 1 : -1, strength });
    }
    // Counter-rotating twin variant (lv48+, 40%): the 2nd lens locks in next to the 1st,
    // spinning the other way — an S-bend corridor. Offset points roughly boardcenter-ward
    // so the twin stays inside the spawn box without needing a hard clamp.
    if (lensCount === 2 && level >= 48 && hazChance(hazardRng, 0.4)) {
      const first = lenses[0];
      const toC   = Math.atan2((topPad + playH * 0.475) - first.y, W * 0.5 - first.x);
      const a0    = toC + (hazardRng() - 0.5) * 1.2;
      lenses[1].x   = Math.min(W * 0.80, Math.max(W * 0.20, first.x + Math.cos(a0) * 140));
      lenses[1].y   = Math.min(topPad + playH * 0.75, Math.max(topPad + playH * 0.20, first.y + Math.sin(a0) * 140));
      lenses[1].dir = first.dir === 1 ? -1 : 1;
      // The x/y clamps are independent, so a corner-adjacent first lens can pull the twin
      // under one diameter (2r=124) — re-project along the same axis to keep the fields apart.
      const tdx = lenses[1].x - first.x, tdy = lenses[1].y - first.y;
      const td  = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
      if (td < 124) {
        lenses[1].x = Math.min(W * 0.80, Math.max(W * 0.20, first.x + (tdx / td) * 124));
        lenses[1].y = Math.min(topPad + playH * 0.75, Math.max(topPad + playH * 0.20, first.y + (tdy / td) * 124));
      }
    }
  }
  // CME (lv20+): periodic top→bottom shockwave sweep. Period shrinks with level.
  const cme = { active: false, period: 0 };
  if (level >= 20 && hazChance(hazardRng, 0.5, 20, level)) {
    cme.active = true;
    cme.period = Math.max(180, 380 - level * 5);
  }

  // ── Deep-space hazards (lv24+): each gets its own rng stream, seeded after all
  // existing draws, so adding/tuning one never shifts older levels' layouts.
  // Pulsar (lv24+): rotating twin radiation beams push balls outward.
  const pulsarRng = makeRng((rng() * 0x100000000) >>> 0);
  const pulsars: Pulsar[] = [];
  if (level >= 24 && hazChance(pulsarRng, 0.5, 24, level)) {
    pulsars.push({
      x: W * (0.25 + pulsarRng() * 0.50),
      y: topPad + playH * (0.25 + pulsarRng() * 0.45),
      angle: pulsarRng() * Math.PI,
      rotSpeed: (hazChance(pulsarRng, 0.5) ? 1 : -1) * PULSAR_ROT,
      beamLen: PULSAR_BEAM_LEN + Math.min(70, Math.max(0, (level - 24) * 6)),
    });
    // Tri-beam variant (lv54+, 40%): three one-way beams at 120° — the lighthouse
    // becomes a slowly turning trident (same force per beam, no safe opposite side).
    if (level >= 54 && hazChance(pulsarRng, 0.4)) pulsars[0].beams = 3;
  }
  // Gravitational wave (lv27+): periodic ripple ring bends every ball it passes.
  const gwRng = makeRng((rng() * 0x100000000) >>> 0);
  const gravWaves: GravWave[] = [];
  if (level >= 27 && hazChance(gwRng, 0.5, 27, level)) {
    gravWaves.push({
      ex: W * (0.15 + gwRng() * 0.70),
      ey: topPad + playH * (0.10 + gwRng() * 0.35),
      radius: -1,
      period: Math.max(220, 400 - level * 5),
      timer: 120 + Math.floor(gwRng() * 120),
      dir: hazChance(gwRng, 0.5) ? 1 : -1,
    });
  }
  // Vacuum decay bubble (lv29+): expanding sphere of "wrong physics" (gravity flips inside).
  const vacRng = makeRng((rng() * 0x100000000) >>> 0);
  const vacuums: VacuumBubble[] = [];
  if (level >= 29 && hazChance(vacRng, 0.5, 29, level)) {
    const vacRMax = 90 + Math.min(40, Math.max(0, (level - 29) * 4));
    const vacGrow = 0.085;
    vacuums.push({
      x: W * (0.25 + vacRng() * 0.50),
      y: topPad + playH * (0.30 + vacRng() * 0.40),
      r: VAC_R0,
      rMax: vacRMax,
      grow: vacGrow,
      respawnTimer: 0,
      popFlash: 0,
    });
    // Anti-phase pair variant (lv52+, 40%): a second bubble breathing on the opposite
    // beat — it starts dormant for half a growth cycle, so one swells as the other rests.
    if (level >= 52 && hazChance(vacRng, 0.4)) {
      // Keep the pair at least one full radius apart (rejection sampling): overlapping
      // bubbles would double-apply the antigravity in the intersection.
      let vx2 = W * 0.5, vy2 = topPad + playH * 0.5;
      for (let attempt = 0; attempt < 20; attempt++) {
        vx2 = W * (0.25 + vacRng() * 0.50);
        vy2 = topPad + playH * (0.30 + vacRng() * 0.40);
        const sdx = vx2 - vacuums[0].x, sdy = vy2 - vacuums[0].y;
        if (sdx * sdx + sdy * sdy >= vacRMax * vacRMax) break;
      }
      vacuums.push({
        x: vx2,
        y: vy2,
        r: VAC_R0,
        rMax: vacRMax,
        grow: vacGrow,
        respawnTimer: Math.round((vacRMax - VAC_R0) / vacGrow * 0.5),
        popFlash: 0,
      });
    }
  }
  // White hole (lv23+): radial repulsion, the visual/physical inverse of the black hole.
  const whiteHoleRng = makeRng((rng() * 0x100000000) >>> 0);
  const whiteHoles: WhiteHole[] = [];
  if (level >= 23 && hazChance(whiteHoleRng, 0.5, 23, level)) {
    whiteHoles.push({
      x: W * (0.25 + whiteHoleRng() * 0.50),
      y: topPad + playH * (0.25 + whiteHoleRng() * 0.45),
      strength: WH_PUSH + Math.min(0.55, Math.max(0, (level - 23) * 0.03)),
    });
  }
  // Magnetar (lv31+): periodic starquake flare that shoves nearby balls outward.
  const magnetarRng = makeRng((rng() * 0x100000000) >>> 0);
  const magnetars: Magnetar[] = [];
  if (level >= 31 && hazChance(magnetarRng, 0.5, 31, level)) {
    magnetars.push({
      x: W * (0.25 + magnetarRng() * 0.50),
      y: topPad + playH * (0.25 + magnetarRng() * 0.45),
      period: Math.max(180, 300 - Math.max(0, (level - 31) * 8)),
      timer: 90 + Math.floor(magnetarRng() * 90),
      releaseTimer: 0,
    });
    // Drifting variant (lv63+, 40%): the star wanders on the rogue-BH Lissajous path
    // around its spawn point — the flare's danger zone never stays where you left it.
    if (level >= 63 && hazChance(magnetarRng, 0.4)) {
      magnetars[0].cx0 = magnetars[0].x;
      magnetars[0].cy0 = magnetars[0].y;
    }
  }
  // Rogue planet (lv32+): a drifting gravity well with a solid bounce body.
  const roguePlanetRng = makeRng((rng() * 0x100000000) >>> 0);
  const roguePlanets: RoguePlanet[] = [];
  if (level >= 32 && hazChance(roguePlanetRng, 0.45, 32, level)) {
    const spd = 0.35 + Math.max(0, (level - 32) * 0.01);
    roguePlanets.push({
      x: W * (0.30 + roguePlanetRng() * 0.40),
      y: topPad + playH * (0.25 + roguePlanetRng() * 0.30),
      vx: (hazChance(roguePlanetRng, 0.5) ? 1 : -1) * spd * (0.7 + roguePlanetRng() * 0.4),
      vy: (hazChance(roguePlanetRng, 0.5) ? 1 : -1) * spd * (0.4 + roguePlanetRng() * 0.3),
      r: RP_R,
      hitCool: 0,
      ringTilt: roguePlanetRng() * Math.PI,
    });
  }
  // Quasar jet (lv33+): a fixed plasma column that flings balls along its axis.
  const quasarJetRng = makeRng((rng() * 0x100000000) >>> 0);
  const quasarJets: QuasarJet[] = [];
  if (level >= 33 && hazChance(quasarJetRng, 0.45, 33, level)) {
    const y0   = topPad + playH * (0.15 + quasarJetRng() * 0.25);
    const jlen = playH * (0.35 + quasarJetRng() * 0.25);
    quasarJets.push({
      bx: W * (0.25 + quasarJetRng() * 0.50),
      y0,
      y1: y0 + jlen,
      dir: hazChance(quasarJetRng, 0.5) ? 1 : -1,
      accel: 0.30 + Math.min(0.30, Math.max(0, (level - 33) * 0.015)),
    });
  }
  // Evaporating micro black hole (lv34+): shrinking pull → evaporation burst → re-form.
  const microBHRng = makeRng((rng() * 0x100000000) >>> 0);
  const microBHs: MicroBH[] = [];
  if (level >= 34 && hazChance(microBHRng, 0.45, 34, level)) {
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
  // Dark matter halo (lv48+): a nearly invisible attraction source (magnet-style, enlarged).
  const darkHaloRng = makeRng((rng() * 0x100000000) >>> 0);
  const darkHalos: DarkHalo[] = [];
  if (level >= 48 && hazChance(darkHaloRng, 0.45, 48, level)) {
    darkHalos.push({
      x: W * (0.25 + darkHaloRng() * 0.50),
      y: topPad + playH * (0.25 + darkHaloRng() * 0.45),
      strength: DM_PULL + Math.min(0.30, Math.max(0, (level - 48) * 0.015)),
      shimmer: 60 + Math.floor(darkHaloRng() * 90),
    });
  }
  // Ergosphere (lv36+): a ring band where a one-way tangential drag drags balls around it
  // (a rotating BH's frame-dragging region). The centre stays inert — only the band pulls.
  const ergoRng = makeRng((rng() * 0x100000000) >>> 0);
  const ergospheres: Ergosphere[] = [];
  if (level >= 36 && hazChance(ergoRng, 0.45, 36, level)) {
    ergospheres.push({
      x: W * (0.25 + ergoRng() * 0.50),
      y: topPad + playH * (0.25 + ergoRng() * 0.45),
      r0: ERGO_R0,
      r1: ERGO_R1,
      strength: ERGO_DRAG + Math.min(0.5, Math.max(0, (level - 36) * 0.02)),
      dir: hazChance(ergoRng, 0.5) ? 1 : -1,
    });
  }
  // Magnetic reconnection (lv37+): an X of field lines, inert until a periodic snap ejects
  // balls outward along whichever line they're on. Fully passable between snaps.
  const mrRng = makeRng((rng() * 0x100000000) >>> 0);
  const magReconnections: MagReconnection[] = [];
  if (level >= 37 && hazChance(mrRng, 0.45, 37, level)) {
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
  if (level >= 38 && hazChance(snRng, 0.45, 38, level)) {
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
  if (level >= 39 && hazChance(tsRng, 0.45, 39, level)) {
    tidalStretches.push({
      x: W * (0.25 + tsRng() * 0.50),
      y: topPad + playH * (0.25 + tsRng() * 0.45),
      strength: Math.min(0.05, TS_K_BASE + Math.max(0, (level - 39) * 0.002)),
    });
  }
  // Tachyon stream (lv88+): a fixed diagonal band that accelerates any ball inside it along
  // the band direction. Fully passable (no along-axis bound, only a perpendicular one).
  const tcRng = makeRng((rng() * 0x100000000) >>> 0);
  const tachyonStreams: TachyonStream[] = [];
  if (level >= 88 && hazChance(tcRng, 0.45, 88, level)) {
    tachyonStreams.push({
      x: W * (0.3 + tcRng() * 0.4),
      y: topPad + playH * (0.3 + tcRng() * 0.4),
      angle: tcRng() * Math.PI * 2,
      halfWidth: Math.min(TACHYON_WIDTH_MAX, TACHYON_WIDTH_BASE + (level - 88) * 3) / 2,
    });
  }
  // Cosmic void (lv42+): a near-empty elliptical patch of low gravity + faint drag. Gravity
  // is only halved (never zero), so a ball always sinks out — stuck-rescue is the backstop.
  const voidRng = makeRng((rng() * 0x100000000) >>> 0);
  const cosmicVoids: CosmicVoid[] = [];
  if (level >= 42 && hazChance(voidRng, 0.45, 42, level)) {
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
  if (level >= 43 && hazChance(axionRng, 0.45, 43, level)) {
    const count = hazChance(axionRng, 0.3) ? 2 : 1;
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
  if (level >= 44 && hazChance(frbRng, 0.40, 44, level)) {
    const period = Math.max(240, 400 - (level - 44) * 10);
    frbSources.push({
      x: hazChance(frbRng, 0.5) ? 4 : W - 4,
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
  if (level >= 45 && !hasRedComet && hazChance(afRng, 0.40, 45, level)) {
    const count = hazChance(afRng, 0.4) ? 2 : 1;
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
  // Quantum tunneling barrier (lv84+): rolls a fresh 50/50 on first contact — reflect or
  // pass clean through. Never placed near-horizontal (no dish-shaped catch platform).
  const qbRng = makeRng((rng() * 0x100000000) >>> 0);
  const quantumBarriers: QuantumBarrier[] = [];
  if (level >= 84 && hazChance(qbRng, 0.40, 84, level)) {
    let angle = qbRng() * Math.PI;
    if (Math.abs(angle) < 0.35 || Math.abs(angle - Math.PI) < 0.35) {
      angle += (Math.PI / 2) * (hazChance(qbRng, 0.5) ? 1 : -1);
    }
    quantumBarriers.push({
      x: W * (0.25 + qbRng() * 0.5),
      y: topPad + playH * (0.25 + qbRng() * 0.5),
      angle,
      reflectFlash: 0,
      passingBalls: new WeakSet<Ball>(),
    });
  }
  // Time dilation field (lv52+): a static circular field that halves ball speed inside
  // (doubling it back on exit). Gravity is also halved while inside — never zeroed, so
  // the ball always sinks out.
  const tdRng = makeRng((rng() * 0x100000000) >>> 0);
  const timeDilations: TimeDilation[] = [];
  if (level >= 52 && hazChance(tdRng, 0.40, 52, level)) {
    timeDilations.push({
      x: W * (0.3 + tdRng() * 0.4),
      y: topPad + playH * (0.3 + tdRng() * 0.4),
    });
  }

  // Cosmic string (lv86+): a relic 1px line whose crossing instantly shifts the ball a fixed
  // distance along the line's own axis (velocity unchanged) — a miniature, always-on
  // teleport confined to translating along one line. shift grows +1px per level over 86.
  const csRng = makeRng((rng() * 0x100000000) >>> 0);
  const cosmicStrings: CosmicString[] = [];
  if (level >= 86 && hazChance(csRng, 0.40, 86, level)) {
    cosmicStrings.push({
      x: W * (0.25 + csRng() * 0.5),
      y: topPad + playH * (0.25 + csRng() * 0.5),
      angle: csRng() * Math.PI,
      dir: hazChance(csRng, 0.5) ? 1 : -1,
      shift: Math.min(CS_SHIFT_MAX, CS_SHIFT_BASE + (level - 86)),
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
  if (level >= 49 && hazChance(deRng, 0.40, 49, level)) {
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
  if (level >= 51 && hazChance(gtsRng, 0.40, 51, level)) {
    galacticTidalStreams.push({
      cx: W * (0.25 + gtsRng() * 0.5),
      cy: topPad + playH * (0.25 + gtsRng() * 0.5),
      radius: GTS_RADIUS_MIN + gtsRng() * (GTS_RADIUS_MAX - GTS_RADIUS_MIN),
      angleStart: gtsRng() * Math.PI * 2,
      dir: hazChance(gtsRng, 0.5) ? 1 : -1,
      flow: Math.min(GTS_FLOW_MAX, GTS_FLOW_BASE + Math.max(0, level - 51) * GTS_FLOW_PER_LV),
    });
  }

  // Einstein mirror ring (lv52+): a fixed-radius ring line whose crossing mirror-reflects
  // velocity about the local tangent (speed-preserving). Not level-scaled per spec.
  const emrRng = makeRng((rng() * 0x100000000) >>> 0);
  const einsteinMirrorRings: EinsteinMirrorRing[] = [];
  if (level >= 52 && hazChance(emrRng, 0.40, 52, level)) {
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
  if (level >= 53 && hazChance(nsRng, 0.35, 53, level)) {
    nakedSingularities.push({
      x: W * (0.3 + nsRng() * 0.4),
      y: topPad + playH * (0.3 + nsRng() * 0.4),
      spinAngle: 0,
    });
  }

  // Hypervelocity star (lv66+): comet-like crossing traveler with no solid body — a trailing
  // gravitational wake drags balls toward its direction of travel instead of a bounce.
  const hvsRng = makeRng((rng() * 0x100000000) >>> 0);
  const hyperStars: HyperStar[] = [];
  if (level >= 66 && hazChance(hvsRng, 0.45, 66, level)) {
    hyperStars.push({
      x: -100, y: -100, vx: 0, vy: 0,
      respawnTimer: 30 + Math.floor(hvsRng() * 40),
      warnFromLeft: hazChance(hvsRng, 0.5),
      warnY: (launcherY + 60) + hvsRng() * ((H - launcherY) * 0.45),
    });
  }

  // Rogue black hole (lv69+): a homeless supermassive BH ejected by a galaxy-merger kick,
  // drifting on a slow Lissajous path. Reuses the main BH's pull formula, just with a
  // moving center (see the physics section) instead of a fixed GravZone.
  const rbhRng = makeRng((rng() * 0x100000000) >>> 0);
  const rogueBHs: RogueBH[] = [];
  if (level >= 69 && hazChance(rbhRng, 0.45, 69, level)) {
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
  if (level >= 56 && gravWaves.length === 0 && hazChance(orcRng, 0.45, 56, level)) {
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
  if (level >= 57 && hazChance(tdeRng, 0.45, 57, level)) {
    tidalDisruptions.push({
      x: W * (0.3 + tdeRng() * 0.4),
      y: topPad + playH * (0.3 + tdeRng() * 0.4),
      dir: hazChance(tdeRng, 0.5) ? 1 : -1,
    });
  }

  // Great Attractor (lv59+): a pull toward a point off-screen (left or right wall, generation-
  // time decision) — the first point-attraction hazard whose source is never on the board and
  // never absorbs. Zone A (lv54-59)'s last gimmick.
  const gaRng = makeRng((rng() * 0x100000000) >>> 0);
  let greatAttractor: GreatAttractor | null = null;
  if (level >= 59 && hazChance(gaRng, 0.45, 59, level)) {
    const side: 1 | -1 = hazChance(gaRng, 0.5) ? -1 : 1;
    greatAttractor = {
      x: side === -1 ? -GA_OFFSCREEN_X : W + GA_OFFSCREEN_X,
      y: H * 0.4,
      side,
    };
  }

  // Bullet Cluster (lv64+): Zone B collision structure — see interface comment above for the
  // DM-leads/gas-trails design. Reuses the HVS warn/traverse/respawn state machine, purely
  // horizontal (no vy field at all).
  const bcRng = makeRng((rng() * 0x100000000) >>> 0);
  const bulletClusters: BulletCluster[] = [];
  if (level >= 64 && hazChance(bcRng, 0.45, 64, level)) {
    bulletClusters.push({
      x: -100, vx: 0,
      hitCool: 0, hitFlash: 0, hitX: 0, hitY: 0,
      respawnTimer: 30 + Math.floor(bcRng() * 40),
      warnFromLeft: hazChance(bcRng, 0.5),
      warnY: (launcherY + 60) + bcRng() * ((H - launcherY) * 0.45),
    });
  }

  // Baryon Acoustic Oscillation (lv63+): three static concentric rings — see interface
  // comment above. Center placed with margin for the outer ring (165px) to mostly stay
  // on-board.
  const baoRng = makeRng((rng() * 0x100000000) >>> 0);
  const baryonOscillations: BaryonOscillation[] = [];
  if (level >= 63 && hazChance(baoRng, 0.45, 63, level)) {
    baryonOscillations.push({
      x: W * (0.35 + baoRng() * 0.30),
      y: topPad + playH * (0.30 + baoRng() * 0.35),
      litBins: [new Array(BAO_LIT_BINS).fill(0), new Array(BAO_LIT_BINS).fill(0), new Array(BAO_LIT_BINS).fill(0)],
    });
  }

  // Laniakea Basin (lv61+): Zone B opener — three curved streamlines converging on one shared
  // sink point at a screen edge. Sink side and each stream's start angle/curvature are all
  // drawn from the dedicated stream so layout stays deterministic per level.
  const lbRng = makeRng((rng() * 0x100000000) >>> 0);
  const laniakeaBasins: LaniakeaBasin[] = [];
  if (level >= 61 && hazChance(lbRng, 0.45, 61, level)) {
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
      const curveMag = (60 + lbRng() * 60) * (hazChance(lbRng, 0.5) ? 1 : -1);
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
  let gwBackgroundActive = level >= 64 && gravWaves.length === 0 && hazChance(gwbRng, 0.45, 64, level);

  // Cosmic Birefringence (lv65+): a tilted pass-through sheet — see interface comment above.
  // Zone B's final gimmick.
  const cbRng = makeRng((rng() * 0x100000000) >>> 0);
  const cosmicBirefringences: CosmicBirefringence[] = [];
  if (level >= 65 && hazChance(cbRng, 0.40, 65, level)) {
    cosmicBirefringences.push({
      x: W * (0.25 + cbRng() * 0.5),
      y: topPad + playH * (0.25 + cbRng() * 0.5),
      angle: cbRng() * Math.PI,
      hitFlash: 0, hitX: 0, hitY: 0, hitAngle: 0,
    });
  }

  // Little Red Dot (lv68+): early-universe seed (JWST-inspired) — see interface comment.
  // Skipped on levels that already have a red comet, to avoid two similar hazards competing.
  const lrdRng = makeRng((rng() * 0x100000000) >>> 0);
  const littleRedDots: LittleRedDot[] = [];
  const hasRedCometLRD = comets.some(c => c.vanish);
  if (level >= 68 && !hasRedCometLRD && hazChance(lrdRng, 0.45, 68, level)) {
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

  // Primordial Black Hole (lv76+): several tiny invisible pull points — see interface comment
  // above. Generation rejects candidates closer than PBH_MIN_DIST to any already-placed point
  // (bounded attempts, so a very cramped board just yields fewer points rather than hanging).
  const pbhRng = makeRng((rng() * 0x100000000) >>> 0);
  const primordialBHs: PrimordialBH[] = [];
  if (level >= 76 && hazChance(pbhRng, 0.45, 76, level)) {
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
  if (level >= 73 && hazChance(dsRng, 0.45, 73, level)) {
    darkStars.push({
      x: W * (0.25 + dsRng() * 0.5),
      y: topPad + playH * (0.25 + dsRng() * 0.5),
    });
  }

  // CMB Anisotropy (lv74+): board-wide temperature map. Bake a sparse mottled-dot field once
  // so each frame only modulates alpha — never re-evaluates sin for every pixel.
  const cmbRng = makeRng((rng() * 0x100000000) >>> 0);
  let cmbAnisotropy: CmbAnisotropy | null = null;
  if (level >= 74 && hazChance(cmbRng, 0.40, 74, level)) {
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
  if (level >= 75 && gravWaves.length === 0 && oddRadioCircles.length === 0 && hazChance(hpRng, 0.40, 75, level)) {
    const hpCount = 1 + (hazChance(hpRng, 0.45) ? 1 : 0); // 1-2
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
  if (level >= 81 && hazChance(qfRng, 0.40, 81, level)) {
    quantumFoams.push({
      x: W * (0.25 + qfRng() * 0.50),
      y: topPad + playH * (0.25 + qfRng() * 0.50),
    });
  }

  // Black Hole Firewall (lv83+): a burning arc barrier — reflect + scramble.
  const fwRng = makeRng((rng() * 0x100000000) >>> 0);
  const firewalls: Firewall[] = [];
  if (level >= 83 && hazChance(fwRng, 0.40, 83, level)) {
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
  if (level >= 85 && ergospheres.length === 0 && hazChance(srRng, 0.40, 85, level)) {
    superradiances.push({
      x: W * (0.25 + srRng() * 0.50),
      y: topPad + playH * (0.25 + srRng() * 0.50),
      dir: hazChance(srRng, 0.5) ? 1 : -1,
      spinMult: 1,
      waveTimer: 0, waveX: 0, waveY: 0,
      occupied: false,
      prevBallAng: new WeakMap(),
    });
  }

  // Negative Mass Blob (lv87+): a chasing hole that pushes balls away — never catches them.
  const nmbRng = makeRng((rng() * 0x100000000) >>> 0);
  const negMassBlobs: NegMassBlob[] = [];
  if (level >= 87 && hazChance(nmbRng, 0.35, 87, level)) {
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
  if (level >= 91 && hazChance(bucRng, 0.40, 91, level)) {
    bubbleUniverses.push({
      x: W * (0.25 + bucRng() * 0.50),
      y: topPad + playH * (0.25 + bucRng() * 0.50),
      tilt: (hazChance(bucRng, 0.5) ? 1 : -1) * BUC_TILT,
      edgeFlash: 0, edgeAng: 0,
      insideBalls: new WeakSet(),
    });
  }

  // Big Rip Precursor (lv93+): board-wide pulsed expansion that grows fiercer each cycle.
  // Skip if a local dark-energy patch is already present (same "distance-proportional
  // repulsion" niche — keep them on separate levels).
  const brRng = makeRng((rng() * 0x100000000) >>> 0);
  let bigRip: BigRip | null = null;
  if (level >= 93 && darkEnergyPatches.length === 0 && hazChance(brRng, 0.40, 93, level)) {
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
  if (level >= 95 && hazChance(cccRng, 0.40, 95, level)) {
    cccBoundary = { streakTimer: 0, streakX: 0, streakFromY: 0 };
  }

  // The Nothing (lv99+): a circular void of total force absence. Clear pegs that land
  // inside so the blank circle stays empty (collisions would break the "no physics" feel).
  const nothingRng = makeRng((rng() * 0x100000000) >>> 0);
  const theNothings: TheNothing[] = [];
  if (level >= 99 && hazChance(nothingRng, 0.35, 99, level)) {
    let nx = W * (0.25 + nothingRng() * 0.50);
    let ny = topPad + playH * (0.30 + nothingRng() * 0.40);
    // Keep the blank circle clear of the depth hollow (itself a blank disc at board
    // center at lv99) — if the two absences merge, The Nothing becomes undetectable.
    // Push radially away from center, then clamp back into the play field. Same two
    // nothingRng draws as before, so the rng stream is untouched.
    const hollowR  = depthHollow(level) * Math.min(W, H) * 0.28;
    const nMinDist = hollowR + NOTHING_RANGE * 0.45;
    let ndx = nx - W / 2, ndy = ny - H / 2;
    let nd = Math.hypot(ndx, ndy);
    if (nd < nMinDist) {
      if (nd < 1) { ndx = 1; ndy = -0.6; nd = Math.hypot(ndx, ndy); }
      nx = Math.max(W * 0.18, Math.min(W * 0.82, W / 2 + (ndx / nd) * nMinDist));
      ny = Math.max(topPad + playH * 0.22, Math.min(topPad + playH * 0.78, H / 2 + (ndy / nd) * nMinDist));
    }
    theNothings.push({ x: nx, y: ny });
    for (let i = pegs.length - 1; i >= 0; i--) {
      const p = pegs[i];
      const dx = p.x - nx, dy = p.y - ny;
      if (dx * dx + dy * dy < NOTHING_RANGE * NOTHING_RANGE) pegs.splice(i, 1);
    }
  }

  // Declared before anomaly clearing so curated levels can explicitly empty every hazard.
  // Its dedicated rng is consumed only after the anomaly stream below, preserving every
  // existing stream seed including the anomaly composition itself.
  const cosmicShears: CosmicShear[] = [];
  const collisionlessShocks: CollisionlessShock[] = [];
  const silkDampingClouds: SilkDampingCloud[] = [];
  const planckGratings: PlanckDiffractionGrating[] = [];
  const vacuumCherenkovDomains: VacuumCherenkovDomain[] = [];
  const closedTimelikeCurves: ClosedTimelikeCurve[] = [];
  const gravitationalCaustics: GravitationalCaustic[] = [];
  const neutrinoOscillations: NeutrinoOscillation[] = [];
  const gravWaveMemories: GravWaveMemory[] = [];
  const einsteinCrosses: EinsteinCross[] = [];
  const quantumZenoSectors: QuantumZenoSector[] = [];
  let chirpBinary: TransSolarChirp | null = null;
  const fuzzySolitons: FuzzySoliton[] = [];
  const axionMicrolenses: AxionMicrolens[] = [];
  const holographicRGSheets: HolographicRGSheet[] = [];
  let horizonEntropyActive = false;
  let entropicDragActive = false;
  let pop31Flash: Pop31Flash | null = null;
  const runawaySMBHs: RunawaySMBH[] = [];
  const phantomMembranes: PhantomMembrane[] = [];
  let alensActive = false;
  const bigRings: BigRing[] = [];
  const kszPatches: KszPatch[] = [];
  let subsolarPbhEcho: SubsolarPbhEcho | null = null;
  let quintomBreathActive = false;
  const bhStarCocoons: BhStarCocoon[] = [];
  let dualH0Seam: DualH0Seam | null = null;
  let hdHumActive = false;
  let momCoupActive = false;
  const bosonCaustics: BosonCaustic[] = [];
  const iaContams: IaContam[] = [];
  const signIdeSeams: SignIdeSeam[] = [];
  const phantomBelts: PhantomBelt[] = [];
  const mBiasVeils: MBiasVeil[] = [];
  let varCoupActive = false;
  const photoZGates: PhotoZGate[] = [];
  let blueHumActive = false;
  const s8Seams: S8Seam[] = [];
  let isoBireActive = false;
  let isoBireBeta = ISOBIRE_BETA;
  let sidmSpike: SidmSpike | null = null;
  const nuNullBands: NuNullBand[] = [];
  const tcDmHalos: TcDmHalo[] = [];
  const fsSoftFields: FsSoftField[] = [];
  const ommCores: OmmCore[] = [];
  const frbMicrolenses: FrbMicrolens[] = [];
  const pmfClumps: PmfClump[] = [];
  const ideSiphonBands: IdeSiphonBand[] = [];
  const vacLeaks: VacLeak[] = [];
  let gravEcho: GravEcho | null = null;
  let reion = { active: false, period: 0, timer: 0 };

  // ─── Anomaly specials (every 5th non-boss level) ─────────────────────────────
  // Replace the rolled hazards with one curated, single-theme composition. This runs
  // AFTER every normal roll, so this level's already-rolled layout is untouched and
  // the run's rng stream advances by exactly one extra draw (the anomaly seed).
  // Board furniture (pegs, bumpers, walls) stays; only the cosmic cast changes.
  let anomalyKind: AnomalyKind | null = null;
  if (specialKind(level) === 'special') {
    const anomalyRng = makeRng((rng() * 0x100000000) >>> 0);
    const pool: AnomalyKind[] = ['meteorShower'];
    if (level >= 30) pool.push('dipole');
    if (level >= 40) pool.push('colony');
    if (level >= 50) pool.push('silence');
    if (level >= 60) pool.push('redDay');
    if (level >= 200) {
      pool.push('signFlipDay');
      pool.push('calibrationDay');
    }
    anomalyKind = pool[Math.floor(anomalyRng() * pool.length)];
    for (const arr of [gravZones, wormholes, comets, lenses, pulsars, gravWaves, vacuums,
      whiteHoles, magnetars, roguePlanets, quasarJets, microBHs, darkHalos, ergospheres,
      magReconnections, preSupernovae, tidalStretches, tachyonStreams, cosmicVoids, cosmicShears, collisionlessShocks, silkDampingClouds, planckGratings, vacuumCherenkovDomains, closedTimelikeCurves, gravitationalCaustics, neutrinoOscillations, gravWaveMemories, einsteinCrosses, quantumZenoSectors, fuzzySolitons, axionMicrolenses, holographicRGSheets, axionWalls,
      frbSources, antimatterFlecks, quantumBarriers, timeDilations, cosmicStrings,
      darkEnergyPatches, galacticTidalStreams, einsteinMirrorRings, nakedSingularities,
      hyperStars, rogueBHs, oddRadioCircles, tidalDisruptions, bulletClusters,
      baryonOscillations, laniakeaBasins, cosmicBirefringences, littleRedDots, primordialBHs,
      darkStars, hawkingPoints, quantumFoams, firewalls, superradiances, negMassBlobs,
      bubbleUniverses, theNothings, runawaySMBHs, phantomMembranes, bigRings, kszPatches, bhStarCocoons] as { length: number }[]) arr.length = 0;
    cme.active = false;
    reion.active = false; reion.period = 0; reion.timer = 0;
    greatAttractor = null; bigRip = null; cccBoundary = null; cmbAnisotropy = null;
    gwBackgroundActive = false; chirpBinary = null; horizonEntropyActive = false; entropicDragActive = false; pop31Flash = null; alensActive = false;
    subsolarPbhEcho = null;
    quintomBreathActive = false; dualH0Seam = null; hdHumActive = false; momCoupActive = false; varCoupActive = false; blueHumActive = false; isoBireActive = false; sidmSpike = null;
    nuNullBands.length = 0; tcDmHalos.length = 0; fsSoftFields.length = 0; ommCores.length = 0;
    frbMicrolenses.length = 0; pmfClumps.length = 0; ideSiphonBands.length = 0; vacLeaks.length = 0; gravEcho = null; bosonCaustics.length = 0; iaContams.length = 0; signIdeSeams.length = 0; phantomBelts.length = 0; mBiasVeils.length = 0; photoZGates.length = 0; s8Seams.length = 0;

    if (anomalyKind === 'meteorShower') {
      // A shower of blue comets and nothing else (gentler count before lv15).
      const n = (level < 15 ? 3 : 4) + Math.floor(anomalyRng() * 3);
      for (let c = 0; c < n; c++) {
        comets.push({
          x: -100, y: -100, vx: 0, vy: 0, r: 18, hitCool: 0,
          respawnTimer: 20 + Math.floor(anomalyRng() * 90),
          warnFromLeft: anomalyRng() < 0.5,
          warnY: (launcherY + 60) + anomalyRng() * ((H - launcherY) * 0.45),
          vanish: false, hitFlash: 0, hitX: 0, hitY: 0,
        });
      }
    } else if (anomalyKind === 'dipole') {
      // A black hole and a white hole holding the board between them.
      const zoneW = W * 0.55, zoneH = 55;
      const bhLeft = anomalyRng() < 0.5;
      gravZones.push({
        x: bhLeft ? W * 0.02 : W - zoneW - W * 0.02,
        y: topPad + playH * (0.50 + anomalyRng() * 0.15),
        w: zoneW, h: zoneH, flashTimer: 0,
      });
      whiteHoles.push({
        x: bhLeft ? W * 0.72 : W * 0.28,
        y: topPad + playH * (0.18 + anomalyRng() * 0.12),
        strength: WH_PUSH + Math.min(0.55, Math.max(0, (level - 23) * 0.03)),
      });
    } else if (anomalyKind === 'colony') {
      // One safe hazard species, in numbers a normal level never rolls.
      const species = Math.floor(anomalyRng() * 4);
      if (species === 0) {
        for (let i = 0; i < 4; i++) lenses.push({
          x: W * (0.28 + 0.44 * (i % 2)) + (anomalyRng() - 0.5) * 40,
          y: topPad + playH * (0.28 + 0.36 * Math.floor(i / 2)) + (anomalyRng() - 0.5) * 30,
          r: 62, dir: i % 2 === 0 ? 1 : -1,
          strength: 0.45 + Math.min(1.1, Math.max(0, (level - 15) * 0.03)),
        });
      } else if (species === 1) {
        for (let i = 0; i < 3; i++) pulsars.push({
          x: W * (0.22 + 0.28 * i),
          y: topPad + playH * (0.22 + 0.24 * i),
          angle: anomalyRng() * Math.PI,
          rotSpeed: (i % 2 === 0 ? 1 : -1) * PULSAR_ROT,
          beamLen: PULSAR_BEAM_LEN + Math.min(70, Math.max(0, (level - 24) * 6)),
        });
      } else if (species === 2) {
        for (let i = 0; i < 3; i++) vacuums.push({
          x: W * (0.20 + 0.30 * i),
          y: topPad + playH * (0.30 + (i % 2) * 0.30),
          r: VAC_R0,
          rMax: 80 + Math.min(30, Math.max(0, (level - 29) * 3)),
          grow: 0.085, respawnTimer: Math.floor(anomalyRng() * 60), popFlash: 0,
        });
      } else {
        for (let i = 0; i < 3; i++) whiteHoles.push({
          x: W * (0.25 + 0.25 * i),
          y: topPad + playH * (i === 1 ? 0.55 : 0.25),
          strength: WH_PUSH + Math.min(0.4, Math.max(0, (level - 23) * 0.02)),
        });
      }
    } else if (anomalyKind === 'redDay') {
      // Only red things live here: crossing red comets, and (deep enough) red dots.
      const n = 2 + (level >= 75 && anomalyRng() < 0.5 ? 1 : 0);
      for (let c = 0; c < n; c++) {
        comets.push({
          x: -100, y: -100, vx: 0, vy: 0, r: 18, hitCool: 0,
          respawnTimer: 30 + Math.floor(anomalyRng() * 60),
          warnFromLeft: anomalyRng() < 0.5,
          warnY: (launcherY + 60) + anomalyRng() * ((H - launcherY) * 0.45),
          vanish: true, hitFlash: 0, hitX: 0, hitY: 0,
        });
      }
      if (level >= 68) {
        const lrdN = 3 + Math.floor(anomalyRng() * 2);
        for (let i = 0; i < lrdN; i++) littleRedDots.push({
          x: W * (0.15 + anomalyRng() * 0.7),
          y: topPad + playH * (0.15 + anomalyRng() * 0.7),
          phase: Math.floor(anomalyRng() * (LRD_ON_FRAMES + LRD_OFF_FRAMES)),
          hitCool: 0, hitFlash: 0, hitX: 0, hitY: 0,
        });
      }
    } else if (anomalyKind === 'signFlipDay') {
      // Zone K: signs lie. Two seams (sides + timer) and a board-wide coupling drift.
      signIdeSeams.push({
        cx: W * 0.35, cy: topPad + playH * 0.38,
        angle: -0.35, len: SIGNIDE_LEN, halfW: SIGNIDE_HALF,
        mode: 'sides', signFlip: 1, timer: 0, blinkTimer: 0,
      });
      signIdeSeams.push({
        cx: W * 0.65, cy: topPad + playH * 0.58,
        angle: 0.45, len: SIGNIDE_LEN * 0.9, halfW: SIGNIDE_HALF,
        mode: 'timer', signFlip: 1,
        timer: Math.floor(anomalyRng() * SIGNIDE_PERIOD), blinkTimer: 0,
      });
      varCoupActive = true;
    } else if (anomalyKind === 'calibrationDay') {
      // Zone K: calibration collapses. Speed lies (m-bias) and depth jumps (photo-z).
      mBiasVeils.push({
        x: W * 0.32, y: topPad + playH * 0.40,
        rx: MBIAS_RX, ry: MBIAS_RY, axis: 0.4, m: MBIAS_M,
      });
      mBiasVeils.push({
        x: W * 0.68, y: topPad + playH * 0.55,
        rx: MBIAS_RX * 0.9, ry: MBIAS_RY, axis: -0.7, m: -MBIAS_M,
      });
      photoZGates.push({
        x: W * 0.50, y: topPad + playH * 0.48,
        angle: -0.25 + anomalyRng() * 0.5,
        passingBalls: new WeakSet<Ball>(), flashTimer: 0,
      });
      if (level >= 208 || anomalyRng() < 0.55) {
        phantomBelts.push({
          y: topPad + playH * (0.32 + anomalyRng() * 0.36),
          halfW: PHBELT_HALF, flashTimer: 0,
        });
      }
    }
    // 'silence': nothing spawns at all — the stillness is handled at runtime
    // (dust nearly freezes, wind/fog/dark flow are suppressed in initLevel).
  }

  // Cosmic Shear Field (lv62+): this is the absolute final main-rng draw. Special levels
  // keep the array empty, preserving their curated single-theme composition.
  const cshRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 62 && hazChance(cshRng, 0.45, 62, level)) {
    const dots: CosmicShearDot[] = [];
    for (let i = 0; i < CSHEAR_DOTS; i++) {
      const a = cshRng() * Math.PI * 2;
      const r = Math.sqrt(cshRng()) * 0.88;
      dots.push({
        u: Math.cos(a) * r,
        v: Math.sin(a) * r,
        size: 2 + Math.floor(cshRng() * 2),
        phase: cshRng() * Math.PI * 2,
        warm: cshRng() < 0.5,
      });
    }
    cosmicShears.push({
      x: W * (0.24 + cshRng() * 0.52),
      y: topPad + playH * (0.24 + cshRng() * 0.52),
      rx: CSHEAR_RX,
      ry: CSHEAR_RY,
      axis: cshRng() * Math.PI,
      dots,
    });
  }

  // Collisionless shock (lv67+): absolute final main-rng draw after cosmic shear.
  const clsRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 67 && hazChance(clsRng, 0.40, 67, level)) {
    collisionlessShocks.push({
      x: -100, y: -100, vx: 0, vy: 0,
      armSpread: CLS_ARM_SPREAD,
      armLen: CLS_ARM_LEN,
      respawnTimer: 20 + Math.floor(clsRng() * 60),
      warnFromLeft: hazChance(clsRng, 0.5),
      warnY: (launcherY + 60) + clsRng() * ((H - launcherY) * 0.45),
      hitFlash: 0, hitX: 0, hitY: 0,
      passingBalls: new WeakSet<Ball>(),
    });
  }

  // Silk damping cloud (lv72+): final main-rng draw after collisionless shock.
  const silkRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 72 && hazChance(silkRng, 0.40, 72, level)) {
    const dots: SilkDot[] = [];
    for (let i = 0; i < SILK_DOTS; i++) {
      const a = silkRng() * Math.PI * 2;
      const r = Math.sqrt(silkRng()) * 0.9;
      dots.push({
        u: Math.cos(a) * r,
        v: Math.sin(a) * r,
        size: 1 + Math.floor(silkRng() * 2),
        warm: silkRng() < 0.5,
        phase: silkRng() * Math.PI * 2,
      });
    }
    silkDampingClouds.push({
      x: W * (0.22 + silkRng() * 0.56),
      y: topPad + playH * (0.22 + silkRng() * 0.56),
      rx: SILK_RX,
      ry: SILK_RY,
      axis: silkRng() * Math.PI,
      dots,
    });
  }

  // Planck diffraction grating (lv82+): main-rng draw after silk damping cloud.
  const pdgRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 82 && hazChance(pdgRng, 0.40, 82, level)) {
    planckGratings.push({
      x: W * (0.22 + pdgRng() * 0.56),
      y: topPad + playH * (0.22 + pdgRng() * 0.56),
      angle: pdgRng() * Math.PI,
      hitFlash: 0, hitX: 0, hitY: 0, hitOrder: 0,
    });
  }

  // Vacuum Cherenkov domain (lv89+): absolute final main-rng draw after planck grating.
  const vcRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 89 && hazChance(vcRng, 0.35, 89, level)) {
    vacuumCherenkovDomains.push({
      x: W * (0.24 + vcRng() * 0.52),
      y: topPad + playH * (0.24 + vcRng() * 0.52),
      axis: vcRng() * Math.PI,
      burstTimer: 0, burstX: 0, burstY: 0, burstVx: 0, burstVy: 0, burstFlip: 1,
    });
  }

  // Closed timelike curve (lv97+): main-rng draw after vacuum cherenkov.
  const ctcRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 97 && hazChance(ctcRng, 0.30, 97, level)) {
    closedTimelikeCurves.push({
      x: W * (0.26 + ctcRng() * 0.48),
      y: topPad + playH * (0.26 + ctcRng() * 0.48),
      gapAngle: ctcRng() * Math.PI * 2,
      warpLeft: 0, warpFromX: 0, warpFromY: 0, warpToX: 0, warpToY: 0,
    });
  }

  // Gravitational lensing caustic (lv65+): main-rng draw after CTC.
  const causticRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 65 && hazChance(causticRng, 0.40, 65, level)) {
    const angle = causticRng() * Math.PI;
    const midX = W * (0.28 + causticRng() * 0.44);
    const midY = topPad + playH * (0.28 + causticRng() * 0.44);
    const halfLen = W * 0.275;
    const bend = (causticRng() - 0.5) * 90;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const p0x = midX - ca * halfLen, p0y = midY - sa * halfLen;
    const p2x = midX + ca * halfLen, p2y = midY + sa * halfLen;
    const p1x = midX - sa * bend, p1y = midY + ca * bend;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < CAUSTIC_PTS; i++) {
      const t = i / (CAUSTIC_PTS - 1);
      const u = 1 - t;
      pts.push({
        x: u * u * p0x + 2 * u * t * p1x + t * t * p2x,
        y: u * u * p0y + 2 * u * t * p1y + t * t * p2y,
      });
    }
    gravitationalCaustics.push({
      pts,
      brightSide: causticRng() < 0.5 ? 1 : -1,
      hitFlash: 0, hitX: 0, hitY: 0,
      passingBalls: new WeakSet<Ball>(),
    });
  }

  // Reionization front (lv71+): main-rng draw after caustic.
  const reionRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 71 && hazChance(reionRng, 0.40, 71, level)) {
    reion = {
      active: true,
      period: REION_PERIOD,
      timer: Math.floor(reionRng() * REION_PERIOD),
    };
  }

  // Neutrino flavor oscillation (lv78+): main-rng draw after reionization.
  const neutrinoRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 78 && hazChance(neutrinoRng, 0.40, 78, level)) {
    neutrinoOscillations.push({
      x: W * (0.24 + neutrinoRng() * 0.52),
      y: topPad + playH * (0.24 + neutrinoRng() * 0.52),
      rx: NEUT_RX,
      ry: NEUT_RY,
      axis: neutrinoRng() * Math.PI,
    });
  }

  // Gravitational wave memory (lv85+): exclusive with classic gravWaves.
  const gwMemRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 85 && gravWaves.length === 0 && hazChance(gwMemRng, 0.40, 85, level)) {
    gravWaveMemories.push({
      ex: W * (0.20 + gwMemRng() * 0.60),
      ey: topPad + playH * (0.15 + gwMemRng() * 0.40),
      radius: -1,
      period: GWM_PERIOD,
      timer: 80 + Math.floor(gwMemRng() * 160),
      passingBalls: new WeakSet<Ball>(),
    });
  }

  // Einstein cross (lv94+): hub + 4 images with weak vector-summed pulls.
  const einCrossRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 94 && hazChance(einCrossRng, 0.45, 94, level)) {
    const cx = W * (0.28 + einCrossRng() * 0.44);
    const cy = topPad + playH * (0.26 + einCrossRng() * 0.48);
    const hubAngle = einCrossRng() * Math.PI * 2;
    const images: { x: number; y: number }[] = [];
    for (let n = 0; n < 4; n++) {
      const ang = hubAngle + n * Math.PI / 2 + (einCrossRng() - 0.5) * 0.24;
      images.push({ x: cx + Math.cos(ang) * ECROSS_R, y: cy + Math.sin(ang) * ECROSS_R });
    }
    einsteinCrosses.push({ cx, cy, hubAngle, images });
  }

  // Quantum Zeno observation (lv98+): exclusive with The Nothing.
  const zenoRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 98 && theNothings.length === 0 && hazChance(zenoRng, 0.35, 98, level)) {
    quantumZenoSectors.push({
      x: W * (0.26 + zenoRng() * 0.48),
      y: topPad + playH * (0.26 + zenoRng() * 0.48),
      rx: ZENO_RX,
      ry: ZENO_RY,
      axis: zenoRng() * Math.PI,
    });
  }

  // Trans-solar chirp binary (lv100+): board-wide speed-amplitude modulation.
  const chirpRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 100 && hazChance(chirpRng, 0.35, 100, level)) {
    chirpBinary = {
      cx: W * (0.30 + chirpRng() * 0.40),
      cy: topPad + playH * (0.28 + chirpRng() * 0.34),
      timer: Math.floor(chirpRng() * CHIRP_PERIOD),
      period: CHIRP_PERIOD,
      phaseOffset: chirpRng() * Math.PI * 2,
      mergeFlash: 0,
    };
  }

  // Fuzzy dark matter soliton (lv104+): tangential interference beat inside ellipse.
  const fdmRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 104 && hazChance(fdmRng, 0.40, 104, level)) {
    fuzzySolitons.push({
      x: W * (0.24 + fdmRng() * 0.52),
      y: topPad + playH * (0.24 + fdmRng() * 0.52),
      rx: FDM_RX,
      ry: FDM_RY,
      axis: fdmRng() * Math.PI,
    });
  }

  // Axion star microlens cluster (lv108+): invisible tangential sin points.
  const axStarRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 108 && hazChance(axStarRng, 0.40, 108, level)) {
    const axCount = 1 + Math.floor(axStarRng() * 2); // 1-2
    let axAttempts = 0;
    while (axionMicrolenses.length < axCount && axAttempts < 200) {
      axAttempts++;
      const ax = W * (0.18 + axStarRng() * 0.64);
      const ay = topPad + playH * (0.18 + axStarRng() * 0.64);
      let axOk = true;
      for (const a of axionMicrolenses) {
        const adx = a.x - ax, ady = a.y - ay;
        if (adx * adx + ady * ady < AXION_MIN_DIST * AXION_MIN_DIST) { axOk = false; break; }
      }
      if (!axOk) continue;
      axionMicrolenses.push({
        x: ax,
        y: ay,
        phase: Math.floor(axStarRng() * AXION_SHIMMER_PERIOD),
      });
    }
  }

  // Cosmological horizon entropy flow (lv112+): exclusive with Great Attractor.
  const horizonRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 112 && greatAttractor === null && hazChance(horizonRng, 0.40, 112, level)) {
    horizonEntropyActive = true;
  }

  // Holographic RG sheet (lv116+): OBB layer scale (Ball.rgLayer).
  const holoRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 116 && hazChance(holoRng, 0.35, 116, level)) {
    holographicRGSheets.push({
      x: W * (0.25 + holoRng() * 0.50),
      y: topPad + playH * (0.25 + holoRng() * 0.50),
      angle: holoRng() * Math.PI,
      hitFlash: 0, hitX: 0, hitY: 0, hitAngle: 0,
    });
  }

  // Mass-horizon entropic drag (lv119+): exclusive with Big Rip.
  const entropicRng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 119 && bigRip === null && hazChance(entropicRng, 0.35, 119, level)) {
    entropicDragActive = true;
  }

  // Pop III.1 Flash (lv122+): synchronized ionization patches. Exclusive with reionization
  // front here; fog exclusivity is enforced in initLevel after fog rolls.
  const pop31Rng = makeRng((rng() * 0x100000000) >>> 0);
  if (anomalyKind === null && level >= 122 && !reion.active && hazChance(pop31Rng, 0.40, 122, level)) {
    const nWant = 2 + (pop31Rng() < 0.5 ? 1 : 0);
    const patches: Pop31Patch[] = [];
    for (let i = 0; i < nWant; i++) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const px = W * (0.18 + pop31Rng() * 0.64);
        const py = topPad + playH * (0.22 + pop31Rng() * 0.50);
        const pr = POP31_R_MIN + pop31Rng() * (POP31_R_MAX - POP31_R_MIN);
        let ok = true;
        for (const q of patches) {
          const dx = q.x - px, dy = q.y - py;
          if (dx * dx + dy * dy < POP31_MIN_SEP * POP31_MIN_SEP) { ok = false; break; }
        }
        if (ok) { patches.push({ x: px, y: py, r: pr }); break; }
      }
    }
    if (patches.length > 0) {
      pop31Flash = {
        patches,
        period: POP31_PERIOD,
        timer: 80 + Math.floor(pop31Rng() * 100),
        releaseTimer: 0,
        recombTimer: 0,
      };
    }
  }

  // Runaway SMBH bow shock (lv126+): moving tip with V-bow push + cooling wake.
  // Exclusive with rogueBHs and red vanish comets (both are competing "ejected BH / kill" motifs).
  const runawayRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 126 &&
    rogueBHs.length === 0 &&
    !comets.some(c => c.vanish) &&
    hazChance(runawayRng, 0.40, 126, level)
  ) {
    const edge = Math.floor(runawayRng() * 3); // 0=left, 1=right, 2=top
    let sx: number, sy: number, ax: number, ay: number;
    if (edge === 0) {
      sx = -40;
      sy = topPad + playH * (0.25 + runawayRng() * 0.50);
      ax = W * (0.55 + runawayRng() * 0.35);
      ay = topPad + playH * (0.20 + runawayRng() * 0.60);
    } else if (edge === 1) {
      sx = W + 40;
      sy = topPad + playH * (0.25 + runawayRng() * 0.50);
      ax = W * (0.10 + runawayRng() * 0.35);
      ay = topPad + playH * (0.20 + runawayRng() * 0.60);
    } else {
      sx = W * (0.20 + runawayRng() * 0.60);
      sy = launcherY - 20;
      ax = W * (0.15 + runawayRng() * 0.70);
      ay = H * (0.55 + runawayRng() * 0.30);
    }
    let hx = ax - sx, hy = ay - sy;
    let hlen = Math.sqrt(hx * hx + hy * hy) || 1;
    hx /= hlen; hy /= hlen;
    // Prefer roughly diagonal travel across the board.
    if (Math.abs(hx) < 0.35) hx = (hx >= 0 ? 1 : -1) * 0.55;
    if (Math.abs(hy) < 0.35) hy = (hy >= 0 ? 1 : -1) * 0.55;
    hlen = Math.sqrt(hx * hx + hy * hy);
    hx /= hlen; hy /= hlen;
    runawaySMBHs.push({
      x: sx, y: sy,
      vx: hx * RBHS_SPEED,
      vy: hy * RBHS_SPEED,
      spawnX: sx, spawnY: sy,
      respawnTimer: 0,
    });
  }

  // Phantom Crossing Membrane (lv130+): thin OBB band that flips ball.wSign on midline
  // crossing; continuous weak force toward/away from midline based on wSign.
  // Exclusive with Big Rip and dark-energy patches (competing DE / phantom motifs).
  const phantomRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 130 &&
    bigRip === null &&
    darkEnergyPatches.length === 0 &&
    hazChance(phantomRng, 0.35, 130, level)
  ) {
    phantomMembranes.push({
      cx: W * (0.25 + phantomRng() * 0.50),
      cy: topPad + playH * (0.25 + phantomRng() * 0.50),
      len: PHANTOM_LEN,
      thick: PHANTOM_THICK,
      angle: phantomRng() * Math.PI,
      flashTimer: 0,
    });
  }

  // Alens lensing anomaly field (lv133+): board-wide speed-preserving micro-twist.
  // Exclusive with discrete gravWaves and gwBackground (same continuous-rotation family).
  const alensRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 133 &&
    gravWaves.length === 0 &&
    !gwBackgroundActive &&
    hazChance(alensRng, 0.35, 133, level)
  ) {
    alensActive = true;
  }

  // Big Ring uLSS (lv136+): large hollow ring with tangential-only band flow.
  // Exclusive with ORC / BAO (same sparse-ring visual family).
  const bigRingRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 136 &&
    oddRadioCircles.length === 0 &&
    baryonOscillations.length === 0 &&
    hazChance(bigRingRng, 0.35, 136, level)
  ) {
    bigRings.push({
      cx: W * (0.35 + bigRingRng() * 0.30),
      cy: topPad + playH * (0.35 + bigRingRng() * 0.30),
      r: BIGRING_R,
      halfW: BIGRING_HALF_W,
      dir: bigRingRng() < 0.5 ? 1 : -1,
    });
  }

  // Patchy kSZ kick (lv139+): elliptical wind patches with fixed-axis impulses.
  // Exclusive with Pop III.1 flash (#66) on the same level (competing patch-pulse motifs).
  const kszRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 139 &&
    pop31Flash === null &&
    hazChance(kszRng, 0.35, 139, level)
  ) {
    const nWant = 2 + (kszRng() < 0.5 ? 1 : 0);
    for (let i = 0; i < nWant; i++) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const cx = W * (0.18 + kszRng() * 0.64);
        const cy = topPad + playH * (0.22 + kszRng() * 0.50);
        const rx = KSZ_RX_MIN + kszRng() * (KSZ_RX_MAX - KSZ_RX_MIN);
        const ry = KSZ_RX_MIN + kszRng() * (KSZ_RX_MAX - KSZ_RX_MIN);
        let ok = true;
        for (const q of kszPatches) {
          const dx = q.cx - cx, dy = q.cy - cy;
          if (dx * dx + dy * dy < KSZ_MIN_SEP * KSZ_MIN_SEP) { ok = false; break; }
        }
        if (!ok) continue;
        const period = KSZ_PERIOD_MIN + Math.floor(kszRng() * (KSZ_PERIOD_MAX - KSZ_PERIOD_MIN + 1));
        kszPatches.push({
          cx, cy, rx, ry,
          axis: kszRng() * Math.PI * 2,
          period,
          timer: 60 + Math.floor(kszRng() * period),
          releaseTimer: 0,
        });
        break;
      }
    }
  }

  // Subsolar PBH echo merger (lv142+): two weak pulls approach → gravity-null echo → recondense.
  // Exclusive with microBHs / primordialBHs (same PBH family motifs).
  const spbhRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 142 &&
    microBHs.length === 0 &&
    primordialBHs.length === 0 &&
    hazChance(spbhRng, 0.35, 142, level)
  ) {
    const mx = W * (0.28 + spbhRng() * 0.44);
    const my = topPad + playH * (0.28 + spbhRng() * 0.42);
    const ang = spbhRng() * Math.PI * 2;
    const hx = Math.cos(ang) * SPBH_PAIR_SEP0 * 0.5;
    const hy = Math.sin(ang) * SPBH_PAIR_SEP0 * 0.5;
    subsolarPbhEcho = {
      x1: mx - hx, y1: my - hy,
      x2: mx + hx, y2: my + hy,
      phase: 0,
      timer: 0,
    };
  }

  // Quintom-B breathing gravity (lv146+): global gravity scale oscillates slowly.
  // Exclusive with bigRip / phantom membranes / DE patches (same dark-energy family).
  const quintomRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 146 &&
    bigRip === null &&
    phantomMembranes.length === 0 &&
    darkEnergyPatches.length === 0 &&
    hazChance(quintomRng, 0.35, 146, level)
  ) {
    quintomBreathActive = true;
  }

  // Black Hole Star cocoon (lv150+): shell drag + periodic tear pulse.
  // Exclusive with littleRedDots (#34) — competing compact-red motifs.
  const bhStarRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 150 &&
    littleRedDots.length === 0 &&
    hazChance(bhStarRng, 0.35, 150, level)
  ) {
    bhStarCocoons.push({
      x: W * (0.28 + bhStarRng() * 0.44),
      y: topPad + playH * (0.30 + bhStarRng() * 0.40),
      timer: 90 + Math.floor(bhStarRng() * BHS_PERIOD),
      tearTimer: 0,
      tearAng: bhStarRng() * Math.PI * 2,
    });
  }

  // Dual-H0 seam (lv153+): tilted gravity split + one-shot seam twist.
  // Exclusive with alens / gwBackground (global-twist family).
  const dualH0Rng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 153 &&
    !alensActive &&
    !gwBackgroundActive &&
    hazChance(dualH0Rng, 0.35, 153, level)
  ) {
    dualH0Seam = {
      cx: W * (0.42 + dualH0Rng() * 0.16),
      cy: topPad + playH * (0.40 + dualH0Rng() * 0.20),
      angle: -0.55 + dualH0Rng() * 1.10, // mostly diagonal
      lastSide: new WeakMap(),
    };
  }

  // Hellings-Downs correlation hum (lv156+): angle-dependent pair twist (not global in-phase).
  // Exclusive with gwBackground / alens / gravWaves (same continuous-rotation family).
  const hdHumRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 156 &&
    !gwBackgroundActive &&
    !alensActive &&
    gravWaves.length === 0 &&
    hazChance(hdHumRng, 0.35, 156, level)
  ) {
    hdHumActive = true;
  }

  // SIDM final-parsec spike (lv159+): dual fixed cores + inter-core tangential friction.
  // Exclusive with chirpBinary / bulletClusters (competing binary / DM-pair motifs).
  const sidmRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 159 &&
    chirpBinary === null &&
    bulletClusters.length === 0 &&
    hazChance(sidmRng, 0.35, 159, level)
  ) {
    const mx = W * (0.30 + sidmRng() * 0.40);
    const my = topPad + playH * (0.30 + sidmRng() * 0.40);
    const ang = sidmRng() * Math.PI * 2;
    const hx = Math.cos(ang) * SIDM_SEP * 0.5;
    const hy = Math.sin(ang) * SIDM_SEP * 0.5;
    sidmSpike = {
      x1: mx - hx, y1: my - hy,
      x2: mx + hx, y2: my + hy,
      dir: sidmRng() < 0.5 ? 1 : -1,
    };
  }

  // Neutrino mass null band (lv162+): gravity mass-term fades inside a tilted strip.
  // Exclusive with Quintom / dualH0 (competing gravity-mod family).
  const nuNullRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 162 &&
    !quintomBreathActive &&
    dualH0Seam === null &&
    hazChance(nuNullRng, 0.35, 162, level)
  ) {
    nuNullBands.push({
      cx: W * (0.30 + nuNullRng() * 0.40),
      cy: topPad + playH * (0.30 + nuNullRng() * 0.40),
      angle: -0.7 + nuNullRng() * 1.4,
      len: NUNULL_LEN,
      halfW: NUNULL_HALF,
    });
  }

  // Two-component DM segregation (lv165+): heavy inward core + light outward shell.
  // Exclusive with sidmSpike / darkHalos / primordialBHs.
  const tcDmRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 165 &&
    sidmSpike === null &&
    darkHalos.length === 0 &&
    primordialBHs.length === 0 &&
    hazChance(tcDmRng, 0.35, 165, level)
  ) {
    tcDmHalos.push({
      x: W * (0.28 + tcDmRng() * 0.44),
      y: topPad + playH * (0.28 + tcDmRng() * 0.44),
    });
  }

  // Free-streaming softening (lv168+): warm-DM path smoothing inside an ellipse.
  // Exclusive with silkDampingClouds / quantumFoams.
  const fsSoftRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 168 &&
    silkDampingClouds.length === 0 &&
    quantumFoams.length === 0 &&
    hazChance(fsSoftRng, 0.35, 168, level)
  ) {
    fsSoftFields.push({
      x: W * (0.28 + fsSoftRng() * 0.44),
      y: topPad + playH * (0.28 + fsSoftRng() * 0.44),
      rx: FSSOFT_RX,
      ry: FSSOFT_RY,
    });
  }

  // Overmassive mimic core (lv171+): oversized visual cocoon, weak true pull + brief reveal burst.
  // Exclusive with bhStarCocoons / microBHs (compact-red / cocoon family).
  const ommRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 171 &&
    bhStarCocoons.length === 0 &&
    microBHs.length === 0 &&
    hazChance(ommRng, 0.35, 171, level)
  ) {
    ommCores.push({
      x: W * (0.28 + ommRng() * 0.44),
      y: topPad + playH * (0.30 + ommRng() * 0.40),
      timer: 60 + Math.floor(ommRng() * OMM_PERIOD),
      burstTimer: 0,
    });
  }

  // FRB microlens IMBH (lv174+): thin caustic arc with one-shot kick+twist.
  // Exclusive with axionMicrolenses / gravitationalCaustics.
  const frbMlRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 174 &&
    axionMicrolenses.length === 0 &&
    gravitationalCaustics.length === 0 &&
    bosonCaustics.length === 0 &&
    hazChance(frbMlRng, 0.35, 174, level)
  ) {
    frbMicrolenses.push({
      x: W * (0.28 + frbMlRng() * 0.44),
      y: topPad + playH * (0.28 + frbMlRng() * 0.44),
      ang0: frbMlRng() * Math.PI * 2,
      flashTimer: 0,
      passingBalls: new WeakSet(),
    });
  }

  // Primordial B-field baryon clumps (lv177+): 2-3 weak aggregation nuclei.
  // Exclusive with cmbAnisotropy / pop31Flash.
  const pmfRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 177 &&
    cmbAnisotropy === null &&
    pop31Flash === null &&
    hazChance(pmfRng, 0.35, 177, level)
  ) {
    const nWant = 2 + (pmfRng() < 0.5 ? 1 : 0);
    for (let i = 0; i < nWant; i++) {
      pmfClumps.push({
        x: W * (0.22 + pmfRng() * 0.56),
        y: topPad + playH * (0.24 + pmfRng() * 0.48),
        phase: pmfRng() * Math.PI * 2,
      });
    }
  }

  // IDE energy siphon band (lv182+): dwell raises gravity, fades outward micro-push.
  // Exclusive with Quintom / nuNull / dualH0 (gravity-mod family).
  const ideSiphonRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 182 &&
    !quintomBreathActive &&
    nuNullBands.length === 0 &&
    dualH0Seam === null &&
    hazChance(ideSiphonRng, 0.35, 182, level)
  ) {
    ideSiphonBands.push({
      cx: W * (0.30 + ideSiphonRng() * 0.40),
      cy: topPad + playH * (0.30 + ideSiphonRng() * 0.40),
      angle: -0.7 + ideSiphonRng() * 1.4,
      len: IDESIP_LEN,
      halfW: IDESIP_HALF,
    });
  }

  // Vacuum decay leak (lv188+): static circle, periodic weak inward seep.
  // Exclusive with vacuum bubbles / bigRip (vacuum family).
  const vacLeakRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 188 &&
    vacuums.length === 0 &&
    bigRip === null &&
    hazChance(vacLeakRng, 0.35, 188, level)
  ) {
    vacLeaks.push({
      x: W * (0.28 + vacLeakRng() * 0.44),
      y: topPad + playH * (0.28 + vacLeakRng() * 0.44),
      age: Math.floor(vacLeakRng() * (VACLEAK_T + VACLEAK_REST)),
    });
  }

  // Gravity echo delay (lv191+): fixed epicenter + delayed micro-twist.
  // Exclusive with hdHum / alens / gravWaves / gwBackground (twist/correlation family).
  const gravEchoRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 191 &&
    !hdHumActive &&
    !alensActive &&
    gravWaves.length === 0 &&
    !gwBackgroundActive &&
    hazChance(gravEchoRng, 0.35, 191, level)
  ) {
    gravEcho = {
      x: W * (0.30 + gravEchoRng() * 0.40),
      y: topPad + playH * (0.30 + gravEchoRng() * 0.40),
      buf: new Array(GRAVECHO_DELAY).fill(0),
      write: 0,
    };
  }

  // Momentum-only dark coupling (lv185+): pair tangential align, no net acceleration.
  // Exclusive with hdHum / alens / gwBackground (twist/correlation family).
  const momCoupRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 185 &&
    !hdHumActive &&
    !alensActive &&
    !gwBackgroundActive &&
    hazChance(momCoupRng, 0.35, 185, level)
  ) {
    momCoupActive = true;
  }

  // Boson star soft caustic (lv194+): hollow extended lens, rim folds heading once.
  // Exclusive with frbMicrolenses / axionMicrolenses / gravitationalCaustics.
  const bosonCaustRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 194 &&
    frbMicrolenses.length === 0 &&
    axionMicrolenses.length === 0 &&
    gravitationalCaustics.length === 0 &&
    hazChance(bosonCaustRng, 0.35, 194, level)
  ) {
    bosonCaustics.push({
      x: W * (0.28 + bosonCaustRng() * 0.44),
      y: topPad + playH * (0.28 + bosonCaustRng() * 0.44),
      ghostTimer: 0,
      ghostX: 0,
      ghostY: 0,
      passingBalls: new WeakSet<Ball>(),
    });
  }

  // Intrinsic alignment contaminant (lv197+): fake shear paralleling headings to a fixed axis.
  // Exclusive with alens / cosmicShears / hdHum (twist/shear family).
  const iaContamRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 197 &&
    !alensActive &&
    cosmicShears.length === 0 &&
    !hdHumActive &&
    hazChance(iaContamRng, 0.35, 197, level)
  ) {
    iaContams.push({
      x: W * (0.28 + iaContamRng() * 0.44),
      y: topPad + playH * (0.28 + iaContamRng() * 0.44),
      rx: IACONT_RX,
      ry: IACONT_RY,
      axis: iaContamRng() * Math.PI,
    });
  }

  // Sign-switching IDE seam (lv202+): weak pull/push reverses across a tilted seam.
  // Exclusive with ideSiphon / Quintom / nuNull / dualH0.
  const signIdeRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 202 &&
    ideSiphonBands.length === 0 &&
    !quintomBreathActive &&
    nuNullBands.length === 0 &&
    dualH0Seam === null &&
    hazChance(signIdeRng, 0.35, 202, level)
  ) {
    const mode: 'sides' | 'timer' = signIdeRng() < 0.55 ? 'sides' : 'timer';
    signIdeSeams.push({
      cx: W * (0.30 + signIdeRng() * 0.40),
      cy: topPad + playH * (0.30 + signIdeRng() * 0.40),
      angle: -0.6 + signIdeRng() * 1.2,
      len: SIGNIDE_LEN,
      halfW: SIGNIDE_HALF,
      mode,
      signFlip: 1,
      timer: Math.floor(signIdeRng() * SIGNIDE_PERIOD),
      blinkTimer: 0,
    });
  }

  // Phantom Crossing Belt (lv208+): thin horizontal band; gravity scale flips on cross.
  // Exclusive with phantom membranes / Quintom / bigRip.
  const phantBeltRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 208 &&
    phantomMembranes.length === 0 &&
    !quintomBreathActive &&
    bigRip === null &&
    hazChance(phantBeltRng, 0.35, 208, level)
  ) {
    phantomBelts.push({
      y: topPad + playH * (0.28 + phantBeltRng() * 0.44),
      halfW: PHBELT_HALF,
      flashTimer: 0,
    });
  }

  // Multiplicative shear bias veil (lv211+): speed-only miscalibration inside an ellipse.
  // Exclusive with iaContams / alens / cosmicShears.
  const mBiasRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 211 &&
    iaContams.length === 0 &&
    !alensActive &&
    cosmicShears.length === 0 &&
    hazChance(mBiasRng, 0.35, 211, level)
  ) {
    mBiasVeils.push({
      x: W * (0.28 + mBiasRng() * 0.44),
      y: topPad + playH * (0.28 + mBiasRng() * 0.44),
      rx: MBIAS_RX,
      ry: MBIAS_RY,
      axis: mBiasRng() * Math.PI,
      m: mBiasRng() < 0.5 ? MBIAS_M : -MBIAS_M,
    });
  }

  // Variable coupling drift (lv205+): board-wide gravity scale oscillates slowly.
  // Exclusive with Quintom / dualH0 / ideSiphon / signIde.
  const varCoupRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 205 &&
    !quintomBreathActive &&
    dualH0Seam === null &&
    ideSiphonBands.length === 0 &&
    signIdeSeams.length === 0 &&
    hazChance(varCoupRng, 0.35, 205, level)
  ) {
    varCoupActive = true;
  }

  // Catastrophic photo-z gate (lv214+): thin OBB; 20% depth jump along heading.
  // Exclusive with cosmicStrings / holographicRG / planckGratings.
  const photoZRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 214 &&
    cosmicStrings.length === 0 &&
    holographicRGSheets.length === 0 &&
    planckGratings.length === 0 &&
    hazChance(photoZRng, 0.35, 214, level)
  ) {
    photoZGates.push({
      x: W * (0.28 + photoZRng() * 0.44),
      y: topPad + playH * (0.28 + photoZRng() * 0.44),
      angle: -0.7 + photoZRng() * 1.4,
      passingBalls: new WeakSet<Ball>(),
      flashTimer: 0,
    });
  }

  // Blue-tilted primordial hum (lv217+): depth-dependent twist frequency (deeper = higher ω).
  // Exclusive with hdHum / alens / gwBackground / gravEcho / gravWaves.
  const blueHumRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 217 &&
    !hdHumActive &&
    !alensActive &&
    !gwBackgroundActive &&
    gravEcho === null &&
    gravWaves.length === 0 &&
    hazChance(blueHumRng, 0.35, 217, level)
  ) {
    blueHumActive = true;
  }

  // S8 bifurcation seam (lv222+): DES-heavy vs KiDS-light gravity growth across a seam.
  // Exclusive with dualH0 / nuNull / signIde / varCoup.
  const s8SeamRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 222 &&
    dualH0Seam === null &&
    nuNullBands.length === 0 &&
    signIdeSeams.length === 0 &&
    !varCoupActive &&
    hazChance(s8SeamRng, 0.35, 222, level)
  ) {
    s8Seams.push({
      cx: W * (0.30 + s8SeamRng() * 0.40),
      cy: topPad + playH * (0.30 + s8SeamRng() * 0.40),
      angle: -0.6 + s8SeamRng() * 1.2,
      lastSide: new WeakMap<Ball, number>(),
    });
  }

  // Isotropic cosmic birefringence drift (lv231+): board-wide constant-handedness micro-twist.
  // Exclusive with cosmicBirefringences / alens / blueHum / hdHum / gwBackground.
  const isoBireRng = makeRng((rng() * 0x100000000) >>> 0);
  if (
    anomalyKind === null &&
    level >= 231 &&
    cosmicBirefringences.length === 0 &&
    !alensActive &&
    !blueHumActive &&
    !hdHumActive &&
    !gwBackgroundActive &&
    hazChance(isoBireRng, 0.35, 231, level)
  ) {
    isoBireActive = true;
    isoBireBeta = isoBireRng() < 0.5 ? ISOBIRE_BETA : -ISOBIRE_BETA;
  }

  // ─── Zone remix (gap levels) ───────────────────────────────────────────────
  // On non-unlock, non-anomaly levels inside a depth zone, 25% chance to force two
  // zone-local hazards to coexist so deep boards feel "of this depth" rather than
  // a random soup of early hazards. Dedicated remixRng — does not reshuffle prior rolls.
  const ZONE_K_UNLOCKS = new Set([202, 205, 208, 211, 214, 217]);
  if (
    anomalyKind === null &&
    level >= 200 &&
    level <= 219 &&
    !ZONE_K_UNLOCKS.has(level)
  ) {
    const remixRng = makeRng((rng() * 0x100000000) >>> 0);
    if (remixRng() < 0.25) {
      type KId = 'signIde' | 'phantBelt' | 'mBias' | 'varCoup' | 'photoZ' | 'blueHum';
      const pairs: [KId, KId][] = [
        ['signIde', 'mBias'],
        ['signIde', 'photoZ'],
        ['signIde', 'phantBelt'],
        ['signIde', 'blueHum'],
        ['phantBelt', 'mBias'],
        ['phantBelt', 'photoZ'],
        ['phantBelt', 'blueHum'],
        ['mBias', 'photoZ'],
        ['mBias', 'blueHum'],
        ['varCoup', 'phantBelt'],
        ['varCoup', 'mBias'],
        ['varCoup', 'photoZ'],
        ['varCoup', 'blueHum'],
        ['photoZ', 'blueHum'],
      ];
      const can = (id: KId): boolean => {
        if (id === 'signIde') {
          return ideSiphonBands.length === 0 && !quintomBreathActive && nuNullBands.length === 0
            && dualH0Seam === null && !varCoupActive;
        }
        if (id === 'phantBelt') {
          return phantomMembranes.length === 0 && !quintomBreathActive && bigRip === null;
        }
        if (id === 'mBias') {
          return iaContams.length === 0 && !alensActive && cosmicShears.length === 0;
        }
        if (id === 'varCoup') {
          return !quintomBreathActive && dualH0Seam === null && ideSiphonBands.length === 0
            && signIdeSeams.length === 0;
        }
        if (id === 'photoZ') {
          return cosmicStrings.length === 0 && holographicRGSheets.length === 0
            && planckGratings.length === 0;
        }
        // blueHum
        return !hdHumActive && !alensActive && !gwBackgroundActive
          && gravEcho === null && gravWaves.length === 0;
      };
      const present = (id: KId): boolean => {
        if (id === 'signIde') return signIdeSeams.length > 0;
        if (id === 'phantBelt') return phantomBelts.length > 0;
        if (id === 'mBias') return mBiasVeils.length > 0;
        if (id === 'varCoup') return varCoupActive;
        if (id === 'photoZ') return photoZGates.length > 0;
        return blueHumActive;
      };
      const ensure = (id: KId) => {
        if (present(id) || !can(id)) return;
        if (id === 'signIde') {
          const mode: 'sides' | 'timer' = remixRng() < 0.55 ? 'sides' : 'timer';
          signIdeSeams.push({
            cx: W * (0.30 + remixRng() * 0.40),
            cy: topPad + playH * (0.30 + remixRng() * 0.40),
            angle: -0.6 + remixRng() * 1.2,
            len: SIGNIDE_LEN, halfW: SIGNIDE_HALF, mode, signFlip: 1,
            timer: Math.floor(remixRng() * SIGNIDE_PERIOD), blinkTimer: 0,
          });
        } else if (id === 'phantBelt') {
          phantomBelts.push({
            y: topPad + playH * (0.28 + remixRng() * 0.44),
            halfW: PHBELT_HALF, flashTimer: 0,
          });
        } else if (id === 'mBias') {
          mBiasVeils.push({
            x: W * (0.28 + remixRng() * 0.44),
            y: topPad + playH * (0.28 + remixRng() * 0.44),
            rx: MBIAS_RX, ry: MBIAS_RY,
            axis: remixRng() * Math.PI,
            m: remixRng() < 0.5 ? MBIAS_M : -MBIAS_M,
          });
        } else if (id === 'varCoup') {
          varCoupActive = true;
        } else if (id === 'photoZ') {
          photoZGates.push({
            x: W * (0.28 + remixRng() * 0.44),
            y: topPad + playH * (0.28 + remixRng() * 0.44),
            angle: -0.7 + remixRng() * 1.4,
            passingBalls: new WeakSet<Ball>(), flashTimer: 0,
          });
        } else {
          blueHumActive = true;
        }
      };
      // Prefer pairs whose unlocks are already reachable at this depth.
      const unlocked = (id: KId): boolean => {
        if (id === 'signIde') return level >= 202;
        if (id === 'varCoup') return level >= 205;
        if (id === 'phantBelt') return level >= 208;
        if (id === 'mBias') return level >= 211;
        if (id === 'photoZ') return level >= 214;
        return level >= 217;
      };
      const eligible = pairs.filter(([a, b]) => unlocked(a) && unlocked(b) && can(a) && can(b));
      if (eligible.length > 0) {
        const [a, b] = eligible[Math.floor(remixRng() * eligible.length)];
        ensure(a);
        ensure(b);
      }
    }
  }

  return { pegs, orangeTotal: pegs.filter(p => p.type === 'orange').length, bumpers, gravZones, wormholes, wallSegments, boss, comets, lenses, cme, pulsars, gravWaves, vacuums, whiteHoles, magnetars, roguePlanets, quasarJets, microBHs, darkHalos, ergospheres, magReconnections, preSupernovae, tidalStretches, tachyonStreams, cosmicVoids, cosmicShears, collisionlessShocks, silkDampingClouds, planckGratings, vacuumCherenkovDomains, closedTimelikeCurves, gravitationalCaustics, neutrinoOscillations, gravWaveMemories, einsteinCrosses, quantumZenoSectors, chirpBinary, fuzzySolitons, axionMicrolenses, holographicRGSheets, axionWalls, frbSources, antimatterFlecks, quantumBarriers, timeDilations, cosmicStrings, darkEnergyPatches, galacticTidalStreams, einsteinMirrorRings, nakedSingularities, hyperStars, rogueBHs, oddRadioCircles, tidalDisruptions, greatAttractor, bulletClusters, baryonOscillations, laniakeaBasins, gwBackgroundActive, horizonEntropyActive, entropicDragActive, pop31Flash, runawaySMBHs, phantomMembranes, alensActive, bigRings, kszPatches, subsolarPbhEcho, quintomBreathActive, bhStarCocoons, dualH0Seam, hdHumActive, sidmSpike, nuNullBands, tcDmHalos, fsSoftFields, ommCores, frbMicrolenses, pmfClumps, ideSiphonBands, vacLeaks, gravEcho, momCoupActive, bosonCaustics, iaContams, signIdeSeams, phantomBelts, mBiasVeils, varCoupActive, photoZGates, blueHumActive, s8Seams, isoBireActive, isoBireBeta, cosmicBirefringences, littleRedDots, primordialBHs, darkStars, cmbAnisotropy, hawkingPoints, quantumFoams, firewalls, superradiances, negMassBlobs, bubbleUniverses, bigRip, cccBoundary, theNothings, anomalyKind, reion };
}

// ─── Trajectory preview ───────────────────────────────────────────────────────
// Runs every frame while aiming, so the points are written into a persistent module-level
// buffer instead of allocating a fresh array per call. Returns the number of valid points.
const TRAJ_MAX = 90;
const _trajBuf: TrajPt[] = Array.from({ length: TRAJ_MAX }, () => ({ x: 0, y: 0 }));
// Reused across firing frames so we don't allocate a fresh Ball[] every frame.
const _aliveBuf: Ball[] = [];
// Fog TV-static color layers (hoisted — was rebuilt every fog frame).
const FOG_STATIC_DEFS: [string, number, number, number][] = [
  ['#ffffff', 0.70, 35, 2],
  ['#f0ecff', 0.50, 55, 1],
  ['#c0a0ff', 0.28, 65, 2],
  ['#201440', 0.42, 50, 2],
  ['#050210', 0.55, 30, 1],
];
// Fog gradients are tied to the canvas context; rebuild only when geometry/DPR changes.
let _fogGradKey = '';
let _fogHazeGr: CanvasGradient | null = null;
let _fogFadeGr: CanvasGradient | null = null;

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
    continuePlay:        'Continue +3',
    extraShot:           '+1 Shot',
    paying:              'Paying...',
    paymentFailed:       'Payment failed',
    monthlyLimitReached: 'Monthly free payment limit reached. Paid shots resume next month.',
    payConfirmTitle:     'Confirm payment',
    payConfirmContinue:  'Continue with +3 shots',
    payConfirmExtra:     'Buy +1 shot',
    payConfirmCost:      'Cost',
    payConfirmPay:       'Pay with USDC',
    payConfirmCancel:    'Cancel',
    scoreZero:           'Score 0 cannot be recorded on-chain.',
    connectWallet:       'Connect Wallet',
    connecting:          'Connecting...',
    recordOnChain:       'Record On-Chain',
    recording:           'Recording...',
    failedRetry:         'Failed - Retry',
    disconnect:          'Disconnect',
    scoreRecorded:       'Score recorded on Base',
    viewOnBasescan:      'View on Basescan',
    walletConnected:     'Connected',
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
    continuePlay:        'コンティニュー +3',
    extraShot:           '+1 球',
    paying:              '支払い中...',
    paymentFailed:       '支払いに失敗しました',
    monthlyLimitReached: '今月の無料決済枠に達しました。追加購入は翌月に再開します。',
    payConfirmTitle:     '支払い確認',
    payConfirmContinue:  'コンティニュー（+3球）',
    payConfirmExtra:     '追加球（+1）',
    payConfirmCost:      '料金',
    payConfirmPay:       'USDCで支払う',
    payConfirmCancel:    'キャンセル',
    scoreZero:           'スコア0はオンチェーンに記録できません。',
    connectWallet:       'ウォレット接続',
    connecting:          '接続中...',
    recordOnChain:       'オンチェーンに記録',
    recording:           '記録中...',
    failedRetry:         '失敗 - 再試行',
    disconnect:          '切断',
    scoreRecorded:       'Baseにスコアを記録しました',
    viewOnBasescan:      'Basescanで確認',
    walletConnected:     '接続中',
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
    pegs: [], chainGroups: new Map(), bumpers: [],
    balls: [],
    burstRemaining: 0, burstTimer: 0, burstAngle: 0, burstLuckyIdx: 0, burstBucketProb: BUCKET_BALL_PROB,
    shotsLeft: SHOTS_START, score: 0, level: 1,
    aimAngle: 0,
    bursts: [], pegBreaks: [],
    bgDots: [], bgClusterTimer: 0,
    frame: 0,
    levelStartFrame: 0,
    anomalyKind: null,
    firePulse: null, unobservedTimer: 40,
    wrongTimer: 2400, wrongKind: 0, wrongPeg: null, wrongFrames: 0,
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
    cosmicShears: [],
    collisionlessShocks: [],
    silkDampingClouds: [],
    planckGratings: [],
    vacuumCherenkovDomains: [],
    closedTimelikeCurves: [],
    ctcStates: new WeakMap(),
    ctcUsed: new WeakSet(),
    gravitationalCaustics: [],
    neutrinoOscillations: [],
    gravWaveMemories: [],
    einsteinCrosses: [],
    quantumZenoSectors: [],
    chirpBinary: null,
    fuzzySolitons: [],
    axionMicrolenses: [],
    holographicRGSheets: [],
    holoSides: new WeakMap(),
    gwMemories: new WeakMap(),
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
    cdaLights: [],
    quantumFoams: [],
    firewalls: [],
    superradiances: [],
    negMassBlobs: [],
    bubbleUniverses: [],
    bigRip: null,
    cccBoundary: null,
    theNothings: [],
    gwBackgroundActive: false,
    horizonEntropyActive: false,
    entropicDragActive: false,
    pop31Flash: null,
    runawaySMBHs: [],
    phantomMembranes: [],
    alensActive: false,
    bigRings: [],
    kszPatches: [],
    subsolarPbhEcho: null,
    quintomBreathActive: false,
    bhStarCocoons: [],
    dualH0Seam: null,
    hdHumActive: false,
    sidmSpike: null,
    nuNullBands: [],
    tcDmHalos: [],
    fsSoftFields: [],
    ommCores: [],
    frbMicrolenses: [],
    pmfClumps: [],
    ideSiphonBands: [],
    vacLeaks: [],
    gravEcho: null,
    momCoupActive: false,
    bosonCaustics: [],
    iaContams: [],
    signIdeSeams: [],
    phantomBelts: [],
    mBiasVeils: [],
    varCoupActive: false,
    photoZGates: [],
    blueHumActive: false,
    s8Seams: [],
    isoBireActive: false,
    isoBireBeta: ISOBIRE_BETA,
    cmeActive: false, cmePeriod: 0, cmeTimer: 0, cmeY: -1,
    reionActive: false, reionPeriod: 0, reionTimer: 0, reionY: -1,
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
    depthCrackKind: 0,
    depthCrackTimer: 0,
    depthWhisperKind: 0,
    depthWhisperTimer: 0,
    depthWhispersSeen: 0,
  });

  const preventNextFire = useRef(false);
  const continuesUsedRef = useRef(0);
  const extrasUsedRef = useRef(0);
  const lastCheckpointAt = useRef(0);
  const restoreAttempted = useRef(false);
  const checkpointRunRef = useRef<(force?: boolean) => void>(() => {});

  const [phase,      setPhase]      = useState<Phase>('idle');
  const [shotsLeft,  setShotsLeft]  = useState(SHOTS_START);
  const [score,      setScore]      = useState(0);
  const hudScore  = useRef(0);
  const hudShots  = useRef(SHOTS_START);
  const hudOrange = useRef(0);
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
  const [continuesUsed,    setContinuesUsed]    = useState(0);
  const [extrasUsed,       setExtrasUsed]       = useState(0);
  continuesUsedRef.current = continuesUsed;
  extrasUsedRef.current = extrasUsed;
  const [x402Busy,         setX402Busy]         = useState(false);
  const [x402Error,        setX402Error]        = useState<string | null>(null);
  const [x402Confirm,      setX402Confirm]      = useState<'continue' | 'extra' | null>(null);
  const [x402QuotaReached, setX402QuotaReached] = useState(false);
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

  /** Persist an aiming (or aiming-paused) checkpoint to localStorage. */
  const checkpointRun = useCallback((force = false) => {
    const g = G.current;
    const aiming =
      g.phase === 'aiming' ||
      (g.phase === 'paused' && g.prePausePhase === 'aiming');
    if (!aiming || g.balls.length > 0) return;
    const now = Date.now();
    if (!force && now - lastCheckpointAt.current < 2500) return;
    lastCheckpointAt.current = now;
    const snapshot: RunSnapshot = {
      schemaVersion: RUN_SAVE_VERSION,
      savedAt: now,
      boardW: g.W,
      boardH: g.H,
      continuesUsed: continuesUsedRef.current,
      extrasUsed: extrasUsedRef.current,
      state: serializeGameState(g),
    };
    saveRun(snapshot);
  }, []);
  checkpointRunRef.current = checkpointRun;

  // ── Init level ───────────────────────────────────────────────────────────
  const initLevel = useCallback((lv: number) => {
    const g = G.current;
    const { pegs, orangeTotal, bumpers, gravZones, wormholes, wallSegments, boss, comets, lenses, cme, pulsars, gravWaves, vacuums, whiteHoles, magnetars, roguePlanets, quasarJets, microBHs, darkHalos, ergospheres, magReconnections, preSupernovae, tidalStretches, tachyonStreams, cosmicVoids, cosmicShears, collisionlessShocks, silkDampingClouds, planckGratings, vacuumCherenkovDomains, closedTimelikeCurves, gravitationalCaustics, neutrinoOscillations, gravWaveMemories, einsteinCrosses, quantumZenoSectors, chirpBinary, fuzzySolitons, axionMicrolenses, holographicRGSheets, axionWalls, frbSources, antimatterFlecks, quantumBarriers, timeDilations, cosmicStrings, darkEnergyPatches, galacticTidalStreams, einsteinMirrorRings, nakedSingularities, hyperStars, rogueBHs, oddRadioCircles, tidalDisruptions, greatAttractor, bulletClusters, baryonOscillations, laniakeaBasins, gwBackgroundActive, horizonEntropyActive, entropicDragActive, pop31Flash, runawaySMBHs, phantomMembranes, alensActive, bigRings, kszPatches, subsolarPbhEcho, quintomBreathActive, bhStarCocoons, dualH0Seam, hdHumActive, sidmSpike, nuNullBands, tcDmHalos, fsSoftFields, ommCores, frbMicrolenses, pmfClumps, ideSiphonBands, vacLeaks, gravEcho, momCoupActive, bosonCaustics, iaContams, signIdeSeams, phantomBelts, mBiasVeils, varCoupActive, photoZGates, blueHumActive, s8Seams, isoBireActive, isoBireBeta, cosmicBirefringences, littleRedDots, primordialBHs, darkStars, cmbAnisotropy, hawkingPoints, quantumFoams, firewalls, superradiances, negMassBlobs, bubbleUniverses, bigRip, cccBoundary, theNothings, anomalyKind, reion } = generateLevel(g.W, g.H, g.launcherY, g.rng, lv);
    g.level          = lv;
    g.levelStartFrame = g.frame; // redshift pegs decay their score against this
    g.anomalyKind    = anomalyKind;
    g.pegs           = pegs;
    // Build chain lookup once so draw doesn't filter all pegs every frame.
    {
      const cg = new Map<number, Peg[]>();
      for (const p of pegs) {
        if (p.chainId === undefined) continue;
        let arr = cg.get(p.chainId);
        if (!arr) { arr = []; cg.set(p.chainId, arr); }
        arr.push(p);
      }
      g.chainGroups = cg;
    }
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
    // Bucket shrinks/speeds up with level, but more gradually so mid-game stays fair.
    // Floor width 36, speed cap 4.2 — deep levels demand precision without becoming impossible.
    g.bucketW   = Math.max(36, BUCKET_W - Math.floor((lv - 1) * 0.55));
    g.bucketSpd = Math.min(4.2, BUCKET_SPD + (lv - 1) * 0.035);
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
    g.cosmicShears = cosmicShears;
    g.collisionlessShocks = collisionlessShocks;
    g.silkDampingClouds = silkDampingClouds;
    g.planckGratings = planckGratings;
    g.vacuumCherenkovDomains = vacuumCherenkovDomains;
    g.closedTimelikeCurves = closedTimelikeCurves;
    g.ctcStates = new WeakMap();
    g.ctcUsed = new WeakSet();
    g.gravitationalCaustics = gravitationalCaustics;
    g.neutrinoOscillations = neutrinoOscillations;
    g.gravWaveMemories = gravWaveMemories;
    g.einsteinCrosses = einsteinCrosses;
    g.quantumZenoSectors = quantumZenoSectors;
    g.chirpBinary = chirpBinary;
    g.fuzzySolitons = fuzzySolitons;
    g.axionMicrolenses = axionMicrolenses;
    g.holographicRGSheets = holographicRGSheets;
    g.holoSides = new WeakMap();
    g.gwMemories = new WeakMap();
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
    g.horizonEntropyActive = horizonEntropyActive;
    g.entropicDragActive = entropicDragActive;
    g.pop31Flash = pop31Flash;
    g.runawaySMBHs = runawaySMBHs;
    g.phantomMembranes = phantomMembranes;
    g.alensActive = alensActive;
    g.bigRings = bigRings;
    g.kszPatches = kszPatches;
    g.subsolarPbhEcho = subsolarPbhEcho;
    g.quintomBreathActive = quintomBreathActive;
    g.bhStarCocoons = bhStarCocoons;
    g.dualH0Seam = dualH0Seam;
    g.hdHumActive = hdHumActive;
    g.sidmSpike = sidmSpike;
    g.nuNullBands = nuNullBands;
    g.tcDmHalos = tcDmHalos;
    g.fsSoftFields = fsSoftFields;
    g.ommCores = ommCores;
    g.frbMicrolenses = frbMicrolenses;
    g.pmfClumps = pmfClumps;
    g.ideSiphonBands = ideSiphonBands;
    g.vacLeaks = vacLeaks;
    g.gravEcho = gravEcho;
    g.momCoupActive = momCoupActive;
    g.bosonCaustics = bosonCaustics;
    g.iaContams = iaContams;
    g.signIdeSeams = signIdeSeams;
    g.phantomBelts = phantomBelts;
    g.mBiasVeils = mBiasVeils;
    g.varCoupActive = varCoupActive;
    g.photoZGates = photoZGates;
    g.blueHumActive = blueHumActive;
    g.s8Seams = s8Seams;
    g.isoBireActive = isoBireActive;
    g.isoBireBeta = isoBireBeta;
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
    g.reionActive  = reion.active;
    g.reionPeriod  = reion.period;
    g.reionTimer   = reion.timer;
    g.reionY       = -1;
    g.lightningArcs = [];
    // Fog gimmick: from Lv17+, probability ramps with level; forced on boss levels.
    // Always consume one rng() so the layout stream stays stable regardless of branch.
    const fogRoll = g.rng();
    // Fog peaks mid-game then eases so deep cosmic hazards stay readable, but never vanishes.
    const fogAge = Math.max(0, lv - 17);
    const fogProb = Math.min(0.62, 0.32 + fogAge * 0.022) * (lv >= 55 ? Math.max(0.35, 1 - (lv - 55) * 0.008) : 1);
    g.fogActive      = lv >= 17 && (specialKind(lv) === 'boss' || fogRoll < fogProb);
    g.fogRevealTimer = g.fogActive ? 90 : 0;
    g.fogAlpha       = 0;
    // Pop III.1 Flash stays exclusive with fog (vision already crowded) and with reion
    // (generateLevel). Clear here once fog is known.
    if (g.fogActive) g.pop31Flash = null;
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
    g.cdaLights = [];
    if (lv >= 77 && !g.fogActive && (DEBUG_FORCE_HAZARDS || Math.random() < 0.40)) {
      g.cosmicDarkAgesActive = true;
    }
    g.warpWalls = lv <= 2 ? false : g.rng() < 0.5;
    // Loop walls wrap balls around the edges, so partial wall gimmicks (warp/distort/
    // vanish segments) have no effect there — drop them to avoid dead/confusing visuals.
    if (g.warpWalls) g.wallSegments = [];
    // Wind is now a per-level chance (rises with level), so some levels are calm.
    // The whether-wind decision uses Math.random; the level's peg/hazard layout is
    // already fixed here (wind is set after generateLevel), so g.rng isn't perturbed.
    const windProb = Math.min(0.82, 0.30 + (lv - 4) * 0.012);
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
    // Playtest: on the unlock level, clear wind so Dark Flow is guaranteed confrontable.
    if (DEBUG_FORCE_HAZARDS && lv === 58) {
      g.windForce = 0; g.windRange = g.W; g.windCenter = Math.round(g.W / 2);
      g.windRectY0 = 0; g.windRectY1 = 0;
    }
    if (lv >= 58 && g.windForce === 0 && (DEBUG_FORCE_HAZARDS && lv === 58 || Math.random() < 0.45)) {
      g.darkFlow = {
        theta0: Math.random() * Math.PI * 2,
        accel: Math.min(DF_ACCEL_MAX, DF_ACCEL_BASE + Math.max(0, lv - 58) * DF_ACCEL_PER_LV),
      };
    } else {
      g.darkFlow = null;
    }
    // Anomaly levels are curated shows: fog, the dark-ages veil, and dark flow would
    // bury the composition, so all of them stand down. Silence goes further — no wind
    // either, and the dust nearly freezes (handled in the bg update loop).
    if (g.anomalyKind !== null) {
      g.fogActive = false; g.fogAlpha = 0; g.fogClouds = []; g.fogRevealTimer = 0;
      g.cosmicDarkAgesActive = false;
      g.darkFlow = null;
      if (g.anomalyKind === 'silence') {
        g.windForce = 0; g.windRectY0 = 0; g.windRectY1 = 0;
      }
    }
    // Perturbation state: drop stale peg refs / pulses from the previous level.
    g.wrongPeg = null; g.wrongFrames = 0; g.firePulse = null;
    // Slow-burn depth cues (wordless). Early unlock cracks + zone-boundary whispers.
    g.depthCrackKind = 0;
    g.depthCrackTimer = 0;
    if (lv === 7 || lv === 9 || lv === 12 || lv === 15 || lv === 17) {
      g.depthCrackKind = lv as 7 | 9 | 12 | 15 | 17;
      g.depthCrackTimer = DEPTH_CRACK_DUR;
    }
    g.depthWhisperKind = 0;
    g.depthWhisperTimer = 0;
    const whisperLv = ([54, 61, 71, 81, 91, 100, 120] as const).find((z) => lv === z);
    if (whisperLv !== undefined) {
      const bit = { 54: 1, 61: 2, 71: 4, 81: 8, 91: 16, 100: 32, 120: 64 }[whisperLv];
      if ((g.depthWhispersSeen & bit) === 0) {
        g.depthWhispersSeen |= bit;
        g.depthWhisperKind = whisperLv;
        g.depthWhisperTimer = DEPTH_WHISPER_DUR;
      }
    }

    setLevel(lv);
    setOrangeLeft(orangeTotal);
    hudOrange.current = orangeTotal;
    setWarpWalls(g.warpWalls);
    setPhase('aiming');
    // Defer checkpoint so React state (continues/extras refs) is current.
    queueMicrotask(() => checkpointRun(true));
  }, [checkpointRun]);

  // ── Start game ───────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    clearRun();
    syncSize();
    const g = G.current;
    g.rng       = makeRng(Date.now());
    if (g.bgDots.length === 0) g.bgDots = initBgDots(g.W, g.H);
    g.shotsLeft = SHOTS_START;
    g.score     = 0;
    g.bucketDir = 1;
    g.depthWhispersSeen = 0;
    g.depthCrackKind = 0; g.depthCrackTimer = 0;
    g.depthWhisperKind = 0; g.depthWhisperTimer = 0;
    setShotsLeft(SHOTS_START);
    hudShots.current = SHOTS_START;
    setScore(0);
    hudScore.current = 0;
    setRetired(false);
    setConfirmRetire(false);
    setContinuesUsed(0);
    setExtrasUsed(0);
    continuesUsedRef.current = 0;
    extrasUsedRef.current = 0;
    setX402Error(null);
    setX402Busy(false);
    setTxState('idle');
    setTxHash(null);
    preventNextFire.current = true; // block the pointerUp that follows this tap
    initLevel(1);
  }, [syncSize, initLevel]);

  // ── Pause / Resume ───────────────────────────────────────────────────────
  const handlePause = useCallback(() => {
    const g = G.current;
    if (g.phase !== 'aiming' && g.phase !== 'firing') return;
    // Only persist between-shot state; mid-flight pause keeps the last aiming checkpoint.
    if (g.phase === 'aiming') checkpointRunRef.current(true);
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
    clearRun();
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
      const alwaysGold = g.level >= GOLD_ARMOR_ALWAYS_LV;
      const downed = g.pegs.filter(p => p.bossArmor && p.cleared);
      let restored = 0;
      for (let k = 0; k < restoreN && downed.length > 0; k++) {
        const idx = Math.floor(Math.random() * downed.length);
        const tpeg = downed[idx]; downed.splice(idx, 1);
        tpeg.cleared = false; tpeg.hp = armorHp; tpeg.hitCool = 0;
        // Mid-game+: gold is assigned after restore so exactly one living plate is gold.
        tpeg.goldArmor = !alwaysGold && Math.random() < GOLD_ARMOR_CHANCE;
        restored++;
        if (tpeg.armorAngle !== undefined) {
          tpeg.x = b.x + Math.cos(tpeg.armorAngle) * b.armorR;
          tpeg.y = b.y + Math.sin(tpeg.armorAngle) * b.armorR;
        }
      }
      if (alwaysGold) ensureOneGoldBossArmor(g.pegs);
      if (restored > 0) b.rearmFlash = 18;
    }
    // Dynamic refill throttle (hidden): fewer bucket balls when you're flush.
    const f = refillFactor(g.level, g.shotsLeft);
    g.burstBucketProb = BUCKET_BALL_PROB * f;
    g.burstLuckyIdx   = f >= 0.6 ? Math.floor(Math.random() * BALLS_PER_SHOT) : -1; // guaranteed catch only when low-ish
    g.burstAngle     = g.aimAngle;
    g.burstRemaining = BALLS_PER_SHOT;
    g.burstTimer     = 0; // launch first ball immediately
    g.burstTime      = 0;
    g.shotsLeft--;
    g.phase = 'firing';
    // Deep-level fire pressure: nearby dust recoils for a breath (visual only).
    if (depthFactor(g.level) > 0.4) {
      g.firePulse = { x: g.launcherX, y: g.launcherY + 14, timer: 12 };
    }
    setShotsLeft(g.shotsLeft);
    hudShots.current = g.shotsLeft;
    setPhase('firing');
  }, []);

  // Rare golden boss-armor: only breaking a gold plate refills +1 (no volley cap).
  const goldArmorRefill = useCallback((peg: Peg) => {
    if (!peg.bossArmor || !peg.goldArmor) return;
    peg.goldArmor = false;
    const g = G.current;
    g.shotsLeft++;
    setShotsLeft(g.shotsLeft);
    hudShots.current = g.shotsLeft;
    setRefillPopup({ n: 1, key: g.frame });
  }, []);

  // ── x402 paid grants (continue / extra shot) ──────────────────────────────
  const openX402Confirm = useCallback((kind: 'continue' | 'extra') => {
    if (x402Busy || x402QuotaReached) return;
    if (kind === 'continue') {
      if (retired || continuesUsed >= X402_CONTINUE_MAX) return;
      if (G.current.phase !== 'gameover') return;
    } else {
      if (extrasUsed >= X402_EXTRA_MAX) return;
      if (G.current.phase !== 'aiming') return;
      // Opening the pay sheet on pointerDown; block the trailing pointerUp so it
      // cannot fire a shot after the overlay mounts / the button uncovers.
      preventNextFire.current = true;
    }
    setX402Error(null);
    setX402Confirm(kind);
  }, [x402Busy, x402QuotaReached, retired, continuesUsed, extrasUsed]);

  const payX402Grant = useCallback(async (kind: 'continue' | 'extra') => {
    if (x402Busy) return;
    const provider = selectedProviderRef.current;
    if (!provider || !walletAddress) {
      preventNextFire.current = true;
      setX402Confirm(null);
      setShowWalletModal(true);
      return;
    }
    if (kind === 'continue') {
      if (retired || continuesUsed >= X402_CONTINUE_MAX) return;
      if (G.current.phase !== 'gameover' && x402Confirm !== 'continue') return;
    } else {
      if (extrasUsed >= X402_EXTRA_MAX) return;
      if (G.current.phase !== 'aiming' && x402Confirm !== 'extra') return;
    }

    setX402Busy(true);
    setX402Error(null);
    try {
      const { payForGrant } = await import('@/lib/x402Client');
      const result = await payForGrant(kind, provider, walletAddress as `0x${string}`);
      const g = G.current;
      setX402Confirm(null);
      if (kind === 'continue') {
        g.shotsLeft += result.shots || X402_CONTINUE_SHOTS;
        g.balls = [];
        g.burstRemaining = 0;
        g.phase = 'aiming';
        setShotsLeft(g.shotsLeft);
        hudShots.current = g.shotsLeft;
        setContinuesUsed(n => n + 1);
        continuesUsedRef.current += 1;
        setPhase('aiming');
        setRefillPopup({ n: result.shots || X402_CONTINUE_SHOTS, key: g.frame });
        preventNextFire.current = true;
        checkpointRunRef.current(true);
      } else {
        g.shotsLeft += result.shots || 1;
        setShotsLeft(g.shotsLeft);
        hudShots.current = g.shotsLeft;
        setExtrasUsed(n => n + 1);
        extrasUsedRef.current += 1;
        setRefillPopup({ n: result.shots || 1, key: g.frame });
        // Payment UI closes asynchronously; swallow the next pointerUp while aiming.
        preventNextFire.current = true;
        checkpointRunRef.current(true);
      }
    } catch (err) {
      console.error('[DotShot] x402 error:', err);
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      if (code === 'X402_MONTHLY_LIMIT_REACHED') {
        setX402QuotaReached(true);
        setX402Confirm(null);
        setX402Error(t.monthlyLimitReached);
        preventNextFire.current = true;
        return;
      }
      const detail = err instanceof Error && err.message ? err.message : '';
      setX402Error(detail ? `${t.paymentFailed}: ${detail}` : t.paymentFailed);
      preventNextFire.current = true;
    } finally {
      setX402Busy(false);
    }
  }, [x402Busy, walletAddress, retired, continuesUsed, extrasUsed, x402Confirm, t.paymentFailed, t.monthlyLimitReached]);

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
    // Discard the pointerUp that follows game-start / pay UI taps to prevent accidental firing
    if (preventNextFire.current) { preventNextFire.current = false; return; }
    // Pay sheet / wallet overlay may still be closing; never spend a shot through them.
    if (x402Confirm !== null || x402Busy || showWalletModal) return;
    if (G.current.phase === 'aiming') fireBall();
  }, [fireBall, x402Confirm, x402Busy, showWalletModal]);

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

      // ── Paper colors (constant at every depth) ────────────────────────────
      // Single source of truth for anything that must match or sit just off the paper
      // (background fill, distort-wall camouflage, fog fade, negative-mass "hole",
      // boss tier-7 bite). The paper itself never darkens with depth.
      const paperColor  = PAPER_SURFACE;
      const paperFade   = 'rgba(237,233,223,0)';
      const paperBright = '#f8f4ea';

      // ── Deep-level perturbations (visuals only, no physics) ───────────────
      if (g.firePulse && --g.firePulse.timer <= 0) g.firePulse = null;
      // Creeping wrongness (lv80+): once in a long while, one familiar thing misbehaves
      // for a couple of frames and then everything is normal again. Never near a live
      // ball, never on special pegs — it must read as "did I just see that?", not physics.
      if (g.level >= 80 && (g.phase === 'aiming' || g.phase === 'firing')) {
        if (g.wrongFrames > 0) g.wrongFrames--;
        g.wrongTimer--;
        if (g.wrongTimer <= 0 && g.wrongFrames <= 0) {
          g.wrongTimer = 2400 + Math.floor(Math.random() * 1800);
          const kind = Math.floor(Math.random() * 3);
          if (kind === 2) {
            g.wrongKind = 2; g.wrongPeg = null; g.wrongFrames = 6; // bucket heartbeat skip
          } else {
            const candidates: Peg[] = [];
            for (const p of g.pegs) {
              if (p.cleared || p.bossArmor) continue;
              if (p.type !== 'orange' && p.type !== 'blue' && p.type !== 'purple') continue;
              let nearBall = false;
              for (const b of g.balls) {
                const bdx = b.x - p.x, bdy = b.y - p.y;
                if (bdx * bdx + bdy * bdy < 120 * 120) { nearBall = true; break; }
              }
              if (!nearBall) candidates.push(p);
            }
            if (candidates.length > 0) {
              g.wrongKind = kind;
              g.wrongPeg = candidates[Math.floor(Math.random() * candidates.length)];
              g.wrongFrames = 2;
            }
          }
        }
      } else {
        g.wrongFrames = 0;
      }

      // ── Background fill ──────────────────────────────────────────────────
      ctx.fillStyle = paperColor;
      ctx.fillRect(0, 0, W, H);

      // ── Background floating dot clusters (depth-thinned as levels rise) ───
      const bgCap = depthBgCap(g.level);
      if (g.phase !== 'idle') {
        g.bgClusterTimer--;
        if (g.bgClusterTimer <= 0 && g.bgDots.length < bgCap) {
          g.bgClusterTimer = 55 + Math.floor(Math.random() * 70) + Math.floor(depthFactor(g.level) * 40);
          const edge = depthEdgeBias(g.level);
          let cx = 60 + Math.random() * (W - 120);
          let cy = 60 + Math.random() * (H - 120);
          if (edge > 0.2 && Math.random() < edge) {
            const side = Math.floor(Math.random() * 4);
            const inset = 40 + Math.random() * 50;
            if (side === 0) { cx = 60 + Math.random() * (W - 120); cy = inset; }
            else if (side === 1) { cx = 60 + Math.random() * (W - 120); cy = H - inset; }
            else if (side === 2) { cx = inset; cy = 60 + Math.random() * (H - 120); }
            else { cx = W - inset; cy = 60 + Math.random() * (H - 120); }
          }
          const clusterN = Math.max(4, Math.floor((10 + Math.random() * 10) * (1 - 0.45 * depthFactor(g.level))));
          g.bgDots.push(...spawnBgCluster(W, H, cx, cy, clusterN, g.level));
        }
        // Soft trim when depth cap drops below current population
        while (g.bgDots.length > bgCap + 20) g.bgDots.pop();

        // Unobserved drift (lv75+): while the player's attention is on the flying ball,
        // a small patch of dust quietly fades out and re-forms somewhere nearby. It never
        // happens while aiming — the world only moves when you aren't looking at it.
        if (g.level >= 75 && g.phase === 'firing') {
          g.unobservedTimer--;
          if (g.unobservedTimer <= 0) {
            g.unobservedTimer = 30 + Math.floor(Math.random() * 30);
            const anchor = g.bgDots[Math.floor(Math.random() * g.bgDots.length)];
            if (anchor) {
              let moved = 0;
              for (const d of g.bgDots) {
                const udx = d.x - anchor.x, udy = d.y - anchor.y;
                if (udx * udx + udy * udy < 40 * 40) { d.age = Math.max(d.age, d.maxAge * 0.78); moved++; }
              }
              // Re-form only as many dots as the population cap allows, or the trim below
              // would pop the fresh cluster before it ever becomes visible.
              const room = bgCap + 20 - g.bgDots.length;
              const reformN = Math.min(moved, 10, room);
              if (moved > 2 && reformN > 0) {
                const ua = Math.random() * Math.PI * 2;
                const ux = Math.min(W - 10, Math.max(10, anchor.x + Math.cos(ua) * (60 + Math.random() * 60)));
                const uy = Math.min(H - 10, Math.max(10, anchor.y + Math.sin(ua) * (60 + Math.random() * 60)));
                g.bgDots.push(...spawnBgCluster(W, H, ux, uy, reformN, g.level));
              }
            }
          }
        } else {
          g.unobservedTimer = Math.max(g.unobservedTimer, 30);
        }
      }
      ctx.fillStyle = '#0f0f0d';
      const bg = g.bgDots;
      const hollowR = depthHollow(g.level) * Math.min(W, H) * 0.28;
      const hollowR2 = hollowR * hollowR;
      // Dark Flow: bias the background dust's drift toward the current flow direction — its
      // only "visible" trace, since the hazard has no dedicated light source of its own.
      let dfBiasX = 0, dfBiasY = 0;
      if (g.darkFlow) {
        const dfAngle = g.darkFlow.theta0 + g.frame * DF_ANGULAR_SPEED;
        dfBiasX = Math.cos(dfAngle) * DF_BG_BIAS;
        dfBiasY = Math.sin(dfAngle) * DF_BG_BIAS;
      }
      // Zone whisper 91: briefly hollow the center harder while the cue plays.
      const whisperHollowBoost = (g.depthWhisperKind === 91 && g.depthWhisperTimer > 0)
        ? 1 + 1.4 * (g.depthWhisperTimer / DEPTH_WHISPER_DUR)
        : 1;
      const hollowDrawR2 = hollowR2 * whisperHollowBoost * whisperHollowBoost;
      // Silence anomaly: the dust barely breathes — motion drops to 10%.
      const dustStill = g.anomalyKind === 'silence' ? 0.1 : 1;
      for (let bi = 0; bi < bg.length; bi++) {
        const d = bg[bi];
        d.age++; d.x += (d.vx + dfBiasX) * dustStill; d.y += (d.vy + dfBiasY) * dustStill;
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
        // Fire pressure (deep levels): the dust near the launcher recoils 1-2px for a
        // breath when a shot leaves — the still water flinching. Draw offset only.
        if (g.firePulse) {
          const fdx = d.x - g.firePulse.x, fdy = d.y - g.firePulse.y;
          const fd2 = fdx * fdx + fdy * fdy;
          if (fd2 < 60 * 60 && fd2 > 1) {
            const fd = Math.sqrt(fd2);
            const fk = (g.firePulse.timer / 12) * (1 - fd / 60) * 2.2;
            drawDx += (fdx / fd) * fk;
            drawDy += (fdy / fd) * fk;
          }
        }
        // Gravitational lens: whirl the background ink around the lens (draw offset only).
        // The background itself bending IS the phenomenon — the rings are just a hint.
        if (g.lenses.length > 0) {
          for (const lens of g.lenses) {
            const ldx = d.x - lens.x, ldy = d.y - lens.y;
            const ld2 = ldx * ldx + ldy * ldy;
            const lOuter = lens.r * 1.5;
            if (ld2 < lOuter * lOuter && ld2 > 1) {
              const ld = Math.sqrt(ld2);
              const lt = 1 - ld / lOuter;
              const bend = lt * lt * 1.1 * lens.dir;
              const lca = Math.cos(bend), lsa = Math.sin(bend);
              drawDx += (ldx * lca - ldy * lsa) - ldx;
              drawDy += (ldx * lsa + ldy * lca) - ldy;
            }
          }
        }
        // Boss depth visage (tier >= 5): space itself curls faintly around a deep boss
        // (half the lens whirl strength; draw offset only).
        if (g.boss && g.boss.hp > 0 && g.boss.tier >= 5) {
          const bdx2 = d.x - g.boss.x, bdy2 = d.y - g.boss.y;
          const bd2 = bdx2 * bdx2 + bdy2 * bdy2;
          if (bd2 < 100 * 100 && bd2 > 1) {
            const bd = Math.sqrt(bd2);
            const bt2 = 1 - bd / 100;
            const bBend = bt2 * bt2 * 0.55;
            const bca = Math.cos(bBend), bsa = Math.sin(bBend);
            drawDx += (bdx2 * bca - bdy2 * bsa) - bdx2;
            drawDy += (bdx2 * bsa + bdy2 * bca) - bdy2;
          }
        }
        ctx.globalAlpha = d.alpha;
        // The Nothing: skip drawing bgDots inside the blank circle — the absence of ink
        // is the only evidence the region exists (no border, no decoration).
        let skipBg = false;
        if (g.theNothings.length > 0) {
          for (const tn of g.theNothings) {
            const dx = d.x - tn.x, dy = d.y - tn.y;
            if (dx * dx + dy * dy < NOTHING_RANGE * NOTHING_RANGE) { skipBg = true; break; }
          }
        }
        // Big Ring hollow: draw-only skip inside the ring interior (dist < r - halfW).
        if (!skipBg && g.bigRings.length > 0) {
          for (const br of g.bigRings) {
            const bdx = d.x - br.cx, bdy = d.y - br.cy;
            const hollow = br.r - br.halfW;
            if (bdx * bdx + bdy * bdy < hollow * hollow) { skipBg = true; break; }
          }
        }
        // Depth hollow: as levels rise, ink thins near the board center (emptiness grows).
        if (!skipBg && hollowDrawR2 > 4) {
          const hdx = d.x - W / 2, hdy = d.y - H / 2;
          if (hdx * hdx + hdy * hdy < hollowDrawR2) skipBg = true;
        }
        if (!skipBg) ctx.fillRect(Math.round(d.x + drawDx), Math.round(d.y + drawDy), d.size, d.size);
        if (d.age >= d.maxAge) bg[bi] = spawnBgDot(W, H, g.level); // replace in place, no per-frame realloc
      }
      ctx.globalAlpha = 1;

      // Dark Flow: bold edge streamers + drifting mid-board dust in the flow direction.
      if (g.darkFlow) {
        const dfAngle = g.darkFlow.theta0 + g.frame * DF_ANGULAR_SPEED;
        const dcos = Math.cos(dfAngle), dsin = Math.sin(dfAngle);
        const perim = 2 * (W + H);
        ctx.fillStyle = '#0f0f0d';
        for (let i = 0; i < 28; i++) {
          const edgeT = (i / 28 + g.frame * 0.0010) % 1;
          const d = edgeT * perim;
          let ex: number, ey: number;
          if (d < W)              { ex = d;              ey = 0; }
          else if (d < W + H)     { ex = W;               ey = d - W; }
          else if (d < 2 * W + H) { ex = W - (d - W - H); ey = H; }
          else                    { ex = 0;               ey = H - (d - 2 * W - H); }
          for (let s = 0; s < 6; s++) {
            ctx.globalAlpha = 0.28 * (1 - s / 6);
            ctx.fillRect(Math.round(ex + dcos * (i * 2 + s * 5)), Math.round(ey + dsin * (i * 2 + s * 5)), 2, 2);
          }
        }
        // Mid-board drifting motes — the "wind you can't see" becomes a readable current.
        ctx.fillStyle = '#7a7670';
        for (let i = 0; i < 26; i++) {
          const t = ((g.frame * 0.014 + i * 0.11) % 1);
          const px = ((i * 97 + g.frame * dcos * 1.6) % W + W) % W;
          const py = ((i * 53 + g.frame * dsin * 1.6) % H + H) % H;
          ctx.globalAlpha = 0.28 + 0.18 * Math.sin(t * Math.PI * 2);
          ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Slow-burn depth crack cues (early unlock levels; wordless) ────────
      if (g.depthCrackTimer > 0 && g.phase !== 'idle' && g.phase !== 'paused') {
        const ct = g.depthCrackTimer / DEPTH_CRACK_DUR;
        const pulse = Math.sin((1 - ct) * Math.PI); // 0→1→0 over the cue
        const kind = g.depthCrackKind;
        if (kind === 7) {
          // Blood-red point pulse near board center
          ctx.fillStyle = '#8a1420';
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 + g.frame * 0.05;
            const rr = 4 + pulse * 14;
            ctx.globalAlpha = pulse * 0.7;
            ctx.fillRect(Math.round(W / 2 + Math.cos(a) * rr) - 1, Math.round(H * 0.38 + Math.sin(a) * rr) - 1, 2, 2);
          }
          ctx.globalAlpha = pulse;
          ctx.fillRect(Math.round(W / 2) - 2, Math.round(H * 0.38) - 2, 4, 4);
        } else if (kind === 9) {
          // Tiny purple bar flash
          ctx.fillStyle = '#7a4aaa';
          ctx.globalAlpha = pulse * 0.75;
          const bx = W / 2, by = H * 0.42;
          for (let i = -8; i <= 8; i += 2) {
            ctx.fillRect(Math.round(bx + i) - 1, Math.round(by) - 1, 2, 2);
          }
        } else if (kind === 12) {
          // Sky chevron blink at a random-ish side (deterministic from level frame)
          const fromLeft = (g.level * 3) % 2 === 0;
          const cy = H * 0.35;
          ctx.fillStyle = '#8fd3f4';
          ctx.globalAlpha = pulse * 0.85;
          const ex = fromLeft ? 6 : W - 6;
          for (let s = 0; s < 5; s++) {
            const ox = fromLeft ? s * 4 : -s * 4;
            ctx.fillRect(Math.round(ex + ox) - 1, Math.round(cy - s * 2) - 1, 2, 2);
            ctx.fillRect(Math.round(ex + ox) - 1, Math.round(cy + s * 2) - 1, 2, 2);
          }
        } else if (kind === 15) {
          // Purple ring sweeps half a turn then fades
          ctx.fillStyle = '#9a6ad0';
          const sweep = (1 - ct) * Math.PI;
          for (let i = 0; i < 18; i++) {
            const a = -Math.PI / 2 + (i / 18) * sweep;
            const rr = 28;
            ctx.globalAlpha = pulse * 0.65;
            ctx.fillRect(Math.round(W / 2 + Math.cos(a) * rr) - 1, Math.round(H * 0.4 + Math.sin(a) * rr) - 1, 2, 2);
          }
        } else if (kind === 17) {
          // Thin purple haze creeping along the bottom edge
          ctx.fillStyle = '#3a2858';
          for (let i = 0; i < 24; i++) {
            const px = (i / 24) * W + Math.sin(g.frame * 0.08 + i) * 3;
            const py = H - 18 - Math.sin(i * 0.7 + g.frame * 0.05) * 6 * pulse;
            ctx.globalAlpha = pulse * 0.35 * (0.5 + 0.5 * Math.sin(i));
            ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
          }
        }
        ctx.globalAlpha = 1;
        g.depthCrackTimer--;
        if (g.depthCrackTimer <= 0) g.depthCrackKind = 0;
      }

      // ── Zone-boundary wordless whispers (no titles, no "space" labels) ────
      if (g.depthWhisperTimer > 0 && g.phase !== 'idle' && g.phase !== 'paused') {
        const wt = g.depthWhisperTimer / DEPTH_WHISPER_DUR;
        const fade = Math.sin(wt * Math.PI); // ease in/out
        const wk = g.depthWhisperKind;
        if (wk === 54) {
          // Faint one-way dust along the edge
          const ang = 0.35;
          const dcos = Math.cos(ang), dsin = Math.sin(ang);
          ctx.fillStyle = '#7a7670';
          for (let i = 0; i < 16; i++) {
            const t = ((1 - wt) * 0.7 + i * 0.05) % 1;
            const px = 10 + t * (W - 20);
            const py = 12 + ((i * 37) % (H - 24));
            ctx.globalAlpha = fade * 0.28;
            for (let s = 0; s < 4; s++) {
              ctx.fillRect(Math.round(px + dcos * s * 5), Math.round(py + dsin * s * 5), 1, 1);
            }
          }
        } else if (wk === 61) {
          // One thin web streak crawling from an edge then vanishing
          const progress = 1 - wt;
          ctx.fillStyle = '#8a9ab8';
          const x0 = 0, y0 = H * 0.3;
          const x1 = W * 0.7, y1 = H * 0.55;
          for (let i = 0; i < 28; i++) {
            const t = (i / 28) * progress;
            if (t > progress) continue;
            const px = x0 + (x1 - x0) * t + Math.sin(i * 1.3) * 4;
            const py = y0 + (y1 - y0) * t + Math.cos(i * 0.9) * 3;
            ctx.globalAlpha = fade * 0.4 * (1 - Math.abs(t - progress + 0.05));
            ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
          }
        } else if (wk === 71) {
          // Warm/cool mottling flash across the board
          for (let i = 0; i < 40; i++) {
            const px = ((i * 97 + g.frame) % W);
            const py = ((i * 53 + g.frame * 2) % H);
            const warm = i % 2 === 0;
            ctx.fillStyle = warm ? '#e8c8a0' : '#a8c8e0';
            ctx.globalAlpha = fade * 0.22;
            ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
          }
        } else if (wk === 81) {
          // Four corners blink in sync, slowly
          const blink = 0.35 + 0.65 * Math.abs(Math.sin((1 - wt) * Math.PI * 3));
          const m = 10;
          ctx.fillStyle = '#9a7ad8';
          ctx.globalAlpha = fade * blink;
          ctx.fillRect(m, m, 5, 5);
          ctx.fillRect(W - m - 5, m, 5, 5);
          ctx.fillRect(m, H - m - 5, 5, 5);
          ctx.fillRect(W - m - 5, H - m - 5, 5, 5);
        } else if (wk === 91) {
          // Extra center hollow is handled in bgDots; add a faint ring of absence edge
          const rr = Math.min(W, H) * 0.28 * (1.2 + 0.5 * fade);
          ctx.fillStyle = '#0f0f0d';
          for (let i = 0; i < 32; i++) {
            if (i % 2 === 0) continue;
            const a = (i / 32) * Math.PI * 2;
            ctx.globalAlpha = fade * 0.2;
            ctx.fillRect(Math.round(W / 2 + Math.cos(a) * rr), Math.round(H / 2 + Math.sin(a) * rr), 1, 1);
          }
        } else if (wk === 100) {
          // Zone F entry: slow layer shear across mid-board (pearl/slate, no flash)
          ctx.fillStyle = '#d0d4e0';
          for (let i = 0; i < 36; i++) {
            const baseX = (i / 36) * W;
            const py = H * 0.42 + Math.sin(i * 0.4) * 18;
            const px = zoneLayerShift(baseX, g.frame, i, i % 3);
            ctx.globalAlpha = fade * 0.22 * (0.5 + 0.5 * Math.sin(i * 0.7 + (1 - wt) * Math.PI));
            ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
          }
        } else if (wk === 120) {
          // Zone G entry: four-corner phase tears (cold ash, sparse)
          const m = 12;
          ctx.fillStyle = '#6a6878';
          const corners: [number, number][] = [[m, m], [W - m, m], [m, H - m], [W - m, H - m]];
          for (let c = 0; c < 4; c++) {
            if (zonePhaseTear(c * 11, g.frame + Math.floor((1 - wt) * 40))) continue;
            const [cx, cy] = corners[c];
            ctx.globalAlpha = fade * 0.35;
            for (let s = 0; s < 5; s++) {
              const a = (s / 5) * Math.PI * 2 + (1 - wt) * 2;
              ctx.fillRect(Math.round(cx + Math.cos(a) * (4 + s)), Math.round(cy + Math.sin(a) * (4 + s)), 1, 1);
            }
          }
        }
        ctx.globalAlpha = 1;
        g.depthWhisperTimer--;
        if (g.depthWhisperTimer <= 0) g.depthWhisperKind = 0;
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
        const speedMul = enraged ? 1.5 : 1;
        // Late-game randomness: 0 at early moving bosses → ~1 at deepest tiers.
        const chaos = Math.min(1, Math.max(0, (b.tier - 2) / 8));

        // Movement stays in the lower-half arena; complexity unlocks with tier.
        if (b.tier >= 2) {
          // Tier 5+: periodic stutter (freeze) then optional direction flip.
          // Deeper tiers stutter more often and reverse more often.
          if (b.tier >= 5) {
            if (b.stutterTimer > 0) {
              b.stutterTimer--;
            } else {
              b.nextStutter--;
              if (b.nextStutter <= 0) {
                b.stutterTimer = 8 + Math.floor(Math.random() * (11 + chaos * 10));
                b.nextStutter = Math.max(28, Math.floor((70 + Math.random() * 80) * (1 - chaos * 0.45)));
                if (Math.random() < 0.55 + chaos * 0.35) b.pathDir *= -1;
              }
            }
          }

          const frozen = b.stutterTimer > 0;

          if (!frozen) {
            if (b.tier >= 9) {
              // Alien polar path: breathing radius + occasional angle jump.
              b.phase += b.omega * speedMul * b.pathDir;
              if (Math.random() < (0.012 + chaos * 0.03) * speedMul) {
                b.phase += (Math.random() < 0.5 ? 1 : -1) * (0.7 + Math.random() * (1.4 + chaos * 2));
              }
              const breathe = 0.72 + 0.28 * Math.sin(g.frame * 0.035) + (Math.random() - 0.5) * 0.25 * chaos;
              const ang = b.phase;
              b.x = b.homeX + Math.cos(ang) * b.ampX * breathe;
              b.y = b.homeY + Math.sin(ang * 1.37 + b.phaseLag) * b.ampY * breathe;
            } else if (b.tier >= 3) {
              // Lissajous ellipse in the lower half (+ late omega noise).
              const omegaJitter = 1 + (Math.random() - 0.5) * 0.55 * chaos;
              b.phase += b.omega * speedMul * b.pathDir * omegaJitter;
              if (chaos > 0.2 && Math.random() < 0.01 * chaos * speedMul) {
                b.phase += (Math.random() - 0.5) * Math.PI * chaos;
              }
              b.x = b.homeX + Math.sin(b.phase) * b.ampX;
              b.y = b.homeY + Math.sin(b.phase * 1.15 + b.phaseLag) * b.ampY;
            } else {
              // Tier 2: horizontal ping-pong (legacy feel, wider span).
              b.x += Math.abs(b.vx) * speedMul * b.pathDir;
              if (b.x <= b.moveMinX) { b.x = b.moveMinX; b.pathDir =  1; }
              if (b.x >= b.moveMaxX) { b.x = b.moveMaxX; b.pathDir = -1; }
              b.y = b.homeY;
            }

            // Chaos overlays (mid → late): jitter, spontaneous reverse, home wander.
            if (chaos > 0.05) {
              const j = (1.5 + chaos * 11) * (enraged ? 1.35 : 1);
              b.x += (Math.random() - 0.5) * 2 * j;
              b.y += (Math.random() - 0.5) * 2 * j * (b.ampY > 0 ? 1 : 0.2);
              if (Math.random() < 0.005 * chaos * speedMul) b.pathDir *= -1;
              if (b.tier >= 4 && Math.random() < 0.007 * chaos * speedMul) {
                b.homeX += (Math.random() - 0.5) * (24 + chaos * 36);
                b.homeY += (Math.random() - 0.5) * (16 + chaos * 28);
                const hxPad = Math.max(8, b.ampX * 0.25);
                const hyPad = Math.max(8, b.ampY * 0.25);
                b.homeX = Math.max(b.moveMinX + hxPad, Math.min(b.moveMaxX - hxPad, b.homeX));
                b.homeY = Math.max(b.moveMinY + hyPad, Math.min(b.moveMaxY - hyPad, b.homeY));
              }
            }

            // Tier 7+: rare short-range blink within bounds (armor follows via reposition).
            if (b.tier >= 7) {
              if (b.blinkCool > 0) b.blinkCool--;
              else {
                const blinkChance = (0.008 + chaos * 0.014) * (enraged ? 2.2 : 1);
                if (Math.random() < blinkChance) {
                  const dist = 24 + Math.random() * (24 + chaos * 28); // up to ~76px late
                  const a = Math.random() * Math.PI * 2;
                  b.x += Math.cos(a) * dist;
                  b.y += Math.sin(a) * dist;
                  // Keep path center coherent after a blink so orbits don't yank back hard.
                  if (b.tier >= 3) {
                    b.homeX = Math.max(b.moveMinX + b.ampX * 0.2, Math.min(b.moveMaxX - b.ampX * 0.2, b.x));
                    b.homeY = Math.max(b.moveMinY + b.ampY * 0.2, Math.min(b.moveMaxY - b.ampY * 0.2, b.y));
                  }
                  const coolBase = enraged ? 50 : 90;
                  b.blinkCool = Math.max(28, Math.floor((coolBase + Math.random() * 70) * (1 - chaos * 0.4)));
                }
              }
            }
          }

          // Hard clamp: never leave the lower-half movement rectangle.
          if (b.x < b.moveMinX) b.x = b.moveMinX;
          if (b.x > b.moveMaxX) b.x = b.moveMaxX;
          if (b.y < b.moveMinY) b.y = b.moveMinY;
          if (b.y > b.moveMaxY) b.y = b.moveMaxY;

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
        // Pulsing variant (lv60+): the whole visage breathes with the same 0.2x..1.0x
        // factor the physics pull uses, so what the player sees IS the current strength.
        const breath  = zone.pulsing ? 0.6 + 0.4 * Math.sin(f * 0.015) : 1;
        const flicker = (0.80 + Math.sin(f * 0.19) * 0.20) * breath;

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
        // Exotic decay (grows past the lv7 unlock, full at lv47): stable gaps eat into
        // the rings — the textbook vortex no longer holds its shape at depth. Draw-only.
        {
          const bhExt = exoticT(g.level, 7);
          const s1 = Math.sin(f * 0.053), c1 = Math.cos(f * 0.053);
          const s2 = Math.sin(f * 0.047), c2 = Math.cos(f * 0.047);
          const sT = Math.sin(f * 0.09),  cT = Math.cos(f * 0.09);
          let ringIdx = 0;
          for (const ring of bh.rings) {
            ringIdx++;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-t * ring.spd);
            ctx.fillStyle = ring.color;
            const dotN = ring.bx.length;
            for (let i = 0; i < dotN; i++) {
              if (exoticSkip(i, ringIdx, bhExt)) continue;
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
        const whlExt = exoticT(g.level, 9);
        let whlIdx = 0;
        for (const d of wh.auraDots) {
          if (exoticSkip(whlIdx++, wh.pairId + 1, whlExt)) continue;
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

        // The mouth: a dark lens-shaped void at the bar's center plus sparks spiraling
        // into it — so the bar reads as a portal, not a purple bumper.
        const mouthW = wh.w * 0.32;
        ctx.fillStyle = '#1a0530';
        for (let bx = -mouthW; bx <= mouthW; bx += 1.5) {
          const mh = 3.2 * (1 - (bx / mouthW) * (bx / mouthW)) + 0.6;
          for (let by = -mh; by <= mh; by += 1.5) {
            const wx = wh.cx + bx * cosA - by * sinA;
            const wy = wh.cy + bx * sinA + by * cosA;
            ctx.globalAlpha = fadeAlpha * 0.9;
            ctx.fillRect(Math.round(wx), Math.round(wy), 2, 2);
          }
        }
        ctx.fillStyle = '#dd88ff';
        for (let i = 0; i < 8; i++) {
          const st = (g.frame * 0.02 + i / 8) % 1;      // 0→1 as the spark falls in
          const ia = i * 2.39996 + g.frame * 0.05;
          const ir = (1 - st) * wh.w * 0.55 + 2;
          const lx = Math.cos(ia) * ir, ly = Math.sin(ia) * ir * 0.5;
          const wx = wh.cx + lx * cosA - ly * sinA;
          const wy = wh.cy + lx * sinA + ly * cosA;
          ctx.globalAlpha = fadeAlpha * st * 0.8;
          ctx.fillRect(Math.round(wx) - 1, Math.round(wy) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
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

      // ── Great Attractor: dark wall band + accelerating dust + breathing edge glow ──
      if (g.greatAttractor) {
        const gaBreathe = 0.5 + 0.5 * Math.sin(g.frame * GA_BREATHE_FREQ);
        const gaDir = g.greatAttractor.side; // -1 = pulled toward left wall, 1 = toward right wall
        const GA_BAND_W = 28;

        ctx.fillStyle = '#2a261e';
        ctx.globalAlpha = 0.28 + gaBreathe * 0.12;
        ctx.fillRect(gaDir === -1 ? 0 : W - GA_BAND_W, 0, GA_BAND_W, H);
        // Bright edge seam so the "off-screen pull" wall is unmistakable.
        ctx.fillStyle = '#c8a000';
        ctx.globalAlpha = 0.25 + gaBreathe * 0.45;
        ctx.fillRect(gaDir === -1 ? GA_BAND_W - 2 : W - GA_BAND_W, 0, 2, H);
        ctx.globalAlpha = 1;

        const gah = (n: number) => ((n * 1664525 + 1013904223) >>> 0) / 0x100000000;
        const GA_COUNT = Math.round(55 * (0.5 + gaBreathe * 0.7));
        for (let i = 0; i < GA_COUNT; i++) {
          const h1 = gah(i * 733 + 11);
          const h2 = gah(i * 733 + 191);
          const h3 = gah(i * 733 + 337);
          const cycleFrames = 220 - h3 * 100;
          const prog = (((g.frame + h1 * cycleFrames) % cycleFrames) + cycleFrames) % cycleFrames / cycleFrames;
          const eased = prog * prog;
          const dist = (1 - eased) * W;
          const px = gaDir === -1 ? dist : W - dist;
          const py = h2 * H;
          const streakLen = Math.round(3 + eased * 8);
          const sx = gaDir === -1 ? Math.round(px) : Math.round(px) - streakLen;
          ctx.fillStyle   = i % 3 === 0 ? '#c8a000' : '#5a5648';
          ctx.globalAlpha = (0.22 + gaBreathe * 0.4) * (1 - eased * 0.85);
          ctx.fillRect(sx, Math.round(py), streakLen, i % 5 === 0 ? 2 : 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Cosmological horizon entropy: rust edge dots + inward streamlines ───
      if (g.horizonEntropyActive) {
        const scroll = (g.frame * 0.3) % 8;
        const blink = 0.45 + 0.10 * Math.sin(g.frame * 0.006);
        // four edges
        ctx.fillStyle = '#b86048';
        for (let x = 0; x < W; x += 8) {
          ctx.globalAlpha = blink;
          ctx.fillRect(x, Math.round(scroll % 2), 1, 1);
          ctx.fillRect(x, H - 1 - Math.round(scroll % 2), 1, 1);
        }
        for (let y = 0; y < H; y += 8) {
          ctx.globalAlpha = blink;
          ctx.fillRect(Math.round(scroll % 2), y, 1, 1);
          ctx.fillRect(W - 1 - Math.round(scroll % 2), y, 1, 1);
        }
        // inward streamlines (6 per edge)
        ctx.fillStyle = '#e8dcd0';
        for (let i = 0; i < 6; i++) {
          const along = (i + 0.5) / 6;
          const phase = (g.frame * 0.3 + i * 11) % HORIZON_BAND;
          ctx.globalAlpha = 0.20;
          // top → down
          ctx.fillRect(Math.round(along * W), Math.round(phase), 1, 1);
          // bottom → up
          ctx.fillRect(Math.round(along * W), Math.round(H - 1 - phase), 1, 1);
          // left → right
          ctx.fillRect(Math.round(phase), Math.round(along * H), 1, 1);
          // right → left
          ctx.fillRect(Math.round(W - 1 - phase), Math.round(along * H), 1, 1);
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
        for (const group of g.chainGroups.values()) {
          let weak: Peg | null = null;
          let anyAlive = false;
          for (const p of group) {
            if (p.cleared) continue;
            anyAlive = true;
            if (p.type === 'chain-weak') weak = p;
          }
          if (!anyAlive || !weak) continue;
          for (const node of group) {
            if (node.cleared || node === weak) continue;
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
          // distort: same color as the paper (constant cream) — invisible trap.
          // Always reference paperColor, never hardcode the background.
          ctx.fillStyle = paperColor;
          ctx.globalAlpha = 1;
          ctx.fillRect(seg.side === 'left' ? 0 : W - 4, seg.yMin, 4, seg.yMax - seg.yMin);
        }
        ctx.globalAlpha = 1;
      }

      // ── Gravitational lenses: the main read is the whirled background ink (see the
      // bgDots loop); these muted rings only mark the center of the distortion. ──────
      for (const lens of g.lenses) {
        const spin = g.frame * 0.03 * lens.dir;
        const lensExt = exoticT(g.level, 15);
        for (let ring = 0; ring < 3; ring++) {
          const rr = lens.r * (0.4 + ring * 0.28);
          const n  = Math.max(10, Math.round(2 * Math.PI * rr / 6));
          ctx.fillStyle = ring === 0 ? '#b8a8d8' : ring === 1 ? '#9a88c8' : '#7a68a8';
          for (let i = 0; i < n; i++) {
            if (exoticSkip(i, ring + 1, lensExt)) continue;
            const a = (i / n) * Math.PI * 2 + spin * (ring + 1) * 0.5 + exoticJitter(g.frame, i + ring * 40, lensExt);
            ctx.globalAlpha = 0.20 + (i % 2) * 0.14;
            ctx.fillRect(Math.round(lens.x + Math.cos(a) * rr) - 1, Math.round(lens.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        ctx.fillStyle = '#e0d0ff';
        ctx.globalAlpha = 0.2 + Math.abs(Math.sin(g.frame * 0.05)) * 0.2;
        ctx.fillRect(Math.round(lens.x) - 2, Math.round(lens.y) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── Galactic tidal streams: denser star river + faint arc guide so the current is obvious ──
      for (const gts of g.galacticTidalStreams) {
        const arcLen = gts.radius * GTS_ARC_SPAN;
        // Soft arc spine (guide) — makes the river path readable at a glance.
        ctx.fillStyle = '#d8d0b0';
        for (let i = 0; i < 24; i++) {
          const a = gts.angleStart + (i / 23) * GTS_ARC_SPAN;
          ctx.globalAlpha = 0.18;
          ctx.fillRect(Math.round(gts.cx + Math.cos(a) * gts.radius) - 1, Math.round(gts.cy + Math.sin(a) * gts.radius) - 1, 1, 1);
        }
        for (let i = 0; i < GTS_STAR_COUNT + 10; i++) {
          const spacing = arcLen / (GTS_STAR_COUNT + 10);
          let along = (g.frame * GTS_STAR_SPEED * gts.dir + i * spacing) % arcLen;
          if (along < 0) along += arcLen;
          const t = along / arcLen;
          const a = gts.angleStart + t * GTS_ARC_SPAN;
          const radial = ((i * 13) % (GTS_BAND_HALF * 2)) - GTS_BAND_HALF;
          const px = gts.cx + Math.cos(a) * (gts.radius + radial);
          const py = gts.cy + Math.sin(a) * (gts.radius + radial);
          const size = i % 3 === 0 ? 2 : 1;
          const twinkle = 0.45 + Math.abs(Math.sin(g.frame * 0.06 + i)) * 0.45;
          // Gold-leaning star pair (the old near-white #fff8e0 half dissolved into cream).
          ctx.fillStyle = i % 2 === 0 ? '#e8d080' : '#d8b850';
          ctx.globalAlpha = twinkle;
          ctx.fillRect(Math.round(px), Math.round(py), size, size);
        }
        ctx.globalAlpha = 1;
      }

      // ── Laniakea Basin: brighter stream dots + soft sink glow (never a solid attractor) ──
      for (const lb of g.laniakeaBasins) {
        // Sink hint: sparse converging sparkles (the "basin mouth").
        ctx.fillStyle = '#a0b0d0';
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + g.frame * 0.02;
          const rr = 8 + (i % 3) * 4;
          ctx.globalAlpha = 0.25 + 0.2 * Math.sin(g.frame * 0.05 + i);
          ctx.fillRect(Math.round(lb.sinkX + Math.cos(a) * rr) - 1, Math.round(lb.sinkY + Math.sin(a) * rr) - 1, 2, 2);
        }
        for (let si = 0; si < lb.streams.length; si++) {
          const stream = lb.streams[si];
          const pts = stream.pts;
          const segCount = pts.length - 1;
          const spacingPx = stream.len / LB_DOT_COUNT;
          const dotN = LB_DOT_COUNT + Math.floor(hazardAgeBoost(g.level, 61, 18));
          const spacing2 = stream.len / dotN;
          for (let i = 0; i < dotN; i++) {
            let alongPx = (g.frame * LB_DOT_SPEED + i * spacing2 + si * 71) % stream.len;
            if (alongPx < 0) alongPx += stream.len;
            const along = alongPx / stream.len;
            const fi = along * segCount;
            const idx = Math.max(0, Math.min(segCount - 1, Math.floor(fi)));
            const frac = fi - idx;
            const px = pts[idx].x + (pts[idx + 1].x - pts[idx].x) * frac;
            const py = pts[idx].y + (pts[idx + 1].y - pts[idx].y) * frac;
            const fadeNear = along > 0.8 ? Math.max(0, (1 - along) / 0.2) : 1;
            const isGalaxy = i % 4 === 0;
            const size = isGalaxy ? 3 : 2;
            ctx.fillStyle = isGalaxy ? '#c0d0e8' : '#8a9ab8';
            ctx.globalAlpha = (isGalaxy ? 0.85 : 0.58) * fadeNear;
            ctx.fillRect(Math.round(px) - (size > 1 ? 1 : 0), Math.round(py) - (size > 1 ? 1 : 0), size, size);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Gravitational wave background: corner markers + board-wide ripple arcs ──
      if (g.gwBackgroundActive) {
        const gwbPulse = 0.55 + 0.45 * Math.abs(Math.sin(g.frame * 0.06));
        const gwbMargin = 10;
        // Corner wave crescents (was 4 solid squares, which read as UI chrome): small
        // breathing dot-arcs curving into the board, all four in exact phase — the same
        // wave passing through everywhere at once.
        ctx.fillStyle = '#9a7ad8';
        const gwbCorners: [number, number, number, number][] = [
          [gwbMargin, gwbMargin, 1, 1], [W - gwbMargin, gwbMargin, -1, 1],
          [gwbMargin, H - gwbMargin, 1, -1], [W - gwbMargin, H - gwbMargin, -1, -1],
        ];
        for (const [gcx, gcy, gsx, gsy] of gwbCorners) {
          for (let k = 0; k < 4; k++) {
            const a = (k / 3) * (Math.PI / 2);
            const rr = 6 + 2 * Math.sin(g.frame * 0.06 + k);
            ctx.globalAlpha = gwbPulse * (0.55 + 0.45 * (k % 2));
            ctx.fillRect(Math.round(gcx + gsx * Math.cos(a) * rr) - 1, Math.round(gcy + gsy * Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        // Soft concentric ripples from board center — the "universe trembling" made visible.
        for (let ring = 0; ring < 2; ring++) {
          const rr = 40 + ((g.frame * 1.2 + ring * 90) % 180);
          ctx.fillStyle = '#b8a0e0';
          for (let i = 0; i < 40; i++) {
            const a = (i / 40) * Math.PI * 2;
            ctx.globalAlpha = 0.18 * gwbPulse * (1 - rr / 220);
            ctx.fillRect(Math.round(W / 2 + Math.cos(a) * rr) - 1, Math.round(H / 2 + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Alens: four corner distortion spokes only (no rings; ball twist is primary tell) ──
      if (g.alensActive) {
        const alensMargin = 14;
        ctx.fillStyle = '#7a6a98';
        const alensCorners: [number, number, number, number][] = [
          [alensMargin, alensMargin, 1, 1],
          [W - alensMargin, alensMargin, -1, 1],
          [alensMargin, H - alensMargin, 1, -1],
          [W - alensMargin, H - alensMargin, -1, -1],
        ];
        for (const [acx, acy, asx, asy] of alensCorners) {
          for (let k = 0; k < 6; k++) {
            const t = k / 5;
            const len = 22 + 3 * Math.sin(g.frame * 0.045 + k * 0.7);
            ctx.globalAlpha = 0.12 * (1 - t * 0.55);
            ctx.fillRect(
              Math.round(acx + asx * t * len) - 1,
              Math.round(acy + asy * t * len) - 1,
              2, 2,
            );
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Hellings-Downs hum: four corner timing dots with HD phase offsets (not in-phase) ──
      if (g.hdHumActive) {
        const hdMargin = 12;
        ctx.fillStyle = '#6a6878';
        const hdCorners: [number, number, number][] = [
          [hdMargin, hdMargin, 0],
          [W - hdMargin, hdMargin, Math.PI * 0.5],
          [hdMargin, H - hdMargin, Math.PI],
          [W - hdMargin, H - hdMargin, Math.PI * 1.5],
        ];
        for (let ci = 0; ci < 4; ci++) {
          const [hcx, hcy, ang] = hdCorners[ci];
          // Phase offset follows HD(θ) between this corner and corner 0.
          const theta = Math.min(ci, 4 - ci) * (Math.PI * 0.5);
          const hd = hellingsDowns(theta);
          const pulse = 0.35 + 0.65 * Math.abs(Math.sin(g.frame * 0.035 + hd * 4.2 + ang));
          ctx.globalAlpha = 0.10 + 0.12 * pulse;
          ctx.fillRect(Math.round(hcx) - 1, Math.round(hcy) - 1, 2, 2);
          ctx.globalAlpha = 0.06 * pulse;
          ctx.fillRect(Math.round(hcx + Math.cos(ang) * 5) - 1, Math.round(hcy + Math.sin(ang) * 5) - 1, 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Blue-tilted primordial hum: corner dots blink faster toward the bottom (no phase sync) ──
      if (g.blueHumActive) {
        const bhMargin = 11;
        ctx.fillStyle = '#586878';
        const bhCorners: [number, number][] = [
          [bhMargin, bhMargin],
          [W - bhMargin, bhMargin],
          [bhMargin, H - bhMargin],
          [W - bhMargin, H - bhMargin],
        ];
        for (const [bx, by] of bhCorners) {
          const omega = BLUEHUM_W0 + BLUEHUM_W_SLOPE * (by / H);
          const pulse = 0.30 + 0.70 * Math.abs(Math.sin(g.frame * omega + bx * 0.01));
          ctx.globalAlpha = 0.08 + 0.10 * pulse;
          ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Isotropic cosmic birefringence: corner dots drift one-handed (no board body) ──
      if (g.isoBireActive) {
        const ibMargin = 12;
        ctx.fillStyle = '#686078';
        const hand = g.isoBireBeta >= 0 ? 1 : -1;
        const ibCorners: [number, number, number][] = [
          [ibMargin, ibMargin, 0],
          [W - ibMargin, ibMargin, 1],
          [ibMargin, H - ibMargin, 2],
          [W - ibMargin, H - ibMargin, 3],
        ];
        for (const [bx, by, i] of ibCorners) {
          const phase = g.frame * 0.0015 * hand + i * 0.9;
          const pulse = 0.30 + 0.70 * Math.abs(Math.sin(phase));
          ctx.globalAlpha = 0.07 + 0.09 * pulse;
          ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Momentum-only dark coupling: copper-ash corner dots, deliberately out of phase ──
      if (g.momCoupActive) {
        const mMargin = 11;
        ctx.fillStyle = '#7a6860';
        const mCorners: [number, number, number][] = [
          [mMargin, mMargin, 0.0],
          [W - mMargin, mMargin, 1.7],
          [mMargin, H - mMargin, 3.1],
          [W - mMargin, H - mMargin, 4.6],
        ];
        for (const [mx, my, ph] of mCorners) {
          const pulse = 0.30 + 0.70 * Math.abs(Math.sin(g.frame * 0.028 + ph));
          ctx.globalAlpha = 0.08 + 0.10 * pulse;
          ctx.fillRect(Math.round(mx), Math.round(my), 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── SIDM final-parsec spike: dual cores + rust-cyan stream (visual creep only) ──
      if (g.sidmSpike) {
        const sp = g.sidmSpike;
        const mx = (sp.x1 + sp.x2) * 0.5, my = (sp.y1 + sp.y2) * 0.5;
        const hx = (sp.x2 - sp.x1) * 0.5, hy = (sp.y2 - sp.y1) * 0.5;
        // Extremely slow visual approach that never fully merges (physics stays at full sep).
        const visShrink = Math.min(0.28, g.frame * 0.000015);
        const vx1 = mx - hx * (1 - visShrink), vy1 = my - hy * (1 - visShrink);
        const vx2 = mx + hx * (1 - visShrink), vy2 = my + hy * (1 - visShrink);
        // Streamline dots along the visual axis
        ctx.fillStyle = '#4a8a9a';
        for (let i = 0; i <= 12; i++) {
          const u = i / 12;
          const px = vx1 + (vx2 - vx1) * u;
          const py = vy1 + (vy2 - vy1) * u;
          const wob = Math.sin(g.frame * 0.003 + i * 0.7) * 3;
          const nx = -(vy2 - vy1), ny = (vx2 - vx1);
          const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
          ctx.globalAlpha = 0.12 + 0.10 * Math.abs(Math.sin(u * Math.PI + g.frame * 0.004));
          ctx.fillRect(Math.round(px + (nx / nlen) * wob) - 1, Math.round(py + (ny / nlen) * wob) - 1, 2, 1);
        }
        // Dual cores
        for (const [cx, cy] of [[vx1, vy1], [vx2, vy2]] as [number, number][]) {
          ctx.fillStyle = '#3a6870';
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2 + g.frame * 0.008;
            const r = 3 + (k % 2);
            ctx.globalAlpha = 0.45 + (k % 2) * 0.2;
            ctx.fillRect(Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 2, 2);
          }
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = '#4a8a9a';
          ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Neutrino mass null band: broken ash-green edge stitches only ──
      for (const nb of g.nuNullBands) {
        const tc = Math.cos(nb.angle), ts = Math.sin(nb.angle);
        ctx.fillStyle = '#6a7868';
        for (let i = -16; i <= 16; i++) {
          if ((i + ((g.frame * 0.002) | 0)) % 3 === 0) continue;
          const along = (i / 16) * nb.len * 0.5;
          for (const side of [-1, 1] as const) {
            const across = side * nb.halfW;
            const px = nb.cx + tc * along - ts * across;
            const py = nb.cy + ts * along + tc * across;
            if (px < 4 || px > W - 4 || py < 4 || py > H - 4) continue;
            ctx.globalAlpha = 0.10 + 0.08 * Math.abs(Math.sin(i * 0.4 + g.frame * 0.002));
            ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Two-component DM segregation: dense navy core + sparse ash outer ring ──
      for (const th of g.tcDmHalos) {
        // Core (heavy)
        ctx.fillStyle = '#3a5068';
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + g.frame * 0.006;
          const r = 4 + (i % 3) * 2;
          ctx.globalAlpha = 0.40 + (i % 2) * 0.2;
          ctx.fillRect(Math.round(th.x + Math.cos(a) * r) - 1, Math.round(th.y + Math.sin(a) * r) - 1, 2, 2);
        }
        // Outer shell (light) — sparse, density-inverted tell
        ctx.fillStyle = '#8890a0';
        const n = 18;
        for (let i = 0; i < n; i++) {
          if (i % 3 === 0) continue;
          const a = (i / n) * Math.PI * 2 + g.frame * 0.0015;
          const rr = (TCDM_INNER + TCDM_OUTER) * 0.5 + Math.sin(a * 3 + g.frame * 0.002) * 3;
          ctx.globalAlpha = 0.10 + 0.06 * Math.abs(Math.sin(a * 2));
          ctx.fillRect(Math.round(th.x + Math.cos(a) * rr) - 1, Math.round(th.y + Math.sin(a) * rr) - 1, 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Free-streaming softening: slate ellipse edge stitches only ──
      for (const fs of g.fsSoftFields) {
        ctx.fillStyle = '#8890a0';
        const n = 24;
        for (let i = 0; i < n; i++) {
          if ((i + ((g.frame * 0.002) | 0)) % 3 === 0) continue;
          const a = (i / n) * Math.PI * 2;
          const px = fs.x + Math.cos(a) * fs.rx;
          const py = fs.y + Math.sin(a) * fs.ry;
          if (px < 4 || px > W - 4 || py < 4 || py > H - 4) continue;
          ctx.globalAlpha = 0.08 + 0.06 * Math.abs(Math.sin(a * 2 + g.frame * 0.002));
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Overmassive mimic core: oversized rust-purple cocoon; burst shrinks/darkens core ──
      for (const om of g.ommCores) {
        if (om.burstTimer > 0) {
          om.burstTimer--;
        } else {
          om.timer--;
          if (om.timer <= 0) {
            om.burstTimer = OMM_BURST_DUR;
            om.timer = OMM_PERIOD;
            spawnBurst(g, om.x, om.y, 2, 2, '#c87060');
          }
        }
        const bursting = om.burstTimer > 0;
        const visR = bursting ? OMM_VIS_R * 0.62 : OMM_VIS_R;
        ctx.fillStyle = bursting ? '#c87060' : '#785868';
        const n = bursting ? 22 : 16;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + g.frame * 0.004;
          const rr = visR * (0.45 + (i % 4) * 0.12);
          ctx.globalAlpha = bursting ? 0.45 : 0.18 + 0.10 * Math.abs(Math.sin(a * 2 + g.frame * 0.01));
          ctx.fillRect(Math.round(om.x + Math.cos(a) * rr) - 1, Math.round(om.y + Math.sin(a) * rr) - 1, 2, 2);
        }
        ctx.globalAlpha = bursting ? 0.85 : 0.35;
        ctx.fillStyle = bursting ? '#a04040' : '#5a3848';
        ctx.fillRect(Math.round(om.x) - 1, Math.round(om.y) - 1, 2, 2);
        ctx.globalAlpha = 1;
      }

      // ── FRB microlens IMBH: 1px shimmer; dual ghost arcs on flash ──
      for (const ml of g.frbMicrolenses) {
        if (ml.flashTimer > 0) ml.flashTimer--;
        ctx.fillStyle = '#c8b090';
        ctx.globalAlpha = 0.25 + 0.20 * Math.abs(Math.sin(g.frame * 0.003 + ml.ang0));
        ctx.fillRect(Math.round(ml.x) - 1, Math.round(ml.y) - 1, 2, 2);
        if (ml.flashTimer > 0) {
          const life = ml.flashTimer / FRBML_FLASH;
          for (const off of [-0.12, 0.12] as const) {
            for (let i = 0; i < 10; i++) {
              const a = ml.ang0 - FRBML_SPAN * 0.5 + (i / 9) * FRBML_SPAN + off;
              const rr = FRBML_R * (1 + off * 0.35);
              ctx.globalAlpha = life * 0.45;
              ctx.fillRect(Math.round(ml.x + Math.cos(a) * rr) - 1, Math.round(ml.y + Math.sin(a) * rr) - 1, 2, 1);
            }
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Primordial B-field clumps: sparse ash clusters that visually creep together ──
      if (g.pmfClumps.length > 0) {
        let cx = 0, cy = 0;
        for (const pc of g.pmfClumps) { cx += pc.x; cy += pc.y; }
        cx /= g.pmfClumps.length; cy /= g.pmfClumps.length;
        ctx.fillStyle = '#586878';
        for (const pc of g.pmfClumps) {
          const creep = Math.min(0.18, g.frame * 0.000012);
          const vx = pc.x + (cx - pc.x) * creep;
          const vy = pc.y + (cy - pc.y) * creep;
          for (let k = 0; k < 5; k++) {
            const a = pc.phase + (k / 5) * Math.PI * 2 + g.frame * 0.002;
            const r = 3 + (k % 3) * 2;
            ctx.globalAlpha = 0.14 + 0.10 * Math.abs(Math.sin(a));
            ctx.fillRect(Math.round(vx + Math.cos(a) * r) - 1, Math.round(vy + Math.sin(a) * r) - 1, 1, 1);
          }
          ctx.globalAlpha = 0.35;
          ctx.fillRect(Math.round(vx), Math.round(vy), 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── IDE energy siphon band: amber-ash broken edge stitches ──
      for (const sb of g.ideSiphonBands) {
        const tc = Math.cos(sb.angle), ts = Math.sin(sb.angle);
        ctx.fillStyle = '#8a7860';
        for (let i = -16; i <= 16; i++) {
          if ((i + ((g.frame * 0.002) | 0)) % 3 === 0) continue;
          const along = (i / 16) * sb.len * 0.5;
          for (const side of [-1, 1] as const) {
            const across = side * sb.halfW;
            const px = sb.cx + tc * along - ts * across;
            const py = sb.cy + ts * along + tc * across;
            if (px < 4 || px > W - 4 || py < 4 || py > H - 4) continue;
            ctx.globalAlpha = 0.10 + 0.08 * Math.abs(Math.sin(i * 0.4 + g.frame * 0.002));
            ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Vacuum decay leak: blue-white broken ring that breathes; sparse inner dots at peak ──
      for (const vl of g.vacLeaks) {
        let tAge = vl.age;
        // Visual uses current age (advanced in physics only while firing; idle uses stored).
        const active = tAge < VACLEAK_T;
        const env = active ? Math.sin(Math.PI * tAge / VACLEAK_T) : 0;
        ctx.fillStyle = '#a8b0b8';
        const n = 36;
        for (let i = 0; i < n; i++) {
          if ((i + ((g.frame * 0.002) | 0)) % 3 === 0) continue;
          const a = (i / n) * Math.PI * 2 + g.frame * 0.0015;
          const px = vl.x + Math.cos(a) * VACLEAK_R;
          const py = vl.y + Math.sin(a) * VACLEAK_R;
          if (px < 4 || px > W - 4 || py < 4 || py > H - 4) continue;
          ctx.globalAlpha = 0.08 + 0.10 * env;
          ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
        }
        if (env > 0.55) {
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + g.frame * 0.002;
            const rr = VACLEAK_R * (0.25 + 0.35 * ((i * 37) % 5) / 5);
            const px = vl.x + Math.cos(a) * rr;
            const py = vl.y + Math.sin(a) * rr;
            ctx.globalAlpha = 0.06 * env;
            ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Gravity echo delay: epicenter shimmer + pale delayed arc ──
      if (g.gravEcho) {
        const ge = g.gravEcho;
        ctx.fillStyle = '#787088';
        // 1px epicenter shimmer
        if ((g.frame % 140) < 3) {
          ctx.globalAlpha = 0.35;
          ctx.fillRect(Math.round(ge.x), Math.round(ge.y), 1, 1);
        }
        // Delayed arc radius grows with buffer phase (visual only)
        const echo = Math.abs(ge.buf[ge.write]);
        const arcR = 20 + (g.frame % GRAVECHO_DELAY) * (GRAVECHO_RANGE / GRAVECHO_DELAY);
        const n = 28;
        for (let i = 0; i < n; i++) {
          if ((i + ((g.frame * 0.002) | 0)) % 4 === 0) continue;
          const a = (i / n) * Math.PI * 2;
          const px = ge.x + Math.cos(a) * arcR;
          const py = ge.y + Math.sin(a) * arcR;
          if (px < 4 || px > W - 4 || py < 4 || py > H - 4) continue;
          ctx.globalAlpha = Math.min(0.10, 0.04 + 0.08 * echo);
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Boson star soft caustic: pale-gold broken double rim + centroid ghost on fold ──
      for (const bc of g.bosonCaustics) {
        if (bc.ghostTimer > 0) bc.ghostTimer--;
        ctx.fillStyle = '#b8a878';
        const n = 40;
        for (const rr of [BOSON_R - BOSON_HALF, BOSON_R + BOSON_HALF]) {
          for (let i = 0; i < n; i++) {
            if ((i + ((g.frame * 0.002) | 0)) % 3 === 0) continue;
            const a = (i / n) * Math.PI * 2;
            const px = bc.x + Math.cos(a) * rr;
            const py = bc.y + Math.sin(a) * rr;
            if (px < 4 || px > W - 4 || py < 4 || py > H - 4) continue;
            ctx.globalAlpha = 0.10 + 0.06 * Math.abs(Math.sin(i * 0.5 + g.frame * 0.002));
            ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
          }
        }
        if (bc.ghostTimer > 0) {
          ctx.globalAlpha = 0.20 * (bc.ghostTimer / BOSON_GHOST);
          ctx.fillRect(Math.round(bc.ghostX), Math.round(bc.ghostY), 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Intrinsic alignment contaminant: ash-purple parallel streaks (no closed contour) ──
      for (const ia of g.iaContams) {
        const ca = Math.cos(ia.axis), sa = Math.sin(ia.axis);
        ctx.fillStyle = '#6a6078';
        for (let i = -5; i <= 5; i++) {
          if ((i + ((g.frame * 0.002) | 0)) % 2 === 0) continue;
          const along = (i / 5) * ia.rx * 0.85;
          for (let j = -2; j <= 2; j++) {
            const across = (j / 2) * ia.ry * 0.55;
            const px = ia.x + ca * along - sa * across;
            const py = ia.y + sa * along + ca * across;
            if (px < 4 || px > W - 4 || py < 4 || py > H - 4) continue;
            ctx.globalAlpha = 0.08 + 0.06 * Math.abs(Math.sin(i * 0.7 + g.frame * 0.002));
            ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Sign-switching IDE seam: rust/ice dual broken stitches ──
      for (const ss of g.signIdeSeams) {
        if (ss.blinkTimer > 0) continue;
        const tc = Math.cos(ss.angle), ts = Math.sin(ss.angle);
        for (let i = -18; i <= 18; i++) {
          if ((i + ((g.frame * 0.0018) | 0)) % 3 === 0) continue;
          const along = (i / 18) * ss.len * 0.5;
          for (const side of [-1, 1] as const) {
            const across = side * ss.halfW;
            const px = ss.cx + tc * along - ts * across;
            const py = ss.cy + ts * along + tc * across;
            if (px < 4 || px > W - 4 || py < 4 || py > H - 4) continue;
            // Positive side rust, negative side ice (swap colors when flipped).
            const rust = (side * ss.signFlip) > 0;
            ctx.fillStyle = rust ? '#7a6868' : '#889098';
            ctx.globalAlpha = 0.10 + 0.08 * Math.abs(Math.sin(i * 0.4 + g.frame * 0.0018));
            ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Phantom Crossing Belt: ash-purple broken horizontal stitches ──
      for (const pb of g.phantomBelts) {
        const yOff = pb.flashTimer > 0 ? 2 : 0;
        ctx.fillStyle = '#686078';
        for (let x = 8; x < W - 8; x += 7) {
          if (((x / 7) + ((g.frame * 0.0018) | 0)) % 3 === 0) continue;
          const y = pb.y + Math.sin(x * 0.04 + g.frame * 0.0015) * 0.6;
          if (y < 4 || y > H - 4) continue;
          ctx.globalAlpha = 0.10 + 0.06 * Math.abs(Math.sin(x * 0.05 + g.frame * 0.0018));
          ctx.fillRect(x, Math.round(y - pb.halfW * 0.35), 2, 1);
          ctx.fillRect(x + 3, Math.round(y + pb.halfW * 0.35), 2, 1);
          if (yOff) {
            ctx.globalAlpha = 0.08;
            ctx.fillRect(x, Math.round(y - pb.halfW * 0.35 + yOff), 2, 1);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Multiplicative shear bias veil: sparse ash-cyan calibration ticks ──
      for (const mb of g.mBiasVeils) {
        const ca = Math.cos(mb.axis), sa = Math.sin(mb.axis);
        ctx.fillStyle = '#687888';
        for (let i = -4; i <= 4; i++) {
          if ((i + ((g.frame * 0.0018) | 0)) % 2 === 0) continue;
          for (let j = -3; j <= 3; j++) {
            if ((i + j) % 2 === 0) continue;
            const along = (i / 4) * mb.rx * 0.9;
            const across = (j / 3) * mb.ry * 0.75;
            const px = mb.x + ca * along - sa * across;
            const py = mb.y + sa * along + ca * across;
            if (px < 4 || px > W - 4 || py < 4 || py > H - 4) continue;
            ctx.globalAlpha = 0.08 + 0.05 * Math.abs(Math.sin(i * 0.5 + g.frame * 0.0018));
            ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Catastrophic photo-z gate: 1px broken line + 2px ghost double-image ──
      for (const pz of g.photoZGates) {
        const ca = Math.cos(pz.angle), sa = Math.sin(pz.angle);
        const nx = -sa, ny = ca;
        for (let i = -14; i <= 14; i++) {
          if ((i + ((g.frame * 0.0018) | 0)) % 3 === 0) continue;
          const along = (i / 14) * PHOTOZ_LEN * 0.5;
          const px = pz.x + ca * along;
          const py = pz.y + sa * along;
          if (px < 4 || px > W - 4 || py < 4 || py > H - 4) continue;
          ctx.fillStyle = '#787068';
          ctx.globalAlpha = pz.flashTimer > 0 ? 0.28 : 0.10;
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
          // Ghost contour offset 2px along normal (catastrophic redshift double-image).
          ctx.globalAlpha = pz.flashTimer > 0 ? 0.18 : 0.06;
          ctx.fillRect(Math.round(px + nx * 2), Math.round(py + ny * 2), 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Big Ring uLSS: sparse rust-cyan dotted ring, very slow ±2px breathe ──
      for (const br of g.bigRings) {
        const brEffR = br.r + BIGRING_BREATHE * Math.sin(g.frame * BIGRING_BREATHE_K);
        ctx.fillStyle = '#4a8a9a';
        const nDots = Math.max(28, Math.round((2 * Math.PI * brEffR) / 14));
        // Zone E-style: slowly precessing ~15% gap so the ring never fully closes.
        const gapC = g.frame * 0.0012;
        for (let i = 0; i < nDots; i++) {
          const a = (i / nDots) * Math.PI * 2;
          let gd = ((a - gapC) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          if (gd > Math.PI) gd = Math.PI * 2 - gd;
          if (gd < Math.PI * 0.15) continue;
          const flicker = 0.45 + 0.55 * Math.sin(g.frame * 0.012 + i * 2.1);
          ctx.globalAlpha = 0.28 + flicker * 0.22;
          ctx.fillRect(
            Math.round(br.cx + Math.cos(a) * brEffR) - 1,
            Math.round(br.cy + Math.sin(a) * brEffR) - 1,
            2, 2,
          );
        }
        ctx.globalAlpha = 1;
      }

      // ── CMB Anisotropy: Planck-style mottled warm/cool dots baked at generation.
      // Each frame only modulates alpha in phase with T (k=0.005) — no moving elements.
      // Two-pass draw keeps fillStyle fixed (was toggled per-dot). ──
      if (g.cmbAnisotropy) {
        const cmbPulse = Math.sin(g.frame * 0.005);
        const dots = g.cmbAnisotropy.dots;
        ctx.fillStyle = '#e8c8a0';
        for (const d of dots) {
          if (d.T < 0) continue;
          const a = Math.min(CMB_ALPHA_MAX, d.T * 0.10) * (0.8 + 0.2 * cmbPulse);
          if (a <= 0.01) continue;
          ctx.globalAlpha = a;
          ctx.fillRect(d.x | 0, d.y | 0, 2, 2);
        }
        ctx.fillStyle = '#a8c8e0';
        for (const d of dots) {
          if (d.T >= 0) continue;
          const a = Math.min(CMB_ALPHA_MAX, -d.T * 0.10) * (0.8 - 0.2 * cmbPulse);
          if (a <= 0.01) continue;
          ctx.globalAlpha = a;
          ctx.fillRect(d.x | 0, d.y | 0, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Mass-horizon entropic drag: deep wine radial spokes + breathing tell ─
      if (g.entropicDragActive) {
        const ecx = W / 2, ecy = g.H * 0.42;
        const rot = g.frame * 0.0008;
        const eH = Math.min(ENTROPIC_H_MAX, ENTROPIC_H0 + g.frame * ENTROPIC_H_RAMP);
        // slightly faster tell as H ramps (visual only)
        const tellPeriod = Math.max(5, Math.round(8 - (eH / ENTROPIC_H_MAX) * 3));
        const tellIdx = Math.floor(g.frame / tellPeriod) % ENTROPIC_SPOKES;
        ctx.fillStyle = '#8a3848';
        for (let i = 0; i < ENTROPIC_SPOKES; i++) {
          const a = rot + (i / ENTROPIC_SPOKES) * Math.PI * 2;
          ctx.globalAlpha = i === tellIdx ? 0.35 : 0.10;
          for (let r = 20; r < Math.min(W, g.H) * 0.45; r += 14) {
            ctx.fillRect(
              Math.round(ecx + Math.cos(a) * r),
              Math.round(ecy + Math.sin(a) * r),
              1, 1,
            );
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Holographic RG sheet: pearl parallel stripes + layer offset tell ────
      for (const hs of g.holographicRGSheets) {
        if (hs.hitFlash > 0) hs.hitFlash--;
        const hc = Math.cos(hs.angle + g.frame * 0.004), hsn = Math.sin(hs.angle + g.frame * 0.004);
        // denser stripes briefly after layer change
        const dens = hs.hitFlash > 4 ? 1.2 : 1;
        const stripes = Math.round(7 * dens);
        const spacing = 10;
        // layer offset from any ball currently inside (display tell)
        let layerOff = 0;
        for (const ball of g.balls) {
          if (ball.rgLayer > 0) { layerOff = ball.rgLayer * 3; break; }
        }
        ctx.fillStyle = '#d0d4e0';
        for (let s = 0; s < stripes; s++) {
          const sly = -HOLO_THICK * 0.5 + (s + 0.5) * (HOLO_THICK / stripes) + layerOff;
          const nDots = Math.floor(HOLO_LEN / spacing);
          for (let i = 0; i < nDots; i++) {
            const slx = -HOLO_LEN * 0.5 + i * spacing;
            const baseX = hs.x + hc * slx - hsn * sly;
            const baseY = hs.y + hsn * slx + hc * sly;
            const px = zoneLayerShift(baseX, g.frame, i + s * 17, s);
            const py = zoneLayerShift(baseY, g.frame, i + s * 19, s + 1);
            // Quieter sheet body; markers below stay readable on layer change.
            ctx.globalAlpha = 0.18 + 0.10 * Math.sin(g.frame * 0.01 + s);
            ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
          }
        }
        if (hs.hitFlash > 0) {
          const ft = hs.hitFlash / HOLO_FLASH;
          ctx.globalAlpha = ft * 0.85;
          ctx.fillStyle = '#d0d4e0';
          ctx.fillRect(Math.round(hs.hitX) - 2, Math.round(hs.hitY), 5, 1);
          ctx.fillRect(Math.round(hs.hitX), Math.round(hs.hitY) - 2, 1, 5);
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
          const flicker = 0.28 + 0.18 * Math.sin(g.frame * 0.02 + s * 1.3);
          const nDots = Math.floor(CB_LEN / CB_DOT_SPACING);
          for (let i = 0; i < nDots; i++) {
            const slx = -CB_LEN * 0.5 + ((i * CB_DOT_SPACING + g.frame * 0.3) % CB_LEN);
            const baseX = cb.x + cbCos * slx - cbSin * sly;
            const baseY = cb.y + cbSin * slx + cbCos * sly;
            const px = zoneLayerShift(baseX, g.frame, i + s * 13, s);
            const py = zoneLayerShift(baseY, g.frame, i + s * 17, s + 1);
            ctx.globalAlpha = flicker;
            ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
          }
        }
        ctx.globalAlpha = 1;

        if (cb.hitFlash > 0) {
          const cbFt = cb.hitFlash / CB_FADE_DUR;
          const armLen = 6;
          const cca = Math.cos(cb.hitAngle), csa = Math.sin(cb.hitAngle);
          ctx.fillStyle = '#c8b8e8';
          ctx.globalAlpha = cbFt * 0.85;
          for (let d = -armLen; d <= armLen; d += 2) {
            ctx.fillRect(Math.round(cb.hitX + cca * d) - 1, Math.round(cb.hitY + csa * d) - 1, 2, 2);
            ctx.fillRect(Math.round(cb.hitX - csa * d) - 1, Math.round(cb.hitY + cca * d) - 1, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
      }

      // ── Planck diffraction gratings: blue slits + orange order rays ───────────
      for (const pdg of g.planckGratings) {
        if (pdg.hitFlash > 0) pdg.hitFlash--;
        const pc = Math.cos(pdg.angle), ps = Math.sin(pdg.angle);
        const PDG_SLITS = 7, PDG_SPACING = 10;
        for (let s = 0; s < PDG_SLITS; s++) {
          const sly = -PDG_THICK * 0.5 + (s + 0.5) * (PDG_THICK / PDG_SLITS);
          const flicker = 0.45 + 0.4 * Math.sin(g.frame * 0.18 + s * 0.9);
          const nDots = Math.floor(PDG_LEN / PDG_SPACING);
          for (let i = 0; i < nDots; i++) {
            const slx = -PDG_LEN * 0.5 + i * PDG_SPACING;
            const px = pdg.x + pc * slx - ps * sly;
            const py = pdg.y + ps * slx + pc * sly;
            ctx.fillStyle = '#3548b8';
            ctx.globalAlpha = flicker;
            ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
          }
        }
        for (const deg of PDG_ORDER_DEG) {
          const ra = pdg.angle + Math.PI / 2 + deg * Math.PI / 180;
          const lit = pdg.hitFlash > 0 && pdg.hitOrder === deg;
          ctx.fillStyle = lit ? '#ffffff' : '#e36b2c';
          ctx.globalAlpha = lit ? 0.95 : 0.42;
          for (let t = 1; t <= 6; t++) {
            const px = pdg.x + Math.cos(ra) * t * 10;
            const py = pdg.y + Math.sin(ra) * t * 10;
            ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
          }
        }
        if (pdg.hitFlash > 0) {
          const ft = pdg.hitFlash / PDG_FLASH;
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = ft;
          ctx.fillRect(Math.round(pdg.hitX) - 2, Math.round(pdg.hitY) - 2, 4, 4);
        }
        ctx.globalAlpha = 1;
      }

      // ── Vacuum Cherenkov domains: cyan boundary pulse + purple priority axis ──
      for (const vc of g.vacuumCherenkovDomains) {
        if (vc.burstTimer > 0) vc.burstTimer--;
        const pulse = 0.35 + 0.25 * Math.sin(g.frame * 0.025);
        const nRing = 36;
        for (let i = 0; i < nRing; i++) {
          const a = (i / nRing) * Math.PI * 2;
          ctx.fillStyle = '#00a8c8';
          ctx.globalAlpha = pulse * 0.55;
          ctx.fillRect(Math.round(vc.x + Math.cos(a) * VC_R) - 1, Math.round(vc.y + Math.sin(a) * VC_R) - 1, 2, 2);
        }
        const axLen = 30;
        ctx.fillStyle = '#6b3fc9';
        ctx.globalAlpha = 0.78;
        for (let t = -axLen; t <= axLen; t += 4) {
          ctx.fillRect(Math.round(vc.x + Math.cos(vc.axis) * t) - 1, Math.round(vc.y + Math.sin(vc.axis) * t) - 1, 2, 2);
        }
        if (vc.burstTimer > 0) {
          const bt = vc.burstTimer / VC_BURST_DUR;
          const backA = Math.atan2(-vc.burstVy, -vc.burstVx);
          const perpA = backA + Math.PI / 2;
          const coneSpread = 0.35;
          for (let c = 0; c < 2; c++) {
            const sign = c === 0 ? 1 : -1;
            const ca = backA + sign * coneSpread;
            ctx.fillStyle = '#00a8c8';
            ctx.globalAlpha = bt * 0.85;
            for (let d = 0; d < 6; d++) {
              const px = vc.burstX + Math.cos(ca) * d * 3.0;
              const py = vc.burstY + Math.sin(ca) * d * 3.0;
              ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
            }
          }
          ctx.fillStyle = '#6b3fc9';
          ctx.globalAlpha = bt * 0.55;
          const rx = Math.cos(perpA) * vc.burstFlip * 5;
          const ry = Math.sin(perpA) * vc.burstFlip * 5;
          ctx.fillRect(Math.round(vc.burstX + rx) - 1, Math.round(vc.burstY + ry) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Closed timelike curves: counter-rotating double ring with 20% gap ──
      for (const ctc of g.closedTimelikeCurves) {
        if (ctc.warpLeft > 0) ctc.warpLeft--;
        const gapHalf = Math.PI * CTC_GAP_FRAC;
        const outerOff = g.frame * 0.012;
        const innerOff = -g.frame * 0.018;
        const drawRing = (radius: number, rot: number, col: string, alpha: number) => {
          const steps = 48;
          for (let i = 0; i < steps; i++) {
            const a = (i / steps) * Math.PI * 2 + rot;
            let rel = a - ctc.gapAngle;
            while (rel > Math.PI) rel -= Math.PI * 2;
            while (rel < -Math.PI) rel += Math.PI * 2;
            if (Math.abs(rel) < gapHalf) continue;
            ctx.fillStyle = col;
            ctx.globalAlpha = alpha;
            ctx.fillRect(Math.round(ctc.x + Math.cos(a) * radius) - 1, Math.round(ctc.y + Math.sin(a) * radius) - 1, 2, 2);
          }
        };
        drawRing(CTC_OUTER_R, outerOff, '#d12f8a', 0.72);
        drawRing(CTC_INNER_R, innerOff, '#159f9f', 0.68);
        if (ctc.warpLeft > 0) {
          const wt = 1 - ctc.warpLeft / CTC_WARP_DUR;
          for (let i = 0; i < 8; i++) {
            const t = (i + 1) / 8 * wt;
            const px = ctc.warpFromX + (ctc.warpToX - ctc.warpFromX) * t;
            const py = ctc.warpFromY + (ctc.warpToY - ctc.warpFromY) * t;
            ctx.fillStyle = i % 2 === 0 ? '#d12f8a' : '#159f9f';
            ctx.globalAlpha = 0.9 * (1 - wt * 0.5);
            ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
          }
          if (ctc.warpLeft <= 1) {
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.95;
            ctx.fillRect(Math.round(ctc.warpToX) - 1, Math.round(ctc.warpToY) - 1, 2, 2);
          }
        }
        for (const ball of g.balls) {
          const st = g.ctcStates.get(ball);
          if (!st) continue;
          ctx.fillStyle = '#d12f8a';
          ctx.globalAlpha = 0.55 + 0.35 * (st.anchorLeft / CTC_WAIT);
          ctx.fillRect(Math.round(st.snapX) - 1, Math.round(st.snapY) - 1, 2, 2);
          if (st.waitLeft <= 40) {
            const prog = 1 - Math.max(0, st.waitLeft - 8) / 32;
            const segs = Math.floor(prog * 10);
            for (let s = 1; s <= segs; s++) {
              const t = s / 10;
              const px = st.snapX + (ball.x - st.snapX) * t;
              const py = st.snapY + (ball.y - st.snapY) * t;
              ctx.fillStyle = s % 2 === 0 ? '#159f9f' : '#d12f8a';
              ctx.globalAlpha = st.waitLeft <= 8 ? ((g.frame >> 1) % 2 === 0 ? 0.9 : 0.35) : 0.55;
              ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
            }
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Gravitational caustics: gold fold-line polyline, denser at the bend ──
      for (const gc of g.gravitationalCaustics) {
        if (gc.hitFlash > 0) gc.hitFlash--;
        const n = gc.pts.length;
        const foldIdx = Math.floor((n - 1) / 2);
        for (let i = 0; i < CAUSTIC_DOTS; i++) {
          const t = i / (CAUSTIC_DOTS - 1);
          const pi = Math.min(n - 1, Math.floor(t * (n - 1)));
          const p = gc.pts[pi];
          const nearFold = Math.abs(pi - foldIdx) <= 2;
          const flicker = 0.55 + 0.25 * Math.sin(g.frame * 0.008 + i * 0.7);
          ctx.fillStyle = '#d4b85a';
          ctx.globalAlpha = flicker * (nearFold ? 1.35 : 0.85);
          const sz = nearFold ? 2 : 2;
          ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, sz, sz);
          if (nearFold) {
            ctx.fillRect(Math.round(p.x + (i % 2 === 0 ? 1 : -1)), Math.round(p.y), 1, 1);
          }
        }
        {
          const fp = gc.pts[foldIdx];
          const breath = 0.45 + 0.45 * Math.abs(Math.sin(g.frame * 0.05));
          ctx.fillStyle = '#fff8e0';
          ctx.globalAlpha = breath;
          ctx.fillRect(Math.round(fp.x) - 1, Math.round(fp.y) - 1, 2, 2);
        }
        if (gc.hitFlash > 0) {
          const ft = gc.hitFlash / CAUSTIC_FLASH;
          ctx.fillStyle = '#fff8e0';
          ctx.globalAlpha = ft;
          ctx.fillRect(Math.round(gc.hitX) - 1, Math.round(gc.hitY) - 1, 2, 2);
          ctx.fillStyle = '#d4b85a';
          ctx.globalAlpha = ft * 0.85;
          for (let s = 0; s < 3; s++) {
            const along = (s - 1) * 4;
            // spark along approximate fold tangent near hit
            const mid = Math.max(1, Math.min(n - 2, foldIdx));
            const tx = gc.pts[mid + 1].x - gc.pts[mid - 1].x;
            const ty = gc.pts[mid + 1].y - gc.pts[mid - 1].y;
            const tl = Math.hypot(tx, ty) || 1;
            ctx.fillRect(Math.round(gc.hitX + (tx / tl) * along), Math.round(gc.hitY + (ty / tl) * along), 1, 1);
          }
        }
        ctx.globalAlpha = 1;
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
            // Binary pair: both nuclei share warn state, so they enter on the same frame;
            // the later one (higher index) copies the lead's velocity to ride the same
            // base path — the weave offset is all that separates them at entry.
            if (comet.orbitPhase !== undefined) {
              const mate = g.comets.find((c) => c !== comet && c.orbitPhase !== undefined && c.respawnTimer === 0);
              if (mate) { comet.vx = mate.vx; comet.vy = mate.vy; }
            }
          }
          continue;
        }
        comet.x += comet.vx;
        comet.y += comet.vy;
        // Binary weave (lv45+ variant): each nucleus rides a sine offset across the shared
        // path. Applied as a per-frame position delta so bounce/ball physics stay untouched.
        if (comet.orbitPhase !== undefined) {
          const prevOff = Math.sin(comet.orbitPhase) * 24;
          comet.orbitPhase += 0.06;
          comet.y += Math.sin(comet.orbitPhase) * 24 - prevOff;
        }
        // Top/bottom bounce keeps both kinds in the play field (vy guards let a comet
        // still fly in cleanly on its first entry from off-screen).
        if (comet.y < launcherY + 40 && comet.vy < 0) comet.vy = Math.abs(comet.vy);
        if (comet.y > H - 80         && comet.vy > 0) comet.vy = -Math.abs(comet.vy);
        if (comet.vanish) {
          // Red: cross and exit, then respawn + re-telegraph (transient, less oppressive).
          if (comet.x < -60 || comet.x > W + 60) {
            if (comet.returns && !comet.returned) {
              // Returning variant (lv50+): it comes straight back once — from the side it
              // just left, one lane lower, on a short telegraph. (Red comets never flip vx,
              // so the exit side is always the opposite of warnFromLeft — flipping it aims
              // the return at the exit side.)
              comet.returned     = true;
              comet.respawnTimer = 36;
              comet.warnFromLeft = !comet.warnFromLeft;
              comet.warnY       += 50;
            } else {
              comet.returned     = false;
              comet.respawnTimer = 50 + Math.floor(Math.random() * 50);
              comet.warnFromLeft = Math.random() < 0.5;
              comet.warnY        = (launcherY + 60) + Math.random() * ((H - launcherY) * 0.45);
            }
            continue;
          }
        } else {
          // Blue: bounce off the left/right screen edges (stays on screen).
          if (comet.x < comet.r     && comet.vx < 0) { comet.x = comet.r;     comet.vx =  Math.abs(comet.vx); }
          if (comet.x > W - comet.r && comet.vx > 0) { comet.x = W - comet.r; comet.vx = -Math.abs(comet.vx); }
        }
        const cang = Math.atan2(comet.vy, comet.vx);
        // Ecosystem: a nearby gravity well bends the comet's tail toward it (draw-only) —
        // the hazards know each other; only the player is a stranger here.
        let bendX = 0, bendY = 0;
        for (const z of g.gravZones) {
          // GravZone x/y is the rect's top-left; the black hole sits at its center
          // (same formula as the draw block and the physics pull).
          const zcx = z.x + z.w / 2, zcy = z.y + z.h / 2;
          const zdx = zcx - comet.x, zdy = zcy - comet.y;
          const zd2 = zdx * zdx + zdy * zdy;
          if (zd2 < 150 * 150 && zd2 > 1) {
            const zd = Math.sqrt(zd2);
            const zt = 1 - zd / 150;
            bendX = (zdx / zd) * zt;
            bendY = (zdy / zd) * zt;
            break;
          }
        }
        for (let ti = 1; ti <= 28; ti++) {
          const td = ti * 4;
          const bend = ti * ti * 0.02; // the far tail bends the most
          const tx = comet.x - Math.cos(cang) * td + (Math.random() - 0.5) * 5 + bendX * bend;
          const ty = comet.y - Math.sin(cang) * td + (Math.random() - 0.5) * 5 + bendY * bend;
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
            const spd = HVS_SPEED_BASE + Math.min(HVS_SPEED_CAP, Math.max(0, g.level - 66) * HVS_SPEED_PER_LV);
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
        // Bow-shock arc ahead (runaway SMBH wake inspired) — bright crescent in travel direction.
        {
          const shockR = 18 + hazardAgeBoost(g.level, 66, 10);
          ctx.fillStyle = '#c8e8ff';
          for (let i = -7; i <= 7; i++) {
            const a = hang + (i / 7) * 0.85;
            ctx.globalAlpha = 0.55 * (1 - Math.abs(i) / 8);
            ctx.fillRect(Math.round(hv.x + Math.cos(a) * shockR) - 1, Math.round(hv.y + Math.sin(a) * shockR) - 1, 2, 2);
          }
        }
        // forward blue-shifted tail: short and dense
        for (let ti = 1; ti <= 10; ti++) {
          const td = ti * 3;
          const tx = hv.x + Math.cos(hang) * td + (Math.random() - 0.5) * 3;
          const ty = hv.y + Math.sin(hang) * td + (Math.random() - 0.5) * 3;
          ctx.fillStyle = '#6ab8ff';
          ctx.globalAlpha = (1 - ti / 11) * 0.9;
          ctx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 2, 2);
        }
        // backward red-shifted tail: longer wake
        for (let ti = 1; ti <= 36; ti++) {
          const td = ti * 4;
          const tx = hv.x - Math.cos(hang) * td + (Math.random() - 0.5) * 5;
          const ty = hv.y - Math.sin(hang) * td + (Math.random() - 0.5) * 5;
          ctx.fillStyle = ti < 8 ? '#ff8a6a' : ti < 20 ? '#ff6a5a' : '#a01818';
          ctx.globalAlpha = (1 - ti / 37) * 0.9;
          const tsz = ti < 10 ? 4 : ti < 22 ? 3 : 2;
          ctx.fillRect(Math.round(tx) - Math.floor(tsz / 2), Math.round(ty) - Math.floor(tsz / 2), tsz, tsz);
        }
        // white-hot core — visual only, no collision hitbox
        drawSolidCircle(ctx, hv.x, hv.y, 10, '#ffffff');
        ctx.fillStyle = '#eaf6ff';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(Math.round(hv.x) - 3, Math.round(hv.y) - 3, 6, 6);
        ctx.globalAlpha = 1;
      }

      // ── Collisionless shocks: V-shaped plasma fronts (update + draw). ─────────
      for (const cls of g.collisionlessShocks) {
        if (cls.respawnTimer > 0) {
          cls.respawnTimer--;
          if (cls.respawnTimer <= CLS_WARN) {
            const wpulse = 0.35 + Math.abs(Math.sin(g.frame * 0.28)) * 0.65;
            const wx = cls.warnFromLeft ? 0 : W - 8;
            ctx.fillStyle = '#2764c4';
            for (let yy = cls.warnY - 18; yy <= cls.warnY + 18; yy += 3) {
              ctx.globalAlpha = wpulse * Math.max(0, 0.8 - Math.abs(yy - cls.warnY) / 42);
              ctx.fillRect(wx, Math.round(yy), 8, 2);
            }
            const dir = cls.warnFromLeft ? 1 : -1;
            const bx = cls.warnFromLeft ? 14 : W - 14;
            ctx.globalAlpha = wpulse;
            for (let k = 0; k < 5; k++) {
              ctx.fillRect(Math.round(bx + dir * k * 3) - 1, Math.round(cls.warnY - k * 2) - 1, 2, 2);
              ctx.fillRect(Math.round(bx + dir * k * 3) - 1, Math.round(cls.warnY + k * 2) - 1, 2, 2);
            }
            ctx.globalAlpha = 1;
          }
          if (cls.respawnTimer === 0) {
            const spd = CLS_SPEED;
            cls.x = cls.warnFromLeft ? -40 : W + 40;
            cls.y = cls.warnY;
            cls.vx = (cls.warnFromLeft ? 1 : -1) * spd;
            cls.vy = (Math.random() < 0.5 ? 1 : -1) * spd * 0.12;
          }
          continue;
        }
        cls.x += cls.vx;
        cls.y += cls.vy;
        if (cls.y < launcherY + 40 && cls.vy < 0) cls.vy = Math.abs(cls.vy);
        if (cls.y > H - 80 && cls.vy > 0) cls.vy = -Math.abs(cls.vy);
        if (cls.x < -80 || cls.x > W + 80) {
          cls.respawnTimer = CLS_RESPAWN_MIN + Math.floor(Math.random() * (CLS_RESPAWN_MAX - CLS_RESPAWN_MIN));
          cls.warnFromLeft = Math.random() < 0.5;
          cls.warnY = (launcherY + 60) + Math.random() * ((H - launcherY) * 0.45);
          continue;
        }
        const hang = Math.atan2(cls.vy, cls.vx);
        const arms = [hang + Math.PI - cls.armSpread, hang + Math.PI + cls.armSpread];
        for (const armAng of arms) {
          const ac = Math.cos(armAng), as = Math.sin(armAng);
          const steps = Math.ceil(cls.armLen / 4);
          ctx.fillStyle = '#2764c4';
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const px = cls.x + ac * cls.armLen * t;
            const py = cls.y + as * cls.armLen * t;
            ctx.globalAlpha = 0.55 + 0.35 * (1 - t);
            ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
          }
          for (let ti = 1; ti <= 8; ti++) {
            const td = ti * 3;
            const tx = cls.x + ac * td + (Math.random() - 0.5) * 4;
            const ty = cls.y + as * td + (Math.random() - 0.5) * 4;
            ctx.fillStyle = '#f05a8a';
            ctx.globalAlpha = (1 - ti / 9) * 0.75;
            ctx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 2, 2);
          }
        }
        if (cls.hitFlash > 0) {
          cls.hitFlash--;
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = (1 - cls.hitFlash / 8) * 0.9;
          ctx.fillRect(Math.round(cls.hitX) - 2, Math.round(cls.hitY) - 2, 4, 4);
        }
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

        // DM blob: invisible (spec #29 — "the unseen mass bends your shot before the visible
        // gas blob arrives" is the whole lesson). Its only direct trace is a rare 1px shimmer;
        // what betrays it is the ball-side indigo trail/aura feedback in the physics section.
        if (g.frame % 60 < 3) {
          ctx.fillStyle = '#9ab0ff';
          ctx.globalAlpha = 0.5;
          ctx.fillRect(Math.round(dmX), Math.round(bc.warnY), 1, 1);
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
          // Structured plasma wall: a bright rippling leading edge, then a body whose
          // scatter density falls off behind the front (dense shock, thin wake).
          ctx.fillStyle = '#ffe680';
          for (let bx = 0; bx < W; bx += 3) {
            const ripple = Math.sin(bx * 0.12 + g.frame * 0.4) * 2.5;
            ctx.globalAlpha = 0.7 + Math.abs(Math.sin(bx * 0.05 + g.frame * 0.3)) * 0.3;
            ctx.fillRect(bx, Math.round(g.cmeY + ripple), 2, 2);
          }
          for (let i = 0; i < 70; i++) {
            const bx = Math.random() * W;
            const depth = Math.random() * Math.random(); // biased toward 0 = just behind the front
            const by = g.cmeY - 4 - depth * BAND;
            ctx.fillStyle = Math.random() < 0.5 ? '#ff8a1a' : '#d83a10';
            ctx.globalAlpha = (1 - depth) * 0.55 + 0.15;
            const sz = depth < 0.3 ? 2 : 1;
            ctx.fillRect(Math.round(bx), Math.round(by), sz, sz);
          }
          ctx.globalAlpha = 1;
          if (g.cmeY > H) { g.cmeY = -1; g.cmeTimer = g.cmePeriod; }
        }
      }

      // ── Reionization front: slow purple UV ionization sweep (update + draw) ─
      if (g.reionActive) {
        if (g.reionY < 0) {
          g.reionTimer--;
          if (g.reionTimer <= REION_WARN && g.reionTimer > 0) {
            const wt = 1 - g.reionTimer / REION_WARN;
            ctx.fillStyle = '#7b5cff';
            ctx.globalAlpha = 0.5 * wt;
            ctx.fillRect(0, launcherY + 28, W, 3);
            ctx.globalAlpha = 1;
          }
          if (g.reionTimer <= 0) g.reionY = launcherY + 34;
        } else {
          g.reionY += REION_SWEEP_SPD;
          // Leading purple front dots scrolling left→right
          ctx.fillStyle = '#7b5cff';
          const phase = g.frame * 0.8;
          for (let bx = ((phase % 8) - 8); bx < W; bx += 8) {
            ctx.globalAlpha = 0.75 + 0.2 * Math.sin(bx * 0.08 + g.frame * 0.05);
            ctx.fillRect(Math.round(bx), Math.round(g.reionY) - 1, 2, 2);
          }
          // Quiet neutral-gas wake behind the front
          ctx.fillStyle = '#c8c0b8';
          for (let row = 1; row <= 3; row++) {
            ctx.globalAlpha = 0.12 / row;
            for (let bx = 0; bx < W; bx += 10 + row) {
              ctx.fillRect(bx, Math.round(g.reionY - row * 5), 1, 1);
            }
          }
          ctx.globalAlpha = 1;
          if (g.reionY > H) { g.reionY = -1; g.reionTimer = g.reionPeriod; }
        }
      }

      // ── Pulsars: rotating twin radiation beams (update + draw) ────────────
      for (const pu of g.pulsars) {
        pu.angle += pu.rotSpeed;
        const pux = Math.cos(pu.angle), puy = Math.sin(pu.angle);
        const pPulse = 0.55 + Math.abs(Math.sin(g.frame * 0.22)) * 0.45; // fast pulsar blink
        // twin beams: dotted, fading with distance, slight sinuous wobble.
        // A perpendicular scatter column widens the visual to match the physics band.
        const puExt = exoticT(g.level, 24);
        if ((pu.beams ?? 2) === 3) {
          // Tri-beam variant: three one-way arms at 120°, same dot grammar as the twin.
          for (let b = 0; b < 3; b++) {
            const ba  = pu.angle + b * (Math.PI * 2 / 3);
            const bux = Math.cos(ba), buy = Math.sin(ba);
            for (let d = 10; d < pu.beamLen; d += 5) {
              if (exoticSkip(Math.round(d / 5), b + 2, puExt)) continue;
              const fade = 1 - d / pu.beamLen;
              const wob  = Math.sin(g.frame * 0.15 + d * 0.3) * 2;
              const bxp  = pu.x + bux * d - buy * wob;
              const byp  = pu.y + buy * d + bux * wob;
              ctx.fillStyle = d < 40 ? '#b8ecff' : '#28b8e8';
              ctx.globalAlpha = fade * pPulse * 0.8;
              ctx.fillRect(Math.round(bxp) - 1, Math.round(byp) - 1, 2, 2);
              const fr3 = (d % 10 < 5 ? 1 : -1) * (PULSAR_BEAM_HALF - 2);
              ctx.globalAlpha = fade * pPulse * 0.35;
              ctx.fillRect(Math.round(bxp - buy * fr3), Math.round(byp + bux * fr3), 1, 1);
            }
          }
        } else for (let side = -1; side <= 1; side += 2) {
          for (let d = 10; d < pu.beamLen; d += 5) {
            if (exoticSkip(Math.round(d / 5), side + 3, puExt)) continue;
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
          if (exoticSkip(i, 7, puExt)) continue;
          const a = (i / 16) * Math.PI * 2 - pu.angle * 2 + exoticJitter(g.frame, i, puExt);
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
        // Ecosystem: when the sweeping beam grazes a wormhole, its aura shivers (draw-only).
        for (const whm of g.wormholes) {
          if (whm.cycleTimer >= WORMHOLE_ACTIVE) continue;
          const wdx = whm.cx - pu.x, wdy = whm.cy - pu.y;
          if (Math.abs(wdx * pux + wdy * puy) > pu.beamLen) continue;
          if (Math.abs(wdx * puy - wdy * pux) > 30) continue;
          ctx.fillStyle = '#dd88ff';
          for (let i = 0; i < 6; i++) {
            const a = Math.random() * Math.PI * 2;
            const rr = 10 + Math.random() * 16;
            ctx.globalAlpha = 0.5;
            ctx.fillRect(Math.round(whm.cx + Math.cos(a) * rr) - 1, Math.round(whm.cy + Math.sin(a) * rr) - 1, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
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
        // epicenter: the merging binary, enlarged so the wave's source is findable —
        // a faint orbit circle plus two fat orbiting bodies.
        const oa = g.frame * 0.11;
        ctx.fillStyle = '#8a94b8';
        for (let i = 0; i < 10; i++) {
          const a2 = (i / 10) * Math.PI * 2;
          ctx.globalAlpha = 0.3;
          ctx.fillRect(Math.round(gw.ex + Math.cos(a2) * 8), Math.round(gw.ey + Math.sin(a2) * 8), 1, 1);
        }
        ctx.fillStyle = '#3a4a80';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(Math.round(gw.ex + Math.cos(oa) * 5) - 2, Math.round(gw.ey + Math.sin(oa) * 5) - 2, 4, 4);
        ctx.fillRect(Math.round(gw.ex - Math.cos(oa) * 5) - 2, Math.round(gw.ey - Math.sin(oa) * 5) - 2, 4, 4);
        ctx.globalAlpha = 1;
        if (gw.radius >= 0) {
          // wavefront ring + one trailing echo (dot count capped for perf)
          for (let ring = 0; ring < 3; ring++) {
            const rr = gw.radius - ring * 12;
            if (rr <= 0) continue;
            const n = Math.min(260, Math.max(28, Math.round(2 * Math.PI * rr / 7)));
            ctx.fillStyle = ring === 0 ? '#6a78b0' : ring === 1 ? '#8a94c0' : '#a8b0d0';
            for (let i = 0; i < n; i++) {
              const a  = (i / n) * Math.PI * 2;
              const rx = gw.ex + Math.cos(a) * rr;
              const ry = gw.ey + Math.sin(a) * rr;
              if (rx < -4 || rx > W + 4 || ry < -4 || ry > H + 4) continue;
              ctx.globalAlpha = (ring === 0 ? 0.8 : ring === 1 ? 0.5 : 0.3) * (0.65 + (i % 3) * 0.2);
              ctx.fillRect(Math.round(rx) - 1, Math.round(ry) - 1, 2, 2);
            }
          }
          ctx.globalAlpha = 1;
          // Ecosystem: hazards resonate for the frames the wavefront passes through them —
          // a brief silver shimmer ring at each crossed body (draw-only).
          const gwTargets: { x: number; y: number }[] = [];
          for (const t2 of g.comets) if (t2.respawnTimer <= 0) gwTargets.push(t2);
          for (const t2 of g.wormholes) if (t2.cycleTimer < WORMHOLE_ACTIVE) gwTargets.push({ x: t2.cx, y: t2.cy });
          for (const t2 of g.lenses) gwTargets.push(t2);
          for (const t2 of g.whiteHoles) gwTargets.push(t2);
          for (const t2 of g.magnetars) gwTargets.push(t2);
          for (const t2 of g.pulsars) gwTargets.push(t2);
          for (const t2 of g.ergospheres) gwTargets.push(t2);
          ctx.fillStyle = '#a8b0d0';
          for (const tg of gwTargets) {
            const tdx = tg.x - gw.ex, tdy = tg.y - gw.ey;
            const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
            if (Math.abs(tdist - gw.radius) > 14) continue;
            for (let i = 0; i < 10; i++) {
              const a = (i / 10) * Math.PI * 2 + g.frame * 0.1;
              ctx.globalAlpha = 0.55;
              ctx.fillRect(Math.round(tg.x + Math.cos(a) * 16) - 1, Math.round(tg.y + Math.sin(a) * 16) - 1, 2, 2);
            }
          }
          ctx.globalAlpha = 1;
        }
      }

      // ── Gravitational wave memory: slower silver ring + residue telegraph ──
      for (const gwm of g.gravWaveMemories) {
        if (gwm.radius < 0) {
          gwm.timer--;
          if (gwm.timer <= 0) { gwm.radius = GWM_R0; gwm.passingBalls = new WeakSet(); }
        } else {
          gwm.radius += GWM_SPEED;
          if (gwm.radius > GWM_R1) {
            gwm.radius = -1;
            gwm.timer = 120;
          }
        }
        // faint epicenter
        ctx.fillStyle = '#9aa8c0';
        ctx.globalAlpha = 0.35;
        ctx.fillRect(Math.round(gwm.ex) - 1, Math.round(gwm.ey) - 1, 2, 2);
        if (gwm.radius >= 0) {
          const fade = Math.max(0.15, 1 - (gwm.radius - GWM_R0) / (GWM_R1 - GWM_R0));
          const n = Math.min(180, Math.max(24, Math.round(2 * Math.PI * gwm.radius / 10)));
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const rx = gwm.ex + Math.cos(a) * gwm.radius;
            const ry = gwm.ey + Math.sin(a) * gwm.radius;
            if (rx < -4 || rx > W + 4 || ry < -4 || ry > H + 4) continue;
            ctx.fillStyle = '#9aa8c0';
            ctx.globalAlpha = Math.min(0.55, 0.35 * fade + (i % 3) * 0.05);
            ctx.fillRect(Math.round(rx), Math.round(ry), 1, 1);
          }
        }
        ctx.globalAlpha = 1;
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
        const whExt = exoticT(g.level, 23);
        for (let arm = 0; arm < 3; arm++) {
          for (let d = 0; d < 14; d++) {
            if (exoticSkip(arm * 14 + d, 1, whExt)) continue;
            const prog = ((g.frame * 0.8 + d * 10) % 120) / 120;       // 0→1 marching outward
            const rr   = 8 + prog * (wr - 8);
            const a    = (arm / 3) * Math.PI * 2 - g.frame * 0.02 + prog * 1.6 // counter-rot swirl
                       + exoticJitter(g.frame, arm * 14 + d, whExt);
            ctx.fillStyle   = prog < 0.35 ? '#2f8fe8' : '#6ab6f2';
            ctx.globalAlpha = (1 - prog) * 0.85;                        // fade at the outer edge
            ctx.fillRect(Math.round(wh.x + Math.cos(a) * rr) - 1, Math.round(wh.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        // bright inner ring (anti-horizon), counter-rotating
        ctx.fillStyle = '#1e78d8';
        for (let i = 0; i < 16; i++) {
          if (exoticSkip(i, 2, whExt)) continue;
          const a = (i / 16) * Math.PI * 2 - g.frame * 0.03 + exoticJitter(g.frame, i, whExt);
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
        // Drifting variant (lv63+): wander on the rogue-BH Lissajous path around the
        // spawn anchor. Physics reads mg.x/mg.y, so the flare follows automatically.
        if (mg.cx0 !== undefined && mg.cy0 !== undefined) {
          mg.x = mg.cx0 + Math.sin(g.frame * RBH_LISS_FX) * RBH_LISS_AX;
          mg.y = mg.cy0 + Math.sin(g.frame * RBH_LISS_FY) * RBH_LISS_AY;
        }
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
        const mgExt = exoticT(g.level, 31);
        ctx.fillStyle = charging ? '#ffe020' : '#e0a818';
        for (let ring = 0; ring < 3; ring++) {
          const rr = 14 + ring * 9;
          const n  = 12 + ring * 3;
          for (let i = 0; i < n; i++) {
            if (exoticSkip(i, ring + 1, mgExt)) continue;
            const a = (i / n) * Math.PI * 2 + g.frame * 0.01 * (ring % 2 === 0 ? 1 : -1)
                    + exoticJitter(g.frame, i + ring * 20, mgExt);
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
          // Idle ghost ring: brighter breathe so the ring is always findable.
          // Warm grey a full step below the cream background (#e8e0c8 sat at the same
          // luminance and dissolved into it — docs/GIMMICK_DESIGN_GUIDE.md §2).
          const ghostA = 0.28 + 0.18 * (0.5 + 0.5 * Math.sin(g.frame * 0.008));
          ctx.fillStyle = '#c8bc98';
          const hn = 36;
          for (let i = 0; i < hn; i++) {
            const a = (i / hn) * Math.PI * 2;
            ctx.globalAlpha = ghostA * (0.7 + (i % 2) * 0.3);
            const hpSz = zoneCoarse(i) ? 3 : 2; // Zone C grain
            ctx.fillRect(
              Math.round(hp.x + Math.cos(a) * HP_RING_R) - 1,
              Math.round(hp.y + Math.sin(a) * HP_RING_R) - 1,
              hpSz, hpSz,
            );
          }
          // Soft warm core — "the afterglow of a dead universe."
          ctx.fillStyle = '#fff2c0';
          ctx.globalAlpha = ghostA * 0.7;
          ctx.fillRect(Math.round(hp.x) - 2, Math.round(hp.y) - 2, 4, 4);
        }
        // Pulse shockwave: white-hot ring expanding over HP_RELEASE frames.
        if (hp.releaseTimer > 0) {
          const rt = 1 - hp.releaseTimer / HP_RELEASE;
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 48; i++) {
            const a = (i / 48) * Math.PI * 2;
            const rr = HP_RING_R + rt * (HP_RANGE - HP_RING_R);
            ctx.globalAlpha = (1 - rt) * 0.95;
            ctx.fillRect(
              Math.round(hp.x + Math.cos(a) * rr) - 1,
              Math.round(hp.y + Math.sin(a) * rr) - 1,
              3, 3,
            );
          }
          // Secondary gold flash at the center on pulse start.
          ctx.fillStyle = '#c8a000';
          ctx.globalAlpha = (1 - rt) * 0.8;
          ctx.fillRect(Math.round(hp.x) - 3, Math.round(hp.y) - 3, 6, 6);
        }
        ctx.globalAlpha = 1;
      }

      // ── Pop III.1 Flash: synchronized ionization patches (The Flash at z~20) ──
      if (g.pop31Flash) {
        const fl = g.pop31Flash;
        if (fl.releaseTimer > 0) {
          fl.releaseTimer--;
          if (fl.releaseTimer === 0) fl.recombTimer = POP31_RECOMB;
        } else if (fl.recombTimer > 0) {
          fl.recombTimer--;
        } else {
          fl.timer--;
          if (fl.timer <= 0) {
            fl.releaseTimer = POP31_RELEASE;
            fl.timer = fl.period;
            for (const p of fl.patches) spawnBurst(g, p.x, p.y, 4, 4, '#a8b0d8');
          }
        }
        const charging = fl.releaseTimer <= 0 && fl.recombTimer <= 0 && fl.timer <= POP31_WARN;
        for (const p of fl.patches) {
          // Idle / telegraph: nearly invisible sparse UV ring until charging.
          if (fl.releaseTimer <= 0 && fl.recombTimer <= 0) {
            const warnPulse = charging ? 0.45 + 0.30 * Math.abs(Math.sin(g.frame * 0.22)) : 0.05;
            ctx.fillStyle = '#a8b0d8';
            const n = 28;
            for (let i = 0; i < n; i++) {
              if (i % 3 === 0) continue;
              if (g.level >= 120 && zonePhaseTear(i + Math.round(p.x), g.frame)) continue;
              const a = (i / n) * Math.PI * 2 + g.frame * 0.004;
              ctx.globalAlpha = warnPulse * (0.4 + (i % 2) * 0.25);
              ctx.fillRect(
                Math.round(p.x + Math.cos(a) * p.r) - 1,
                Math.round(p.y + Math.sin(a) * p.r) - 1,
                2, 2,
              );
            }
          }
          // Flash: cooler expanding UV ring; fewer fill dots.
          if (fl.releaseTimer > 0) {
            const rt = 1 - fl.releaseTimer / POP31_RELEASE;
            ctx.fillStyle = '#a8b0d8';
            for (let i = 0; i < 28; i++) {
              const a = (i / 28) * Math.PI * 2;
              const rr = rt * p.r;
              ctx.globalAlpha = (1 - rt) * 0.70;
              ctx.fillRect(
                Math.round(p.x + Math.cos(a) * rr) - 1,
                Math.round(p.y + Math.sin(a) * rr) - 1,
                2, 2,
              );
            }
            // Soft fill of ionization dots inside the expanding front (cooler, fewer).
            ctx.fillStyle = '#c0c8e0';
            for (let i = 0; i < 5; i++) {
              const a = (i / 5) * Math.PI * 2 + g.frame * 0.3;
              const rr = rt * p.r * 0.55;
              ctx.globalAlpha = (1 - rt) * 0.32;
              ctx.fillRect(Math.round(p.x + Math.cos(a) * rr) - 1, Math.round(p.y + Math.sin(a) * rr) - 1, 2, 2);
            }
          }
          // Recombination: rust-grey mottled patch (main alien tell — slightly boosted).
          if (fl.recombTimer > 0) {
            const rt = fl.recombTimer / POP31_RECOMB;
            ctx.fillStyle = '#6a6878';
            for (let i = 0; i < 22; i++) {
              const a = (i / 22) * Math.PI * 2 + g.frame * 0.02;
              const rr = p.r * (0.35 + 0.55 * ((i * 7) % 10) / 10);
              ctx.globalAlpha = rt * 0.52 * (0.65 + (i % 2) * 0.35);
              ctx.fillRect(
                Math.round(p.x + Math.cos(a) * rr) - 1,
                Math.round(p.y + Math.sin(a) * rr) - 1,
                2, 2,
              );
            }
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Patchy kSZ: fixed-axis wind patches (timer advance + draw) ──
      for (const kp of g.kszPatches) {
        if (kp.releaseTimer > 0) {
          kp.releaseTimer--;
        } else {
          kp.timer--;
          if (kp.timer <= 0) {
            kp.releaseTimer = KSZ_RELEASE;
            kp.timer = kp.period;
            spawnBurst(g, kp.cx, kp.cy, 4, 4, '#68b8d0');
          }
        }
        const charging = kp.releaseTimer <= 0 && kp.timer <= KSZ_WARN;
        const ax = Math.cos(kp.axis), ay = Math.sin(kp.axis);
        // Idle / telegraph: sparse ellipse boundary blink (cold cyan).
        if (kp.releaseTimer <= 0) {
          const blink = charging
            ? 0.50 + 0.40 * Math.abs(Math.sin(g.frame * 0.20))
            : 0.10 + 0.08 * Math.abs(Math.sin(g.frame * 0.03 + kp.cx * 0.01));
          ctx.fillStyle = '#68b8d0';
          const n = 28;
          for (let i = 0; i < n; i++) {
            if (i % 3 === 0) continue;
            const a = (i / n) * Math.PI * 2;
            ctx.globalAlpha = blink * (0.55 + (i % 2) * 0.35);
            ctx.fillRect(
              Math.round(kp.cx + Math.cos(a) * kp.rx) - 1,
              Math.round(kp.cy + Math.sin(a) * kp.ry) - 1,
              2, 2,
            );
          }
        }
        // Firing: short arrow/streak dots along the kick axis inside the patch.
        if (kp.releaseTimer > 0) {
          const rt = 1 - kp.releaseTimer / KSZ_RELEASE;
          ctx.fillStyle = '#68b8d0';
          for (let s = -4; s <= 4; s++) {
            const t = s / 4;
            const along = t * Math.min(kp.rx, kp.ry) * 0.85;
            const px = kp.cx + ax * along;
            const py = kp.cy + ay * along;
            ctx.globalAlpha = (1 - rt) * (0.55 + 0.35 * (1 - Math.abs(t)));
            ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
            // Tiny wing dots to read as an arrowhead near the tip.
            if (s === 3 || s === 4) {
              const pxp = -ay, pyp = ax;
              const wing = 4 + (s - 3) * 2;
              ctx.fillRect(Math.round(px + pxp * wing) - 1, Math.round(py + pyp * wing) - 1, 2, 2);
              ctx.fillRect(Math.round(px - pxp * wing) - 1, Math.round(py - pyp * wing) - 1, 2, 2);
            }
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Subsolar PBH echo merger: approach → gravity-null echo → dormant recondense ──
      if (g.subsolarPbhEcho) {
        const e = g.subsolarPbhEcho;
        if (e.phase === 0) {
          // Approach: drift components toward each other.
          const dx = e.x2 - e.x1, dy = e.y2 - e.y1;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist <= SPBH_MERGE_DIST) {
            e.phase = 1;
            e.timer = SPBH_ECHO_DUR;
            spawnBurst(g, (e.x1 + e.x2) * 0.5, (e.y1 + e.y2) * 0.5, 2, 2, '#9a9688');
          } else {
            const step = SPBH_APPROACH / dist;
            e.x1 += dx * step; e.y1 += dy * step;
            e.x2 -= dx * step; e.y2 -= dy * step;
          }
        } else if (e.phase === 1) {
          e.timer--;
          if (e.timer <= 0) {
            e.phase = 2;
            e.timer = SPBH_DORMANT;
          }
        } else {
          e.timer--;
          if (e.timer <= 0) {
            // Recondense at a new lower-board site (runtime RNG OK).
            const mx = W * (0.22 + Math.random() * 0.56);
            const my = (launcherY + 80) + Math.random() * ((H - launcherY - 120) * 0.55);
            const ang = Math.random() * Math.PI * 2;
            const hx = Math.cos(ang) * SPBH_PAIR_SEP0 * 0.5;
            const hy = Math.sin(ang) * SPBH_PAIR_SEP0 * 0.5;
            e.x1 = mx - hx; e.y1 = my - hy;
            e.x2 = mx + hx; e.y2 = my + hy;
            e.phase = 0;
            e.timer = 0;
          }
        }
        // Draw: rust dual points while approaching; pale echo ring during null; nothing when dormant.
        if (e.phase === 0) {
          const pulse = 0.35 + 0.25 * Math.abs(Math.sin(g.frame * 0.04));
          ctx.fillStyle = '#7a5048';
          for (const [px, py] of [[e.x1, e.y1], [e.x2, e.y2]] as [number, number][]) {
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2 + g.frame * 0.02;
              ctx.globalAlpha = pulse * (0.5 + (i % 2) * 0.35);
              ctx.fillRect(Math.round(px + Math.cos(a) * 5) - 1, Math.round(py + Math.sin(a) * 5) - 1, 2, 2);
            }
            ctx.globalAlpha = pulse;
            ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
          }
          // Faint bridge of approaching mass.
          ctx.fillStyle = '#7a5048';
          const mx = (e.x1 + e.x2) * 0.5, my = (e.y1 + e.y2) * 0.5;
          ctx.globalAlpha = 0.12 + 0.10 * Math.abs(Math.sin(g.frame * 0.05));
          ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 2, 2);
        } else if (e.phase === 1) {
          const mx = (e.x1 + e.x2) * 0.5, my = (e.y1 + e.y2) * 0.5;
          const life = e.timer / SPBH_ECHO_DUR;
          ctx.fillStyle = '#9a9688';
          const n = 20;
          for (let i = 0; i < n; i++) {
            if (i % 2 === 0) continue; // broken ring (Zone H grammar)
            const a = (i / n) * Math.PI * 2;
            const r = SPBH_ECHO_RANGE * (0.55 + 0.45 * (1 - life));
            ctx.globalAlpha = life * 0.45;
            ctx.fillRect(Math.round(mx + Math.cos(a) * r) - 1, Math.round(my + Math.sin(a) * r) - 1, 2, 2);
          }
          ctx.globalAlpha = life * 0.7;
          ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Quintom breathe: phase-shifted edge tells (amber heavy / purple light) ──
      if (g.quintomBreathActive) {
        const qs = Math.sin(g.frame * QUINTOM_K);
        const heavy = qs > 0;
        ctx.fillStyle = heavy ? '#c89040' : '#5a2878';
        const aEdge = 0.06 + 0.08 * Math.abs(qs);
        // Four edges with slight phase offsets — never a filled band.
        for (let i = 0; i < 18; i++) {
          const t = i / 17;
          ctx.globalAlpha = aEdge * (0.4 + 0.6 * Math.abs(Math.sin(t * Math.PI + g.frame * 0.002)));
          ctx.fillRect(Math.round(8 + t * (W - 16)), 4, 2, 2);
          ctx.fillRect(Math.round(8 + t * (W - 16)), H - 6, 2, 2);
          ctx.fillRect(4, Math.round(8 + t * (H - 16)), 2, 2);
          ctx.fillRect(W - 6, Math.round(8 + t * (H - 16)), 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Variable coupling drift: dull-gold edge ticks with phase offsets (no closed contour) ──
      if (g.varCoupActive) {
        const coupling = VARCOUP_BASE + VARCOUP_BASE * Math.sin(g.frame * VARCOUP_K);
        ctx.fillStyle = '#8a8068';
        for (let i = 0; i < 12; i++) {
          const t = i / 11;
          const phase = i * 0.7;
          ctx.globalAlpha = 0.06 + 0.07 * Math.abs(Math.sin(g.frame * VARCOUP_K + phase));
          // Top / bottom / left / right ticks — mutually phase-offset.
          ctx.fillRect(Math.round(10 + t * (W - 20)), 5, 2, 1);
          ctx.fillRect(Math.round(10 + t * (W - 20)), H - 6, 2, 1);
          ctx.fillRect(5, Math.round(10 + t * (H - 20)), 1, 2);
          ctx.fillRect(W - 6, Math.round(10 + t * (H - 20)), 1, 2);
        }
        if (Math.abs(coupling) > 0.05) {
          ctx.globalAlpha = 0.10;
          ctx.fillRect(8, 8, 2, 2);
          ctx.fillRect(W - 10, 8, 2, 2);
          ctx.fillRect(8, H - 10, 2, 2);
          ctx.fillRect(W - 10, H - 10, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Black Hole Star cocoon: timer + dense core / copper shell / tear gap ──
      for (const bh of g.bhStarCocoons) {
        if (bh.tearTimer > 0) {
          bh.tearTimer--;
        } else {
          bh.timer--;
          if (bh.timer <= 0) {
            bh.tearTimer = BHS_TEAR_DUR;
            bh.timer = BHS_PERIOD;
            spawnBurst(g, bh.x, bh.y, 3, 3, '#c87060');
          }
        }
        const breathe = 1 + Math.sin(g.frame * 0.004) * 0.04;
        // Core
        ctx.fillStyle = '#7a3030';
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + g.frame * 0.01;
          const r = BHS_CORE_R * (0.35 + (i % 3) * 0.2) * breathe;
          ctx.globalAlpha = 0.55 + (i % 2) * 0.25;
          ctx.fillRect(Math.round(bh.x + Math.cos(a) * r) - 1, Math.round(bh.y + Math.sin(a) * r) - 1, 2, 2);
        }
        // Shell with optional tear gap
        ctx.fillStyle = bh.tearTimer > 0 ? '#c87060' : '#a86840';
        const n = 28;
        const gap = Math.PI * 0.45;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          let da = ((a - bh.tearAng) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          if (da > Math.PI) da = Math.PI * 2 - da;
          if (bh.tearTimer > 0 && da < gap * 0.5) continue;
          const rr = ((BHS_SHELL_IN + BHS_SHELL_OUT) * 0.5) * breathe;
          ctx.globalAlpha = bh.tearTimer > 0 ? 0.55 : 0.28 + 0.12 * Math.abs(Math.sin(a * 2 + g.frame * 0.01));
          ctx.fillRect(Math.round(bh.x + Math.cos(a) * rr) - 1, Math.round(bh.y + Math.sin(a) * rr) - 1, 2, 2);
        }
        if (bh.tearTimer > 0) {
          const life = bh.tearTimer / BHS_TEAR_DUR;
          ctx.fillStyle = '#c87060';
          for (let s = 1; s <= 5; s++) {
            const r = BHS_SHELL_OUT + s * 6 * (1 - life);
            ctx.globalAlpha = life * 0.45;
            ctx.fillRect(Math.round(bh.x + Math.cos(bh.tearAng) * r) - 1, Math.round(bh.y + Math.sin(bh.tearAng) * r) - 1, 2, 2);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── S8 bifurcation seam: rust-cyan broken stitches, denser on heavy side ──
      for (const seam of g.s8Seams) {
        const tc = Math.cos(seam.angle), ts = Math.sin(seam.angle);
        const nx = Math.cos(seam.angle + Math.PI * 0.5);
        const ny = Math.sin(seam.angle + Math.PI * 0.5);
        const halfLen = Math.max(W, H) * 0.7;
        for (let i = -26; i <= 26; i++) {
          if ((i + ((g.frame * 0.0015) | 0)) % 3 === 0) continue;
          const sl = (i / 26) * halfLen;
          const px = seam.cx + tc * sl;
          const py = seam.cy + ts * sl;
          if (px < 4 || px > W - 4 || py < 4 || py > H - 4) continue;
          ctx.fillStyle = '#5a6870';
          ctx.globalAlpha = 0.10 + 0.06 * Math.abs(Math.sin(i * 0.4 + g.frame * 0.0015));
          ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
        }
        for (let k = 0; k < 16; k++) {
          const seed = k * 991 + ((g.frame / 50) | 0) * 11;
          const u = ((Math.imul(seed ^ (seed >>> 11), 1597334677) >>> 0) / 0x100000000);
          const v = ((Math.imul((seed + 19) ^ ((seed + 19) >>> 9), 3812015801) >>> 0) / 0x100000000);
          const along = (u - 0.5) * halfLen;
          const across = (v < 0.55 ? 1 : -1) * (10 + (k % 4) * 8);
          const px = seam.cx + tc * along + nx * across;
          const py = seam.cy + ts * along + ny * across;
          if (px < 6 || px > W - 6 || py < 6 || py > H - 6) continue;
          const heavy = across > 0;
          if (!heavy && k % 3 !== 0) continue;
          ctx.globalAlpha = heavy ? 0.09 : 0.06;
          ctx.fillStyle = heavy ? '#5a6870' : '#889098';
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Dual-H0 seam: dotted divider + asymmetric side dust density ──
      if (g.dualH0Seam) {
        const seam = g.dualH0Seam;
        const tc = Math.cos(seam.angle), ts = Math.sin(seam.angle);
        const nx = Math.cos(seam.angle + Math.PI * 0.5);
        const ny = Math.sin(seam.angle + Math.PI * 0.5);
        const halfLen = Math.max(W, H) * 0.75;
        // Seam stitches
        for (let i = -28; i <= 28; i++) {
          if ((i + g.frame) % 3 === 0) continue; // broken stitches
          const sl = (i / 28) * halfLen;
          const px = seam.cx + tc * sl;
          const py = seam.cy + ts * sl;
          if (px < 4 || px > W - 4 || py < 4 || py > H - 4) continue;
          const phase = 0.5 + 0.5 * Math.sin(i * 0.35 + g.frame * 0.004);
          ctx.globalAlpha = 0.18 + phase * 0.16;
          ctx.fillStyle = i % 2 === 0 ? '#8a6870' : '#687888';
          ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
        }
        // Sparse density tells: heavy side denser dusty dots, light side sparser
        for (let k = 0; k < 18; k++) {
          const seed = k * 977 + ((g.frame / 40) | 0) * 13;
          const u = ((Math.imul(seed ^ (seed >>> 11), 1597334677) >>> 0) / 0x100000000);
          const v = ((Math.imul((seed + 17) ^ ((seed + 17) >>> 9), 3812015801) >>> 0) / 0x100000000);
          const along = (u - 0.5) * halfLen * 1.2;
          const across = (v < 0.55 ? 1 : -1) * (12 + (k % 5) * 9);
          const px = seam.cx + tc * along + nx * across;
          const py = seam.cy + ts * along + ny * across;
          if (px < 6 || px > W - 6 || py < 6 || py > H - 6) continue;
          const heavy = across > 0;
          if (!heavy && k % 3 !== 0) continue; // lighter side much sparser
          ctx.globalAlpha = heavy ? 0.10 : 0.07;
          ctx.fillStyle = heavy ? '#8a6870' : '#687888';
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Runaway SMBH bow shock: tip motion + V-arc + cooling wake (update + draw) ──
      for (const rb of g.runawaySMBHs) {
        if (rb.respawnTimer > 0) {
          rb.respawnTimer--;
          if (rb.respawnTimer === 0) {
            // Re-enter from a random edge, aiming roughly diagonally across the board.
            const edge = Math.floor(Math.random() * 3);
            let sx: number, sy: number, ax: number, ay: number;
            if (edge === 0) {
              sx = -40;
              sy = (launcherY + 60) + Math.random() * ((H - launcherY) * 0.55);
              ax = W * (0.55 + Math.random() * 0.35);
              ay = (launcherY + 60) + Math.random() * ((H - launcherY) * 0.55);
            } else if (edge === 1) {
              sx = W + 40;
              sy = (launcherY + 60) + Math.random() * ((H - launcherY) * 0.55);
              ax = W * (0.10 + Math.random() * 0.35);
              ay = (launcherY + 60) + Math.random() * ((H - launcherY) * 0.55);
            } else {
              sx = W * (0.20 + Math.random() * 0.60);
              sy = launcherY - 20;
              ax = W * (0.15 + Math.random() * 0.70);
              ay = H * (0.55 + Math.random() * 0.30);
            }
            let hx = ax - sx, hy = ay - sy;
            let hlen = Math.sqrt(hx * hx + hy * hy) || 1;
            hx /= hlen; hy /= hlen;
            if (Math.abs(hx) < 0.35) hx = (hx >= 0 ? 1 : -1) * 0.55;
            if (Math.abs(hy) < 0.35) hy = (hy >= 0 ? 1 : -1) * 0.55;
            hlen = Math.sqrt(hx * hx + hy * hy);
            hx /= hlen; hy /= hlen;
            rb.x = sx; rb.y = sy;
            rb.vx = hx * RBHS_SPEED;
            rb.vy = hy * RBHS_SPEED;
            rb.spawnX = sx; rb.spawnY = sy;
          }
          continue;
        }
        rb.x += rb.vx;
        rb.y += rb.vy;
        if (rb.x < -80 || rb.x > W + 80 || rb.y < -80 || rb.y > H + 80) {
          rb.respawnTimer = 90;
          rb.x = -200; rb.y = -200;
          continue;
        }
        const rspd = Math.sqrt(rb.vx * rb.vx + rb.vy * rb.vy) || 1;
        const rhx = rb.vx / rspd, rhy = rb.vy / rspd;
        const rpx = -rhy, rpy = rhx;
        // Sparse star-formation wake fading toward the root (farther back = lower alpha).
        for (let ti = 2; ti <= 28; ti += 2) {
          const td = (ti / 28) * RBHS_WAKE_LEN;
          const spread = (Math.random() - 0.5) * RBHS_WAKE_HALF * 1.6;
          const wx = rb.x - rhx * td + rpx * spread;
          const wy = rb.y - rhy * td + rpy * spread;
          ctx.fillStyle = ti < 10 ? '#3ab0a0' : ti < 20 ? '#2a9a8a' : '#1a7068';
          ctx.globalAlpha = (1 - ti / 30) * 0.55;
          ctx.fillRect(Math.round(wx), Math.round(wy), 1, 1);
        }
        // Sharp 2px V bow-shock arc ahead of the tip.
        ctx.fillStyle = '#2a9a8a';
        for (let i = -8; i <= 8; i++) {
          const t = Math.abs(i) / 8;
          const along = 6 + t * (RBHS_BOW_LEN * 0.85);
          const across = (i / 8) * RBHS_BOW_HALF * (1 - along / RBHS_BOW_LEN);
          ctx.globalAlpha = 0.75 * (1 - t * 0.35);
          ctx.fillRect(
            Math.round(rb.x + rhx * along + rpx * across) - 1,
            Math.round(rb.y + rhy * along + rpy * across) - 1,
            2, 2,
          );
        }
        // Teal tip core (no white accents).
        drawSolidCircle(ctx, rb.x, rb.y, RBHS_TIP_R * 0.55, '#2a9a8a');
        ctx.fillStyle = '#1a7068';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(Math.round(rb.x) - 2, Math.round(rb.y) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── Phantom Crossing Membrane: amber/purple alternating seam (swap on flash) ──
      for (const pm of g.phantomMembranes) {
        if (pm.flashTimer > 0) pm.flashTimer--;
        const pc = Math.cos(pm.angle), ps = Math.sin(pm.angle);
        const swap = pm.flashTimer > 0;
        const colA = swap ? '#5a2878' : '#c89040';
        const colB = swap ? '#c89040' : '#5a2878';
        const spacing = 9; // thinner in-band body (wider spacing)
        const nDots = Math.floor(pm.len / spacing);
        const seamOff = 2.0;
        // Stronger color swap during flash; quieter idle seam (ball FX carries the tell).
        const alpha = swap
          ? 0.70 + 0.20 * Math.sin(g.frame * 0.25)
          : 0.28 + 0.10 * Math.sin(g.frame * 0.004);
        for (let i = 0; i < nDots; i++) {
          const slx = -pm.len * 0.5 + i * spacing;
          const side = i % 2 === 0 ? 1 : -1;
          const sly = side * seamOff;
          const px = pm.cx + pc * slx - ps * sly;
          const py = pm.cy + ps * slx + pc * sly;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = side > 0 ? colA : colB;
          ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Quantum Foam: Planck-scale jitter region (pair-creation dots + fuzzy boundary) ──
      for (const qf of g.quantumFoams) {
        // Pair-creation / annihilation: quiet ink/slate pairs; white only as 1px accents.
        const pairCount = 3 + (g.frame % 2);
        for (let p = 0; p < pairCount; p++) {
          const seed = ((g.frame / 2) | 0) * 374761393 + p * 668265263;
          const u1 = ((Math.imul(seed ^ (seed >>> 13), 1274126177) >>> 0) / 0x100000000);
          const u2 = ((Math.imul((seed + 1) ^ ((seed + 1) >>> 13), 1274126177) >>> 0) / 0x100000000);
          const pr = Math.sqrt(u1) * QF_RANGE * 0.9;
          const pa = u2 * Math.PI * 2;
          const px = qf.x + Math.cos(pa) * pr;
          const py = qf.y + Math.sin(pa) * pr;
          const life = g.frame % 4;
          const a = 0.55 - life * 0.12;
          ctx.globalAlpha = a;
          ctx.fillStyle = '#0f0f0d';
          ctx.fillRect(zoneSnap(px), zoneSnap(py), 1, 1);
          ctx.fillStyle = '#6a6878';
          ctx.fillRect(zoneSnap(px + 3), zoneSnap(py), 1, 1);
          // Occasional 1px white accent (pair flash) — never the body.
          if (life === 0 && p % 2 === 0) {
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.35;
            ctx.fillRect(zoneSnap(px + 1), zoneSnap(py - 1), 1, 1);
          }
        }
        // Fuzzy boundary: zoneSnap + jitter; quieter slate dashes.
        const bn = 48;
        for (let i = 0; i < bn; i++) {
          if (i % 3 === 0) continue;
          const a = (i / bn) * Math.PI * 2 + Math.sin(g.frame * 0.11 + i * 1.7) * 0.08;
          const wob = Math.sin(g.frame * 0.37 + i * 1.9) * 5;
          const rr = QF_RANGE + wob;
          ctx.fillStyle = i % 2 === 0 ? '#6a6878' : '#0f0f0d';
          ctx.globalAlpha = 0.32 + 0.18 * Math.sin(g.frame * 0.14 + i);
          ctx.fillRect(
            zoneSnap(qf.x + Math.cos(a) * rr) - 1,
            zoneSnap(qf.y + Math.sin(a) * rr) - 1,
            2, 2,
          );
        }
        ctx.globalAlpha = 1;
      }

      // ── Neutrino flavor oscillation: three offset slate halos (no boundary) ──
      for (const nu of g.neutrinoOscillations) {
        const nuExt = exoticT(g.level, 78);
        const cols = ['#a8b8c8', '#98a8b8', '#8898a8'];
        const offs = [0, 8, 16];
        for (let h = 0; h < 3; h++) {
          const phase = g.frame * 0.006 + h * (Math.PI * 2 / 3);
          const breath = Math.sin(phase) * 4;
          const ox = Math.cos(nu.axis + h * 2.1) * (offs[h] + breath * 0.25);
          const oy = Math.sin(nu.axis + h * 2.1) * (offs[h] + breath * 0.25);
          ctx.fillStyle = cols[h];
          const nDots = 14;
          // Incomplete rings: fixed ~15% gap + exoticSkip dropout.
          const gapC = g.frame * 0.0011 + h * 0.7;
          for (let i = 0; i < nDots; i++) {
            if (exoticSkip(i, h + 3, nuExt)) continue;
            const a = (i / nDots) * Math.PI * 2 + phase * 0.3 + exoticJitter(g.frame, i + h * 20, nuExt);
            let gd = ((a - gapC) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
            if (gd > Math.PI) gd = Math.PI * 2 - gd;
            if (gd < Math.PI * 0.15) continue;
            const rr = 0.55 + 0.35 * ((i * 7) % 5) / 5;
            const px = nu.x + ox + Math.cos(a) * (nu.rx * rr);
            const py = nu.y + oy + Math.sin(a) * (nu.ry * rr);
            ctx.globalAlpha = 0.16 + 0.08 * Math.sin(phase + i);
            ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Fuzzy dark matter soliton: mint concentric rings + interference edge ─
      for (const fdm of g.fuzzySolitons) {
        const fdmExt = exoticT(g.level, 104);
        const rings = [28, 56, 84];
        for (let ri = 0; ri < rings.length; ri++) {
          const breath = Math.sin(g.frame * 0.005 + ri * 2.1) * 3;
          const rr = rings[ri] + breath;
          const nDots = 16 + ri * 4;
          const gapC = g.frame * 0.0010 + ri * 1.1;
          for (let i = 0; i < nDots; i++) {
            if (exoticSkip(i, ri + 5, fdmExt)) continue;
            const a = (i / nDots) * Math.PI * 2 + exoticJitter(g.frame, i + ri * 30, fdmExt);
            // Don't fully close rings — ~15% precessing gap.
            let gd = ((a - gapC) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
            if (gd > Math.PI) gd = Math.PI * 2 - gd;
            if (gd < Math.PI * 0.15) continue;
            const px = fdm.x + Math.cos(a) * rr;
            const py = fdm.y + Math.sin(a) * rr;
            const rNorm = rr / Math.max(fdm.rx, fdm.ry);
            const isRim = rNorm >= 0.45 && rNorm <= 0.55;
            let alpha = isRim
              ? 0.28 + 0.38 * Math.abs(Math.sin(g.frame * 0.11 + i * 2.1))
              : 0.14 + 0.08 * Math.sin(g.frame * 0.005 + i);
            ctx.fillStyle = '#5eb89a';
            ctx.globalAlpha = Math.min(isRim ? 0.55 : 0.28, alpha);
            ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Axion microlens cluster: Tier-4 phantom shimmer + child speck ───────
      for (const ax of g.axionMicrolenses) {
        const cycle = (g.frame + ax.phase) % AXION_SHIMMER_PERIOD;
        // 1f blackout 30f before shimmer (magnetar telegraph)
        if (cycle === AXION_SHIMMER_PERIOD - 30) {
          ctx.globalAlpha = 1;
          continue;
        }
        if (cycle < AXION_SHIMMER_DUR) {
          const rot = (cycle / AXION_SHIMMER_DUR) * (Math.PI / 2);
          ctx.fillStyle = '#5868c0';
          ctx.globalAlpha = 0.85;
          ctx.fillRect(Math.round(ax.x), Math.round(ax.y), 1, 1);
          ctx.globalAlpha = 0.55;
          ctx.fillRect(
            Math.round(ax.x + Math.cos(rot) * 6),
            Math.round(ax.y + Math.sin(rot) * 6),
            1, 1,
          );
        }
        ctx.globalAlpha = 1;
      }

      // ── Black Hole Firewall: burning arc barrier (slate⇄cold-orange flicker + bit stream) ──
      for (const fw of g.firewalls) {
        if (fw.hitCool  > 0) fw.hitCool--;
        if (fw.hitFlash > 0) fw.hitFlash--;
        const fwExt = exoticT(g.level, 83);
        const fwDots = 28;
        for (let i = 0; i < fwDots; i++) {
          // Asymmetric / gappy arc via exoticSkip (still clearly readable at unlock).
          if (exoticSkip(i, 11, Math.max(0.35, fwExt))) continue;
          const a = fw.angle0 + (i / (fwDots - 1)) * FW_SPAN + exoticJitter(g.frame, i, fwExt) * 0.4;
          // Fast cold-orange⇄slate flicker (Tier 1 readable, no white primary).
          const flick = Math.sin(g.frame * 0.33 + i * 1.7) > 0;
          ctx.fillStyle = fw.hitFlash > 0 ? '#c87840' : (flick ? '#c87840' : '#8a7060');
          ctx.globalAlpha = fw.hitFlash > 0 ? 0.95 : 0.72 + (i % 2) * 0.18;
          const px = fw.x + Math.cos(a) * FW_R;
          const py = fw.y + Math.sin(a) * FW_R;
          // Zone D signature: coordinates snap to the Planck grid.
          ctx.fillRect(zoneSnap(px) - 1, zoneSnap(py) - 1, 2, 2);
        }
        // 0/1-style bit stream flowing along the arc (spd 2).
        for (let b = 0; b < 8; b++) {
          const bt = ((g.frame * 2 + b * 11) % (FW_SPAN * FW_R)) / FW_R;
          const ba = fw.angle0 + bt;
          if (bt > FW_SPAN) continue;
          if (exoticSkip(b, 13, Math.max(0.2, fwExt))) continue;
          ctx.fillStyle = (b + g.frame) % 2 === 0 ? '#c87840' : '#8a7060';
          ctx.globalAlpha = 0.85;
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
        const rpExt = exoticT(g.level, 32);
        ctx.fillStyle = '#8890a0';
        for (let i = 0; i < 22; i++) {
          if (exoticSkip(i, 1, rpExt)) continue;
          const a  = (i / 22) * Math.PI * 2 + g.frame * 0.004 + exoticJitter(g.frame, i, rpExt);
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

      // ── Dark matter halos: faint always-on ghost + periodic indigo ring reveal ──
      for (const dh of g.darkHalos) {
        dh.shimmer--;
        if (dh.shimmer <= 0) dh.shimmer = 55 + Math.floor(Math.random() * 40); // next reveal 55-95f
        // Always-on ghost ring + faint filament stubs (COSMOS-Web-inspired mass island).
        {
          const ageA = 1 + hazardAgeBoost(g.level, 48, 0.5);
          const rr = DM_RANGE * 0.5;
          ctx.fillStyle = '#8a96d8';
          for (let i = 0; i < 36; i++) {
            const ang = (i / 36) * Math.PI * 2 + g.frame * 0.008;
            ctx.globalAlpha = (0.18 + (i % 2) * 0.08) * Math.min(1.15, ageA);
            ctx.fillRect(Math.round(dh.x + Math.cos(ang) * rr) - 1, Math.round(dh.y + Math.sin(ang) * rr) - 1, 2, 2);
          }
          // Sparse radial filaments hinting at the cosmic web attachment.
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2 + g.frame * 0.003;
            for (let s = 1; s <= 5; s++) {
              const pr = rr * (0.55 + s * 0.12);
              ctx.globalAlpha = 0.12 * (1 - s / 6);
              ctx.fillRect(Math.round(dh.x + Math.cos(ang) * pr), Math.round(dh.y + Math.sin(ang) * pr), 1, 1);
            }
          }
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = '#b0b8e8';
          ctx.fillRect(Math.round(dh.x) - 1, Math.round(dh.y) - 1, 2, 2);
          ctx.globalAlpha = 1;
        }
        // Longer, brighter reveal so the invisible well is fair and readable.
        if (dh.shimmer < 65) {
          const a  = Math.sin(Math.PI * (65 - dh.shimmer) / 65) * 0.82;
          const rr = DM_RANGE * 0.55;
          ctx.fillStyle = '#8a96d8';
          for (let i = 0; i < 56; i++) {
            const ang = (i / 56) * Math.PI * 2 + g.frame * 0.01;
            ctx.globalAlpha = a * (0.55 + (i % 2) * 0.45);
            ctx.fillRect(Math.round(dh.x + Math.cos(ang) * rr) - 1, Math.round(dh.y + Math.sin(ang) * rr) - 1, 2, 2);
          }
          // Inhaling dust spokes — makes the pull direction obvious during the reveal.
          ctx.fillStyle = '#b0b8e8';
          for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2 + g.frame * 0.04;
            const t = ((g.frame * 0.08 + i * 0.3) % 1);
            const pr = rr * (0.25 + t * 0.7);
            ctx.globalAlpha = a * (1 - t) * 0.9;
            ctx.fillRect(Math.round(dh.x + Math.cos(ang) * pr) - 1, Math.round(dh.y + Math.sin(ang) * pr) - 1, 2, 2);
          }
          ctx.globalAlpha = a;
          ctx.fillStyle = '#d0d8ff';
          ctx.fillRect(Math.round(dh.x) - 2, Math.round(dh.y) - 2, 4, 4);
          ctx.globalAlpha = 1;
        }
      }

      // ── Primordial black holes: constellation twinkle — brief ring + core flash ──
      for (const pbh of g.primordialBHs) {
        const pbhCyclePos = (g.frame + pbh.phase) % PBH_SHIMMER_PERIOD;
        // Always-on 1px ghost so the constellation is faintly readable between twinkles.
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#8080c8';
        ctx.fillRect(Math.round(pbh.x), Math.round(pbh.y), 1, 1);
        ctx.globalAlpha = 1;
        if (pbhCyclePos < 16) {
          const t = pbhCyclePos / 16;
          const a = Math.sin(t * Math.PI);
          ctx.fillStyle = '#a0a0f0';
          // Expanding micro-ring so the point is impossible to miss when it twinkles.
          const rr = 3 + t * 12;
          for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2;
            ctx.globalAlpha = a * 0.9;
            ctx.fillRect(Math.round(pbh.x + Math.cos(ang) * rr) - 1, Math.round(pbh.y + Math.sin(ang) * rr) - 1, 2, 2);
          }
          ctx.globalAlpha = a;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(pbh.x) - 1, Math.round(pbh.y) - 1, 3, 3);
          ctx.globalAlpha = 1;
        }
      }

      // ── Einstein cross: amber hub + 4 images linked by pale spokes ────────
      for (const ec of g.einsteinCrosses) {
        const breath = 1 + 0.05 * Math.sin(g.frame * 0.004);
        // spokes
        ctx.fillStyle = '#e8d080';
        for (const im of ec.images) {
          const dx = im.x - ec.cx, dy = im.y - ec.cy;
          const len = Math.hypot(dx, dy) || 1;
          for (let t = 0.15; t < 0.9; t += 0.12) {
            ctx.globalAlpha = 0.35;
            ctx.fillRect(Math.round(ec.cx + dx * t), Math.round(ec.cy + dy * t), 1, 1);
          }
        }
        // hub
        ctx.fillStyle = '#6a5830';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(Math.round(ec.cx) - 1, Math.round(ec.cy) - 1, 3, 3);
        // images
        let nearest = -1, bestD = Infinity;
        for (let i = 0; i < ec.images.length; i++) {
          for (const ball of g.balls) {
            const d = Math.hypot(ball.x - ec.images[i].x, ball.y - ec.images[i].y);
            if (d < bestD) { bestD = d; nearest = i; }
          }
        }
        for (let i = 0; i < ec.images.length; i++) {
          const im = ec.images[i];
          const ang = Math.atan2(im.y - ec.cy, im.x - ec.cx);
          const rr = ECROSS_R * breath;
          const ix = ec.cx + Math.cos(ang) * rr;
          const iy = ec.cy + Math.sin(ang) * rr;
          const blink = nearest === i && bestD < 120 ? (0.55 + 0.45 * Math.sin(g.frame * 0.12)) : 0.85;
          ctx.fillStyle = '#c8a030';
          ctx.globalAlpha = blink;
          ctx.fillRect(Math.round(ix) - 1, Math.round(iy) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
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
          ctx.globalAlpha = 0.22 + 0.13 * (1 - rr / dsR);
          // Zone C grain: some dots print fat, like old ink on fibrous paper.
          const dsSz = zoneCoarse(i) ? 3 : 1;
          ctx.fillRect(Math.round(ds.x + Math.cos(a) * rr) - 1, Math.round(ds.y + Math.sin(a) * rr) - 1, dsSz, dsSz);
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
        // Blood-red rotating rings (BH family palette). Zone D: dots snap to the grid.
        for (let ring = 0; ring < 3; ring++) {
          const rr = 18 + ring * 22;
          const n = 16 + ring * 6;
          ctx.fillStyle = ring === 0 ? '#c01818' : '#8a1010';
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + g.frame * spinK * (ring % 2 === 0 ? 1 : -0.7);
            ctx.globalAlpha = 0.45 + (i % 2) * 0.25;
            ctx.fillRect(zoneSnap(sr.x + Math.cos(a) * rr) - 1, zoneSnap(sr.y + Math.sin(a) * rr) - 1, 2, 2);
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

        // Hollow outline: denser, brighter "hole" with chase stretch + repulsion sparks.
        // The outline is mid-grey so the hole has a findable rim even when idle; only the
        // interior stays brighter-than-cream (the "hole, not a shadow" read).
        const breath = 1 + Math.sin(g.frame * 0.04) * 0.06;
        const nDots = 36;
        ctx.fillStyle = '#b0aca0';
        for (let i = 0; i < nDots; i++) {
          const a = (i / nDots) * Math.PI * 2;
          if (nmb.chasing) {
            const forward = nmb.faceX * Math.cos(a) + nmb.faceY * Math.sin(a);
            if (forward > 0.2 && i % 3 !== 0) continue;
          }
          const rr = NMB_R_VISUAL * breath;
          ctx.globalAlpha = 0.7 + 0.25 * Math.sin(g.frame * 0.04 + i);
          // Zone D signature: the hole's rim snaps to the Planck grid.
          ctx.fillRect(
            zoneSnap(nmb.x + Math.cos(a) * rr) - 1,
            zoneSnap(nmb.y + Math.sin(a) * rr) - 1,
            2, 2,
          );
        }
        // Interior slightly brighter than the paper — a hole, not a shadow.
        ctx.fillStyle = paperBright;
        ctx.globalAlpha = 0.45;
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 + g.frame * 0.02;
          const rr = NMB_R_VISUAL * 0.45 * breath;
          ctx.fillRect(Math.round(nmb.x + Math.cos(a) * rr), Math.round(nmb.y + Math.sin(a) * rr), 2, 2);
        }
        // While chasing: outward repulsion sparks so the "push away" read is instant.
        if (nmb.chasing) {
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + g.frame * 0.1;
            const t = ((g.frame * 0.12 + i * 0.2) % 1);
            const rr = NMB_R_VISUAL * (1.1 + t * 0.8);
            ctx.globalAlpha = 0.55 * (1 - t);
            ctx.fillRect(Math.round(nmb.x + Math.cos(a) * rr) - 1, Math.round(nmb.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Bubble Universe Collision: interference-fringe ring + blue-shifted interior ──
      for (const bu of g.bubbleUniverses) {
        if (bu.edgeFlash > 0) bu.edgeFlash--;
        // Interference fringe: alternating pink/cyan dots, phase-inverted slow blink.
        // Zone E signature: the outline no longer closes — a slowly precessing gap
        // (~15% of the circumference) drifts around the ring, and the brightness is
        // vertically asymmetric. Physics is untouched; only the drawing refuses to close.
        const bn = 48;
        const gapC = g.frame * 0.0012;
        for (let i = 0; i < bn; i++) {
          const a = (i / bn) * Math.PI * 2;
          let gd = ((a - gapC) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          if (gd > Math.PI) gd = Math.PI * 2 - gd;
          if (gd < Math.PI * 0.15) continue;
          const phase = Math.sin(g.frame * 0.01 + (i % 2 === 0 ? 0 : Math.PI));
          const on = phase > 0;
          if (i % 2 === 0) {
            ctx.fillStyle = on ? '#e8a0c8' : '#a0c8e8';
          } else {
            ctx.fillStyle = on ? '#a0c8e8' : '#e8a0c8';
          }
          ctx.globalAlpha = (0.55 + 0.25 * Math.abs(phase)) * (0.78 + 0.22 * Math.sin(a));
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

      // ── Conformal Cyclic Boundary: brighter rainbow horizon + rebirth streak ──
      if (g.cccBoundary) {
        const ccc = g.cccBoundary;
        const rainbow = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa', '#f783ac'];
        const bandY = H - CCC_BAND_H / 2;
        // Dual-row rainbow so the "end of the universe" band is unmistakable.
        for (let row = 0; row < 2; row++) {
          for (let i = 0; i < Math.ceil(W / 5); i++) {
            const px = ((i * 5 + g.frame * 0.15 + row * 2.5) % W + W) % W;
            ctx.fillStyle = rainbow[(i + row * 3) % rainbow.length];
            ctx.globalAlpha = 0.45 + 0.2 * Math.sin(g.frame * 0.04 + i * 0.3);
            ctx.fillRect(Math.round(px), Math.round(bandY + row * 3 - 1), 2, 2);
          }
        }
        ctx.globalAlpha = 1;
        if (ccc.streakTimer > 0) {
          ccc.streakTimer--;
          const st = 1 - ccc.streakTimer / 6;
          const sy = ccc.streakFromY + (g.launcherY + 8 - ccc.streakFromY) * st;
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.95;
          ctx.fillRect(Math.round(ccc.streakX) - 2, Math.round(sy) - 4, 4, 8);
          ctx.fillStyle = '#c8a000';
          ctx.globalAlpha = 0.7;
          ctx.fillRect(Math.round(ccc.streakX) - 1, Math.round(sy) - 6, 2, 12);
          ctx.globalAlpha = 1;
        }
      }

      // The Nothing: intentionally draws NOTHING. The blank circle of missing bgDots
      // (handled above) is the only evidence. Do not add a border or decoration.

      // ── Ergospheres: frame-dragging ring band (double ring spins at different speeds,
      // same direction; a static black core marks the non-rotating BH itself) ──
      for (const eg of g.ergospheres) {
        const bandCenter = (eg.r0 + eg.r1) / 2;
        // outer ring — slow. One step deeper than the quasar jet's light violet so the
        // two purples never read as the same object (docs/GIMMICK_DESIGN_GUIDE.md §3).
        const egExt = exoticT(g.level, 36);
        const outerSpin = g.frame * 0.012 * eg.dir;
        ctx.fillStyle = '#4a1e78';
        for (let i = 0; i < 40; i++) {
          if (exoticSkip(i, 1, egExt)) continue;
          const a = (i / 40) * Math.PI * 2 + outerSpin + exoticJitter(g.frame, i, egExt);
          ctx.globalAlpha = 0.5 + (i % 2) * 0.3;
          ctx.fillRect(Math.round(eg.x + Math.cos(a) * eg.r1) - 1, Math.round(eg.y + Math.sin(a) * eg.r1) - 1, 2, 2);
        }
        // inner ring — faster, same direction
        const innerSpin = g.frame * 0.03 * eg.dir;
        for (let i = 0; i < 32; i++) {
          if (exoticSkip(i, 2, egExt)) continue;
          const a = (i / 32) * Math.PI * 2 + innerSpin + exoticJitter(g.frame, i + 50, egExt);
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
        // Idle X was a 1px low-alpha scatter that read as stray pegs — brighter magenta,
        // 2px dots, and a higher idle floor keep "something is here" readable at rest.
        ctx.fillStyle = snapping || charging ? '#e040a0' : '#a0246e';
        for (const da of dirs) {
          const dx = Math.cos(da), dy = Math.sin(da);
          for (let i = 0; i < dotsPerDir; i++) {
            // at rest, dots drift inward toward the crossing; a snap reverses them outward
            const raw = snapping
              ? (g.frame * flowSpd + i * step) % MR_HALFLEN
              : MR_HALFLEN - ((g.frame * flowSpd + i * step) % MR_HALFLEN);
            const px = mr.x + dx * raw, py = mr.y + dy * raw;
            const pulse = charging ? (0.5 + Math.abs(Math.sin(g.frame * 0.3)) * 0.5)
                                    : (0.45 + Math.abs(Math.sin(g.frame * 0.03 + i)) * 0.3);
            ctx.globalAlpha = snapping ? 0.9 : pulse;
            ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
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
            ctx.globalAlpha = (1 - prog) * 0.75;
            ctx.fillRect(Math.round(ts.x + dx * along) - 1, Math.round(ts.y + dy * along) - 1, 2, 2);
          }
        }
        ctx.globalAlpha = 1;
        drawSolidCircle(ctx, ts.x, ts.y, 7, '#2a4a68');
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
        // Pale ice-blue instead of pure white (white 1px vanished on cream).
        ctx.fillStyle = '#c8d8f0';
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
          // Zone D signature: the bright head rides the Planck grid.
          ctx.fillRect(zoneSnap(px) - 1, zoneSnap(py) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Cosmic voids: dashed boundary + slow inward dust (emptiness you can see) ──
      for (const cv of g.cosmicVoids) {
        const pulse = 0.5 + Math.abs(Math.sin(g.frame * 0.02)) * 0.3;
        ctx.fillStyle = '#9a9688';
        const nDash = 64;
        for (let i = 0; i < nDash; i++) {
          if (i % 2 === 0) continue;
          const a  = (i / nDash) * Math.PI * 2 + g.frame * 0.003;
          const px = cv.x + Math.cos(a) * cv.rx;
          const py = cv.y + Math.sin(a) * cv.ry;
          ctx.globalAlpha = pulse;
          ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
        }
        // Sparse inward motes — reads as "air thinning" without filling the void.
        ctx.fillStyle = '#c8c4b8';
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + g.frame * 0.01;
          const t = ((g.frame * 0.015 + i * 0.17) % 1);
          const prx = cv.rx * (0.35 + t * 0.55);
          const pry = cv.ry * (0.35 + t * 0.55);
          ctx.globalAlpha = 0.35 * (1 - t);
          ctx.fillRect(Math.round(cv.x + Math.cos(a) * prx), Math.round(cv.y + Math.sin(a) * pry), 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Cosmic shear fields: aligned weak-lensing galaxy glyphs, no boundary ──
      for (const cs of g.cosmicShears) {
        const ca = Math.cos(cs.axis), sa = Math.sin(cs.axis);
        let activeU = 0, activeV = 0, hasActiveBall = false;
        for (const ball of g.balls) {
          const dx = ball.x - cs.x, dy = ball.y - cs.y;
          const u = (ca * dx + sa * dy) / cs.rx;
          const v = (-sa * dx + ca * dy) / cs.ry;
          if (u * u + v * v < 1) { activeU = u; activeV = v; hasActiveBall = true; break; }
        }
        let near0 = -1, near1 = -1, near2 = -1;
        let dist0 = Infinity, dist1 = Infinity, dist2 = Infinity;
        if (hasActiveBall) {
          for (let i = 0; i < cs.dots.length; i++) {
            const dot = cs.dots[i];
            const dd = (dot.u - activeU) ** 2 + (dot.v - activeV) ** 2;
            if (dd < dist0) {
              dist2 = dist1; near2 = near1; dist1 = dist0; near1 = near0; dist0 = dd; near0 = i;
            } else if (dd < dist1) {
              dist2 = dist1; near2 = near1; dist1 = dd; near1 = i;
            } else if (dd < dist2) {
              dist2 = dd; near2 = i;
            }
          }
        }
        const wobble = Math.sin(g.frame * 0.006) * 0.04;
        const gx = Math.cos(cs.axis + wobble), gy = Math.sin(cs.axis + wobble);
        for (let i = 0; i < cs.dots.length; i++) {
          const dot = cs.dots[i];
          const wx = cs.x + ca * dot.u * cs.rx - sa * dot.v * cs.ry;
          const wy = cs.y + sa * dot.u * cs.rx + ca * dot.v * cs.ry;
          const lit = i === near0 || i === near1 || i === near2;
          const half = dot.size + 2;
          ctx.fillStyle = dot.warm ? '#d46a7a' : '#2f8f9d';
          ctx.globalAlpha = (0.38 + 0.12 * Math.sin(g.frame * 0.006 + dot.phase)) * (lit ? 1.8 : 1);
          ctx.fillRect(Math.round(wx) - 1, Math.round(wy) - 1, 2, 2);
          ctx.globalAlpha *= 0.72;
          ctx.fillRect(Math.round(wx + gx * half), Math.round(wy + gy * half), 1, 1);
          ctx.fillRect(Math.round(wx - gx * half), Math.round(wy - gy * half), 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Silk damping clouds: short-axis blurred dot smear, no boundary line ──
      for (const silk of g.silkDampingClouds) {
        const ca = Math.cos(silk.axis), sa = Math.sin(silk.axis);
        const perpX = -sa, perpY = ca;
        for (const dot of silk.dots) {
          const drift = (g.frame * SILK_DRIFT + dot.phase * 40) % (silk.rx * 2) - silk.rx;
          const wx = silk.x + ca * (dot.u * silk.rx + drift * 0.15) + perpX * dot.v * silk.ry * 0.35;
          const wy = silk.y + sa * (dot.u * silk.rx + drift * 0.15) + perpY * dot.v * silk.ry * 0.35;
          const smear = 3 + Math.floor(Math.abs(dot.v) * 4);
          ctx.fillStyle = dot.warm ? '#b67a2e' : '#607fa8';
          ctx.globalAlpha = 0.32 + 0.08 * Math.sin(g.frame * 0.01 + dot.phase);
          for (let s = -smear; s <= smear; s++) {
            ctx.fillRect(Math.round(wx + perpX * s) - 1, Math.round(wy + perpY * s) - 1, dot.size, dot.size);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Dark energy patches: expanding lattice + brighter pink boundary + outward sparks ──
      for (const de of g.darkEnergyPatches) {
        const loopT = (g.frame % DE_LOOP_PERIOD) / DE_LOOP_PERIOD;
        const k = 1 - (1 - loopT) * (1 - loopT);
        ctx.fillStyle = '#d8b8b0';
        for (const p of de.grid) {
          const px = de.x + p.x * (1 + k * 0.45);
          const py = de.y + p.y * (1 + k * 0.45);
          ctx.globalAlpha = 0.35 * (1 - k * 0.35);
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#e88878';
        const nDash = 48;
        for (let i = 0; i < nDash; i++) {
          if (i % 2 === 0) continue;
          const a = (i / nDash) * Math.PI * 2;
          ctx.globalAlpha = 0.5;
          ctx.fillRect(Math.round(de.x + Math.cos(a) * DE_RANGE) - 1, Math.round(de.y + Math.sin(a) * DE_RANGE) - 1, 2, 2);
        }
        // Outward sparkles at the loop crest — "space itself stretching."
        if (k > 0.55) {
          const crest = (k - 0.55) / 0.45;
          ctx.fillStyle = '#ffc8b8';
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 + g.frame * 0.02;
            const rr = DE_RANGE * (0.7 + crest * 0.4);
            ctx.globalAlpha = 0.55 * (1 - crest);
            ctx.fillRect(Math.round(de.x + Math.cos(a) * rr) - 1, Math.round(de.y + Math.sin(a) * rr) - 1, 2, 2);
          }
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
        // Long accretion wake + faint bow flecks ahead (runaway SMBH).
        for (let ti = 1; ti <= 18; ti++) {
          const td = ti * 5;
          const tx = rcx - rdirx * td + (Math.random() - 0.5) * 3;
          const ty = rcy - rdiry * td + (Math.random() - 0.5) * 3;
          ctx.fillStyle = ti < 5 ? '#e01838' : ti < 12 ? '#c01030' : '#6a0030';
          ctx.globalAlpha = (1 - ti / 19) * 0.75;
          ctx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, ti < 6 ? 2 : 1, ti < 6 ? 2 : 1);
        }
        ctx.fillStyle = '#ff6a7a';
        for (let i = -4; i <= 4; i++) {
          const a = Math.atan2(rdiry, rdirx) + (i / 4) * 0.7;
          const sr = 14;
          ctx.globalAlpha = 0.35 * (1 - Math.abs(i) / 5);
          ctx.fillRect(Math.round(rcx + Math.cos(a) * sr) - 1, Math.round(rcy + Math.sin(a) * sr) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
        // rotating blood-red dot ring (same rotation rate as the main BH's vortex, k=0.02)
        const spin = g.frame * 0.02;
        ctx.fillStyle = '#c01030';
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2 + spin;
          ctx.globalAlpha = 0.4 + (i % 2) * 0.3;
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

        const baseAlpha = orc.phase === 'grow'    ? Math.min(0.55, 0.35 + ORC_BAND_HALF / orc.radius)
                         : orc.phase === 'fadeOut' ? Math.min(0.55, 0.35 + ORC_BAND_HALF / orc.radius) * (orc.timer / ORC_FADE_DUR)
                         :                           0; // recondense draws its own effect below

        if (orc.phase !== 'recondense' && baseAlpha > 0.002) {
          ctx.fillStyle = '#9a7ad8';
          const nDots = Math.max(32, Math.round((2 * Math.PI * orc.radius) / 6));
          for (let i = 0; i < nDots; i++) {
            const a = (i / nDots) * Math.PI * 2;
            ctx.globalAlpha = baseAlpha * (0.65 + (i % 2) * 0.35);
            ctx.fillRect(Math.round(orc.x + Math.cos(a) * orc.radius) - 1, Math.round(orc.y + Math.sin(a) * orc.radius) - 1, 2, 2);
          }
          // Soft secondary ghost ring slightly inside — makes the slow expansion readable.
          ctx.fillStyle = '#c8b0f0';
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2 + g.frame * 0.002;
            ctx.globalAlpha = baseAlpha * 0.35;
            ctx.fillRect(Math.round(orc.x + Math.cos(a) * (orc.radius - 6)) - 1, Math.round(orc.y + Math.sin(a) * (orc.radius - 6)) - 1, 1, 1);
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
          ctx.fillStyle = '#c8b898';
          const nDots = Math.max(32, Math.round((2 * Math.PI * baEffR) / 6));
          for (let i = 0; i < nDots; i++) {
            const a = (i / nDots) * Math.PI * 2;
            const flicker = 0.5 + 0.5 * Math.sin(g.frame * 0.015 + i * 1.7 + ri * 5);
            ctx.globalAlpha = 0.42 + flicker * 0.35;
            ctx.fillRect(Math.round(bao.x + Math.cos(a) * baEffR) - 1, Math.round(bao.y + Math.sin(a) * baEffR) - 1, 2, 2);
          }
          ctx.globalAlpha = 1;

          // brighter lit arc where a ball just touched this ring
          const baBinWidth = (Math.PI * 2) / BAO_LIT_BINS;
          for (let bi = 0; bi < bao.litBins[ri].length; bi++) {
            if (bao.litBins[ri][bi] <= 0) continue;
            const balt = bao.litBins[ri][bi] / BAO_LIT_DUR;
            const binCenter = bi * baBinWidth;
            ctx.fillStyle = '#e8d8b0';
            for (let s = -5; s <= 5; s++) {
              const a = binCenter + (s / 5) * (baBinWidth / 2);
              ctx.globalAlpha = balt * 0.95;
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
          // Wisteria body with pearl accents (inverted from the original pearl-white body,
          // which sat at the same luminance as the cream background despite being a Tier 1
          // reflector — see docs/GIMMICK_DESIGN_GUIDE.md §2 forbidden band).
          ctx.fillStyle   = aw.hitFlash > 0 ? '#ffffff' : (i % 3 === 0 ? '#e8e4f0' : '#a88ad8');
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
      // fading first while the halo lingers. Unlit frames keep a 1px seed ghost. ─────────────
      for (const lrd of g.littleRedDots) {
        if (lrd.hitCool > 0) lrd.hitCool--;
        if (lrd.hitFlash > 0) lrd.hitFlash--;
        const lrdCyclePos = (g.frame + lrd.phase) % (LRD_ON_FRAMES + LRD_OFF_FRAMES);
        const lrdAge = 1 + hazardAgeBoost(g.level, 68, 0.4);
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
            // Dense ionized cocoon (JWST little-red-dot inspired) — outer + inner rings.
            const haloR = LRD_R * (3.2 * lrdAge), haloN = 16;
            ctx.fillStyle = '#e85a3a';
            for (let i = 0; i < haloN; i++) {
              const a = (i / haloN) * Math.PI * 2 + g.frame * 0.01;
              ctx.globalAlpha = haloA * 0.55 * haloBreathe * Math.min(1, lrdAge);
              const lrdSz = zoneCoarse(i) ? 3 : 2; // Zone C grain
              ctx.fillRect(Math.round(lrd.x + Math.cos(a) * haloR) - 1, Math.round(lrd.y + Math.sin(a) * haloR) - 1, lrdSz, lrdSz);
            }
            ctx.fillStyle = '#ff8a60';
            for (let i = 0; i < 10; i++) {
              const a = (i / 10) * Math.PI * 2 - g.frame * 0.02;
              const rr = LRD_R * (2.0 * lrdAge);
              ctx.globalAlpha = haloA * 0.4 * haloBreathe;
              ctx.fillRect(Math.round(lrd.x + Math.cos(a) * rr) - 1, Math.round(lrd.y + Math.sin(a) * rr) - 1, 2, 2);
            }
          }
          if (coreA > 0) {
            ctx.fillStyle = '#c02818';
            ctx.globalAlpha = coreA * corePulse;
            ctx.fillRect(Math.round(lrd.x) - LRD_R / 2, Math.round(lrd.y) - LRD_R / 2, LRD_R, LRD_R);
          }
          ctx.globalAlpha = 1;
        } else {
          // Unlit seed ghost — the compact object is still there between blinks.
          ctx.fillStyle = '#8a2018';
          ctx.globalAlpha = 0.22;
          ctx.fillRect(Math.round(lrd.x), Math.round(lrd.y), 1, 1);
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

        // inverted-dot motif: black ring body with a fast-pulsing white core (danger signal).
        // Constant white rim so the black body never reads as a normal ink peg (peg-black
        // as a hazard body color is forbidden — docs/GIMMICK_DESIGN_GUIDE.md §2).
        drawSolidCircle(ctx, af.x, af.y, af.r + 2, '#ffffff');
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
          // Zone D signature: dash dots snap to the Planck grid.
          ctx.fillRect(zoneSnap(wx) - 1, zoneSnap(wy) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Time dilation fields: amber clock arcs + slow hand + enter/exit flash cue ──
      for (const td of g.timeDilations) {
        const pulse = 0.65 + Math.abs(Math.sin(g.frame * 0.03)) * 0.35;
        ctx.fillStyle = '#c89030';
        for (let ring = 0; ring < 3; ring++) {
          const rr = TD_RADIUS * (0.4 + ring * 0.28);
          const n  = 24 + ring * 8;
          const spin = g.frame * 0.006 * (ring % 2 === 0 ? 1 : -1);
          for (let i = 0; i < n; i++) {
            // Arc gaps read as a clock face rather than a solid ring.
            if (i % 4 === 0) continue;
            const a = (i / n) * Math.PI * 2 + spin;
            ctx.globalAlpha = pulse * (0.55 + (i % 2) * 0.35);
            ctx.fillRect(Math.round(td.x + Math.cos(a) * rr) - 1, Math.round(td.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        // Slow clock hand — the "time is wrong here" tell.
        const handA = g.frame * 0.008;
        ctx.fillStyle = '#ffe08a';
        ctx.globalAlpha = 0.85;
        for (let t = 0; t < TD_RADIUS * 0.55; t += 3) {
          ctx.fillRect(Math.round(td.x + Math.cos(handA) * t) - 1, Math.round(td.y + Math.sin(handA) * t) - 1, 2, 2);
        }
        ctx.fillStyle = '#c8a000';
        ctx.globalAlpha = pulse;
        ctx.fillRect(Math.round(td.x) - 2, Math.round(td.y) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── Quantum Zeno observation: teal aperture dots + dark spokes ─────────
      for (const zeno of g.quantumZenoSectors) {
        const observing = Math.sin(g.frame * ZENO_DUTY_FREQ) > 0;
        // spokes along major axis
        const za = Math.cos(zeno.axis), zs = Math.sin(zeno.axis);
        ctx.fillStyle = '#1a4a44';
        for (const side of [-1, 1]) {
          for (const along of [0.55, 0.82]) {
            ctx.globalAlpha = 0.55;
            const px = zeno.x + za * zeno.rx * along * side;
            const py = zeno.y + zs * zeno.rx * along * side;
            ctx.fillRect(Math.round(px), Math.round(py), 1, 2);
          }
        }
        // 12 aperture dots on ellipse
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const px = zeno.x + Math.cos(a) * zeno.rx * 0.92;
          const py = zeno.y + Math.sin(a) * zeno.ry * 0.92;
          ctx.fillStyle = '#2a9a8a';
          ctx.globalAlpha = observing
            ? (0.55 + 0.45 * Math.sin(g.frame * 0.22 + i))
            : 0.15;
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
        // afterimage ghost on observed balls (display only)
        if (observing) {
          for (const ball of g.balls) {
            const zdx = ball.x - zeno.x, zdy = ball.y - zeno.y;
            const zu = (za * zdx + zs * zdy) / zeno.rx;
            const zv = (-zs * zdx + za * zdy) / zeno.ry;
            if (zu * zu + zv * zv >= 1) continue;
            ctx.fillStyle = '#2a9a8a';
            ctx.globalAlpha = 0.35;
            ctx.fillRect(Math.round(ball.x - ball.vx * 0.4), Math.round(ball.y - ball.vy * 0.4), 2, 2);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Trans-solar chirp binary: deep teal inspiraling pair + faint orbit ─
      if (g.chirpBinary) {
        const ch = g.chirpBinary;
        const chExt = exoticT(g.level, 100);
        ch.timer++;
        if (ch.timer >= ch.period) {
          ch.timer = 0;
          ch.mergeFlash = 6; // cooler / shorter merger flash
          spawnBurst(g, ch.cx, ch.cy, 5, 5, '#1a8898');
        }
        if (ch.mergeFlash > 0) ch.mergeFlash--;
        const chirpPhase = ch.timer / ch.period;
        const vib = Math.sin(chirpPhase * Math.PI * CHIRP_HARM) * 2;
        const orbR = Math.max(4, CHIRP_ORB_R * (1 - chirpPhase * 0.55) + vib);
        const th = g.frame * CHIRP_ORB_SPEED * (1 + chirpPhase * 2.5) + ch.phaseOffset;
        const cth = Math.cos(th), sth = Math.sin(th);
        const ax = ch.cx + orbR * cth, ay = ch.cy + orbR * sth;
        const bx = ch.cx - orbR * cth, by = ch.cy - orbR * sth;
        // orbit dots — non-uniform density via exoticSkip; denser toward merge
        const orbA = 0.10 + chirpPhase * 0.14;
        ctx.fillStyle = '#1a8898';
        for (let i = 0; i < 14; i++) {
          if (exoticSkip(i, 17, Math.max(0.4, chExt))) continue;
          const a = (i / 14) * Math.PI * 2 + exoticJitter(g.frame, i, chExt);
          ctx.globalAlpha = orbA * (0.7 + 0.3 * ((i * 3) % 5) / 5);
          ctx.fillRect(
            Math.round(ch.cx + Math.cos(a) * orbR),
            Math.round(ch.cy + Math.sin(a) * orbR),
            1, 1,
          );
        }
        // binary stars
        ctx.globalAlpha = ch.mergeFlash > 0 ? 0.90 : 0.80;
        ctx.fillRect(Math.round(ax) - 1, Math.round(ay) - 1, 2, 2);
        ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 2, 2);
        if (ch.mergeFlash > 0) {
          ctx.fillStyle = '#1a8898';
          ctx.globalAlpha = (ch.mergeFlash / 6) * 0.7;
          ctx.fillRect(Math.round(ch.cx) - 1, Math.round(ch.cy) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Cosmic strings: near-static thin lines — only the end knots jitter, plus a rare
      // glint traversal and a 2f vibration + 1f ball afterimage on crossing. Drawn in cold
      // periwinkle (Tier 1 hazard: it teleports, so the line itself must be clearly visible
      // on cream — see docs/GIMMICK_DESIGN_GUIDE.md §2). ────────────────────────────────
      for (const cs of g.cosmicStrings) {
        const csCos = Math.cos(cs.angle), csSin = Math.sin(cs.angle);
        const halfLen = CS_LENGTH * 0.5;
        const vib = cs.hitFlash > 0 ? (cs.hitFlash % 2 === 0 ? 1 : -1) : 0; // ±1px 2f vibration
        if (cs.hitFlash > 0) cs.hitFlash--;
        const perpX = -csSin, perpY = csCos;
        ctx.fillStyle = '#5a7ae0';
        ctx.globalAlpha = 0.9;
        for (let t = -halfLen; t <= halfLen; t += 2) {
          const px = cs.x + csCos * t + perpX * vib;
          const py = cs.y + csSin * t + perpY * vib;
          // Zone D signature: even a 1-D defect renders on the Planck grid.
          ctx.fillRect(zoneSnap(px) - 1, zoneSnap(py) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
        // end knots: small dot clusters with a tiny independent jitter
        ctx.fillStyle = '#2a3a80';
        for (const end of [-1, 1] as const) {
          const kx = cs.x + csCos * halfLen * end;
          const ky = cs.y + csSin * halfLen * end;
          const jx = Math.sin(g.frame * 0.17 + end) * 1.1;
          const jy = Math.cos(g.frame * 0.13 + end) * 1.1;
          ctx.globalAlpha = 0.9;
          ctx.fillRect(Math.round(kx + jx) - 2, Math.round(ky + jy) - 2, 4, 4);
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
        // Ball afterimage at the old + new crossing positions (fades over ghostFlash frames)
        if (cs.ghostFlash > 0) {
          const gt = Math.min(1, cs.ghostFlash / 8);
          ctx.fillStyle = '#8aa0f0';
          ctx.globalAlpha = 0.55 * gt;
          ctx.fillRect(Math.round(cs.ghostOldX) - BALL_R, Math.round(cs.ghostOldY) - BALL_R, BALL_R * 2, BALL_R * 2);
          ctx.fillRect(Math.round(cs.ghostNewX) - BALL_R, Math.round(cs.ghostNewY) - BALL_R, BALL_R * 2, BALL_R * 2);
          // Shift streak between old and new positions
          ctx.fillStyle = '#5a7ae0';
          for (let s = 1; s < 4; s++) {
            const t = s / 4;
            const sx = cs.ghostOldX + (cs.ghostNewX - cs.ghostOldX) * t;
            const sy = cs.ghostOldY + (cs.ghostNewY - cs.ghostOldY) * t;
            ctx.globalAlpha = 0.4 * gt * (1 - t);
            ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 2, 2);
          }
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
        // Slate-silver, one step deeper than the old #d8dce8 which sank into the cream.
        ctx.fillStyle = flashing ? '#ffffff' : '#a8b4d0';
        const nDots = 48;
        for (let i = 0; i < nDots; i++) {
          const a = (i / nDots) * Math.PI * 2;
          ctx.globalAlpha = flashing ? 0.95 : 0.5 + (i % 2) * 0.2;
          ctx.fillRect(Math.round(emr.x + Math.cos(a) * EMR_R) - 1, Math.round(emr.y + Math.sin(a) * EMR_R) - 1, 2, 2);
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
          ctx.fillStyle = '#a8b4d0';
          ctx.globalAlpha = (1 - st) * 0.7;
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            ctx.fillRect(Math.round(emr.shockX + Math.cos(a) * sr) - 1, Math.round(emr.shockY + Math.sin(a) * sr) - 1, 1, 1);
          }
          ctx.globalAlpha = 1;
        }
        // mirror-image ball ghost at the ring-symmetric position (fades over ghostFlash frames)
        if (emr.ghostFlash > 0) {
          const gt = Math.min(1, emr.ghostFlash / 10);
          ctx.fillStyle = '#a8b4d0';
          ctx.globalAlpha = 0.7 * gt;
          ctx.fillRect(Math.round(emr.ghostX) - BALL_R, Math.round(emr.ghostY) - BALL_R, BALL_R * 2, BALL_R * 2);
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.5 * gt;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            ctx.fillRect(Math.round(emr.ghostX + Math.cos(a) * (BALL_R + 3)) - 1, Math.round(emr.ghostY + Math.sin(a) * (BALL_R + 3)) - 1, 2, 2);
          }
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
        // Depth visage (tier >= 3): a faint blood-red accretion churn outside the aura —
        // deep bosses have begun to feed. Draw-only; hp and hitbox never change.
        if (b.tier >= 3) {
          ctx.fillStyle = '#c01030';
          for (let i = 0; i < 24; i++) {
            const a  = (i / 24) * Math.PI * 2 + fr2 * 0.006;
            const rr = b.r + 14 + ((fr2 * 0.15 + i * 5) % 12) - 6;
            ctx.globalAlpha = 0.20 + (i % 3) * 0.08;
            ctx.fillRect(Math.round(b.x + Math.cos(a) * rr) - 1, Math.round(b.y + Math.sin(a) * rr) - 1, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
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
        // Depth visage (tier >= 7): a slowly precessing piece of the core simply isn't
        // there — punched out in paper color. Visual only; the full disc still collides.
        if (b.tier >= 7) {
          const biteA = fr2 * 0.003;
          drawSolidCircle(ctx, b.x + Math.cos(biteA) * b.r * 0.62, b.y + Math.sin(biteA) * b.r * 0.62, b.r * 0.34, paperColor);
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
      {
        let lw = 0;
        for (let i = 0; i < g.lightningArcs.length; i++) {
          const arc = g.lightningArcs[i];
          if (arc.age < arc.maxAge) g.lightningArcs[lw++] = arc;
        }
        g.lightningArcs.length = lw;
      }
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
        // Wrongness kind 0: this peg simply isn't there for 2 frames, then it is again.
        if (g.wrongFrames > 0 && peg === g.wrongPeg && g.wrongKind === 0) continue;

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
            // Blue core + animated shield ring when hp >= 2 (gold plates use brand gold).
            const isGold = !!(peg.bossArmor && peg.goldArmor);
            drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, isGold ? '#3a3000' : '#0a2040', 1.0);
            if ((peg.hp ?? SHIELD_HP) >= SHIELD_HP) {
              const shRingR = PEG_R + 5;
              const shCount = Math.round(2 * Math.PI * shRingR / 3.5);
              const shPulse = 0.55 + Math.abs(Math.sin(g.frame * (isGold ? 0.14 : 0.11))) * 0.45;
              // Boss depth visage (tier >= 9): armor rings no longer close (Zone E grammar).
              const shUnclosed = peg.bossArmor && g.boss && g.boss.tier >= 9;
              const shGapC = g.frame * 0.0015;
              ctx.fillStyle = isGold ? '#c8a000' : '#4488ff';
              for (let i = 0; i < shCount; i++) {
                const sa = (i / shCount) * Math.PI * 2 + g.frame * 0.025;
                if (shUnclosed) {
                  let sgd = ((sa - shGapC) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
                  if (sgd > Math.PI) sgd = Math.PI * 2 - sgd;
                  if (sgd < Math.PI * 0.18) continue;
                }
                ctx.globalAlpha = shPulse * (isGold ? 0.88 : 0.72);
                ctx.fillRect(Math.round(peg.x + Math.cos(sa) * shRingR) - 1, Math.round(peg.y + Math.sin(sa) * shRingR) - 1, 2, 2);
              }
              if (isGold) {
                // Bright gold core spark so refill plates read at a glance.
                ctx.fillStyle = '#ffe066';
                ctx.globalAlpha = shPulse;
                ctx.fillRect(Math.round(peg.x) - 2, Math.round(peg.y) - 2, 4, 4);
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
            // Bright ice-blue snowflake + pulsing frost halo so it never reads as ink.
            const fpulse = 0.75 + Math.abs(Math.sin(g.frame * 0.09 + peg.y * 0.03)) * 0.25;
            const haloR = PEG_R + 4 + fpulse * 3;
            ctx.fillStyle = '#88ccff';
            const hCount = Math.max(8, Math.round(2 * Math.PI * haloR / 3.2));
            for (let i = 0; i < hCount; i++) {
              const a = (i / hCount) * Math.PI * 2 + g.frame * 0.02;
              ctx.globalAlpha = fpulse * 0.45;
              ctx.fillRect(Math.round(peg.x + Math.cos(a) * haloR) - 1, Math.round(peg.y + Math.sin(a) * haloR) - 1, 2, 2);
            }
            ctx.globalAlpha = 1;
            drawDots(ctx, peg.dots, peg.x, peg.y, g.frame * 0.01, g.frame, FREEZE_PEG_COLOR, fpulse);
            // Bright core sparkle
            ctx.fillStyle = '#e8f8ff';
            ctx.globalAlpha = fpulse * 0.9;
            ctx.fillRect(Math.round(peg.x) - 2, Math.round(peg.y) - 2, 4, 4);
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
          } else if (peg.type === 'neutron') {
            // Heavy grey neutron star: dense core, orbiting nucleon shell, 2-pip HP ring.
            const npulse = 0.5 + Math.abs(Math.sin(g.frame * 0.14 + peg.x * 0.03)) * 0.5;
            drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, '#3a3d47', 1.0);
            ctx.fillStyle = '#c8ccd8';
            const nR = PEG_R + 3;
            const nC = Math.round(2 * Math.PI * nR / 3.0);
            for (let i = 0; i < nC; i++) {
              const a = (i / nC) * Math.PI * 2 - g.frame * 0.03;
              ctx.globalAlpha = npulse * 0.5;
              ctx.fillRect(Math.round(peg.x + Math.cos(a) * nR) - 1, Math.round(peg.y + Math.sin(a) * nR) - 1, 2, 2);
            }
            const nMax = peg.maxHp ?? NEUTRON_HP;
            const nHp  = peg.hp ?? NEUTRON_HP;
            for (let i = 0; i < nMax; i++) {
              const a = -Math.PI / 2 + (i / nMax) * Math.PI * 2;
              ctx.fillStyle   = i < nHp ? '#e8ecf4' : '#20242c';
              ctx.globalAlpha = i < nHp ? 1 : 0.4;
              ctx.fillRect(Math.round(peg.x + Math.cos(a) * (PEG_R + 7)) - 1, Math.round(peg.y + Math.sin(a) * (PEG_R + 7)) - 1, 3, 3);
            }
            ctx.fillStyle = '#eef2fb';
            ctx.globalAlpha = 0.85;
            ctx.fillRect(Math.round(peg.x) - 2, Math.round(peg.y) - 2, 4, 4);
            ctx.globalAlpha = 1;
          } else if (peg.type === 'pair') {
            // Charge-pair: a faint ghost twin shimmers beside the ink body (hints "births a copy").
            const off = Math.sin(g.frame * 0.05 + peg.y * 0.02) * 3;
            // ghost twin: pass the faintness via alphaMult (drawDots overwrites globalAlpha per dot).
            drawDots(ctx, peg.dots, peg.x + off + 5, peg.y, 0, g.frame, '#3a5a8a', 0.22);
            drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, '#0c1830', 1.0);
          } else if (peg.type === 'entangle') {
            // Draw-only tether to the still-alive partner so the pairing is readable.
            const partner = peg.entanglePartner;
            if (partner && !partner.cleared) {
              ctx.fillStyle = '#8a78d8';
              const steps = 10;
              const flick = 0.3 + Math.abs(Math.sin(g.frame * 0.08)) * 0.3;
              for (let s = 1; s < steps; s++) {
                const tt = s / steps;
                ctx.globalAlpha = flick * (0.5 - Math.abs(tt - 0.5)) * 1.4; // dimmer near the ends
                ctx.fillRect(Math.round(peg.x + (partner.x - peg.x) * tt), Math.round(peg.y + (partner.y - peg.y) * tt), 1, 1);
              }
              ctx.globalAlpha = 1;
            }
            const epulse = 0.6 + Math.abs(Math.sin(g.frame * 0.1)) * 0.4;
            drawDots(ctx, peg.dots, peg.x, peg.y, g.frame * 0.02, g.frame, '#241852', epulse);
          } else if (peg.type === 'redshift') {
            // Ink shifts blue→copper as the level ages; a faint receding ring underscores it.
            const rT   = Math.min(1, (g.frame - g.levelStartFrame) / REDSHIFT_WINDOW);
            const rCol = rT < 0.33 ? '#0c1520' : rT < 0.66 ? '#33231a' : '#4a2818';
            const ringPhase = (g.frame * 0.04) % 6;
            ctx.fillStyle = rT < 0.5 ? '#5a7ab0' : '#a05838';
            const rr = PEG_R + 3 + ringPhase;
            const rc = Math.round(2 * Math.PI * rr / 3.5);
            for (let i = 0; i < rc; i++) {
              const a = (i / rc) * Math.PI * 2;
              ctx.globalAlpha = Math.max(0, 0.35 - ringPhase / 22) * (0.5 + rT * 0.5);
              ctx.fillRect(Math.round(peg.x + Math.cos(a) * rr) - 1, Math.round(peg.y + Math.sin(a) * rr) - 1, 1, 1);
            }
            ctx.globalAlpha = 1;
            drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, rCol, 1.0);
          } else {
            // Wrongness kind 1: for 2 frames the ink runs hazard blood-red, then it never did.
            const wrongFlicker = g.wrongFrames > 0 && peg === g.wrongPeg && g.wrongKind === 1;
            const col = wrongFlicker ? '#c01030'
                      : peg.type === 'orange' ? '#1a1205'
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
          const fogKey = `${dpr}|${W}|${H}|${fogTop}|${paperColor}`;
          if (_fogGradKey !== fogKey || !_fogHazeGr || !_fogFadeGr) {
            _fogGradKey = fogKey;
            _fogHazeGr = ctx.createLinearGradient(0, fogTop + 80, 0, H);
            _fogHazeGr.addColorStop(0, 'rgba(26,20,48,0)');
            _fogHazeGr.addColorStop(1, 'rgba(26,20,48,1)');
            _fogFadeGr = ctx.createLinearGradient(0, fogTop, 0, fogTop + 70);
            _fogFadeGr.addColorStop(0, paperColor);
            _fogFadeGr.addColorStop(1, paperFade);
          }
          ctx.globalAlpha = g.fogAlpha * 0.22;
          ctx.fillStyle   = _fogHazeGr;
          ctx.fillRect(0, fogTop, W, H - fogTop);
        }

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

          // TV static: deterministic sample of baked in-cloud positions (same visual grain,
          // no Math.random per grain — was ~5k random calls/frame with fog active).
          const pool = cloud.staticPool!;
          const pl = pool.length;
          if (pl > 0) {
            for (let ci = 0; ci < FOG_STATIC_DEFS.length; ci++) {
              const [col, af, count, sz] = FOG_STATIC_DEFS[ci];
              ctx.fillStyle   = col;
              ctx.globalAlpha = ca * af;
              const half = sz >> 1;
              for (let i = 0; i < count; i++) {
                const p = pool[((fr * 2654435761 + i * 40503 + ci * 9973) >>> 0) % pl];
                ctx.fillRect(((cx + p[0]) | 0) - half, ((cy + p[1]) | 0) - half, sz, sz);
              }
            }
          }
        }

        ctx.restore(); // release fog clip

        // top boundary: tight 70px paper fade — avoids height-based opacity variation in fog below
        ctx.fillStyle   = _fogFadeGr!;
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
            stuckTimer: 0, stuckBaseY: g.launcherY + 8, freezeTimer: 0, mudTimer: 0, neutronTimer: 0, dilated: false, bfSide: 0, pdgSide: 0, rgLayer: 0, vcTimer: 0, vcFlip: 1, bucFlash: 0, reborn: false, goldTimer: 0, inVoid: false, wSign: 1, phantomSide: 0, fsPrevVx: 0, fsPrevVy: 0, ideSiphonU: 0, fxTrail: 0, fxTrailColor: '#8a96d8', fxTwist: 0, fxField: 0, fxFieldColor: '#c89030',
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
        _aliveBuf.length = 0;

        // Vacuum decay leak: advance shared age once per frame (before per-ball forces).
        for (const vl of g.vacLeaks) {
          vl.age++;
          if (vl.age >= VACLEAK_T + VACLEAK_REST) vl.age = 0;
        }

        // Gravity echo: sample near-source perturbation into ring buffer, then apply delayed twist.
        if (g.gravEcho) {
          const ge = g.gravEcho;
          let sample = 0, n = 0;
          for (const b of g.balls) {
            const dx = b.x - ge.x, dy = b.y - ge.y;
            const d2 = dx * dx + dy * dy;
            if (d2 >= GRAVECHO_SENSE * GRAVECHO_SENSE || d2 < 1) continue;
            const d = Math.sqrt(d2);
            // Angular-momentum proxy around the epicenter (past "binary" curl).
            sample += (dx * b.vy - dy * b.vx) / (d * d);
            n++;
          }
          let s = n > 0 ? Math.tanh(sample / n) : Math.sin(g.frame * 0.04) * 0.35;
          ge.buf[ge.write] = s;
          ge.write = (ge.write + 1) % GRAVECHO_DELAY;
        }

        // Sign-switching IDE: advance timer-mode flip once per frame.
        for (const ss of g.signIdeSeams) {
          if (ss.blinkTimer > 0) ss.blinkTimer--;
          if (ss.mode !== 'timer') continue;
          ss.timer++;
          if (ss.timer >= SIGNIDE_PERIOD) {
            ss.timer = 0;
            ss.signFlip = ss.signFlip === 1 ? -1 : 1;
            ss.blinkTimer = 2;
            for (const b of g.balls) pulseFieldFx(b, '#889098');
          }
        }
        // Phantom crossing belt: fade double-shadow flash.
        for (const pb of g.phantomBelts) {
          if (pb.flashTimer > 0) pb.flashTimer--;
        }
        for (const pz of g.photoZGates) {
          if (pz.flashTimer > 0) pz.flashTimer--;
        }

        // Momentum-only dark coupling: once per frame, align tangential velocities of nearby pairs.
        if (g.momCoupActive && g.balls.length >= 2) {
          const bs = g.balls;
          for (let i = 0; i < bs.length; i++) {
            for (let j = i + 1; j < bs.length; j++) {
              const a = bs[i], b = bs[j];
              const dx = b.x - a.x, dy = b.y - a.y;
              const dist2 = dx * dx + dy * dy;
              if (dist2 >= MOMCOUP_R * MOMCOUP_R || dist2 < 1) continue;
              const dist = Math.sqrt(dist2);
              const nx = dx / dist, ny = dy / dist;
              const tAtten = 1 - dist / MOMCOUP_R;
              const k = 1 - (1 - MOMCOUP_BLEND) * tAtten * tAtten;
              const aRad = a.vx * nx + a.vy * ny;
              const bRad = b.vx * nx + b.vy * ny;
              const atx = a.vx - aRad * nx, aty = a.vy - aRad * ny;
              const btx = b.vx - bRad * nx, bty = b.vy - bRad * ny;
              const mx = (atx + btx) * 0.5, my = (aty + bty) * 0.5;
              a.vx = aRad * nx + mx + (atx - mx) * k;
              a.vy = aRad * ny + my + (aty - my) * k;
              b.vx = bRad * nx + mx + (btx - mx) * k;
              b.vy = bRad * ny + my + (bty - my) * k;
              if (g.frame % 5 === 0) {
                pulseTwistFx(a);
                pulseTwistFx(b);
              }
            }
          }
        }

        for (let ballIdx = 0; ballIdx < g.balls.length; ballIdx++) {
          const ball = g.balls[ballIdx];
          // Freeze / mud / readability-FX timer decay
          if (ball.freezeTimer > 0) ball.freezeTimer--;
          if (ball.mudTimer > 0) ball.mudTimer--;
          if (ball.neutronTimer > 0) ball.neutronTimer--;
          if (ball.fxTrail > 0) ball.fxTrail--;
          if (ball.fxTwist > 0) ball.fxTwist--;
          if (ball.fxField > 0) ball.fxField--;
          if (ball.vcTimer > 0) ball.vcTimer--;

          // Closed timelike curve: snapshot on first band entry, rewind after CTC_WAIT frames.
          for (const ctc of g.closedTimelikeCurves) {
            if (g.ctcUsed.has(ball)) break;
            const inBand = ctcBallInBand(ctc, ball);
            let st = g.ctcStates.get(ball);
            if (!st && inBand) {
              st = { snapX: ball.x, snapY: ball.y, snapVx: ball.vx, snapVy: ball.vy, waitLeft: CTC_WAIT, anchorLeft: CTC_WAIT };
              g.ctcStates.set(ball, st);
            }
            if (st) {
              st.waitLeft--;
              st.anchorLeft = Math.max(0, st.anchorLeft - 1);
              if (st.waitLeft <= 0) {
                const sspd = Math.sqrt(st.snapVx * st.snapVx + st.snapVy * st.snapVy) || 1;
                ctc.warpFromX = ball.x; ctc.warpFromY = ball.y;
                ctc.warpToX = st.snapX + st.snapVx / sspd * CTC_PUSH;
                ctc.warpToY = st.snapY + st.snapVy / sspd * CTC_PUSH;
                ctc.warpLeft = CTC_WARP_DUR;
                ball.x = ctc.warpToX;
                ball.y = ctc.warpToY;
                ball.vx = st.snapVx;
                ball.vy = st.snapVy;
                g.ctcUsed.add(ball);
                g.ctcStates.delete(ball);
                spawnBurst(g, st.snapX, st.snapY, 0, 0, '#d12f8a');
                spawnBurst(g, st.snapX, st.snapY, 0, 0, '#159f9f');
              }
            }
            break;
          }

          // Cosmic void membership: checked once so the effMinSpeed suppression below and
          // the gravity/drag effect further down agree on the same "inside" test.
          let inCosmicVoid = false;
          for (const cv of g.cosmicVoids) {
            const cvdx = (ball.x - cv.x) / cv.rx, cvdy = (ball.y - cv.y) / cv.ry;
            if (cvdx * cvdx + cvdy * cvdy < 1) { inCosmicVoid = true; break; }
          }
          if (inCosmicVoid && !ball.inVoid) {
            pulseFieldFx(ball, '#9a9688');
            ball.inVoid = true;
          } else if (!inCosmicVoid && ball.inVoid) {
            pulseFieldFx(ball, '#c8c4b8');
            ball.inVoid = false;
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
          // Subsolar PBH echo: brief gravity-null bubble around the merge midpoint.
          let inSpbhEcho = false;
          const spbh = g.subsolarPbhEcho;
          if (spbh && spbh.phase === 1) {
            const mx = (spbh.x1 + spbh.x2) * 0.5, my = (spbh.y1 + spbh.y2) * 0.5;
            const edx = ball.x - mx, edy = ball.y - my;
            if (edx * edx + edy * edy < SPBH_ECHO_RANGE * SPBH_ECHO_RANGE) {
              inSpbhEcho = true;
              pulseFieldFx(ball, '#9a9688');
            }
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
            pulseFieldFx(ball, '#c89030');
          } else if (!nowInDilation && ball.dilated) {
            ball.vx /= TD_SLOW; ball.vy /= TD_SLOW;
            const dspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (dspd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / dspd; ball.vx *= sc; ball.vy *= sc; }
            ball.dilated = false;
            pulseFieldFx(ball, '#ffe08a');
          }
          // While frozen, stuck in mud, drifting in a cosmic void, time-dilated, or inside a
          // Dark Star's core, suppress dynMinSpeed so the slow isn't overridden
          const effMinSpeed = ball.mudTimer > 0     ? Math.min(dynMinSpeed, BALL_SPEED * MUD_SLOW * 1.2)
                            : ball.freezeTimer > 0   ? Math.min(dynMinSpeed, BALL_SPEED * FREEZE_SLOW * 0.95)
                            : ball.neutronTimer > 0  ? Math.min(dynMinSpeed, BALL_SPEED * NEUTRON_SLOW)
                            : inCosmicVoid           ? Math.min(dynMinSpeed, BALL_SPEED * 0.35)
                            : ball.dilated           ? Math.min(dynMinSpeed, BALL_SPEED * 0.30)
                            : inDarkStarCore         ? Math.min(dynMinSpeed, BALL_SPEED * 0.35)
                            :                          dynMinSpeed;

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
          // Quintom breathe: scale gravity slowly across the whole board (DESI w0/wa motif).
          let quintomScale = 1;
          if (g.quintomBreathActive) {
            const qs = Math.sin(g.frame * QUINTOM_K);
            quintomScale = 1 + QUINTOM_AMP * qs;
            if (qs > 0.2) { if (g.frame % 6 === 0) pulseForceFx(ball, '#c89040'); }
            else if (qs < -0.2) { if (g.frame % 6 === 0) pulseFieldFx(ball, '#5a2878'); }
          }
          // Variable coupling drift: board-wide gravity multiplier oscillates slowly.
          let varCoupScale = 1;
          if (g.varCoupActive) {
            const coupling = VARCOUP_BASE + VARCOUP_BASE * Math.sin(g.frame * VARCOUP_K);
            varCoupScale = 1 + coupling;
            if (Math.abs(coupling) > 0.05 && g.frame % 6 === 0) pulseFieldFx(ball, '#8a8068');
          }
          // Dual-H0 seam: gravity scale by side of the tilted divider + one-shot cross twist.
          let h0Scale = 1;
          if (g.dualH0Seam) {
            const seam = g.dualH0Seam;
            const nx = Math.cos(seam.angle + Math.PI * 0.5);
            const ny = Math.sin(seam.angle + Math.PI * 0.5);
            const side = ((ball.x - seam.cx) * nx + (ball.y - seam.cy) * ny) >= 0 ? 1 : -1;
            h0Scale = side > 0 ? DH0_HEAVY : DH0_LIGHT;
            if (side > 0) { if (g.frame % 6 === 0) pulseForceFx(ball, '#8a6870'); }
            else { if (g.frame % 6 === 0) pulseFieldFx(ball, '#687888'); }
            const prev = seam.lastSide.get(ball);
            if (prev === undefined) {
              seam.lastSide.set(ball, side);
            } else if (prev !== side) {
              const rot = side > 0 ? DH0_TWIST : -DH0_TWIST;
              const c = Math.cos(rot), s = Math.sin(rot);
              const ovx = ball.vx, ovy = ball.vy;
              ball.vx = ovx * c - ovy * s;
              ball.vy = ovx * s + ovy * c;
              pulseTwistFx(ball);
              seam.lastSide.set(ball, side);
            }
          }
          // S8 bifurcation seam: DES-heavy vs KiDS-light growth amplitude + cross twist.
          let s8Scale = 1;
          for (const seam of g.s8Seams) {
            const nx = Math.cos(seam.angle + Math.PI * 0.5);
            const ny = Math.sin(seam.angle + Math.PI * 0.5);
            const side = ((ball.x - seam.cx) * nx + (ball.y - seam.cy) * ny) >= 0 ? 1 : -1;
            s8Scale = side > 0 ? S8SEAM_HEAVY : S8SEAM_LIGHT;
            if (side > 0) { if (g.frame % 6 === 0) pulseForceFx(ball, '#5a6870'); }
            else { if (g.frame % 6 === 0) pulseFieldFx(ball, '#889098'); }
            const prev = seam.lastSide.get(ball);
            if (prev === undefined) {
              seam.lastSide.set(ball, side);
            } else if (prev !== side) {
              const rot = side > 0 ? S8SEAM_TWIST : -S8SEAM_TWIST;
              const c = Math.cos(rot), s = Math.sin(rot);
              const ovx = ball.vx, ovy = ball.vy;
              ball.vx = ovx * c - ovy * s;
              ball.vy = ovx * s + ovy * c;
              pulseTwistFx(ball);
              seam.lastSide.set(ball, side);
            }
            break;
          }
          // Neutrino mass null band: DESI vs lab — gravity mass term fades inside the strip.
          let nuNullScale = 1;
          for (const nb of g.nuNullBands) {
            const tc = Math.cos(nb.angle), ts = Math.sin(nb.angle);
            const dx = ball.x - nb.cx, dy = ball.y - nb.cy;
            const along = dx * tc + dy * ts;
            const across = -dx * ts + dy * tc;
            if (Math.abs(along) <= nb.len * 0.5 && Math.abs(across) <= nb.halfW) {
              nuNullScale = NUNULL_GRAV;
              ball.vx *= NUNULL_DRAG;
              ball.vy *= NUNULL_DRAG;
              if (g.frame % 5 === 0) pulseFieldFx(ball, '#6a7868');
              break;
            }
          }
          // IDE energy siphon: dwell u raises gravity; outward micro-push fades as energy transfers.
          let ideSiphonScale = 1;
          {
            let inSiphon = false;
            for (const sb of g.ideSiphonBands) {
              const tc = Math.cos(sb.angle), ts = Math.sin(sb.angle);
              const dx = ball.x - sb.cx, dy = ball.y - sb.cy;
              const along = dx * tc + dy * ts;
              const across = -dx * ts + dy * tc;
              if (Math.abs(along) <= sb.len * 0.5 && Math.abs(across) <= sb.halfW) {
                inSiphon = true;
                ball.ideSiphonU = Math.min(1, ball.ideSiphonU + IDESIP_U_RISE);
                const u = ball.ideSiphonU;
                ideSiphonScale = 1 + IDESIP_GRAV_AMP * u;
                // Outward from midline (across), fades as dwell rises
                const push = IDESIP_PUSH * (1 - u);
                if (push > 0.001 && Math.abs(across) > 0.5) {
                  const t = 1 - Math.abs(across) / sb.halfW;
                  const f = push * t * t;
                  const sign = across >= 0 ? 1 : -1;
                  // across direction in world: (-ts, tc) for positive across? 
                  // across = -dx*ts + dy*tc → unit across axis is (-sin, cos)
                  ball.vx += (-ts) * sign * f;
                  ball.vy += (tc) * sign * f;
                  if (g.frame % 6 === 0) pulseFieldFx(ball, '#687060');
                }
                if (g.frame % 5 === 0) pulseForceFx(ball, '#8a7860');
                break;
              }
            }
            if (!inSiphon) ball.ideSiphonU = Math.max(0, ball.ideSiphonU - IDESIP_U_FALL);
          }
          // Phantom Crossing Belt: while inside the thin horizontal band, gravity is quietly
          // "on the other side" of the phantom divide (0.90 or 1.10 by tracked side).
          let phBeltScale = 1;
          if (g.phantomBelts.length > 0) {
            let inBelt = false;
            for (const pb of g.phantomBelts) {
              const dy = ball.y - pb.y;
              if (Math.abs(dy) > pb.halfW) continue;
              inBelt = true;
              const pSide = dy >= 0 ? 1 : -1;
              if (ball.phantomSide === 0) {
                ball.phantomSide = pSide;
              } else if (pSide !== ball.phantomSide) {
                pulseTwistFx(ball);
                pulseFieldFx(ball, '#686078');
                ball.phantomSide = pSide;
                pb.flashTimer = 3;
              }
              phBeltScale = ball.phantomSide > 0 ? PHBELT_LO : PHBELT_HI;
              break;
            }
            if (!inBelt) ball.phantomSide = 0;
          }
          // Sign-switching IDE seam: weak pull toward / push away from the seam reverses by side (or timer).
          for (const ss of g.signIdeSeams) {
            const nx = Math.cos(ss.angle + Math.PI * 0.5);
            const ny = Math.sin(ss.angle + Math.PI * 0.5);
            const tx = Math.cos(ss.angle), ty = Math.sin(ss.angle);
            const dx = ball.x - ss.cx, dy = ball.y - ss.cy;
            const along = dx * tx + dy * ty;
            if (Math.abs(along) > ss.len * 0.5) continue;
            const across = dx * nx + dy * ny;
            const ad = Math.abs(across);
            if (ad >= SIGNIDE_RANGE || ad < 0.5) continue;
            const t = 1 - ad / SIGNIDE_RANGE;
            const f = SIGNIDE_FORCE * t * t;
            // One side inward / other outward ≡ unidirectional force across seam (±n by signFlip).
            const sideSign = across >= 0 ? 1 : -1;
            const dir = -ss.signFlip;
            ball.vx += nx * dir * f;
            ball.vy += ny * dir * f;
            const toward = -sideSign * dir;
            if (toward > 0) { if (g.frame % 5 === 0) pulseForceFx(ball, '#7a6868'); }
            else { if (g.frame % 6 === 0) pulseFieldFx(ball, '#889098'); }
          }

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
              const gMag = effGrav * BUC_GRAV_SCALE * quintomScale * varCoupScale * h0Scale * s8Scale * nuNullScale * ideSiphonScale * phBeltScale;
              ball.vx += Math.sin(bu.tilt) * gMag;
              ball.vy += Math.cos(bu.tilt) * gMag;
              inBubbleU = true;
            }
          }
          if (!inBubbleU && !inSpbhEcho) ball.vy += effGrav * quintomScale * varCoupScale * h0Scale * s8Scale * nuNullScale * ideSiphonScale * phBeltScale;
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
            let strength = BH_PULL_FORCE * t * t;
            // Pulsing variant (lv60+): the well breathes — pull swells and relaxes on a
            // slow cycle (0.2x..1.0x). Absorption radius is untouched.
            if (zone.pulsing) strength *= 0.6 + 0.4 * Math.sin(g.frame * 0.015);
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

          // Cosmological horizon entropy: four edge bands push inward (Great Attractor reverse).
          if (g.horizonEntropyActive) {
            const W = g.W, H = g.H;
            let hfx = 0, hfy = 0;
            if (ball.x < HORIZON_BAND) {
              const t = 1 - ball.x / HORIZON_BAND;
              hfx += HORIZON_PUSH * t * t; // inward = +x
            }
            if (ball.x > W - HORIZON_BAND) {
              const t = 1 - (W - ball.x) / HORIZON_BAND;
              hfx -= HORIZON_PUSH * t * t; // inward = -x
            }
            if (ball.y < HORIZON_BAND) {
              const t = 1 - ball.y / HORIZON_BAND;
              hfy += HORIZON_PUSH * t * t; // inward = +y
            }
            if (ball.y > H - HORIZON_BAND) {
              const t = 1 - (H - ball.y) / HORIZON_BAND;
              hfy -= HORIZON_PUSH * t * t; // inward = -y
            }
            if (hfx !== 0 || hfy !== 0) {
              ball.vx += hfx;
              ball.vy += hfy;
              const hspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
              if (hspd > BALL_SPEED * 2) {
                const sc = BALL_SPEED * 2 / hspd;
                ball.vx *= sc;
                ball.vy *= sc;
              }
              ball.fxTrail = 3;
              ball.fxTrailColor = '#b86048';
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
            // The DM blob is drawn as nothing but a rare shimmer, so the ball itself must
            // betray the unseen pull: indigo bend-trail + a periodic aura ring.
            if (g.frame % 4 === 0) pulseForceFx(ball, '#9ab0ff');
            if (g.frame % 12 === 0) pulseFieldFx(ball, '#7a90e8');
          }

          // SIDM final-parsec spike: inter-core tangential friction + weak coreward pulls.
          // Physical cores stay fixed (visual approach is draw-only) so capture is impossible.
          if (g.sidmSpike) {
            const sp = g.sidmSpike;
            const sx = sp.x2 - sp.x1, sy = sp.y2 - sp.y1;
            const sLen2 = sx * sx + sy * sy || 1;
            const sLen = Math.sqrt(sLen2);
            const tx = (sx / sLen) * sp.dir, ty = (sy / sLen) * sp.dir;
            let t = ((ball.x - sp.x1) * sx + (ball.y - sp.y1) * sy) / sLen2;
            t = Math.max(0, Math.min(1, t));
            const cx = sp.x1 + sx * t, cy = sp.y1 + sy * t;
            const bdx = ball.x - cx, bdy = ball.y - cy;
            const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
            if (bdist < SIDM_BAND_HALF) {
              const ft = 1 - bdist / SIDM_BAND_HALF;
              const f = SIDM_TANG_FORCE * ft * ft;
              ball.vx += tx * f;
              ball.vy += ty * f;
              if (g.frame % 5 === 0) pulseForceFx(ball, '#4a8a9a');
            }
            for (const [px, py] of [[sp.x1, sp.y1], [sp.x2, sp.y2]] as [number, number][]) {
              const dx = px - ball.x, dy = py - ball.y;
              const dist2 = dx * dx + dy * dy;
              if (dist2 >= SIDM_CORE_R * SIDM_CORE_R || dist2 < 1) continue;
              const dist = Math.sqrt(dist2);
              const pt = 1 - dist / SIDM_CORE_R;
              const pf = SIDM_CORE_PULL * pt * pt;
              ball.vx += (dx / dist) * pf;
              ball.vy += (dy / dist) * pf;
              if (g.frame % 6 === 0) pulseFieldFx(ball, '#3a6870');
            }
            const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (spd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / spd; ball.vx *= sc; ball.vy *= sc; }
          }

          // Two-component DM segregation: heavy inward core + light outward shell (no absorb).
          for (const th of g.tcDmHalos) {
            const dx = ball.x - th.x, dy = ball.y - th.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 < 1 || dist2 >= TCDM_OUTER * TCDM_OUTER) continue;
            const dist = Math.sqrt(dist2);
            if (dist < TCDM_INNER) {
              const t = 1 - dist / TCDM_INNER;
              const f = TCDM_IN_FORCE * t * t;
              ball.vx -= (dx / dist) * f;
              ball.vy -= (dy / dist) * f;
              if (g.frame % 5 === 0) pulseForceFx(ball, '#3a5068');
            } else {
              const t = 1 - (dist - TCDM_INNER) / (TCDM_OUTER - TCDM_INNER);
              const f = TCDM_OUT_FORCE * t * t;
              ball.vx += (dx / dist) * f;
              ball.vy += (dy / dist) * f;
              if (g.frame % 5 === 0) pulseFieldFx(ball, '#8890a0');
            }
          }

          // Free-streaming softening: blend velocity with previous frame (erase small-scale jitter).
          {
            let inFs = false;
            for (const fs of g.fsSoftFields) {
              const fdx = (ball.x - fs.x) / fs.rx, fdy = (ball.y - fs.y) / fs.ry;
              if (fdx * fdx + fdy * fdy >= 1) continue;
              inFs = true;
              const b = FSSOFT_BLEND;
              const ovx = ball.vx, ovy = ball.vy;
              ball.vx = ovx * (1 - b) + ball.fsPrevVx * b;
              ball.vy = ovy * (1 - b) + ball.fsPrevVy * b;
              ball.fsPrevVx = ovx;
              ball.fsPrevVy = ovy;
              if (g.frame % 5 === 0) pulseForceFx(ball, '#8890a0');
              break;
            }
            if (!inFs) { ball.fsPrevVx = ball.vx; ball.fsPrevVy = ball.vy; }
          }

          // Overmassive mimic core: weak everyday pull; brief strong reveal burst (no absorb).
          for (const om of g.ommCores) {
            const dx = om.x - ball.x, dy = om.y - ball.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 >= OMM_RANGE * OMM_RANGE || dist2 < 1) continue;
            const dist = Math.sqrt(dist2);
            const t = 1 - dist / OMM_RANGE;
            const base = om.burstTimer > 0 ? OMM_FORCE_BURST : OMM_FORCE_WEAK;
            const f = base * t * t;
            ball.vx += (dx / dist) * f;
            ball.vy += (dy / dist) * f;
            if (om.burstTimer > 0) pulseFieldFx(ball, '#c87060');
            else if (g.frame % 5 === 0) pulseForceFx(ball, '#785868');
          }

          // Primordial B-field baryon clumps: weak pull to nuclei + mild outer-band repel.
          if (g.pmfClumps.length > 0) {
            for (const pc of g.pmfClumps) {
              const dx = pc.x - ball.x, dy = pc.y - ball.y;
              const dist2 = dx * dx + dy * dy;
              if (dist2 < 1) continue;
              const dist = Math.sqrt(dist2);
              if (dist < PMF_RANGE) {
                const t = 1 - dist / PMF_RANGE;
                const f = PMF_FORCE * t * t;
                ball.vx += (dx / dist) * f;
                ball.vy += (dy / dist) * f;
                if (g.frame % 5 === 0) pulseForceFx(ball, '#586878');
              } else if (dist < PMF_OUT_OUT) {
                const t = 1 - (dist - PMF_OUT_IN) / (PMF_OUT_OUT - PMF_OUT_IN);
                if (t > 0) {
                  const f = PMF_OUT_FORCE * t * t;
                  ball.vx -= (dx / dist) * f;
                  ball.vy -= (dy / dist) * f;
                  if (g.frame % 6 === 0) pulseFieldFx(ball, '#687888');
                }
              }
            }
          }

          // Vacuum decay leak: weak periodic inward seep (no absorb). Peak then 40f rest.
          for (const vl of g.vacLeaks) {
            // age already advanced; use previous tick's phase via (age-1) wrapped
            let tAge = vl.age - 1;
            if (tAge < 0) tAge = VACLEAK_T + VACLEAK_REST - 1;
            if (tAge >= VACLEAK_T) {
              // Just entered rest this frame?
              if (tAge === VACLEAK_T) {
                const dx = ball.x - vl.x, dy = ball.y - vl.y;
                if (dx * dx + dy * dy < VACLEAK_R * VACLEAK_R) pulseFieldFx(ball, '#889098');
              }
              continue;
            }
            const dx = vl.x - ball.x, dy = vl.y - ball.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 >= VACLEAK_R * VACLEAK_R || dist2 < 1) continue;
            const dist = Math.sqrt(dist2);
            const envelope = Math.sin(Math.PI * tAge / VACLEAK_T);
            const pull = VACLEAK_PULL * envelope * envelope;
            const t = 1 - dist / VACLEAK_R;
            const f = pull * t * t;
            ball.vx += (dx / dist) * f;
            ball.vy += (dy / dist) * f;
            if (f > 0.02 && g.frame % 5 === 0) pulseForceFx(ball, '#a8b0b8');
          }

          // Gravity echo delay: delayed speed-preserving micro-twist from epicenter sample.
          if (g.gravEcho) {
            const ge = g.gravEcho;
            const dx = ball.x - ge.x, dy = ball.y - ge.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 < GRAVECHO_RANGE * GRAVECHO_RANGE && dist2 > 1) {
              const dist = Math.sqrt(dist2);
              const echo = ge.buf[ge.write]; // oldest = D frames ago after write advance
              const t = 1 - dist / GRAVECHO_RANGE;
              const dTheta = GRAVECHO_AMP * echo * t * t;
              if (Math.abs(dTheta) > 1e-6) {
                const c = Math.cos(dTheta), s = Math.sin(dTheta);
                const nvx = ball.vx * c - ball.vy * s;
                ball.vy = ball.vx * s + ball.vy * c;
                ball.vx = nvx;
                if (g.frame % 6 === 0) pulseTwistFx(ball);
              }
            }
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
            if (g.frame % 5 === 0) pulseForceFx(ball, '#7a7670');
          }

          // CMB Anisotropy: board-wide temperature map. Hot spots lift (negative vy), cold
          // spots sink. Amplitude is 1/10 of gravity by design — drifts the ball but can
          // never stall it (the map is fixed, so there is no equilibrium point).
          if (g.cmbAnisotropy) {
            const cmb = g.cmbAnisotropy;
            const cmbT = Math.sin(ball.x * 0.030 + cmb.phi1) * Math.cos(ball.y * 0.024 + cmb.phi2)
                       + 0.5 * Math.sin(ball.x * 0.011 - ball.y * 0.017 + cmb.phi3);
            ball.vy -= CMB_FORCE * cmbT;
            if (g.frame % 6 === 0 && Math.abs(cmbT) > 0.4) pulseForceFx(ball, cmbT > 0 ? '#e8c8a0' : '#a8c8e0');
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

          // Reionization front: in-band drag + gentle downward push (no trap).
          if (g.reionY >= 0 && Math.abs(ball.y - g.reionY) < REION_BAND * 0.5) {
            ball.vx *= REION_DRAG_X;
            ball.vy += REION_PUSH_Y;
            const rspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (rspd > 0 && rspd < REION_MIN_SPD) {
              const sc = REION_MIN_SPD / rspd; ball.vx *= sc; ball.vy *= sc;
            }
            if (g.frame % 4 === 0) {
              ball.fxTrail = 4;
              ball.fxTrailColor = '#7b5cff';
            }
          }

          // Pulsar: balls caught in either radiation beam get pushed outward along it.
          for (const pu of g.pulsars) {
            const pdx = ball.x - pu.x, pdy = ball.y - pu.y;
            const pd2 = pdx * pdx + pdy * pdy;
            if (pd2 >= pu.beamLen * pu.beamLen || pd2 === 0) continue;
            if ((pu.beams ?? 2) === 3) {
              // Tri-beam variant: three ONE-WAY beams at 120° (along must be positive —
              // each ray only pushes down its own arm; same per-beam force as the twin).
              for (let k = 0; k < 3; k++) {
                const ba  = pu.angle + k * (Math.PI * 2 / 3);
                const bux = Math.cos(ba), buy = Math.sin(ba);
                const along = pdx * bux + pdy * buy;
                if (along <= 0) continue;
                const perp = Math.abs(pdx * buy - pdy * bux);
                if (perp > PULSAR_BEAM_HALF) continue;
                const pf = PULSAR_FORCE * (1 - along / pu.beamLen);
                ball.vx += bux * pf;
                ball.vy += buy * pf;
              }
              continue;
            }
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
            pulseTwistFx(ball);
          }

          // Gravitational wave memory: one kick on band entry + weak residual bias.
          for (const gwm of g.gravWaveMemories) {
            if (gwm.radius < 0) continue;
            const mdx = ball.x - gwm.ex, mdy = ball.y - gwm.ey;
            const md = Math.sqrt(mdx * mdx + mdy * mdy);
            const inBand = Math.abs(md - gwm.radius) <= GWM_BAND;
            if (!inBand) { gwm.passingBalls.delete(ball); continue; }
            if (!gwm.passingBalls.has(ball)) {
              gwm.passingBalls.add(ball);
              const kC = Math.cos(GWM_KICK), kS = Math.sin(GWM_KICK);
              const kvx = ball.vx * kC - ball.vy * kS;
              ball.vy = ball.vx * kS + ball.vy * kC;
              ball.vx = kvx;
              const inv = md > 0.5 ? 1 / md : 0;
              g.gwMemories.set(ball, { remain: GWM_MEM_DUR, bx: mdx * inv, by: mdy * inv });
              pulseTwistFx(ball);
              ball.fxTrail = 8;
              ball.fxTrailColor = '#9aa8c0';
            }
          }
          {
            const mem = g.gwMemories.get(ball);
            if (mem && mem.remain > 0) {
              ball.vx += GWM_BIAS * mem.bx;
              ball.vy += GWM_BIAS * mem.by;
              mem.remain--;
              if (mem.remain <= 0) g.gwMemories.delete(ball);
              else if (g.frame % 3 === 0) {
                ball.fxTrail = 3;
                ball.fxTrailColor = '#9aa8c0';
              }
            }
          }

          // Gravitational wave background: the polar opposite of the wavefront ripple above —
          // no band, no position check, applies to every ball every frame. A constant tiny
          // speed-preserving rotation (never an acceleration), so it can never stall a ball;
          // it only ever makes long shots harder to predict, never impossible.
          if (g.gwBackgroundActive) {
            const gwbIdx  = ballIdx;
            const gwbAmp  = GWB_BASE_AMP + Math.max(0, g.level - 64) * GWB_AMP_PER_LV;
            const gwbTh   = gwbAmp * Math.sin(g.frame * 0.07 + gwbIdx * 2.1);
            const gwbCos  = Math.cos(gwbTh), gwbSin = Math.sin(gwbTh);
            const gwbNvx  = ball.vx * gwbCos - ball.vy * gwbSin;
            ball.vy       = ball.vx * gwbSin + ball.vy * gwbCos;
            ball.vx       = gwbNvx;
            if (g.frame % 8 === 0) pulseTwistFx(ball);
          }

          // Alens lensing anomaly field: same speed-preserving micro-twist family as gw
          // background, but Tier-4 tell is the ball twist FX (board spokes are near-invisible).
          if (g.alensActive) {
            const alensAmp = Math.min(
              ALENS_AMP_MAX,
              ALENS_BASE_AMP + Math.max(0, g.level - 133) * ALENS_AMP_PER_LV,
            );
            const dTh = alensAmp * Math.sin(g.frame * 0.05 + ballIdx * 2.1);
            const ac = Math.cos(dTh), as = Math.sin(dTh);
            const nvx = ball.vx * ac - ball.vy * as;
            ball.vy = ball.vx * as + ball.vy * ac;
            ball.vx = nvx;
            ball.fxTwist = Math.max(ball.fxTwist, ALENS_FX_FLOOR);
          }

          // Hellings-Downs correlation hum: twist amplitude tracks angular separation from
          // the oldest living ball (not a global in-phase hum like gwBackground).
          if (g.hdHumActive && g.balls.length >= 2) {
            const ref = g.balls[0];
            const rcx = W * 0.5, rcy = H * 0.5;
            const a0 = Math.atan2(ref.y - rcy, ref.x - rcx);
            const a1 = Math.atan2(ball.y - rcy, ball.x - rcx);
            let dAng = a1 - a0;
            if (dAng > Math.PI) dAng -= Math.PI * 2;
            if (dAng < -Math.PI) dAng += Math.PI * 2;
            const hd = hellingsDowns(Math.abs(dAng));
            const hdAmp = Math.min(
              HD_AMP_MAX,
              HD_BASE_AMP + Math.max(0, g.level - 156) * HD_AMP_PER_LV,
            );
            const dTh = hdAmp * hd * Math.sin(g.frame * 0.04 + ballIdx * 1.3);
            const hc = Math.cos(dTh), hs = Math.sin(dTh);
            const nvx = ball.vx * hc - ball.vy * hs;
            ball.vy = ball.vx * hs + ball.vy * hc;
            ball.vx = nvx;
            ball.fxTwist = Math.max(ball.fxTwist, HD_FX_FLOOR);
          }

          // Blue-tilted primordial hum: twist frequency rises with depth (y/H) — a blue spectrum.
          if (g.blueHumActive) {
            const omega = BLUEHUM_W0 + BLUEHUM_W_SLOPE * (ball.y / H);
            const dTh = BLUEHUM_AMP * Math.sin(g.frame * omega + ballIdx);
            const bc = Math.cos(dTh), bs = Math.sin(dTh);
            const nvx = ball.vx * bc - ball.vy * bs;
            ball.vy = ball.vx * bs + ball.vy * bc;
            ball.vx = nvx;
            pulseTwistFx(ball);
          }

          // Isotropic cosmic birefringence: constant handedness micro-twist (ACT β motif).
          if (g.isoBireActive) {
            const dTh = g.isoBireBeta;
            const bc = Math.cos(dTh), bs = Math.sin(dTh);
            const nvx = ball.vx * bc - ball.vy * bs;
            ball.vy = ball.vx * bs + ball.vy * bc;
            ball.vx = nvx;
            pulseTwistFx(ball);
          }

          // Big Ring uLSS: tangential-only current in a thin band around a hollow ring.
          // Interior (dist < r-halfW) and exterior outside the band feel nothing — no radial.
          for (const br of g.bigRings) {
            const brdx = ball.x - br.cx, brdy = ball.y - br.cy;
            const brdist2 = brdx * brdx + brdy * brdy;
            if (brdist2 === 0) continue;
            const brdist = Math.sqrt(brdist2);
            const brBand = Math.abs(brdist - br.r);
            if (brBand >= br.halfW) continue;
            const brt = 1 - brBand / br.halfW;
            const brf = BIGRING_FORCE * brt * brt;
            ball.vx += (-brdy / brdist) * brf * br.dir;
            ball.vy += ( brdx / brdist) * brf * br.dir;
            const brSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (brSpd > BALL_SPEED * 2) {
              const sc = BALL_SPEED * 2 / brSpd;
              ball.vx *= sc;
              ball.vy *= sc;
            }
            pulseForceFx(ball, '#4a8a9a');
          }

          // Cosmic shear field: weak-lensing alignment depends on the ball's current heading,
          // not on attraction to the ellipse centre. A rotation matrix preserves speed exactly.
          for (const cs of g.cosmicShears) {
            const ca = Math.cos(cs.axis), sa = Math.sin(cs.axis);
            const cdx = ball.x - cs.x, cdy = ball.y - cs.y;
            const cu = (ca * cdx + sa * cdy) / cs.rx;
            const cv = (-sa * cdx + ca * cdy) / cs.ry;
            const cr2 = cu * cu + cv * cv;
            if (cr2 >= 1) continue;
            const speed2 = ball.vx * ball.vx + ball.vy * ball.vy;
            if (speed2 < 1e-8) continue;
            const ct = 1 - Math.sqrt(cr2);
            const heading = Math.atan2(ball.vy, ball.vx);
            const dTheta = -CSHEAR_ROT * Math.sin(2 * (heading - cs.axis)) * ct * ct;
            const rc = Math.cos(dTheta), rs = Math.sin(dTheta);
            const nvx = ball.vx * rc - ball.vy * rs;
            ball.vy = ball.vx * rs + ball.vy * rc;
            ball.vx = nvx;
            if (g.frame % 8 === 0) pulseTwistFx(ball);
          }

          // Intrinsic alignment contaminant: false shear — headings nudge toward a fixed axis.
          for (const ia of g.iaContams) {
            const ca = Math.cos(ia.axis), sa = Math.sin(ia.axis);
            const idx = ball.x - ia.x, idy = ball.y - ia.y;
            const iu = (ca * idx + sa * idy) / ia.rx;
            const iv = (-sa * idx + ca * idy) / ia.ry;
            if (iu * iu + iv * iv >= 1) continue;
            const speed2 = ball.vx * ball.vx + ball.vy * ball.vy;
            if (speed2 < 1e-8) continue;
            const heading = Math.atan2(ball.vy, ball.vx);
            const dTheta = IACONT_ROT * Math.sin(2 * (heading - ia.axis));
            const rc = Math.cos(dTheta), rs = Math.sin(dTheta);
            const nvx = ball.vx * rc - ball.vy * rs;
            ball.vy = ball.vx * rs + ball.vy * rc;
            ball.vx = nvx;
            if (g.frame % 6 === 0) pulseTwistFx(ball);
          }

          // Multiplicative shear bias: speed-only miscalibration (heading unchanged).
          for (const mb of g.mBiasVeils) {
            if (g.frame % MBIAS_PERIOD !== 0) continue;
            const ca = Math.cos(mb.axis), sa = Math.sin(mb.axis);
            const dx = ball.x - mb.x, dy = ball.y - mb.y;
            const u = (ca * dx + sa * dy) / mb.rx;
            const v = (-sa * dx + ca * dy) / mb.ry;
            if (u * u + v * v >= 1) continue;
            ball.vx *= (1 + mb.m);
            ball.vy *= (1 + mb.m);
            const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (spd > 1e-8 && spd < effMinSpeed) {
              const sc = effMinSpeed / spd;
              ball.vx *= sc; ball.vy *= sc;
            }
            pulseForceFx(ball, '#687888');
          }

          // Silk damping cloud: damp only the short-axis velocity component inside the
          // ellipse. Long-axis speed is preserved; gravity is applied separately as usual.
          for (const silk of g.silkDampingClouds) {
            const ca = Math.cos(silk.axis), sa = Math.sin(silk.axis);
            const sdx = ball.x - silk.x, sdy = ball.y - silk.y;
            const su = (ca * sdx + sa * sdy) / silk.rx;
            const sv = (-sa * sdx + ca * sdy) / silk.ry;
            if (su * su + sv * sv >= 1) continue;
            const along = ball.vx * ca + ball.vy * sa;
            const across = -ball.vx * sa + ball.vy * ca;
            const newAcross = across * SILK_ACROSS;
            ball.vx = along * ca - newAcross * sa;
            ball.vy = along * sa + newAcross * ca;
            const silkSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (silkSpd < SILK_MIN_SPD) { const sc = SILK_MIN_SPD / silkSpd; ball.vx *= sc; ball.vy *= sc; }
            if (Math.abs(across) > 0.08 && g.frame % 4 === 0) {
              ball.fxTrail = 3;
              ball.fxTrailColor = (g.frame >> 2) % 2 === 0 ? '#b67a2e' : '#607fa8';
            }
          }

          // Quantum Foam: inside the region, rotate velocity by a tiny deterministic noise
          // each frame (speed-preserving). Average rotation is zero so the ball statistically
          // keeps going — it just jitters like spacetime at the Planck scale.
          for (const qf of g.quantumFoams) {
            const qdx = ball.x - qf.x, qdy = ball.y - qf.y;
            if (qdx * qdx + qdy * qdy >= QF_RANGE * QF_RANGE) continue;
            const qfIdx = ballIdx;
            const qfTh  = QF_ROT_AMP * Math.sin(g.frame * 0.31 + qfIdx * 1.7);
            const qfC = Math.cos(qfTh), qfS = Math.sin(qfTh);
            const qfNvx = ball.vx * qfC - ball.vy * qfS;
            ball.vy     = ball.vx * qfS + ball.vy * qfC;
            ball.vx     = qfNvx;
            if (g.frame % 6 === 0) pulseTwistFx(ball);
          }

          // Neutrino flavor oscillation: ellipse-gated speed-preserving rotation whose
          // phase mixes "flavors" (mean rotation zero; short-term path wiggles).
          for (const nu of g.neutrinoOscillations) {
            const na = Math.cos(nu.axis), ns = Math.sin(nu.axis);
            const ndx = ball.x - nu.x, ndy = ball.y - nu.y;
            const nuu = (na * ndx + ns * ndy) / nu.rx;
            const nuv = (-ns * ndx + na * ndy) / nu.ry;
            if (nuu * nuu + nuv * nuv >= 1) continue;
            const nIdx = ballIdx;
            const nTh = NEUT_AMP * Math.sin(g.frame * NEUT_FREQ + nIdx * NEUT_PHASE);
            const nc = Math.cos(nTh), nsn = Math.sin(nTh);
            const nnvx = ball.vx * nc - ball.vy * nsn;
            ball.vy = ball.vx * nsn + ball.vy * nc;
            ball.vx = nnvx;
            if (g.frame % 8 === 0) pulseTwistFx(ball);
          }

          // Fuzzy dark matter soliton: tangential interference beat (radial force = 0).
          for (const fdm of g.fuzzySolitons) {
            const fa = Math.cos(fdm.axis), fs = Math.sin(fdm.axis);
            const fdx = ball.x - fdm.x, fdy = ball.y - fdm.y;
            const fu = (fa * fdx + fs * fdy) / fdm.rx;
            const fv = (-fs * fdx + fa * fdy) / fdm.ry;
            if (fu * fu + fv * fv >= 1) continue;
            const theta = Math.atan2(fdy, fdx);
            const tx = -Math.sin(theta), ty = Math.cos(theta);
            const fIdx = ballIdx;
            const psi = FDM_K * theta + g.frame * FDM_BEAT_FREQ + fIdx * 1.7;
            const beat = FDM_BEAT_AMP * Math.sin(psi);
            ball.vx += beat * tx;
            ball.vy += beat * ty;
            const fspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (fspd > BALL_SPEED * 2) {
              const sc = BALL_SPEED * 2 / fspd;
              ball.vx *= sc;
              ball.vy *= sc;
            }
            if (g.frame % 8 === 0) {
              ball.fxTrail = 4;
              ball.fxTrailColor = '#5eb89a';
            }
          }

          // Axion microlens: tangential sin interference (no radial pull).
          for (const ax of g.axionMicrolenses) {
            const adx = ball.x - ax.x, ady = ball.y - ax.y;
            const ad2 = adx * adx + ady * ady;
            if (ad2 >= AXION_RANGE * AXION_RANGE || ad2 === 0) continue;
            const ad = Math.sqrt(ad2);
            const at = 1 - ad / AXION_RANGE;
            const aIdx = ballIdx;
            const asign = Math.sin(g.frame * 0.11 + aIdx * 2.1);
            const af = AXION_FORCE * at * at * asign;
            const tx = -ady / ad, ty = adx / ad;
            ball.vx += af * tx;
            ball.vy += af * ty;
            const aspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (aspd > BALL_SPEED * 2) {
              const sc = BALL_SPEED * 2 / aspd;
              ball.vx *= sc;
              ball.vy *= sc;
            }
            if (Math.abs(asign) > 0.7) {
              ball.fxTrail = 2;
              ball.fxTrailColor = '#5868c0';
            }
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
              pulseTwistFx(ball);
              ball.bfSide = cbSide;
            }
          }

          // Holographic RG sheet: OBB midplane crossing adjusts rgLayer; exit resets.
          for (const hs of g.holographicRGSheets) {
            const hc = Math.cos(hs.angle), hsn = Math.sin(hs.angle);
            const hdx = ball.x - hs.x, hdy = ball.y - hs.y;
            const hlx = hc * hdx + hsn * hdy;
            const hly = -hsn * hdx + hc * hdy;
            if (Math.abs(hlx) > HOLO_LEN * 0.5 || Math.abs(hly) > HOLO_THICK * 0.5) {
              g.holoSides.delete(ball);
              ball.rgLayer = 0;
              continue;
            }
            const hSide = hly >= 0 ? 1 : -1;
            const prev = g.holoSides.get(ball) ?? 0;
            if (prev === 0) {
              g.holoSides.set(ball, hSide);
            } else if (hSide !== prev) {
              if (prev === 1) ball.rgLayer = Math.min(3, ball.rgLayer + 1);
              else ball.rgLayer = Math.max(0, ball.rgLayer - 1);
              hs.hitFlash = HOLO_FLASH;
              hs.hitX = ball.x;
              hs.hitY = ball.y;
              hs.hitAngle = hs.angle;
              g.holoSides.set(ball, hSide);
            }
          }

          // Phantom Crossing Membrane: OBB band. Midline cross flips wSign; continuous
          // weak force toward (wSign>0) or away from (wSign<0) the midline while inside.
          for (const pm of g.phantomMembranes) {
            const pc = Math.cos(pm.angle), ps = Math.sin(pm.angle);
            const pdx = ball.x - pm.cx, pdy = ball.y - pm.cy;
            const plx = pc * pdx + ps * pdy;
            const ply = -ps * pdx + pc * pdy;
            // thick is half-thickness — outside OBB resets side tracking for re-entry.
            if (Math.abs(plx) > pm.len * 0.5 || Math.abs(ply) > pm.thick) {
              ball.phantomSide = 0;
              continue;
            }
            const pSide = ply >= 0 ? 1 : -1;
            if (ball.phantomSide === 0) {
              ball.phantomSide = pSide;
            } else if (pSide !== ball.phantomSide) {
              ball.wSign *= -1;
              pm.flashTimer = PHANTOM_CROSS_FX;
              pulseTwistFx(ball);
              ball.phantomSide = pSide;
            }
            // Continuous band force: t from distance to midline within half-thickness.
            const ad = Math.abs(ply);
            if (ad > 0.01) {
              const t = 1 - ad / pm.thick;
              const f = PHANTOM_FORCE * t * t;
              // local +Y unit in world = (-sin, cos)
              const nx = -ps, ny = pc;
              // wSign>0: toward midline (oppose ply); wSign<0: away (along ply)
              const dir = (ball.wSign > 0 ? -1 : 1) * pSide;
              ball.vx += nx * dir * f;
              ball.vy += ny * dir * f;
              ball.fxTrail = 2;
              ball.fxTrailColor = ball.wSign > 0 ? '#c89040' : '#5a2878';
            }
          }

          // Planck diffraction grating: pass-through sheet; on far-side crossing, snap velocity
          // to the nearest of five discrete diffraction orders (speed preserved).
          for (const pdg of g.planckGratings) {
            const pc = Math.cos(pdg.angle), ps = Math.sin(pdg.angle);
            const pdx = ball.x - pdg.x, pdy = ball.y - pdg.y;
            const plx = pc * pdx + ps * pdy;
            const ply = -ps * pdx + pc * pdy;
            if (Math.abs(plx) > PDG_LEN * 0.5 || Math.abs(ply) > PDG_THICK * 0.5) {
              ball.pdgSide = 0;
              continue;
            }
            const pSide = ply >= 0 ? 1 : -1;
            if (ball.pdgSide === 0) {
              ball.pdgSide = pSide;
            } else if (pSide !== ball.pdgSide) {
              const q = quantizePdgVelocity(ball.vx, ball.vy, pdg.angle);
              ball.vx = q.vx; ball.vy = q.vy;
              pdg.hitFlash = PDG_FLASH; pdg.hitX = ball.x; pdg.hitY = ball.y; pdg.hitOrder = q.orderDeg;
              pulseTwistFx(ball);
              ball.pdgSide = pSide;
            }
          }

          // Vacuum Cherenkov domain: only balls above the speed threshold radiate and brake.
          for (const vc of g.vacuumCherenkovDomains) {
            const vdx = ball.x - vc.x, vdy = ball.y - vc.y;
            if (vdx * vdx + vdy * vdy >= VC_R * VC_R) continue;
            const vspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (vspd < VC_THRESH || ball.vcTimer > 0) continue;
            ball.vcTimer = VC_INTERVAL;
            const scale = Math.max(VC_MIN_SPD / vspd, VC_SCALE);
            ball.vx *= scale;
            ball.vy *= scale;
            const recoil = ball.vcFlip * VC_RECOIL;
            ball.vcFlip *= -1;
            const heading = Math.atan2(ball.vy, ball.vx);
            const newHeading = heading + recoil;
            const nspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            ball.vx = Math.cos(newHeading) * nspd;
            ball.vy = Math.sin(newHeading) * nspd;
            vc.burstTimer = VC_BURST_DUR;
            vc.burstX = ball.x; vc.burstY = ball.y;
            vc.burstVx = ball.vx; vc.burstVy = ball.vy;
            vc.burstFlip = ball.vcFlip;
            ball.fxTrail = 4;
            ball.fxTrailColor = '#6b3fc9';
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
            const lf = LRD_PULL_FORCE * (1 + hazardAgeBoost(g.level, 68, 0.45)) * lt * lt;
            ball.vx += (ldx / ldist) * lf;
            ball.vy += (ldy / ldist) * lf;
            if (g.frame % 5 === 0) pulseForceFx(ball, '#e85a3a');
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
            const pf = PBH_FORCE * (1 + hazardAgeBoost(g.level, 76, 0.3)) * pt * pt;
            ball.vx += (pdx / pd) * pf;
            ball.vy += (pdy / pd) * pf;
            if (g.frame % 4 === 0) {
              pulseForceFx(ball, '#a0a0f0');
              spawnBurst(g, ball.x, ball.y, 0, 0, '#6a6ad0');
            }
          }

          // Einstein cross: four lensed images pull with a weak vector sum (no absorption).
          for (const ec of g.einsteinCrosses) {
            for (const im of ec.images) {
              const edx = im.x - ball.x, edy = im.y - ball.y;
              const ed2 = edx * edx + edy * edy;
              if (ed2 >= ECROSS_RANGE * ECROSS_RANGE || ed2 === 0) continue;
              const ed = Math.sqrt(ed2);
              const et = 1 - ed / ECROSS_RANGE;
              const ef = ECROSS_PULL * et * et;
              ball.vx += (edx / ed) * ef;
              ball.vy += (edy / ed) * ef;
            }
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

          // Pop III.1 Flash: brief outward shove in ionization patches, then recombination drag.
          if (g.pop31Flash) {
            const fl = g.pop31Flash;
            if (fl.releaseTimer > 0) {
              for (const p of fl.patches) {
                const pdx = ball.x - p.x, pdy = ball.y - p.y;
                const pd2 = pdx * pdx + pdy * pdy;
                if (pd2 >= p.r * p.r || pd2 === 0) continue;
                const pd = Math.sqrt(pd2);
                const pt = 1 - pd / p.r;
                const pf = POP31_FORCE * pt * pt;
                ball.vx += (pdx / pd) * pf;
                ball.vy += (pdy / pd) * pf;
                ball.fxField = FX_FIELD_DUR;
                ball.fxFieldColor = '#c8d0ff';
              }
            } else if (fl.recombTimer > 0) {
              for (const p of fl.patches) {
                const pdx = ball.x - p.x, pdy = ball.y - p.y;
                if (pdx * pdx + pdy * pdy >= p.r * p.r) continue;
                ball.vx *= POP31_DRAG;
                ball.vy *= POP31_DRAG;
                ball.fxTrail = 3;
                ball.fxTrailColor = '#6a6878';
              }
            }
          }

          // Patchy kSZ: during release, add a fixed-axis kick inside each ellipse
          // (kinetic SZ wind — NOT outward from center). Soft speed clamp.
          for (const kp of g.kszPatches) {
            if (kp.releaseTimer <= 0) continue;
            const kdx = (ball.x - kp.cx) / kp.rx;
            const kdy = (ball.y - kp.cy) / kp.ry;
            if (kdx * kdx + kdy * kdy >= 1) continue;
            ball.vx += Math.cos(kp.axis) * KSZ_KICK;
            ball.vy += Math.sin(kp.axis) * KSZ_KICK;
            const kspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (kspd > BALL_SPEED * 2) {
              const sc = BALL_SPEED * 2 / kspd;
              ball.vx *= sc;
              ball.vy *= sc;
            }
            pulseFieldFx(ball, '#68b8d0');
            ball.fxTrail = 3;
            ball.fxTrailColor = '#68b8d0';
          }

          // Subsolar PBH echo: weak dual pulls while approaching (skipped during echo/dormant).
          if (spbh && spbh.phase === 0) {
            for (const [px, py] of [[spbh.x1, spbh.y1], [spbh.x2, spbh.y2]] as [number, number][]) {
              const dx = px - ball.x, dy = py - ball.y;
              const dist2 = dx * dx + dy * dy;
              if (dist2 >= SPBH_RANGE * SPBH_RANGE || dist2 < 1) continue;
              const dist = Math.sqrt(dist2);
              const t = 1 - dist / SPBH_RANGE;
              const f = SPBH_FORCE * t * t;
              ball.vx += (dx / dist) * f;
              ball.vy += (dy / dist) * f;
              if (g.frame % 5 === 0) pulseForceFx(ball, '#7a5048');
            }
          }

          // Black Hole Star cocoon: shell drag + tear outward pulse.
          for (const bh of g.bhStarCocoons) {
            const dx = ball.x - bh.x, dy = ball.y - bh.y;
            const dist2 = dx * dx + dy * dy;
            const dist = Math.sqrt(dist2) || 1;
            if (bh.tearTimer > 0 && dist2 < BHS_TEAR_R * BHS_TEAR_R) {
              const t = 1 - dist / BHS_TEAR_R;
              const f = BHS_TEAR_FORCE * t * t;
              ball.vx += (dx / dist) * f;
              ball.vy += (dy / dist) * f;
              const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
              if (spd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / spd; ball.vx *= sc; ball.vy *= sc; }
              pulseFieldFx(ball, '#c87060');
            } else if (dist >= BHS_SHELL_IN && dist <= BHS_SHELL_OUT) {
              ball.vx *= BHS_DRAG;
              ball.vy *= BHS_DRAG;
              if (g.frame % 5 === 0) pulseForceFx(ball, '#a86840');
            }
          }

          // Runaway SMBH bow shock: V-band push ahead of tip + cooling drag in the wake.
          // No solid bounce / no absorption. Motion advances in the draw block.
          for (const rb of g.runawaySMBHs) {
            if (rb.respawnTimer > 0) continue;
            const rspd = Math.sqrt(rb.vx * rb.vx + rb.vy * rb.vy);
            if (rspd === 0) continue;
            const hx = rb.vx / rspd, hy = rb.vy / rspd;
            const px = -hy, py = hx;
            const rx = ball.x - rb.x, ry = ball.y - rb.y;
            const along = rx * hx + ry * hy;
            const across = rx * px + ry * py;
            // Bow: V-shaped band ahead of tip.
            if (along > 0 && along < RBHS_BOW_LEN) {
              const half = RBHS_BOW_HALF * (1 - along / RBHS_BOW_LEN);
              if (Math.abs(across) < half) {
                const tAlong = 1 - along / RBHS_BOW_LEN;
                const tAcross = half > 0 ? 1 - Math.abs(across) / half : 0;
                const t = tAlong * tAcross;
                const f = RBHS_BOW_FORCE * t * t;
                ball.vx += hx * f;
                ball.vy += hy * f;
                pulseTwistFx(ball);
                const bspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (bspd > BALL_SPEED * 2) {
                  const sc = BALL_SPEED * 2 / bspd;
                  ball.vx *= sc; ball.vy *= sc;
                }
              }
            }
            // Wake: rectangle behind tip along -heading (cooling entrainment).
            if (along < 0 && along > -RBHS_WAKE_LEN && Math.abs(across) < RBHS_WAKE_HALF) {
              ball.vx *= RBHS_WAKE_DRAG;
              ball.vy *= RBHS_WAKE_DRAG;
              ball.fxTrail = 4;
              ball.fxTrailColor = '#2a9a8a';
            }
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
            const hf = dh.strength * (1 + hazardAgeBoost(g.level, 48, 0.35)) * ht * ht;
            ball.vx += (hdx / hd) * hf;
            ball.vy += (hdy / hd) * hf;
            if (g.frame % 4 === 0) pulseForceFx(ball, '#8a96d8');
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
            pulseTwistFx(ball);
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

          // Quantum Zeno: after other continuous forces, observation duty scales velocity.
          {
            const observing = Math.sin(g.frame * ZENO_DUTY_FREQ) > 0;
            if (observing) {
              for (const zeno of g.quantumZenoSectors) {
                const za = Math.cos(zeno.axis), zs = Math.sin(zeno.axis);
                const zdx = ball.x - zeno.x, zdy = ball.y - zeno.y;
                const zu = (za * zdx + zs * zdy) / zeno.rx;
                const zv = (-zs * zdx + za * zdy) / zeno.ry;
                if (zu * zu + zv * zv >= 1) continue;
                ball.vx *= ZENO_SCALE;
                ball.vy *= ZENO_SCALE;
                break;
              }
            }
          }

          // Trans-solar chirp: board-wide speed-amplitude modulation (direction preserved).
          if (g.chirpBinary) {
            const chirpPhase = g.chirpBinary.timer / g.chirpBinary.period;
            const amp = 1 + CHIRP_AMP * Math.sin(chirpPhase * Math.PI * CHIRP_HARM);
            ball.vx *= amp;
            ball.vy *= amp;
            const cspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (cspd > BALL_SPEED * 2) {
              const sc = BALL_SPEED * 2 / cspd;
              ball.vx *= sc;
              ball.vy *= sc;
            }
            if (Math.abs(amp - 1) > 0.02) {
              ball.fxTrail = 4;
              ball.fxTrailColor = '#1a8898';
            }
          }

          // Holographic RG: per-frame velocity scale from rgLayer (after other continuous forces).
          if (ball.rgLayer > 0) {
            const hscale = 1 - ball.rgLayer * HOLO_SCALE_STEP;
            ball.vx *= hscale;
            ball.vy *= hscale;
            // Minimal field tell while scale is applying (draw FX only; no physics change).
            if (g.frame % 8 === 0) {
              ball.fxTrail = 3;
              ball.fxTrailColor = '#d0d4e0';
              pulseTwistFx(ball);
            }
          }

          // Mass-horizon entropic drag: board-wide distance-proportional continuous slowdown.
          if (g.entropicDragActive) {
            const ecx = g.W / 2, ecy = g.H * 0.42;
            const edx = ball.x - ecx, edy = ball.y - ecy;
            const edist = Math.sqrt(edx * edx + edy * edy);
            const eH = Math.min(ENTROPIC_H_MAX, ENTROPIC_H0 + g.frame * ENTROPIC_H_RAMP);
            const escale = Math.max(ENTROPIC_FLOOR, 1 - eH * edist / g.W);
            ball.vx *= escale;
            ball.vy *= escale;
          }

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
                emr.hitFlash    = 3;
                emr.shockTimer  = EMR_SHOCK_DUR;
                emr.shockX      = ball.x;
                emr.shockY      = ball.y;
                emr.ghostFlash  = 10;
                emr.ghostX      = 2 * emr.x - ball.x;
                emr.ghostY      = 2 * emr.y - ball.y;
                pulseTwistFx(ball);
                spawnBurst(g, ball.x, ball.y, ball.vx * 0.3, ball.vy * 0.3, '#d8dce8');
              }

              // Wormhole teleportation (inside sub-step to catch thin bars at high speed).
              // Physics hitbox uses aura dimensions (w+32, h=44) so the full visible
              // cloud area is interactive. cycleTimer is not checked so balls can always
              // teleport regardless of the visual fade phase.
              for (const wh of g.wormholes) {
                if (wh.hitCool > 0) continue;
                if (!testBallOBB(ball, wh.cx, wh.cy, wh.w + 32, 44, wh.angle)) continue;
                // Exit is the NEXT slot in the chain (cyclic). For a plain pair this is
                // simply "the other mouth"; the lv47+ triple gives a one-way A→B→C→A ride.
                const partner = g.wormholes.find(
                  o => o.pairId === wh.pairId && o.pairSlot === (wh.pairSlot + 1) % (wh.chainLen ?? 2)
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

              // Collisionless shock: crossing a V-arm refracts the ball forward (tangent
              // preserved, normal boosted toward travel direction). No bounce or absorption.
              if (!teleported) for (const cls of g.collisionlessShocks) {
                if (cls.respawnTimer > 0) continue;
                const hang = Math.atan2(cls.vy, cls.vx);
                const armAngles = [hang + Math.PI - cls.armSpread, hang + Math.PI + cls.armSpread];
                let nearAny = false;
                for (const armAng of armAngles) {
                  const ac = Math.cos(armAng), as = Math.sin(armAng);
                  const ex = cls.x + ac * cls.armLen, ey = cls.y + as * cls.armLen;
                  const prox = ballSegmentProximity(ball.x, ball.y, cls.x, cls.y, ex, ey, BALL_R + CLS_HALF);
                  if (!prox) continue;
                  nearAny = true;
                  if (cls.passingBalls.has(ball)) continue;
                  cls.passingBalls.add(ball);
                  let nx = -prox.ty, ny = prox.tx;
                  if (nx * cls.vx + ny * cls.vy < 0) { nx = -nx; ny = -ny; }
                  const vn = ball.vx * nx + ball.vy * ny;
                  const vtx = ball.vx - vn * nx, vty = ball.vy - vn * ny;
                  const newVn = Math.abs(vn) * CLS_VN_MULT + CLS_VN_BIAS;
                  ball.vx = vtx + nx * newVn;
                  ball.vy = vty + ny * newVn;
                  const cspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                  if (cspd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / cspd; ball.vx *= sc; ball.vy *= sc; }
                  else if (cspd < effMinSpeed) { const sc = effMinSpeed / cspd; ball.vx *= sc; ball.vy *= sc; }
                  cls.hitFlash = 8; cls.hitX = prox.cx; cls.hitY = prox.cy;
                  spawnBurst(g, prox.cx, prox.cy, cls.vx * 0.12, cls.vy * 0.12, '#2764c4');
                  spawnBurst(g, prox.cx, prox.cy, 0, 0, '#f05a8a');
                  break;
                }
                if (!nearAny) cls.passingBalls.delete(ball);
              }

              // Gravitational caustic: first entry into the fold-line band amplifies the
              // bright-side normal velocity once (tangent preserved). No bounce/absorption.
              if (!teleported) for (const gc of g.gravitationalCaustics) {
                const prox = closestOnPolyline(ball.x, ball.y, gc.pts);
                const inside = prox.dist < CAUSTIC_HALFW + BALL_R;
                if (!inside) { gc.passingBalls.delete(ball); continue; }
                if (gc.passingBalls.has(ball)) continue;
                gc.passingBalls.add(ball);
                let nx = -prox.ty * gc.brightSide, ny = prox.tx * gc.brightSide;
                const vn = ball.vx * nx + ball.vy * ny;
                const vtx = ball.vx - vn * nx, vty = ball.vy - vn * ny;
                const newVn = Math.abs(vn) * CAUSTIC_AMP;
                ball.vx = vtx + nx * newVn;
                ball.vy = vty + ny * newVn;
                const cspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (cspd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / cspd; ball.vx *= sc; ball.vy *= sc; }
                else if (cspd > 0 && cspd < effMinSpeed) { const sc = effMinSpeed / cspd; ball.vx *= sc; ball.vy *= sc; }
                gc.hitFlash = CAUSTIC_FLASH; gc.hitX = prox.cx; gc.hitY = prox.cy;
                spawnBurst(g, prox.cx, prox.cy, nx * 0.4, ny * 0.4, '#d4b85a');
              }

              // FRB microlens IMBH: thin arc caustic — along-heading kick + twist once per approach.
              if (!teleported) for (const ml of g.frbMicrolenses) {
                const mdx = ball.x - ml.x, mdy = ball.y - ml.y;
                const mdist = Math.sqrt(mdx * mdx + mdy * mdy) || 1;
                const band = Math.abs(mdist - FRBML_R);
                let dang = Math.atan2(mdy, mdx) - ml.ang0;
                while (dang > Math.PI) dang -= Math.PI * 2;
                while (dang < -Math.PI) dang += Math.PI * 2;
                const inside = band < FRBML_HALF + BALL_R && Math.abs(dang) < FRBML_SPAN * 0.5;
                if (!inside) { ml.passingBalls.delete(ball); continue; }
                if (ml.passingBalls.has(ball)) continue;
                ml.passingBalls.add(ball);
                const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) || 1;
                const hx = ball.vx / spd, hy = ball.vy / spd;
                ball.vx += hx * FRBML_KICK;
                ball.vy += hy * FRBML_KICK;
                const twist = dang >= 0 ? FRBML_TWIST : -FRBML_TWIST;
                const tc = Math.cos(twist), ts = Math.sin(twist);
                const ovx = ball.vx, ovy = ball.vy;
                ball.vx = ovx * tc - ovy * ts;
                ball.vy = ovx * ts + ovy * tc;
                const nspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (nspd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / nspd; ball.vx *= sc; ball.vy *= sc; }
                else if (nspd > 0 && nspd < effMinSpeed) { const sc = effMinSpeed / nspd; ball.vx *= sc; ball.vy *= sc; }
                ml.flashTimer = FRBML_FLASH;
                pulseTwistFx(ball);
                pulseForceFx(ball, '#c8b090');
                spawnBurst(g, ball.x, ball.y, hx, hy, '#c8b090');
              }

              // Boson star soft caustic: interior inert; thin rim folds heading once (no reflect).
              if (!teleported) for (const bc of g.bosonCaustics) {
                const bdx = ball.x - bc.x, bdy = ball.y - bc.y;
                const bdist = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
                const band = Math.abs(bdist - BOSON_R);
                const onRim = band < BOSON_HALF + BALL_R;
                if (!onRim) { bc.passingBalls.delete(ball); continue; }
                if (bc.passingBalls.has(ball)) continue;
                bc.passingBalls.add(ball);
                const cross = bdx * ball.vy - bdy * ball.vx;
                const fold = cross >= 0 ? BOSON_FOLD : -BOSON_FOLD;
                const fc = Math.cos(fold), fs = Math.sin(fold);
                const ovx = ball.vx, ovy = ball.vy;
                ball.vx = ovx * fc - ovy * fs;
                ball.vy = ovx * fs + ovy * fc;
                bc.ghostTimer = BOSON_GHOST;
                bc.ghostX = bc.x + (cross >= 0 ? 2 : -2);
                bc.ghostY = bc.y;
                pulseTwistFx(ball);
                pulseForceFx(ball, '#b8a878');
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
                cs.hitFlash   = 4;
                cs.ghostFlash = 8;
                pulseFieldFx(ball, '#fffaf0');
                spawnBurst(g, ball.x, ball.y, 0, 0, '#fffaf0');
                teleported = true;
                break;
              }
              // Catastrophic photo-z gate: first entry rolls a position-seeded 20% depth jump
              // along the travel direction (velocity unchanged). Non-outliers pass through.
              if (!teleported) for (const pz of g.photoZGates) {
                const inside = testBallOBB(ball, pz.x, pz.y, PHOTOZ_LEN, PHOTOZ_HALF * 2, pz.angle);
                if (!inside) { pz.passingBalls.delete(ball); continue; }
                if (pz.passingBalls.has(ball)) continue;
                pz.passingBalls.add(ball);
                // Deterministic hash from entry position (not frame) → outlier or clean pass.
                const hx = Math.floor(ball.x * 1000) | 0;
                const hy = Math.floor(ball.y * 1000) | 0;
                const h = (Math.imul(hx ^ Math.imul(hy, 1597334677), 2654435761) >>> 0) / 4294967296;
                if (h < PHOTOZ_RATE) {
                  const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) || 1;
                  const sign = ((hx ^ hy) & 1) === 0 ? 1 : -1;
                  ball.x += (ball.vx / spd) * PHOTOZ_SHIFT * sign;
                  ball.y += (ball.vy / spd) * PHOTOZ_SHIFT * sign;
                  ball.x = Math.max(BALL_R, Math.min(W - BALL_R, ball.x));
                  ball.y = Math.max(BALL_R, Math.min(H - 40, ball.y));
                  pz.flashTimer = 8;
                  pulseFieldFx(ball, '#787068');
                  teleported = true;
                  break;
                }
              }
              if (teleported) break;
            }
          }

          // Peg collision
          // Pair-production births a fresh blue on clear; collect them here and push after
          // the loop so we never mutate g.pegs while iterating it.
          const pairSpawns: Peg[] = [];
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

            if (g.cosmicDarkAgesActive) cdaReveal(g, peg.x, peg.y);

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
              }
            } else if (peg.type === 'shield') {
              peg.hitCool = HIT_COOL;
              peg.hp = (peg.hp ?? SHIELD_HP) - 1;
              if (peg.hp <= 0) {
                spawnPegBreak(g, peg);
                peg.cleared = true;
                g.score += 30;
                if (peg.bossArmor) goldArmorRefill(peg);
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
            } else if (peg.type === 'freeze') {
              spawnPegBreak(g, peg);
              peg.cleared = true;
              peg.hitCool = HIT_COOL;
              spawnFreezeBurst(g, peg.x, peg.y);
              // Shatter sprays ice in a radius — every live ball inside freezes and slows.
              const fr2 = FREEZE_RADIUS * FREEZE_RADIUS;
              for (const b of g.balls) {
                if (b.y > g.H + 40) continue;
                const fdx = b.x - peg.x, fdy = b.y - peg.y;
                if (fdx * fdx + fdy * fdy <= fr2) applyFreezeToBall(b);
              }
              g.score += 20;
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
            } else if (peg.type === 'neutron') {
              // 2-hit heavy damper. Each hit cuts speed AND opens a drag window: neutronTimer
              // lowers effMinSpeed to BALL_SPEED*NEUTRON_SLOW for NEUTRON_DUR frames, so the
              // slow actually lingers (the shared clamp above uses the stale pre-hit floor, so
              // we clamp to the neutron floor directly here instead of re-clamping up to it).
              peg.hitCool = HIT_COOL;
              ball.neutronTimer = NEUTRON_DUR;
              ball.vx *= NEUTRON_DAMP; ball.vy *= NEUTRON_DAMP;
              const nFloor = BALL_SPEED * NEUTRON_SLOW;
              const nspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) || 1;
              if (nspd < nFloor) { const sc = nFloor / nspd; ball.vx *= sc; ball.vy *= sc; }
              peg.hp = (peg.hp ?? NEUTRON_HP) - 1;
              if (peg.hp <= 0) {
                spawnPegBreak(g, peg);
                peg.cleared = true;
                g.score += NEUTRON_SCORE;
              } else {
                spawnBurst(g, peg.x, peg.y, 0, 0, '#9aa0b0');
              }
            } else if (peg.type === 'pair') {
              // Clearing it births one fresh blue nearby (deferred — see pairSpawns flush).
              spawnPegBreak(g, peg);
              peg.cleared = true;
              peg.hitCool = HIT_COOL;
              g.score += PAIR_SCORE;
              pairSpawns.push(peg);
            } else if (peg.type === 'entangle') {
              // Spooky action: the partner sharing this entangleId vanishes at the same
              // instant. Cleared inline (never re-enters this branch) so no loop / double count.
              spawnPegBreak(g, peg);
              peg.cleared = true;
              peg.hitCool = HIT_COOL;
              g.score += ENTANGLE_SCORE;
              const partner = peg.entanglePartner;
              if (partner && !partner.cleared) {
                spawnPegBreak(g, partner);
                partner.cleared = true;
                partner.hitCool = HIT_COOL;
                spawnBurst(g, partner.x, partner.y, 6, 6, '#8a78d8');
                g.score += ENTANGLE_SCORE;
              }
            } else if (peg.type === 'redshift') {
              // Score bleeds away over the level's elapsed frames — hit it early for full value.
              spawnPegBreak(g, peg);
              peg.cleared = true;
              peg.hitCool = HIT_COOL;
              const rElapsed = g.frame - g.levelStartFrame;
              const rDecayed = Math.max(REDSHIFT_MIN, Math.round(REDSHIFT_BASE * (1 - Math.min(1, rElapsed / REDSHIFT_WINDOW))));
              g.score += rDecayed;
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
                  if ((lt.hp ?? 0) <= 0) { spawnPegBreak(g, lt); lt.cleared = true; g.score += 30; if (lt.bossArmor) goldArmorRefill(lt); }
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
                      if ((lt2.hp ?? 0) <= 0) { spawnPegBreak(g, lt2); lt2.cleared = true; g.score += 30; if (lt2.bossArmor) goldArmorRefill(lt2); }
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
                    } else if (other.type === 'chain-node') {
                      // Bomb has no effect on chain nodes
                    } else {
                      spawnPegBreak(g, other);
                      other.cleared = true; other.hitCool = HIT_COOL;
                      if (other.type === 'orange') { g.orangeLeft--; g.score += 100; }
                      else if (other.type === 'purple') { g.shotsLeft++; g.score += 50; }
                      else { g.score += 10; }
                      if (other.bossArmor) goldArmorRefill(other);
                    }
                  }
                }
              } else if (peg.type === 'split') {
                g.score += 30;
                // Spawn 2 balls at ±36° from current direction
                const bspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                const ba   = Math.atan2(ball.vy, ball.vx);
                const sa   = Math.PI / 5;
                _aliveBuf.push({ x: ball.x, y: ball.y, vx: Math.cos(ba + sa) * bspd, vy: Math.sin(ba + sa) * bspd, dots: makeBallDots(), isBucketBall: false, stuckTimer: 0, stuckBaseY: ball.y, freezeTimer: 0, mudTimer: 0, neutronTimer: 0, dilated: false, bfSide: 0, pdgSide: 0, rgLayer: 0, vcTimer: 0, vcFlip: 1, bucFlash: 0, reborn: false, goldTimer: 0, inVoid: false, wSign: 1, phantomSide: 0, fsPrevVx: 0, fsPrevVy: 0, ideSiphonU: 0, fxTrail: 0, fxTrailColor: '#8a96d8', fxTwist: 0, fxField: 0, fxFieldColor: '#c89030' });
                _aliveBuf.push({ x: ball.x, y: ball.y, vx: Math.cos(ba - sa) * bspd, vy: Math.sin(ba - sa) * bspd, dots: makeBallDots(), isBucketBall: false, stuckTimer: 0, stuckBaseY: ball.y, freezeTimer: 0, mudTimer: 0, neutronTimer: 0, dilated: false, bfSide: 0, pdgSide: 0, rgLayer: 0, vcTimer: 0, vcFlip: 1, bucFlash: 0, reborn: false, goldTimer: 0, inVoid: false, wSign: 1, phantomSide: 0, fsPrevVx: 0, fsPrevVy: 0, ideSiphonU: 0, fxTrail: 0, fxTrailColor: '#8a96d8', fxTwist: 0, fxField: 0, fxFieldColor: '#c89030' });
              } else if (peg.type === 'orange') {
                g.orangeLeft--; g.score += 100;
              } else if (peg.type === 'purple') {
                g.shotsLeft++; g.score += 50;
              } else {
                g.score += 10;
              }
            }
          }

          // Pair-production flush: each cleared pair peg births one fresh blue at a nearby
          // free spot (reject the launcher zone, off-board, and overlaps). hitCool on the
          // newborn stops it from interacting with the current ball this same frame.
          for (const src of pairSpawns) {
            for (let tryI = 0; tryI < PAIR_SPAWN_TRIES; tryI++) {
              const ang = Math.random() * Math.PI * 2;
              const rad = PEG_R * 3 + Math.random() * PEG_R * 3;
              const npx = src.x + Math.cos(ang) * rad;
              const npy = src.y + Math.sin(ang) * rad;
              if (npx < PEG_R + 4 || npx > W - PEG_R - 4) continue;
              if (npy < launcherY + 70 || npy > H - H * 0.14) continue;
              // don't birth it on top of the ball (it would start embedded until pushed out)
              if ((ball.x - npx) ** 2 + (ball.y - npy) ** 2 < (BALL_R + PEG_R + 2) ** 2) continue;
              let overlaps = false;
              for (const q of g.pegs) {
                if (q.cleared) continue;
                if ((q.x - npx) ** 2 + (q.y - npy) ** 2 < (PEG_R * 2 + 2) ** 2) { overlaps = true; break; }
              }
              if (overlaps) continue;
              g.pegs.push({ x: npx, y: npy, type: 'blue', cleared: false, hitCool: HIT_COOL, dots: makePegDots('blue') });
              break;
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
                }
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
            } else if (ball.freezeTimer > 0) {
              // Frozen ball: full ice-blue body so the slow is obvious at a glance.
              const icePulse = 0.7 + Math.abs(Math.sin(g.frame * 0.12)) * 0.3;
              drawDots(ctx, ball.dots, drawX, drawY, 0, g.frame, FREEZE_BALL_COLOR, icePulse);
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
            // Ice crystal overlay when frozen (on top of the ice-blue body).
            if (ball.freezeTimer > 0) {
              const iceAlpha = Math.min(1, ball.freezeTimer / 30) * 0.95;
              ctx.fillStyle = '#e8f8ff';
              for (let arm = 0; arm < 6; arm++) {
                const ia = arm * Math.PI / 3 + g.frame * 0.03;
                const ilen = BALL_R + 5;
                ctx.globalAlpha = iceAlpha;
                ctx.fillRect(Math.round(drawX + Math.cos(ia) * ilen) - 1, Math.round(drawY + Math.sin(ia) * ilen) - 1, 2, 2);
                ctx.fillRect(Math.round(drawX + Math.cos(ia) * (ilen - 3)) - 1, Math.round(drawY + Math.sin(ia) * (ilen - 3)) - 1, 2, 2);
              }
              // Soft frost halo
              ctx.fillStyle = '#88ccff';
              ctx.globalAlpha = iceAlpha * 0.35;
              for (let i = 0; i < 10; i++) {
                const a = (i / 10) * Math.PI * 2 + g.frame * 0.04;
                ctx.fillRect(Math.round(drawX + Math.cos(a) * (BALL_R + 7)) - 1, Math.round(drawY + Math.sin(a) * (BALL_R + 7)) - 1, 2, 2);
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
            // Hazard readability: force trail / twist arc / field enter-exit tint on the ball.
            if (ball.fxTrail > 0) {
              const tt = ball.fxTrail / FX_TRAIL_DUR;
              const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) || 1;
              const ux = ball.vx / spd, uy = ball.vy / spd;
              ctx.fillStyle = ball.fxTrailColor;
              for (let s = 1; s <= 4; s++) {
                ctx.globalAlpha = tt * 0.55 * (1 - s / 5);
                ctx.fillRect(Math.round(drawX - ux * s * 3) - 1, Math.round(drawY - uy * s * 3) - 1, 2, 2);
              }
              ctx.globalAlpha = 1;
            }
            if (ball.fxTwist > 0) {
              const tw = ball.fxTwist / FX_TWIST_DUR;
              ctx.fillStyle = '#c8b8e8';
              for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 + g.frame * 0.2;
                const rr = BALL_R + 4 + (1 - tw) * 3;
                ctx.globalAlpha = tw * 0.7;
                ctx.fillRect(Math.round(drawX + Math.cos(a) * rr) - 1, Math.round(drawY + Math.sin(a) * rr) - 1, 2, 2);
              }
              ctx.globalAlpha = 1;
            }
            if (ball.fxField > 0) {
              const ft = ball.fxField / FX_FIELD_DUR;
              ctx.fillStyle = ball.fxFieldColor;
              ctx.globalAlpha = ft * 0.55;
              for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                ctx.fillRect(Math.round(drawX + Math.cos(a) * (BALL_R + 6)) - 1, Math.round(drawY + Math.sin(a) * (BALL_R + 6)) - 1, 2, 2);
              }
              ctx.globalAlpha = 1;
            }
            _aliveBuf.push(ball);
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
            _aliveBuf.push(ball);
          } else if (g.cosmicDarkAgesActive && ball.y < H + 90) {
            // Natural/bucket exit (y≈H+60). Mid-board deaths set y=H+100 and already
            // spawned a ghost at the true death point above — skip them here.
            g.cdaGhosts.push({ x: ball.x, y: Math.min(ball.y, H - 20), timer: CDA_GHOST_DUR, vx: ball.vx, vy: ball.vy });
          }
        }
        // Reuse the balls array: copy survivors in place (no fresh Ball[] allocation).
        {
          const out = g.balls;
          out.length = 0;
          for (let i = 0; i < _aliveBuf.length; i++) out.push(_aliveBuf[i]);
        }

        // All balls exited and burst finished → next phase
        if (g.balls.length === 0 && g.burstRemaining === 0) {
          if (g.orangeLeft <= 0 && (!g.boss || g.boss.hp <= 0)) {
            g.phase = 'levelclear';
            g.levelClearTimer = 95;
            setPhase('levelclear');
          } else if (g.shotsLeft <= 0) {
            clearRun();
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
            checkpointRunRef.current(true);
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

      // Cosmic Dark Ages: alpha / ghost / hit-light timers only (veil is drawn LAST).
      if (g.cosmicDarkAgesActive && g.phase !== 'paused') {
        g.cdaAlpha = Math.min(1, g.cdaAlpha + 1 / CDA_FADE_IN);
        for (let gi = g.cdaGhosts.length - 1; gi >= 0; gi--) {
          g.cdaGhosts[gi].timer--;
          if (g.cdaGhosts[gi].timer <= 0) g.cdaGhosts.splice(gi, 1);
        }
        for (let li = g.cdaLights.length - 1; li >= 0; li--) {
          g.cdaLights[li].timer--;
          if (g.cdaLights[li].timer <= 0) g.cdaLights.splice(li, 1);
        }
      } else {
        g.cdaAlpha = 0;
        g.cdaGhosts = [];
        g.cdaLights = [];
      }

      // ── Bucket ───────────────────────────────────────────────────────────
      if (g.phase === 'aiming' || g.phase === 'firing') {
        g.bucketX += g.bucketSpd * g.bucketDir;
        if (g.bucketX <= 0)               { g.bucketX = 0;                g.bucketDir =  1; }
        if (g.bucketX + g.bucketW >= W)   { g.bucketX = W - g.bucketW;   g.bucketDir = -1; }
      }
      const bY = H - 44;
      // Wrongness kind 2: the bucket's golden heartbeat skips a beat (6 dim frames).
      const bucketPulse = (g.wrongFrames > 0 && g.wrongKind === 2)
        ? 0.30
        : 0.78 + Math.sin(g.frame * 0.12) * 0.22;

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
          // Clear replenishment tightens with depth (see clearShotRefill).
          const refill = clearShotRefill(g.level);
          g.score += g.shotsLeft * 200 + (sk === 'boss' ? 3000 : sk === 'special' ? 1500 : 0);
          g.shotsLeft += refill;
          setScore(g.score);
          hudScore.current = g.score;
          setShotsLeft(g.shotsLeft);
          hudShots.current = g.shotsLeft;
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
            ctx.fillStyle = p.color ?? '#0f0f0d';
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

      // ── Cosmic Dark Ages: drawn LAST. Opaque black veil with soft light holes
      // around launcher, live balls, and recently-hit pegs/hazards so the board
      // peeks through; then aim / launcher / balls are redrawn on top.
      if (g.cosmicDarkAgesActive && g.cdaAlpha > 0) {
        const m = getCdaMaskCtx(W, H, dpr);
        m.globalAlpha = g.cdaAlpha * CDA_VEIL_ALPHA;
        m.fillStyle = '#000000';
        m.fillRect(0, 0, W, H);
        m.globalAlpha = 1;
        m.globalCompositeOperation = 'destination-out';

        // Launcher pocket (always).
        cdaPunchLight(m, launcherX, launcherY, CDA_LIGHT_LAUNCH_R, 1);

        // Live-ball pockets.
        for (const ball of g.balls) {
          if (ball.y > H + 40) continue;
          cdaPunchLight(m, ball.x, ball.y, CDA_LIGHT_BALL_R, 1);
        }

        // Hit-reveal pockets (fade with timer).
        for (const L of g.cdaLights) {
          const life = L.timer / CDA_LIGHT_HIT_DUR;
          cdaPunchLight(m, L.x, L.y, L.r, 0.35 + 0.65 * life);
        }

        m.globalCompositeOperation = 'source-over';

        // Composite veil onto main canvas (device pixels).
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(_cdaMask!, 0, 0);
        ctx.restore();

        // 1) Full aim trajectory (entire dotted path length).
        if (g.phase === 'aiming') {
          const tvx = Math.sin(g.aimAngle) * BALL_SPEED;
          const tvy = Math.cos(g.aimAngle) * BALL_SPEED;
          const trajN = computeTrajectory(launcherX, launcherY + 8, tvx, tvy, g.pegs, W, g.windForce, g.warpWalls, g.windRange, g.windCenter, g.windRectY0, g.windRectY1);
          ctx.fillStyle = CDA_AIM_COLOR;
          for (let i = 0; i < trajN; i += 2) {
            const fade = (1 - i / trajN) * 0.85;
            ctx.globalAlpha = fade * g.cdaAlpha;
            ctx.fillRect(Math.round(_trajBuf[i].x - 1), Math.round(_trajBuf[i].y - 1), 2, 2);
          }
          ctx.globalAlpha = 1;
        }

        // 2) Launcher ring + aim arm (ink on lit paper; cream arm into the dark).
        ctx.fillStyle = '#0f0f0d';
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
          ctx.globalAlpha = 0.9 * g.cdaAlpha;
          ctx.fillRect(
            Math.round(launcherX + Math.cos(a) * 8 - 1.5),
            Math.round(launcherY + Math.sin(a) * 8 - 1.5),
            3, 3,
          );
        }
        if (g.phase === 'aiming') {
          const ax = launcherX + Math.sin(g.aimAngle) * 20;
          const ay = launcherY + Math.cos(g.aimAngle) * 20;
          ctx.strokeStyle = CDA_AIM_COLOR;
          ctx.globalAlpha = 0.9 * g.cdaAlpha;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(launcherX, launcherY);
          ctx.lineTo(ax, ay);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // 3) Live balls — ink against the cream paper revealed by the light pocket
        // (cream-on-cream was invisible after soft-hole lighting was added).
        for (const ball of g.balls) {
          if (ball.y > H + 40) continue;
          const drawX = ball.x, drawY = ball.y;
          const ballColor = ball.isBucketBall ? GOLD_GLOW_COLOR
                          : ball.freezeTimer > 0 ? FREEZE_BALL_COLOR
                          : ball.goldTimer > 0 ? GOLD_GLOW_COLOR
                          : '#0f0f0d';
          drawDots(ctx, ball.dots, drawX, drawY, 0, g.frame, ballColor, g.cdaAlpha);
          if (ball.freezeTimer > 0) {
            const iceAlpha = Math.min(1, ball.freezeTimer / 30) * 0.9;
            ctx.fillStyle = '#e8f8ff';
            for (let arm = 0; arm < 6; arm++) {
              const ia = arm * Math.PI / 3 + g.frame * 0.03;
              const ilen = BALL_R + 4;
              ctx.globalAlpha = iceAlpha * g.cdaAlpha;
              ctx.fillRect(Math.round(drawX + Math.cos(ia) * ilen) - 1, Math.round(drawY + Math.sin(ia) * ilen) - 1, 2, 2);
            }
          }
        }
        ctx.globalAlpha = 1;

        // Exit ghosts: tiny ball-shaped afterglow only.
        for (const gh of g.cdaGhosts) {
          const gt = gh.timer / CDA_GHOST_DUR;
          ctx.fillStyle = CDA_AIM_COLOR;
          ctx.globalAlpha = gt * 0.55 * g.cdaAlpha;
          const gr = Math.max(1, BALL_R * gt);
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            ctx.fillRect(Math.round(gh.x + Math.cos(a) * gr) - 1, Math.round(gh.y + Math.sin(a) * gr) - 1, 2, 2);
          }
        }
        ctx.globalAlpha = 1;
      }

      } // end steps loop

      // Sync React HUD once per display frame (not per speed-multiplier step).
      if (hudScore.current !== g.score) { hudScore.current = g.score; setScore(g.score); }
      if (hudShots.current !== g.shotsLeft) { hudShots.current = g.shotsLeft; setShotsLeft(g.shotsLeft); }
      if (hudOrange.current !== g.orangeLeft) { hudOrange.current = g.orangeLeft; setOrangeLeft(g.orangeLeft); }

      // Throttled aiming checkpoint so hazard timers survive a mid-aim refresh.
      if (g.phase === 'aiming' || (g.phase === 'paused' && g.prePausePhase === 'aiming')) {
        checkpointRunRef.current(false);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    loopFnRef.current = loop;
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [initLevel]);

  // ── Visibility change ────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => {
      if (document.hidden) {
        checkpointRunRef.current(true);
        cancelAnimationFrame(rafRef.current);
      } else {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(loopFnRef.current);
      }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  // ── Resume aiming checkpoint after refresh ───────────────────────────────
  useEffect(() => {
    if (restoreAttempted.current) return;
    let cancelled = false;
    // Wait two frames so the wrap has a real client size (not the 390×780 fallback).
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled || restoreAttempted.current) return;
        restoreAttempted.current = true;
        syncSize();
        const snap = loadRun();
        if (!snap) return;
        const g = G.current;
        if (!isBoardSizeCompatible(snap.boardW, snap.boardH, g.W, g.H)) {
          clearRun();
          return;
        }
        try {
          hydrateGameState(g, snap.state);
          syncSize();
          if (g.bgDots.length === 0) g.bgDots = initBgDots(g.W, g.H);

          setContinuesUsed(snap.continuesUsed);
          setExtrasUsed(snap.extrasUsed);
          continuesUsedRef.current = snap.continuesUsed;
          extrasUsedRef.current = snap.extrasUsed;
          setShotsLeft(g.shotsLeft);
          hudShots.current = g.shotsLeft;
          setScore(g.score);
          hudScore.current = g.score;
          setLevel(g.level);
          setOrangeLeft(g.orangeLeft);
          hudOrange.current = g.orangeLeft;
          setWarpWalls(g.warpWalls);
          setRetired(false);
          setPhase('aiming');
          preventNextFire.current = true;
          checkpointRunRef.current(true);
        } catch (err) {
          console.warn('[DotShot] run restore failed:', err);
          clearRun();
        }
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [syncSize]);

  // ── Playtest debug (?debug=1): jump levels / force hazards / refill shots ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') !== '1') return;
    DEBUG_FORCE_HAZARDS = true;
    const jumpTo = (next: number) => {
      const g = G.current;
      if (g.phase === 'idle') {
        syncSize();
        g.rng = makeRng(Date.now());
        if (g.bgDots.length === 0) g.bgDots = initBgDots(g.W, g.H);
        g.shotsLeft = 99; g.score = 0;
        setShotsLeft(99); hudShots.current = 99;
        setScore(0); hudScore.current = 0;
        setRetired(false);
      }
      g.shotsLeft = Math.max(g.shotsLeft, 30);
      setShotsLeft(g.shotsLeft);
      hudShots.current = g.shotsLeft;
      initLevel(Math.max(1, next));
    };
    (window as unknown as { __dotshotJump?: (lv: number) => void; __dotshotFire?: () => void; __dotshotClear?: () => void; __dotshotInfo?: () => Record<string, unknown> }).__dotshotJump = jumpTo;
    (window as unknown as { __dotshotFire?: () => void }).__dotshotFire = () => fireBall();
    (window as unknown as { __dotshotClear?: () => void }).__dotshotClear = () => {
      const g = G.current;
      g.orangeLeft = 0;
      for (const p of g.pegs) { if (p.type === 'orange') p.cleared = true; }
      setOrangeLeft(0);
      hudOrange.current = 0;
    };
    (window as unknown as { __dotshotInfo?: () => Record<string, unknown> }).__dotshotInfo = () => {
      const g = G.current;
      const counts: Record<string, number | boolean | null> = {
        level: g.level, phase: g.phase as unknown as null,
        gravZones: g.gravZones.length, wormholes: g.wormholes.length, comets: g.comets.length,
        lenses: g.lenses.length, cme: g.cmeActive, reion: g.reionActive, pulsars: g.pulsars.length, gravWaves: g.gravWaves.length,
        vacuums: g.vacuums.length, whiteHoles: g.whiteHoles.length, magnetars: g.magnetars.length,
        roguePlanets: g.roguePlanets.length, quasarJets: g.quasarJets.length, microBHs: g.microBHs.length,
        darkHalos: g.darkHalos.length, ergospheres: g.ergospheres.length, magReconnections: g.magReconnections.length,
        preSupernovae: g.preSupernovae.length, tidalStretches: g.tidalStretches.length, tachyonStreams: g.tachyonStreams.length,
        cosmicVoids: g.cosmicVoids.length, cosmicShears: g.cosmicShears.length, collisionlessShocks: g.collisionlessShocks.length, silkDampingClouds: g.silkDampingClouds.length, planckGratings: g.planckGratings.length, vacuumCherenkovDomains: g.vacuumCherenkovDomains.length, closedTimelikeCurves: g.closedTimelikeCurves.length, gravitationalCaustics: g.gravitationalCaustics.length, neutrinoOscillations: g.neutrinoOscillations.length, gravWaveMemories: g.gravWaveMemories.length, einsteinCrosses: g.einsteinCrosses.length, quantumZenoSectors: g.quantumZenoSectors.length, chirpBinary: g.chirpBinary ? 1 : 0, fuzzySolitons: g.fuzzySolitons.length, axionMicrolenses: g.axionMicrolenses.length, axionWalls: g.axionWalls.length, frbSources: g.frbSources.length,
        antimatterFlecks: g.antimatterFlecks.length, quantumBarriers: g.quantumBarriers.length,
        timeDilations: g.timeDilations.length, cosmicStrings: g.cosmicStrings.length,
        darkEnergyPatches: g.darkEnergyPatches.length, galacticTidalStreams: g.galacticTidalStreams.length,
        einsteinMirrorRings: g.einsteinMirrorRings.length, nakedSingularities: g.nakedSingularities.length,
        hyperStars: g.hyperStars.length, rogueBHs: g.rogueBHs.length, oddRadioCircles: g.oddRadioCircles.length,
        tidalDisruptions: g.tidalDisruptions.length, greatAttractor: g.greatAttractor ? 1 : 0,
        bulletClusters: g.bulletClusters.length, baryonOscillations: g.baryonOscillations.length,
        laniakeaBasins: g.laniakeaBasins.length, gwBackground: g.gwBackgroundActive, horizonEntropy: g.horizonEntropyActive, entropicDrag: g.entropicDragActive,
        pop31Flash: g.pop31Flash ? g.pop31Flash.patches.length : 0,
        runawaySMBHs: g.runawaySMBHs.length,
        phantomMembranes: g.phantomMembranes.length,
        alens: g.alensActive ? 1 : 0,
        bigRings: g.bigRings.length,
        kszPatches: g.kszPatches.length,
        subsolarPbhEcho: g.subsolarPbhEcho ? 1 : 0,
        quintomBreath: g.quintomBreathActive,
        bhStarCocoons: g.bhStarCocoons.length,
        dualH0Seam: g.dualH0Seam ? 1 : 0,
        hdHum: g.hdHumActive,
        sidmSpike: g.sidmSpike ? 1 : 0,
        nuNullBands: g.nuNullBands.length,
        tcDmHalos: g.tcDmHalos.length,
        fsSoftFields: g.fsSoftFields.length,
        ommCores: g.ommCores.length,
        frbMicrolenses: g.frbMicrolenses.length,
        pmfClumps: g.pmfClumps.length,
        ideSiphonBands: g.ideSiphonBands.length,
        vacLeaks: g.vacLeaks.length,
        gravEcho: g.gravEcho ? 1 : 0,
        momCoup: g.momCoupActive,
        bosonCaustics: g.bosonCaustics.length,
        iaContams: g.iaContams.length,
        signIdeSeams: g.signIdeSeams.length,
        phantomBelts: g.phantomBelts.length,
        mBiasVeils: g.mBiasVeils.length,
        varCoup: g.varCoupActive,
        photoZGates: g.photoZGates.length,
        blueHum: g.blueHumActive,
        s8Seams: g.s8Seams.length,
        isoBire: g.isoBireActive,
        cosmicBirefringences: g.cosmicBirefringences.length, holographicRGSheets: g.holographicRGSheets.length, littleRedDots: g.littleRedDots.length,
        primordialBHs: g.primordialBHs.length, darkStars: g.darkStars.length,
        cmb: g.cmbAnisotropy ? 1 : 0, hawkingPoints: g.hawkingPoints.length,
        darkAges: g.cosmicDarkAgesActive, quantumFoams: g.quantumFoams.length,
        firewalls: g.firewalls.length, superradiances: g.superradiances.length,
        negMassBlobs: g.negMassBlobs.length, bubbleUniverses: g.bubbleUniverses.length,
        bigRip: g.bigRip ? 1 : 0, ccc: g.cccBoundary ? 1 : 0, theNothings: g.theNothings.length,
        darkFlow: g.darkFlow ? 1 : 0, fog: g.fogActive,
      };
      return counts;
    };
    const onKey = (e: KeyboardEvent) => {
      const g = G.current;
      if (e.key === ']' || e.key === '[') {
        e.preventDefault();
        jumpTo(g.level + (e.key === ']' ? (e.shiftKey ? 10 : 1) : (e.shiftKey ? -10 : -1)));
      } else if (e.key === 'r' || e.key === 'R') {
        g.shotsLeft = 99; setShotsLeft(99); hudShots.current = 99;
      } else if (e.key === 'c' || e.key === 'C') {
        (window as unknown as { __dotshotClear?: () => void }).__dotshotClear?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      delete (window as unknown as { __dotshotJump?: unknown }).__dotshotJump;
    };
  }, [initLevel, syncSize, fireBall]);

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
  const handleDisconnectWallet = useCallback(() => {
    setWalletAddress(null);
    setTxState('idle');
    setTxHash(null);
    setX402Confirm(null);
    setX402Error(null);
    selectedProviderRef.current = null;
  }, []);

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

  const UsdcIcon = ({ size = 16 }: { size?: number }) => (
    <img
      src="/usdc.svg"
      alt="USDC"
      width={size}
      height={size}
      style={{ display: 'block', flexShrink: 0, borderRadius: '50%' }}
      draggable={false}
    />
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

      {/* ── WALLET STATUS ──────────────────────────────────────────────────── */}
      {!showWalletModal && !x402Confirm && phase !== 'gameover' && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: walletAddress ? '3px 5px 3px 9px' : 0,
            border: walletAddress ? '1px solid rgba(15,15,13,0.20)' : 'none',
            borderRadius: 9999,
            background: walletAddress ? 'rgba(237,233,223,0.88)' : 'transparent',
            pointerEvents: 'all',
            whiteSpace: 'nowrap',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {walletAddress ? (
            <>
              <span style={{ color: MUTED, fontSize: 9, fontFamily: FONT, fontWeight: 700, letterSpacing: '0.06em' }}>
                {t.walletConnected} {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
              <button
                style={{ background: INK, border: 'none', borderRadius: 9999, color: CREAM, fontSize: 9, fontFamily: FONT, fontWeight: 700, padding: '4px 8px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                onPointerDown={(e) => { e.stopPropagation(); handleDisconnectWallet(); }}
              >
                {t.disconnect}
              </button>
            </>
          ) : (
            <button
              style={{ background: 'rgba(237,233,223,0.88)', border: '1px solid rgba(15,15,13,0.22)', borderRadius: 9999, color: INK, fontSize: 9, fontFamily: FONT, fontWeight: 700, padding: '5px 10px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', letterSpacing: '0.04em' }}
              onPointerDown={(e) => { e.stopPropagation(); handleConnectWallet(); }}
            >
              {walletConnecting ? t.connecting : t.connectWallet}
            </button>
          )}
        </div>
      )}

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
          <div style={{ position: 'absolute', top: 43, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ ...labelStyle, marginBottom: 0, textAlign: 'center' }}>{warpWalls ? 'LOOP' : 'WALL'}</div>
            <div style={{ width: 30, height: 3, borderRadius: 2, background: warpWalls ? '#6688ff' : '#c8a000' }} />
          </div>
          <div style={{ position: 'absolute', top: 20, left: 22, pointerEvents: 'none' }}>
            <div style={labelStyle}>{t.levelLabel}</div>
            <div style={{ color: INK, fontSize: 42, fontWeight: 900, lineHeight: 1, fontFamily: FONT }}>{level}</div>
            {/* Unlabeled depth dots — no names, no tooltips; just a quiet progress grain. */}
            <div style={{ display: 'flex', gap: 3, marginTop: 6, alignItems: 'center' }}>
              {Array.from({ length: 7 }, (_, i) => {
                const lit = i < depthMeterLit(level);
                return (
                  <div
                    key={i}
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 1,
                      background: lit ? INK : 'rgba(15,15,13,0.14)',
                      opacity: lit ? (0.35 + (i / 6) * 0.55) : 0.35,
                    }}
                  />
                );
              })}
            </div>
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
            {phase === 'aiming' && extrasUsed < X402_EXTRA_MAX && !x402QuotaReached && (
              <button
                style={{
                  pointerEvents: 'all',
                  marginTop: 10,
                  background: 'transparent',
                  border: `1px solid rgba(15,15,13,0.28)`,
                  borderRadius: 9999,
                  color: x402Busy ? MUTED : INK,
                  fontSize: 11,
                  fontFamily: FONT,
                  fontWeight: 700,
                  cursor: x402Busy ? 'default' : 'pointer',
                  padding: '5px 10px',
                  letterSpacing: '0.04em',
                  WebkitTapHighlightColor: 'transparent',
                  opacity: x402Busy ? 0.55 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                disabled={x402Busy}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  preventNextFire.current = true;
                  openX402Confirm('extra');
                }}
                onPointerUp={(e) => { e.stopPropagation(); preventNextFire.current = true; }}
                onClick={(e) => e.stopPropagation()}
              >
                <UsdcIcon size={14} />
                <span>{x402Busy ? t.paying : t.extraShot}</span>
                <span style={{ color: MUTED, fontWeight: 600 }}>{X402_PRICE_EXTRA}</span>
              </button>
            )}
            {x402Error && phase === 'aiming' && !x402Confirm && (
              <div style={{ pointerEvents: 'none', marginTop: 6, color: '#d81e1e', fontSize: 10, fontFamily: FONT, maxWidth: 160 }}>{x402Error}</div>
            )}
          </div>
          <div style={{ position: 'absolute', bottom: 54, right: 22, textAlign: 'right', pointerEvents: 'none' }}>
            <div style={labelStyle}>{t.scoreLabel}</div>
            <div style={{ color: INK, fontSize: 34, fontWeight: 900, lineHeight: 1, fontFamily: FONT }}>{score}</div>
          </div>
          <div style={{ position: 'absolute', top: 59, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'all', display: 'flex', alignItems: 'center', gap: 70 }}>
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

      {/* ── x402 PAY CONFIRM ─────────────────────────────────────────────── */}
      {x402Confirm && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(237,233,223,0.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, zIndex: 20, pointerEvents: 'all', padding: '0 36px' }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div style={{ ...labelStyle, marginBottom: 0 }}>{t.payConfirmTitle}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <UsdcIcon size={28} />
            <div style={{ color: INK, fontSize: 16, fontWeight: 800, fontFamily: FONT }}>
              {x402Confirm === 'continue' ? t.payConfirmContinue : t.payConfirmExtra}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ color: MUTED, fontSize: 11, fontFamily: FONT, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>{t.payConfirmCost}</span>
            <span style={{ color: INK, fontSize: 28, fontWeight: 900, fontFamily: FONT }}>{x402PriceOf(x402Confirm)}</span>
            <span style={{ color: MUTED, fontSize: 13, fontFamily: FONT, fontWeight: 700 }}>USDC</span>
          </div>
          {x402Error && (
            <div style={{ color: '#d81e1e', fontSize: 12, fontFamily: FONT, textAlign: 'center', maxWidth: 280 }}>{x402Error}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', width: '100%', maxWidth: 260 }}>
            <button
              style={{
                ...pillBtn(true),
                minWidth: 220,
                opacity: x402Busy ? 0.55 : 1,
                pointerEvents: x402Busy ? 'none' : 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                preventNextFire.current = true;
                const kind = x402Confirm;
                if (kind) payX402Grant(kind);
              }}
              onPointerUp={(e) => { e.stopPropagation(); preventNextFire.current = true; }}
            >
              <UsdcIcon size={18} />
              <span>{x402Busy ? t.paying : t.payConfirmPay}</span>
            </button>
            <button
              style={{ ...pillBtn(false), minWidth: 220, opacity: x402Busy ? 0.4 : 1 }}
              disabled={x402Busy}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (x402Busy) return;
                // Closing the sheet uncovers the aiming surface under the finger;
                // block the trailing pointerUp so cancel never spends a shot.
                preventNextFire.current = true;
                setX402Confirm(null);
                setX402Error(null);
              }}
              onPointerUp={(e) => { e.stopPropagation(); preventNextFire.current = true; }}
            >
              {t.payConfirmCancel}
            </button>
          </div>
        </div>
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
                onPointerDown={(e) => { e.stopPropagation(); handleDisconnectWallet(); }}
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
            {!retired && continuesUsed < X402_CONTINUE_MAX && !x402QuotaReached && (
              <button
                style={{
                  ...pillBtn(false),
                  opacity: x402Busy ? 0.5 : 1,
                  pointerEvents: x402Busy ? 'none' : 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onPointerDown={(e) => { e.stopPropagation(); openX402Confirm('continue'); }}
                onPointerUp={(e) => e.stopPropagation()}
              >
                <UsdcIcon size={18} />
                <span>{x402Busy ? t.paying : t.continuePlay}</span>
                <span style={{ color: MUTED, fontWeight: 600, fontSize: 12 }}>{X402_PRICE_CONTINUE}</span>
              </button>
            )}
            <button style={pillBtn(false)} onPointerDown={(e) => { e.stopPropagation(); handleShare(); }}>{t.share}</button>
          </div>
          {x402Error && !x402Confirm && (
            <div style={{ color: '#d81e1e', fontSize: 12, fontFamily: FONT, marginBottom: 12 }}>{x402Error}</div>
          )}

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
