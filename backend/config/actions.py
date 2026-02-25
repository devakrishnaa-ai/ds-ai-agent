"""
=============================================
 NeMo Guardrails — Custom Actions
 PII detection, relevance checking, and
 output validation actions
=============================================
"""

import re
from typing import Optional
from nemoguardrails.actions import action


# ==================== PII PATTERNS ====================
PII_PATTERNS = {
    "email": re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}'),
    "phone": re.compile(r'(?:\+?\d{1,3}[\s\-]?)?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}'),
    "ssn": re.compile(r'\b\d{3}[\-\s]?\d{2}[\-\s]?\d{4}\b'),
    "credit_card": re.compile(r'\b(?:\d{4}[\s\-]?){3}\d{4}\b'),
    "ip_address": re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b'),
}


# ==================== BLOCKED TOPICS ====================
BLOCKED_TOPICS = [
    re.compile(r'(?:how\s+to\s+)?(?:hack|exploit|attack|crack|breach|phish)', re.I),
    re.compile(r'(?:make|create|build|generate)\s+(?:a\s+)?(?:virus|malware|trojan|ransomware)', re.I),
    re.compile(r'(?:bypass|break|circumvent)\s+(?:security|authentication|firewall)', re.I),
    re.compile(r'(?:steal|dump|exfiltrate)\s+(?:data|credentials|passwords)', re.I),
    re.compile(r'(?:illegal|illicit)\s+(?:activities|substances|drugs)', re.I),
]

# Data-related keywords that indicate an on-topic message
DATA_KEYWORDS = [
    'data', 'dataset', 'csv', 'column', 'row', 'table', 'chart', 'graph',
    'analysis', 'analyze', 'insight', 'pattern', 'trend', 'average', 'mean',
    'median', 'outlier', 'missing', 'duplicate', 'correlation', 'predict',
    'forecast', 'report', 'visualization', 'distribution', 'percentage',
    'compare', 'statistic', 'summary', 'group', 'cluster', 'upload',
    'file', 'export', 'download', 'value', 'number', 'category', 'count',
    'total', 'minimum', 'maximum', 'sales', 'revenue', 'profit', 'customer',
]


# ==================== INPUT ACTIONS ====================

@action(is_system_action=True)
async def self_check_input(context: Optional[dict] = None):
    """
    Check if user input contains jailbreak or injection attempts.
    Returns True if input is safe, False if it should be blocked.
    """
    user_message = context.get("user_message", "") if context else ""

    # Prompt injection patterns
    injection_patterns = [
        re.compile(r'ignore\s+(all\s+)?previous\s+instructions', re.I),
        re.compile(r'ignore\s+(the\s+)?(above|prior)\s+instructions', re.I),
        re.compile(r'disregard\s+(all\s+)?(your\s+)?previous', re.I),
        re.compile(r'forget\s+(all\s+)?(your\s+)?instructions', re.I),
        re.compile(r'you\s+are\s+now\s+(?:a|an)\s+(?:different|new)', re.I),
        re.compile(r'pretend\s+(?:you\s+are|to\s+be)', re.I),
        re.compile(r'jailbreak', re.I),
        re.compile(r'DAN\s+mode', re.I),
        re.compile(r'developer\s+mode', re.I),
        re.compile(r'bypass\s+(?:your|the|all)\s+(?:rules|restrictions|safety|filters)', re.I),
        re.compile(r'override\s+(?:your|the|all)\s+(?:rules|restrictions|safety)', re.I),
        re.compile(r'reveal\s+(?:your|the)\s+(?:system|initial|original)\s+prompt', re.I),
        re.compile(r'(?:system|admin|root)\s*(?:override|access|privilege)', re.I),
    ]

    for pattern in injection_patterns:
        if pattern.search(user_message):
            return False

    # Check for blocked topics
    for pattern in BLOCKED_TOPICS:
        if pattern.search(user_message):
            return False

    return True


@action(is_system_action=True)
async def check_pii_input(context: Optional[dict] = None):
    """
    Check if user input contains PII that should be flagged.
    Returns True if no PII found, False if PII detected.
    """
    user_message = context.get("user_message", "") if context else ""

    pii_found = {}
    for pii_type, pattern in PII_PATTERNS.items():
        matches = pattern.findall(user_message)
        if matches:
            pii_found[pii_type] = len(matches)

    if pii_found:
        # Log but don't block — just warn
        print(f"[GUARDRAIL] PII detected in input: {pii_found}")
        # We allow PII in input since users might ask about their own data
        # but we log it for awareness

    return True  # Allow but log


@action(is_system_action=True)
async def check_blocked_terms(context: Optional[dict] = None):
    """
    Check if message contains any blocked terms.
    """
    user_message = context.get("user_message", "").lower() if context else ""
    
    blocked = [
        "hack", "exploit", "malware", "ransomware", "phishing",
        "password cracking", "brute force", "sql injection",
        "xss attack", "keylogger", "backdoor", "zero-day", "ddos"
    ]
    
    for term in blocked:
        if term in user_message:
            return False
    
    return True


# ==================== OUTPUT ACTIONS ====================

@action(is_system_action=True)
async def self_check_output(context: Optional[dict] = None):
    """
    Validate the bot's response before sending to user.
    Returns True if output is safe, False if it should be blocked.
    """
    bot_response = context.get("bot_message", "") if context else ""

    # Check for accidental code generation
    dangerous_patterns = [
        re.compile(r'import\s+os', re.I),
        re.compile(r'subprocess\.(run|call|Popen)', re.I),
        re.compile(r'exec\s*\(', re.I),
        re.compile(r'eval\s*\(', re.I),
        re.compile(r'__import__', re.I),
        re.compile(r'rm\s+-rf', re.I),
        re.compile(r'format\s+c:', re.I),
        re.compile(r'<script', re.I),
    ]

    for pattern in dangerous_patterns:
        if pattern.search(bot_response):
            return False

    return True


@action(is_system_action=True)
async def check_pii_in_output(context: Optional[dict] = None):
    """
    Check if AI response accidentally contains PII.
    Returns True if PII found (to trigger redaction), False if clean.
    """
    bot_response = context.get("bot_message", "") if context else ""

    for pii_type, pattern in PII_PATTERNS.items():
        if pattern.search(bot_response):
            print(f"[GUARDRAIL] PII leak detected in output: {pii_type}")
            return True

    return False


@action(is_system_action=True)
async def check_output_relevance(context: Optional[dict] = None):
    """
    Ensure the bot's response stays on-topic (data analysis).
    Returns True if relevant, False if off-topic.
    """
    bot_response = context.get("bot_message", "").lower() if context else ""

    # If response is short (like greetings), allow it
    if len(bot_response) < 100:
        return True

    # Check if response contains any data-related keywords
    data_keyword_count = sum(1 for kw in DATA_KEYWORDS if kw in bot_response)

    # If a long response has almost no data keywords, it might be off-topic
    if len(bot_response) > 200 and data_keyword_count < 2:
        return False

    return True
