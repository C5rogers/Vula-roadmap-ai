<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const { $authClient } = useNuxtApp();
const session = $authClient.useSession();

const props = defineProps<{
  activeLessonTitle?: string;
  contextPrompt?: string;
}>();

const emit = defineEmits(["close", "newMessage"]);

const status = ref<"idle" | "listening" | "processing" | "speaking" | "error">("idle");
const userSpeech = ref("");
const aiReply = ref("");

const isKeyboardMode = ref(false);
const textInput = ref("");

let recognition: any = null;

onMounted(() => {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    
    recognition.onstart = () => {
      status.value = "listening";
      userSpeech.value = "";
    };
    
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      userSpeech.value = transcript;
      status.value = "processing";  
      await fetchAIResponse(transcript);
    };
    
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event);
      // Gracefully fall back to Keyboard text input mode if speech recognition fails, is blocked, or times out
      isKeyboardMode.value = true;
      status.value = "idle";
    };
    
    recognition.onend = () => {
      if (status.value === "listening") {
        status.value = "idle";
      }
    };
  }
});

async function fetchAIResponse(prompt: string) {
  try {
    const config = useRuntimeConfig();
    const serverUrl = config.public.serverUrl || "http://localhost:3000";
    
    const messages = [
      {
        id: "sys-" + Date.now(),
        role: "system",
        content: `You are an encouraging, elite Voice AI Mentor assisting a student. Respond in exactly 1 or 2 short sentences. Do not use markdown syntax like asterisks. Context: ${props.contextPrompt || "General Learning"}`
      },
      {
        id: "user-" + Date.now(),
        role: "user",
        content: prompt
      }
    ];

    const uId = session.value?.data?.user?.id || "";
    const res = await fetch(`${serverUrl}/ai?userId=${uId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) throw new Error("API call failed");

    // Read full text response
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let text = "";
    
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
    } else {
      text = await res.text();
    }
    
    const cleanedText = text.replace(/[*#_`]/g, "").trim();

    aiReply.value = cleanedText;
    emit("newMessage", { role: "assistant", content: cleanedText });
    speak(cleanedText);
  } catch (error) {
    console.error("Voice AI error:", error);
    status.value = "error";
  }
}

function handleTextSubmit() {
  if (!textInput.value.trim()) return;
  const prompt = textInput.value;
  userSpeech.value = prompt;
  textInput.value = "";
  status.value = "processing";
  fetchAIResponse(prompt);
}

function startListening() {
  if (recognition) {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    recognition.start();
  } else {
    isKeyboardMode.value = true;
  }
}

function speak(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onstart = () => {
    status.value = "speaking";
  };
  utterance.onend = () => {
    status.value = "idle";
  };
  utterance.onerror = () => {
    status.value = "idle";
  };
  
  window.speechSynthesis.speak(utterance);
}

onUnmounted(() => {
  if (recognition) recognition.abort();
  if (window.speechSynthesis) window.speechSynthesis.cancel();
});
</script>

<template>
  <div class="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" @click.self="emit('close')">
    <div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-lg w-full relative animate-fade-in flex flex-col items-center">
      <!-- Close button -->
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        class="absolute top-4 right-4 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800"
        size="md"
        @click="emit('close')"
      />

      <div class="space-y-6 w-full text-center flex flex-col items-center justify-center">
        <div class="space-y-1.5">
          <span class="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest">Interactive Mentor</span>
          <h2 class="text-2xl font-black text-stone-900 dark:text-white tracking-tight">Voice AI Mentor</h2>
          <p class="text-stone-500 dark:text-stone-400 text-xs leading-relaxed">
            {{ activeLessonTitle ? `Active Lesson: ${activeLessonTitle}` : "Speak or type directly with your custom tailored learning guide." }}
          </p>
        </div>

        <!-- Pulsing Circle Core -->
        <div v-if="!isKeyboardMode" class="relative flex items-center justify-center h-40 w-40">
          <!-- Outer pulsars -->
          <div
            v-if="status === 'listening' || status === 'speaking'"
            class="animate-ping absolute inline-flex h-28 w-28 rounded-full bg-amber-500/20 opacity-75"
          ></div>
          <div
            v-if="status === 'speaking'"
            class="animate-ping absolute inline-flex h-36 w-36 rounded-full bg-amber-500/10 opacity-50 duration-1000"
          ></div>
          
          <!-- Main Core Circle -->
          <button
            @click="startListening"
            class="relative h-28 w-28 rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-300 border focus:outline-none cursor-pointer"
            :class="[
              status === 'listening' ? 'bg-amber-500 border-amber-400 text-stone-950 scale-105 shadow-amber-500/25' : '',
              status === 'speaking' ? 'bg-stone-900 border-amber-500 text-amber-500' : '',
              status === 'processing' ? 'bg-stone-800 border-stone-700 text-stone-400 animate-pulse' : '',
              status === 'idle' || status === 'error' ? 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:border-amber-500/50 hover:text-amber-500' : ''
            ]"
          >
            <UIcon
              :name="[
                status === 'listening' ? 'i-lucide-mic' : '',
                status === 'speaking' ? 'i-lucide-volume-2' : '',
                status === 'processing' ? 'i-lucide-loader-2' : '',
                status === 'idle' || status === 'error' ? 'i-lucide-mic' : ''
              ].join('') || 'i-lucide-mic'"
              class="h-8 w-8"
              :class="status === 'processing' ? 'animate-spin' : ''"
            />
            <span class="text-[8px] font-black uppercase tracking-widest mt-1.5">
              {{ status }}
            </span>
          </button>
        </div>

        <!-- Mode Toggles / Fallback Input form -->
        <div class="w-full space-y-4">
          <!-- Text Input Mode -->
          <div v-if="isKeyboardMode" class="space-y-2 animate-fade-in w-full text-left">
            <span class="text-[10px] font-black text-stone-400 uppercase tracking-wider block mb-1">Type your question:</span>
            <form @submit.prevent="handleTextSubmit" class="flex gap-2 w-full">
              <UInput
                v-model="textInput"
                placeholder="Ask your mentor a question..."
                class="flex-grow rounded-xl"
                autocomplete="off"
                :disabled="status === 'processing'"
              />
              <UButton
                type="submit"
                color="primary"
                icon="i-lucide-send"
                class="rounded-xl cursor-pointer"
                :disabled="!textInput.trim() || status === 'processing'"
              />
            </form>
          </div>

          <!-- Mode Toggle buttons -->
          <div class="flex justify-center gap-3">
            <UButton
              variant="ghost"
              color="neutral"
              :icon="isKeyboardMode ? 'i-lucide-mic' : 'i-lucide-keyboard'"
              :label="isKeyboardMode ? 'Switch to Voice' : 'Switch to Keyboard'"
              class="text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800"
              size="xs"
              @click="isKeyboardMode = !isKeyboardMode; status = 'idle'"
            />
          </div>
        </div>

        <!-- Real-time caption boxes -->
        <div class="w-full space-y-4 min-h-[100px]">
          <!-- User caption -->
          <div v-if="userSpeech" class="bg-stone-50 dark:bg-stone-950/60 border border-stone-200/50 dark:border-stone-800/85 rounded-2xl p-4 text-left animate-fade-in shadow-sm">
            <span class="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider block mb-1">You said:</span>
            <p class="text-xs text-stone-800 dark:text-stone-200 font-medium leading-relaxed">{{ userSpeech }}</p>
          </div>

          <!-- AI caption -->
          <div v-if="aiReply" class="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-4 text-left animate-fade-in">
            <span class="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider block mb-1">Mentor reply:</span>
            <p class="text-xs text-amber-950 dark:text-amber-100 font-medium leading-relaxed">{{ aiReply }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-pulse-fast {
  animation: pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: .5;
    transform: scale(1.05);
  }
}
</style>
