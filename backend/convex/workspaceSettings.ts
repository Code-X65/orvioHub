import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

/**
 * Normalizes a slug: converts to lowercase, trims, replaces non-alphanumeric chars with hyphens.
 */
function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function resolveWorkspace(ctx: any, id: any) {
  let ws: any = null;
  try {
    ws = await (ctx.db as any).get(id);
  } catch {}
  if (!ws) {
    try {
      ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", id))
        .first();
    } catch {}
  }
  return ws;
}

/**
 * Get comprehensive workspace settings, branding, address, and localization
 */
export const getWorkspaceSettings = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) {
      return null;
    }

    const [settings, branding] = await Promise.all([
      ctx.db
        .query("workspaceSettings")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
        .first(),
      ctx.db
        .query("workspaceBranding")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
        .first(),
    ]);

    // Format unified response
    return {
      workspaceId: ws._id,
      name: ws.name,
      displayName: ws.displayName || ws.name,
      slug: ws.slug,
      type: ws.type || "retail",
      category: ws.category || "",
      description: ws.description || "",
      status: ws.status || "active",
      planId: ws.planId || "free_trial",
      ownerId: ws.ownerId,
      // Business contact
      email: ws.email || "",
      phone: ws.phone || "",
      // Address
      country: ws.country || "Nigeria",
      state: ws.state || "",
      city: ws.city || "",
      addressLine1: ws.addressLine1 || "",
      addressLine2: ws.addressLine2 || "",
      postalCode: ws.postalCode || "",
      // Localization
      currency: ws.currency || "NGN",
      timezone: ws.timezone || "Africa/Lagos",
      defaultLanguage: settings?.defaultLanguage || "en",
      dateFormat: settings?.dateFormat || "YYYY-MM-DD",
      numberFormat: settings?.numberFormat || "standard",
      weekStartsOn: settings?.weekStartsOn || "monday",
      taxEnabled: settings?.taxEnabled ?? false,
      taxDisplayMode: settings?.taxDisplayMode || "inclusive",
      defaultReceiptFooter: settings?.defaultReceiptFooter || "",
      defaultNotificationMode: settings?.defaultNotificationMode || "all",
      // Branding
      logoUrl: branding?.logoUrl || ws.logoUrl || "",
      logoStorageId: branding?.logoStorageId || ws.logoStorageId,
      faviconUrl: branding?.faviconUrl || "",
      primaryColor: branding?.primaryColor || "#714b67",
      secondaryColor: branding?.secondaryColor || "#FDB02F",
      createdAt: ws.createdAt,
      updatedAt: ws.updatedAt,
    };
  },
});

/**
 * Update General Organization Settings (Name, displayName, category, description, slug)
 */
export const updateGeneralSettings = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    name: v.optional(v.string()),
    displayName: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(v.string()),
    slug: v.optional(v.string()),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) {
      throw new Error("Workspace not found");
    }

    const updates: Record<string, any> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      const trimmed = args.name.trim();
      if (!trimmed) throw new Error("Workspace name cannot be empty");
      updates.name = trimmed;
    }
    if (args.displayName !== undefined) updates.displayName = args.displayName.trim();
    if (args.category !== undefined) updates.category = args.category.trim();
    if (args.description !== undefined) updates.description = args.description.trim();
    if (args.type !== undefined) updates.type = args.type.trim();

    // Handle slug update with uniqueness check
    if (args.slug !== undefined) {
      const cleanSlug = normalizeSlug(args.slug);
      if (!cleanSlug) throw new Error("Invalid workspace slug");
      if (cleanSlug !== ws.slug) {
        const existing = await ctx.db
          .query("workspaces")
          .withIndex("by_slug", (q) => q.eq("slug", cleanSlug))
          .first();
        if (existing && existing._id !== ws._id) {
          throw new Error(`The slug '${cleanSlug}' is already taken.`);
        }
        updates.slug = cleanSlug;
      }
    }

    await ctx.db.patch(ws._id, updates);

    // Write audit log
    if (args.callerUserId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: ws._id,
        actorUserId: args.callerUserId as any,
        action: "workspace.profile_updated",
        eventType: "workspace.profile_updated",
        resourceType: "workspace_settings",
        resourceId: ws._id,
        beforeValues: {
          name: ws.name,
          displayName: ws.displayName,
          slug: ws.slug,
          category: ws.category,
        },
        afterValues: updates,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Update Business Information (Email, Phone, Description, Category)
 */
export const updateBusinessSettings = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    legalName: v.optional(v.string()),
    registrationNumber: v.optional(v.string()),
    taxId: v.optional(v.string()),
    supportEmail: v.optional(v.string()),
    supportPhone: v.optional(v.string()),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) throw new Error("Workspace not found");

    const now = Date.now();
    const wsUpdates: Record<string, any> = { updatedAt: now };

    if (args.email !== undefined) wsUpdates.email = args.email.trim().toLowerCase();
    if (args.phone !== undefined) wsUpdates.phone = args.phone.trim();
    if (args.category !== undefined) wsUpdates.category = args.category.trim();
    if (args.description !== undefined) wsUpdates.description = args.description.trim();

    await ctx.db.patch(ws._id, wsUpdates);

    // Also update/upsert workspaceSettings record for legal metadata
    const existing = await ctx.db
      .query("workspaceSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
      .first();

    const settingsPayload: Record<string, any> = {
      workspaceId: ws._id,
      updatedAt: now,
    };
    if (args.legalName !== undefined) settingsPayload.legalName = args.legalName.trim();
    if (args.registrationNumber !== undefined) settingsPayload.registrationNumber = args.registrationNumber.trim();
    if (args.taxId !== undefined) settingsPayload.taxId = args.taxId.trim();
    if (args.supportEmail !== undefined) settingsPayload.supportEmail = args.supportEmail.trim();
    if (args.supportPhone !== undefined) settingsPayload.supportPhone = args.supportPhone.trim();

    if (existing) {
      await ctx.db.patch(existing._id, settingsPayload);
    } else {
      await ctx.db.insert("workspaceSettings", {
        workspaceId: ws._id,
        ...settingsPayload,
        taxEnabled: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (args.callerUserId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: ws._id,
        actorUserId: args.callerUserId as any,
        action: "workspace.business_updated",
        eventType: "workspace.business_updated",
        resourceType: "workspace_settings",
        resourceId: ws._id,
        beforeValues: { email: ws.email, phone: ws.phone, category: ws.category },
        afterValues: { ...wsUpdates, ...settingsPayload },
        createdAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Update Structured Address Information
 */
export const updateAddressSettings = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    country: v.optional(v.string()),
    state: v.optional(v.string()),
    city: v.optional(v.string()),
    lga: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) throw new Error("Workspace not found");

    const now = Date.now();
    const updates: Record<string, any> = { updatedAt: now };

    if (args.country !== undefined) updates.country = args.country.trim();
    if (args.state !== undefined) updates.state = args.state.trim();
    if (args.city !== undefined) updates.city = args.city.trim();
    if (args.addressLine1 !== undefined) updates.addressLine1 = args.addressLine1.trim();
    if (args.addressLine2 !== undefined) updates.addressLine2 = args.addressLine2.trim();
    if (args.postalCode !== undefined) updates.postalCode = args.postalCode.trim();

    await ctx.db.patch(ws._id, updates);

    // Also update structured address in workspaceSettings
    const existing = await ctx.db
      .query("workspaceSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
      .first();

    const structuredAddress = {
      street: args.addressLine1 || existing?.address?.street || ws.addressLine1 || "",
      lga: args.lga || existing?.address?.lga || "",
      city: args.city || existing?.address?.city || ws.city || "",
      state: args.state || existing?.address?.state || ws.state || "",
      postalCode: args.postalCode || existing?.address?.postalCode || ws.postalCode || "",
      country: args.country || existing?.address?.country || ws.country || "Nigeria",
      formatted: `${args.addressLine1 || ws.addressLine1 || ""}, ${args.city || ws.city || ""}, ${args.state || ws.state || ""}, ${args.country || ws.country || "Nigeria"}`.replace(/^,\s*|,\s*$/g, ""),
    };

    if (existing) {
      await ctx.db.patch(existing._id, { address: structuredAddress, updatedAt: now });
    } else {
      await ctx.db.insert("workspaceSettings", {
        workspaceId: ws._id,
        address: structuredAddress,
        taxEnabled: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (args.callerUserId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: ws._id,
        actorUserId: args.callerUserId as any,
        action: "workspace.address_updated",
        eventType: "workspace.address_updated",
        resourceType: "workspace_address",
        resourceId: ws._id,
        afterValues: updates,
        createdAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Update Branding (Logo, Favicon, Colors)
 */
export const updateBrandingSettings = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    faviconUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    secondaryColor: v.optional(v.string()),
    receiptHeader: v.optional(v.string()),
    receiptFooter: v.optional(v.string()),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) throw new Error("Workspace not found");

    const now = Date.now();

    // 1. Update/Upsert workspaceBranding record
    const existing = await ctx.db
      .query("workspaceBranding")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
      .first();

    const brandingPayload = {
      workspaceId: ws._id,
      logoUrl: args.logoUrl !== undefined ? args.logoUrl : existing?.logoUrl,
      logoStorageId: args.logoStorageId !== undefined ? args.logoStorageId : existing?.logoStorageId,
      faviconUrl: args.faviconUrl !== undefined ? args.faviconUrl : existing?.faviconUrl,
      primaryColor: args.primaryColor !== undefined ? args.primaryColor : existing?.primaryColor,
      secondaryColor: args.secondaryColor !== undefined ? args.secondaryColor : existing?.secondaryColor,
      receiptHeader: args.receiptHeader !== undefined ? args.receiptHeader : existing?.receiptHeader,
      receiptFooter: args.receiptFooter !== undefined ? args.receiptFooter : existing?.receiptFooter,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, brandingPayload);
    } else {
      await ctx.db.insert("workspaceBranding", {
        ...brandingPayload,
        createdAt: now,
      });
    }

    // 2. Mirror logoUrl & logoStorageId to workspace for fast reads
    const wsUpdates: Record<string, any> = { updatedAt: now };
    if (args.logoUrl !== undefined) wsUpdates.logoUrl = args.logoUrl;
    if (args.logoStorageId !== undefined) wsUpdates.logoStorageId = args.logoStorageId;
    await ctx.db.patch(ws._id, wsUpdates);

    if (args.callerUserId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: ws._id,
        actorUserId: args.callerUserId as any,
        action: "workspace.branding_updated",
        eventType: "workspace.branding_updated",
        resourceType: "workspace_branding",
        resourceId: ws._id,
        afterValues: brandingPayload,
        createdAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Remove/delete workspace logo
 */
export const removeLogo = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) throw new Error("Workspace not found");

    const now = Date.now();

    const branding = await ctx.db
      .query("workspaceBranding")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
      .first();

    if (branding?.logoStorageId) {
      try {
        await ctx.storage.delete(branding.logoStorageId);
      } catch {}
    }

    if (branding) {
      await ctx.db.patch(branding._id, {
        logoUrl: undefined,
        logoStorageId: undefined,
        updatedAt: now,
      });
    }

    await ctx.db.patch(ws._id, {
      logoUrl: undefined,
      logoStorageId: undefined,
      updatedAt: now,
    });

    if (args.callerUserId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: ws._id,
        actorUserId: args.callerUserId as any,
        action: "workspace.logo_removed",
        eventType: "workspace.logo_removed",
        resourceType: "workspace_branding",
        resourceId: ws._id,
        createdAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Update Localization Preferences (Currency, Timezone, Date/Number formats, Language)
 */
export const updateLocalizationSettings = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    currency: v.optional(v.string()),
    timezone: v.optional(v.string()),
    country: v.optional(v.string()),
    defaultLanguage: v.optional(v.string()),
    dateFormat: v.optional(v.string()),
    numberFormat: v.optional(v.string()),
    weekStartsOn: v.optional(v.string()),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) throw new Error("Workspace not found");

    const now = Date.now();

    // 1. Update workspace fields
    const wsUpdates: Record<string, any> = { updatedAt: now };
    if (args.currency !== undefined) wsUpdates.currency = args.currency.trim().toUpperCase();
    if (args.timezone !== undefined) wsUpdates.timezone = args.timezone.trim();
    if (args.country !== undefined) wsUpdates.country = args.country.trim();
    await ctx.db.patch(ws._id, wsUpdates);

    // 2. Update/upsert workspaceSettings record
    const existing = await ctx.db
      .query("workspaceSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
      .first();

    const settingsPayload = {
      workspaceId: ws._id,
      defaultLanguage: args.defaultLanguage ?? existing?.defaultLanguage ?? "en",
      dateFormat: args.dateFormat ?? existing?.dateFormat ?? "YYYY-MM-DD",
      numberFormat: args.numberFormat ?? existing?.numberFormat ?? "standard",
      weekStartsOn: args.weekStartsOn ?? existing?.weekStartsOn ?? "monday",
      taxEnabled: existing?.taxEnabled ?? false,
      taxDisplayMode: existing?.taxDisplayMode ?? "inclusive",
      defaultReceiptFooter: existing?.defaultReceiptFooter,
      defaultNotificationMode: existing?.defaultNotificationMode ?? "all",
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, settingsPayload);
    } else {
      await ctx.db.insert("workspaceSettings", {
        ...settingsPayload,
        createdAt: now,
      });
    }

    if (args.callerUserId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: ws._id,
        actorUserId: args.callerUserId as any,
        action: "workspace.localization_updated",
        eventType: "workspace.localization_updated",
        resourceType: "workspace_localization",
        resourceId: ws._id,
        afterValues: { ...wsUpdates, ...settingsPayload },
        createdAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Update Notification Preferences
 */
export const updateNotificationSettings = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    defaultNotificationMode: v.optional(v.string()),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) throw new Error("Workspace not found");

    const now = Date.now();

    const existing = await ctx.db
      .query("workspaceSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        defaultNotificationMode: args.defaultNotificationMode || "all",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("workspaceSettings", {
        workspaceId: ws._id,
        defaultNotificationMode: args.defaultNotificationMode || "all",
        taxEnabled: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (args.callerUserId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: ws._id,
        actorUserId: args.callerUserId as any,
        action: "workspace.notification_settings_updated",
        eventType: "workspace.notification_settings_updated",
        resourceType: "workspace_notifications",
        resourceId: ws._id,
        afterValues: { defaultNotificationMode: args.defaultNotificationMode },
        createdAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Generate a direct file upload URL for logo / favicon
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
