"""PDF generation service.

Renders Jinja2 HTML templates to PDF bytes with WeasyPrint. Templates live
in the project ``templates/`` directory; ad-hoc HTML strings (used for the
tabular reports) are rendered directly.
"""

import sys
import ctypes
import os
from functools import lru_cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

# backend/app/services/pdf_service.py -> backend/templates.
# Keep the bundled template lookup for a frozen deployment, while local web
# development resolves templates from the repository.
if getattr(sys, "frozen", False):
    TEMPLATES_DIR = Path(getattr(sys, "_MEIPASS")) / "templates"
else:
    TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


@lru_cache(maxsize=1)
def _weasyprint_html():
    """Import WeasyPrint lazily.

    WeasyPrint loads native GTK/pango DLLs at import time; if those are
    missing on the host, a top-level import would crash the whole backend
    at startup. Importing here means the app always boots — only the PDF
    endpoints fail (with a clear error) when the libraries are absent.
    """
    native = Path(__file__).resolve().parents[2] / "native" / "lib"
    if native.is_dir():
        os.environ["FONTCONFIG_FILE"] = str(native.parents[1] / "fontconfig.xml")
        # dlopen's search path is fixed at process startup. Preload the bundled
        # libraries by absolute path in dependency order instead of mutating it.
        pending = list(native.glob("*.so*"))
        while pending:
            remaining = []
            errors = []
            for library in pending:
                try:
                    ctypes.CDLL(str(library), mode=ctypes.RTLD_GLOBAL)
                except OSError as exc:
                    remaining.append(library)
                    errors.append(str(exc))
            if len(remaining) == len(pending):
                raise RuntimeError("Unable to load bundled PDF libraries: " + "; ".join(errors))
            pending = remaining
    from weasyprint import HTML

    return HTML


def render_template_to_pdf(template_name: str, context: dict) -> bytes:
    """Render a named template from the templates dir to PDF bytes."""
    HTML = _weasyprint_html()
    html = _env.get_template(template_name).render(**context)
    return HTML(string=html, base_url=str(TEMPLATES_DIR)).write_pdf()


def render_html_to_pdf(html: str) -> bytes:
    """Render a raw HTML string to PDF bytes."""
    HTML = _weasyprint_html()
    return HTML(string=html, base_url=str(TEMPLATES_DIR)).write_pdf()
