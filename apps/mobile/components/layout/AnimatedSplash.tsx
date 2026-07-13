import * as React from 'react';
import { StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

// The martini-pin mark (gradient fill + white glass) and the "crawl" wordmark are
// inlined as raw SVG strings and rendered through SvgXml — the repo has no
// .svg-file import transformer configured in metro, so we feed the markup directly.
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 148"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a855f7"/><stop offset="1" stop-color="#7f13ec"/></linearGradient></defs><path d="M60 140 C 40 104 16 86 16 56 A 44 44 0 1 1 104 56 C 104 86 80 104 60 140 Z" fill="url(#g)"/><path d="M38 34 L82 34 L60 58 Z" fill="none" stroke="#ffffff" stroke-width="5" stroke-linejoin="round"/><path d="M60 58 L60 76" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/><path d="M45 76 L75 76" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/><path d="M63 45 L82 25" fill="none" stroke="#ffffff" stroke-width="4.0" stroke-linecap="round"/><circle cx="83" cy="23" r="4.5" fill="#ffffff"/></svg>`;

const WORDMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2694 720" fill="#ffffff"><g transform="translate(0 690) scale(1 -1)"><path transform="translate(0 0)" d="M289 -10C437 -10 539 70 539 207V229H351V213C351 171 329 156 282 156C226 156 206 174 206 257C206 340 226 358 282 358C329 358 351 343 351 301V285H539V307C539 444 437 524 289 524C117 524 20 422 20 252C20 88 117 -10 289 -10Z"/><path transform="translate(559 0)" d="M217 0V325C217 362 233 366 264 366C299 366 306 355 306 317V266H494V359C494 460 459 524 360 524C292 524 243 486 214 436H205V514H30V0Z"/><path transform="translate(1058 0)" d="M171 -10C267 -10 312 30 334 62H343V0H519V308C519 453 440 524 281 524C127 524 27 446 27 319V307H206V323C206 354 219 364 274 364C329 364 340 353 340 321V303L176 277C67 259 15 211 15 131C15 37 83 -10 171 -10ZM187 148C187 162 195 169 215 172L340 193C337 145 306 126 233 126C198 126 187 130 187 148Z"/><path transform="translate(1603 0)" d="M359 0 408 217 421 342H434L447 217L495 0H750L854 514H655L634 297L625 146H612L596 297L551 514H311L267 297L251 147H237L228 297L207 514H0L104 0Z"/><path transform="translate(2457 0)" d="M217 0V670H30V0Z"/></g></svg>`;

const BACKGROUND = '#0a0a0f';

// Entrance (fade + scale-settle), a brief hold, then the overlay fades out.
// 600 + 100 hold + 250 exit = ~950ms of added latency, under the ~1s budget.
const ENTRANCE_MS = 600;
const HOLD_MS = 100;
const EXIT_MS = 250;

interface AnimatedSplashProps {
  onAnimationComplete: () => void;
}

export function AnimatedSplash({ onAnimationComplete }: AnimatedSplashProps) {
  const overlayOpacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.92);

  React.useEffect(() => {
    logoOpacity.value = withTiming(1, {
      duration: ENTRANCE_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
    logoScale.value = withTiming(1, {
      duration: ENTRANCE_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
    overlayOpacity.value = withDelay(
      ENTRANCE_MS + HOLD_MS,
      withTiming(
        0,
        { duration: EXIT_MS, easing: Easing.in(Easing.quad), reduceMotion: ReduceMotion.System },
        (finished) => {
          if (finished) {
            runOnJS(onAnimationComplete)();
          }
        }
      )
    );
  }, [logoOpacity, logoScale, overlayOpacity, onAnimationComplete]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}>
      <Animated.View style={[styles.content, logoStyle]}>
        <SvgXml xml={ICON_SVG} width={112} height={138} />
        <SvgXml xml={WORDMARK_SVG} width={188} height={50} style={styles.wordmark} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    marginTop: 24,
  },
});
