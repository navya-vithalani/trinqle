export type AnimationClip =
  | 'idle'
  | 'jump'
  | 'dance'
  | 'bounce'
  | 'wave'
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

  // 1. Idle Breathing & Subtle Bob
  const startIdle = () => {
    if (reducedMotion || isDestroyed) return

    const body = getEl('#body') || getEl('#cookie-man') || container
    if (body && body.animate) {
      idleAnimation = body.animate(
        [
          { transform: 'translateY(0px) scaleY(1)' },
          { transform: 'translateY(-2px) scaleY(1.025)' },
          { transform: 'translateY(0px) scaleY(1)' },
        ],
        {
          duration: 3200,
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

      case 'wave': {
        const waveLimb = limbs[0]
        if (waveLimb && 'animate' in waveLimb) {
          currentActionAnimation = waveLimb.animate(
            [
              { transform: 'rotate(0deg)', transformOrigin: 'bottom center' },
              { transform: 'rotate(-25deg)', transformOrigin: 'bottom center' },
              { transform: 'rotate(20deg)', transformOrigin: 'bottom center' },
              { transform: 'rotate(-25deg)', transformOrigin: 'bottom center' },
              { transform: 'rotate(0deg)', transformOrigin: 'bottom center' },
            ],
            {
              duration: 750,
              easing: 'ease-in-out',
            }
          )
        } else {
          playClip('bounce')
        }
        break
      }

      case 'waddle': {
        if (whole.animate) {
          currentActionAnimation = whole.animate(
            [
              { transform: 'rotate(0deg) translateX(0px)' },
              { transform: 'rotate(-5deg) translateX(-6px)' },
              { transform: 'rotate(5deg) translateX(6px)' },
              { transform: 'rotate(-4deg) translateX(-4px)' },
              { transform: 'rotate(0deg) translateX(0px)' },
            ],
            {
              duration: 900,
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

  // 3. Interactive Tap Reaction (single tap -> jump or wave; 3 rapid taps -> dance)
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
      // Single or double tap -> jump or wave
      const pick = Math.random() > 0.5 ? 'jump' : 'wave'
      playClip(pick)
    }
  }

  // 4. Background stage scheduler picking spontaneous action clips
  const scheduleRandomAction = () => {
    if (isDestroyed) return
    const delay = 6000 + Math.random() * 8000
    randomActionTimer = window.setTimeout(() => {
      if (!currentActionAnimation) {
        const pool: AnimationClip[] = ['bounce', 'waddle', 'wave']
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
