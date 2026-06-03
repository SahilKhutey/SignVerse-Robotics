import logging
import sys
import os
import structlog

# Circular log buffer for tailing logs from dashboard System Health
MAX_LOG_LINES = 1000
log_buffer = []

def buffer_logger_processor(logger, method_name, event_dict):
    """Saves structured log events into a JSON string in the log_buffer."""
    import json
    try:
        # Create a clean format for buffer
        log_entry = {
            "timestamp": event_dict.get("timestamp"),
            "level": event_dict.get("level"),
            "logger": event_dict.get("logger") or logger.name if hasattr(logger, "name") else "system",
            "event": event_dict.get("event"),
            "correlation_id": event_dict.get("correlation_id")
        }
        # Keep track of extra payload fields
        extra = {k: v for k, v in event_dict.items() if k not in ["timestamp", "level", "logger", "event", "correlation_id"]}
        if extra:
            log_entry["extra"] = extra

        log_buffer.append(json.dumps(log_entry))
        if len(log_buffer) > MAX_LOG_LINES:
            log_buffer.pop(0)
    except Exception:
        pass
    return event_dict

# Configure structlog globally
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        buffer_logger_processor,
        structlog.processors.JSONRenderer() if os.getenv("LOG_FORMAT", "JSON").upper() == "JSON" else structlog.dev.ConsoleRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    cache_logger_on_first_use=True,
)

def setup_logger(name: str):
    """Sets up a structlog logger for the SignVerse OS."""
    return structlog.get_logger(name)
