<script setup lang="ts">
const { $authClient } = useNuxtApp();
const session = $authClient.useSession();
const toast = useToast();

const handleSignOut = async () => {
  try {
    await $authClient.signOut({
      fetchOptions: {
        onSuccess: async () => {
          toast.add({ title: "Signed out successfully" });
          await navigateTo("/", { replace: true, external: true });
        },
        onError: (error) => {
          toast.add({
            title: "Sign out failed",
            description: error?.error?.message || "Unknown error",
          });
        },
      },
    });
  } catch (error: any) {
    toast.add({
      title: "An unexpected error occurred during sign out",
      description: error.message || "Please try again.",
    });
  }
};
</script>

<template>
  <div class="flex items-center gap-2">
    <USkeleton v-if="session.isPending" class="h-9 w-24" />

    <template v-else-if="!session.data">
      <UButton variant="ghost" color="neutral" to="/login" class="font-semibold rounded-xl text-stone-600 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-stone-900">
        Sign In
      </UButton>
      <UButton variant="solid" color="primary" to="/login?signup=true" class="font-bold rounded-xl shadow-md shadow-amber-500/5 hover:shadow-amber-500/15">
        Sign Up
      </UButton>
    </template>

    <UButton
      v-else
      variant="solid"
      color="neutral"
      icon="i-lucide-log-out"
      label="Sign out"
      class="font-semibold rounded-xl hover:bg-stone-200 dark:hover:bg-stone-800"
      @click="handleSignOut()"
    />
  </div>
</template>
