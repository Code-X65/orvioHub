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
    emailVerificationCode: v.optional(v.string()),
    emailVerificationCodeExpiresAt: v.optional(v.number()),
    passwordResetToken: v.optional(v.string()),
    passwordResetExpiresAt: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("ACTIVE"),
        v.literal("INACTIVE"),
        v.literal("SUSPENDED"),
        v.literal("DELETED"),
        v.literal("active"),
        v.literal("inactive"),
        v.literal("suspended"),
        v.literal("deleted")
      )
    ),
    tokenVersion: v.optional(v.number()),
    avatar: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    phone: v.optional(v.string()),
    phoneNormalized: v.optional(v.string()),
    phoneVerifiedAt: v.optional(v.number()),
    phoneStatus: v.optional(
      v.union(
        v.literal("unverified"),
        v.literal("pending"),
        v.literal("verified"),
        v.literal("disabled"),
        v.literal("not_set")
      )
    ),
    phoneUsedForRecovery: v.optional(v.boolean()),
    phoneUsedForMfa: v.optional(v.boolean()),
    phoneVerificationCode: v.optional(v.string()),
    phoneVerificationExpiresAt: v.optional(v.number()),
    phoneVisibility: v.optional(v.union(v.literal("private"), v.literal("workspace"))),
    preferredName: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    department: v.optional(v.string()),
    bio: v.optional(v.string()),
    country: v.optional(v.string()),
    state: v.optional(v.string()),
    stateCode: v.optional(v.string()),
    lga: v.optional(v.string()),
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
    role: v.optional(v.union(v.literal("user"), v.literal("superadmin"), v.literal("admin"))),
    suspendedAt: v.optional(v.number()),
    suspendedBy: v.optional(v.string()),
    suspensionReason: v.optional(v.string()),
    suspensionNotes: v.optional(v.string()),
    deletionRequestedAt: v.optional(v.number()),
    deletionScheduledAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.string()),
    personalOnboardingCompleted: v.optional(v.boolean()),
    lastLoginIp: v.optional(v.string()),
    totalLoginCount: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("by_status", ["status"])
    .index("by_status_suspended", ["status", "suspendedAt"])
    .index("by_deletedAt", ["deletedAt"])
    .index("by_email_normalized", ["emailNormalized"])
    .index("by_phone_normalized", ["phoneNormalized"])
    .index("by_verification_token", ["emailVerificationToken"])
    .index("by_verification_code", ["emailVerificationCode"])
    .index("by_password_reset_token", ["passwordResetToken"])
    .index("by_email_change_token", ["emailChangeToken"]),

  userProfiles: defineTable({
    userId: v.id("users"),
    useCases: v.optional(v.array(v.string())),
    acquisitionSource: v.optional(v.string()),
    acquisitionSourceOther: v.optional(v.string()),
    role: v.optional(v.string()),
    managesBusiness: v.optional(v.boolean()),
    currentStep: v.optional(v.number()),
    personalOnboardingCompleted: v.boolean(),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  authIdentities: defineTable({
    userId: v.id("users"),
    provider: v.union(
      v.literal("password"),
      v.literal("google"),
      v.literal("facebook"),
      v.literal("phone")
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
    lastVisitedUrl: v.optional(v.string()),
    lastVisitedSubdomain: v.optional(v.string()),
    lastVisitedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sessionHash", ["sessionHash"])
    .index("by_refreshToken", ["refreshToken"])
    .index("by_userId", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),

  authEvents: defineTable({
    eventType: v.string(),
    userId: v.optional(v.id("users")),
    sessionId: v.optional(v.id("sessions")),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_eventType", ["eventType"])
    .index("by_createdAt", ["createdAt"]),

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    industry: v.string(),
    country: v.string(),
    timezone: v.string(),
    website: v.optional(v.string()),
    size: v.optional(v.string()),
    logo: v.optional(v.string()),
    phone: v.optional(v.string()),
    phoneNormalized: v.optional(v.string()),
    phoneVerifiedAt: v.optional(v.number()),
    phoneStatus: v.optional(
      v.union(
        v.literal("unverified"),
        v.literal("pending"),
        v.literal("verified")
      )
    ),
    currency: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
    category: v.optional(v.string()),
    street: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    address: v.optional(v.string()),
    type: v.optional(v.string()),
    status: v.optional(v.string()),
    archivedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_ownerId", ["ownerId"])
    .index("by_owner_status", ["ownerId", "status"])
    .index("by_phone_normalized", ["phoneNormalized"]),

  organizationLimitOverrides: defineTable({
    userId: v.id("users"),
    featureKey: v.string(), // "organization.max_owned_count"
    overrideLimit: v.number(),
    reason: v.string(),
    grantedBy: v.string(),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_user_feature", ["userId", "featureKey"]),

  organizationAuditLogs: defineTable({
    organizationId: v.optional(v.string()),
    userId: v.id("users"),
    eventType: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_eventType", ["eventType"])
    .index("by_org", ["organizationId"])
    .index("by_createdAt", ["createdAt"]),

  organizationMemberships: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(
      v.literal("OWNER"),
      v.literal("ADMIN"),
      v.literal("MANAGER"),
      v.literal("SALES_ATTENDANT"),
      v.literal("STOCK_MANAGER"),
      v.literal("ACCOUNTANT"),
      v.literal("MEMBER")
    ),
    status: v.union(
      v.literal("ACTIVE"),
      v.literal("INACTIVE"),
      v.literal("INVITED")
    ),
    allowedApplications: v.optional(v.array(v.string())),
    allowedBranches: v.optional(v.array(v.id("branches"))),
    primaryBranchId: v.optional(v.id("branches")),
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
    displayName: v.optional(v.string()),
    slug: v.string(),
    type: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    phoneNormalized: v.optional(v.string()),
    phoneVerifiedAt: v.optional(v.number()),
    phoneStatus: v.optional(
      v.union(
        v.literal("unverified"),
        v.literal("pending"),
        v.literal("verified")
      )
    ),
    phoneVerificationPurpose: v.optional(v.string()),
    country: v.optional(v.string()),
    state: v.optional(v.string()),
    city: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    timezone: v.optional(v.string()),
    currency: v.optional(v.string()),
    status: v.optional(v.string()),
    planId: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    enabledModules: v.optional(v.array(v.string())),
    settings: v.optional(v.any()),
    suspendedAt: v.optional(v.number()),
    suspendedBy: v.optional(v.string()),
    suspensionReason: v.optional(v.string()),
    suspensionNotes: v.optional(v.string()),
    deletionRequestedAt: v.optional(v.number()),
    deletionScheduledAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_status_suspended", ["status", "suspendedAt"])
    .index("by_organizationId", ["organizationId"])
    .index("by_org_and_slug", ["organizationId", "slug"])
    .index("by_deletedAt", ["deletedAt"])
    .index("by_phone_normalized", ["phoneNormalized"]),

  workspaceSettings: defineTable({
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    legalName: v.optional(v.string()),
    registrationNumber: v.optional(v.string()),
    taxId: v.optional(v.string()),
    supportEmail: v.optional(v.string()),
    supportPhone: v.optional(v.string()),
    address: v.optional(v.any()),
    business: v.optional(v.any()),
    localization: v.optional(v.any()),
    notifications: v.optional(v.any()),
    defaultLanguage: v.optional(v.string()),
    dateFormat: v.optional(v.string()),
    numberFormat: v.optional(v.string()),
    weekStartsOn: v.optional(v.string()),
    taxEnabled: v.optional(v.boolean()),
    taxDisplayMode: v.optional(v.string()),
    defaultReceiptFooter: v.optional(v.string()),
    defaultNotificationMode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  workspaceBranding: defineTable({
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    faviconUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    secondaryColor: v.optional(v.string()),
    receiptHeader: v.optional(v.string()),
    receiptFooter: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

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
      v.literal("disabled"),
      v.literal("available"),
      v.literal("ACTIVE"),
      v.literal("BETA"),
      v.literal("COMING_SOON")
    ),
    isVisibleToUsers: v.optional(v.boolean()),
    isActivatable: v.optional(v.boolean()),
    isBeta: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    displayOrder: v.optional(v.number()),
    supportsBranches: v.optional(v.boolean()),
    documentationUrl: v.optional(v.string()),
    supportEmail: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_status", ["status"])
    .index("by_order", ["displayOrder"])
    .index("by_visible_status", ["isVisibleToUsers", "status"]),

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
    .index("by_product_email", ["productKey", "emailNormalized"])
    .index("by_product_notified", ["productKey", "notified"])
    .index("by_user", ["userId"]),

  plans: defineTable({
    key: v.string(), // "free", "free_trial", "standard", "premium"
    name: v.string(),
    type: v.optional(v.string()), // "free" | "paid"
    priceAmount: v.optional(v.number()),
    trialDurationDays: v.optional(v.number()), // 30 for free_trial
    features: v.optional(v.any()),
    price: v.optional(
      v.object({
        monthly: v.number(), // 0, 7500, 20000
        annual: v.number(), // 0, 75000, 200000
      })
    ),
    monthlyPrice: v.optional(v.number()),
    annualPrice: v.optional(v.number()),
    currency: v.optional(v.string()),
    limits: v.optional(
      v.object({
        maxOrganizations: v.optional(v.number()),
        maxAppsPerOrganization: v.optional(v.union(v.number(), v.literal("unlimited"))),
        maxBranchesPerApp: v.optional(v.union(v.number(), v.literal("unlimited"))),
        maxMembersPerOrganization: v.optional(v.number()),
        maxProductsPerWorkspace: v.optional(v.number()),
        maxTransactionsPerMonth: v.optional(v.number()),
        maxWorkspaces: v.optional(v.number()),
        maxAppsPerWorkspace: v.optional(v.union(v.number(), v.literal("unlimited"))),
        maxMembersPerWorkspace: v.optional(v.number()),
        orgs: v.optional(v.number()),
        apps: v.optional(v.union(v.number(), v.literal("unlimited"))),
        members: v.optional(v.number()),
        branches: v.optional(v.union(v.number(), v.literal("unlimited"))),
        products: v.optional(v.number()),
        transactions: v.optional(v.number()),
      })
    ),
    allowedApps: v.optional(v.array(v.string())),
    allowedAppKeys: v.optional(v.array(v.string())),
    trialDays: v.optional(v.number()),
    isActive: v.boolean(),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_key", ["key"])
    .index("by_active", ["isActive"]),

  billingAccounts: defineTable({
    ownerUserId: v.id("users"),
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
    organizationId: v.optional(v.union(v.id("organizations"), v.id("workspaces"), v.string())),
    billingEmail: v.string(),
    billingPhone: v.optional(v.string()),
    provider: v.string(), // "paystack"
    providerCustomerId: v.optional(v.string()),
    currency: v.string(),
    status: v.union(v.literal("active"), v.literal("suspended"), v.literal("closed")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_organizationId", ["organizationId"])
    .index("by_ownerUserId", ["ownerUserId"])
    .index("by_status", ["status"]),

  workspaceEntitlements: defineTable({
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    planId: v.string(),
    featureKey: v.string(),
    limitValue: v.optional(v.number()),
    limitType: v.union(v.literal("fixed"), v.literal("unlimited"), v.literal("boolean")),
    enabled: v.boolean(),
    status: v.union(v.literal("active"), v.literal("expired"), v.literal("revoked"), v.literal("pending"), v.literal("restricted")),
    effectiveFrom: v.number(),
    effectiveUntil: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_feature", ["workspaceId", "featureKey"])
    .index("by_status", ["status"]),

  billingEvents: defineTable({
    provider: v.string(), // "paystack"
    providerEventId: v.string(),
    eventType: v.string(),
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
    organizationId: v.optional(v.union(v.id("organizations"), v.id("workspaces"), v.string())),
    billingAccountId: v.optional(v.id("billingAccounts")),
    subscriptionId: v.optional(v.id("subscriptions")),
    status: v.union(v.literal("received"), v.literal("processed"), v.literal("ignored"), v.literal("failed")),
    payloadMetadata: v.optional(v.any()),
    processedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_provider_event_id", ["providerEventId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  subscriptions: defineTable({
    organizationId: v.optional(v.id("organizations")),
    workspaceId: v.optional(v.id("workspaces")),
    billingAccountId: v.optional(v.id("billingAccounts")),
    userId: v.optional(v.id("users")), // Deprecated: subscriptions are strictly per-organization
    planId: v.optional(v.union(v.id("plans"), v.string())),
    planKey: v.string(), // "free_trial", "standard", "premium"
    selectedPlan: v.optional(v.string()), // "free_trial", "standard", "premium"
    activePlan: v.optional(v.union(v.string(), v.null())), // "free_trial", "standard", "premium" or null if unpaid
    checkoutStatus: v.optional(v.string()), // "not_started" | "not_required" | "pending" | "completed" | "failed"
    paymentStatus: v.optional(v.string()), // "not_required" | "pending" | "success" | "failed"
    entitlementStatus: v.optional(v.string()), // "inactive" | "active"
    pendingPlanKey: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("trial"),
      v.literal("trialing"),
      v.literal("past_due"),
      v.literal("grace_period"),
      v.literal("canceled"),
      v.literal("cancelled"),
      v.literal("suspended"),
      v.literal("expired"),
      v.literal("pending")
    ),
    billingInterval: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    trialStart: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    gracePeriodEnd: v.optional(v.number()),
    paymentMethod: v.optional(v.union(v.literal("bank_transfer"), v.literal("paystack"), v.literal("flutterwave"), v.literal("manual"))),
    paystackCustomerCode: v.optional(v.string()),
    paystackSubscriptionCode: v.optional(v.string()),
    paystackPlanCode: v.optional(v.string()),
    paystackSubscriptionId: v.optional(v.string()),
    lastPaymentReference: v.optional(v.string()),
    lastPaymentDate: v.optional(v.number()),
    nextPaymentDate: v.optional(v.number()),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    activatedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_workspace", ["workspaceId"])
    .index("by_plan", ["planKey"])
    .index("by_status", ["status"]),

  invoices: defineTable({
    organizationId: v.optional(v.id("organizations")),
    workspaceId: v.optional(v.id("workspaces")),
    subscriptionId: v.optional(v.id("subscriptions")),
    paymentId: v.optional(v.id("payments")),
    invoiceNumber: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("canceled"),
      v.literal("failed")
    ),
    amount: v.number(),
    currency: v.string(),
    dueDate: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    issuedAt: v.optional(v.number()),
    paymentReference: v.optional(v.string()),
    pdfUrl: v.optional(v.string()),
    paymentMethod: v.optional(
      v.union(v.literal("bank_transfer"), v.literal("paystack"), v.literal("flutterwave"), v.literal("manual"))
    ),
    paystackPaymentId: v.optional(v.string()),
    items: v.optional(
      v.array(
        v.object({
          description: v.string(),
          quantity: v.number(),
          unitPrice: v.number(),
          total: v.number(),
        })
      )
    ),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_subscription", ["subscriptionId"])
    .index("by_invoiceNumber", ["invoiceNumber"]),

  payments: defineTable({
    organizationId: v.optional(v.id("organizations")),
    workspaceId: v.optional(v.id("workspaces")),
    userId: v.optional(v.id("users")),
    invoiceId: v.optional(v.id("invoices")),
    subscriptionId: v.optional(v.id("subscriptions")),
    amount: v.number(),
    currency: v.string(),
    provider: v.optional(v.string()), // "paystack", "flutterwave", "manual"
    providerReference: v.optional(v.string()),
    paymentMethod: v.optional(v.union(v.literal("bank_transfer"), v.literal("paystack"), v.literal("flutterwave"), v.literal("manual"))),
    paystackPaymentId: v.optional(v.string()),
    paystackAuthorization: v.optional(v.string()),
    reference: v.optional(v.string()),
    providerEventId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("refunded")
    ),
    bankTransferDetails: v.optional(
      v.object({
        bankName: v.string(),
        accountNumber: v.string(),
        accountName: v.string(),
        reference: v.string(),
        proofOfPaymentUrl: v.optional(v.string()),
        verifiedBy: v.optional(v.id("users")),
        verifiedAt: v.optional(v.number()),
      })
    ),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_userId", ["userId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_subscription", ["subscriptionId"])
    .index("by_invoice", ["invoiceId"])
    .index("by_reference", ["reference"])
    .index("by_provider_event_id", ["providerEventId"])
    .index("by_status", ["status"]),

  usageCounters: defineTable({
    userId: v.optional(v.id("users")),
    workspaceId: v.id("workspaces"),
    productKey: v.optional(v.string()),
    featureKey: v.string(), // "workspace.count", "apps.count", "members.count", "products.count", "transactions.count"
    periodStart: v.number(),
    periodEnd: v.number(),
    usageValue: v.number(),
    limitValue: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_feature", ["workspaceId", "featureKey"])
    .index("by_user_feature", ["userId", "featureKey"])
    .index("by_user_workspace", ["userId", "workspaceId"])
    .index("by_user_workspace_product_feature", ["userId", "workspaceId", "productKey", "featureKey"]),

  workspaceProducts: defineTable({
    workspaceId: v.id("workspaces"),
    productKey: v.string(),
    status: v.string(), // "activating" | "setup_incomplete" | "active" | "suspended" | "deactivated"
    planId: v.optional(v.string()),
    activationSource: v.optional(v.string()),
    activationStatus: v.optional(v.string()),
    onboardingStatus: v.optional(v.string()),
    trialStartedAt: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    activatedBy: v.id("users"),
    activatedAt: v.number(),
    suspendedAt: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
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
    role: v.string(), // "admin" | "manager" | "staff" | "viewer" | "member"
    organizationRole: v.optional(v.string()),
    appAccess: v.optional(
      v.array(
        v.object({
          productKey: v.string(),
          appRole: v.string(),
          branchIds: v.array(v.string()),
        })
      )
    ),
    branchIds: v.optional(v.array(v.id("branches"))),
    tokenHash: v.string(),
    status: v.string(), // "pending" | "accepted" | "declined" | "expired" | "revoked"
    invitedBy: v.id("users"),
    expiresAt: v.number(),
    acceptedBy: v.optional(v.id("users")),
    acceptedAt: v.optional(v.number()),
    declinedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_workspace", ["workspaceId"])
    .index("by_email_status", ["emailNormalized", "status"])
    .index("by_invitee", ["inviteeUserId"]),

  branches: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    organizationId: v.optional(v.id("organizations")),
    applicationId: v.optional(v.id("applications")),
    productKey: v.optional(v.string()),
    name: v.string(),
    code: v.optional(v.string()),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
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
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    address: v.optional(v.string()), // Formatted / legacy address
    formattedAddress: v.optional(v.string()),
    timezone: v.optional(v.string()),
    currency: v.optional(v.string()),
    // Contact & Verification fields
    phone: v.optional(v.string()),
    phoneNormalized: v.optional(v.string()),
    phoneVerified: v.optional(v.boolean()),
    phoneVerifiedAt: v.optional(v.number()),
    phoneStatus: v.optional(
      v.union(
        v.literal("unverified"),
        v.literal("pending"),
        v.literal("verified")
      )
    ),
    verificationCode: v.optional(v.string()), // hashed OTP for branch phone
    codeExpiresAt: v.optional(v.number()),
    email: v.optional(v.string()),
    managerId: v.optional(v.id("users")),
    status: v.string(),
    createdBy: v.optional(v.id("users")),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_organizationId", ["organizationId"])
    .index("by_applicationId", ["applicationId"])
    .index("by_org_and_app", ["organizationId", "applicationId"])
    .index("by_workspace_product", ["workspaceId", "productKey"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_workspace_primary", ["workspaceId", "isPrimary"])
    .index("by_workspace_state", ["workspaceId", "state"])
    .index("by_workspace_lga", ["workspaceId", "lga"])
    .index("by_workspace_code", ["workspaceId", "code"])
    .index("by_phone", ["phoneNormalized"]),

  branchSettings: defineTable({
    branchId: v.union(v.id("branches"), v.string()),
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    productKey: v.optional(v.string()),
    displayName: v.optional(v.string()),
    openingHours: v.optional(v.any()),
    operatingHours: v.optional(v.any()),
    receiptFooter: v.optional(v.string()),
    negativeStockAllowed: v.optional(v.boolean()),
    allowNegativeStock: v.optional(v.boolean()),
    enforceStockCheck: v.optional(v.boolean()),
    lowStockThreshold: v.optional(v.number()),
    isPrimary: v.optional(v.boolean()),
    status: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_branch", ["branchId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_branch", ["workspaceId", "branchId"]),

  applicationSettings: defineTable({
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    productKey: v.string(),
    displayName: v.optional(v.string()),
    enabled: v.boolean(),
    status: v.optional(v.string()),
    settings: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_product", ["workspaceId", "productKey"]),

  appBranchAccess: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    productKey: v.string(),
    branchId: v.id("branches"),
    status: v.string(), // "active" | "revoked"
    grantedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_workspace_product_user", ["workspaceId", "productKey", "userId"])
    .index("by_branch_user", ["branchId", "userId"])
    .index("by_branch_status", ["branchId", "status"])
    .index("by_userId", ["userId"]),

  emailEvents: defineTable({
    recipient: v.string(),
    template: v.string(),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    status: v.string(), // "queued" | "sent" | "failed"
    providerMessageId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
  })
    .index("by_recipient", ["recipient"])
    .index("by_status", ["status"]),

  workspaceAuditLogs: defineTable({
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    actorUserId: v.optional(v.union(v.id("users"), v.string())),
    action: v.optional(v.string()),
    eventType: v.string(),
    entityType: v.optional(v.string()),
    resourceType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    productKey: v.optional(v.string()),
    branchId: v.optional(v.union(v.id("branches"), v.string())),
    severity: v.optional(v.string()),
    metadata: v.optional(v.any()),
    beforeValues: v.optional(v.any()),
    afterValues: v.optional(v.any()),
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
    data: v.optional(v.any()), // Structured metadata (e.g. { inviteId, organizationId, organizationName, role, inviterName })
    severity: v.union(v.literal("INFO"), v.literal("SUCCESS"), v.literal("WARNING"), v.literal("ERROR")),
    channel: v.union(v.literal("IN_APP"), v.literal("EMAIL"), v.literal("SMS"), v.literal("WHATSAPP")),
    status: v.union(v.literal("UNREAD"), v.literal("READ"), v.literal("ARCHIVED")),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_user_type", ["userId", "type"]),

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
      v.literal("SALES_ATTENDANT"),
      v.literal("STOCK_MANAGER"),
      v.literal("ACCOUNTANT"),
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
    allowedApplications: v.optional(v.array(v.string())),
    allowedBranches: v.optional(v.array(v.id("branches"))),
    primaryBranchId: v.optional(v.id("branches")),
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
    targetWorkspaceId: v.optional(v.id("workspaces")),
    productKey: v.optional(v.string()),
    eventType: v.optional(v.string()),
    action: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    resource: v.string(),
    severity: v.optional(
      v.union(
        v.literal("info"),
        v.literal("warning"),
        v.literal("critical"),
        v.literal("low"),
        v.literal("medium"),
        v.literal("high")
      )
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
    .index("by_target_user", ["targetUserId"])
    .index("by_target_workspace", ["targetWorkspaceId"])
    .index("by_eventType", ["eventType"])
    .index("by_timestamp", ["timestamp"])
    .index("by_createdAt", ["createdAt"]),

  emailOutbox: defineTable({
    to: v.string(),
    template: v.string(),
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

  receiptSettings: defineTable({
    workspaceId: v.string(),
    storeName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    headerText: v.optional(v.string()),
    footerText: v.optional(v.string()),
    returnPolicy: v.optional(v.string()),
    tin: v.optional(v.string()),
    vatRate: v.optional(v.number()),
    enableVat: v.optional(v.boolean()),
    showCashier: v.optional(v.boolean()),
    showCustomer: v.optional(v.boolean()),
    showBarcode: v.optional(v.boolean()),
    paperWidth: v.optional(v.union(v.literal("58mm"), v.literal("80mm"))),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspaceId", ["workspaceId"]),

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
      v.literal("COMPLETED"),
      v.literal("pending"),
      v.literal("cooling_off"),
      v.literal("cancelled"),
      v.literal("completed")
    ),
    reason: v.optional(v.string()),
    requestedBy: v.optional(v.string()),
    requestedAt: v.number(),
    scheduledDeletionAt: v.number(),
    cancelledAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    deletionTokenHash: v.optional(v.string()),
    adminForceDelete: v.optional(v.boolean()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_scheduled_deletion", ["scheduledDeletionAt"])
    .index("by_token_hash", ["deletionTokenHash"]),

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
    avatar: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
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
    organizationId: v.optional(v.id("organizations")),
    workspaceId: v.optional(v.id("workspaces")),
    planKey: v.string(), // "standard" | "premium"
    amount: v.number(), // in kobo
    currency: v.string(), // "NGN"
    billingCycle: v.string(), // "monthly" | "annual"
    paymentReference: v.string(), // e.g. "GTB-TRX-9821374"
    paymentMethod: v.string(), // "bank_transfer" | "cash" | "pos" | "cheque" | "manual" | "other"
    paidAt: v.number(),
    recordedBy: v.id("users"), // Super Admin
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_paid_at", ["paidAt"]),

  paymentTransactions: defineTable({
    workspaceId: v.optional(v.union(v.id("workspaces"), v.string())),
    organizationId: v.optional(v.union(v.id("organizations"), v.string())),
    planKey: v.string(), // "standard" | "premium"
    amount: v.number(), // in kobo
    currency: v.string(), // "NGN"
    billingCycle: v.string(), // "monthly" | "annual"
    gateway: v.union(v.literal("paystack"), v.literal("flutterwave")),
    gatewayReference: v.string(), // Paystack reference or Flutterwave tx_ref
    providerEventId: v.optional(v.string()),
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
    .index("by_organizationId", ["organizationId"])
    .index("by_gateway_ref", ["gatewayReference"])
    .index("by_provider_event_id", ["providerEventId"])
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

  applications: defineTable({
    key: v.string(), // "inventory", "task_management", "crm", "gym", "booking", etc.
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("available"),
        v.literal("coming_soon"),
        v.literal("disabled"),
        v.literal("active"),
        v.literal("draft")
      )
    ),
    isVisibleToUsers: v.optional(v.boolean()),
    isActivatable: v.optional(v.boolean()),
    route: v.optional(v.string()),
    requiredPlan: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_status", ["status"])
    .index("by_visible_status", ["isVisibleToUsers", "status"]),

  orgApplications: defineTable({
    organizationId: v.id("organizations"),
    applicationId: v.id("applications"),
    enabled: v.boolean(),
    status: v.optional(v.string()), // "trial" | "active" | "suspended" | "inactive"
    planId: v.optional(v.string()), // "free_trial" | "standard"
    billingCycle: v.optional(v.string()), // "monthly" | "annual"
    trialStartsAt: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    paymentReference: v.optional(v.string()),
    paymentGateway: v.optional(v.string()),
    activatedAt: v.optional(v.number()),
    activatedBy: v.optional(v.id("users")),
    config: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_applicationId", ["applicationId"])
    .index("by_org_and_app", ["organizationId", "applicationId"]),

  organizationProfiles: defineTable({
    organizationId: v.id("organizations"),
    businessType: v.optional(v.string()), // retail, wholesale, service, etc.
    branchCountRange: v.optional(v.string()), // "1", "2-5", etc.
    productCountRange: v.optional(v.string()), // "1-50", "51-200", etc.
    primaryUsers: v.optional(v.array(v.string())), // ["owner", "manager", ...]
    completedAt: v.number(),
  }).index("by_organizationId", ["organizationId"]),

  applicationOnboardingResponses: defineTable({
    organizationId: v.id("organizations"),
    applicationId: v.id("applications"),
    previousTools: v.optional(v.array(v.string())),
    painPoints: v.optional(v.array(v.string())),
    priorityFeatures: v.optional(v.array(v.string())),
    needsMultiBranch: v.optional(v.boolean()),
    teamComfortLevel: v.optional(v.string()),
    completedAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_applicationId", ["applicationId"])
    .index("by_org_and_app", ["organizationId", "applicationId"]),

  branchMemberships: defineTable({
    workspaceId: v.string(),
    organizationId: v.optional(v.id("organizations")),
    applicationKey: v.string(), // "inventory", "taskmanagement", etc.
    branchId: v.string(),
    userId: v.id("users"),
    applicationMembershipId: v.optional(v.string()),
    role: v.string(), // "inventory_owner" | "inventory_manager" | "cashier" | "stock_manager" | "accountant" | "inventory_viewer"
    roleOverride: v.optional(v.string()),
    permissions: v.array(v.string()),
    status: v.union(v.literal("active"), v.literal("suspended"), v.literal("removed")),
    assignedByUserId: v.id("users"),
    assignedAt: v.number(),
    suspendedAt: v.optional(v.number()),
    suspensionReason: v.optional(v.string()),
    removedAt: v.optional(v.number()),
    removalReason: v.optional(v.string()),
    transferredFromBranchId: v.optional(v.string()),
    transferredFromRole: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_workspace_branch", ["workspaceId", "branchId"])
    .index("by_workspace_application", ["workspaceId", "applicationKey"])
    .index("by_workspace_application_branch", ["workspaceId", "applicationKey", "branchId"])
    .index("by_user_application", ["userId", "applicationKey"])
    .index("by_user_branch", ["userId", "branchId"])
    .index("by_branch_status", ["branchId", "status"])
    .index("by_user_status", ["userId", "status"])
    .index("by_status", ["status"]),

  branchTransfers: defineTable({
    workspaceId: v.string(),
    organizationId: v.optional(v.id("organizations")),
    applicationKey: v.string(),
    userId: v.id("users"),
    membershipId: v.optional(v.string()),
    fromBranchId: v.optional(v.string()),
    toBranchId: v.optional(v.string()),
    sourceBranchId: v.string(),
    targetBranchId: v.string(),
    fromRole: v.optional(v.string()),
    toRole: v.optional(v.string()),
    previousRole: v.string(),
    newRole: v.string(),
    reason: v.optional(v.string()),
    transferredBy: v.id("users"),
    effectiveDate: v.number(),
    effectiveAt: v.optional(v.number()),
    message: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_source_branch", ["sourceBranchId"])
    .index("by_target_branch", ["targetBranchId"]),

  branchMembershipTransfers: defineTable({
    workspaceId: v.string(),
    organizationId: v.optional(v.id("organizations")),
    applicationKey: v.string(), // "inventory"
    userId: v.id("users"),
    membershipId: v.string(),
    fromBranchId: v.string(),
    toBranchId: v.string(),
    fromRole: v.string(),
    toRole: v.string(),
    reason: v.optional(v.string()),
    effectiveAt: v.number(),
    transferredBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_membership", ["membershipId"])
    .index("by_created", ["createdAt"])
    .index("by_from_branch", ["fromBranchId"])
    .index("by_to_branch", ["toBranchId"]),

  applicationMemberships: defineTable({
    workspaceId: v.string(),
    userId: v.id("users"),
    applicationKey: v.string(), // "inventory", "task_management", etc.
    role: v.string(), // "inventory_owner" | "inventory_manager" | "cashier" | "stock_manager" | "accountant" | "inventory_viewer"
    permissions: v.array(v.string()),
    status: v.union(v.literal("active"), v.literal("suspended"), v.literal("removed")),
    assignedBy: v.id("users"),
    assignedAt: v.number(),
    suspendedAt: v.optional(v.number()),
    suspensionReason: v.optional(v.string()),
    removedAt: v.optional(v.number()),
    removalReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_workspace_application", ["workspaceId", "applicationKey"])
    .index("by_user_application", ["userId", "applicationKey"])
    .index("by_workspace_application_user", ["workspaceId", "applicationKey", "userId"])
    .index("by_status", ["status"]),

  applicationInvitations: defineTable({
    workspaceId: v.string(),
    applicationKey: v.string(), // "inventory"
    branchId: v.string(),
    email: v.string(),
    emailNormalized: v.string(),
    inviteeUserId: v.optional(v.id("users")),
    role: v.string(),
    permissions: v.array(v.string()),
    message: v.optional(v.string()),
    tokenHash: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("expired"),
      v.literal("revoked")
    ),
    invitedBy: v.id("users"),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    declinedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_application", ["workspaceId", "applicationKey"])
    .index("by_workspace_application_branch", ["workspaceId", "applicationKey", "branchId"])
    .index("by_email_status", ["emailNormalized", "status"])
    .index("by_invitee_user", ["inviteeUserId"]),

  userAdminSupportNotes: defineTable({
    userId: v.id("users"),
    authorId: v.id("platformAdmins"),
    authorName: v.string(),
    category: v.union(
      v.literal("support"),
      v.literal("billing"),
      v.literal("security"),
      v.literal("onboarding"),
      v.literal("general")
    ),
    note: v.string(),
    visibility: v.literal("admin_only"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_user_and_category", ["userId", "category"]),

  phoneVerificationChallenges: defineTable({
    userId: v.optional(v.id("users")),
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
    organizationId: v.optional(v.union(v.id("organizations"), v.string())),
    branchId: v.optional(v.union(v.id("branches"), v.string())),
    phone: v.string(),
    phoneNormalized: v.string(),
    purpose: v.string(), // "user_phone_verification" | "user_phone_change" | "phone_recovery_setup" | "sms_mfa_setup" | "workspace_phone_verification" | "branch_phone_verification"
    codeHash: v.string(),
    status: v.union(v.literal("pending"), v.literal("verified"), v.literal("expired"), v.literal("cancelled")),
    attempts: v.number(),
    maxAttempts: v.number(),
    expiresAt: v.number(),
    lastResentAt: v.optional(v.number()),
    resendCount: v.optional(v.number()),
    verifiedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_phone_normalized", ["phoneNormalized"])
    .index("by_user_purpose", ["userId", "purpose", "status"])
    .index("by_workspace_purpose", ["workspaceId", "purpose", "status"])
    .index("by_branch_purpose", ["branchId", "purpose", "status"])
    .index("by_status_expires", ["status", "expiresAt"]),
});
