import { BaseRepository } from './baseRepository.js';

export class ApplicationRepository extends BaseRepository {
  public async getAvailableApplications() {
    try {
      const apps = await this.query('applications:getAvailableApplications', {});
      if (apps && Array.isArray(apps) && apps.length > 0) return apps;
    } catch {}
    return [
      { key: 'inventory', name: 'Inventory', enabled: true },
      { key: 'pos', name: 'POS', enabled: true },
      { key: 'booking', name: 'Booking', enabled: true },
      { key: 'gym', name: 'Gym Management', enabled: true },
    ];
  }

  public async getOrgApplications(organizationId: string) {
    try {
      const apps = await this.query('applications:getOrgApplications', {
        organizationId: organizationId as any,
      });
      if (apps && Array.isArray(apps) && apps.length > 0) return apps;
    } catch {}
    return this.getOrganizationApps(organizationId);
  }

  public async activateApplication(data: {
    organizationId: string;
    applicationKey: string;
    planKey?: string;
    billingCycle?: string;
    paymentReference?: string;
    paymentGateway?: string;
    userId?: string;
  }) {
    try {
      return await this.mutate('applications:activateApplication', data as any);
    } catch (err: any) {
      if (
        err?.message?.includes('Free Trial') ||
        err?.message?.includes('subscription') ||
        err?.message?.includes('available on Free Trial') ||
        err?.message === 'APPLICATION_NOT_ACTIVATED'
      ) {
        throw err;
      }
      return this.mutate('onboarding:activateApplication', data as any);
    }
  }

  public async deactivateApplication(data: {
    organizationId: string;
    applicationKey: string;
    userId?: string;
  }) {
    return await this.mutate('applications:deactivateApplication', data as any);
  }

  public async getOrganizationApps(organizationId: string) {
    try {
      const apps = await this.query('applications:getOrgApplications', {
        organizationId: organizationId as any,
      });
      if (apps && Array.isArray(apps) && apps.length > 0) return apps;
    } catch {}
    return this.query('onboarding:getOrganizationApps', {
      organizationId: organizationId as any,
    });
  }

  public async isApplicationActiveForOrg(organizationId: string, applicationKey?: string) {
    try {
      return await this.query('applications:isApplicationActiveForOrg', {
        organizationId: organizationId as any,
        applicationKey,
      });
    } catch {}
    return { isActive: true, status: 'active', applicationKey };
  }

  public async getApplicationOnboardingResponses(organizationId: string, applicationKey?: string) {
    return this.query('onboarding:getApplicationOnboardingResponses', {
      organizationId: organizationId as any,
      applicationKey,
    });
  }

  public async getOrgApplicationStatus(organizationId: string, applicationKey?: string) {
    return this.query('onboarding:getOrgApplicationStatus', {
      organizationId: organizationId as any,
      applicationKey,
    });
  }

  public async getApplicationAccess(userId: string, productKey?: string) {
    return this.query('workspaces:getApplicationAccess', {
      userId: userId as any,
      productKey,
    });
  }

  public async setApplicationSelection(userId: string, productKey: string) {
    return this.mutate('users:setLastSelectedProduct', {
      userId: userId as any,
      productKey,
    });
  }
}
