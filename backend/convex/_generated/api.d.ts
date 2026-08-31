/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminAudit from "../adminAudit.js";
import type * as adminAuth from "../adminAuth.js";
import type * as adminConfig from "../adminConfig.js";
import type * as adminDashboard from "../adminDashboard.js";
import type * as adminInvitations from "../adminInvitations.js";
import type * as adminOnboarding from "../adminOnboarding.js";
import type * as adminOrganizations from "../adminOrganizations.js";
import type * as adminProducts from "../adminProducts.js";
import type * as adminUsers from "../adminUsers.js";
import type * as audit from "../audit.js";
import type * as branches from "../branches.js";
import type * as emailOutbox from "../emailOutbox.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as invitations from "../invitations.js";
import type * as locations from "../locations.js";
import type * as manualPayments from "../manualPayments.js";
import type * as modules from "../modules.js";
import type * as notes from "../notes.js";
import type * as notifications from "../notifications.js";
import type * as notifyList from "../notifyList.js";
import type * as oauthCodes from "../oauthCodes.js";
import type * as onboarding from "../onboarding.js";
import type * as onboardingFlows from "../onboardingFlows.js";
import type * as organizations from "../organizations.js";
import type * as paymentTransactions from "../paymentTransactions.js";
import type * as plans from "../plans.js";
import type * as products from "../products.js";
import type * as scripts_createAdmin from "../scripts/createAdmin.js";
import type * as sessions from "../sessions.js";
import type * as subscriptions from "../subscriptions.js";
import type * as usageCounters from "../usageCounters.js";
import type * as userPhones from "../userPhones.js";
import type * as userProfile from "../userProfile.js";
import type * as users from "../users.js";
import type * as workspaceMembers from "../workspaceMembers.js";
import type * as workspaceProducts from "../workspaceProducts.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminAudit: typeof adminAudit;
  adminAuth: typeof adminAuth;
  adminConfig: typeof adminConfig;
  adminDashboard: typeof adminDashboard;
  adminInvitations: typeof adminInvitations;
  adminOnboarding: typeof adminOnboarding;
  adminOrganizations: typeof adminOrganizations;
  adminProducts: typeof adminProducts;
  adminUsers: typeof adminUsers;
  audit: typeof audit;
  branches: typeof branches;
  emailOutbox: typeof emailOutbox;
  http: typeof http;
  inventory: typeof inventory;
  invitations: typeof invitations;
  locations: typeof locations;
  manualPayments: typeof manualPayments;
  modules: typeof modules;
  notes: typeof notes;
  notifications: typeof notifications;
  notifyList: typeof notifyList;
  oauthCodes: typeof oauthCodes;
  onboarding: typeof onboarding;
  onboardingFlows: typeof onboardingFlows;
  organizations: typeof organizations;
  paymentTransactions: typeof paymentTransactions;
  plans: typeof plans;
  products: typeof products;
  "scripts/createAdmin": typeof scripts_createAdmin;
  sessions: typeof sessions;
  subscriptions: typeof subscriptions;
  usageCounters: typeof usageCounters;
  userPhones: typeof userPhones;
  userProfile: typeof userProfile;
  users: typeof users;
  workspaceMembers: typeof workspaceMembers;
  workspaceProducts: typeof workspaceProducts;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
