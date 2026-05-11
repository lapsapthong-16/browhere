use base64::Engine;
use quick_xml::events::Event;
use quick_xml::Reader;
use rusqlite::ffi::sqlite3_auto_extension;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sqlite_vec::sqlite3_vec_init;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::fs;
use std::io;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::Once;
use std::time::{SystemTime, UNIX_EPOCH};

const SUPPORTED_EXTENSIONS: &[&str] = &["pdf", "docx", "txt", "md", "png", "jpg", "jpeg", "webp"];
const MAX_TEXT_BYTES: u64 = 2 * 1024 * 1024;
const DEFAULT_LIMIT: usize = 20;
static SQLITE_VEC_INIT: Once = Once::new();

#[derive(Default)]
pub struct SearchEngineState {
    db_lock: Mutex<()>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettings {
    pub provider: AiProviderKind,
    pub endpoint: String,
    pub model: String,
    pub embedding_dimension: usize,
    pub api_key: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AiProviderKind {
    GoogleGemini,
    HuggingFace,
    OpenAiCompatible,
    Ollama,
    LocalPlaceholder,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicAiSettings {
    pub provider: AiProviderKind,
    pub endpoint: String,
    pub model: String,
    pub embedding_dimension: usize,
    pub has_api_key: bool,
    pub api_key_mask: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsResponse {
    pub ai: PublicAiSettings,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub ok: bool,
    pub message: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexStatus {
    pub state: IndexState,
    pub indexed_folders: Vec<String>,
    pub indexed_file_count: usize,
    pub indexed_chunk_count: usize,
    pub last_error: Option<String>,
    pub message: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum IndexState {
    NotConfigured,
    Ready,
    Indexing,
    Stale,
    Failed,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilesResponse {
    pub results: Vec<SearchResultDto>,
    pub readiness: SearchReadiness,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultDto {
    pub id: String,
    pub rank: usize,
    pub file_path: String,
    pub display_name: String,
    pub file_type: String,
    pub modified_at: Option<String>,
    pub size_bytes: Option<u64>,
    pub match_context: Option<MatchContext>,
    pub availability_hint: Option<AvailabilityHint>,
    pub actions: SearchActions,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MatchContext {
    Snippet { text: String },
    Caption { text: String },
    Explanation { text: String },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AvailabilityHint {
    Partial { reason: String },
    Unavailable { reason: String },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchActions {
    pub can_open: bool,
    pub can_reveal: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SearchReadiness {
    Ready,
    NotReady { reason: String },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct AppStore {
    ai: AiSettings,
    indexed_folders: Vec<String>,
    files: Vec<IndexedFile>,
    chunks: Vec<IndexedChunk>,
    active_embedding_signature: Option<String>,
    index_state: IndexState,
    last_error: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct IndexedFile {
    id: String,
    path: String,
    display_name: String,
    file_type: String,
    modified_at: Option<String>,
    modified_key: u64,
    size_bytes: Option<u64>,
    extraction_status: ExtractionStatus,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
enum ExtractionStatus {
    Ready,
    OcrUnavailable,
    ExtractionFailed { message: String },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct IndexedChunk {
    id: String,
    file_id: String,
    text: String,
    embedding: Vec<f32>,
}

struct IndexedDocument {
    file: IndexedFile,
    chunk_texts: Vec<String>,
}

impl Default for AppStore {
    fn default() -> Self {
        Self {
            ai: AiSettings {
                provider: AiProviderKind::GoogleGemini,
                endpoint: "https://generativelanguage.googleapis.com/v1beta".to_string(),
                model: "text-embedding-004".to_string(),
                embedding_dimension: 768,
                api_key: None,
            },
            indexed_folders: Vec::new(),
            files: Vec::new(),
            chunks: Vec::new(),
            active_embedding_signature: None,
            index_state: IndexState::NotConfigured,
            last_error: None,
        }
    }
}

#[tauri::command]
pub fn get_settings(state: tauri::State<SearchEngineState>) -> SettingsResponse {
    let store = load_store(&state);
    SettingsResponse {
        ai: to_public_settings(&store.ai),
    }
}

#[tauri::command]
pub fn save_ai_settings(settings: AiSettings, state: tauri::State<SearchEngineState>) -> SettingsResponse {
    let mut store = load_store(&state);
    let old_signature = embedding_signature(&store.ai);
    let mut next_settings = settings;
    if next_settings.api_key.as_deref().unwrap_or("").is_empty()
        && next_settings.provider == store.ai.provider
    {
        next_settings.api_key = store.ai.api_key.clone();
    }
    let new_signature = embedding_signature(&next_settings);
    store.ai = next_settings;
    if old_signature != new_signature && !store.chunks.is_empty() {
        store.index_state = IndexState::Stale;
        store.last_error = None;
    }
    persist_store(&store).ok();
    replace_store(&state, store.clone());
    SettingsResponse {
        ai: to_public_settings(&store.ai),
    }
}

#[tauri::command]
pub fn test_ai_provider(settings: AiSettings) -> ProviderStatus {
    match create_provider(&settings).and_then(|provider| provider.embed_query("hello world")) {
        Ok(vector) if vector.len() == settings.embedding_dimension => ProviderStatus {
            ok: true,
            message: format!("Provider returned {} dimensions.", vector.len()),
        },
        Ok(vector) => ProviderStatus {
            ok: false,
            message: format!(
                "Provider returned {} dimensions, expected {}.",
                vector.len(),
                settings.embedding_dimension
            ),
        },
        Err(error) => ProviderStatus {
            ok: false,
            message: error,
        },
    }
}

#[tauri::command]
pub fn get_index_status(state: tauri::State<SearchEngineState>) -> IndexStatus {
    let store = load_store(&state);
    to_index_status(&store)
}

#[tauri::command]
pub fn add_index_folder(path: String, state: tauri::State<SearchEngineState>) -> IndexStatus {
    let mut store = load_store(&state);
    let folder = PathBuf::from(&path);
    if !folder.is_dir() {
        store.index_state = IndexState::Failed;
        store.last_error = Some("Folder does not exist or is not readable.".to_string());
    } else if !store.indexed_folders.iter().any(|entry| entry == &path) {
        store.indexed_folders.push(path);
        store.index_state = IndexState::Stale;
        store.last_error = None;
    }
    persist_store(&store).ok();
    replace_store(&state, store.clone());
    to_index_status(&store)
}

#[tauri::command]
pub fn remove_index_folder(path: String, state: tauri::State<SearchEngineState>) -> IndexStatus {
    let mut store = load_store(&state);
    store.indexed_folders.retain(|entry| entry != &path);
    store.files.retain(|file| !file.path.starts_with(&path));
    let file_ids: Vec<String> = store.files.iter().map(|file| file.id.clone()).collect();
    store.chunks.retain(|chunk| file_ids.contains(&chunk.file_id));
    store.index_state = if store.indexed_folders.is_empty() {
        IndexState::NotConfigured
    } else {
        IndexState::Stale
    };
    persist_store(&store).ok();
    replace_store(&state, store.clone());
    to_index_status(&store)
}

#[tauri::command]
pub fn start_indexing(state: tauri::State<SearchEngineState>) -> IndexStatus {
    let mut store = load_store(&state);
    if store.indexed_folders.is_empty() {
        store.index_state = IndexState::NotConfigured;
        store.last_error = Some("Add at least one folder before indexing.".to_string());
        persist_store(&store).ok();
        replace_store(&state, store.clone());
        return to_index_status(&store);
    }

    let provider = match create_provider(&store.ai) {
        Ok(provider) => provider,
        Err(error) => {
            store.index_state = IndexState::Failed;
            store.last_error = Some(error);
            persist_store(&store).ok();
            replace_store(&state, store.clone());
            return to_index_status(&store);
        }
    };

    store.index_state = IndexState::Indexing;
    replace_store(&state, store.clone());

    match rebuild_index(store, provider.as_ref()) {
        Ok(next_store) => {
            persist_store(&next_store).ok();
            replace_store(&state, next_store.clone());
            to_index_status(&next_store)
        }
        Err(error) => {
            let mut failed_store = load_store(&state);
            failed_store.index_state = IndexState::Failed;
            failed_store.last_error = Some(error);
            persist_store(&failed_store).ok();
            replace_store(&state, failed_store.clone());
            to_index_status(&failed_store)
        }
    }
}

#[tauri::command]
pub fn search_files(query: String, limit: Option<usize>, state: tauri::State<SearchEngineState>) -> SearchFilesResponse {
    let store = load_store(&state);
    if store.ai.provider != AiProviderKind::LocalPlaceholder && store.ai.api_key.as_deref().unwrap_or("").trim().is_empty() {
        return not_ready("providerUnavailable");
    }
    if store.index_state != IndexState::Ready {
        return not_ready("notIndexedYet");
    }
    let provider = match create_provider(&store.ai) {
        Ok(provider) => provider,
        Err(_) => return not_ready("providerUnavailable"),
    };
    let query_embedding = match provider.embed_query(&query) {
        Ok(vector) => vector,
        Err(_) => return not_ready("providerUnavailable"),
    };
    let results = match search_with_sqlite_vec(&store, &query, &query_embedding, limit.unwrap_or(DEFAULT_LIMIT)) {
        Ok(results) => results,
        Err(_) => search_with_rust_vectors(&store, &query, &query_embedding, limit.unwrap_or(DEFAULT_LIMIT)),
    };

    SearchFilesResponse {
        results,
        readiness: SearchReadiness::Ready,
    }
}

fn search_with_rust_vectors(
    store: &AppStore,
    query: &str,
    query_embedding: &[f32],
    limit: usize,
) -> Vec<SearchResultDto> {
    let mut best_by_file: HashMap<String, (f32, String)> = HashMap::new();
    for chunk in &store.chunks {
        let score = cosine_similarity(query_embedding, &chunk.embedding) + lexical_boost(query, &chunk.text);
        best_by_file
            .entry(chunk.file_id.clone())
            .and_modify(|entry| {
                if score > entry.0 {
                    *entry = (score, chunk.text.clone());
                }
            })
            .or_insert((score, chunk.text.clone()));
    }

    let mut ranked: Vec<(SearchResultDto, f32)> = store
        .files
        .iter()
        .filter_map(|file| {
            best_by_file.get(&file.id).map(|(score, text)| {
                let total_score = score + lexical_boost(query, &format!("{} {}", file.display_name, file.path));
                (file_to_result(file, text), total_score)
            })
        })
        .collect();

    ranked.sort_by(|left, right| right.1.partial_cmp(&left.1).unwrap_or(Ordering::Equal));
    ranked
        .into_iter()
        .take(limit)
        .enumerate()
        .map(|(index, (mut result, _))| {
            result.rank = index + 1;
            result
        })
        .collect()
}

fn search_with_sqlite_vec(
    store: &AppStore,
    query: &str,
    query_embedding: &[f32],
    limit: usize,
) -> Result<Vec<SearchResultDto>, String> {
    let connection = open_db()?;
    let probe = vector_to_blob(query_embedding);
    let mut statement = connection
        .prepare("SELECT chunk_id, distance FROM vec_chunks WHERE embedding MATCH ?1 AND k = ?2")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![probe, (limit * 8).max(limit) as i64], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, f32>(1)?))
        })
        .map_err(|error| error.to_string())?;

    let chunk_by_id: HashMap<&str, &IndexedChunk> = store
        .chunks
        .iter()
        .map(|chunk| (chunk.id.as_str(), chunk))
        .collect();
    let mut best_by_file: HashMap<String, (f32, String)> = HashMap::new();
    for row in rows {
        let (chunk_id, distance) = row.map_err(|error| error.to_string())?;
        let Some(chunk) = chunk_by_id.get(chunk_id.as_str()) else {
            continue;
        };
        let score = (1.0 / (1.0 + distance)) + lexical_boost(query, &chunk.text);
        best_by_file
            .entry(chunk.file_id.clone())
            .and_modify(|entry| {
                if score > entry.0 {
                    *entry = (score, chunk.text.clone());
                }
            })
            .or_insert((score, chunk.text.clone()));
    }

    let mut ranked: Vec<(SearchResultDto, f32)> = store
        .files
        .iter()
        .filter_map(|file| {
            best_by_file.get(&file.id).map(|(score, text)| {
                let total_score = score + lexical_boost(query, &format!("{} {}", file.display_name, file.path));
                (file_to_result(file, text), total_score)
            })
        })
        .collect();
    ranked.sort_by(|left, right| right.1.partial_cmp(&left.1).unwrap_or(Ordering::Equal));
    Ok(ranked
        .into_iter()
        .take(limit)
        .enumerate()
        .map(|(index, (mut result, _))| {
            result.rank = index + 1;
            result
        })
        .collect())
}

fn rebuild_index(mut store: AppStore, provider: &dyn EmbeddingProvider) -> Result<AppStore, String> {
    let mut documents = Vec::new();
    for root in &store.indexed_folders {
        for path in collect_supported_files(Path::new(root)) {
            let metadata = match fs::metadata(&path) {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };
            let file_id = stable_id(path.to_string_lossy().as_ref());
            let extracted = extract_file_text(&path, metadata.len());
            let file = IndexedFile {
                id: file_id.clone(),
                path: path.to_string_lossy().to_string(),
                display_name: path.file_name().and_then(|name| name.to_str()).unwrap_or("").to_string(),
                file_type: extension(&path),
                modified_at: None,
                modified_key: metadata.modified().ok().and_then(system_time_to_secs).unwrap_or(0),
                size_bytes: Some(metadata.len()),
                extraction_status: extracted.status,
            };
            documents.push(IndexedDocument {
                file,
                chunk_texts: chunk_text(&extracted.text),
            });
        }
    }

    let all_texts: Vec<String> = documents
        .iter()
        .flat_map(|document| document.chunk_texts.iter().cloned())
        .collect();
    let embeddings = provider.embed_documents(&all_texts)?;

    let mut files = Vec::new();
    let mut chunks = Vec::new();
    let mut embedding_index = 0;
    for document in documents {
        let file_id = document.file.id.clone();
        for (chunk_index, text) in document.chunk_texts.into_iter().enumerate() {
            let embedding = embeddings
                .get(embedding_index)
                .cloned()
                .ok_or_else(|| "Provider returned fewer embeddings than requested.".to_string())?;
            embedding_index += 1;
            chunks.push(IndexedChunk {
                    id: format!("{}:{chunk_index}", file_id),
                    file_id: file_id.clone(),
                    text,
                    embedding,
            });
        }
        files.push(document.file);
    }

    if embedding_index != embeddings.len() {
        return Err("Provider returned more embeddings than requested.".to_string());
    }

    store.files = files;
    store.chunks = chunks;
    store.active_embedding_signature = Some(embedding_signature(&store.ai));
    store.index_state = IndexState::Ready;
    store.last_error = None;
    Ok(store)
}

struct ExtractedText {
    text: String,
    status: ExtractionStatus,
}

fn extract_file_text(path: &Path, size: u64) -> ExtractedText {
    let ext = extension(path);
    if matches!(ext.as_str(), "txt" | "md") {
        if size > MAX_TEXT_BYTES {
            return ExtractedText {
                text: fallback_text(path),
                status: ExtractionStatus::ExtractionFailed { message: "File too large for V1 text extraction.".to_string() },
            };
        }
        return match fs::read_to_string(path) {
            Ok(text) => ExtractedText { text, status: ExtractionStatus::Ready },
            Err(error) => ExtractedText {
                text: fallback_text(path),
                status: ExtractionStatus::ExtractionFailed { message: error.to_string() },
            },
        };
    }
    if ext == "pdf" {
        return match extract_pdf_text(path) {
            Ok(text) if !text.trim().is_empty() => ExtractedText {
                text,
                status: ExtractionStatus::Ready,
            },
            Ok(_) => ExtractedText {
                text: fallback_text(path),
                status: ExtractionStatus::ExtractionFailed {
                    message: "PDF did not expose extractable text.".to_string(),
                },
            },
            Err(error) => ExtractedText {
                text: fallback_text(path),
                status: ExtractionStatus::ExtractionFailed { message: error },
            },
        };
    }
    if ext == "docx" {
        return match extract_docx_text(path) {
            Ok(text) if !text.trim().is_empty() => ExtractedText {
                text,
                status: ExtractionStatus::Ready,
            },
            Ok(_) => ExtractedText {
                text: fallback_text(path),
                status: ExtractionStatus::ExtractionFailed {
                    message: "DOCX did not expose extractable text.".to_string(),
                },
            },
            Err(error) => ExtractedText {
                text: fallback_text(path),
                status: ExtractionStatus::ExtractionFailed { message: error },
            },
        };
    }
    if matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "webp") {
        return ExtractedText {
            text: fallback_text(path),
            status: ExtractionStatus::OcrUnavailable,
        };
    }
    ExtractedText {
        text: fallback_text(path),
        status: ExtractionStatus::ExtractionFailed {
            message: format!("{ext} text extraction needs parser integration."),
        },
    }
}

fn extract_pdf_text(path: &Path) -> Result<String, String> {
    let document = lopdf::Document::load(path).map_err(|error| error.to_string())?;
    let pages: Vec<u32> = document.get_pages().keys().copied().collect();
    document.extract_text(&pages).map_err(|error| error.to_string())
}

fn extract_docx_text(path: &Path) -> Result<String, String> {
    let file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|error| error.to_string())?;
    let mut document_xml = String::new();
    archive
        .by_name("word/document.xml")
        .map_err(|error| error.to_string())?
        .read_to_string(&mut document_xml)
        .map_err(|error| error.to_string())?;

    let mut reader = Reader::from_str(&document_xml);
    reader.config_mut().trim_text(true);
    let mut text = String::new();
    loop {
        match reader.read_event() {
            Ok(Event::Text(event)) => {
                let value = event.unescape().map_err(|error| error.to_string())?;
                text.push_str(&value);
                text.push(' ');
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(error) => return Err(error.to_string()),
        }
    }
    Ok(text)
}

fn fallback_text(path: &Path) -> String {
    let name = path.file_name().and_then(|value| value.to_str()).unwrap_or("");
    let parent = path.parent().and_then(|value| value.to_str()).unwrap_or("");
    format!("{name} {parent}")
}

fn chunk_text(text: &str) -> Vec<String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let chars: Vec<char> = trimmed.chars().collect();
    let mut chunks = Vec::new();
    let mut start = 0;
    while start < chars.len() {
        let end = usize::min(start + 1200, chars.len());
        chunks.push(chars[start..end].iter().collect());
        start = end;
    }
    chunks
}

fn collect_supported_files(root: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    collect_supported_files_into(root, &mut files);
    files
}

fn collect_supported_files_into(root: &Path, files: &mut Vec<PathBuf>) {
    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if !is_ignored_dir(&path) {
                collect_supported_files_into(&path, files);
            }
        } else if SUPPORTED_EXTENSIONS.contains(&extension(&path).as_str()) {
            files.push(path);
        }
    }
}

fn is_ignored_dir(path: &Path) -> bool {
    let name = path.file_name().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    matches!(name.as_str(), "node_modules" | ".git" | "target" | "dist" | "appdata" | "windows")
}

trait EmbeddingProvider {
    fn embed_query(&self, text: &str) -> Result<Vec<f32>, String>;
    fn embed_document(&self, text: &str) -> Result<Vec<f32>, String>;
    fn embed_documents(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        texts
            .iter()
            .map(|text| self.embed_document(text))
            .collect()
    }
}

fn create_provider(settings: &AiSettings) -> Result<Box<dyn EmbeddingProvider>, String> {
    if settings.provider == AiProviderKind::LocalPlaceholder {
        return Ok(Box::new(LocalPlaceholderProvider {
            dimensions: settings.embedding_dimension.max(8),
        }));
    }
    if settings.api_key.as_deref().unwrap_or("").trim().is_empty() {
        return Err("API key is required for the selected provider.".to_string());
    }
    Ok(Box::new(HttpEmbeddingProvider {
        settings: settings.clone(),
        client: reqwest::blocking::Client::new(),
    }))
}

struct LocalPlaceholderProvider {
    dimensions: usize,
}

impl EmbeddingProvider for LocalPlaceholderProvider {
    fn embed_query(&self, text: &str) -> Result<Vec<f32>, String> {
        Ok(hash_embedding(text, self.dimensions))
    }

    fn embed_document(&self, text: &str) -> Result<Vec<f32>, String> {
        Ok(hash_embedding(text, self.dimensions))
    }
}

struct HttpEmbeddingProvider {
    settings: AiSettings,
    client: reqwest::blocking::Client,
}

impl EmbeddingProvider for HttpEmbeddingProvider {
    fn embed_query(&self, text: &str) -> Result<Vec<f32>, String> {
        self.validate_embedding(self.embed(text)?)
    }

    fn embed_document(&self, text: &str) -> Result<Vec<f32>, String> {
        self.validate_embedding(self.embed(text)?)
    }

    fn embed_documents(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        let vectors = match self.settings.provider {
            AiProviderKind::OpenAiCompatible => self.embed_openai_batch(texts),
            AiProviderKind::Ollama => self.embed_ollama_batch(texts),
            _ => texts.iter().map(|text| self.embed(text)).collect(),
        }?;

        vectors
            .into_iter()
            .map(|vector| self.validate_embedding(vector))
            .collect()
    }
}

impl HttpEmbeddingProvider {
    fn validate_embedding(&self, vector: Vec<f32>) -> Result<Vec<f32>, String> {
        if vector.is_empty() {
            return Err("Embedding vector was empty.".to_string());
        }
        if vector.len() != self.settings.embedding_dimension {
            return Err(format!(
                "Embedding dimension mismatch: provider returned {}, expected {}. Update settings or rebuild with matching model.",
                vector.len(),
                self.settings.embedding_dimension
            ));
        }
        Ok(vector)
    }

    fn embed(&self, text: &str) -> Result<Vec<f32>, String> {
        match self.settings.provider {
            AiProviderKind::GoogleGemini => self.embed_gemini(text),
            AiProviderKind::HuggingFace => self.embed_hugging_face(text),
            AiProviderKind::OpenAiCompatible => self.embed_openai_compatible(text),
            AiProviderKind::Ollama => self.embed_ollama(text),
            AiProviderKind::LocalPlaceholder => Ok(hash_embedding(text, self.settings.embedding_dimension.max(8))),
        }
    }

    fn embed_gemini(&self, text: &str) -> Result<Vec<f32>, String> {
        let endpoint = format!(
            "{}/models/{}:embedContent?key={}",
            self.settings.endpoint.trim_end_matches('/'),
            self.settings.model,
            self.settings.api_key.as_deref().unwrap_or("")
        );
        let body = serde_json::json!({
            "content": { "parts": [{ "text": text }] }
        });
        let value: serde_json::Value = self.post_json(&endpoint, body)?;
        parse_number_array(&value["embedding"]["values"])
    }

    fn embed_hugging_face(&self, text: &str) -> Result<Vec<f32>, String> {
        let endpoint = if self.settings.endpoint.trim().is_empty() {
            format!("https://api-inference.huggingface.co/pipeline/feature-extraction/{}", self.settings.model)
        } else {
            self.settings.endpoint.clone()
        };
        let body = serde_json::json!({ "inputs": text });
        let value: serde_json::Value = self
            .client
            .post(endpoint)
            .bearer_auth(self.settings.api_key.as_deref().unwrap_or(""))
            .json(&body)
            .send()
            .map_err(describe_http_transport_error)?
            .error_for_status()
            .map_err(describe_http_status_error)?
            .json()
            .map_err(|error| error.to_string())?;
        if value.is_array() && value[0].is_array() && value[0][0].is_array() {
            return parse_number_array(&value[0][0]);
        }
        if value.is_array() && value[0].is_array() {
            return parse_number_array(&value[0]);
        }
        parse_number_array(&value)
    }

    fn embed_openai_compatible(&self, text: &str) -> Result<Vec<f32>, String> {
        Ok(self
            .embed_openai_batch(&[text.to_string()])?
            .into_iter()
            .next()
            .unwrap_or_default())
    }

    fn embed_openai_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        let endpoint = if self.settings.endpoint.trim().is_empty() {
            "https://api.openai.com/v1/embeddings".to_string()
        } else {
            self.settings.endpoint.clone()
        };
        let body = serde_json::json!({
            "model": self.settings.model,
            "input": texts
        });
        let value: serde_json::Value = self
            .client
            .post(endpoint)
            .bearer_auth(self.settings.api_key.as_deref().unwrap_or(""))
            .json(&body)
            .send()
            .map_err(describe_http_transport_error)?
            .error_for_status()
            .map_err(describe_http_status_error)?
            .json()
            .map_err(|error| error.to_string())?;
        parse_embedding_objects(&value["data"])
    }

    fn embed_ollama(&self, text: &str) -> Result<Vec<f32>, String> {
        Ok(self
            .embed_ollama_batch(&[text.to_string()])?
            .into_iter()
            .next()
            .unwrap_or_default())
    }

    fn embed_ollama_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        let endpoint = if self.settings.endpoint.trim().is_empty() {
            "http://localhost:11434/api/embed".to_string()
        } else {
            self.settings.endpoint.clone()
        };
        let body = serde_json::json!({
            "model": self.settings.model,
            "input": texts
        });
        let value: serde_json::Value = self.post_json(&endpoint, body)?;
        if value["embeddings"].is_array() {
            parse_embedding_matrix(&value["embeddings"])
        } else {
            Ok(vec![parse_number_array(&value["embedding"])?])
        }
    }

    fn post_json(&self, endpoint: &str, body: serde_json::Value) -> Result<serde_json::Value, String> {
        let mut request = self.client.post(endpoint).json(&body);
        if !matches!(self.settings.provider, AiProviderKind::GoogleGemini | AiProviderKind::Ollama) {
            request = request.bearer_auth(self.settings.api_key.as_deref().unwrap_or(""));
        }
        request
            .send()
            .map_err(describe_http_transport_error)?
            .error_for_status()
            .map_err(describe_http_status_error)?
            .json()
            .map_err(|error| error.to_string())
    }
}

fn parse_number_array(value: &serde_json::Value) -> Result<Vec<f32>, String> {
    let array = value.as_array().ok_or_else(|| "Embedding response did not contain a vector.".to_string())?;
    let vector: Vec<f32> = array
        .iter()
        .filter_map(|item| item.as_f64().map(|value| value as f32))
        .collect();
    if vector.is_empty() {
        Err("Embedding vector was empty.".to_string())
    } else {
        Ok(vector)
    }
}

fn parse_embedding_matrix(value: &serde_json::Value) -> Result<Vec<Vec<f32>>, String> {
    let rows = value
        .as_array()
        .ok_or_else(|| "Embedding response did not contain a vector matrix.".to_string())?;
    rows.iter().map(parse_number_array).collect()
}

fn parse_embedding_objects(value: &serde_json::Value) -> Result<Vec<Vec<f32>>, String> {
    let rows = value
        .as_array()
        .ok_or_else(|| "Embedding response did not contain embedding objects.".to_string())?;
    rows.iter()
        .map(|row| parse_number_array(&row["embedding"]))
        .collect()
}

fn describe_http_transport_error(error: reqwest::Error) -> String {
    if error.is_timeout() {
        return "Provider request timed out.".to_string();
    }
    if error.is_connect() {
        return "Provider endpoint could not be reached.".to_string();
    }
    error.to_string()
}

fn describe_http_status_error(error: reqwest::Error) -> String {
    match error.status().map(|status| status.as_u16()) {
        Some(401) | Some(403) => "Provider rejected the API key or permissions.".to_string(),
        Some(404) => "Provider endpoint or model was not found.".to_string(),
        Some(429) => "Provider rate limit reached.".to_string(),
        Some(500..=599) => "Provider service failed. Try again later.".to_string(),
        _ => error.to_string(),
    }
}

fn hash_embedding(text: &str, dimensions: usize) -> Vec<f32> {
    let mut vector = vec![0.0; dimensions];
    for token in text.split(|char: char| !char.is_alphanumeric()).filter(|token| !token.is_empty()) {
        let mut hash: usize = 0;
        for byte in token.to_ascii_lowercase().bytes() {
            hash = hash.wrapping_mul(31).wrapping_add(byte as usize);
        }
        vector[hash % dimensions] += 1.0;
    }
    normalize(vector)
}

fn normalize(mut vector: Vec<f32>) -> Vec<f32> {
    let length = vector.iter().map(|value| value * value).sum::<f32>().sqrt();
    if length > 0.0 {
        for value in &mut vector {
            *value /= length;
        }
    }
    vector
}

fn cosine_similarity(left: &[f32], right: &[f32]) -> f32 {
    left.iter().zip(right.iter()).map(|(left, right)| left * right).sum()
}

fn vector_to_blob(vector: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(vector.len() * std::mem::size_of::<f32>());
    for value in vector {
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    bytes
}

fn lexical_boost(query: &str, text: &str) -> f32 {
    let haystack = text.to_ascii_lowercase();
    query
        .split_whitespace()
        .filter(|token| haystack.contains(&token.to_ascii_lowercase()))
        .count() as f32
        * 0.05
}

fn file_to_result(file: &IndexedFile, snippet: &str) -> SearchResultDto {
    SearchResultDto {
        id: file.id.clone(),
        rank: 0,
        file_path: file.path.clone(),
        display_name: file.display_name.clone(),
        file_type: file.file_type.clone(),
        modified_at: file.modified_at.clone(),
        size_bytes: file.size_bytes,
        match_context: Some(MatchContext::Snippet {
            text: snippet.chars().take(220).collect(),
        }),
        availability_hint: match &file.extraction_status {
            ExtractionStatus::Ready => None,
            ExtractionStatus::OcrUnavailable => Some(AvailabilityHint::Partial { reason: "visualLimited".to_string() }),
            ExtractionStatus::ExtractionFailed { .. } => Some(AvailabilityHint::Partial { reason: "contentLimited".to_string() }),
        },
        actions: SearchActions {
            can_open: true,
            can_reveal: true,
        },
    }
}

fn not_ready(reason: &str) -> SearchFilesResponse {
    SearchFilesResponse {
        results: Vec::new(),
        readiness: SearchReadiness::NotReady {
            reason: reason.to_string(),
        },
    }
}

fn to_index_status(store: &AppStore) -> IndexStatus {
    let state = if store.indexed_folders.is_empty() {
        IndexState::NotConfigured
    } else {
        store.index_state.clone()
    };
    let message = match state {
        IndexState::NotConfigured => "Add a folder and configure an embedding provider.".to_string(),
        IndexState::Ready => "Index ready.".to_string(),
        IndexState::Indexing => "Indexing files.".to_string(),
        IndexState::Stale => "Index needs rebuild.".to_string(),
        IndexState::Failed => store.last_error.clone().unwrap_or_else(|| "Indexing failed.".to_string()),
    };
    IndexStatus {
        state,
        indexed_folders: store.indexed_folders.clone(),
        indexed_file_count: store.files.len(),
        indexed_chunk_count: store.chunks.len(),
        last_error: store.last_error.clone(),
        message,
    }
}

fn to_public_settings(settings: &AiSettings) -> PublicAiSettings {
    PublicAiSettings {
        provider: settings.provider.clone(),
        endpoint: settings.endpoint.clone(),
        model: settings.model.clone(),
        embedding_dimension: settings.embedding_dimension,
        has_api_key: settings.api_key.as_deref().is_some_and(|value| !value.is_empty()),
        api_key_mask: settings.api_key.as_deref().filter(|value| !value.is_empty()).map(mask_secret),
    }
}

fn mask_secret(secret: &str) -> String {
    if secret.len() <= 8 {
        return "••••".to_string();
    }
    format!("{}••••{}", &secret[..4], &secret[secret.len() - 4..])
}

fn load_store(state: &tauri::State<SearchEngineState>) -> AppStore {
    let _guard = state.db_lock.lock().expect("search store mutex poisoned");
    load_store_from_sqlite().unwrap_or_default()
}

fn replace_store(state: &tauri::State<SearchEngineState>, store: AppStore) {
    let _guard = state.db_lock.lock().expect("search store mutex poisoned");
    persist_store(&store).ok();
}

fn persist_store(store: &AppStore) -> io::Result<()> {
    persist_store_to_sqlite(store).map_err(io::Error::other)
}

fn open_db() -> Result<Connection, String> {
    SQLITE_VEC_INIT.call_once(|| unsafe {
        sqlite3_auto_extension(Some(std::mem::transmute(sqlite3_vec_init as *const ())));
    });
    let path = db_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    migrate_db(&connection)?;
    Ok(connection)
}

fn migrate_db(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS ai_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                provider TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                model TEXT NOT NULL,
                embedding_dimension INTEGER NOT NULL,
                api_key TEXT
            );
            CREATE TABLE IF NOT EXISTS index_meta (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                state TEXT NOT NULL,
                active_embedding_signature TEXT,
                last_error TEXT
            );
            CREATE TABLE IF NOT EXISTS indexed_roots (
                path TEXT PRIMARY KEY
            );
            CREATE TABLE IF NOT EXISTS indexed_files (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL,
                display_name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                modified_at TEXT,
                modified_key INTEGER NOT NULL,
                size_bytes INTEGER,
                extraction_status_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS indexed_chunks (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                text TEXT NOT NULL,
                embedding_json TEXT NOT NULL,
                FOREIGN KEY(file_id) REFERENCES indexed_files(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_indexed_chunks_file_id ON indexed_chunks(file_id);
            ",
        )
        .map_err(|error| error.to_string())
}

fn load_store_from_sqlite() -> Result<AppStore, String> {
    let connection = open_db()?;
    let mut store = AppStore::default();

    if let Ok(settings) = connection.query_row(
        "SELECT provider, endpoint, model, embedding_dimension, api_key FROM ai_settings WHERE id = 1",
        [],
        |row| {
            Ok(AiSettings {
                provider: parse_provider(row.get::<_, String>(0)?.as_str()),
                endpoint: row.get(1)?,
                model: row.get(2)?,
                embedding_dimension: row.get::<_, i64>(3)? as usize,
                api_key: row.get(4)?,
            })
        },
    ) {
        store.ai = settings;
    }

    if let Ok((state, signature, last_error)) = connection.query_row(
        "SELECT state, active_embedding_signature, last_error FROM index_meta WHERE id = 1",
        [],
        |row| Ok((row.get::<_, String>(0)?, row.get(1)?, row.get(2)?)),
    ) {
        store.index_state = parse_index_state(&state);
        store.active_embedding_signature = signature;
        store.last_error = last_error;
    }

    store.indexed_folders = query_strings(&connection, "SELECT path FROM indexed_roots ORDER BY path")?;
    store.files = query_files(&connection)?;
    store.chunks = query_chunks(&connection)?;
    Ok(store)
}

fn persist_store_to_sqlite(store: &AppStore) -> Result<(), String> {
    let mut connection = open_db()?;
    rebuild_vec_table(&connection, store.ai.embedding_dimension)?;
    let tx = connection.transaction().map_err(|error| error.to_string())?;
    tx.execute(
        "INSERT INTO ai_settings (id, provider, endpoint, model, embedding_dimension, api_key)
         VALUES (1, ?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
            provider = excluded.provider,
            endpoint = excluded.endpoint,
            model = excluded.model,
            embedding_dimension = excluded.embedding_dimension,
            api_key = excluded.api_key",
        params![
            provider_to_str(&store.ai.provider),
            store.ai.endpoint,
            store.ai.model,
            store.ai.embedding_dimension as i64,
            store.ai.api_key
        ],
    )
    .map_err(|error| error.to_string())?;
    tx.execute(
        "INSERT INTO index_meta (id, state, active_embedding_signature, last_error)
         VALUES (1, ?1, ?2, ?3)
         ON CONFLICT(id) DO UPDATE SET
            state = excluded.state,
            active_embedding_signature = excluded.active_embedding_signature,
            last_error = excluded.last_error",
        params![
            index_state_to_str(&store.index_state),
            store.active_embedding_signature,
            store.last_error
        ],
    )
    .map_err(|error| error.to_string())?;

    tx.execute("DELETE FROM indexed_roots", []).map_err(|error| error.to_string())?;
    for folder in &store.indexed_folders {
        tx.execute("INSERT INTO indexed_roots (path) VALUES (?1)", params![folder])
            .map_err(|error| error.to_string())?;
    }

    tx.execute("DELETE FROM indexed_chunks", []).map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM indexed_files", []).map_err(|error| error.to_string())?;
    for file in &store.files {
        tx.execute(
            "INSERT INTO indexed_files
             (id, path, display_name, file_type, modified_at, modified_key, size_bytes, extraction_status_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                file.id,
                file.path,
                file.display_name,
                file.file_type,
                file.modified_at,
                file.modified_key as i64,
                file.size_bytes.map(|value| value as i64),
                serde_json::to_string(&file.extraction_status).map_err(|error| error.to_string())?
            ],
        )
        .map_err(|error| error.to_string())?;
    }
    for chunk in &store.chunks {
        tx.execute(
            "INSERT INTO indexed_chunks (id, file_id, text, embedding_json) VALUES (?1, ?2, ?3, ?4)",
            params![
                chunk.id,
                chunk.file_id,
                chunk.text,
                serde_json::to_string(&chunk.embedding).map_err(|error| error.to_string())?
            ],
        )
        .map_err(|error| error.to_string())?;
        tx.execute(
            "INSERT INTO vec_chunks (chunk_id, embedding) VALUES (?1, ?2)",
            params![chunk.id, vector_to_blob(&chunk.embedding)],
        )
        .map_err(|error| error.to_string())?;
    }
    tx.commit().map_err(|error| error.to_string())
}

fn rebuild_vec_table(connection: &Connection, dimensions: usize) -> Result<(), String> {
    connection
        .execute("DROP TABLE IF EXISTS vec_chunks", [])
        .map_err(|error| error.to_string())?;
    let dimensions = dimensions.max(1);
    connection
        .execute(
            &format!(
                "CREATE VIRTUAL TABLE vec_chunks USING vec0(chunk_id TEXT, embedding FLOAT[{dimensions}])"
            ),
            [],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn query_strings(connection: &Connection, sql: &str) -> Result<Vec<String>, String> {
    let mut statement = connection.prepare(sql).map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn query_files(connection: &Connection) -> Result<Vec<IndexedFile>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, path, display_name, file_type, modified_at, modified_key, size_bytes, extraction_status_json
             FROM indexed_files ORDER BY path",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let status_json: String = row.get(7)?;
            Ok(IndexedFile {
                id: row.get(0)?,
                path: row.get(1)?,
                display_name: row.get(2)?,
                file_type: row.get(3)?,
                modified_at: row.get(4)?,
                modified_key: row.get::<_, i64>(5)? as u64,
                size_bytes: row.get::<_, Option<i64>>(6)?.map(|value| value as u64),
                extraction_status: serde_json::from_str(&status_json).unwrap_or_else(|_| {
                    ExtractionStatus::ExtractionFailed {
                        message: "Stored extraction status was invalid.".to_string(),
                    }
                }),
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn query_chunks(connection: &Connection) -> Result<Vec<IndexedChunk>, String> {
    let mut statement = connection
        .prepare("SELECT id, file_id, text, embedding_json FROM indexed_chunks ORDER BY id")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let embedding_json: String = row.get(3)?;
            Ok(IndexedChunk {
                id: row.get(0)?,
                file_id: row.get(1)?,
                text: row.get(2)?,
                embedding: serde_json::from_str(&embedding_json).unwrap_or_default(),
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn parse_provider(value: &str) -> AiProviderKind {
    match value {
        "huggingFace" => AiProviderKind::HuggingFace,
        "openAiCompatible" => AiProviderKind::OpenAiCompatible,
        "ollama" => AiProviderKind::Ollama,
        "localPlaceholder" => AiProviderKind::LocalPlaceholder,
        _ => AiProviderKind::GoogleGemini,
    }
}

fn provider_to_str(provider: &AiProviderKind) -> &'static str {
    match provider {
        AiProviderKind::GoogleGemini => "googleGemini",
        AiProviderKind::HuggingFace => "huggingFace",
        AiProviderKind::OpenAiCompatible => "openAiCompatible",
        AiProviderKind::Ollama => "ollama",
        AiProviderKind::LocalPlaceholder => "localPlaceholder",
    }
}

fn parse_index_state(value: &str) -> IndexState {
    match value {
        "ready" => IndexState::Ready,
        "indexing" => IndexState::Indexing,
        "stale" => IndexState::Stale,
        "failed" => IndexState::Failed,
        _ => IndexState::NotConfigured,
    }
}

fn index_state_to_str(state: &IndexState) -> &'static str {
    match state {
        IndexState::NotConfigured => "notConfigured",
        IndexState::Ready => "ready",
        IndexState::Indexing => "indexing",
        IndexState::Stale => "stale",
        IndexState::Failed => "failed",
    }
}

fn db_path() -> PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        return PathBuf::from(appdata).join("Browhere").join("browhere.sqlite3");
    }
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join(".browhere").join("browhere.sqlite3");
    }
    PathBuf::from(".browhere").join("browhere.sqlite3")
}

fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
}

fn stable_id(value: &str) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(value)
}

fn embedding_signature(settings: &AiSettings) -> String {
    format!("{:?}:{}:{}:{}", settings.provider, settings.endpoint, settings.model, settings.embedding_dimension)
}

fn system_time_to_secs(time: SystemTime) -> Option<u64> {
    time.duration_since(UNIX_EPOCH).ok().map(|duration| duration.as_secs())
}
