/**
 * ResourceCollectAnimation
 *
 * Mobile-game-quality "scatter → fly-to-HUD" particle animation.
 * Uses React Native's built-in Animated API with useNativeDriver: true
 * so all motion runs on the UI thread at 60fps — no extra packages needed.
 *
 * Flow:
 *  1. N particles spawn at `startPosition` (centre of the tapped card)
 *  2. Each scatters outward in a random direction (ease-out)
 *  3. All fly toward `targetPosition` (the HUD resource icon, ease-in)
 *  4. Particles shrink + fade on arrival
 *  5. A "+N" text pops near the target, then `onDone` fires
 */

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  Image,
  Animated,
  Easing,
  ImageSourcePropType,
} from "react-native";
import { Text } from "./StyledText";

// ─── Timing ───────────────────────────────────────────────────────────────────
const SCATTER_MS    = 340;
const FLY_MS        = 480;   // deliberately slower than scatter for a "magnetic pull" feel
const STAGGER_MS    = 14;
const MAX_PARTICLES = 20;
const PARTICLE_SIZE = 28;

type Position = { x: number; y: number };

// ─── Single Particle ─────────────────────────────────────────────────────────
type ParticleProps = {
  sx: number;  sy: number;   // spawn centre (absolute screen coords)
  tx: number;  ty: number;   // HUD target centre (absolute screen coords)
  scatterDx: number;
  scatterDy: number;
  rotDeg: number;
  icon: ImageSourcePropType;
  delay: number;
};

function Particle({
  sx, sy, tx, ty,
  scatterDx, scatterDy, rotDeg,
  icon, delay,
}: ParticleProps) {
  const transX  = useRef(new Animated.Value(0)).current;
  const transY  = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate  = useRef(new Animated.Value(0)).current;

  const flyDx = tx - sx;
  const flyDy = ty - sy;

  useEffect(() => {
    const holdMs = SCATTER_MS + FLY_MS - 80 - 80;

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        // ── Translate X: scatter then fly ─────────────────────────────
        Animated.sequence([
          Animated.timing(transX, {
            toValue:  scatterDx,
            duration: SCATTER_MS,
            easing:   Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(transX, {
            toValue:  flyDx,
            duration: FLY_MS,
            easing:   Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        // ── Translate Y: scatter then fly ─────────────────────────────
        Animated.sequence([
          Animated.timing(transY, {
            toValue:  scatterDy,
            duration: SCATTER_MS,
            easing:   Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(transY, {
            toValue:  flyDy,
            duration: FLY_MS,
            easing:   Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        // ── Scale: pop in → hold → shrink ─────────────────────────────
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.35, duration: 130,              useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.1,  duration: SCATTER_MS - 130, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.45, duration: FLY_MS,           useNativeDriver: true }),
        ]),
        // ── Rotation: twist out → unwind ──────────────────────────────
        Animated.sequence([
          Animated.timing(rotate, { toValue: rotDeg, duration: SCATTER_MS, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 0,      duration: FLY_MS,     useNativeDriver: true }),
        ]),
        // ── Opacity: quick fade-in → hold → fade out near end ─────────
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 80,      useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: holdMs,  useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 80,      useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotateStr = rotate.interpolate({
    inputRange:  [-360, 360],
    outputRange: ["-360deg", "360deg"],
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left:    sx - PARTICLE_SIZE / 2,
          top:     sy - PARTICLE_SIZE / 2,
          opacity,
          transform: [
            { translateX: transX },
            { translateY: transY },
            { scale },
            { rotate: rotateStr },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <Image source={icon} style={styles.particleImg} resizeMode="contain" />
    </Animated.View>
  );
}

// ─── "+Amount" Impact Text ─────────────────────────────────────────────────
function PlusText({ tx, ty, amount }: { tx: number; ty: number; amount: number }) {
  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const transY  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.4, duration: 140, easing: Easing.out(Easing.back(3)), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0, duration: 100, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0, duration: 280, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
      Animated.timing(transY, { toValue: -28, duration: 720, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[styles.plusWrap, { left: tx - 36, top: ty - 36 }]}
      pointerEvents="none"
    >
      <Animated.View
        style={{
          opacity,
          transform: [{ scale }, { translateY: transY }],
        }}
      >
        <Text style={styles.plusText}>+{amount}</Text>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
type Props = {
  /** Absolute screen centre of the spawn point (e.g. farmer card centre) */
  startPosition: Position;
  /** Absolute screen centre of the HUD resource icon */
  targetPosition: Position;
  /** How many resources were collected */
  amount: number;
  /** Resource icon image source */
  icon: ImageSourcePropType;
  /** Called once the entire animation (including +text) finishes */
  onDone: () => void;
  /** Fires just before the first particle reaches the target — use to pulse the icon */
  onArrival?: () => void;
};

export default function ResourceCollectAnimation({
  startPosition,
  targetPosition,
  amount,
  icon,
  onDone,
  onArrival,
}: Props) {
  const count = Math.min(Math.max(amount, 1), MAX_PARTICLES);
  const [showPlus, setShowPlus] = useState(false);

  // Stable particle configs — generated once on mount
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      // Even angular spread with slight random jitter
      const baseAngle = (i / count) * Math.PI * 2;
      const jitter    = (Math.random() - 0.5) * (Math.PI / count);
      const angle     = baseAngle + jitter;
      const dist      = 38 + Math.random() * 52;
      const rotDeg    = (Math.random() - 0.5) * 70;
      return {
        key:       i,
        scatterDx: Math.cos(angle) * dist,
        scatterDy: Math.sin(angle) * dist,
        rotDeg,
        delay:     i * STAGGER_MS,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drive completion + arrival purely from setTimeout — no worklet callbacks needed
  useEffect(() => {
    const firstArrivalMs = SCATTER_MS + FLY_MS - 30; // first particle just before landing
    const lastParticleMs = (count - 1) * STAGGER_MS + SCATTER_MS + FLY_MS;
    const t0 = setTimeout(() => onArrival?.(), firstArrivalMs);
    const t1 = setTimeout(() => setShowPlus(true), lastParticleMs);
    const t2 = setTimeout(onDone, lastParticleMs + 750);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <Particle
          key={p.key}
          sx={startPosition.x}
          sy={startPosition.y}
          tx={targetPosition.x}
          ty={targetPosition.y}
          scatterDx={p.scatterDx}
          scatterDy={p.scatterDy}
          rotDeg={p.rotDeg}
          icon={icon}
          delay={p.delay}
        />
      ))}

      {showPlus && (
        <PlusText
          tx={targetPosition.x}
          ty={targetPosition.y}
          amount={amount}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  particle: {
    position: "absolute",
    width:    PARTICLE_SIZE,
    height:   PARTICLE_SIZE,
  },
  particleImg: {
    width:  "100%",
    height: "100%",
  },
  plusWrap: {
    position:        "absolute",
    alignItems:      "center",
    justifyContent:  "center",
  },
  plusText: {
    fontSize:         22,
    fontWeight:       "900",
    fontFamily:       "Fredoka-Bold",
    color:            "#3a1e00",
    textShadowColor:  "rgba(255,255,255,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
