import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      // Mobile-OTP sessions are stored as an opaque token in localStorage
      // and validated server-side via the adminMe backend function (no Base44
      // email/password session is involved). Resolve that first, before the
      // normal Base44 auth path.
      const adminToken = localStorage.getItem("admin_session_token");
      if (adminToken) {
        // Optimistically restore the cached user so the UI renders instantly
        // (no network round-trip blocking the first paint). The session is
        // validated server-side in the background below; if it's invalid we
        // log out.
        let cachedUser = null;
        try { cachedUser = JSON.parse(localStorage.getItem("cached_user")); } catch {}

        if (cachedUser) {
          base44.auth.setToken(adminToken);
          setUser(cachedUser);
          setIsAuthenticated(true);
          setAuthError(null);
          setIsLoadingAuth(false);
          setIsLoadingPublicSettings(false);
        }

        // Validate the session server-side in the background.
        try {
          base44.auth.setToken(adminToken);
          const res = await base44.functions.invoke("adminMe", { adminToken });
          const responseData = res?.data || res;
          if (responseData?.user) {
            setUser(responseData.user);
            localStorage.setItem("cached_user", JSON.stringify(responseData.user));
            return;
          }
        } catch (e) {
          // invalid/expired OTP session — clear everything and redirect to login
          localStorage.removeItem("admin_session_token");
          localStorage.removeItem("cached_user");
          setUser(null);
          setIsAuthenticated(false);
          setAuthError({ type: 'auth_required', message: 'Session expired' });
          setIsLoadingAuth(false);
          setIsLoadingPublicSettings(false);
          return;
        }
      }

      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token, // Include token if available
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    // 1. Clear the client-side token immediately (synchronous) so the next load
    //    has no token even if the server call is slow/skipped.
    const adminToken = localStorage.getItem("admin_session_token");
    try {
      localStorage.removeItem("admin_session_token");
      localStorage.removeItem("base44_access_token");
      localStorage.removeItem("token");
      localStorage.removeItem("cached_user");
    } catch (e) {}
    // Best-effort: invalidate the OTP session server-side.
    if (adminToken) {
      try { await base44.functions.invoke("adminAction", { adminToken, action: "logout" }); } catch (e) {}
    }
    // 2. Clear the HTTP-only session cookie via the platform endpoint — awaited so
    //    the cookie is actually gone before we reload (otherwise the platform
    //    re-issues the session on the next load).
    try {
      const base = appParams.appBaseUrl || "";
      await fetch(`${base}/api/apps/auth/logout?from_url=${encodeURIComponent(window.location.origin + "/login")}`, { credentials: "include" });
    } catch (e) {}
    // 3. Hard-reload to /login — resets all in-memory state (appParams, axios).
    window.location.replace("/login");
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

  const loginWithToken = (token, userObj) => {
    if (token) base44.auth.setToken(token);
    if (userObj) {
      setUser(userObj);
      setIsAuthenticated(true);
      setAuthError(null);
    }
  };

  // Used by the mobile-OTP login flow: stores the opaque AdminSession
  // token in localStorage and also sets it on the Base44 client so that
  // base44.functions.invoke can reach the backend (endpoints validate the
  // token from the request body, not the Authorization header, so the value
  // being the AdminSession UUID rather than a real session token is fine).
  const loginAdminSession = (token, userObj) => {
    if (token) {
      localStorage.setItem("admin_session_token", token);
      base44.auth.setToken(token);
    }
    if (userObj) {
      localStorage.setItem("cached_user", JSON.stringify(userObj));
      setUser(userObj);
      setIsAuthenticated(true);
      setAuthError(null);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
      loginWithToken,
      loginAdminSession
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};