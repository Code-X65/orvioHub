import { BaseRepository } from './baseRepository.js';

export class WorkspaceBranchRepository extends BaseRepository {
  public async listBranches(params: { organizationId?: string; applicationId?: string; workspaceId?: string }) {
    return this.query('branches:listBranches', params as any);
  }

  public async getBranchesForOrgApp(organizationId: string, applicationId?: string, applicationKey?: string) {
    return this.query('branches:getBranchesForOrgApp', {
      organizationId: organizationId as any,
      applicationId: applicationId as any,
      applicationKey,
    });
  }

  public async autoCreateMainBranch(data: {
    organizationId: string;
    applicationId?: string;
    userId?: string;
    name?: string;
    address?: string;
    phone?: string;
  }) {
    return this.mutate('branches:autoCreateMainBranch', data as any);
  }

  public async getCurrentOrgAppContext(params: {
    organizationId: string;
    applicationKey?: string;
    branchId?: string;
    userId?: string;
  }) {
    return this.query('onboarding:getCurrentOrgAppContext', params as any);
  }

  public async createBranch(data: {
    workspaceId?: string;
    organizationId?: string;
    applicationId?: string;
    name: string;
    code?: string;
    isPrimary?: boolean;
    isActive?: boolean;
    country?: string;
    state?: string;
    stateCode?: string;
    lga?: string;
    city?: string;
    street?: string;
    blockNumber?: string;
    area?: string;
    landmark?: string;
    postalCode?: string;
    address?: string;
    formattedAddress?: string;
    phone?: string;
    phoneNormalized?: string;
    email?: string;
    managerId?: string;
    callerUserId?: string;
  }) {
    return this.mutate('branches:createBranch', {
      workspaceId: data.workspaceId as any,
      organizationId: data.organizationId as any,
      applicationId: data.applicationId as any,
      name: data.name,
      code: data.code,
      isPrimary: data.isPrimary,
      isActive: data.isActive,
      country: data.country,
      state: data.state,
      stateCode: data.stateCode,
      lga: data.lga,
      city: data.city,
      street: data.street,
      blockNumber: data.blockNumber,
      area: data.area,
      landmark: data.landmark,
      postalCode: data.postalCode,
      address: data.address,
      formattedAddress: data.formattedAddress,
      phone: data.phone,
      phoneNormalized: data.phoneNormalized,
      email: data.email,
      managerId: data.managerId as any,
      callerUserId: data.callerUserId as any,
    });
  }

  public async updateBranch(
    branchId: string,
    updates: {
      name?: string;
      code?: string;
      isPrimary?: boolean;
      isActive?: boolean;
      country?: string;
      state?: string;
      stateCode?: string;
      lga?: string;
      city?: string;
      street?: string;
      blockNumber?: string;
      area?: string;
      landmark?: string;
      postalCode?: string;
      address?: string;
      formattedAddress?: string;
      phone?: string;
      phoneNormalized?: string;
      email?: string;
      managerId?: string;
      status?: string;
      productKey?: string;
      deletedAt?: number;
      callerUserId?: string;
    }
  ) {
    return this.mutate('branches:updateBranch', {
      branchId: branchId as any,
      ...updates,
      managerId: updates.managerId as any,
      callerUserId: updates.callerUserId as any,
    });
  }

  public async createBranchForApplication(args: {
    organizationId: string;
    applicationId?: string;
    applicationKey?: string;
    name: string;
    code?: string;
    isPrimary?: boolean;
    country?: string;
    state?: string;
    city?: string;
    street?: string;
    area?: string;
    address?: string;
    phone?: string;
    email?: string;
    callerUserId?: string;
    userId?: string;
  }) {
    try {
      return await this.mutate('branches:createBranchForApplication', {
        organizationId: args.organizationId as any,
        applicationId: args.applicationId as any,
        applicationKey: args.applicationKey,
        name: args.name,
        code: args.code,
        isPrimary: args.isPrimary,
        address: args.address,
        phone: args.phone,
        callerUserId: (args.callerUserId || args.userId) as any,
        userId: (args.userId || args.callerUserId) as any,
      });
    } catch (err: any) {
      if (
        err?.message?.includes('Free Trial') ||
        err?.message?.includes('subscription') ||
        err?.message === 'APPLICATION_NOT_ACTIVATED'
      ) {
        throw err;
      }
      return await this.mutate('branches:createBranch', {
        organizationId: args.organizationId as any,
        applicationId: args.applicationId as any,
        name: args.name,
        code: args.code,
        isPrimary: args.isPrimary,
        country: args.country,
        state: args.state,
        city: args.city,
        street: args.street,
        area: args.area,
        address: args.address,
        phone: args.phone,
        email: args.email,
        callerUserId: (args.callerUserId || args.userId) as any,
      });
    }
  }

  public async getBranchesForApplication(organizationId: string, applicationId?: string, applicationKey?: string): Promise<any[]> {
    try {
      const result = await this.query('branches:getBranchesForApplication', {
        organizationId: organizationId as any,
        applicationId: applicationId as any,
        applicationKey,
      });
      return (result as any[]) || [];
    } catch {
      return this.listBranches({ organizationId, applicationId });
    }
  }

  public async deactivateBranch(branchId: string, userId?: string) {
    try {
      return await this.mutate('branches:deactivateBranch', {
        branchId: branchId as any,
        callerUserId: userId as any,
        userId: userId as any,
      });
    } catch (err: any) {
      return await this.updateBranch(branchId, {
        status: 'inactive',
        isActive: false,
        callerUserId: userId,
      });
    }
  }

  public async listBranchesForOrg(args: {
    organizationId: string;
    applicationId?: string;
  }): Promise<any[]> {
    try {
      const result = await this.query('branches:listBranches', {
        organizationId: args.organizationId as any,
        applicationId: args.applicationId as any,
      });
      return (result as any[]) || [];
    } catch (err) {
      console.warn('[WorkspaceBranchRepository] listBranchesForOrg failed:', err);
      return [];
    }
  }
}
