import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  notes: defineTable({
    title: v.string(),
    content: v.string(),
    createdAt: v.number(),
  }),

  users: defineTable({
    email: v.string(),
    emailNormalized: v.optional(v.string()),
    name: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    displayName: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    emailVerified: v.boolean(),
    emailVerifiedAt: v.optional(v.number()),
    emailVerificationToken: v.optional(v.string()),
    emailVerificationExpiresAt: v.optional(v.number()),
    passwordResetToken: v.optional(v.string()),
    passwordResetExpiresAt: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("ACTIVE"),
        v.literal("INACTIVE"),
        v.literal("SUSPENDED")
      )
    ),
    tokenVersion: v.optional(v.number()),
    avatar: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    phone: v.optional(v.string()),
    phoneVerifiedAt: v.optional(v.number()),
    phoneVerificationCode: v.optional(v.string()),
    phoneVerificationExpiresAt: v.optional(v.number()),
    phoneVisibility: v.optional(v.union(v.literal("private"), v.literal("workspace"))),
    preferredName: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    department: v.optional(v.string()),
    bio: v.optional(v.string()),
    country: v.optional(v.string()),
    state: v.optional(v.string()),
    city: v.optional(v.string()),
    timezone: v.optional(v.string()),
    language: v.optional(v.string()),
    locale: v.optional(v.string()),
    dateFormat: v.optional(v.string()),
    numberFormat: v.optional(v.string()),
    currencyPreference: v.optional(v.string()),
    firstDayOfWeek: v.optional(v.string()),
    theme: v.optional(v.string()),
    layoutDensity: v.optional(v.string()),
    lastLoginAt: v.optional(v.number()),
    onboardingStatus: v.optional(v.string()),
    lastSelectedProduct: v.optional(v.string()),
    lastSelectedWorkspaceId: v.optional(v.string()),
    explorerMode: v.optional(v.boolean()),
    profileCompletedAt: v.optional(v.number()),
    pendingEmail: v.optional(v.string()),
    emailChangeToken: v.optional(v.string()),
    emailChangeExpiresAt: v.optional(v.number()),
    twoFactorEnabled: v.optional(v.boolean()),
    twoFactorSecret: v.optional(v.string()),
    twoFactorPendingSecret: v.optional(v.string()),
    twoFactorBackupCodes: v.optional(v.array(v.string())),
    failedLoginAttempts: v.optional(v.number()),
    lockedUntil: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_deletedAt", ["deletedAt"])
    .index("by_email_normalized", ["emailNormalized"])
    .index("by_verification_token", ["emailVerificationToken"])
    .index("by_password_reset_token", ["passwordResetToken"])
    .index("by_email_change_token", ["emailChangeToken"]),

  authIdentities: defineTable({
    userId: v.id("users"),
    provider: v.union(
      v.literal("password"),
      v.literal("google"),
      v.literal("facebook"),
      v.literal("phone"),
      v.literal("apple")
    ),
    providerSubject: v.string(),
    providerEmail: v.optional(v.string()),
    providerEmailVerified: v.optional(v.boolean()),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_provider_and_subject", ["provider", "providerSubject"])
    .index("by_userId", ["userId"]),

  userIdentities: defineTable({
    userId: v.id("users"),
    provider: v.union(v.literal("google"), v.literal("facebook")),
    providerUserId: v.string(),
    providerEmail: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_provider_and_providerUserId", ["provider", "providerUserId"])
    .index("by_userId", ["userId"]),

  sessions: defineTable({
    userId: v.id("users"),
    sessionHash: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    deviceName: v.optional(v.string()),
    authenticationMethod: v.optional(v.string()),
    mfaVerified: v.optional(v.boolean()),
    tokenVersion: v.number(),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    lastActiveAt: v.optional(v.number()),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    replacedByToken: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sessionHash", ["sessionHash"])
    .index("by_refreshToken", ["refreshToken"])
    .index("by_userId", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    industry: v.string(),
    country: v.string(),
    timezone: v.string(),
    website: v.optional(v.string()),
    size: v.optional(v.string()),
    logo: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  organizationMemberships: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(
      v.literal("OWNER"),
      v.literal("ADMIN"),
      v.literal("MANAGER"),
      v.literal("MEMBER")
    ),
    status: v.union(
      v.literal("ACTIVE"),
      v.literal("INACTIVE"),
      v.literal("INVITED")
    ),
    joinedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_userId", ["userId"])
    .index("by_org_and_user", ["organizationId", "userId"]),

  organizationSettings: defineTable({
    organizationId: v.id("organizations"),
    enabledModules: v.array(v.string()),
    workspaceReady: v.boolean(),
    workspaceInitializedAt: v.optional(v.number()),
    defaults: v.optional(v.any()),
    updatedAt: v.number(),
  }).index("by_organizationId", ["organizationId"]),

  organizationModules: defineTable({
    organizationId: v.id("organizations"),
    moduleId: v.string(),
    enabled: v.boolean(),
    enabledAt: v.number(),
    config: v.optional(v.any()),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_org_and_module", ["organizationId", "moduleId"]),

  workspaces: defineTable({
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    slug: v.string(),
    type: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
    country: v.optional(v.string()),
    state: v.optional(v.string()),
    city: v.optional(v.string()),
    timezone: v.optional(v.string()),
    currency: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    status: v.optional(v.string()),
    planId: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    enabledModules: v.optional(v.array(v.string())),
    settings: v.optional(v.any()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_organizationId", ["organizationId"])
    .index("by_org_and_slug", ["organizationId", "slug"])
    .index("by_deletedAt", ["deletedAt"]),

  workspaceMemberships: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    status: v.string(),
    defaultRole: v.optional(v.string()),
    role: v.string(),
    invitedBy: v.optional(v.id("users")),
    invitedAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    suspendedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_user_status", ["userId", "status"]),

  products: defineTable({
    key: v.string(), // e.g. "inventory", "taskmanagement", "gym", "booking", "crm"
    name: v.string(),
    description: v.string(),
    iconUrl: v.optional(v.string()),
    subdomain: v.string(), // e.g. "inventory.orviohub.com"
    status: v.union(
      v.literal("active"),
      v.literal("coming_soon"),
      v.literal("draft"),
      v.literal("ACTIVE"),
      v.literal("BETA"),
      v.literal("COMING_SOON")
    ),
    isBeta: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    displayOrder: v.optional(v.number()),
    documentationUrl: v.optional(v.string()),
    supportEmail: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_status", ["status"])
    .index("by_order", ["displayOrder"]),

  productNotifyList: defineTable({
    productKey: v.string(),
    email: v.string(),
    emailNormalized: v.string(),
    userId: v.optional(v.id("users")),
    notified: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_product", ["productKey"])
    .index("by_email", ["emailNormalized"])
    .index("by_product_notified", ["productKey", "notified"])
    .index("by_user", ["userId"]),

  plans: defineTable({
    key: v.string(), // "free", "standard", "premium"
    name: v.string(),
    monthlyPrice: v.number(), // kobo (e.g. 0, 750000, 2000000)
    annualPrice: v.optional(v.number()), // kobo
    currency: v.string(), // "NGN"
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_active", ["isActive"]),

  subscriptions: defineTable({
    workspaceId: v.id("workspaces"),
    planKey: v.string(), // "free", "standard", "premium"
    status: v.union(
      v.literal("active"),
      v.literal("cancelled"),
      v.literal("past_due")
    ),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_plan", ["planKey"])
    .index("by_status", ["status"]),

  usageCounters: defineTable({
    workspaceId: v.id("workspaces"),
    featureKey: v.string(), // "workspace.count", "apps.count", "members.count", "products.count", "transactions.count"
    periodStart: v.number(),
    periodEnd: v.number(),
    usageValue: v.number(),
    limitValue: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_feature", ["workspaceId", "featureKey"]),

  workspaceProducts: defineTable({
    workspaceId: v.id("workspaces"),
    productKey: v.string(),
    status: v.string(),
    planId: v.optional(v.string()),
    activationSource: v.optional(v.string()),
    activationStatus: v.optional(v.string()),
    onboardingStatus: v.optional(v.string()),
    trialStartedAt: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    activatedBy: v.id("users"),
    activatedAt: v.number(),
    suspendedAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_product", ["workspaceId", "productKey"])
    .index("by_product_status", ["productKey", "status"]),

  productMemberships: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    productKey: v.string(),
    role: v.string(), // e.g. "inventory_owner", "sales_attendant", "stock_manager"
    permissions: v.array(v.string()),
    branchIds: v.optional(v.array(v.id("branches"))),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_workspace_product", ["workspaceId", "productKey"])
    .index("by_user_product", ["userId", "productKey"])
    .index("by_workspace_product_user", ["workspaceId", "productKey", "userId"]),

  workspaceInvitations: defineTable({
    workspaceId: v.id("workspaces"),
    productKey: v.optional(v.string()),
    email: v.string(),
    emailNormalized: v.string(),
    inviteeUserId: v.optional(v.id("users")),
    role: v.string(),
    branchIds: v.optional(v.array(v.id("branches"))),
    tokenHash: v.string(),
    status: v.string(),
    invitedBy: v.id("users"),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    declinedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_workspace", ["workspaceId"])
    .index("by_email_status", ["emailNormalized", "status"])
    .index("by_invitee", ["inviteeUserId"]),

  branches: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    code: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
    // Nigerian Structured Address fields
    country: v.optional(v.string()), // Default "Nigeria"
    state: v.optional(v.string()),
    stateCode: v.optional(v.string()),
    lga: v.optional(v.string()),
    city: v.optional(v.string()),
    street: v.optional(v.string()),
    blockNumber: v.optional(v.string()),
    area: v.optional(v.string()),
    landmark: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    address: v.optional(v.string()), // Formatted / legacy address
    formattedAddress: v.optional(v.string()),
    // Contact & Verification fields
    phone: v.optional(v.string()),
    phoneNormalized: v.optional(v.string()),
    phoneVerified: v.optional(v.boolean()),
    phoneVerifiedAt: v.optional(v.number()),
    verificationCode: v.optional(v.string()), // hashed OTP for branch phone
    codeExpiresAt: v.optional(v.number()),
    email: v.optional(v.string()),
    managerId: v.optional(v.id("users")),
    status: v.string(),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_workspace_primary", ["workspaceId", "isPrimary"])
    .index("by_workspace_state", ["workspaceId", "state"])
    .index("by_workspace_lga", ["workspaceId", "lga"])
    .index("by_phone", ["phoneNormalized"]),

  workspaceAuditLogs: defineTable({
    workspaceId: v.id("workspaces"),
    actorUserId: v.optional(v.id("users")),
    eventType: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    severity: v.string(),
    metadata: v.optional(v.any()),
    requestId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created", ["workspaceId", "createdAt"])
    .index("by_actor", ["actorUserId"]),

  onboardingFlows: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    productKey: v.optional(v.string()), // "inventory", "taskmanagement", "global"
    entryPoint: v.optional(v.string()), // "product_landing_page", "app_launcher", "invitation", "organization_settings", "support"
    flowVersion: v.string(),
    status: v.union(
      v.literal("NOT_STARTED"),
      v.literal("IN_PROGRESS"),
      v.literal("COMPLETED"),
      v.literal("ABANDONED"),
      v.literal("pending_email_verification"),
      v.literal("pending_profile_setup"),
      v.literal("pending_welcome"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("abandoned"),
      v.literal("pending")
    ),
    currentStep: v.string(),
    completedSteps: v.array(v.string()),
    skippedSteps: v.array(v.string()),
    stepData: v.optional(v.any()), // Cached formData for resumability
    startedAt: v.number(),
    lastUpdatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_user", ["userId"])
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspace_product", ["workspaceId", "productKey"]),

  onboardingEvents: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    productKey: v.optional(v.string()),
    step: v.string(),
    eventType: v.string(), // "STEP_VIEWED", "STEP_SUBMITTED", "STEP_SKIPPED", "step_started", "step_completed", "step_skipped"
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspace_product", ["workspaceId", "productKey"]),

  notifications: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    productKey: v.optional(v.string()),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    severity: v.union(v.literal("INFO"), v.literal("SUCCESS"), v.literal("WARNING"), v.literal("ERROR")),
    channel: v.union(v.literal("IN_APP"), v.literal("EMAIL"), v.literal("SMS"), v.literal("WHATSAPP")),
    status: v.union(v.literal("UNREAD"), v.literal("READ"), v.literal("ARCHIVED")),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_user_and_status", ["userId", "status"]),

  notificationPreferences: defineTable({
    userId: v.id("users"),
    category: v.string(), // "SECURITY", "WORKSPACE", "PRODUCT", "OPERATIONAL"
    channel: v.string(),  // "EMAIL", "IN_APP", "SMS", "WHATSAPP"
    enabled: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_user_and_category", ["userId", "category"]),

  onboardingProgress: defineTable({
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    currentStep: v.union(
      v.literal("NOT_STARTED"),
      v.literal("ACCOUNT_CREATED"),
      v.literal("EMAIL_VERIFICATION"),
      v.literal("EMAIL_VERIFIED"),
      v.literal("ORGANIZATION_CREATION"),
      v.literal("ORGANIZATION_CREATED"),
      v.literal("ORGANIZATION_CONFIGURED"),
      v.literal("MODULE_SELECTION"),
      v.literal("MODULES_SELECTED"),
      v.literal("WORKSPACE_INITIALIZATION"),
      v.literal("WORKSPACE_READY"),
      v.literal("TEAM_INVITATION"),
      v.literal("TEAM_INVITED"),
      v.literal("COMPLETED")
    ),
    status: v.union(
      v.literal("NOT_STARTED"),
      v.literal("IN_PROGRESS"),
      v.literal("COMPLETED")
    ),
    completedSteps: v.array(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_organizationId", ["organizationId"]),

  invitations: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    organizationId: v.id("organizations"),
    productKey: v.optional(v.string()),
    email: v.string(),
    invitedUserId: v.optional(v.id("users")),
    role: v.union(
      v.literal("OWNER"),
      v.literal("ADMIN"),
      v.literal("MANAGER"),
      v.literal("MEMBER")
    ),
    token: v.string(),
    tokenHash: v.optional(v.string()),
    resendCount: v.optional(v.number()),
    status: v.union(
      v.literal("PENDING"),
      v.literal("ACCEPTED"),
      v.literal("EXPIRED"),
      v.literal("CANCELLED")
    ),
    invitedBy: v.id("users"),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_tokenHash", ["tokenHash"])
    .index("by_workspaceId", ["workspaceId"])
    .index("by_organizationId", ["organizationId"])
    .index("by_email", ["email"])
    .index("by_org_and_email", ["organizationId", "email"]),

  auditLogs: defineTable({
    actorId: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
    targetUserId: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
    productKey: v.optional(v.string()),
    eventType: v.optional(v.string()),
    action: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    resource: v.string(),
    severity: v.optional(
      v.union(v.literal("info"), v.literal("warning"), v.literal("critical"))
    ),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    requestId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.optional(v.number()),
    timestamp: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_organizationId", ["organizationId"])
    .index("by_actorId", ["actorId"])
    .index("by_actorUserId", ["actorUserId"])
    .index("by_eventType", ["eventType"])
    .index("by_timestamp", ["timestamp"])
    .index("by_createdAt", ["createdAt"]),

  emailOutbox: defineTable({
    to: v.string(),
    template: v.union(
      v.literal("verification"),
      v.literal("invitation"),
      v.literal("onboardingCompleted"),
      v.literal("passwordReset"),
      v.literal("emailChange"),
      v.literal("securityAlert")
    ),
    payload: v.any(),
    status: v.union(
      v.literal("PENDING"),
      v.literal("PROCESSING"),
      v.literal("SENT"),
      v.literal("FAILED")
    ),
    attempts: v.number(),
    nextAttemptAt: v.number(),
    lockedUntil: v.optional(v.number()),
    providerMessageId: v.optional(v.string()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_status_and_nextAttemptAt", ["status", "nextAttemptAt"]),

  oauthCodes: defineTable({
    codeHash: v.string(),
    userId: v.id("users"),
    sessionId: v.optional(v.string()),
    productKey: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.optional(v.string()),
    codeChallengeMethod: v.optional(v.string()),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_codeHash", ["codeHash"])
    .index("by_expiresAt", ["expiresAt"]),

  inventoryProducts: defineTable({
    workspaceId: v.id("workspaces"),
    sku: v.string(),
    name: v.string(),
    category: v.string(),
    description: v.optional(v.string()),
    costPrice: v.number(),
    sellingPrice: v.number(),
    stockQuantity: v.number(),
    minStockLevel: v.number(),
    unit: v.string(),
    imageUrl: v.optional(v.string()),
    barcode: v.optional(v.string()),
    isActive: v.boolean(),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspace_and_sku", ["workspaceId", "sku"])
    .index("by_workspace_and_category", ["workspaceId", "category"]),

  inventorySales: defineTable({
    workspaceId: v.id("workspaces"),
    saleNumber: v.string(),
    receiptNumber: v.string(),
    cashierUserId: v.id("users"),
    items: v.array(
      v.object({
        productId: v.id("inventoryProducts"),
        sku: v.string(),
        name: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        totalPrice: v.number(),
      })
    ),
    subtotal: v.number(),
    taxAmount: v.number(),
    discountAmount: v.number(),
    totalAmount: v.number(),
    paymentMethod: v.union(
      v.literal("CASH"),
      v.literal("CARD"),
      v.literal("TRANSFER"),
      v.literal("SPLIT")
    ),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspace_and_saleNumber", ["workspaceId", "saleNumber"])
    .index("by_workspace_and_cashier", ["workspaceId", "cashierUserId"]),

  inventoryStockMovements: defineTable({
    workspaceId: v.id("workspaces"),
    productId: v.id("inventoryProducts"),
    type: v.union(
      v.literal("INITIAL"),
      v.literal("SALE"),
      v.literal("RESTOCK"),
      v.literal("ADJUSTMENT"),
      v.literal("RETURN")
    ),
    quantity: v.number(), // Negative for reductions, positive for additions
    balanceBefore: v.number(),
    balanceAfter: v.number(),
    reason: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    actorUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspace_and_product", ["workspaceId", "productId"]),

  userPreferences: defineTable({
    userId: v.id("users"),
    theme: v.optional(v.union(v.literal("dark"), v.literal("light"), v.literal("system"))),
    language: v.optional(v.string()),
    timezone: v.optional(v.string()),
    country: v.optional(v.string()),
    dateFormat: v.optional(v.string()),
    numberFormat: v.optional(v.string()),
    currencyPreference: v.optional(v.string()),
    firstDayOfWeek: v.optional(v.union(v.literal("monday"), v.literal("sunday"))),
    layoutDensity: v.optional(v.union(v.literal("compact"), v.literal("comfortable"))),
    marketingEmailEnabled: v.optional(v.boolean()),
    productEmailEnabled: v.optional(v.boolean()),
    securityEmailEnabled: v.optional(v.boolean()),
    inventoryAlertsEnabled: v.optional(v.boolean()),
    taskRemindersEnabled: v.optional(v.boolean()),
    billingAlertsEnabled: v.optional(v.boolean()),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  userConsents: defineTable({
    userId: v.id("users"),
    consentType: v.string(), // "terms_of_service", "privacy_policy", "marketing_communications", "analytics"
    version: v.string(),
    granted: v.boolean(),
    grantedAt: v.number(),
    withdrawnAt: v.optional(v.number()),
    source: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_user_and_consentType", ["userId", "consentType"]),

  accountDeletionRequests: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.literal("PENDING"),
      v.literal("COOLING_OFF"),
      v.literal("CANCELLED"),
      v.literal("COMPLETED")
    ),
    reason: v.optional(v.string()),
    requestedAt: v.number(),
    scheduledDeletionAt: v.number(),
    cancelledAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  dataExportRequests: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.literal("PENDING"),
      v.literal("PROCESSING"),
      v.literal("READY"),
      v.literal("EXPIRED")
    ),
    requestedAt: v.number(),
    completedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    storageReference: v.optional(v.string()),
    data: v.optional(v.any()),
  }).index("by_userId", ["userId"]),

  userAuditLogs: defineTable({
    userId: v.id("users"),
    eventType: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    severity: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("critical")
    ),
    metadata: v.optional(v.any()),
    requestId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    isSuspicious: v.optional(v.boolean()),
    suspiciousReportedAt: v.optional(v.number()),
    suspiciousReason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_user_and_created", ["userId", "createdAt"])
    .index("by_user_and_event", ["userId", "eventType"]),

  platformAdmins: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    name: v.string(),
    role: v.string(), // 'super_admin'
    isActive: v.boolean(),
    lastLoginAt: v.optional(v.number()),
    lastLoginIp: v.optional(v.string()),
    failedLoginAttempts: v.optional(v.number()),
    lockedUntil: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_active", ["isActive"]),

  adminSessions: defineTable({
    adminId: v.id("platformAdmins"),
    sessionToken: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
    lastActiveAt: v.number(),
  })
    .index("by_token", ["sessionToken"])
    .index("by_admin", ["adminId"])
    .index("by_expires", ["expiresAt"]),

  adminAuditLogs: defineTable({
    adminId: v.optional(v.id("platformAdmins")),
    action: v.string(),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    details: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_admin", ["adminId"])
    .index("by_action", ["action"])
    .index("by_created", ["createdAt"]),

  adminLoginAttempts: defineTable({
    ipAddress: v.string(),
    createdAt: v.number(),
  })
    .index("by_ip", ["ipAddress"])
    .index("by_created", ["createdAt"]),

  platformStats: defineTable({
    metricName: v.string(),
    metricValue: v.number(),
    date: v.string(), // YYYY-MM-DD format
    createdAt: v.number(),
  })
    .index("by_metric_date", ["metricName", "date"])
    .index("by_date", ["date"]),

  systemConfig: defineTable({
    configKey: v.string(),
    configValue: v.any(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("platformAdmins")),
  })
    .index("by_key", ["configKey"]),

  manualPayments: defineTable({
    workspaceId: v.id("workspaces"),
    planKey: v.string(), // "standard" | "premium"
    amount: v.number(), // in kobo
    currency: v.string(), // "NGN"
    billingCycle: v.string(), // "monthly" | "annual"
    paymentReference: v.string(), // e.g. "GTB-TRX-9821374"
    paymentMethod: v.string(), // "bank_transfer" | "cash" | "pos" | "cheque" | "other"
    paidAt: v.number(),
    recordedBy: v.id("users"), // Super Admin
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_paid_at", ["paidAt"]),

  paymentTransactions: defineTable({
    workspaceId: v.union(v.id("workspaces"), v.string()),
    planKey: v.string(), // "standard" | "premium"
    amount: v.number(), // in kobo
    currency: v.string(), // "NGN"
    billingCycle: v.string(), // "monthly" | "annual"
    gateway: v.union(v.literal("paystack"), v.literal("flutterwave")),
    gatewayReference: v.string(), // Paystack reference or Flutterwave tx_ref
    status: v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("failed")
    ),
    paidAt: v.optional(v.number()),
    customerEmail: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_gateway_ref", ["gatewayReference"])
    .index("by_status", ["status"]),

  locations: defineTable({
    type: v.union(v.literal("state"), v.literal("lga")),
    name: v.string(),
    code: v.optional(v.string()), // state code: "LA", "KD", "FC", etc.
    parentLocationId: v.optional(v.id("locations")), // LGA references parent state
    stateCode: v.string(),
  })
    .index("by_type", ["type"])
    .index("by_parent", ["parentLocationId"])
    .index("by_state", ["stateCode"])
    .index("by_type_state", ["type", "stateCode"]),

  userPhones: defineTable({
    userId: v.id("users"),
    phone: v.string(),
    phoneNormalized: v.string(),
    isVerified: v.boolean(),
    isPrimary: v.boolean(),
    verificationCode: v.optional(v.string()), // hashed OTP
    codeExpiresAt: v.optional(v.number()),
    attemptsCount: v.optional(v.number()),
    lastAttemptAt: v.optional(v.number()),
    verifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_phone", ["phoneNormalized"])
    .index("by_user_phone", ["userId", "phoneNormalized"])
    .index("by_user_primary", ["userId", "isPrimary"]),
});



