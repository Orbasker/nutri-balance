"use client";

import { useEffect, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { deleteConversation, listConversations } from "@/app/(app)/chat/actions";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string;
  updatedAt: Date;
}

export function ChatSidebar({
  activeId,
  open,
  onOpenChange,
}: {
  activeId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      listConversations().then(setConversations);
    }
  }, [open]);

  function handleSelect(id: string) {
    onOpenChange(false);
    router.push(`/chat/${id}`);
  }

  function handleNewChat() {
    onOpenChange(false);
    router.push("/chat");
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    startTransition(async () => {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        router.push("/chat");
      }
    });
  }

  function formatDate(date: Date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0 w-[280px] sm:max-w-[280px]">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle>Chat History</SheetTitle>
        </SheetHeader>

        <div className="px-3 py-2">
          <button
            type="button"
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-24 space-y-1">
          {conversations.length === 0 && !isPending && (
            <p className="text-xs text-slate-400 text-center py-8">No conversations yet</p>
          )}

          {conversations.map((convo) => (
            <button
              key={convo.id}
              type="button"
              onClick={() => handleSelect(convo.id)}
              className={cn(
                "w-full text-left group flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors",
                activeId === convo.id
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-50",
              )}
            >
              <span className="material-symbols-outlined text-base opacity-50 flex-shrink-0">
                chat_bubble_outline
              </span>
              <div className="flex-1 min-w-0">
                <div className="truncate">{convo.title}</div>
                <div className="text-[11px] text-slate-400">{formatDate(convo.updatedAt)}</div>
              </div>
              <button
                type="button"
                onClick={(e) => handleDelete(e, convo.id)}
                className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
