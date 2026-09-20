<script setup lang="ts">
/* eslint-disable better-tailwindcss/no-unknown-classes */
import { Mail, Puzzle } from '@lucide/vue'
import {
  GitHubIcon,
  InstagramIcon,
  MastodonIcon,
  TelegramIcon,
  XIcon,
} from 'vue3-simple-icons'

definePageMeta({
  layout: false,
})

const socialLinks = [
  { label: 'Mastodon', href: 'https://h.olo.la/mastodon-holo', icon: MastodonIcon },
  { label: 'X', href: 'https://h.olo.la/x-holo', icon: XIcon },
  { label: 'NeoDB', href: 'https://h.olo.la/neodb-holo', icon: Puzzle },
  { label: 'Instagram', href: 'https://h.olo.la/instagram-holo', icon: InstagramIcon },
  { label: 'Telegram Channel', href: 'https://h.olo.la/haotalk-holo', icon: TelegramIcon },
  { label: 'Email', href: 'mailto:hi@haohailong.com', icon: Mail },
]

useSeoMeta({
  title: '海龙的中转站｜Hailong\'s Hub',
  description: '海龙在互联网各处的入口。',
  ogTitle: '海龙的中转站｜Hailong\'s Hub',
  ogDescription: '海龙在互联网各处的入口。',
  ogType: 'website',
  ogImage: 'https://h.olo.la/hub/favicon.png',
  twitterCard: 'summary',
  twitterTitle: '海龙的中转站｜Hailong\'s Hub',
  twitterDescription: '海龙在互联网各处的入口。',
  twitterImage: 'https://h.olo.la/hub/favicon.png',
})

useHead({
  meta: [
    {
      name: 'theme-color',
      content: '#090a0c',
    },
  ],
})
</script>

<template>
  <div class="hub-page">
    <div class="hub-glow hub-glow-warm" aria-hidden="true" />
    <div class="hub-glow hub-glow-cool" aria-hidden="true" />

    <main class="hub-main">
      <header class="hub-heading">
        <img
          src="/hub/favicon.png"
          alt=""
          width="52"
          height="52"
          class="hub-mark"
        >
        <h1>海龙的中转站<span aria-hidden="true">｜</span><span>Hailong's Hub</span></h1>
      </header>

      <nav class="destinations" aria-label="主要网站">
        <a
          href="https://h.olo.la/blog-holo"
          target="_blank"
          rel="noopener noreferrer"
          class="destination-card"
        >
          <span class="destination-art destination-art-seal">
            <img src="/hub/huanwei-tang.webp" alt="" width="640" height="640">
          </span>
          <span class="destination-label">环尾堂 - Blog</span>
        </a>

        <a
          href="https://h.olo.la/bio-holo"
          target="_blank"
          rel="noopener noreferrer"
          class="destination-card"
        >
          <span class="destination-art destination-art-bio">
            <img src="/hub/bio-link.webp" alt="" width="600" height="600">
          </span>
          <span class="destination-label">Bio</span>
        </a>

        <a
          href="https://h.olo.la/antidotestudio-holo"
          target="_blank"
          rel="noopener noreferrer"
          class="destination-card"
        >
          <span class="destination-art destination-art-studio">
            <img src="/hub/antidote-studio.webp" alt="" width="640" height="640">
          </span>
          <span class="destination-label">Antidote Studio</span>
        </a>

        <a
          href="https://h.olo.la/github-holo"
          target="_blank"
          rel="noopener noreferrer"
          class="destination-card"
        >
          <span class="destination-art destination-art-github">
            <GitHubIcon aria-hidden="true" />
          </span>
          <span class="destination-label">Github</span>
        </a>
      </nav>

      <nav class="social-links" aria-label="社交网络与联系方式">
        <a
          v-for="social in socialLinks"
          :key="social.label"
          :href="social.href"
          :target="social.href.startsWith('mailto:') ? undefined : '_blank'"
          :rel="social.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'"
          :title="social.label"
          :aria-label="social.label"
          class="social-link"
        >
          <component :is="social.icon" aria-hidden="true" />
        </a>
      </nav>
    </main>

    <footer class="hub-footer">
      <a
        href="https://github.com/miantiao-me/Sink"
        target="_blank"
        rel="noopener noreferrer"
      >
        Powered by Sink
        <GitHubIcon aria-hidden="true" />
      </a>
    </footer>
  </div>
</template>

<style scoped>
.hub-page {
  position: relative;
  isolation: isolate;
  display: flex;
  min-height: 100svh;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% -20%, rgb(255 255 255 / 7%), transparent 36rem),
    linear-gradient(160deg, #0c0d10 0%, #08090b 58%, #0d0e11 100%);
  color: #f3f3f1;
}

.hub-page::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background-image:
    linear-gradient(rgb(255 255 255 / 2.2%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 2.2%) 1px, transparent 1px);
  background-size: 48px 48px;
  content: '';
  mask-image: linear-gradient(to bottom, black, transparent 72%);
}

.hub-glow {
  position: absolute;
  z-index: -1;
  width: 28rem;
  height: 28rem;
  border-radius: 999px;
  filter: blur(90px);
  opacity: 0.12;
  pointer-events: none;
}

.hub-glow-warm {
  top: 18%;
  left: -16rem;
  background: #e34234;
}

.hub-glow-cool {
  right: -17rem;
  bottom: 2%;
  background: #087ca0;
}

.hub-main {
  display: flex;
  width: min(100%, 76rem);
  flex: 1;
  flex-direction: column;
  justify-content: center;
  margin: 0 auto;
  padding: clamp(3.25rem, 7vh, 6rem) clamp(1.25rem, 4vw, 3rem) 2.75rem;
}

.hub-heading {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: clamp(2.5rem, 6vh, 4.75rem);
  text-align: center;
}

.hub-mark {
  width: 3.25rem;
  height: 3.25rem;
  margin-bottom: 1.25rem;
  border-radius: 0.9rem;
  box-shadow: 0 12px 30px rgb(227 57 57 / 24%);
}

.hub-heading h1 {
  margin: 0;
  font-size: clamp(1.75rem, 4.2vw, 3.65rem);
  font-weight: 650;
  letter-spacing: -0.045em;
  line-height: 1.08;
  text-wrap: balance;
}

.hub-heading h1 > span:first-child {
  color: #74757a;
  font-weight: 300;
}

.hub-heading h1 > span:last-child {
  color: #b8b9bd;
  font-weight: 420;
}

.destinations {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(0.85rem, 2vw, 1.4rem);
}

.destination-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1rem;
  color: inherit;
  text-decoration: none;
}

.destination-art {
  position: relative;
  display: grid;
  aspect-ratio: 1;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 9%);
  border-radius: 1.5rem;
  background: linear-gradient(145deg, rgb(255 255 255 / 7%), rgb(255 255 255 / 2.5%));
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 5%),
    0 16px 40px rgb(0 0 0 / 20%);
  transition:
    border-color 220ms ease,
    box-shadow 220ms ease,
    transform 220ms ease;
}

.destination-art::after {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 42px rgb(255 255 255 / 2.5%);
  content: '';
  pointer-events: none;
}

.destination-art img {
  width: 72%;
  height: 72%;
  object-fit: contain;
  transition:
    filter 220ms ease,
    transform 220ms ease;
}

.destination-art-seal img {
  width: 76%;
  height: 76%;
  filter: brightness(1.08) saturate(0.9);
}

.destination-art-bio img {
  width: 100%;
  height: 100%;
  filter: contrast(1.04) brightness(0.96);
}

.destination-art-studio img {
  width: 112%;
  height: 112%;
  filter: brightness(1.24) saturate(0.78);
}

.destination-art-github :deep(svg) {
  width: 57%;
  height: 57%;
  color: #dedee0;
}

.destination-label {
  overflow: hidden;
  color: #c8c8ca;
  font-size: clamp(0.86rem, 1.5vw, 1rem);
  font-weight: 520;
  letter-spacing: 0.01em;
  line-height: 1.35;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 220ms ease;
}

.destination-card:hover .destination-art {
  border-color: rgb(255 255 255 / 20%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 8%),
    0 22px 56px rgb(0 0 0 / 34%);
  transform: translateY(-5px);
}

.destination-card:hover .destination-art img {
  filter: brightness(1.16) saturate(1);
  transform: scale(1.025);
}

.destination-card:hover .destination-art-studio img {
  filter: brightness(1.38) saturate(0.9);
}

.destination-card:hover .destination-label {
  color: #fff;
}

.destination-card:focus-visible,
.social-link:focus-visible,
.hub-footer a:focus-visible {
  border-radius: 0.75rem;
  outline: 2px solid #d5d5d7;
  outline-offset: 5px;
}

.social-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.7rem;
  margin-top: clamp(2.75rem, 6vh, 4.5rem);
}

.social-link {
  display: grid;
  width: 2.85rem;
  height: 2.85rem;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 9%);
  border-radius: 999px;
  background: rgb(255 255 255 / 3.5%);
  color: #96979c;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}

.social-link :deep(svg) {
  width: 1.08rem;
  height: 1.08rem;
}

.social-link:hover {
  border-color: rgb(255 255 255 / 19%);
  background: rgb(255 255 255 / 8%);
  color: #f1f1f2;
  transform: translateY(-2px);
}

.hub-footer {
  display: flex;
  justify-content: center;
  padding: 0 1.25rem calc(1.5rem + env(safe-area-inset-bottom));
}

.hub-footer a {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #626368;
  font-size: 0.76rem;
  letter-spacing: 0.02em;
  text-decoration: none;
  transition: color 180ms ease;
}

.hub-footer a:hover {
  color: #a9aaae;
}

.hub-footer :deep(svg) {
  width: 0.85rem;
  height: 0.85rem;
}

@media (max-width: 56rem) {
  .hub-main {
    width: min(100%, 42rem);
  }

  .destinations {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.5rem;
  }

  .destination-art {
    border-radius: 1.35rem;
  }
}

@media (max-width: 34rem) {
  .hub-main {
    justify-content: flex-start;
    padding-top: 2.5rem;
  }

  .hub-heading {
    margin-bottom: 2.5rem;
  }

  .hub-heading h1 > span {
    display: block;
  }

  .hub-heading h1 > span:first-child {
    display: none;
  }

  .hub-heading h1 > span:last-child {
    margin-top: 0.45rem;
    font-size: 0.64em;
    letter-spacing: 0.01em;
  }

  .destinations {
    gap: 1.1rem 0.8rem;
  }

  .destination-card {
    gap: 0.7rem;
  }

  .destination-art {
    border-radius: 1.1rem;
  }

  .destination-label {
    font-size: 0.82rem;
  }

  .social-links {
    margin-top: 2.75rem;
  }
}

@media (max-width: 22rem) {
  .destinations {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .destination-art,
  .destination-art img,
  .destination-label,
  .social-link,
  .hub-footer a {
    transition: none;
  }
}
</style>
