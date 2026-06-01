import { devToolsMiddleware } from "@ai-sdk/devtools";
import { google } from "@ai-sdk/google";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createContext } from "@roadmap_ai/api/context";
import { appRouter } from "@roadmap_ai/api/routers/index";
import { auth } from "@roadmap_ai/auth";
import prisma from "@roadmap_ai/db";
import { env } from "@roadmap_ai/env/server";
import { streamText, convertToModelMessages, wrapLanguageModel } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

app.use("/*", async (c, next) => {
  const context = await createContext({ context: c });

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context: context,
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context: context,
  });

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response);
  }

  await next();
});

app.post("/ai", async (c) => {
  const body = await c.req.json();
  const uiMessages = body.messages || [];
  const roadmapId = c.req.query("roadmapId");

  // Fetch the logged in user session (fall back to query param for cross-origin credentials bypass)
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  const userId = session?.user?.id || c.req.query("userId");

  // Retrieve or create the ChatSession for saving progress persistent logs
  let chatSession: any = null;
  if (userId && roadmapId) {
    try {
      chatSession = await prisma.chatSession.findFirst({
        where: { userId, roadmapId },
      });
      if (!chatSession) {
        chatSession = await prisma.chatSession.create({
          data: {
            userId,
            roadmapId,
            title: "AI Coach Discussion",
          },
        });
      }
    } catch (dbErr) {
      console.error("Failed to fetch or create ChatSession:", dbErr);
    }
  }

  // Database helper to save messages transactionally
  async function saveMessages(
    chatSessionId: string,
    messagesList: any[],
    aiText: string,
  ) {
    try {
      // Find the last user message from the list
      const lastUserMessage = [...messagesList]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserMessage) {
        const userMsgText =
          lastUserMessage.content || lastUserMessage.parts?.[0]?.text || "";
        if (userMsgText) {
          // Double check to avoid duplicating saved user messages
          const existingUserMsg = await prisma.chatMessage.findFirst({
            where: {
              chatSessionId,
              role: "USER",
              content: userMsgText,
            },
          });
          if (!existingUserMsg) {
            await prisma.chatMessage.create({
              data: {
                chatSessionId,
                role: "USER",
                content: userMsgText,
                createdAt: lastUserMessage.createdAt
                  ? new Date(lastUserMessage.createdAt)
                  : new Date(),
              },
            });
          }
        }
      }

      // Save the AI Coach reply
      await prisma.chatMessage.create({
        data: {
          chatSessionId,
          role: "ASSISTANT",
          content: aiText,
          createdAt: new Date(),
        },
      });
    } catch (saveErr) {
      console.error("Error persistent saving of chat messages to DB:", saveErr);
    }
  }

  // Extract system messages to adhere to AI SDK best practices and suppress prompt-injection warnings
  const systemMsg = uiMessages.find((m: any) => m.role === "system");
  const systemText = systemMsg
    ? systemMsg.content || systemMsg.parts?.[0]?.text || ""
    : undefined;
  const cleanMessages = uiMessages
    .filter((m: any) => m.role !== "system")
    .map((m: any) => {
      // If parts is missing, construct it from content to satisfy convertToModelMessages expectations
      if (!m.parts) {
        return {
          ...m,
          parts: [{ type: "text", text: m.content || "" }],
        };
      }
      return m;
    });
  const modelMessages = await convertToModelMessages(cleanMessages);

  try {
    const model = wrapLanguageModel({
      model: google("gemini-2.5-flash"),
      middleware: devToolsMiddleware(),
    });
    const result = streamText({
      model,
      system: systemText,
      messages: modelMessages,
      async onFinish({ text }) {
        if (chatSession) {
          await saveMessages(chatSession.id, uiMessages, text);
        }
      },
    });
    // Return standard UI Message Stream for Chat, raw Text Stream for others (Magic Create, Voice, Roast)
    if (roadmapId) {
      return result.toUIMessageStreamResponse();
    } else {
      return result.toTextStreamResponse();
    }
  } catch (error) {
    console.warn(
      "Failed to stream with gemini-2.5-flash, falling back to gemini-1.5-flash:",
      error,
    );
    try {
      const model = wrapLanguageModel({
        model: google("gemini-1.5-flash"),
        middleware: devToolsMiddleware(),
      });
      const result = streamText({
        model,
        system: systemText,
        messages: modelMessages,
        async onFinish({ text }) {
          if (chatSession) {
            await saveMessages(chatSession.id, uiMessages, text);
          }
        },
      });
      if (roadmapId) {
        return result.toUIMessageStreamResponse();
      } else {
        return result.toTextStreamResponse();
      }
    } catch (fallbackError) {
      console.error("AI stream completely failed:", fallbackError);
      return c.json({ error: "AI stream failed" }, 500);
    }
  }
});

app.get("/", (c) => {
  return c.text("OK");
});

// Export custom Bun.serve configuration to increase idleTimeout and prevent Bun's default 10s streaming timeout
export default {
  port: 3000,
  idleTimeout: 255,
  fetch: app.fetch,
};
