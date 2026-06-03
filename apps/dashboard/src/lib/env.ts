import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().url("VITE_API_URL must be a valid URL (e.g. http://localhost:8000)"),
  VITE_WS_URL: z.string().url("VITE_WS_URL must be a valid WebSocket URL").optional(),
  VITE_SENTRY_DSN: z.string().optional(),
});

export let VITE_API_URL: string;
export let VITE_WS_URL: string;
export let VITE_SENTRY_DSN: string | undefined;

try {
  const parsed = envSchema.parse({
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_WS_URL: import.meta.env.VITE_WS_URL,
    VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  });

  VITE_API_URL = parsed.VITE_API_URL;
  VITE_WS_URL = parsed.VITE_WS_URL || parsed.VITE_API_URL.replace(/^http/, 'ws');
  VITE_SENTRY_DSN = parsed.VITE_SENTRY_DSN;
} catch (error) {
  if (error instanceof z.ZodError) {
    const errorDetails = error.issues.map((err: any) => `❌ ${err.path.join('.')}: ${err.message}`).join('\n');
    console.error("Environment validation failed:\n", errorDetails);

    if (typeof document !== 'undefined') {
      // Hijack the DOM to render a premium diagnostics overlay immediately
      const bootErrorDiv = document.createElement('div');
      bootErrorDiv.id = 'signverse-env-error';
      bootErrorDiv.setAttribute('style', `
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background-color: #07080a;
        color: #ff3366;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        padding: 24px;
        text-align: center;
      `);

      bootErrorDiv.innerHTML = `
        <div style="
          background: rgba(15, 17, 24, 0.85);
          border: 1px solid rgba(255, 51, 102, 0.25);
          box-shadow: 0 0 40px rgba(255, 51, 102, 0.15);
          border-radius: 16px;
          padding: 40px;
          max-width: 640px;
          width: 100%;
          text-align: left;
        ">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; color: #ff3366;">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <h1 style="font-size: 14px; font-weight: 800; tracking-widest: 0.1em; text-transform: uppercase; margin: 0; letter-spacing: 1px;">
              SignVerse Boot Configuration Exception
            </h1>
          </div>
          <p style="color: #94a3b8; font-size: 11px; margin-bottom: 24px; line-height: 1.6;">
            The console failed to bootstrap because critical local environment parameters are missing or failed type validation. Update your environment and rebuild.
          </p>
          <pre style="
            background: rgba(255, 51, 102, 0.05);
            border: 1px solid rgba(255, 51, 102, 0.15);
            padding: 16px;
            border-radius: 8px;
            font-size: 10px;
            color: #f8fafc;
            white-space: pre-wrap;
            margin: 0;
            line-height: 1.7;
          ">${errorDetails}</pre>
          <div style="margin-top: 24px; border-t: 1px solid rgba(255,255,255,0.05); padding-top: 20px; font-size: 9px; color: #64748b; line-height: 1.5;">
            💡 <strong>Resolution:</strong> Define <code style="color: #00f0ff; background: rgba(0,240,255,0.1); padding: 2px 4px; border-radius: 4px;">VITE_API_URL</code> inside <code style="font-weight: bold;">.env</code> or supply it during compose up builds.
          </div>
        </div>
      `;
      
      // Inject to block react render
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(bootErrorDiv);
      });
      // Try to append immediately if body is already loaded
      if (document.body) {
        document.body.appendChild(bootErrorDiv);
      }
    }
    throw new Error("Local environment variables validation failed.");
  } else {
    throw error;
  }
}
