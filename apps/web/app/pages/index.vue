<script setup lang="ts">
const { $authClient } = useNuxtApp();
const session = $authClient.useSession();

const { $orpc } = useNuxtApp();
import { useQuery } from "@tanstack/vue-query";

const healthCheck = useQuery($orpc.healthCheck.queryOptions());

onServerPrefetch(async () => {
  try {
    await healthCheck.suspense();
  } catch {}
});

// Example domains showcase
const sectors = [
  {
    icon: "i-lucide-code-2",
    title: "Technology & Code",
    desc: "From React apps and compiler design to machine learning pipelines.",
    color: "from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400",
  },
  {
    icon: "i-lucide-line-chart",
    title: "Business & Growth",
    desc: "Master financial modeling, content marketing, or negotiation tactics.",
    color: "from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400",
  },
  {
    icon: "i-lucide-languages",
    title: "Languages",
    desc: "Conversational Spanish, advanced Japanese, or grammar fundamentals.",
    color: "from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400",
  },
  {
    icon: "i-lucide-music",
    title: "Arts & Music",
    desc: "Learn jazz guitar theory, watercolor painting, or digital production.",
    color: "from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-400",
  },
  {
    icon: "i-lucide-heart-pulse",
    title: "Health & Science",
    desc: "Dive deep into human biology, sports nutrition, or cognitive science.",
    color: "from-rose-500/20 to-red-500/20 text-rose-600 dark:text-rose-400",
  },
  {
    icon: "i-lucide-hammer",
    title: "Trades & Crafts",
    desc: "Get started with woodworking, culinary essentials, or mechanics.",
    color: "from-stone-500/20 to-amber-700/20 text-stone-700 dark:text-stone-300",
  },
];

// Testimonials (human-centric & warm)
const testimonials = [
  {
    quote: "I wanted to learn how to bake sourdough, but books were too dense. Madar built a day-by-day roadmap tailored to my oven and work schedule, and the AI coach troubleshot my flat loaf in real-time.",
    author: "Elena R.",
    role: "Sourdough Baker & Designer",
    avatar: "E",
  },
  {
    quote: "As a software engineer branching into hardware, I needed a highly customized curriculum. Madar saved me months of aimless searching by mapping out electronics basics with perfect references.",
    author: "Marcus K.",
    role: "Full-Stack Developer",
    avatar: "M",
  },
  {
    quote: "Learning conversational French felt impossible until Madar broke down daily practice milestones. The custom quizzes keep me honest, and the mentor is incredibly encouraging.",
    author: "Amara O.",
    role: "Freelance Copywriter",
    avatar: "A",
  },
];
</script>

<template>
  <div class="relative overflow-hidden bg-stone-50 dark:bg-stone-950">
    <!-- Hero Subtle Glowing Background Circles -->
    <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none overflow-hidden opacity-30 dark:opacity-20">
      <div class="absolute top-[-10%] left-[10%] w-[350px] h-[350px] rounded-full bg-amber-400 blur-[120px] animate-pulse duration-8000"></div>
      <div class="absolute top-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-orange-300 blur-[150px] animate-pulse duration-10000"></div>
    </div>

    <!-- Hero Section -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center relative z-10">
      <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-200/60 dark:border-amber-900/40 bg-amber-500/5 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 text-xs font-semibold tracking-wide mb-6 animate-fade-in">
        <span class="flex h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
        Unlock Any Skill You Imagine
      </div>
      
      <h1 class="text-4xl sm:text-6xl font-extrabold text-stone-900 dark:text-white tracking-tight leading-none max-w-4xl mx-auto">
        Unlock your next skill.<br />
        <span class="bg-gradient-to-r from-amber-600 to-amber-500 dark:from-amber-400 dark:to-amber-300 bg-clip-text text-transparent">AI builds the roadmap.</span>
      </h1>
      
      <p class="mt-6 text-lg sm:text-xl text-stone-600 dark:text-stone-300 max-w-2xl mx-auto font-medium">
        Tell Madar what you want to master. Our adaptive AI designs a complete personalized curriculum, aggregates resources, and coaches you step-by-step from zero to confidence.
      </p>

      <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
        <template v-if="session.isPending">
          <UButton size="xl" disabled icon="i-lucide-loader-2" class="animate-spin min-w-[160px]">
            Loading...
          </UButton>
        </template>
        <template v-else>
          <UButton
            v-if="session.data"
            to="/dashboard"
            size="xl"
            icon="i-lucide-arrow-right"
            trailing
            class="font-semibold shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-all duration-300 rounded-xl"
          >
            Go to Dashboard
          </UButton>
          <UButton
            v-else
            to="/login"
            size="xl"
            icon="i-lucide-sparkles"
            class="font-semibold shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-all duration-300 rounded-xl"
          >
            Get Started — Free
          </UButton>
        </template>
        <a href="#how-it-works" class="text-sm font-semibold text-stone-600 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-500 transition-colors flex items-center gap-1 py-2 px-4 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-900/60">
          How it works
          <UIcon name="i-lucide-arrow-down" class="text-xs" />
        </a>
      </div>

      <!-- Live Interactive Visual Mockup (Interactive elements styled to look beautiful) -->
      <div class="mt-16 sm:mt-20 max-w-5xl mx-auto rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white/60 dark:bg-stone-900/40 shadow-2xl p-2 backdrop-blur-md">
        <div class="bg-stone-50 dark:bg-stone-950/80 rounded-xl border border-stone-200/40 dark:border-stone-800/40 overflow-hidden">
          <!-- Window Controls Header -->
            <div class="flex items-center justify-between px-4 py-3 bg-stone-100/50 dark:bg-stone-900/50 border-b border-stone-200/50 dark:border-stone-800/50">
              <div class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded-full bg-stone-300 dark:bg-stone-800"></span>
                <span class="w-3 h-3 rounded-full bg-stone-300 dark:bg-stone-800"></span>
                <span class="w-3 h-3 rounded-full bg-stone-300 dark:bg-stone-800"></span>
              </div>
              <div class="text-xs font-semibold text-stone-500 dark:text-stone-400">Madar Roadmap Assistant</div>
              <div class="w-12"></div>
            </div>
          
          <!-- Mockup Inside -->
          <div class="grid grid-cols-1 md:grid-cols-3 text-left">
            <!-- Sidebar -->
            <div class="border-r border-stone-200/50 dark:border-stone-800/50 p-4 bg-stone-50/50 dark:bg-stone-950/40">
              <div class="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-3">Your Roadmap</div>
              <div class="font-extrabold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2">
                <span class="p-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">🥐</span>
                French Patisserie 101
              </div>
              <div class="space-y-2">
                <div class="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <UIcon name="i-lucide-play-circle" /> Ch 1: Laminated Doughs
                </div>
                <div class="p-2 rounded hover:bg-stone-100 dark:hover:bg-stone-900 text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2 transition-colors">
                  <UIcon name="i-lucide-circle" /> Ch 2: Choux Pastry (Éclairs)
                </div>
                <div class="p-2 rounded hover:bg-stone-100 dark:hover:bg-stone-900 text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2 transition-colors">
                  <UIcon name="i-lucide-circle" /> Ch 3: Tart Crusts & Fillings
                </div>
              </div>
            </div>
            
            <!-- Main Content Area -->
            <div class="md:col-span-2 p-6 bg-white dark:bg-stone-900/20 flex flex-col justify-between min-h-[300px]">
              <div>
                <div class="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider mb-1">LESSON 1.2</div>
                <h3 class="text-xl font-extrabold text-stone-900 dark:text-stone-100 mb-3">Understanding the Butter Block (Beurrage)</h3>
                <p class="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                  Lamination is the secret behind flaky croissants. To achieve clean, micro-thin layers of fat and flour, your butter block and your dough must be at the exact same temperature—around <strong class="text-amber-600 dark:text-amber-400">15°C (60°F)</strong>. If it's too warm, the butter melts into the dough; too cold, and it breaks during rolling.
                </p>
                <div class="mt-4 p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200/40 dark:border-stone-800/40 flex items-center gap-3">
                  <UIcon name="i-lucide-video" class="text-amber-600 dark:text-amber-500 text-xl flex-shrink-0" />
                  <div class="text-xs">
                    <div class="font-semibold text-stone-800 dark:text-stone-200">Video Demonstration</div>
                    <div class="text-stone-400 dark:text-stone-500">How to lock in and roll the beurrage (4:20)</div>
                  </div>
                </div>
              </div>
              <div class="mt-6 pt-4 border-t border-stone-100 dark:border-stone-800/60 flex items-center justify-between">
                <span class="text-xs text-stone-400 dark:text-stone-500">Adaptive Progress: 18% done</span>
                <UButton size="xs" color="primary" class="font-semibold rounded-lg">Mark as Complete</UButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works Section (About) -->
    <section id="about" class="py-20 sm:py-28 bg-white dark:bg-stone-900/10 border-y border-stone-200/50 dark:border-stone-800/50 relative z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto">
          <h2 class="text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-white tracking-tight">
            How Madar Unlocks Your Potential
          </h2>
          <p class="mt-4 text-stone-600 dark:text-stone-300 text-lg">
            No rigid templates, no generic templates. A dynamic, adaptive loop designed specifically for the way humans actually acquire knowledge.
          </p>
        </div>

        <div class="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <!-- Step 1 -->
          <div class="flex flex-col p-6 rounded-2xl bg-stone-50 dark:bg-stone-900/30 border border-stone-200/60 dark:border-stone-800/60 group hover:border-amber-500/30 hover:shadow-xl hover:shadow-amber-500/[0.02] transition-all duration-300">
            <div class="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg mb-6 group-hover:scale-110 transition-transform duration-300">
              1
            </div>
            <h3 class="text-lg font-bold text-stone-900 dark:text-stone-100 mb-3">Describe Your Goal</h3>
            <p class="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
              Tell Madar what you want to learn in plain text. Mention your current context, constraints, and timeline. No domain is too niche, technical, or unconventional.
            </p>
          </div>

          <!-- Step 2 -->
          <div class="flex flex-col p-6 rounded-2xl bg-stone-50 dark:bg-stone-900/30 border border-stone-200/60 dark:border-stone-800/60 group hover:border-amber-500/30 hover:shadow-xl hover:shadow-amber-500/[0.02] transition-all duration-300">
            <div class="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg mb-6 group-hover:scale-110 transition-transform duration-300">
              2
            </div>
            <h3 class="text-lg font-bold text-stone-900 dark:text-stone-100 mb-3">Tailored AI Syllabus</h3>
            <p class="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
              Our AI designs an organized, multi-chapter roadmap. Every step comes loaded with lessons, curated articles, videos, actionable guides, and self-assessment quizzes.
            </p>
          </div>

          <!-- Step 3 -->
          <div class="flex flex-col p-6 rounded-2xl bg-stone-50 dark:bg-stone-900/30 border border-stone-200/60 dark:border-stone-800/60 group hover:border-amber-500/30 hover:shadow-xl hover:shadow-amber-500/[0.02] transition-all duration-300">
            <div class="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg mb-6 group-hover:scale-110 transition-transform duration-300">
              3
            </div>
            <h3 class="text-lg font-bold text-stone-900 dark:text-stone-100 mb-3">Personal Adaptive Mentorship</h3>
            <p class="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
              Chat directly with your contextual AI coach. It knows your roadmap, answers questions in real-time, designs bespoke drills, and simplifies complex topics on request.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Sector Showcase -->
    <section class="py-20 sm:py-28 relative z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto mb-16">
          <h2 class="text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-white tracking-tight">
            Designed for Any Domain
          </h2>
          <p class="mt-4 text-stone-600 dark:text-stone-300 text-lg">
            Human curiosity shouldn't be limited to coding. Madar understands and formulates structured roadmaps for tech, crafts, arts, languages, and more.
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="sect in sectors"
            :key="sect.title"
            class="p-6 rounded-2xl border border-stone-200/60 dark:border-stone-800/60 bg-white/40 dark:bg-stone-900/20 flex gap-4 hover:-translate-y-1 transition-all duration-300 hover:shadow-lg hover:shadow-stone-200/30 dark:hover:shadow-black/20"
          >
            <div :class="['h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0', sect.color]">
              <UIcon :name="sect.icon" class="text-xl" />
            </div>
            <div>
              <h3 class="font-bold text-stone-900 dark:text-stone-100 mb-1.5">{{ sect.title }}</h3>
              <p class="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">{{ sect.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Social Proof / Testimonials Section -->
    <section class="py-20 sm:py-28 bg-stone-100/50 dark:bg-stone-900/30 border-t border-stone-200/50 dark:border-stone-800/50 relative z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto mb-16">
          <h2 class="text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-white tracking-tight">
            Real Stories from Active Learners
          </h2>
          <p class="mt-4 text-stone-600 dark:text-stone-300 text-lg">
            See how others are carving out paths to competence outside and inside traditional classrooms.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div
            v-for="t in testimonials"
            :key="t.author"
            class="p-6 rounded-2xl border border-stone-200/40 dark:border-stone-800/40 bg-white dark:bg-stone-950 flex flex-col justify-between hover:shadow-lg transition-shadow duration-300"
          >
            <p class="text-sm text-stone-600 dark:text-stone-300 italic leading-relaxed">
              "{{ t.quote }}"
            </p>
            <div class="mt-6 flex items-center gap-3 pt-4 border-t border-stone-100 dark:border-stone-900">
              <div class="h-8 w-8 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs uppercase">
                {{ t.avatar }}
              </div>
              <div>
                <div class="text-sm font-bold text-stone-900 dark:text-stone-100">{{ t.author }}</div>
                <div class="text-xs text-stone-400 dark:text-stone-500">{{ t.role }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Fun Counter Stats -->
        <div class="mt-16 pt-12 border-t border-stone-200/50 dark:border-stone-800/50 text-center">
          <div class="grid grid-cols-2 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div>
              <div class="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-500">100%</div>
              <div class="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mt-1">Syllabus Personalization</div>
            </div>
            <div>
              <div class="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-500">1000+</div>
              <div class="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mt-1">Curious Topics Explored</div>
            </div>
            <div class="col-span-2 md:col-span-1">
              <div class="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-500">24/7</div>
              <div class="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mt-1">AI Coach Support</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Contact Section -->
    <section id="contact" class="py-20 sm:py-28 bg-stone-100/30 dark:bg-stone-900/10 border-t border-stone-200/50 dark:border-stone-800/50 relative z-10">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto mb-12">
          <h2 class="text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-white tracking-tight">
            Connect With Roadie Support
          </h2>
          <p class="mt-4 text-stone-600 dark:text-stone-300 text-lg">
            Got questions, feedback, or custom requests? Our human-centered team is ready to assist you on your journey.
          </p>
        </div>

        <div class="rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white/60 dark:bg-stone-950/40 p-8 shadow-xl backdrop-blur-sm">
          <form @submit.prevent class="space-y-6 text-left">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label class="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">Name</label>
                <input type="text" placeholder="Your name" class="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors text-sm" />
              </div>
              <div>
                <label class="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">Email Address</label>
                <input type="email" placeholder="you@example.com" class="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors text-sm" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">Message</label>
              <textarea rows="4" placeholder="How can we help you unlock your next skill?" class="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors text-sm resize-none"></textarea>
            </div>
            <div class="text-right">
              <UButton type="submit" size="lg" color="primary" class="font-bold rounded-xl shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-all duration-300">
                Send Message
              </UButton>
            </div>
          </form>
        </div>
      </div>
    </section>

    <!-- Final Call to Action -->
    <section class="py-20 sm:py-28 text-center relative z-10 overflow-hidden">
      <!-- Glow behind final CTA -->
      <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none"></div>

      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <h2 class="text-3xl sm:text-5xl font-black text-stone-900 dark:text-white tracking-tight">
          Ready to open your next chapter?
        </h2>
        <p class="mt-4 text-stone-600 dark:text-stone-300 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
          Unlock potential, shape pathways, and structure your learning. Describe your goal, and let Madar prepare your journey.
        </p>
        <div class="mt-8">
          <template v-if="session.isPending">
            <UButton size="xl" disabled icon="i-lucide-loader-2" class="animate-spin min-w-[160px]">
              Loading...
            </UButton>
          </template>
          <template v-else>
            <UButton
              v-if="session.data"
              to="/dashboard"
              size="xl"
              icon="i-lucide-arrow-right"
              trailing
              class="font-semibold shadow-xl shadow-amber-500/10 hover:shadow-amber-500/20 transition-all duration-300 rounded-xl px-8"
            >
              Go to Dashboard
            </UButton>
            <UButton
              v-else
              to="/login"
              size="xl"
              icon="i-lucide-sparkles"
              class="font-semibold shadow-xl shadow-amber-500/10 hover:shadow-amber-500/20 transition-all duration-300 rounded-xl px-8"
            >
              Start Learning Now — Free
            </UButton>
          </template>
        </div>
      </div>
    </section>

    <!-- Clean Developer API Connection Status Footer Element -->
    <div class="py-4 border-t border-stone-200/30 dark:border-stone-800/30 bg-stone-100/20 dark:bg-stone-950/20 text-center relative z-10">
      <div class="flex items-center justify-center gap-2 text-xs text-stone-400 dark:text-stone-500">
        <span class="inline-block w-2 h-2 rounded-full" :class="[
          healthCheck.isLoading.value ? 'bg-amber-400 animate-pulse' : '',
          healthCheck.isSuccess.value ? 'bg-amber-500' : '',
          healthCheck.isError.value ? 'bg-rose-500' : ''
        ]"></span>
        <span>
          <template v-if="healthCheck.isLoading.value">Verifying API connection...</template>
          <template v-else-if="healthCheck.isSuccess.value">Madar Systems Operational ({{ healthCheck.data.value }})</template>
          <template v-else>API connection failed (unregistered environment)</template>
        </span>
      </div>
    </div>
  </div>
</template>
