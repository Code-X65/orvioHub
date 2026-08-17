import { query, mutation } from "convex/server";
import { v } from "convex/values";

export const getNotes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("notes").collect();
  },
});

export const createNote = mutation({
  args: {
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const noteId = await ctx.db.insert("notes", {
      title: args.title,
      content: args.content,
      createdAt: Date.now(),
    });
    return noteId;
  },
});
