// Never expose provider response text: it may contain request details or credentials.
export function geminiError(status: number, body: unknown): string {
  const message = typeof body === "object" && body !== null && "error" in body
    ? JSON.stringify(body.error).toLowerCase() : "";
  if (message.includes("api_key_invalid") || message.includes("api key not valid") || status === 401)
    return "Gemini rejected the API key. Check GEMINI_API_KEY in Vercel and redeploy. (401/invalid key)";
  if (status === 403)
    return "Gemini denied access. Check the API key’s restrictions and Gemini API permissions in Google AI Studio. (403)";
  if (status === 404)
    return "The configured Gemini model is unavailable. Set GEMINI_MODEL in Vercel to a model available to your Google AI Studio project, then redeploy. (404)";
  if (status === 402 || message.includes("billing") || message.includes("free tier is not available"))
    return "Gemini requires an account or billing setup change. Check your project in Google AI Studio. No billing changes have been made by this app.";
  if (status === 429)
    return "Gemini’s quota or rate limit has been reached. Check your Google AI Studio quota or try again later. (429)";
  if (status === 400)
    return "Gemini rejected the request configuration. Check the model and API key configuration in Vercel. (400)";
  if (status >= 500)
    return "Gemini is temporarily unavailable. Please try again later. (Provider server error)";
  return `Gemini could not generate a caption (HTTP ${status}). Check the deployment’s runtime logs.`;
}
