import type { InjectionKey, Ref } from 'vue'
import type { RecapPayload } from '#shared/types/recap'
import type { Tone } from '#shared/utils/color'
import type { Slide } from '#shared/utils/slides'

/** The player's state that scene code (not just CSS) needs: holding pauses the story. */
export const RECAP_CLOCK: InjectionKey<{ held: Ref<boolean>, reduced: Ref<boolean> }> = Symbol('recap-clock')

/** Every scene gets the same props (RecapSlide renders them dynamically). */
export interface SceneProps {
  slide: Slide
  payload: RecapPayload
  tone: Tone
  paper: boolean
  reduced: boolean
}
