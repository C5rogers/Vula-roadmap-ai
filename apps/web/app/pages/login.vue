<script setup lang="ts">
const { $authClient } = useNuxtApp();
import SignInForm from "~/components/SignInForm.vue";
import SignUpForm from "~/components/SignUpForm.vue";

const route = useRoute();
const session = $authClient.useSession();
const showSignIn = ref(route.query.signup !== "true");

watch(() => route.query.signup, (val) => {
  showSignIn.value = val !== "true";
});

watchEffect(() => {
  if (!session?.value.isPending && session?.value.data) {
    navigateTo("/analytics", { replace: true });
  }
});

useHead({
  title: computed(() => showSignIn.value ? "Sign In — Roadie" : "Create Your Account — Roadie"),
  meta: [
    {
      name: "description",
      content: "Sign in to Roadie to continue unlocking personal AI-generated roadmaps and chatting with your AI learning mentor.",
    },
  ],
});
</script>

<template>
  <div class="min-h-[calc(100vh-4.5rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-stone-50 dark:bg-stone-950">
    <div class="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
      <!-- Left Side (Branding Card, Hidden on Mobile) -->
      <div class="hidden lg:flex flex-col justify-between p-12 bg-stone-900 text-white relative overflow-hidden rounded-2xl border border-stone-800 shadow-xl">
        <!-- subtle glow background -->
        <div class="absolute -top-12 -left-12 w-64 h-64 bg-amber-500/10 blur-3xl rounded-full"></div>
        <div class="absolute -bottom-12 -right-12 w-64 h-64 bg-amber-500/10 blur-3xl rounded-full"></div>
        
        <div>
          <NuxtLink to="/" class="flex items-center gap-2 font-extrabold text-2xl tracking-tight text-white group relative z-10">
            <span class="bg-gradient-to-r from-amber-400 to-amber-300 bg-clip-text text-transparent font-black">RD</span>
            <span>AI</span>
          </NuxtLink>
        </div>

        <div class="space-y-6 relative z-10 max-w-md my-auto">
          <h2 class="text-4xl font-black tracking-tight leading-tight">
            Unlocking the path to <span class="text-amber-400">mastering</span> any subject.
          </h2>
          <p class="text-stone-400 text-sm leading-relaxed">
            Whether you are exploring software architectures, learning acoustic guitar, or mastering sourdough baking — Roadie constructs personal roadmaps, aggregates educational media, and matches you with a tailored AI mentor.
          </p>
          <div class="pt-4 border-t border-stone-800 flex items-center gap-3">
            <div class="h-8 w-8 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs">
              ✨
            </div>
            <div class="text-xs text-stone-400 font-medium">100% Adaptive & Context-Aware Curriculum</div>
          </div>
        </div>

        <div class="relative z-10 text-xs text-stone-500">
          &copy; {{ new Date().getFullYear() }} Roadie. Built for curious minds.
        </div>
      </div>

      <!-- Right Side (Auth Forms Container) -->
      <div class="flex flex-col justify-center py-6 px-4 sm:px-8 bg-white dark:bg-stone-900/40 rounded-2xl border border-stone-200/80 dark:border-stone-800/80 shadow-md backdrop-blur-sm">
        <div v-if="session.isPending" class="flex flex-col items-center justify-center gap-4 py-12">
          <UIcon name="i-lucide-loader-2" class="animate-spin text-4xl text-primary" />
          <span class="text-stone-500 dark:text-stone-400 text-sm">Verifying session...</span>
        </div>
        <div v-else-if="!session.data" class="w-full">
          <div class="text-center mb-6 lg:hidden">
            <h1 class="text-2xl font-black text-stone-900 dark:text-white flex items-center justify-center gap-1.5">
              <span class="bg-gradient-to-r from-amber-600 to-amber-500 dark:from-amber-400 dark:to-amber-300 bg-clip-text text-transparent">RD</span>
              <span>AI</span>
            </h1>
            <p class="text-xs text-stone-500 dark:text-stone-400 mt-1">Unlock your learning path</p>
          </div>
          
          <Transition name="fade" mode="out-in">
            <div :key="showSignIn ? 'signin' : 'signup'">
              <SignInForm v-if="showSignIn" @switch-to-sign-up="showSignIn = false" />
              <SignUpForm v-else @switch-to-sign-in="showSignIn = true" />
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
