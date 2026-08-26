/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit from "../audit.js";
import type * as emailOutbox from "../emailOutbox.js";
import type * as inventory from "../inventory.js";
import type * as invitations from "../invitations.js";
import type * as modules from "../modules.js";
import type * as notes from "../notes.js";
import type * as notifications from "../notifications.js";
import type * as oauthCodes from "../oauthCodes.js";
import type * as onboarding from "../onboarding.js";
import type * as onboardingFlows from "../onboardingFlows.js";
import type * as organizations from "../organizations.js";
import type * as sessions from "../sessions.js";
import type * as users from "../users.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audit: typeof audit;
  emailOutbox: typeof emailOutbox;
  inventory: typeof inventory;
  invitations: typeof invitations;
  modules: typeof modules;
  notes: typeof notes;
  notifications: typeof notifications;
  oauthCodes: typeof oauthCodes;
  onboarding: typeof onboarding;
  onboardingFlows: typeof onboardingFlows;
  organizations: typeof organizations;
  sessions: typeof sessions;
  users: typeof users;
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
