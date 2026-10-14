<script setup lang="ts">
// Terms of service (SPEC M2.12). Written for how Highreel works: businesses
// upload their own customers, the Highreels go out from the business's own email
// account or WhatsApp, one price per campaign through Whop. Prerendered.
// What each customer gets is a "Highreel": §2 defines it as their highlight
// reel, and after that the page uses the brand word (owner's ask, 2026-10-12),
// never "recap" (legal.mjs checks the word doesn't come back).
import LegalPage from '~/components/legal/LegalPage.vue'
import { OG_IMAGE } from '~/data/brand'
import { CONTACT_EMAIL, LEGAL_NAME } from '~/data/legal'

definePageMeta({ layout: false })

const description = `The terms for using Highreel, run by ${LEGAL_NAME}: your account, your customers' data, sending, prices, refunds and the law that applies.`
useCanonical('/terms')
useSeoMeta({
  title: 'Terms of service · Highreel',
  description,
  ogTitle: 'Terms of service · Highreel',
  ogDescription: description,
  ogSiteName: 'Highreel',
  ogType: 'website',
  ogImage: siteHref(OG_IMAGE),
  twitterCard: 'summary_large_image',
})
useHead({ meta: [{ name: 'theme-color', content: '#FFFFFF' }], bodyAttrs: { class: 'legal-page' } })

const sections = [
  { id: 'who', title: 'Who we are' },
  { id: 'service', title: 'What Highreel does' },
  { id: 'account', title: 'Your account' },
  { id: 'your-data', title: 'Your data and your customers' },
  { id: 'sending', title: 'Sending Highreels' },
  { id: 'use', title: 'Fair use' },
  { id: 'prices', title: 'Prices, payment and refunds' },
  { id: 'ours', title: 'What\'s ours, what\'s yours' },
  { id: 'availability', title: 'Changes and availability' },
  { id: 'ending', title: 'Ending your use' },
  { id: 'liability', title: 'Warranties and liability' },
  { id: 'law', title: 'The law that applies' },
  { id: 'changes', title: 'Changes to these terms' },
  { id: 'contact', title: 'Contact' },
]
const mail = `mailto:${CONTACT_EMAIL}`
</script>

<template>
  <LegalPage
    title="Terms of service"
    :intro="`These terms are the agreement between ${LEGAL_NAME} and the business that uses Highreel. They're written to be read: if anything is unclear, write to us.`"
    :sections="sections"
  >
    <h2 id="who">1. Who we are</h2>
    <p>Highreel (highreel.app) is run by <strong>{{ LEGAL_NAME }}</strong>, a business registered in Kosovo ("we", "us"). You can reach us at <a :href="mail">{{ CONTACT_EMAIL }}</a>. "You" means the business using Highreel and the person who signs up for it.</p>

    <h2 id="service">2. What Highreel does</h2>
    <p>You upload a sheet with one row per customer. Highreel turns each row into a Highreel: a personal, animated highlight reel of that customer's year, in your brand and your words, published at a private link. You can send the links from your own email account, on WhatsApp, or download them to send any other way. You see who opened, saved and shared their Highreel.</p>
    <p>You can try everything in a demo without an account. A demo lives in your browser until you add your email to keep it.</p>

    <h2 id="account">3. Your account</h2>
    <ul>
      <li>Highreel is for businesses and organisations. By signing up you confirm you're at least 18 and allowed to agree to these terms for your business.</li>
      <li>You sign in with a link sent to your email address, or with your Google account. Keep them secure: whoever can read that inbox or use that Google account can sign in. Tell us straight away if you think someone else has used your account.</li>
      <li>You're responsible for what happens in your account, including anything people you give access to do in it.</li>
    </ul>

    <h2 id="your-data">4. Your data and your customers</h2>
    <p>Your sheets, your customers' details, your logo, photos and wording stay yours. You let us store and process them only to run Highreel for you: to make, host and send your Highreels and show you how they're doing. How we handle them is in our <NuxtLink to="/privacy">privacy policy</NuxtLink>, which also contains our data processing terms. For your customers' data you are the controller and we are your processor.</p>
    <p>Because the data is about your customers, it's on you to have the right to use it this way. In particular:</p>
    <ul>
      <li>Only upload people who are your customers, members or clients, with data you collected lawfully and may use to make them a Highreel.</li>
      <li>Don't upload special categories of data (health, religion, political views, sexual orientation, biometrics and the like), government ID numbers, payment card details or passwords. Highreels are meant for numbers like visits, orders, streaks and favourites.</li>
      <li>Only add photos you're allowed to share with the people receiving them (many camps, clubs and schools already collect a photo release for this).</li>
      <li>Keep the data accurate, and act on your customers' requests to see, correct or delete their data. Deleting a row or a campaign in Highreel deletes it from our service.</li>
    </ul>
    <p>A published Highreel shows a first name, the numbers its slides use and your brand. It never shows an email address, phone number or your customer ID. Anyone who has a Highreel's link can open it, so send each link only to the person it belongs to.</p>

    <h2 id="sending">5. Sending Highreels</h2>
    <ul>
      <li><strong>Email goes out from your own account.</strong> You connect your email account (Gmail, Outlook, your domain's mail server and others), and Highreels are sent from your address, through your provider. You are the sender: your provider's terms and sending limits apply, and the messages count towards your account's reputation.</li>
      <li><strong>Follow the rules on messaging people.</strong> Only send Highreels to customers who expect to hear from you, and follow the laws that apply to you and to them, such as the GDPR and ePrivacy rules in the EU and UK and CAN-SPAM in the US. Every email we send for you has an unsubscribe link. When someone uses it, they get no more Highreels by email from your business, and you can't override that.</li>
      <li><strong>We protect your sending.</strong> We may hold back addresses that look mistyped or whose domain takes no email, skip addresses that bounced before, and stop or pause a send when your mail server refuses messages or too many addresses bounce.</li>
      <li><strong>WhatsApp messages are yours.</strong> Highreel opens a chat with each customer on your own device with the message filled in; you send it.</li>
      <li>We store the password of your email account encrypted, use it only to send your Highreels and the test emails you ask for, and never show it back to anyone.</li>
    </ul>

    <h2 id="use">6. Fair use</h2>
    <p>Don't use Highreel to:</p>
    <ul>
      <li>break the law, or anyone's privacy, intellectual property or other rights;</li>
      <li>send spam, phishing or messages people didn't expect, or pretend to be another business or person;</li>
      <li>publish content that is hateful, harassing, sexual, violent or misleading;</li>
      <li>upload malware, probe or attack the service, get around its limits, or put an unreasonable load on it;</li>
      <li>copy, resell or rebuild the service, or scrape it, without our written permission.</li>
    </ul>
    <p>If an account breaks these rules, we may take down Highreels, pause sending or suspend the account. Where we can, we'll tell you first and give you a chance to fix it.</p>

    <h2 id="prices">7. Prices, payment and refunds</h2>
    <ul>
      <li><strong>One price per campaign.</strong> A campaign is one round of Highreels for one list of customers: your sheet, your brand and wording, and a personal Highreel for everyone on it. You pay once per campaign, by the size of the list, at the price shown on <NuxtLink to="/#pricing">our pricing</NuxtLink> when you buy, before its Highreels are published. If the list later grows past the size you paid for, publishing the extra customers costs the difference to the bigger size. There's no subscription.</li>
      <li><strong>Payments are handled by Whop.</strong> Whop processes the payment and may collect sales tax or VAT where it applies; their terms apply to the payment itself. We never see your card details.</li>
      <li><strong>Price changes</strong> apply to purchases made after the change, never to a campaign you've already paid for. Founding prices are kept for the campaign they were bought for.</li>
      <li><strong>Refunds.</strong> If you haven't sent or shared any Highreel from a paid campaign yet, write to us within 14 days of paying and we'll refund it in full. Once Highreels from it have gone out, we'll work with you to fix whatever isn't right; we refund after that only where the law requires it or where we failed to deliver what we promised.</li>
    </ul>

    <h2 id="ours">8. What's ours, what's yours</h2>
    <p>Highreel's software, design, templates, animations and the Highreel name belong to {{ LEGAL_NAME }}. While you use Highreel, you may use them to make, send and share your Highreels, and your customers may save and share theirs, including the share images. Your content stays yours. If you send us feedback or ideas, we may use them without owing you anything for it.</p>

    <h2 id="availability">9. Changes and availability</h2>
    <p>We work to keep Highreel running and your Highreels online, but we can't promise it will never be interrupted, slow or have mistakes. We keep improving it, so features can change. If we're going to remove something you rely on or close the service, we'll tell you at least 30 days ahead, and give you time to download your links and data.</p>

    <h2 id="ending">10. Ending your use</h2>
    <ul>
      <li>You can stop using Highreel at any time. You can delete Highreels and campaigns in the app; to delete your whole account, write to us from its email address.</li>
      <li>When a campaign is deleted, its Highreel links stop working. When your account is deleted, we delete your data as our <NuxtLink to="/privacy#retention">privacy policy</NuxtLink> describes.</li>
      <li>We may suspend or close an account that seriously or repeatedly breaks these terms, or where the law requires it.</li>
    </ul>

    <h2 id="liability">11. Warranties and liability</h2>
    <p>Highreel is provided "as is". As far as the law allows, we don't give warranties beyond what these terms say, including that it fits a particular purpose.</p>
    <p>As far as the law allows, neither of us is liable to the other for indirect or consequential losses, such as lost profits, revenue or goodwill, and our total liability to you for all claims about Highreel is limited to what you paid us in the 12 months before the claim. Nothing in these terms limits liability that the law doesn't allow to be limited, such as for fraud or for harm caused on purpose.</p>
    <p>You're responsible for the data and content you upload and the messages sent for you. If someone makes a claim against us because of them, or because you broke these terms, you'll cover our reasonable costs of dealing with it.</p>

    <h2 id="law">12. The law that applies</h2>
    <p>These terms are governed by the laws of the Republic of Kosovo. If we disagree about something, let's first try to sort it out by email. If we can't, the competent courts in Prishtina will decide, unless the law gives you the right to go to the courts where you are.</p>

    <h2 id="changes">13. Changes to these terms</h2>
    <p>We'll update these terms when Highreel or the law changes. The date at the top shows the latest version. For changes that matter, we'll email account holders at least 14 days before they apply. If you keep using Highreel after that, the new terms apply; if you don't agree, you can stop and ask us to delete your account.</p>

    <h2 id="contact">14. Contact</h2>
    <p>{{ LEGAL_NAME }}, Kosovo. Email <a :href="mail">{{ CONTACT_EMAIL }}</a>. We reply within a few working days.</p>
  </LegalPage>
</template>
