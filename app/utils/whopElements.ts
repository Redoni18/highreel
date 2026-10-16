// Whop Elements, the embedded checkout (SPEC §10; docs.whop.com, "Embed a
// Checkout"): its script loads from Whop's CDN the first time a payment step
// opens, never on other pages (and never on /r). The checkout itself renders
// in Whop's frames: card numbers never touch our page.

export interface WhopCheckoutCompletion {
  result: 'payment' | 'waitlist_entry' | 'setup'
  sessionId: string
  paymentId?: string
}

export interface WhopCheckoutOptions {
  checkoutConfiguration: string
  returnUrl?: string
  appearance?: {
    theme?: { appearance?: 'light' | 'dark', accentColor?: string, grayColor?: string }
    variables?: Record<string, string>
    classes?: Record<string, Record<string, string>>
  }
  onComplete?: (completion: WhopCheckoutCompletion) => void
  onLoadingChange?: (loading: boolean) => void
}

interface WhopElement {
  mount: (target: string | HTMLElement) => void
}
export interface WhopCheckoutHandle {
  /** `buyerEmail` prefills the email field; the buyer can still change it. */
  create: (kind: 'checkout', props?: { buyerEmail?: string }) => WhopElement
  /** Restyles the mounted elements in place (`appearance`). */
  update: (options: Pick<WhopCheckoutOptions, 'appearance'>) => void
  destroy: () => void
}
interface WhopElementsInstance {
  checkout: { create: (options: WhopCheckoutOptions) => WhopCheckoutHandle }
}
type WhopElementsFactory = (options?: { environment?: 'production' | 'sandbox', toasts?: boolean }) => WhopElementsInstance

const SCRIPT = 'https://cdn.whop.com/elements/amber/elements.js'
let loading: Promise<WhopElementsFactory> | null = null

/** The Elements factory, loading Whop's script once; rejects if it can't load (a blocker, offline). */
export function loadWhopElements(timeoutMs = 20_000): Promise<WhopElementsFactory> {
  const ready = () => (window as { WhopElements?: WhopElementsFactory }).WhopElements
  if (ready())
    return Promise.resolve(ready()!)
  loading ??= new Promise<WhopElementsFactory>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.dataset.whopElements = ''
    const timer = setTimeout(() => fail(new Error('Whop\'s checkout took too long to load')), timeoutMs)
    function fail(e: Error) {
      clearTimeout(timer)
      loading = null
      script.remove()
      reject(e)
    }
    script.onload = () => {
      clearTimeout(timer)
      const factory = ready()
      factory ? resolve(factory) : fail(new Error('Whop\'s checkout didn\'t start'))
    }
    script.onerror = () => fail(new Error('Whop\'s checkout couldn\'t load'))
    document.head.appendChild(script)
  })
  return loading
}
