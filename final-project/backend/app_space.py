"""Hugging Face Space 入口：同一個服務同時提供 API (/api/...) 與 Gradio 介面 (/)。"""
import gradio as gr
from etfcity.api import app as api_app
from app_gradio import demo

api_app.router.routes = [r for r in api_app.router.routes if getattr(r, "path", "") != "/"]
app = gr.mount_gradio_app(api_app, demo, path="/")
