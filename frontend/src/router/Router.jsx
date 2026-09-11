import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const RouterContext = createContext(null);

/**
 * Normalizes pathname to ensure leading slash and no trailing slash (except root)
 */
function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

export function RouterProvider({ children }) {
  const [currentUrl, setCurrentUrl] = useState(() => {
    if (typeof window === 'undefined') return { path: '/', search: '' };
    return {
      path: normalizePath(window.location.pathname),
      search: window.location.search,
    };
  });

  const handlePopState = useCallback(() => {
    setCurrentUrl({
      path: normalizePath(window.location.pathname),
      search: window.location.search,
    });
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handlePopState]);

  const navigate = useCallback((to, options = {}) => {
    if (!to) return;
    const [pathPart, searchPart] = to.split('?');
    const newPath = normalizePath(pathPart);
    const newSearch = searchPart ? `?${searchPart}` : '';
    const targetUrl = newPath + newSearch;

    if (options.replace) {
      window.history.replaceState(options.state || null, '', targetUrl);
    } else {
      window.history.pushState(options.state || null, '', targetUrl);
    }

    setCurrentUrl({ path: newPath, search: newSearch });
    if (!options.keepScroll) {
      window.scrollTo(0, 0);
    }
  }, []);

  const searchParams = useMemo(() => {
    return new URLSearchParams(currentUrl.search);
  }, [currentUrl.search]);

  const contextValue = useMemo(() => ({
    path: currentUrl.path,
    search: currentUrl.search,
    searchParams,
    navigate,
  }), [currentUrl.path, currentUrl.search, searchParams, navigate]);

  return (
    <RouterContext.Provider value={contextValue}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
}

export function useNavigate() {
  const { navigate } = useRouter();
  return navigate;
}

export function useLocation() {
  const { path, search, searchParams } = useRouter();
  return { pathname: path, search, searchParams };
}

export function useSearchParams() {
  const { searchParams, navigate, path } = useRouter();
  
  const setSearchParams = useCallback((newParams, options = {}) => {
    const nextSearch = new URLSearchParams(newParams).toString();
    navigate(`${path}${nextSearch ? `?${nextSearch}` : ''}`, options);
  }, [navigate, path]);

  return [searchParams, setSearchParams];
}

/**
 * Link component supporting regular navigation, ctrl/cmd click (new tab), and active styles
 */
export function Link({ to, children, className = '', activeClassName = '', exact = false, ...props }) {
  const { path, navigate } = useRouter();
  const targetPath = normalizePath(to.split('?')[0]);
  
  const isActive = exact ? path === targetPath : (targetPath === '/' ? path === '/' : path.startsWith(targetPath));

  const handleClick = (e) => {
    if (props.onClick) props.onClick(e);
    if (e.defaultPrevented) return;
    
    // Allow opening in new tab for cmd/ctrl/middle click
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

    e.preventDefault();
    navigate(to);
  };

  const combinedClass = `${className} ${isActive ? activeClassName : ''}`.trim();

  return (
    <a href={to} onClick={handleClick} className={combinedClass} {...props}>
      {children}
    </a>
  );
}
