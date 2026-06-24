#!/usr/bin/env python3
"""本地开发服务器：静态文件 + 案例数据保存、图片上传与 AI 文案生成 API。"""

from __future__ import annotations

import base64
import json
import os
import re
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROJECTS_PATH = ROOT / "data" / "projects.json"
UPLOAD_DIR = ROOT / "public" / "images"
ALLOWED_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic", ".heif"}
PORT = 8765
HOST = "127.0.0.1"
CARD_TITLES = ["Project Background", "Design Goal", "Process", "Output"]
CARD_FOCUS = [
    "项目背景：题材、品牌/活动语境、创作出发点",
    "设计目标：视觉风格、传播诉求、想达成的效果",
    "制作流程：AIGC / 拍摄 / 剪辑 / 调色等关键步骤",
    "交付成果：成片规格、版本形态、使用场景",
]
ZHIPU_CHAT_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
ENV_CANDIDATES = [
    ROOT / ".env.local",
    ROOT.parent / "智谱图片生成器" / ".env.local",
    ROOT.parent / "AI-chat" / ".env.local",
]
MAX_VISION_IMAGES = 5
MAX_IMAGE_BYTES = 5 * 1024 * 1024


def project_prefix(project_id: str) -> str:
    match = re.match(r"^p(\d+)$", project_id.strip().lower())
    if not match:
        raise ValueError("invalid projectId")
    return f"project-{match.group(1)}"


def resolve_upload_path(project_id: str, upload_type: str, index: str, ext: str) -> Path:
    prefix = project_prefix(project_id)
    if upload_type == "cover":
        name = f"{prefix}-cover{ext}"
    elif upload_type == "video-poster":
        name = f"{prefix}-video-poster{ext}"
    elif upload_type == "gallery":
        slot = re.sub(r"\D", "", index or "1") or "1"
        name = f"{prefix}-still-{slot.zfill(2)}{ext}"
    else:
        raise ValueError("invalid upload type")
    return UPLOAD_DIR / name


def cleanup_stale_upload_siblings(dest: Path) -> None:
    """上传新扩展名时删除同资源旧文件，避免 JSON 仍指向 .png 但磁盘只有 .jpg。"""
    stem = dest.stem
    parent = dest.parent
    for old in parent.glob(stem + ".*"):
        if old != dest and old.is_file():
            old.unlink(missing_ok=True)


def parse_multipart_form(body: bytes, content_type: str) -> dict[str, str | tuple[str, bytes]]:
    match = re.search(r"boundary=([^;]+)", content_type, re.I)
    if not match:
        raise ValueError("missing multipart boundary")

    boundary = match.group(1).strip().strip('"')
    delimiter = ("--" + boundary).encode()
    fields: dict[str, str | tuple[str, bytes]] = {}

    for part in body.split(delimiter):
        chunk = part.strip(b"\r\n")
        if not chunk or chunk == b"--":
            continue

        header_block, _, content = chunk.partition(b"\r\n\r\n")
        if not header_block:
            continue

        headers = header_block.decode("utf-8", errors="replace")
        name_match = re.search(r'name="([^"]+)"', headers)
        if not name_match:
            continue

        name = name_match.group(1)
        filename_match = re.search(r'filename="([^"]*)"', headers)
        if filename_match and filename_match.group(1):
            fields[name] = (filename_match.group(1), content.rstrip(b"\r\n"))
        else:
            fields[name] = content.decode("utf-8", errors="replace").strip()

    return fields


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def load_ai_config() -> dict[str, str]:
    api_key = os.environ.get("ZHIPU_API_KEY", "").strip()
    vision_model = os.environ.get("ZHIPU_VISION_MODEL", "glm-4.6v").strip() or "glm-4.6v"
    text_model = os.environ.get("ZHIPU_TEXT_MODEL", "glm-4-flash").strip() or "glm-4-flash"

    for env_path in ENV_CANDIDATES:
        env = parse_env_file(env_path)
        if not api_key:
            api_key = env.get("ZHIPU_API_KEY", "") or env.get("VITE_ZHIPU_API_KEY", "")
            api_key = api_key.strip()
        if env.get("ZHIPU_VISION_MODEL"):
            vision_model = env["ZHIPU_VISION_MODEL"].strip()
        if env.get("ZHIPU_TEXT_MODEL"):
            text_model = env["ZHIPU_TEXT_MODEL"].strip()

    return {
        "api_key": api_key,
        "vision_model": vision_model,
        "text_model": text_model,
    }


def resolve_local_image(rel_path: str) -> Path | None:
    value = str(rel_path or "").strip().replace("\\", "/")
    if not value or value.startswith(("http://", "https://", "data:")):
        return None
    candidate = (ROOT / value).resolve()
    try:
        candidate.relative_to(ROOT.resolve())
    except ValueError:
        return None
    if not candidate.is_file() or candidate.suffix.lower() not in ALLOWED_IMAGE_EXT:
        return None
    if candidate.stat().st_size > MAX_IMAGE_BYTES:
        return None
    return candidate


def image_to_content_block(path: Path) -> dict | None:
    ext = path.suffix.lower()
    mime = {
        ".jpg": "jpeg",
        ".jpeg": "jpeg",
        ".png": "png",
        ".webp": "webp",
        ".gif": "gif",
    }.get(ext, "jpeg")
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return {
        "type": "image_url",
        "image_url": {"url": f"data:image/{mime};base64,{encoded}"},
    }


def extract_json_object(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        raise ValueError("AI 返回内容无法解析为 JSON")
    return json.loads(match.group(0))


def clamp_body(text: str, max_len: int = 60) -> str:
    value = re.sub(r"\s+", " ", str(text or "").strip())
    if len(value) <= max_len:
        return value
    cut = value[:max_len]
    for sep in "，。；、 ":
        idx = cut.rfind(sep)
        if idx >= max(18, max_len // 2):
            return cut[:idx].strip("，。；、 ")
    return cut.strip()


def clamp_intro(text: str, min_len: int = 90, max_len: int = 100) -> str:
    value = re.sub(r"\s+", " ", str(text or "").strip())
    if len(value) > max_len:
        value = clamp_body(value, max_len)
    return value


def collect_image_paths(payload: dict) -> list[Path]:
    image_paths: list[Path] = []
    seen: set[str] = set()
    for rel in payload.get("images") or []:
        path = resolve_local_image(str(rel))
        if not path:
            continue
        key = str(path.resolve())
        if key in seen:
            continue
        seen.add(key)
        image_paths.append(path)
        if len(image_paths) >= MAX_VISION_IMAGES:
            break
    return image_paths


def build_single_brief_prompt(payload: dict, image_count: int) -> str:
    title = str(payload.get("title") or "").strip()
    title_en = str(payload.get("titleEn") or "").strip()
    intro = str(payload.get("intro") or "").strip()
    desc = str(payload.get("desc") or "").strip()
    hint = str(payload.get("hint") or "").strip()
    tags = payload.get("tags") or []
    meta = payload.get("meta") or []
    category = str(payload.get("category") or "").strip()

    card_index = int(payload.get("cardIndex", 0))
    card_index = max(0, min(card_index, len(CARD_TITLES) - 1))
    card_title = str(payload.get("cardTitle") or CARD_TITLES[card_index]).strip() or CARD_TITLES[card_index]
    card_focus = CARD_FOCUS[card_index]

    meta_lines = []
    for item in meta:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or "").strip()
        value = str(item.get("value") or "").strip()
        if label or value:
            meta_lines.append(f"- {label}: {value}")

    tag_text = "、".join(str(t).strip() for t in tags if str(t).strip())
    meta_text = "\n".join(meta_lines) if meta_lines else "（无）"
    image_hint = (
        f"已附带 {image_count} 张剧照/封面，请结合画面风格与镜头语言撰写。"
        if image_count
        else "未附带剧照，请依据文字主题撰写，语气专业具体。"
    )
    hint_block = f"用户提示：{hint}" if hint else "用户提示：（无，请根据项目信息与栏目定位自行发挥）"

    return f"""你是一位 AIGC 视频作品集文案编辑。请为案例详情页的单个栏目撰写中文正文。

项目主题：{title}
副标题：{title_en or desc}
分类：{category or "未分类"}
标签：{tag_text or "无"}
项目简介：{intro or desc or "（暂无）"}
Meta 信息：
{meta_text}

当前栏目：{card_title}
栏目定位：{card_focus}
{hint_block}

{image_hint}

写作要求：
1. 严格输出 JSON，不要 Markdown，不要额外解释。
2. 只写当前栏目的 body，title 保持为 "{card_title}"。
3. body 必须为中文，不超过 60 个汉字（含标点），1-2 句，信息密度高，适合小卡片展示。
4. 必须体现用户提示（若有）；文案具体专业，不要编造无法推断的客户数据。

输出格式：
{{"title":"{card_title}","body":"..."}}"""


def build_brief_prompt(payload: dict, image_count: int) -> str:
    title = str(payload.get("title") or "").strip()
    title_en = str(payload.get("titleEn") or "").strip()
    intro = str(payload.get("intro") or "").strip()
    desc = str(payload.get("desc") or "").strip()
    tags = payload.get("tags") or []
    meta = payload.get("meta") or []
    category = str(payload.get("category") or "").strip()

    meta_lines = []
    for item in meta:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or "").strip()
        value = str(item.get("value") or "").strip()
        if label or value:
            meta_lines.append(f"- {label}: {value}")

    tag_text = "、".join(str(t).strip() for t in tags if str(t).strip())
    meta_text = "\n".join(meta_lines) if meta_lines else "（无）"
    image_hint = (
        f"已附带 {image_count} 张剧照/封面，请结合画面风格、镜头语言与视觉元素撰写。"
        if image_count
        else "未附带剧照，请主要依据文字主题撰写，语气仍需专业具体。"
    )

    return f"""你是一位 AIGC 视频作品集文案编辑。请根据以下项目信息与剧照，为案例详情页撰写四栏英文标题 + 中文正文。

项目主题：{title}
副标题：{title_en or desc}
分类：{category or "未分类"}
标签：{tag_text or "无"}
项目简介：{intro or desc or "（暂无）"}
Meta 信息：
{meta_text}

{image_hint}

写作要求：
1. 严格输出 JSON，不要 Markdown，不要额外解释。
2. cards 数组固定 4 项，title 必须依次为：Project Background、Design Goal、Process、Output。
3. 每项 body 为中文，55-90 个汉字，2-3 句，信息密度高，适合填满小卡片区域。
4. 文案需像真实商业/AIGC 项目说明：具体、专业，可提及镜头、节奏、风格、平台或交付形态，但不要编造无法从信息推断的具体客户数据。
5. 四栏内容不要重复，分别侧重：背景/context、目标/goal、制作流程/process、交付/output。

输出格式：
{{"cards":[{{"title":"Project Background","body":"..."}},{{"title":"Design Goal","body":"..."}},{{"title":"Process","body":"..."}},{{"title":"Output","body":"..."}}]}}"""


def normalize_cards(raw_cards: list) -> list[dict[str, str]]:
    cards: list[dict[str, str]] = []
    for index, fallback_title in enumerate(CARD_TITLES):
        item = raw_cards[index] if index < len(raw_cards) and isinstance(raw_cards[index], dict) else {}
        title = str(item.get("title") or fallback_title).strip() or fallback_title
        body = str(item.get("body") or "").strip()
        cards.append({"title": title, "body": body})
    return cards


def zhipu_chat(api_key: str, model: str, messages: list) -> str:
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.75,
        "max_tokens": 1800,
    }
    req = urllib.request.Request(
        ZHIPU_CHAT_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise ValueError(f"智谱 API 错误 ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise ValueError(f"无法连接智谱 API: {exc.reason}") from exc

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("智谱 API 返回格式异常") from exc


def generate_brief_card(payload: dict) -> dict[str, str]:
    config = load_ai_config()
    if not config["api_key"]:
        raise ValueError(
            "未配置 ZHIPU_API_KEY。请在 personal-website/.env.local 填写智谱 API Key（可参考 .env.example）。"
        )

    card_index = int(payload.get("cardIndex", 0))
    card_index = max(0, min(card_index, len(CARD_TITLES) - 1))
    fallback_title = str(payload.get("cardTitle") or CARD_TITLES[card_index]).strip() or CARD_TITLES[card_index]

    image_paths = collect_image_paths(payload)
    prompt = build_single_brief_prompt(payload, len(image_paths))
    user_content: list | str
    if image_paths:
        user_content = [{"type": "text", "text": prompt}]
        for path in image_paths:
            block = image_to_content_block(path)
            if block:
                user_content.append(block)
        model = config["vision_model"]
    else:
        user_content = prompt
        model = config["text_model"]

    content = zhipu_chat(
        config["api_key"],
        model,
        [
            {
                "role": "system",
                "content": "你是资深 AIGC 视频项目文案编辑，只输出合法 JSON。",
            },
            {"role": "user", "content": user_content},
        ],
    )
    parsed = extract_json_object(content)
    title = str(parsed.get("title") or fallback_title).strip() or fallback_title
    body = clamp_body(parsed.get("body") or "", 60)
    if not body:
        raise ValueError("AI 未返回有效正文")
    return {"title": title, "body": body}


def build_intro_prompt(payload: dict) -> str:
    title = str(payload.get("title") or "").strip()
    title_en = str(payload.get("titleEn") or "").strip()
    hint = str(payload.get("hint") or "").strip()
    cards = payload.get("cards") or []

    card_lines = []
    for index, card in enumerate(cards[:4]):
        if not isinstance(card, dict):
            continue
        card_title = str(card.get("title") or CARD_TITLES[index]).strip() or CARD_TITLES[index]
        body = str(card.get("body") or "").strip()
        if body:
            card_lines.append(f"- {card_title}：{body}")

    cards_text = "\n".join(card_lines) if card_lines else "（四栏正文均为空，请根据标题与提示撰写）"
    hint_block = f"用户提示：{hint}" if hint else "用户提示：（无，请综合四栏内容自行归纳）"

    return f"""你是一位 AIGC 视频作品集文案编辑。请根据下方四栏要点，撰写案例详情页的「项目简介」。

视频大标题：{title}
副标题：{title_en or "（无）"}
{hint_block}

四栏要点：
{cards_text}

写作要求：
1. 严格输出 JSON，不要 Markdown，不要额外解释。
2. intro 为中文项目简介，字数硬性要求：90-100 个汉字（含标点），少于 90 字视为失败；写 2-3 句完整段落。
3. 综合四栏信息，形成连贯概述：项目是什么、风格/目标、如何制作、交付价值；避免简单拼接四栏原文。
4. 必须体现用户提示（若有）；语气专业、适合作品集展示。

输出格式：
{{"intro":"..."}}"""


def generate_intro(payload: dict) -> str:
    config = load_ai_config()
    if not config["api_key"]:
        raise ValueError(
            "未配置 ZHIPU_API_KEY。请在 personal-website/.env.local 填写智谱 API Key（可参考 .env.example）。"
        )

    prompt = build_intro_prompt(payload)
    content = zhipu_chat(
        config["api_key"],
        config["text_model"],
        [
            {
                "role": "system",
                "content": "你是资深 AIGC 视频项目文案编辑，只输出合法 JSON。",
            },
            {"role": "user", "content": prompt},
        ],
    )
    parsed = extract_json_object(content)
    intro = clamp_intro(parsed.get("intro") or "", 90, 100)
    if len(intro) < 88:
        retry_prompt = (
            f"{prompt}\n\n上次生成仅 {len(intro)} 字，不合格。请重新生成，"
            "intro 必须达到 90-100 个汉字，信息更充实。"
        )
        content = zhipu_chat(
            config["api_key"],
            config["text_model"],
            [
                {
                    "role": "system",
                    "content": "你是资深 AIGC 视频项目文案编辑，只输出合法 JSON。",
                },
                {"role": "user", "content": retry_prompt},
            ],
        )
        parsed = extract_json_object(content)
        intro = clamp_intro(parsed.get("intro") or "", 90, 100)
    if len(intro) < 50:
        raise ValueError("AI 未返回有效简介")
    return intro


def generate_brief_cards(payload: dict) -> list[dict[str, str]]:
    config = load_ai_config()
    if not config["api_key"]:
        raise ValueError(
            "未配置 ZHIPU_API_KEY。请在 personal-website/.env.local 填写智谱 API Key（可参考 .env.example）。"
        )

    image_paths = collect_image_paths(payload)
    prompt = build_brief_prompt(payload, len(image_paths))
    user_content: list | str
    if image_paths:
        user_content = [{"type": "text", "text": prompt}]
        for path in image_paths:
            block = image_to_content_block(path)
            if block:
                user_content.append(block)
        model = config["vision_model"]
    else:
        user_content = prompt
        model = config["text_model"]

    content = zhipu_chat(
        config["api_key"],
        model,
        [
            {
                "role": "system",
                "content": "你是资深 AIGC 视频项目文案编辑，只输出合法 JSON。",
            },
            {"role": "user", "content": user_content},
        ],
    )
    parsed = extract_json_object(content)
    cards = parsed.get("cards")
    if not isinstance(cards, list):
        raise ValueError("AI 返回缺少 cards 数组")
    return normalize_cards(cards)


class DevHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:
        if args and str(args[0]).startswith("POST /api/"):
            super().log_message(format, *args)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def _cors_headers(self) -> None:
        origin = self.headers.get("Origin", "*")
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Credentials", "true")

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/api/projects":
            self.handle_save_projects()
        elif path == "/api/upload":
            self.handle_upload()
        elif path == "/api/generate-brief-card":
            self.handle_generate_brief_card()
        elif path == "/api/generate-intro":
            self.handle_generate_intro()
        elif path == "/api/generate-brief-cards":
            self.handle_generate_brief_cards()
        else:
            self.send_error(404, "Not Found")

    def handle_save_projects(self) -> None:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            self.send_error(400, "Empty body")
            return

        try:
            raw = self.rfile.read(length)
            data = json.loads(raw.decode("utf-8"))
            if not isinstance(data, list):
                raise ValueError("projects must be an array")
        except (json.JSONDecodeError, ValueError) as exc:
            self.send_error(400, str(exc))
            return

        PROJECTS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with PROJECTS_PATH.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write("\n")

        self._send_json(200, {"ok": True, "count": len(data)})

    def handle_upload(self) -> None:
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self._send_json(400, {"ok": False, "error": "Expected multipart/form-data"})
            return

        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            self._send_json(400, {"ok": False, "error": "Empty body"})
            return

        try:
            body = self.rfile.read(length)
            fields = parse_multipart_form(body, content_type)

            file_item = fields.get("file")
            if not isinstance(file_item, tuple) or len(file_item) != 2:
                raise ValueError("missing file")

            filename, file_bytes = file_item
            if not filename or not file_bytes:
                raise ValueError("missing file")

            project_id = str(fields.get("projectId") or "p1")
            upload_type = str(fields.get("type") or "cover")
            index = str(fields.get("index") or "01")

            ext = Path(filename).suffix.lower()
            if ext not in ALLOWED_IMAGE_EXT:
                raise ValueError(f"unsupported image type: {ext or 'unknown'}")

            dest = resolve_upload_path(project_id, upload_type, index, ext)
            dest.parent.mkdir(parents=True, exist_ok=True)
            cleanup_stale_upload_siblings(dest)
            dest.write_bytes(file_bytes)

            rel_path = dest.relative_to(ROOT).as_posix()
            self._send_json(200, {"ok": True, "path": rel_path})
        except ValueError as exc:
            self._send_json(400, {"ok": False, "error": str(exc)})
        except Exception as exc:
            self._send_json(500, {"ok": False, "error": str(exc)})

    def handle_generate_brief_card(self) -> None:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            self._send_json(400, {"ok": False, "error": "Empty body"})
            return

        try:
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("payload must be an object")
            card = generate_brief_card(payload)
        except (json.JSONDecodeError, ValueError) as exc:
            self._send_json(400, {"ok": False, "error": str(exc)})
            return
        except Exception as exc:
            self._send_json(500, {"ok": False, "error": str(exc)})
            return

        self._send_json(200, {"ok": True, "card": card})

    def handle_generate_intro(self) -> None:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            self._send_json(400, {"ok": False, "error": "Empty body"})
            return

        try:
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("payload must be an object")
            intro = generate_intro(payload)
        except (json.JSONDecodeError, ValueError) as exc:
            self._send_json(400, {"ok": False, "error": str(exc)})
            return
        except Exception as exc:
            self._send_json(500, {"ok": False, "error": str(exc)})
            return

        self._send_json(200, {"ok": True, "intro": intro})

    def handle_generate_brief_cards(self) -> None:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            self._send_json(400, {"ok": False, "error": "Empty body"})
            return

        try:
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("payload must be an object")
            cards = generate_brief_cards(payload)
        except (json.JSONDecodeError, ValueError) as exc:
            self._send_json(400, {"ok": False, "error": str(exc)})
            return
        except Exception as exc:
            self._send_json(500, {"ok": False, "error": str(exc)})
            return

        self._send_json(200, {"ok": True, "cards": cards})

    def do_GET(self) -> None:
        super().do_GET()


def main() -> None:
    os.chdir(ROOT)
    server = ThreadingHTTPServer((HOST, PORT), DevHandler)
    print("")
    print("  作品集站点已启动（含后台保存 / 图片上传 / AI 文案 API）")
    print(f"  主页:   http://{HOST}:{PORT}/")
    print(f"  后台:   http://{HOST}:{PORT}/admin.html")
    print("  按 Ctrl+C 可停止服务")
    print("")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
        server.server_close()


if __name__ == "__main__":
    main()
