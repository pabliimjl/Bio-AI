const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...CORS_HEADERS,
          "Access-Control-Allow-Origin": resolveAllowedOrigin(origin, env.ALLOWED_ORIGIN),
        },
      });
    }

    try {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/health") {
        return jsonResponse({ ok: true, service: "bio-ai-proxy" }, 200, origin, env.ALLOWED_ORIGIN);
      }

      if (request.method === "POST" && url.pathname === "/api/ocr") {
        return await handleOcrRequest(request, env, origin);
      }

      if (request.method === "POST" && url.pathname === "/api/llm") {
        return await handleLlmRequest(request, env, origin);
      }

      return jsonResponse({ error: "Ruta no encontrada" }, 404, origin, env.ALLOWED_ORIGIN);
    } catch (error) {
      return jsonResponse({ error: normalizeError(error) }, 500, origin, env.ALLOWED_ORIGIN);
    }
  },
};

async function handleOcrRequest(request, env, origin) {
  if (!env.OCR_SPACE_API_KEY) {
    return jsonResponse({ error: "Falta OCR_SPACE_API_KEY en el Worker." }, 500, origin, env.ALLOWED_ORIGIN);
  }

  const incomingForm = await request.formData();
  const file = incomingForm.get("file");

  if (!(file instanceof File)) {
    return jsonResponse({ error: "Debes enviar un archivo en el campo 'file'." }, 400, origin, env.ALLOWED_ORIGIN);
  }

  const ocrForm = new FormData();
  ocrForm.set("file", file, file.name || "upload.png");
  ocrForm.set("language", String(incomingForm.get("language") || "spa"));
  ocrForm.set("isOverlayRequired", String(incomingForm.get("isOverlayRequired") || "false"));
  ocrForm.set("OCREngine", String(incomingForm.get("OCREngine") || "2"));
  ocrForm.set("scale", String(incomingForm.get("scale") || "true"));
  ocrForm.set("isTable", String(incomingForm.get("isTable") || "true"));

  const response = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: {
      apikey: env.OCR_SPACE_API_KEY,
    },
    body: ocrForm,
  });

  const rawText = await response.text();
  if (!response.ok) {
    return jsonResponse({ error: `OCR.space devolvio ${response.status}`, details: rawText }, response.status, origin, env.ALLOWED_ORIGIN);
  }

  return new Response(rawText, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin, env.ALLOWED_ORIGIN),
    },
  });
}

async function handleLlmRequest(request, env, origin) {
  if (!env.LLM_API_KEY) {
    return jsonResponse({ error: "Falta LLM_API_KEY en el Worker." }, 500, origin, env.ALLOWED_ORIGIN);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "JSON invalido en /api/llm." }, 400, origin, env.ALLOWED_ORIGIN);
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length) {
    return jsonResponse({ error: "El campo 'messages' es obligatorio." }, 400, origin, env.ALLOWED_ORIGIN);
  }

  const provider = (env.LLM_PROVIDER || "groq").toLowerCase();
  const endpoint = resolveLlmEndpoint(provider, env.LLM_ENDPOINT);
  const model = String(body?.model || env.LLM_MODEL || defaultModelForProvider(provider));
  const temperature = Number.isFinite(body?.temperature) ? body.temperature : Number(env.LLM_TEMPERATURE || 0.2);
  const maxTokens = Number.isFinite(body?.max_tokens) ? body.max_tokens : Number(env.LLM_MAX_TOKENS || 280);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages,
    }),
  });

  const rawText = await response.text();
  if (!response.ok) {
    return jsonResponse({ error: `El endpoint LLM devolvio ${response.status}`, details: rawText }, response.status, origin, env.ALLOWED_ORIGIN);
  }

  return new Response(rawText, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin, env.ALLOWED_ORIGIN),
    },
  });
}

function resolveLlmEndpoint(provider, customEndpoint) {
  if (customEndpoint && customEndpoint.trim()) {
    return customEndpoint.trim();
  }

  if (provider === "openrouter") {
    return "https://openrouter.ai/api/v1/chat/completions";
  }

  return "https://api.groq.com/openai/v1/chat/completions";
}

function defaultModelForProvider(provider) {
  if (provider === "openrouter") {
    return "meta-llama/llama-3.3-70b-instruct";
  }

  return "llama-3.3-70b-versatile";
}

function jsonResponse(payload, status, origin, allowedOrigin) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin, allowedOrigin),
    },
  });
}

function corsHeaders(requestOrigin, allowedOriginSetting) {
  return {
    ...CORS_HEADERS,
    "Access-Control-Allow-Origin": resolveAllowedOrigin(requestOrigin, allowedOriginSetting),
  };
}

function resolveAllowedOrigin(requestOrigin, allowedOriginSetting) {
  const allowAny = !allowedOriginSetting || allowedOriginSetting === "*";
  if (allowAny) {
    return "*";
  }

  return requestOrigin === allowedOriginSetting ? requestOrigin : allowedOriginSetting;
}

function normalizeError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Error no controlado en el Worker.";
}
