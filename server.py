"""Local, dependency-free backend for the MemoryVerse AI hackathon prototype.

Run with: python server.py
Then open: http://localhost:8080
"""

from __future__ import annotations

import json
import re
import shutil
import uuid
import zipfile
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
DOCUMENTS_FILE = DATA_DIR / "documents.json"

CATEGORY_KEYWORDS = {
    "Certification": ["certificate", "certification", "course", "badge"],
    "Internship": ["internship", "intern", "offer letter", "training"],
    "Project": ["project", "portfolio", "report", "application", "system"],
    "Achievement": ["award", "achievement", "lead", "winner", "club"],
    "Academic": ["resume", "cv", "mark", "transcript", "degree", "academic"],
}
SKILL_KEYWORDS = {
    "Python": ["python", "pandas", "numpy", "django", "flask"],
    "Machine Learning": ["machine learning", " ml ", "model", "classification", "prediction"],
    "Data Analysis": ["data analysis", "analytics", "tableau", "power bi"],
    "Computer Vision": ["computer vision", "image", "opencv", "detection"],
    "TensorFlow": ["tensorflow", "keras"],
    "SQL": ["sql", "database"],
    "React": ["react", "frontend", "javascript"],
    "RAG": ["rag", "retrieval augmented", "vector database", "embeddings"],
    "Semantic Search": ["semantic search", "similarity", "chromadb", "vector search"],
    "Leadership": ["leadership", "lead", "managed", "club"],
}


def initialise_storage() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    UPLOADS_DIR.mkdir(exist_ok=True)
    if not DOCUMENTS_FILE.exists():
        DOCUMENTS_FILE.write_text("[]", encoding="utf-8")


def load_documents() -> list[dict]:
    initialise_storage()
    try:
        return json.loads(DOCUMENTS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def save_documents(documents: list[dict]) -> None:
    initialise_storage()
    DOCUMENTS_FILE.write_text(json.dumps(documents, indent=2), encoding="utf-8")


def extract_text(path: Path) -> str:
    """Read common local document formats without third-party packages."""
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md", ".csv"}:
        return path.read_text(encoding="utf-8", errors="ignore")
    if suffix == ".docx":
        try:
            with zipfile.ZipFile(path) as archive:
                xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
            return re.sub(r"<[^>]+>", " ", xml).replace("&amp;", "&")
        except (KeyError, OSError, zipfile.BadZipFile):
            return ""
    if suffix == ".pdf":
        raw = path.read_bytes()
        # PDF text is often compressed; this safe fallback still indexes visible strings.
        fragments = re.findall(rb"[\x20-\x7e]{4,}", raw)
        return " ".join(fragment.decode("latin-1", errors="ignore") for fragment in fragments)
    return ""


def infer_record(filename: str, content: str, file_id: str) -> dict:
    clean_name = Path(filename).stem.replace("_", " ").replace("-", " ")
    searchable = f"{clean_name} {content}".lower()
    category = max(
        CATEGORY_KEYWORDS,
        key=lambda name: sum(searchable.count(keyword) for keyword in CATEGORY_KEYWORDS[name]),
    )
    if not any(keyword in searchable for keywords in CATEGORY_KEYWORDS.values() for keyword in keywords):
        category = "Academic"
    skills = [
        skill
        for skill, keywords in SKILL_KEYWORDS.items()
        if any(keyword in searchable for keyword in keywords)
    ]
    year_match = re.search(r"\b20(?:1\d|2\d|3\d)\b", searchable)
    year = int(year_match.group()) if year_match else datetime.now().year
    summary = " ".join(content.split())[:280]
    return {
        "id": file_id,
        "title": clean_name[:100] or "Untitled memory",
        "category": category,
        "year": year,
        "organisation": "Uploaded evidence",
        "skills": skills or ["New evidence"],
        "summary": summary or f"Locally indexed from {filename}.",
        "type": Path(filename).suffix.lstrip(".").upper() or "FILE",
        "filename": filename,
        "sourceUrl": f"/api/files/{file_id}",
        "createdAt": datetime.now().isoformat(timespec="seconds"),
    }


def query_documents(documents: list[dict], query: str) -> list[dict]:
    query_lower = query.lower()
    query_tokens = set(re.findall(r"[a-z0-9+#]+", query_lower))
    ranked = []
    for document in documents:
        haystack = " ".join(
            [document["title"], document["category"], document["organisation"], *document["skills"], document["summary"]]
        ).lower()
        score = sum(3 for token in query_tokens if token in haystack)
        if any(keyword in query_lower for keyword in CATEGORY_KEYWORDS.get(document["category"], [])):
            score += 18
        if any(skill.lower() in query_lower for skill in document["skills"]):
            score += 15
        if score:
            ranked.append({"document": document, "score": score})
    return [item["document"] for item in sorted(ranked, key=lambda item: item["score"], reverse=True)[:6]]


class MemoryVerseHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def json_response(self, payload: object, status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/health":
            self.json_response({"status": "ok", "storage": "local"})
            return
        if path == "/api/documents":
            self.json_response({"documents": load_documents()})
            return
        if path.startswith("/api/files/"):
            requested_id = path.rsplit("/", 1)[-1]
            document = next((item for item in load_documents() if item["id"] == requested_id), None)
            if not document:
                self.send_error(HTTPStatus.NOT_FOUND, "Original file not found")
                return
            file_path = UPLOADS_DIR / f"{requested_id}{Path(document['filename']).suffix}"
            if not file_path.exists():
                self.send_error(HTTPStatus.NOT_FOUND, "Original file not found")
                return
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Disposition", f"attachment; filename=\"{document['filename']}\"")
            self.send_header("Content-Length", str(file_path.stat().st_size))
            self.end_headers()
            with file_path.open("rb") as source:
                shutil.copyfileobj(source, self.wfile)
            return
        super().do_GET()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/search":
            length = int(self.headers.get("Content-Length", "0"))
            try:
                payload = json.loads(self.rfile.read(length))
                query = str(payload.get("query", "")).strip()
            except (json.JSONDecodeError, ValueError):
                self.json_response({"error": "Invalid JSON body"}, HTTPStatus.BAD_REQUEST)
                return
            self.json_response({"results": query_documents(load_documents(), query)})
            return
        if path == "/api/upload":
            self.handle_upload()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Unknown API endpoint")

    def handle_upload(self) -> None:
        content_type = self.headers.get("Content-Type", "")
        boundary_match = re.search(r"boundary=([^;]+)", content_type)
        if not boundary_match:
            self.json_response({"error": "Expected multipart form data"}, HTTPStatus.BAD_REQUEST)
            return
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        boundary = b"--" + boundary_match.group(1).strip('"').encode()
        filename_match = re.search(br'filename="([^"\\/]+)"', raw)
        if not filename_match:
            self.json_response({"error": "No file supplied"}, HTTPStatus.BAD_REQUEST)
            return
        filename = unquote(filename_match.group(1).decode("utf-8", errors="ignore"))
        header_end = raw.find(b"\r\n\r\n")
        content_end = raw.rfind(boundary)
        if header_end < 0 or content_end < 0:
            self.json_response({"error": "Malformed upload"}, HTTPStatus.BAD_REQUEST)
            return
        file_content = raw[header_end + 4 : content_end].rstrip(b"\r\n")
        if not file_content:
            self.json_response({"error": "Uploaded file is empty"}, HTTPStatus.BAD_REQUEST)
            return
        if len(file_content) > 10 * 1024 * 1024:
            self.json_response({"error": "Maximum upload size is 10 MB"}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
            return
        file_id = uuid.uuid4().hex
        destination = UPLOADS_DIR / f"{file_id}{Path(filename).suffix.lower()}"
        destination.write_bytes(file_content)
        record = infer_record(filename, extract_text(destination), file_id)
        documents = load_documents()
        documents.append(record)
        save_documents(documents)
        self.json_response({"document": record}, HTTPStatus.CREATED)


if __name__ == "__main__":
    initialise_storage()
    server = ThreadingHTTPServer(("127.0.0.1", 8080), MemoryVerseHandler)
    print("MemoryVerse running at http://localhost:8080")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nMemoryVerse stopped.")
    finally:
        server.server_close()
