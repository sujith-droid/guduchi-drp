import { useCallback, useEffect, useState } from "react";
import { getBrowserPushState } from "@/lib/push-permission";

export default function useBrowserPushState() {
  const [state, setState] = useState(getBrowserPushState);
  const refresh = useCallback(() => setState(getBrowserPushState()), []);

  useEffect(() => {
    // Browser/site settings are usually changed outside this tab.
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refresh]);

  return { state, refresh };
}