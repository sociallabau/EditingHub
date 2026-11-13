"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { SendHorizonal, Trash2 } from "lucide-react";
import { addComment, deleteComment } from "@/lib/actions";
import { Avatar } from "../ui";
import { CommentText, MentionInput, type MentionUser } from "../MentionInput";

type ChatComment = { id: string; body: string; createdAt: string; author: MentionUser };

export function ProjectChat({
  projectId,
  comments,
  members,
  me,
}: {
  projectId: string;
  comments: ChatComment[];
  members: MentionUser[];
  me: string;
}) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [comments.length]);

  const send = () => {
    if (!body.trim()) return;
    const text = body;
    setBody("");
    start(() => addComment({ projectId, body: text }));
  };

  return (
    <aside className="hidden w-[320px] shrink-0 flex-col border-l border-line xl:flex">
      <div className="border-b border-line px-4 py-3 text-xs font-semibold">Project chat</div>
      <div ref={list} className="flex-1 space-y-4 overflow-y-auto p-4">
        {comments.length === 0 && (
          <p className="text-xs text-muted">
            Questions for the shooter or editor go here. Type @ to mention someone — everyone tagged on the project is notified.
          </p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="group flex gap-2.5">
            <Avatar name={c.author.name} color={c.author.color} size={24} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-semibold">{c.author.name}</span>
                <span className="text-[11px] text-muted">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                {c.author.id === me && (
                  <button
                    className="ml-auto opacity-0 group-hover:opacity-100"
                    onClick={() => confirm("Delete this message?") && start(() => deleteComment(c.id))}
                  >
                    <Trash2 className="h-3 w-3 text-muted hover:text-red-400" />
                  </button>
                )}
              </div>
              <div className="mt-0.5 text-[13px] text-zinc-200">
                <CommentText text={c.body} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3">
        <div className="rounded-lg border border-line bg-card p-2 focus-within:border-zinc-500">
          <MentionInput value={body} onChange={setBody} onSubmit={send} users={members} placeholder="Leave a comment" />
          <div className="flex justify-end">
            <button className="btn-ghost p-1.5" onClick={send} disabled={pending || !body.trim()}>
              <SendHorizonal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
