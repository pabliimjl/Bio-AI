import { getAppUrl, isSupabaseConfigured, supabase } from "./supabase-config.js";

const elements = {
  googleLoginButton: document.querySelector("#googleLoginButton"),
  authMessage: document.querySelector("#authMessage"),
};

bootstrap();

async function bootstrap() {
  if (!isSupabaseConfigured() || !supabase) {
    setMessage("Configura SUPABASE_URL y SUPABASE_ANON_KEY en supabase-config.js para activar el login.", true);
    elements.googleLoginButton.disabled = true;
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setMessage(error.message, true);
    return;
  }

  if (data.session) {
    window.location.replace(getAppUrl("index.html"));
    return;
  }

  setMessage("Usa tu cuenta de Google para entrar o registrarte.");
  elements.googleLoginButton.addEventListener("click", handleGoogleLogin);
}

async function handleGoogleLogin() {
  setMessage("Redirigiendo a Google...");
  elements.googleLoginButton.disabled = true;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAppUrl("index.html"),
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error) {
    setMessage(error.message, true);
    elements.googleLoginButton.disabled = false;
  }
}

function setMessage(text, isError = false) {
  elements.authMessage.textContent = text;
  elements.authMessage.classList.toggle("is-error", isError);
}
