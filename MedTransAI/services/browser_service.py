"""
Browser automation service using Playwright.

Opens a Chromium persistent context and reads transcription task data from
the target website. Selectors are NOT hardcoded; instead the service uses
robust heuristics (role, text, common class patterns, data attributes) to
locate task fields dynamically.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from config import AppConfig, CONFIG_PATH
from services.logger import get_logger

log = get_logger("browser")


@dataclass
class TaskInfo:
    project_name: Optional[str] = None
    clip_number: Optional[str] = None
    duration: Optional[str] = None
    speaker: Optional[str] = None
    tag: Optional[str] = None
    raw: dict = field(default_factory=dict)


# Candidate selector strategies, ordered by robustness.
_TEXT_LABELS = {
    "project_name": ["project", "projet", "dossier"],
    "clip_number": ["clip", "numéro", "number", "n°"],
    "duration": ["duration", "durée", "length"],
    "speaker": ["speaker", "locuteur", "intervenant"],
    "tag": ["tag", "etiquette", "category", "catégorie"],
}


class BrowserService:
    def __init__(self, cfg: Optional[AppConfig] = None) -> None:
        self.cfg = cfg or AppConfig.load(CONFIG_PATH)
        self._playwright = None
        self._context = None
        self._page = None

    def launch(self) -> None:
        from playwright.sync_api import sync_playwright

        self._playwright = sync_playwright().start()
        b_cfg = self.cfg.browser
        if b_cfg.persistent_context:
            self._context = self._playwright.chromium.launch_persistent_context(
                user_data_dir=str(self.cfg.resolve("temp") / "browser_profile"),
                headless=b_cfg.headless,
            )
        else:
            browser = self._playwright.chromium.launch(headless=b_cfg.headless)
            self._context = browser.new_context()
        self._page = self._context.new_page()
        log.info("Browser launched (persistent context=%s)", b_cfg.persistent_context)

    def open(self, url: str) -> None:
        if self._page is None:
            self.launch()
        b_cfg = self.cfg.browser
        self._page.goto(url, timeout=b_cfg.navigation_timeout_ms, wait_until="domcontentloaded")
        log.info("Opened %s", url)

    def _retry(self, fn, attempts: Optional[int] = None):
        b_cfg = self.cfg.browser
        attempts = attempts or b_cfg.max_retries
        last = None
        for i in range(attempts):
            try:
                return fn()
            except Exception as exc:  # pragma: no cover
                last = exc
                log.warning("Browser op retry %d/%d: %s", i + 1, attempts, exc)
        raise last or RuntimeError("Browser operation failed")

    def _find_by_label(self, key: str) -> Optional[str]:
        page = self._page
        if page is None:
            return None
        labels = _TEXT_LABELS.get(key, [])
        for label in labels:
            try:
                # Try input/textarea associated via label
                el = page.locator(f"text=/{label}/i").first
                if el.count():
                    sib = el.locator("xpath=following::input[1] | following::textarea[1]")
                    if sib.count():
                        val = sib.input_value()
                        if val:
                            return val
                    # Or a sibling/child text node value
                    txt = el.inner_text()
                    return txt.split(":", 1)[-1].strip() or None
            except Exception:
                continue
        return None

    def detect_task(self) -> Optional[TaskInfo]:
        if self._page is None:
            return None

        def _work() -> TaskInfo:
            info = TaskInfo()
            for key in _TEXT_LABELS:
                value = self._find_by_label(key)
                setattr(info, key, value)
                if value:
                    info.raw[key] = value
            # Also scan data attributes / JSON embedded state
            try:
                state = self._page.evaluate(
                    "() => document.querySelector('[data-task]')?.dataset?.task || null"
                )
                if state:
                    info.raw["data_task"] = state
            except Exception:
                pass
            return info

        try:
            return self._retry(_work)
        except Exception as exc:
            log.error("Failed to detect task: %s", exc)
            return None

    def submit_transcript(self, text: str) -> bool:
        """Attempt to fill the transcript field and submit on the page."""
        if self._page is None:
            return False

        def _work() -> bool:
            field_el = (
                self._page.locator("textarea[name*='transcript' i], textarea[id*='transcript' i]").first
            )
            if not field_el.count():
                field_el = self._page.locator("textarea").first
            field_el.fill(text)
            submit = self._page.locator(
                "button:has-text('Submit'), button:has-text('Envoyer'), "
                "button[type='submit']"
            ).first
            if submit.count():
                submit.click(timeout=self.cfg.browser.action_timeout_ms)
            return True

        try:
            return bool(self._retry(_work))
        except Exception as exc:
            log.error("Submit failed: %s", exc)
            return False

    def refresh(self) -> None:
        if self._page is not None:
            self._page.reload()

    def close(self) -> None:
        try:
            if self._context is not None:
                self._context.close()
            if self._playwright is not None:
                self._playwright.stop()
        except Exception as exc:  # pragma: no cover
            log.warning("Error closing browser: %s", exc)
        finally:
            self._context = None
            self._page = None
