export type AnimationClip =
  | 'idle'
  | 'jump'
  | 'dance'
  | 'bounce'
  | 'somersault'
  | 'sleep'
  | 'waddle'

export interface AnimatorControls {
  playClip: (clip: AnimationClip) => void
  handleTap: () => void
  destroy: () => void
}

/**
 * Checks whether user prefers reduced motion.
 */
export function isReducedMotionPreferred(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Initializes character animation engine on an SVG container element.
 */
export function initCharacterAnimator(container: HTMLElement | SVGElement): AnimatorControls {
  let isDestroyed = false
  let currentActionAnimation: Animation | null = null
  let idleAnimation: Animation | null = null
  let blinkTimer: number | null = null
  let randomActionTimer: number | null = null
  let tapTimestamps: number[] = []

  const reducedMotion = isReducedMotionPreferred()

  // Helper to query element inside container
  const getEl = (selector: string): SVGElement | null => {
    return container.querySelector(selector)
  }

  const getAllLimbs = (): SVGElement[] => {
    const list = Array.from(
      container.querySelectorAll<SVGElement>(
        '[id^="leg-"], [id^="arm-"], #tail, #ear-left, #ear-right'
      )
    )
    return list
  }

  // 1. Lively Idle: Breathing + Stage Waddling & Moving around
  const startIdle = () => {
    if (reducedMotion || isDestroyed) return

    const whole = container
    if (whole && 'animate' in whole) {
      idleAnimation = whole.animate(
        [
          { transform: 'translateX(0px) translateY(0px) rotate(0deg) scale(1, 1)' },
          { transform: 'translateX(-8px) translateY(-3px) rotate(-3deg) scale(0.98, 1.02)' },
          { transform: 'translateX(-3px) translateY(0px) rotate(1deg) scale(1, 1)' },
          { transform: 'translateX(8px) translateY(-3px) rotate(3deg) scale(0.98, 1.02)' },
          { transform: 'translateX(3px) translateY(0px) rotate(-1deg) scale(1, 1)' },
          { transform: 'translateX(0px) translateY(0px) rotate(0deg) scale(1, 1)' },
        ],
        {
          duration: 4800,
          iterations: Infinity,
          easing: 'ease-in-out',
        }
      )
    }

    // Periodic Eye Blinking
    const scheduleBlink = () => {
      if (isDestroyed) return
      const nextDelay = 2500 + Math.random() * 4000
      blinkTimer = window.setTimeout(() => {
        const eyeLeft = getEl('#eye-left')
        const eyeRight = getEl('#eye-right')

        const eyes = [eyeLeft, eyeRight].filter(Boolean) as SVGElement[]
        eyes.forEach((eye) => {
          if (eye.animate) {
            eye.animate(
              [
                { transform: 'scaleY(1)', transformOrigin: 'center' },
                { transform: 'scaleY(0.1)', transformOrigin: 'center' },
                { transform: 'scaleY(1)', transformOrigin: 'center' },
              ],
              {
                duration: 180,
                iterations: 1,
                easing: 'ease-in-out',
              }
            )
          }
        })
        scheduleBlink()
      }, nextDelay)
    }

    scheduleBlink()
  }

  // Stop any active action
  const stopCurrentAction = () => {
    if (currentActionAnimation) {
      currentActionAnimation.cancel()
      currentActionAnimation = null
    }
  }

  // 2. Play specific clips
  const playClip = (clip: AnimationClip) => {
    if (reducedMotion || isDestroyed) return
    stopCurrentAction()

    const whole = container
    const limbs = getAllLimbs()
    const head = getEl('#head')

    switch (clip) {
      case 'jump': {
        if (whole.animate) {
          currentActionAnimation = whole.animate(
            [
              { transform: 'translateY(0px) scale(1, 1)' },
              { transform: 'translateY(4px) scale(1.08, 0.92)' },
              { transform: 'translateY(-26px) scale(0.95, 1.05)' },
              { transform: 'translateY(2px) scale(1.05, 0.95)' },
              { transform: 'translateY(0px) scale(1, 1)' },
            ],
            {
              duration: 650,
              easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }
          )
        }
        break
      }

      case 'bounce': {
        if (whole.animate) {
          currentActionAnimation = whole.animate(
            [
              { transform: 'translateY(0px)' },
              { transform: 'translateY(-12px)' },
              { transform: 'translateY(0px)' },
              { transform: 'translateY(-8px)' },
              { transform: 'translateY(0px)' },
            ],
            {
              duration: 500,
              easing: 'ease-out',
            }
          )
        }
        break
      }

      case 'somersault': {
        // High acrobatic leap + full 360-degree excited spin!
        if (whole.animate) {
          currentActionAnimation = whole.animate(
            [
              { transform: 'translateY(0px) rotate(0deg) scale(1, 1)' },
              { transform: 'translateY(6px) rotate(-15deg) scale(1.15, 0.85)' },
              { transform: 'translateY(-36px) rotate(180deg) scale(0.9, 1.1)' },
              { transform: 'translateY(-20px) rotate(300deg) scale(1, 1)' },
              { transform: 'translateY(4px) rotate(360deg) scale(1.15, 0.85)' },
              { transform: 'translateY(0px) rotate(360deg) scale(1, 1)' },
            ],
            {
              duration: 850,
              easing: 'cubic-bezier(0.2, 0.8, 0.3, 1.2)',
            }
          )
        }
        break
      }

      case 'dance': {
        if (whole.animate) {
          currentActionAnimation = whole.animate(
            [
              { transform: 'rotate(0deg)' },
              { transform: 'rotate(-8deg) translateY(-6px)' },
              { transform: 'rotate(8deg) translateY(-6px)' },
              { transform: 'rotate(-6deg) translateY(-4px)' },
              { transform: 'rotate(6deg) translateY(-4px)' },
              { transform: 'rotate(0deg)' },
            ],
            {
              duration: 1100,
              easing: 'ease-in-out',
            }
          )
        }

        limbs.forEach((limb, idx) => {
          if (limb.animate) {
            const dir = idx % 2 === 0 ? 1 : -1
            limb.animate(
              [
                { transform: 'rotate(0deg)', transformOrigin: 'top center' },
                { transform: `rotate(${dir * 18}deg)`, transformOrigin: 'top center' },
                { transform: `rotate(${-dir * 18}deg)`, transformOrigin: 'top center' },
                { transform: 'rotate(0deg)', transformOrigin: 'top center' },
              ],
              {
                duration: 550,
                iterations: 2,
                easing: 'ease-in-out',
              }
            )
          }
        })
        break
      }

      case 'waddle': {
        if (whole.animate) {
          currentActionAnimation = whole.animate(
            [
              { transform: 'rotate(0deg) translateX(0px)' },
              { transform: 'rotate(-6deg) translateX(-10px)' },
              { transform: 'rotate(6deg) translateX(10px)' },
              { transform: 'rotate(-5deg) translateX(-6px)' },
              { transform: 'rotate(0deg) translateX(0px)' },
            ],
            {
              duration: 950,
              easing: 'ease-in-out',
            }
          )
        }
        break
      }

      case 'sleep': {
        const eyes = [getEl('#eye-left'), getEl('#eye-right')].filter(Boolean) as SVGElement[]
        eyes.forEach((eye) => {
          if (eye.animate) {
            eye.animate(
              [
                { transform: 'scaleY(1)', transformOrigin: 'center' },
                { transform: 'scaleY(0.1)', transformOrigin: 'center' },
              ],
              {
                duration: 400,
                fill: 'forwards',
              }
            )
          }
        })
        if (head && head.animate) {
          currentActionAnimation = head.animate(
            [
              { transform: 'rotate(0deg) translateY(0px)' },
              { transform: 'rotate(6deg) translateY(4px)' },
            ],
            {
              duration: 600,
              fill: 'forwards',
            }
          )
        }
        break
      }

      case 'idle':
      default:
        break
    }
  }

  // 3. Interactive Tap Reaction (single tap -> jump or somersault; 3 rapid taps -> dance)
  const handleTap = () => {
    if (reducedMotion || isDestroyed) return
    const now = Date.now()
    tapTimestamps.push(now)
    // Keep taps within last 1200ms
    tapTimestamps = tapTimestamps.filter((t) => now - t <= 1200)

    if (tapTimestamps.length >= 3) {
      // Rapid tapping -> excited dance!
      tapTimestamps = []
      playClip('dance')
    } else {
      // Single tap -> jump or somersault
      const pick = Math.random() > 0.5 ? 'somersault' : 'jump'
      playClip(pick)
    }
  }

  // 4. Background stage scheduler picking spontaneous action clips
  const scheduleRandomAction = () => {
    if (isDestroyed) return
    const delay = 5000 + Math.random() * 7000
    randomActionTimer = window.setTimeout(() => {
      if (!currentActionAnimation) {
        const pool: AnimationClip[] = ['bounce', 'waddle', 'somersault']
        const chosen = pool[Math.floor(Math.random() * pool.length)]
        playClip(chosen)
      }
      scheduleRandomAction()
    }, delay)
  }

  // Start Idle and Scheduler
  startIdle()
  scheduleRandomAction()

  return {
    playClip,
    handleTap,
    destroy: () => {
      isDestroyed = true
      stopCurrentAction()
      if (idleAnimation) idleAnimation.cancel()
      if (blinkTimer) clearTimeout(blinkTimer)
      if (randomActionTimer) clearTimeout(randomActionTimer)
    },
  }
}
