import { getAppUrl, isSupabaseConfigured, supabase } from "./supabase-config.js";
import { FRONTEND_CONFIG } from "./app-config.js";

const APP_CONFIG = {
  proxyBaseUrl: FRONTEND_CONFIG.proxyBaseUrl,
  llmModel: "llama-3.3-70b-versatile",
  llmTemperature: 0.2,
  llmMaxTokens: 280,
};

const OCR_PDF_PAGE_LIMIT = 3;
let pdfLibPromise;
let pdfJsPromise;

const state = {
  selectedFile: null,
  previewUrl: "",
  reportContext: "",
  isPinned: false,
  conversation: [],
  displayMessages: [],
  currentConversationId: null,
  busy: false,
};

const THEME_STORAGE_KEY = "appbq-theme";

const elements = {
  cameraInput: document.querySelector("#cameraInput"),
  imageInput: document.querySelector("#imageInput"),
  fileInput: document.querySelector("#fileInput"),
  mediaPickerButton: document.querySelector("#mediaPickerButton"),
  messages: document.querySelector("#messages"),
  appStatus: document.querySelector("#appStatus"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  sendButton: document.querySelector("#sendButton"),
  themeToggle: document.querySelector("#themeToggle"),
  sidebar: document.querySelector("#sidebar"),
  sidebarToggle: document.querySelector("#sidebarToggle"),
  sidebarOverlay: document.querySelector("#sidebarOverlay"),
  historyList: document.querySelector("#historyList"),
  newChatButton: document.querySelector("#newChatButton"),
  signOutButton: document.querySelector("#signOutButton"),
  userAvatar: document.querySelector("#userAvatar"),
  userName: document.querySelector("#userName"),
  confirmModal: document.querySelector("#confirmModal"),
  confirmModalBackdrop: document.querySelector("#confirmModalBackdrop"),
  confirmModalText: document.querySelector("#confirmModalText"),
  confirmModalCancel: document.querySelector("#confirmModalCancel"),
  confirmModalConfirm: document.querySelector("#confirmModalConfirm"),
  renameModal: document.querySelector("#renameModal"),
  renameModalBackdrop: document.querySelector("#renameModalBackdrop"),
  renameModalInput: document.querySelector("#renameModalInput"),
  renameModalCancel: document.querySelector("#renameModalCancel"),
  renameModalConfirm: document.querySelector("#renameModalConfirm"),
  mediaPickerModal: document.querySelector("#mediaPickerModal"),
  mediaPickerBackdrop: document.querySelector("#mediaPickerBackdrop"),
  mediaPickerCamera: document.querySelector("#mediaPickerCamera"),
  mediaPickerPhotos: document.querySelector("#mediaPickerPhotos"),
  mediaPickerFile: document.querySelector("#mediaPickerFile"),
  mediaPickerCancel: document.querySelector("#mediaPickerCancel"),
  pdfPasswordModal: document.querySelector("#pdfPasswordModal"),
  pdfPasswordBackdrop: document.querySelector("#pdfPasswordBackdrop"),
  pdfPasswordInput: document.querySelector("#pdfPasswordInput"),
  pdfPasswordCancel: document.querySelector("#pdfPasswordCancel"),
  pdfPasswordConfirm: document.querySelector("#pdfPasswordConfirm"),
};

bootstrap();

async function bootstrap() {
  initThemeToggle();

  const hasSession = await requireAuthenticatedSession();
  if (!hasSession) {
    return;
  }

  await initSidebar();
  startNewChat();

  if (!configIsReady()) {
    renderMessage("system", "Configura APP_CONFIG.proxyBaseUrl en script.js con la URL de tu backend proxy antes de usar OCR o el modelo.");
  }

  elements.cameraInput?.addEventListener("change", handleImageSelection);
  elements.imageInput?.addEventListener("change", handleImageSelection);
  elements.fileInput?.addEventListener("change", handleImageSelection);
  elements.cameraInput?.addEventListener("click", resetImageInputValue);
  elements.imageInput?.addEventListener("click", resetImageInputValue);
  elements.fileInput?.addEventListener("click", resetImageInputValue);
  elements.mediaPickerButton?.addEventListener("click", handleMediaPickerButtonClick);
  elements.mediaPickerBackdrop?.addEventListener("click", closeMediaPickerModal);
  elements.mediaPickerCancel?.addEventListener("click", closeMediaPickerModal);
  elements.mediaPickerCamera?.addEventListener("click", () => openFileSource(elements.cameraInput));
  elements.mediaPickerPhotos?.addEventListener("click", () => openFileSource(elements.imageInput));
  elements.mediaPickerFile?.addEventListener("click", () => openFileSource(elements.fileInput));
  elements.chatForm.addEventListener("submit", handleFollowUp);
  elements.chatInput.addEventListener("keydown", handleChatInputKeydown);
}

function resetImageInputValue() {
  const inputElement = this instanceof HTMLInputElement ? this : null;
  if (!inputElement) {
    return;
  }

  // Permite que el evento change se dispare siempre, incluso si se repite archivo.
  inputElement.value = "";
}

function handleMediaPickerButtonClick(event) {
  event.preventDefault();

  if (!elements.mediaPickerModal) {
    openDefaultImageSource();
    return;
  }

  if (!shouldUseMobileMediaPicker()) {
    openDefaultImageSource();
    return;
  }

  openMediaPickerModal();
}

function shouldUseMobileMediaPicker() {
  return Boolean(window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches || navigator.maxTouchPoints > 0);
}

function openMediaPickerModal() {
  if (!elements.mediaPickerModal) {
    openDefaultImageSource();
    return;
  }

  elements.mediaPickerModal.classList.add("is-open");
  elements.mediaPickerModal.setAttribute("aria-hidden", "false");
  document.addEventListener("keydown", handleMediaPickerKeydown);
}

function closeMediaPickerModal() {
  if (!elements.mediaPickerModal) {
    return;
  }

  elements.mediaPickerModal.classList.remove("is-open");
  elements.mediaPickerModal.setAttribute("aria-hidden", "true");
  document.removeEventListener("keydown", handleMediaPickerKeydown);
}

function promptPdfPassword() {
  return new Promise((resolve) => {
    if (!elements.pdfPasswordModal || !elements.pdfPasswordInput || !elements.pdfPasswordCancel || !elements.pdfPasswordConfirm) {
      const password = window.prompt("Este PDF está protegido con contraseña. Ingresa la contraseña:");
      resolve(password);
      return;
    }

    elements.pdfPasswordInput.value = "";
    elements.pdfPasswordModal.classList.add("is-open");
    elements.pdfPasswordModal.setAttribute("aria-hidden", "false");
    elements.pdfPasswordInput.focus();

    const cleanup = () => {
      elements.pdfPasswordModal.classList.remove("is-open");
      elements.pdfPasswordModal.setAttribute("aria-hidden", "true");
      elements.pdfPasswordInput.value = "";
      elements.pdfPasswordCancel.removeEventListener("click", onCancel);
      elements.pdfPasswordConfirm.removeEventListener("click", onConfirm);
      elements.pdfPasswordBackdrop?.removeEventListener("click", onCancel);
      elements.pdfPasswordInput?.removeEventListener("keydown", onKeydown);
      document.removeEventListener("keydown", onEscape);
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    const onConfirm = () => {
      const password = elements.pdfPasswordInput.value;
      cleanup();
      resolve(password || "");
    };

    const onKeydown = (event) => {
      if (event.key === "Enter") {
        onConfirm();
      }
    };

    const onEscape = (event) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    elements.pdfPasswordCancel.addEventListener("click", onCancel);
    elements.pdfPasswordConfirm.addEventListener("click", onConfirm);
    elements.pdfPasswordBackdrop?.addEventListener("click", onCancel);
    elements.pdfPasswordInput?.addEventListener("keydown", onKeydown);
    document.addEventListener("keydown", onEscape);
  });
}

function handleMediaPickerKeydown(event) {
  if (event.key === "Escape") {
    closeMediaPickerModal();
  }
}

function openFileSource(inputElement) {
  if (!(inputElement instanceof HTMLInputElement)) {
    return;
  }

  closeMediaPickerModal();
  inputElement.value = "";
  inputElement.click();
}

function openDefaultImageSource() {
  openFileSource(elements.imageInput || elements.cameraInput || elements.fileInput);
}

function handleChatInputKeydown(event) {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
    return;
  }

  event.preventDefault();
  elements.chatForm.requestSubmit();
}

async function requireAuthenticatedSession() {
  if (!isSupabaseConfigured() || !supabase) {
    return true;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    addMessage("system", `No pude validar la sesion: ${error.message}`);
    return false;
  }

  if (data.session) {
    return true;
  }

  window.location.replace(getAppUrl("login.html"));
  return false;
}

function initThemeToggle() {
  if (!elements.themeToggle) {
    return;
  }

  const savedTheme = readSavedTheme();
  const useOldTheme = savedTheme === "old";
  applyTheme(useOldTheme);

  elements.themeToggle.addEventListener("click", () => {
    const nextOldTheme = !document.body.classList.contains("theme-old");
    applyTheme(nextOldTheme);
  });
}

function applyTheme(useOldTheme) {
  document.body.classList.toggle("theme-old", useOldTheme);
  updateThemeToggleLabel(useOldTheme);
  saveTheme(useOldTheme ? "old" : "dark");
}

function updateThemeToggleLabel(useOldTheme) {
  if (!elements.themeToggle) {
    return;
  }

  elements.themeToggle.textContent = useOldTheme ? "Modo oscuro" : "Modo claro";
  elements.themeToggle.setAttribute("aria-label", useOldTheme ? "Activar modo oscuro" : "Activar modo claro");
}

function readSavedTheme() {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveTheme(themeValue) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeValue);
  } catch {
    // Ignora bloqueos de almacenamiento del navegador.
  }
}

async function handleImageSelection(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    addMessage("system", "El archivo seleccionado debe ser imagen o PDF.");
    return;
  }

  state.selectedFile = file;
  state.reportContext = "";
  state.conversation = [];
  addMessage("system", `Imagen cargada: ${file.name}. Inicio OCR y analisis automatico.`);

  if (!validateFullConfig()) {
    return;
  }

  try {
    setBusy(true, "Procesando imagen");
    const extractedText = await extractTextWithOcrSpace(file);
    addMessage("user", extractedText);
    await requestClinicalAnalysis({
      reportText: extractedText,
      instruction: "Haz una lectura inicial del informe y destaca parametros fuera de rango con sus posibles correlaciones clinicas.",
    });
  } catch (error) {
    console.error(error);
    setStatus("Error en imagen", true);
    addMessage("system", normalizeError(error));
  } finally {
    if (event.target instanceof HTMLInputElement) {
      event.target.value = "";
    }

    setBusy(false, state.reportContext ? "Listo para seguimiento" : "Esperando datos");
  }
}

async function handleFollowUp(event) {
  event.preventDefault();

  const question = elements.chatInput.value.trim();
  if (!question) {
    return;
  }

  if (!validateLlmConfig()) {
    return;
  }

  addMessage("user", question);
  elements.chatInput.value = "";

  if (!state.reportContext) {
    try {
      setBusy(true, "Analizando informe");
      state.conversation = [];
      await requestClinicalAnalysis({
        reportText: question,
        instruction: "Analiza el texto del informe y resume hallazgos clave, parametros alterados y posibles hipotesis clinicas orientativas.",
      });
    } catch (error) {
      console.error(error);
      setStatus("Error de analisis", true);
      addMessage("system", normalizeError(error));
    } finally {
      setBusy(false, state.reportContext ? "Listo para seguimiento" : "Esperando datos");
    }
    return;
  }

  try {
    setBusy(true, "Consultando seguimiento");
    const messages = [
      { role: "system", content: buildSystemPrompt() },
      ...state.conversation,
      {
        role: "user",
        content: [
          "Consulta adicional sobre el mismo informe bioquimico.",
          "Responde breve, claro y en espanol.",
          "Usa solo datos presentes en el informe.",
          "Maximo 5 bullets cortos.",
          "Contexto del informe:",
          state.reportContext,
          "Pregunta del usuario:",
          question,
        ].join("\n\n"),
      },
    ];

    const assistantReply = await callLlmApi(messages);
    state.conversation.push({ role: "user", content: question });
    state.conversation.push({ role: "assistant", content: assistantReply });
    addMessage("assistant", assistantReply);
    await saveConversation();
    setStatus("Listo para seguimiento");
  } catch (error) {
    console.error(error);
    setStatus("Error de seguimiento", true);
    addMessage("system", normalizeError(error));
  } finally {
    setBusy(false, state.reportContext ? "Listo para seguimiento" : "Esperando datos");
  }
}

async function requestClinicalAnalysis({ reportText, instruction }) {
  const analysisPrompt = [
    "Actua como personal de salud y da una lectura orientativa, no diagnostica.",
    "Responde breve.",
    "Formato: Resumen, Fuera de rango, Posibles causas, Alerta final.",
    "Si faltan rangos de referencia, dilo sin inventar.",
    "Usa bullets cortos y maximo 120 palabras.",
    instruction,
    "Texto del informe:",
    reportText,
  ].join("\n\n");

  const messages = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: analysisPrompt },
  ];

  const assistantReply = await callLlmApi(messages);
  state.reportContext = reportText;
  state.conversation = [
    { role: "user", content: reportText },
    { role: "assistant", content: assistantReply },
  ];

  addMessage("assistant", assistantReply);
  await saveConversation();
  setStatus("Analisis completado");
}

async function extractTextWithOcrSpace(file) {
  if (file.type === "application/pdf") {
    return extractTextFromPdfInChunks(file);
  }

  return extractTextWithOcrFile(file);
}

async function extractTextFromPdfInChunks(file) {
  let PDFDocument;
  try {
    ({ PDFDocument } = await loadPdfLib());
  } catch {
    return extractTextFromPdfAsImages(file);
  }

  const sourceBytes = await file.arrayBuffer();
  let sourcePdf;
  try {
    sourcePdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  } catch {
    return extractTextFromPdfAsImages(file);
  }

  const totalPages = sourcePdf.getPageCount();

  if (totalPages <= OCR_PDF_PAGE_LIMIT) {
    try {
      return await extractTextWithOcrFile(file);
    } catch (error) {
      if (isNoUsableOcrTextError(error)) {
        return extractTextFromPdfAsImages(file);
      }

      throw error;
    }
  }

  const parts = [];
  for (let startIndex = 0; startIndex < totalPages; startIndex += OCR_PDF_PAGE_LIMIT) {
    const endIndex = Math.min(startIndex + OCR_PDF_PAGE_LIMIT, totalPages);
    setStatus(`OCR PDF: paginas ${startIndex + 1}-${endIndex} de ${totalPages}`);

    const chunkPdf = await PDFDocument.create();
    const indexes = Array.from({ length: endIndex - startIndex }, (_, offset) => startIndex + offset);
    const copiedPages = await chunkPdf.copyPages(sourcePdf, indexes);
    copiedPages.forEach((page) => chunkPdf.addPage(page));

    const chunkBytes = await chunkPdf.save();
    const chunkFile = new File([
      chunkBytes,
    ], `${removeFileExtension(file.name)}_p${startIndex + 1}-${endIndex}.pdf`, {
      type: "application/pdf",
    });

    let chunkText = "";
    try {
      chunkText = await extractTextWithOcrFile(chunkFile);
    } catch (error) {
      if (isNoUsableOcrTextError(error)) {
        const chunkImageFiles = await renderPdfFileToImages(chunkFile);
        chunkText = await extractTextFromImageFiles(chunkImageFiles);
      } else {
        throw error;
      }
    }

    if (chunkText) {
      parts.push(chunkText);
    }
  }

  const mergedText = parts.join("\n\n").trim();
  if (!mergedText) {
    return extractTextFromPdfAsImages(file);
  }

  return mergedText;
}

async function extractTextFromPdfAsImages(file) {
  const imageFiles = await renderPdfFileToImages(file);
  const mergedText = await extractTextFromImageFiles(imageFiles);

  if (!mergedText) {
    throw new Error("El OCR no devolvio texto utilizable.");
  }

  return mergedText;
}

async function extractTextWithOcrFile(file) {
  const ocrProxyUrl = getProxyUrl("/api/ocr");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("language", "spa");
  formData.append("isOverlayRequired", "false");
  formData.append("OCREngine", "2");
  formData.append("scale", "true");
  formData.append("isTable", "true");

  const response = await fetch(ocrProxyUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`El proxy de OCR devolvio ${response.status} ${response.statusText}. ${truncate(responseText, 280)}`);
  }

  const data = await response.json();
  const parsedText = (data.ParsedResults || [])
    .map((result) => result.ParsedText || "")
    .join("\n")
    .trim();

  const errorMessage = [
    Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join(" | ") : data.ErrorMessage,
    Array.isArray(data.WarningMessage) ? data.WarningMessage.join(" | ") : data.WarningMessage,
    data.ErrorDetails,
  ]
    .filter(Boolean)
    .join(" | ");

  const reachedPageLimit = /maximum page limit of 3|page limit of 3/i.test(errorMessage);

  if (data.IsErroredOnProcessing) {
    if (parsedText && reachedPageLimit) {
      return parsedText;
    }

    throw new Error(errorMessage || "OCR.space no pudo procesar la imagen.");
  }

  if (!parsedText) {
    throw new Error("El OCR no devolvio texto utilizable.");
  }

  return parsedText;
}

async function loadPdfLib() {
  if (!pdfLibPromise) {
    pdfLibPromise = import("https://esm.sh/pdf-lib@1.17.1");
  }

  return pdfLibPromise;
}

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import("https://esm.sh/pdfjs-dist@4.4.168/build/pdf.min.mjs").then(async (module) => {
      module.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
      return module;
    });
  }

  return pdfJsPromise;
}

async function renderPdfFileToImages(file) {
  const pdfjsLib = await loadPdfJs();
  const sourceBytes = await file.arrayBuffer();

  let pdfDocument;
  let password = "";
  
  // Try to open PDF, prompting for password if needed
  while (true) {
    try {
      pdfDocument = await pdfjsLib.getDocument({
        data: sourceBytes,
        password: password,
      }).promise;
      break; // Successfully loaded
    } catch (error) {
      // Check if it's a password error
      if (error.message && (error.message.includes("UserPassword") || error.message.includes("OwnerPassword"))) {
        // Ask user for password
        password = await promptPdfPassword();
        if (password === null) {
          throw new Error("No se puede procesar un PDF protegido sin contraseña.");
        }
        // Loop will retry with the provided password
      } else {
        throw new Error("No pude abrir el PDF para OCR. Verifica que sea un archivo PDF válido.");
      }
    }
  }

  const imageFiles = [];
  const totalPages = pdfDocument.numPages;

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    setStatus(`OCR PDF: pagina ${pageNumber} de ${totalPages}`);
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new Error("No pude preparar el lienzo para procesar el PDF.");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) {
          resolve(value);
          return;
        }

        reject(new Error("No pude convertir una pagina del PDF a imagen."));
      }, "image/png");
    });

    imageFiles.push(new File([
      blob,
    ], `${removeFileExtension(file.name)}_pagina_${pageNumber}.png`, {
      type: "image/png",
    }));
  }

  return imageFiles;
}

async function extractTextFromImageFiles(files) {
  const parts = [];

  for (const imageFile of files) {
    try {
      const text = await extractTextWithOcrFile(imageFile);
      if (text) {
        parts.push(text);
      }
    } catch (error) {
      if (!isNoUsableOcrTextError(error)) {
        throw error;
      }
    }
  }

  return parts.join("\n\n").trim();
}

function isNoUsableOcrTextError(error) {
  return error instanceof Error && /ocr no devolvio texto utilizable/i.test(error.message);
}

function removeFileExtension(filename) {
  return filename.replace(/\.[^.]+$/, "") || "documento";
}

async function callLlmApi(messages) {
  const llmProxyUrl = getProxyUrl("/api/llm");
  const response = await fetch(llmProxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: APP_CONFIG.llmModel.trim(),
      temperature: APP_CONFIG.llmTemperature,
      max_tokens: APP_CONFIG.llmMaxTokens,
      messages,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`El endpoint del modelo devolvio ${response.status} ${response.statusText}. ${truncate(responseText, 280)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("La respuesta del modelo no contiene texto en choices[0].message.content.");
  }

  return typeof content === "string" ? content.trim() : JSON.stringify(content, null, 2);
}

function buildSystemPrompt() {
  return [
    "Eres un asistente clinico orientativo para laboratorio.",
    "Responde en espanol, breve y directo.",
    "Detecta solo alteraciones respaldadas por el texto.",
    "No inventes valores, unidades ni rangos.",
    "Si faltan rangos, indicalo en una linea.",
    "No des diagnosticos definitivos.",
    "Prioriza ahorro de tokens: pocas frases, bullets cortos, sin relleno.",
  ].join(" ");
}

function configIsReady() {
  return hasProxyConfigured();
}

function validateLlmConfig() {
  if (!hasProxyConfigured()) {
    addMessage("system", "Falta configurar APP_CONFIG.proxyBaseUrl en script.js con la URL del backend proxy.");
    return false;
  }

  if (!APP_CONFIG.llmModel.trim()) {
    addMessage("system", "Falta el identificador del modelo dentro de APP_CONFIG en script.js.");
    return false;
  }

  return true;
}

function validateFullConfig() {
  if (!hasProxyConfigured()) {
    addMessage("system", "Falta configurar APP_CONFIG.proxyBaseUrl en script.js con la URL del backend proxy.");
    return false;
  }

  return validateLlmConfig();
}

function hasProxyConfigured() {
  const proxyBaseUrl = normalizeProxyBaseUrl(APP_CONFIG.proxyBaseUrl || "");
  return proxyBaseUrl.startsWith("https://") && !proxyBaseUrl.includes("PEGA_AQUI");
}

function getProxyUrl(pathname) {
  const baseUrl = normalizeProxyBaseUrl(APP_CONFIG.proxyBaseUrl || "");
  if (!baseUrl) {
    throw new Error("APP_CONFIG.proxyBaseUrl no esta configurado.");
  }

  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function normalizeProxyBaseUrl(urlValue) {
  return (urlValue || "").trim().replace(/\/+$/, "");
}

function setBusy(isBusy, label) {
  state.busy = isBusy;
  elements.sendButton.disabled = isBusy;
  if (elements.cameraInput) {
    elements.cameraInput.disabled = isBusy;
  }
  if (elements.imageInput) {
    elements.imageInput.disabled = isBusy;
  }
  if (elements.fileInput) {
    elements.fileInput.disabled = isBusy;
  }
  setStatus(label || (isBusy ? "Trabajando..." : "Listo"));
}

function setStatus(text, isError = false) {
  if (!elements.appStatus) {
    return;
  }

  elements.appStatus.textContent = text;
  elements.appStatus.style.background = isError ? "rgba(185, 28, 28, 0.12)" : "rgba(15, 118, 110, 0.12)";
  elements.appStatus.style.color = isError ? "#991b1b" : "#0b5c55";
}

function addMessage(role, content) {
  renderMessage(role, content);
  if (role === "user" || role === "assistant") {
    state.displayMessages.push({ role, content });
  }
}

function renderMessage(role, content) {
  const article = document.createElement("article");
  article.className = `message message-${role}`;

  const title = document.createElement("strong");
  title.textContent = role === "assistant" ? "Asistente" : role === "user" ? "Usuario" : "Sistema";

  const body = document.createElement("div");
  body.textContent = content;

  article.append(title, body);
  elements.messages.appendChild(article);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function truncate(text, limit) {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit).trimEnd()}...`;
}

function normalizeError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrio un error inesperado durante el procesamiento.";
}

// â”€â”€ Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function initSidebar() {
  await loadUserProfile();
  await loadConversationHistory();

  elements.newChatButton?.addEventListener("click", startNewChat);
  elements.signOutButton?.addEventListener("click", handleSignOut);
  elements.sidebarToggle?.addEventListener("click", toggleSidebar);
  elements.sidebarOverlay?.addEventListener("click", closeSidebar);
  document.addEventListener("pointerdown", handleGlobalMenuPointerDown, true);
}

async function loadUserProfile() {
  if (!isSupabaseConfigured() || !supabase) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const user = session.user;
  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Usuario";
  const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";

  if (elements.userName) elements.userName.textContent = name;
  if (elements.userAvatar) {
    if (avatar) {
      elements.userAvatar.src = avatar;
      elements.userAvatar.alt = name;
    } else {
      elements.userAvatar.style.display = "none";
    }
  }
}

async function loadConversationHistory() {
  if (!isSupabaseConfigured() || !supabase) {
    renderHistoryList([]);
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, created_at, data")
    .eq("user_id", session.user.id)
    .limit(50);

  if (error) {
    console.error("Error cargando historial:", error.message);
    return;
  }

  const sortedConversations = (data || []).sort((a, b) => {
    const aPinned = isPinnedConversation(a.data);
    const bPinned = isPinnedConversation(b.data);
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  renderHistoryList(sortedConversations);
}

function renderHistoryList(conversations) {
  if (!elements.historyList) return;

  elements.historyList.innerHTML = "";

  if (!conversations.length) {
    const li = document.createElement("li");
    li.className = "history-empty";
    li.textContent = "Sin consultas aun";
    elements.historyList.appendChild(li);
    return;
  }

  for (const conv of conversations) {
    const li = document.createElement("li");
    li.className = "history-item";
    if (conv.id === state.currentConversationId) li.classList.add("is-active");
    li.dataset.id = conv.id;

    const title = document.createElement("span");
    title.className = "history-item-title";
    title.textContent = conv.title || "Consulta";

    const pinned = isPinnedConversation(conv.data);
    if (pinned) {
      li.classList.add("is-pinned");
      const pinBadge = document.createElement("span");
      pinBadge.className = "history-item-pin";
      pinBadge.textContent = "Fijado";
      li.appendChild(pinBadge);
    }

    const actions = document.createElement("div");
    actions.className = "history-item-actions";

    const menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.className = "history-item-menu-button";
    menuBtn.setAttribute("aria-label", "Opciones de conversacion");
    menuBtn.textContent = "...";

    const menu = document.createElement("div");
    menu.className = "history-item-menu";

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "history-item-menu-action";
    renameBtn.textContent = "Renombrar";

    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.className = "history-item-menu-action";
    pinBtn.textContent = pinned ? "Desfijar chat" : "Fijar chat";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "history-item-menu-action is-danger";
    deleteBtn.textContent = "Borrar";

    menu.append(renameBtn, pinBtn, deleteBtn);
    actions.append(menuBtn, menu);
    li.append(title, actions);

    title.addEventListener("click", () => selectConversation(conv.id));
    actions.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    menu.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    menuBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleHistoryMenu(menu);
    });

    renameBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      closeHistoryMenus();
      await renameConversation(conv.id, conv.title || "Consulta");
    });

    pinBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      closeHistoryMenus();
      await togglePinConversation(conv);
    });

    deleteBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      closeHistoryMenus();
      await deleteConversation(conv.id);
    });

    elements.historyList.appendChild(li);
  }
}

function handleGlobalMenuPointerDown(event) {
  const hasOpenMenu = document.querySelector(".history-item-menu.is-open");
  if (!hasOpenMenu) {
    return;
  }

  const clickedMenu = event.target instanceof Element && event.target.closest(".history-item-actions");
  if (!clickedMenu) {
    closeHistoryMenus();
    event.preventDefault();
    event.stopPropagation();
  }
}

function toggleHistoryMenu(menuElement) {
  const willOpen = !menuElement.classList.contains("is-open");
  closeHistoryMenus();
  if (willOpen) {
    menuElement.classList.add("is-open");
    menuElement.closest(".history-item")?.classList.add("menu-open");
  }
}

function closeHistoryMenus() {
  document.querySelectorAll(".history-item-menu.is-open").forEach((menu) => {
    menu.classList.remove("is-open");
    menu.closest(".history-item")?.classList.remove("menu-open");
  });
}

async function renameConversation(conversationId, currentTitle) {
  if (!isSupabaseConfigured() || !supabase) return;

  const nextTitle = await showRenameModal(currentTitle);
  if (!nextTitle) return;

  const trimmedTitle = nextTitle.trim();
  if (!trimmedTitle) return;

  const { error } = await supabase
    .from("conversations")
    .update({ title: trimmedTitle, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) {
    addMessage("system", `No pude renombrar la conversacion: ${error.message}`);
    return;
  }

  await loadConversationHistory();
}

function showRenameModal(currentTitle) {
  return new Promise((resolve) => {
    if (!elements.renameModal || !elements.renameModalInput || !elements.renameModalCancel || !elements.renameModalConfirm) {
      resolve(window.prompt("Nuevo nombre para la conversacion:", currentTitle) || "");
      return;
    }

    elements.renameModalInput.value = currentTitle || "";
    elements.renameModal.classList.add("is-open");
    elements.renameModal.setAttribute("aria-hidden", "false");

    const cleanup = () => {
      elements.renameModal.classList.remove("is-open");
      elements.renameModal.setAttribute("aria-hidden", "true");
      elements.renameModalCancel.removeEventListener("click", onCancel);
      elements.renameModalConfirm.removeEventListener("click", onConfirm);
      elements.renameModalBackdrop?.removeEventListener("click", onCancel);
      elements.renameModalInput?.removeEventListener("keydown", onInputKeydown);
      document.removeEventListener("keydown", onKeydown);
    };

    const onCancel = () => {
      cleanup();
      resolve("");
    };

    const onConfirm = () => {
      const next = elements.renameModalInput.value.trim();
      cleanup();
      resolve(next);
    };

    const onInputKeydown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onConfirm();
      }
    };

    const onKeydown = (event) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    elements.renameModalCancel.addEventListener("click", onCancel);
    elements.renameModalConfirm.addEventListener("click", onConfirm);
    elements.renameModalBackdrop?.addEventListener("click", onCancel);
    elements.renameModalInput?.addEventListener("keydown", onInputKeydown);
    document.addEventListener("keydown", onKeydown);

    window.requestAnimationFrame(() => {
      elements.renameModalInput?.focus();
      elements.renameModalInput?.select();
    });
  });
}

async function deleteConversation(conversationId) {
  if (!isSupabaseConfigured() || !supabase) return;

  const confirmed = await showConfirmModal("Quieres borrar esta conversacion? Esta accion no se puede deshacer.");
  if (!confirmed) return;

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId);

  if (error) {
    addMessage("system", `No pude borrar la conversacion: ${error.message}`);
    return;
  }

  if (state.currentConversationId === conversationId) {
    startNewChat();
  }

  await loadConversationHistory();
}

function isPinnedConversation(data) {
  return Boolean(data?.isPinned);
}

async function togglePinConversation(conversation) {
  if (!isSupabaseConfigured() || !supabase) return;

  const currentlyPinned = isPinnedConversation(conversation.data);
  if (!currentlyPinned) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: allRows, error: countError } = await supabase
      .from("conversations")
      .select("id, data")
      .eq("user_id", session.user.id)
      .limit(200);

    if (countError) {
      addMessage("system", `No pude validar chats fijados: ${countError.message}`);
      return;
    }

    const pinnedCount = (allRows || []).filter((row) => isPinnedConversation(row.data)).length;
    if (pinnedCount >= 3) {
      addMessage("system", "Solo puedes fijar hasta 3 chats.");
      return;
    }
  }

  const nextData = {
    ...(conversation.data || {}),
    isPinned: !currentlyPinned,
  };

  const { error } = await supabase
    .from("conversations")
    .update({ data: nextData, updated_at: new Date().toISOString() })
    .eq("id", conversation.id);

  if (error) {
    addMessage("system", `No pude actualizar el estado fijado: ${error.message}`);
    return;
  }

  if (state.currentConversationId === conversation.id) {
    state.isPinned = !currentlyPinned;
  }

  await loadConversationHistory();
}

function showConfirmModal(message) {
  return new Promise((resolve) => {
    if (!elements.confirmModal || !elements.confirmModalText || !elements.confirmModalCancel || !elements.confirmModalConfirm) {
      resolve(window.confirm(message));
      return;
    }

    elements.confirmModalText.textContent = message;
    elements.confirmModal.classList.add("is-open");
    elements.confirmModal.setAttribute("aria-hidden", "false");

    const cleanup = () => {
      elements.confirmModal.classList.remove("is-open");
      elements.confirmModal.setAttribute("aria-hidden", "true");
      elements.confirmModalCancel.removeEventListener("click", onCancel);
      elements.confirmModalConfirm.removeEventListener("click", onConfirm);
      elements.confirmModalBackdrop?.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onKeydown);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    const onKeydown = (event) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    elements.confirmModalCancel.addEventListener("click", onCancel);
    elements.confirmModalConfirm.addEventListener("click", onConfirm);
    elements.confirmModalBackdrop?.addEventListener("click", onCancel);
    document.addEventListener("keydown", onKeydown);
  });
}

async function selectConversation(id) {
  if (!isSupabaseConfigured() || !supabase) return;

  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, data")
    .eq("id", id)
    .single();

  if (error || !data) return;

  state.currentConversationId = data.id;
  state.reportContext = data.data?.reportContext || "";
  state.isPinned = isPinnedConversation(data.data);
  state.conversation = data.data?.conversation || [];
  state.displayMessages = data.data?.displayMessages || [];
  state.selectedFile = null;
  if (elements.cameraInput) {
    elements.cameraInput.value = "";
  }
  if (elements.imageInput) {
    elements.imageInput.value = "";
  }
  if (elements.fileInput) {
    elements.fileInput.value = "";
  }

  elements.messages.innerHTML = "";
  for (const msg of state.displayMessages) {
    renderMessage(msg.role, msg.content);
  }

  document.querySelectorAll(".history-item").forEach(item => {
    item.classList.toggle("is-active", item.dataset.id === id);
  });

  closeSidebar();
}

async function saveConversation() {
  if (!isSupabaseConfigured() || !supabase) return;
  if (!state.displayMessages.length) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const firstUserMsg = state.displayMessages.find(m => m.role === "user");
  const title = firstUserMsg ? truncate(firstUserMsg.content, 48) : "Consulta";

  const payload = {
    user_id: session.user.id,
    title,
    data: {
      isPinned: state.isPinned,
      reportContext: state.reportContext,
      conversation: state.conversation,
      displayMessages: state.displayMessages,
    },
    updated_at: new Date().toISOString(),
  };

  if (state.currentConversationId) {
    await supabase
      .from("conversations")
      .update(payload)
      .eq("id", state.currentConversationId);
    await loadConversationHistory();
  } else {
    const { data, error } = await supabase
      .from("conversations")
      .insert(payload)
      .select("id")
      .single();
    if (!error && data) {
      state.currentConversationId = data.id;
      await loadConversationHistory();
    }
  }
}

function startNewChat() {
  state.selectedFile = null;
  state.reportContext = "";
  state.isPinned = false;
  state.conversation = [];
  state.displayMessages = [];
  state.currentConversationId = null;

  elements.messages.innerHTML = "";
  if (elements.cameraInput) {
    elements.cameraInput.value = "";
  }
  if (elements.imageInput) {
    elements.imageInput.value = "";
  }
  if (elements.fileInput) {
    elements.fileInput.value = "";
  }
  renderMessage("assistant", "Pega valores del laboratorio o saca una foto del informe. El OCR y el analisis se ejecutan automaticamente. Luego puedes hacer preguntas de seguimiento.");

  document.querySelectorAll(".history-item").forEach(item => item.classList.remove("is-active"));
  closeSidebar();
}

async function handleSignOut() {
  if (supabase) await supabase.auth.signOut();
  window.location.replace(getAppUrl("login.html"));
}

function toggleSidebar() {
  setSidebarOpen(!elements.sidebar?.classList.contains("is-open"));
}

function closeSidebar() {
  setSidebarOpen(false);
}

function setSidebarOpen(open) {
  elements.sidebar?.classList.toggle("is-open", open);
  elements.sidebarOverlay?.classList.toggle("is-visible", open);
  if (elements.sidebarToggle) elements.sidebarToggle.setAttribute("aria-expanded", String(open));
}

