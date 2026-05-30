<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const props = defineProps<{
  activeLessonTitle?: string;
  contextPrompt?: string;
}>();

const emit = defineEmits(["close", "newMessage"]);

const status = ref<"idle" | "listening" | "processing" | "speaking" | "error">("idle");
const userSpeech = ref("");
const aiReply = ref("");

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
      status.value = "error";
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

    const res = await fetch(`${serverUrl}/ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
    
    // Clean up text response (Gemini streams can have text-delta formatting; clean text here)
    const cleanedText = text
      .replace(/0:"/g, "")
      .replace(/\\n/g, " ")
      .replace(/"/g, "")
      .replace(/[*#_`]/g, "")
      .trim();

    aiReply.value = cleanedText;
    emit("newMessage", { role: "assistant", content: cleanedText });
    speak(cleanedText);
  } catch (error) {
    console.error("Voice AI error:", error);
    status.value = "error";
  }
}

function startListening() {
  if (recognition) {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    recognition.start();
  } else {
    alert("Speech recognition is not supported in this browser. Please use Google Chrome or Safari.");
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
  <div class="fixed inset-0 bg-stone-950/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 animate-fade-in">
    <!-- Close button -->
    <UButton
      icon="i-lucide-x"
      color="neutral"
      variant="ghost"
      class="absolute top-6 right-6 rounded-xl hover:bg-stone-800"
      size="xl"
      @click="emit('close')"
    />

    <div class="max-w-md w-full text-center space-y-8 flex flex-col items-center justify-center">
      <div class="space-y-2">
        <span class="text-xs font-bold text-amber-500 uppercase tracking-widest">Interactive Modality</span>
        <h2 class="text-3xl font-black text-white tracking-tight">Voice AI Mentor</h2>
        <p class="text-stone-400 text-sm leading-relaxed">
          {{ activeLessonTitle ? `Active Lesson: ${activeLessonTitle}` : "Speak directly with your custom tailored learning guide." }}
        </p>
      </div>

      <!-- Pulsing Circle Core -->
      <div class="relative flex items-center justify-center h-48 w-48">
        <!-- Outer pulsars -->
        <div
          v-if="status === 'listening' || status === 'speaking'"
          class="animate-ping absolute inline-flex h-36 w-36 rounded-full bg-amber-500/20 opacity-75"
        ></div>
        <div
          v-if="status === 'speaking'"
          class="animate-ping absolute inline-flex h-44 w-44 rounded-full bg-amber-500/10 opacity-50 duration-1000"
        ></div>
        
        <!-- Main Core Circle -->
        <button
          @click="startListening"
          class="relative h-32 w-32 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 border focus:outline-none cursor-pointer"
          :class="[
            status === 'listening' ? 'bg-amber-500 border-amber-400 text-stone-950 scale-110 shadow-amber-500/30' : '',
            status === 'speaking' ? 'bg-stone-900 border-amber-500 text-amber-500' : '',
            status === 'processing' ? 'bg-stone-800 border-stone-700 text-stone-400 animate-pulse' : '',
            status === 'idle' || status === 'error' ? 'bg-stone-900 border-stone-800 text-stone-200 hover:border-amber-500/50 hover:text-amber-400' : ''
          ]"
        >
          <UIcon
            :name="[
              status === 'listening' ? 'i-lucide-mic' : '',
              status === 'speaking' ? 'i-lucide-volume-2' : '',
              status === 'processing' ? 'i-lucide-loader-2' : '',
              status === 'idle' || status === 'error' ? 'i-lucide-mic-off' : ''
            ].join('') || 'i-lucide-mic'"
            class="h-10 w-10"
            :class="status === 'processing' ? 'animate-spin' : ''"
          />
          <span class="text-[9px] font-bold uppercase tracking-widest mt-2">
            {{ status }}
          </span>
        </button>
      </div>

      <!-- Real-time caption boxes -->
      <div class="w-full space-y-4 min-h-[100px]">
        <!-- User caption -->
        <div v-if="userSpeech" class="bg-stone-900/60 border border-stone-800/80 rounded-xl p-4 text-left animate-fade-in">
          <span class="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">You said:</span>
          <p class="text-xs text-stone-200 font-medium leading-relaxed">{{ userSpeech }}</p>
        </div>

        <!-- AI caption -->
        <div v-if="aiReply" class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-left animate-fade-in">
          <span class="text-[10px] font-bold text-amber-500 uppercase tracking-wider block mb-1">Mentor reply:</span>
          <p class="text-xs text-amber-100 font-medium leading-relaxed">{{ aiReply }}</p>
        </div>
      </div>

      <div class="text-xs text-stone-500">
        {{ status === 'idle' ? 'Click the circle to start speaking.' : '' }}
        {{ status === 'listening' ? 'Speaking now... Click to stop or wait to finish.' : '' }}
        {{ status === 'processing' ? 'Thinking...' : '' }}
        {{ status === 'speaking' ? 'Listening to voice mentor response.' : '' }}
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
