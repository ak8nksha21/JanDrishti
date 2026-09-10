import re
from typing import Optional

# Regex for Indian phone numbers (e.g. +91 9876543210, 09876543210, 98765-43210, 9876543210)
PHONE_REGEX = re.compile(
    r'(?:\+?91[\-\s]?)?(?:0)?[6-9]\d{4}[\-\s]?\d{5}\b|(?:\+?91[\-\s]?)?(?:0)?[6-9]\d{9}\b'
)

# Regex for standard emails
EMAIL_REGEX = re.compile(
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
)


def sanitize_text(text: Optional[str]) -> Optional[str]:
    """
    Sanitize text by redacting phone numbers and emails to protect incidental PII
    without corrupting the surrounding narrative.
    """
    if not text:
        return text
    
    # Redact phone numbers
    sanitized = PHONE_REGEX.sub("[PHONE_REDACTED]", text)
    # Redact email addresses
    sanitized = EMAIL_REGEX.sub("[EMAIL_REDACTED]", sanitized)
    
    return sanitized
