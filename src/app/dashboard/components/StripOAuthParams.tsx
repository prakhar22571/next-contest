"use client";

import { useEffect } from "react";

// After Google sign-in, Netlify's proxy appends the spent OAuth callback params
// (?code=…&scope=…&iss=…) to the redirect that lands on /dashboard. The code is
// already consumed and unused here, so wipe the query string from the URL bar.
export function StripOAuthParams() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") || params.has("iss") || params.has("scope") || params.has("state")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return null;
}
