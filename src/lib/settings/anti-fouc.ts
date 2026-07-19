import { DEFAULT_PREFS, PREFS_STORAGE_KEY } from "@/lib/settings/types";
import { APP_ROUTE_PREFIXES } from "@/lib/settings/theme-route";

function buildAppRouteRegex(): string {
  const escaped = APP_ROUTE_PREFIXES.map((p) =>
    p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|");
  return `^(?:${escaped})(?:/|$)`;
}

export const APP_ROUTE_REGEX_SOURCE = buildAppRouteRegex();

export const ANTI_FOUC_SCRIPT = `(function(){try{var key="${PREFS_STORAGE_KEY}";var fallback=${JSON.stringify(
  DEFAULT_PREFS,
)};var appRouteRegex=new RegExp(${JSON.stringify(APP_ROUTE_REGEX_SOURCE)});var pathname=window.location.pathname;var isAppRoute=appRouteRegex.test(pathname);function readCookie(){var cookie=document.cookie.split(";");for(var i=0;i<cookie.length;i++){var entry=cookie[i].trim();if(entry.indexOf(key+"=")===0){return JSON.parse(decodeURIComponent(entry.slice(key.length+1)));}}return null;}var raw=readCookie()||JSON.parse(window.localStorage.getItem(key)||"null");var valid=raw&&(raw.language==="ro"||raw.language==="en")&&(raw.currency==="RON"||raw.currency==="EUR")&&(raw.theme==="dark"||raw.theme==="light");var prefs=valid?raw:fallback;var effectiveTheme=isAppRoute?prefs.theme:"dark";var root=document.documentElement;root.classList.toggle("dark",effectiveTheme==="dark");root.classList.toggle("light",effectiveTheme==="light");root.style.colorScheme=effectiveTheme;root.lang=prefs.language;}catch(e){}})();`;
