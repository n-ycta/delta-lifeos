// Test-only host. Credentials never enter the child frame or browser bundle.
import { pluginChannel } from "../../delta-ui/src/sdk/channel";
import { SKINS, type SkinId } from "../../delta-ui/src/theme/skins";
import { capabilities } from "../server/contract.mjs";
const q = new URLSearchParams(location.search),
  skin = SKINS[(q.get("skin") || "latte") as SkinId],
  plugin = q.get("plugin")!,
  lang = q.get("lang") === "en" ? "en" : "ru";
const parts = q.get("multi") ? ["today", "journal"] : [q.get("surface") || ""];
for (const surface of parts) {
  const iframe = document.createElement("iframe");
  iframe.title = "Vector " + surface;
  iframe.style.cssText = `display:block;border:0;width:100%;height:${parts.length > 1 ? "700px" : "100vh"}`;
  const url = new URL(plugin);
  url.searchParams.set("parentOrigin", location.origin);
  url.searchParams.set("lang", lang);
  if (surface) url.searchParams.set("surface", surface);
  iframe.src = url.href;
  document.body.append(iframe);
  const broker = pluginChannel({
    source: iframe.contentWindow!,
    origin: url.origin,
    grants: new Set(capabilities),
    call: async (request) => {
      const r = await fetch("/test-api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const v = await r.json();
      if (!r.ok)
        throw Object.assign(Error(v.error || "operation_failed"), {
          code: v.error,
        });
      return v.result;
    },
  });
  window.addEventListener("message", (ev) => {
    if (
      ev.source === iframe.contentWindow &&
      ev.origin === url.origin &&
      ev.data?.type === "delta:ready"
    )
      iframe.contentWindow!.postMessage(
        {
          type: "delta:initialize",
          channel: broker.channel,
          context: {
            appId: "dev.delta.vector",
            surface: surface || undefined,
            language: lang,
            theme: skin.scheme,
            tokens: {
              skin: skin.id,
              scheme: skin.scheme,
              family: skin.family,
              fonts: skin.fonts,
              fontKeys: skin.fontKeys,
              colors: skin.palette,
              series: skin.series,
              radius: {
                sm: skin.geometry.rSm,
                md: skin.geometry.rMd,
                lg: skin.geometry.rLg,
              },
              border: skin.geometry.border,
              density: "comfortable",
              type: skin.type,
            },
          },
        },
        url.origin,
      );
  });
}
