import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCurrentUser, loginUser, signupUser, logoutUser } from '../services/api';

const AuthContext = createContext(null);

const TOKEN_STORAGE_KEY = 'jandrishti_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TOKEN_STORAGE_KEY) || null;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and verify authentication state on mount
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const userData = await getCurrentUser();
        if (isMounted) {
          setUser(userData);
        }
      } catch (error) {
        // Token is invalid or expired: gracefully clear it
        console.info('[JanDrishti Auth] Token expired or invalid, proceeding in guest mode.');
        if (typeof window !== 'undefined') {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await loginUser({ email, password });
    if (data.access_token) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
      }
      setToken(data.access_token);
      setUser(data.user);
    }
    return data.user;
  }, []);

  const signup = useCallback(async (name, email, password) => {
    const data = await signupUser({ name, email, password });
    if (data.access_token) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
      }
      setToken(data.access_token);
      setUser(data.user);
    }
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      setToken(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const freshUser = await getCurrentUser();
      setUser(freshUser);
      return freshUser;
    } catch (e) {
      return null;
    }
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    signup,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
