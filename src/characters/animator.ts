export type AnimationClip =
  | 'idle'
  | 'jump'
  | 'dance'
  | 'bounce'
  | 'somersault'
  | 'sleep'
  | 'waddle'
  | 'gallop'
  | 'hop'
  | 'pirouette'
  | 'scurry'
  | 'sparkle'
  | 'bow'

export interface AnimatorControls {
  playClip: (clip: AnimationClip) => void
  handleTap: () => void
  destroy: () => void
}

export interface AnimatorOptions {
  isSideView?: boolean
  onViewChange?: (view: 'front' | 'side') => void
  characterId?: string
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
export function initCharacterAnimator(
  container: HTMLElement | SVGElement,
  options?: AnimatorOptions
): AnimatorControls {
  let isDestroyed = false
  let currentActionAnimation: Animation | null = null
  let idleAnimation: Animation | null = null
  let blinkTimer: ReturnType<typeof setTimeout> | null = null
  let randomActionTimer: ReturnType<typeof setTimeout> | null = null
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
      blinkTimer = setTimeout(() => {
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

      case 'gallop': {
        // Multi-view locomotion clip for Unicorn
        if (options?.onViewChange) options.onViewChange('side')
        if (whole.animate) {
          currentActionAnimation = whole.animate(
            [
              { transform: 'translateX(-36px) translateY(0px) rotate(0deg)' },
              { transform: 'translateX(-18px) translateY(-16px) rotate(-4deg)' },
              { transform: 'translateX(6px) translateY(0px) rotate(2deg)' },
              { transform: 'translateX(30px) translateY(-14px) rotate(4deg)' },
              { transform: 'translateX(0px) translateY(0px) rotate(0deg)' },
            ],
            {
              duration: 1100,
              easing: 'ease-in-out',
            }
          )
          currentActionAnimation.onfinish = () => {
            if (options?.onViewChange) options.onViewChange('front')
          }
        }
        break
      }

      case 'hop': {
        // Multi-view locomotion clip for Rabbit
        if (options?.onViewChange) options.onViewChange('side')
        if (whole.animate) {
          currentActionAnimation = whole.animate(
            [
              { transform: 'translate(0px, 0px) scale(1, 1)' },
              { transform: 'translate(-24px, 4px) scale(1.15, 0.85)' },
              { transform: 'translate(-12px, -24px) scale(0.9, 1.1)' },
              { transform: 'translate(10px, -24px) scale(0.9, 1.1)' },
              { transform: 'translate(22px, 2px) scale(1.12, 0.88)' },
              { transform: 'translate(0px, 0px) scale(1, 1)' },
            ],
            {
              duration: 950,
              easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)',
            }
          )
          currentActionAnimation.onfinish = () => {
            if (options?.onViewChange) options.onViewChange('front')
          }
        }
        break
      }

      case 'pirouette': {
        // Doll ballerina pirouette
        if (whole.animate) {
          currentActionAnimation = whole.animate(
            [
              { transform: 'rotate(0deg) scale(1, 1)' },
              { transform: 'rotate(180deg) scale(0.92, 1.08)' },
              { transform: 'rotate(360deg) scale(1, 1)' },
            ],
            {
              duration: 750,
              easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            }
          )
        }
        break
      }

      case 'scurry': {
        // Tiny mouse speedy scurry
        if (whole.animate) {
          currentActionAnimation = whole.animate(
            [
              { transform: 'translateX(0px)' },
              { transform: 'translateX(-12px) scaleX(0.95)' },
              { transform: 'translateX(14px) scaleX(1.05)' },
              { transform: 'translateX(-8px) scaleX(0.98)' },
              { transform: 'translateX(0px)' },
            ],
            {
              duration: 500,
              easing: 'ease-in-out',
            }
          )
        }
        break
      }

      case 'sparkle': {
        // Unicorn horn magic glow
        const horn = getEl('#horn')
        if (horn && horn.animate) {
          horn.animate(
            [
              { transform: 'scale(1)', filter: 'brightness(1)' },
              { transform: 'scale(1.2)', filter: 'drop-shadow(0 0 12px #ffd700) brightness(1.4)' },
              { transform: 'scale(1)', filter: 'brightness(1)' },
            ],
            {
              duration: 800,
              easing: 'ease-in-out',
            }
          )
        }
        if (whole.animate) {
          currentActionAnimation = whole.animate(
            [
              { transform: 'translateY(0px)' },
              { transform: 'translateY(-10px)' },
              { transform: 'translateY(0px)' },
            ],
            {
              duration: 800,
              easing: 'ease-in-out',
            }
          )
        }
        break
      }

      case 'bow': {
        // Polite doll court bow
        if (whole.animate) {
          currentActionAnimation = whole.animate(
            [
              { transform: 'rotate(0deg) translateY(0px)' },
              { transform: 'rotate(-8deg) translateY(6px)' },
              { transform: 'rotate(0deg) translateY(0px)' },
            ],
            {
              duration: 700,
              easing: 'ease-in-out',
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

  // 3. Interactive Tap Reaction (single tap -> character action or somersault; 3 rapid taps -> dance)
  const handleTap = () => {
    if (reducedMotion || isDestroyed) return
    const now = Date.now()
    tapTimestamps.push(now)
    tapTimestamps = tapTimestamps.filter((t) => now - t <= 1200)

    if (tapTimestamps.length >= 3) {
      // Rapid tapping -> excited dance!
      tapTimestamps = []
      playClip('dance')
      return
    }

    const cid = options?.characterId
    if (cid === 'unicorn') {
      const picks: AnimationClip[] = ['gallop', 'sparkle', 'jump']
      playClip(picks[Math.floor(Math.random() * picks.length)])
    } else if (cid === 'rabbit') {
      const picks: AnimationClip[] = ['hop', 'bounce', 'jump']
      playClip(picks[Math.floor(Math.random() * picks.length)])
    } else if (cid === 'doll') {
      const picks: AnimationClip[] = ['pirouette', 'bow', 'dance']
      playClip(picks[Math.floor(Math.random() * picks.length)])
    } else if (cid === 'mouse') {
      const picks: AnimationClip[] = ['scurry', 'somersault', 'jump']
      playClip(picks[Math.floor(Math.random() * picks.length)])
    } else {
      const pick = Math.random() > 0.5 ? 'somersault' : 'jump'
      playClip(pick)
    }
  }

  // 4. Background stage scheduler picking spontaneous action clips
  const scheduleRandomAction = () => {
    if (isDestroyed) return
    const delay = 5000 + Math.random() * 7000
    randomActionTimer = setTimeout(() => {
      if (!currentActionAnimation) {
        const cid = options?.characterId
        let pool: AnimationClip[] = ['bounce', 'waddle', 'somersault']
        if (cid === 'unicorn') pool = ['gallop', 'sparkle', 'bounce']
        else if (cid === 'rabbit') pool = ['hop', 'bounce', 'somersault']
        else if (cid === 'doll') pool = ['pirouette', 'bow', 'bounce']
        else if (cid === 'mouse') pool = ['scurry', 'bounce', 'somersault']

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
