<script setup lang="ts">
// Privacy policy (SPEC M2.12), for both sides: businesses using Highreel (we
// decide about their account data) and their customers who get a Highreel (the
// business decides; we process it for them, terms at the end). Every claim
// here matches the product: first-party counters only (record_recap_event),
// no addresses in the send log, opt-outs and bounces kept per business, SMTP
// passwords encrypted, every workspace query scoped to the signed-in business
// (SPEC M2.14 P1). Prerendered. Like the terms, the
// intro defines a "Highreel" as a customer's Highreel and the page then
// uses the brand word, never "recap" (owner's asks, 2026-10-12).
import LegalPage from '~/components/legal/LegalPage.vue'
import { CONTACT_EMAIL, LEGAL_NAME } from '~/data/legal'

definePageMeta({ layout: false })

const description = `How ${LEGAL_NAME} handles data on Highreel: what businesses give us, what a Highreel shows and records, who sees it, how long we keep it and your rights.`
useCanonical('/privacy')
useSeoMeta({
  title: 'Privacy policy · Highreel',
  description,
  ogTitle: 'Privacy policy · Highreel',
  ogDescription: description,
  ogSiteName: 'Highreel',
  ogType: 'website',
  ogImage: siteHref('/og.png'),
  twitterCard: 'summary_large_image',
})
useHead({ meta: [{ name: 'theme-color', content: '#FFFFFF' }], bodyAttrs: { class: 'legal-page' } })

const sections = [
  { id: 'short', title: 'The short version' },
  { id: 'who', title: 'Who we are' },
  { id: 'businesses', title: 'If you use Highreel for your business' },
  { id: 'customers', title: 'Your customers\' data' },
  { id: 'recipients', title: 'If you received a Highreel' },
  { id: 'cookies', title: 'Cookies and storage' },
  { id: 'sharing', title: 'Who we share data with' },
  { id: 'security', title: 'Security' },
  { id: 'retention', title: 'How long we keep data' },
  { id: 'rights', title: 'Your rights' },
  { id: 'children', title: 'Children' },
  { id: 'processing', title: 'Data processing terms' },
  { id: 'changes', title: 'Changes and contact' },
]
const mail = `mailto:${CONTACT_EMAIL}`
</script>

<template>
  <LegalPage
    title="Privacy policy"
    intro="Highreel holds data about two kinds of people: the businesses that use it, and their customers who get a Highreel, a personal highlight reel of their year. This page says what we collect from each, why, who else sees it and what you can ask of us."
    :sections="sections"
  >
    <h2 id="short">1. The short version</h2>
    <div class="box">
      <ul>
        <li>We don't sell data, show ads or use third-party trackers or analytics, on any page.</li>
        <li>A Highreel shows a first name, some numbers and the business's brand. Never an email address, phone number or customer ID.</li>
        <li>Highreel links are private, unguessable and kept out of search engines.</li>
        <li>Emails with Highreels come from the business's own email account, not from us.</li>
        <li>A business's customer data is theirs: we use it only to make and send their Highreels, and delete it when they do.</li>
      </ul>
    </div>

    <h2 id="who">2. Who we are</h2>
    <p>Highreel (highreel.app) is run by <strong>{{ LEGAL_NAME }}</strong>, based in Kosovo. For the data of businesses that use Highreel, we are the controller. For the customer data a business uploads, the business is the controller and we are its processor (see <a href="#processing">data processing terms</a>). Questions about privacy go to <a :href="mail">{{ CONTACT_EMAIL }}</a>.</p>
    <p>We follow Kosovo's Law on Protection of Personal Data (No. 06/L-082), which is based on the EU's GDPR, and the GDPR itself wherever it applies to you.</p>

    <h2 id="businesses">3. If you use Highreel for your business</h2>
    <h3>What we collect</h3>
    <ul>
      <li><strong>Your account:</strong> your email address (you sign in with a link we email you), and if you sign in with Google where that's offered, the name and email address Google shares with us.</li>
      <li><strong>Sign-in records:</strong> for each session, when it started and was last used, and the IP address and browser it came from, to keep accounts secure. They're deleted when the session ends. Sign-in attempts are also counted per IP address to stop abuse, and those counts are deleted within a day.</li>
      <li><strong>Your business:</strong> its name, logo, brand colour and website, and the Highreels you make: sheets, wording, photos, settings.</li>
      <li><strong>The email account you connect to send Highreels:</strong> its server, login, sending address and name. The password is stored encrypted and only used to send your Highreels and the tests you ask for. It's never shown back, not even to you.</li>
      <li><strong>Payments:</strong> Whop handles them. We learn what you bought and whether it was paid, never your card details.</li>
      <li><strong>Sending records:</strong> when each email was sent and whether it went through, to keep to your email account's daily limit. This log holds no recipient addresses.</li>
    </ul>
    <h3>Why, and on what basis</h3>
    <ul>
      <li>To run Highreel for you and take payment: necessary for our contract with you.</li>
      <li>To keep the service secure, prevent abuse and fix problems: our legitimate interest in a safe, working service.</li>
      <li>To keep accounting records and answer lawful requests: legal obligations.</li>
      <li>To email you about your account, your Highreels and important changes. We don't send marketing emails unless you've agreed to them.</li>
    </ul>
    <h3>The demo</h3>
    <p>You can try Highreel without an account. A demo session is anonymous and lives in your browser. If you never add your email to keep it, we delete it, and everything in it, after 30 days.</p>

    <h2 id="customers">4. Your customers' data</h2>
    <p>When a business uploads its customers, we process that data on the business's behalf and only on its instructions:</p>
    <ul>
      <li><strong>What:</strong> what the sheet holds, usually a customer ID, a first name and numbers about the year (visits, orders, streaks and the like), sometimes an email address or phone number to send the Highreel, and any photos and wording the business adds.</li>
      <li><strong>What for:</strong> making each customer's Highreel, publishing it at a private link, sending it if the business asks, and showing the business who opened, saved and shared it. Nothing else: we don't use it for our own purposes, combine it with other data, sell it or use it to train AI.</li>
      <li><strong>What a Highreel shows:</strong> only the columns its slides use. Email addresses, phone numbers and customer IDs never leave our servers in one.</li>
      <li><strong>Separate from other businesses:</strong> each business sees only its own data. Every request for it is checked against the signed-in account.</li>
    </ul>
    <p>The business is responsible for having the right to use its customers' data this way, and for answering their requests (see our <NuxtLink to="/terms#your-data">terms</NuxtLink>).</p>

    <h2 id="recipients">5. If you received a Highreel</h2>
    <p>A business you're a customer of made your Highreel (your personal highlight reel) with our service, from data it holds about you. That business decides what goes into it; we host and deliver it for them.</p>
    <ul>
      <li><strong>Your Highreel</strong> shows your first name, the numbers on its slides and the business's brand. Anyone with the link can open it, so share it only with people you want to. It's kept out of search engines.</li>
      <li><strong>What we record when you open it:</strong> that it was viewed (how many times, and when first), and whether you saved the image, shared it or tapped the business's button. The business sees these counts. We don't record your IP address with them, and its page sets no cookies and runs no fingerprinting or third-party scripts.</li>
      <li><strong>Link previews:</strong> when your link is shared in a chat or a post, the preview image shows your first name, the business and two of your numbers.</li>
      <li><strong>Emails:</strong> if the business emailed you your Highreel, it came from their own email account. Every one has an unsubscribe link: one click and that business emails you no more Highreels. If an email to you bounced, we remember the address for that business so it isn't tried again.</li>
      <li><strong>Your rights:</strong> to see, correct or delete your data, ask the business that sent your Highreel. You can also write to us at <a :href="mail">{{ CONTACT_EMAIL }}</a>, and we'll pass your request on and help them answer it.</li>
    </ul>

    <h2 id="cookies">6. Cookies and storage</h2>
    <ul>
      <li>Signing in sets a cookie that keeps you signed in to the workspace for 30 days after your last visit. It's needed for the workspace to work and isn't used for anything else.</li>
      <li>The sign-in page, and the box for keeping a demo's work, load Cloudflare Turnstile, which checks that a person, not a bot, is signing in. It looks at signals from your browser for that check only.</li>
      <li>Your browser may keep a light or dark display setting in its local storage.</li>
      <li>We don't set cookies for people viewing a Highreel or our home page, and we use no advertising, analytics or social media cookies, so there's nothing to consent to.</li>
    </ul>

    <h2 id="sharing">7. Who we share data with</h2>
    <p>We use a few providers to run Highreel. They process data only for us, under data processing agreements:</p>
    <ul>
      <li><strong>Cloudflare</strong>: hosting and delivering the site, our database (accounts and sign-in included) and the logos and photos businesses upload, stored in the EU; the bot check on signing in (Turnstile); and sending our sign-in emails. Like any host, it handles visitors' IP addresses to deliver pages and block attacks.</li>
      <li><strong>Whop</strong>: payments, for businesses that buy a campaign.</li>
    </ul>
    <p>Emails with Highreels go through the business's own email provider, which the business chooses and has its own agreement with. WhatsApp messages are sent by the business from its own device.</p>
    <p>Some of these providers may process data outside Kosovo and the European Economic Area. Where they do, we rely on safeguards such as the EU's Standard Contractual Clauses. We'll also share data if the law requires it, and if {{ LEGAL_NAME }} or Highreel is ever sold or merged, the new owner takes on these commitments and we'll tell you first.</p>

    <h2 id="security">8. Security</h2>
    <ul>
      <li>Everything travels over HTTPS. Email account passwords are encrypted before they're stored.</li>
      <li>Every request for a business's data is checked against the signed-in account, so no business can see or change another's.</li>
      <li>Highreel links use long random codes that can't be guessed or listed, and their pages tell search engines not to index them.</li>
      <li>Only the people who need it to run Highreel can reach the production systems.</li>
    </ul>
    <p>If a breach affects your data, we'll tell you without undue delay, and the authorities where the law requires it.</p>

    <h2 id="retention">9. How long we keep data</h2>
    <ul>
      <li><strong>Highreels and customer data</strong>: until the business deletes the campaign or its account. Deleting a campaign deletes its rows, Highreels and photos straight away.</li>
      <li><strong>Unsubscribes and bounced addresses</strong>: kept per business for as long as its account exists, so a later campaign doesn't email those people again.</li>
      <li><strong>Accounts</strong>: until you ask us to delete yours, then within 30 days. We keep a note of the request (your email address and its dates) for 30 days after that, to confirm it to you. Demo sessions that are never kept: 30 days.</li>
      <li><strong>Backups</strong> made by our database provider expire within 30 days. <strong>Payment and accounting records</strong> are kept as long as tax law requires.</li>
    </ul>

    <h2 id="rights">10. Your rights</h2>
    <p>You can ask to see the data we hold about you, correct it, delete it, limit or object to how we use it, or get a copy to take elsewhere. Where we rely on your consent, you can withdraw it at any time. Write to <a :href="mail">{{ CONTACT_EMAIL }}</a>; we answer within 30 days. If your data came to us from a business (you received a Highreel), we'll involve that business, since it decides about your data.</p>
    <p>If you're not happy with our answer, you can complain to Kosovo's Information and Privacy Agency, or to the data protection authority where you live.</p>

    <h2 id="children">11. Children</h2>
    <p>Highreel is for businesses, not for children to use. When a business such as a camp or a school makes Highreels about children, it's responsible for having the right to, as with all its customer data. A parent can ask the business, or us, to take a child's Highreel down.</p>

    <h2 id="processing">12. Data processing terms</h2>
    <p>For businesses: this section and our <NuxtLink to="/terms">terms</NuxtLink> are the data processing agreement between you (controller) and {{ LEGAL_NAME }} (processor) for the customer data you upload, as Article 28 of the GDPR and Kosovo's law require. We will:</p>
    <ul>
      <li>process it only to provide Highreel to you, following your instructions (what you do in the app counts as instructions), unless the law requires otherwise, and tell you if we think an instruction breaks the law;</li>
      <li>make sure anyone who can access it is bound to keep it confidential;</li>
      <li>protect it with the measures in <a href="#security">section 8</a>;</li>
      <li>use only the providers in <a href="#sharing">section 7</a>, under terms that protect the data as well as these do, and tell you before adding or replacing one, so you can object;</li>
      <li>help you answer your customers' requests and meet your own obligations, including security, breach notices and impact assessments;</li>
      <li>tell you without undue delay after we become aware of a breach affecting your data;</li>
      <li>delete it when you delete it in the app, or when our service to you ends, except where the law requires us to keep it;</li>
      <li>give you the information you need to show this agreement is kept, and answer reasonable questions about it.</li>
    </ul>
    <p>The data is about your customers (the people in your sheets): their identifiers, first names, the numbers and details in your columns, and contact details if you add them. We process it for as long as you use Highreel.</p>

    <h2 id="changes">13. Changes and contact</h2>
    <p>When we change this policy, we update the date at the top, and for changes that matter we email account holders before they apply. Questions, requests or complaints: <strong>{{ LEGAL_NAME }}</strong>, <a :href="mail">{{ CONTACT_EMAIL }}</a>.</p>
  </LegalPage>
</template>
