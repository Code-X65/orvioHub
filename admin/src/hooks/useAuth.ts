import { useAuthContext } from "../contexts/AuthContext";

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
    isSuperAdmin: admin?.role === "super_admin",
  };
};

export default useAuth;
