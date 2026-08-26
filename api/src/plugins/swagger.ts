import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyPluginAsync } from 'fastify';

const plugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'orvioHub Backend Onboarding API',
        description:
          'Authoritative multi-tenant B2B SaaS onboarding lifecycle API with canonical state machine, role-based access control, tenant isolation, and atomic organization provisioning.',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local Development Server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Provide JWT token obtained from /api/v1/auth/signup or /api/v1/auth/login',
          },
        },
      },
      tags: [
        { name: 'Auth', description: 'Authentication and email verification endpoints' },
        { name: 'Organizations', description: 'Organization provisioning, settings, and invitations' },
        { name: 'Onboarding', description: 'Canonical onboarding state machine and progression' },
        { name: 'Invitations', description: 'Team invitation verification and acceptance' },
        { name: 'Health', description: 'Service health and status diagnostics' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  });
};

export const swaggerPlugin = fp(plugin, {
  name: 'swagger-plugin',
});
