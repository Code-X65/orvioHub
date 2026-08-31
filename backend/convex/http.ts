import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server.js";
import { api } from "./_generated/api.js";

const http = httpRouter();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Login HTTP handler
http.route({
  path: "/admin/auth/login",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("cf-connecting-ip") || undefined;
      const userAgent = request.headers.get("user-agent") || undefined;

      const result = await ctx.runMutation(api.adminAuth.login, {
        email: body.email,
        password: body.password,
        ipAddress,
        userAgent,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || "Login failed" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }
  }),
});

// Me/ValidateSession HTTP handler
http.route({
  path: "/admin/auth/me",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const authHeader = request.headers.get("authorization");
      const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

      if (!token) {
        return new Response(JSON.stringify({ error: "Missing authorization token" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const admin = await ctx.runQuery(api.adminAuth.getAdminBySession, {
        sessionToken: token,
      });

      if (!admin) {
        return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ admin }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || "Validation failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }),
});

// Logout HTTP handler
http.route({
  path: "/admin/auth/logout",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const token = body.sessionToken || request.headers.get("authorization")?.replace("Bearer ", "");

      if (token) {
        await ctx.runMutation(api.adminAuth.logout, { sessionToken: token });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || "Logout failed" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }),
});

// Preflight CORS handler for admin auth routes
http.route({
  path: "/admin/auth/login",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/admin/auth/me",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/admin/auth/logout",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

export default http;
