import logging
import sys
import os

def setup_logger(name: str) -> logging.Logger:
    """Sets up a standardized enterprise logger for the SignVerse OS."""
    logger = logging.getLogger(name)
    
    # Check if logger already has handlers to prevent duplicate logs
    if not logger.handlers:
        log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
        log_level = getattr(logging, log_level_str, logging.INFO)
        
        logger.setLevel(log_level)
        
        # Create console handler
        ch = logging.StreamHandler(sys.stdout)
        ch.setLevel(log_level)
        
        # Create formatter and add it to the handlers
        formatter = logging.Formatter(
            fmt='[%(asctime)s] %(levelname)s [%(name)s] %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        ch.setFormatter(formatter)
        
        logger.addHandler(ch)
        # Prevent propagation to the root logger to avoid double logging
        logger.propagate = False

    return logger
