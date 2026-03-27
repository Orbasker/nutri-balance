"use server";

import { and, desc, eq } from "drizzle-orm";

import { getSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { chatConversations, chatMessages } from "@/lib/db/schema/chat";

export async function listConversations() {
  const session = await getSession();
  if (!session) return [];

  return db
    .select({
      id: chatConversations.id,
      title: chatConversations.title,
      updatedAt: chatConversations.updatedAt,
    })
    .from(chatConversations)
    .where(eq(chatConversations.userId, session.user.id))
    .orderBy(desc(chatConversations.updatedAt));
}

export async function createConversation() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const [row] = await db
    .insert(chatConversations)
    .values({ userId: session.user.id })
    .returning({ id: chatConversations.id });

  return row.id;
}

export async function loadConversationMessages(conversationId: string) {
  const session = await getSession();
  if (!session) return [];

  // Verify ownership
  const [convo] = await db
    .select({ id: chatConversations.id })
    .from(chatConversations)
    .where(
      and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, session.user.id)),
    );

  if (!convo) return [];

  const rows = await db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      parts: chatMessages.parts,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(chatMessages.createdAt);

  return rows.map((r) => ({
    id: r.id,
    role: r.role as "user" | "assistant",
    parts: r.parts as Array<{ type: string; [key: string]: unknown }>,
    createdAt: r.createdAt,
  }));
}

export async function saveMessages(
  conversationId: string,
  messages: Array<{ id: string; role: string; parts: unknown }>,
) {
  const session = await getSession();
  if (!session) return;

  // Verify ownership
  const [convo] = await db
    .select({ id: chatConversations.id, title: chatConversations.title })
    .from(chatConversations)
    .where(
      and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, session.user.id)),
    );

  if (!convo) return;

  // Get existing message IDs
  const existing = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId));

  const existingIds = new Set(existing.map((e) => e.id));

  // Only insert new messages
  const newMessages = messages.filter((m) => !existingIds.has(m.id));
  if (newMessages.length === 0) return;

  await db.insert(chatMessages).values(
    newMessages.map((m) => ({
      id: m.id,
      conversationId,
      role: m.role,
      parts: m.parts,
    })),
  );

  // Update conversation timestamp
  await db
    .update(chatConversations)
    .set({ updatedAt: new Date() })
    .where(eq(chatConversations.id, conversationId));

  // Auto-generate title from first user message if still "New chat"
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (firstUserMsg && convo.title === "New chat") {
    const parts = firstUserMsg.parts as Array<{ type: string; text?: string }>;
    const text = parts?.find((p) => p.type === "text")?.text ?? "";
    if (text) {
      const title = text.length > 50 ? text.slice(0, 47) + "..." : text;
      await db
        .update(chatConversations)
        .set({ title })
        .where(eq(chatConversations.id, conversationId));
    }
  }
}

export async function updateConversationTitle(conversationId: string, title: string) {
  const session = await getSession();
  if (!session) return;

  await db
    .update(chatConversations)
    .set({ title })
    .where(
      and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, session.user.id)),
    );
}

export async function deleteConversation(conversationId: string) {
  const session = await getSession();
  if (!session) return;

  await db
    .delete(chatConversations)
    .where(
      and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, session.user.id)),
    );
}
