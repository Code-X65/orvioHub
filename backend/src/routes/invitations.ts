import type { FastifyPluginAsync } from 'fastify';
import { dataService } from '../services/dataService.js';
import { ERROR_CODES } from '../config/constants.js';

export const invitationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/invitations/:token (Public lookup — rate-limited to prevent enumeration)
  fastify.get(
    '/:token',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['Invitations'],
        summary: 'Inspect team invitation details',
        params: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };

      // 1. Try workspace invitation lookup
      const wsInvite = await dataService.getWorkspaceInvitationByToken(token);
      if (wsInvite) {
        return reply.send({
          success: true,
          data: {
            invitation: {
              id: wsInvite.id,
              type: 'workspace',
              workspaceId: wsInvite.workspaceId,
              workspaceName: wsInvite.workspaceName,
              workspaceSlug: wsInvite.workspaceSlug,
              workspaceLogoUrl: wsInvite.workspaceLogoUrl,
              inviterName: wsInvite.inviterName,
              email: wsInvite.email,
              phone: wsInvite.phone || null,
              role: wsInvite.role,
              organizationRole: wsInvite.organizationRole || wsInvite.role,
              appAccess: wsInvite.appAccess || [],
              productKey: wsInvite.productKey,
              branchIds: wsInvite.branchIds,
              status: wsInvite.status,
              expiresAt: wsInvite.expiresAt,
              isExpired: wsInvite.isExpired,
            },
          },
        });
      }

      // 2. Fallback to organization invitation lookup
      const invite = await dataService.getInvitationByToken(token);

      if (invite) {
        return reply.send({ success: true, data: { invitation: invite } });
      }

      // 3. Final fallback: team invitation by _id (branch-level invitations)
      try {
        const teamInvite = await dataService.query('teamInvitations:getInvitationById', { invitationId: token });
        if (teamInvite) {
          return reply.send({
            success: true,
            data: { invitation: teamInvite },
          });
        }
      } catch (_e) {}

      return reply.status(404).send({
        success: false,
        error: {
          code: ERROR_CODES.INVITATION_NOT_FOUND,
          message: 'Invitation link is invalid or no longer exists.',
        },
      });
    }
  );

  // POST /api/v1/invitations/accept (Requires auth)
  fastify.post(
    '/accept',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Invitations'],
        summary: 'Accept an invitation with JSON token payload',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { token: string };
      try {
        // 1. Try workspace invitation accept
        try {
          const wsResult = await dataService.acceptWorkspaceInvitation(body.token, request.user.id);
          const wsName = wsResult?.workspace?.name || wsResult?.organization?.name || wsResult?.workspaceName || 'the organization';
          return reply.send({
            success: true,
            data: {
              type: 'workspace',
              workspace: wsResult?.workspace || wsResult?.organization || wsResult,
              role: wsResult?.role,
              productKey: wsResult?.productKey,
            },
            message: `Successfully joined ${wsName}.`,
          });
        } catch (wsErr: any) {
          if (wsErr.message?.includes('INVITATION_CANCELLED') || wsErr.code === 'INVITATION_CANCELLED') {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'INVITATION_CANCELLED',
                message: 'This invitation has been cancelled by an organization administrator.',
              },
            });
          }
          if (!wsErr.message?.includes('INVITATION_NOT_FOUND') && !wsErr.message?.includes('ArgumentValidationError')) {
            throw wsErr;
          }
        }

        // 2. Fallback to org invitation
        const result = await dataService.acceptInvitation(body.token, request.user.id);
        const orgName = result?.organization?.name || 'the organization';
        return reply.send({
          success: true,
          data: {
            organization: result?.organization ? {
              id: result.organization.id,
              name: result.organization.name,
              slug: result.organization.slug,
            } : result,
            role: result?.role,
          },
          message: `Successfully joined ${orgName}.`,
        });
      } catch (err: any) {
        if (err.message?.includes('INVITATION_NOT_FOUND') || err.code === 'INVITATION_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.INVITATION_NOT_FOUND,
              message: err.message,
            },
          });
        }
        if (err.message?.includes('INVITATION_ALREADY_ACCEPTED') || err.code === 'INVITATION_ALREADY_ACCEPTED') {
          return reply.status(409).send({
            success: false,
            error: {
              code: ERROR_CODES.INVITATION_ALREADY_ACCEPTED,
              message: err.message,
            },
          });
        }
        if (err.message?.includes('INVITATION_EXPIRED') || err.code === 'INVITATION_EXPIRED') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.INVITATION_EXPIRED,
              message: err.message,
            },
          });
        }
        if (err.message?.includes('INVITATION_CANCELLED') || err.code === 'INVITATION_CANCELLED') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVITATION_CANCELLED',
              message: 'This invitation has been cancelled by an organization administrator.',
            },
          });
        }
        if (err.message?.includes('INVITATION_EMAIL_MISMATCH') || err.code === 'INVITATION_EMAIL_MISMATCH') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.INVITATION_EMAIL_MISMATCH,
              message: err.message,
            },
          });
        }
        if (err.message?.includes('PLAN_MEMBER_LIMIT_REACHED') || err.code === 'PLAN_MEMBER_LIMIT_REACHED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'PLAN_MEMBER_LIMIT_REACHED',
              message: err.message.replace('PLAN_MEMBER_LIMIT_REACHED:', '').trim(),
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/invitations/:token/accept (Requires auth)
  fastify.post(
    '/:token/accept',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Invitations'],
        summary: 'Accept an invitation via url param',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };

      try {
        // 1. Try workspace invitation accept
        try {
          const wsResult = await dataService.acceptWorkspaceInvitation(token, request.user.id);
          const wsName = wsResult?.workspace?.name || wsResult?.organization?.name || wsResult?.workspaceName || 'the organization';
          return reply.send({
            success: true,
            data: {
              type: 'workspace',
              workspace: wsResult?.workspace || wsResult?.organization || wsResult,
              role: wsResult?.role,
              productKey: wsResult?.productKey,
            },
            message: `Successfully joined ${wsName}.`,
          });
        } catch (wsErr: any) {
          if (wsErr.message?.includes('INVITATION_CANCELLED') || wsErr.code === 'INVITATION_CANCELLED') {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'INVITATION_CANCELLED',
                message: 'This invitation has been cancelled by an organization administrator.',
              },
            });
          }
          if (!wsErr.message?.includes('INVITATION_NOT_FOUND') && !wsErr.message?.includes('ArgumentValidationError')) {
            throw wsErr;
          }
        }

        // 2. Try org invitation accept
        try {
          const result = await dataService.acceptInvitation(token, request.user.id);
          return reply.send({
            success: true,
            data: {
              organization: {
                id: result.organization.id,
                name: result.organization.name,
                slug: result.organization.slug,
              },
              role: result.role,
            },
            message: `Successfully joined ${result.organization.name}.`,
          });
        } catch (orgErr: any) {
          if (!orgErr.message?.includes('INVITATION_NOT_FOUND') && !orgErr.message?.includes('ArgumentValidationError')) {
            throw orgErr;
          }
        }

        // 3. Try team (branch-level) invitation accept using token as Convex _id
        const teamInvite: any = await dataService.query('teamInvitations:getInvitationById', { invitationId: token }).catch(() => null);
        if (teamInvite) {
          if (teamInvite.email && request.user?.email && teamInvite.email.toLowerCase() !== request.user.email.toLowerCase()) {
            return reply.status(403).send({
              success: false,
              error: {
                code: ERROR_CODES.INVITATION_EMAIL_MISMATCH || 'EMAIL_MISMATCH',
                message: `This invitation was sent to ${teamInvite.email}. You are currently signed in as ${request.user.email}.`,
              },
            });
          }
          if (teamInvite.status === 'accepted') {
            return reply.status(409).send({
              success: false,
              error: { code: 'INVITATION_ALREADY_ACCEPTED', message: 'This invitation has already been accepted.' },
            });
          }
          if (teamInvite.expiresAt && teamInvite.expiresAt < Date.now()) {
            return reply.status(400).send({
              success: false,
              error: { code: 'INVITATION_EXPIRED', message: 'This invitation has expired.' },
            });
          }
          if (teamInvite.status === 'revoked') {
            return reply.status(400).send({
              success: false,
              error: { code: 'INVITATION_CANCELLED', message: 'This invitation has been revoked.' },
            });
          }

          const acceptResult: any = await dataService.mutate('teamInvitations:acceptTeamInvitation', {
            invitationId: token,
            userId: request.user.id,
          });

          return reply.send({
            success: true,
            data: {
              type: 'team',
              workspace: { id: acceptResult?.workspaceId },
              branchId: acceptResult?.branchId,
              branchRole: acceptResult?.branchRole,
            },
            message: `Successfully joined the branch as ${teamInvite.branchRole || 'staff'}.`,
          });
        }

        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.INVITATION_NOT_FOUND,
            message: 'Invitation link is invalid or no longer exists.',
          },
        });
      } catch (err: any) {
        if (err.code === 'INVITATION_NOT_FOUND' || err.message?.includes('INVITATION_NOT_FOUND')) {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.INVITATION_NOT_FOUND,
              message: err.message,
            },
          });
        }
        if (err.code === 'INVITATION_ALREADY_ACCEPTED' || err.message?.includes('INVITATION_ALREADY_ACCEPTED')) {
          return reply.status(409).send({
            success: false,
            error: {
              code: ERROR_CODES.INVITATION_ALREADY_ACCEPTED,
              message: err.message,
            },
          });
        }
        if (err.code === 'INVITATION_EXPIRED' || err.message?.includes('INVITATION_EXPIRED')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.INVITATION_EXPIRED,
              message: err.message,
            },
          });
        }
        if (err.code === 'INVITATION_CANCELLED' || err.message?.includes('INVITATION_CANCELLED')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVITATION_CANCELLED',
              message: 'This invitation has been cancelled by an organization administrator.',
            },
          });
        }
        if (err.code === 'INVITATION_EMAIL_MISMATCH' || err.message?.includes('INVITATION_EMAIL_MISMATCH')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.INVITATION_EMAIL_MISMATCH,
              message: err.message,
            },
          });
        }
        if (err.code === 'PLAN_MEMBER_LIMIT_REACHED' || err.message?.includes('PLAN_MEMBER_LIMIT_REACHED')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'PLAN_MEMBER_LIMIT_REACHED',
              message: err.message.replace('PLAN_MEMBER_LIMIT_REACHED:', '').trim(),
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/invitations/:token/decline
  fastify.post(
    '/:token/decline',
    {
      schema: {
        tags: ['Invitations'],
        summary: 'Decline an invitation',
        params: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      try {
        await dataService.declineWorkspaceInvitation(token, (request as any).user?.id);
        return reply.send({
          success: true,
          message: 'Invitation declined.',
        });
      } catch (wsErr: any) {
        try {
          await dataService.mutate('teamInvitations:declineTeamInvitation', {
            invitationId: token,
            userId: (request as any).user?.id,
          });
          return reply.send({
            success: true,
            message: 'Invitation declined.',
          });
        } catch (_teamErr) {
          return reply.send({
            success: true,
            message: 'Invitation declined.',
          });
        }
      }
    }
  );

  // POST /api/v1/invitations/:id/resend (Requires auth)
  fastify.post(
    '/:id/resend',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Invitations'],
        summary: 'Resend a pending or expired invitation',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const invitation = await dataService.resendInvitation(id, request.user.id);
        return reply.send({
          success: true,
          data: {
            invitation: {
              id: invitation.id,
              email: invitation.email,
              role: invitation.role,
              status: invitation.status,
              expiresAt: invitation.expiresAt,
            },
          },
          message: `Invitation resent to ${invitation.email}.`,
        });
      } catch (err: any) {
        if (err.code === 'INVITATION_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.INVITATION_NOT_FOUND,
              message: 'Invitation not found.',
            },
          });
        }
        if (err.code === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'You must be an Organization Owner or Admin to resend invitations.',
            },
          });
        }
        if (err.code === 'INVITATION_ALREADY_ACCEPTED') {
          return reply.status(409).send({
            success: false,
            error: {
              code: ERROR_CODES.INVITATION_ALREADY_ACCEPTED,
              message: 'Cannot resend an invitation that has already been accepted.',
            },
          });
        }
        throw err;
      }
    }
  );

  // DELETE /api/v1/invitations/:id (Requires auth)
  fastify.delete(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Invitations'],
        summary: 'Cancel an invitation',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await dataService.cancelInvitation(id, request.user.id);
        return reply.send({
          success: true,
          message: 'Invitation successfully cancelled.',
        });
      } catch (err: any) {
        if (err.code === 'INVITATION_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.INVITATION_NOT_FOUND,
              message: 'Invitation not found.',
            },
          });
        }
        if (err.code === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'You must be an Organization Owner or Admin to cancel invitations.',
            },
          });
        }
        if (err.code === 'INVITATION_ALREADY_ACCEPTED') {
          return reply.status(409).send({
            success: false,
            error: {
              code: ERROR_CODES.INVITATION_ALREADY_ACCEPTED,
              message: 'Cannot cancel an invitation that has already been accepted.',
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/invitations/accept-from-notification
  fastify.post(
    '/accept-from-notification',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Invitations'],
        summary: 'Accept an invitation directly from in-dashboard notification',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['inviteId'],
          properties: {
            inviteId: { type: 'string' },
            inviteType: { type: 'string', enum: ['organization', 'workspace'] },
            notificationId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { inviteId, inviteType, notificationId } = (request.body as {
        inviteId: string;
        inviteType?: 'organization' | 'workspace';
        notificationId?: string;
      }) || {};

      if (!inviteId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'inviteId is required',
          },
        });
      }

      try {
        let result: any;
        if (inviteType === 'workspace') {
          result = await dataService.acceptWorkspaceInviteFromNotification(
            inviteId,
            request.user.id,
            notificationId
          );
        } else {
          result = await dataService.acceptInviteFromNotification(
            inviteId,
            request.user.id,
            notificationId
          );
        }

        return reply.send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: err.code || 'INVITATION_ACCEPT_FAILED',
            message: err.message || 'Failed to accept invitation',
          },
        });
      }
    }
  );

  // POST /api/v1/invitations/decline-from-notification
  fastify.post(
    '/decline-from-notification',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Invitations'],
        summary: 'Decline an invitation directly from in-dashboard notification',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['inviteId'],
          properties: {
            inviteId: { type: 'string' },
            inviteType: { type: 'string', enum: ['organization', 'workspace'] },
            notificationId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { inviteId, inviteType, notificationId } = (request.body as {
        inviteId: string;
        inviteType?: 'organization' | 'workspace';
        notificationId?: string;
      }) || {};

      if (!inviteId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'inviteId is required',
          },
        });
      }

      try {
        let result: any;
        if (inviteType === 'workspace') {
          result = await dataService.declineWorkspaceInviteFromNotification(
            inviteId,
            request.user.id,
            notificationId
          );
        } else {
          result = await dataService.declineInviteFromNotification(
            inviteId,
            request.user.id,
            notificationId
          );
        }

        return reply.send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: err.code || 'INVITATION_DECLINE_FAILED',
            message: err.message || 'Failed to decline invitation',
          },
        });
      }
    }
  );
};

