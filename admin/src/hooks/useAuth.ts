import { useAuthContext } from "../contexts/AuthContext";
import { canAdmin } from "../auth/permissions";

export const useAuth = () => {
  const { admin, sessionToken, isAuthenticated, isLoading, login, logout, refreshSession } =
    useAuthContext();

  return {
    admin,
    sessionToken,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshSession,
    isSuperAdmin: canAdmin(admin?.role, "admin.dashboard.view"),
  };
};

export default useAuth;
