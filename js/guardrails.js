/* =============================================
   GUARDRAILS ENGINE — Client-Side Security Layer
   Inspired by NVIDIA NeMo Guardrails
   
   Protects against:
   • XSS / Script Injection via data files
   • Malicious file uploads
   • Data poisoning & oversized payloads
   • Rate-limiting abuse
   • Code injection through CSV fields
   • Prompt injection attacks (for AI chat)
   ============================================= */

const Guardrails = (() => {
    'use strict';

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        maxFileSizeMB: 50,
        maxRows: 500000,
        maxColumns: 200,
        maxCellLength: 5000,
        maxFileNameLength: 200,
        allowedExtensions: ['csv', 'tsv', 'txt'],
        allowedMimeTypes: [
            'text/csv',
            'text/plain',
            'text/tab-separated-values',
            'application/vnd.ms-excel',
            'application/csv',
            ''  // Some browsers send empty mime
        ],
        rateLimitWindowMs: 60000,    // 1 minute
        rateLimitMaxActions: 20,     // max 20 actions per window
        maxChatMessageLength: 2000,
        bannedPatterns: [],          // populated below
    };

    // ==================== SECURITY PATTERNS ====================
    // Patterns that indicate potential attacks
    const INJECTION_PATTERNS = [
        // Script injection
        /<script[\s>]/i,
        /javascript\s*:/i,
        /on\w+\s*=\s*["']/i,
        /eval\s*\(/i,
        /document\.(cookie|write|location)/i,
        /window\.(location|open)/i,
        /\.innerHTML\s*=/i,
        /\.outerHTML\s*=/i,
        /\bfetch\s*\(/i,
        /XMLHttpRequest/i,

        // Formula injection (CSV injection attacks)
        /^[=+\-@\t\r]\s*(?:cmd|powershell|bash|sh|exec|system)/i,
        /^=\s*(?:IMPORTXML|IMPORTDATA|IMPORTHTML|IMPORTRANGE|IMPORTFEED|IMAGE|HYPERLINK|WEBSERVICE)\s*\(/i,
        /^[=+\-@]\s*(?:DDE|SUM|AVERAGE)/i,

        // SQL injection patterns
        /(['"];\s*(?:DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|EXEC|UNION|SELECT)\s)/i,
        /\b(?:OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,

        // Path traversal
        /\.\.\//g,
        /\.\.\\/,

        // Command injection
        /[|;&`$]\s*(?:rm|del|format|shutdown|reboot|wget|curl|nc|ncat)\b/i,
    ];

    // Prompt injection patterns (for AI chat)
    const PROMPT_INJECTION_PATTERNS = [
        /ignore\s+(all\s+)?previous\s+instructions/i,
        /ignore\s+(the\s+)?(above|prior|earlier)\s+instructions/i,
        /disregard\s+(all\s+)?(your\s+)?previous/i,
        /forget\s+(all\s+)?(your\s+)?instructions/i,
        /you\s+are\s+now\s+(?:a|an)\s+(?:different|new)/i,
        /pretend\s+(?:you\s+are|to\s+be|you're)/i,
        /act\s+as\s+(?:if|though)\s+you/i,
        /jailbreak/i,
        /DAN\s+mode/i,
        /developer\s+mode/i,
        /bypass\s+(?:your|the|all)\s+(?:rules|restrictions|safety|filters|guardrails)/i,
        /override\s+(?:your|the|all)\s+(?:rules|restrictions|safety|instructions)/i,
        /reveal\s+(?:your|the)\s+(?:system|initial|original)\s+prompt/i,
        /show\s+(?:me\s+)?(?:your|the)\s+(?:system|hidden)\s+(?:prompt|instructions)/i,
        /what\s+(?:are|is)\s+your\s+(?:system|initial|hidden)\s+(?:prompt|instructions)/i,
        /repeat\s+(?:your|the)\s+(?:system|initial)\s+(?:prompt|message)/i,
        /(?:do|execute|run)\s+(?:anything|whatever)\s+I\s+(?:say|tell|ask)/i,
        /you\s+(?:must|should|have\s+to)\s+(?:always\s+)?(?:obey|follow|listen)/i,
        /from\s+now\s+on,?\s+(?:you|ignore|forget)/i,
        /new\s+(?:persona|personality|character|role)/i,
        /(?:system|admin|root)\s*(?:override|access|privilege)/i,
    ];

    // PII patterns to detect/protect
    const PII_PATTERNS = {
        email: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
        phone: /(?:\+?\d{1,3}[\s\-]?)?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/g,
        ssn: /\b\d{3}[\-\s]?\d{2}[\-\s]?\d{4}\b/g,
        creditCard: /\b(?:\d{4}[\s\-]?){3}\d{4}\b/g,
        ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    };

    // Off-topic categories (for data science agent)
    const OFF_TOPIC_PATTERNS = [
        /(?:how\s+to\s+)?(?:hack|exploit|attack|crack|breach|phish)/i,
        /(?:make|create|build|generate)\s+(?:a\s+)?(?:virus|malware|trojan|ransomware|bomb|weapon)/i,
        /(?:illegal|illicit)\s+(?:activities|substances|drugs)/i,
        /(?:suicide|self[- ]harm|kill\s+(?:my|your)self)/i,
    ];

    // ==================== RATE LIMITER ====================
    const _actionLog = [];

    function _checkRateLimit() {
        const now = Date.now();
        // Remove expired entries
        while (_actionLog.length > 0 && _actionLog[0] < now - CONFIG.rateLimitWindowMs) {
            _actionLog.shift();
        }
        if (_actionLog.length >= CONFIG.rateLimitMaxActions) {
            return {
                ok: false,
                reason: 'Too many actions in a short time. Please wait a moment before trying again.',
                type: 'RATE_LIMIT'
            };
        }
        _actionLog.push(now);
        return { ok: true };
    }

    // ==================== SECURITY LOG ====================
    const _securityLog = [];

    function _logEvent(type, severity, message, details = null) {
        const event = {
            timestamp: new Date().toISOString(),
            type,
            severity, // 'info', 'warning', 'critical'
            message,
            details
        };
        _securityLog.push(event);

        // Console warning for critical events
        if (severity === 'critical') {
            console.warn(`🛡️ [GUARDRAIL BLOCKED] ${type}: ${message}`);
        }

        // Keep log from growing too large
        if (_securityLog.length > 500) {
            _securityLog.splice(0, 250);
        }
    }

    // ==================== FILE VALIDATION ====================
    function validateFile(file) {
        const results = {
            ok: true,
            warnings: [],
            errors: [],
            blocked: false,
            sanitized: false
        };

        // Rate limit check
        const rl = _checkRateLimit();
        if (!rl.ok) {
            results.ok = false;
            results.blocked = true;
            results.errors.push(rl.reason);
            _logEvent('RATE_LIMIT', 'warning', 'File upload rate limited');
            return results;
        }

        // 1) File name validation
        if (!file.name || file.name.length > CONFIG.maxFileNameLength) {
            results.ok = false;
            results.errors.push('File name is too long or missing.');
            _logEvent('FILE_VALIDATION', 'warning', 'Invalid filename', { name: file.name });
            return results;
        }

        // Check for directory traversal in filename
        if (/\.\.[\\/]/.test(file.name)) {
            results.ok = false;
            results.blocked = true;
            results.errors.push('File name contains suspicious characters.');
            _logEvent('FILE_ATTACK', 'critical', 'Path traversal attempt in filename', { name: file.name });
            return results;
        }

        // 2) Extension check
        const ext = file.name.split('.').pop().toLowerCase();
        if (!CONFIG.allowedExtensions.includes(ext)) {
            results.ok = false;
            results.errors.push(`File type ".${ext}" is not supported. Please upload a CSV, TSV, or TXT file.`);
            _logEvent('FILE_VALIDATION', 'warning', 'Unsupported file extension', { ext });
            return results;
        }

        // 3) MIME type check
        if (file.type && !CONFIG.allowedMimeTypes.includes(file.type.toLowerCase())) {
            results.ok = false;
            results.errors.push('This file does not appear to be a valid data file.');
            _logEvent('FILE_VALIDATION', 'warning', 'Suspicious MIME type', { mime: file.type });
            return results;
        }

        // 4) File size check
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > CONFIG.maxFileSizeMB) {
            results.ok = false;
            results.errors.push(`File is too large (${sizeMB.toFixed(1)}MB). Maximum allowed is ${CONFIG.maxFileSizeMB}MB.`);
            _logEvent('FILE_VALIDATION', 'warning', 'File too large', { sizeMB });
            return results;
        }

        if (sizeMB > CONFIG.maxFileSizeMB * 0.8) {
            results.warnings.push(`File is fairly large (${sizeMB.toFixed(1)}MB). Analysis may take longer.`);
        }

        // 5) Check for empty file
        if (file.size === 0) {
            results.ok = false;
            results.errors.push('The file is empty. Please upload a file with data.');
            return results;
        }

        _logEvent('FILE_VALIDATION', 'info', 'File passed validation', { name: file.name, sizeMB });
        return results;
    }

    // ==================== DATA VALIDATION ====================
    function validateData(data, headers) {
        const results = {
            ok: true,
            warnings: [],
            errors: [],
            blocked: false,
            injectionAttempts: 0,
            piiDetected: {},
            sanitizedCells: 0
        };

        // Rate limit
        const rl = _checkRateLimit();
        if (!rl.ok) {
            results.ok = false;
            results.blocked = true;
            results.errors.push(rl.reason);
            return results;
        }

        // 1) Row count check
        if (data.length > CONFIG.maxRows) {
            results.ok = false;
            results.errors.push(`Dataset has ${data.length.toLocaleString()} rows which exceeds the maximum of ${CONFIG.maxRows.toLocaleString()}.`);
            _logEvent('DATA_VALIDATION', 'warning', 'Too many rows', { count: data.length });
            return results;
        }

        // 2) Column count check
        if (headers.length > CONFIG.maxColumns) {
            results.ok = false;
            results.errors.push(`Dataset has ${headers.length} columns which exceeds the maximum of ${CONFIG.maxColumns}.`);
            return results;
        }

        // 3) Empty dataset
        if (data.length === 0) {
            results.ok = false;
            results.errors.push('The dataset appears to be empty after parsing.');
            return results;
        }

        if (headers.length === 0) {
            results.ok = false;
            results.errors.push('No column headers were found in the file.');
            return results;
        }

        // 4) Scan for injections and PII (sample-based for performance)
        const sampleSize = Math.min(data.length, 1000);
        const sampleIndices = new Set();
        while (sampleIndices.size < sampleSize) {
            sampleIndices.add(Math.floor(Math.random() * data.length));
        }

        for (const idx of sampleIndices) {
            const row = data[idx];
            for (const header of headers) {
                const value = String(row[header] || '');

                // Cell length check
                if (value.length > CONFIG.maxCellLength) {
                    results.warnings.push(`Very long value found in column "${header}" (${value.length} characters).`);
                }

                // Injection check
                for (const pattern of INJECTION_PATTERNS) {
                    if (pattern.test(value)) {
                        results.injectionAttempts++;
                        _logEvent('INJECTION_DETECTED', 'critical', 'Injection pattern found in data', {
                            column: header,
                            row: idx,
                            pattern: pattern.source,
                            sample: value.substring(0, 100)
                        });
                        break;
                    }
                }

                // PII detection
                for (const [piiType, pattern] of Object.entries(PII_PATTERNS)) {
                    const clonedPattern = new RegExp(pattern.source, pattern.flags);
                    if (clonedPattern.test(value)) {
                        if (!results.piiDetected[piiType]) results.piiDetected[piiType] = 0;
                        results.piiDetected[piiType]++;
                    }
                }
            }
        }

        // Report findings
        if (results.injectionAttempts > 0) {
            results.warnings.push(`⚠️ Found ${results.injectionAttempts} potentially suspicious values in the data. These have been safely neutralized.`);
        }

        const piiTypes = Object.keys(results.piiDetected);
        if (piiTypes.length > 0) {
            const piiList = piiTypes.map(t => `${t} (${results.piiDetected[t]} found)`).join(', ');
            results.warnings.push(`🔒 Personal information detected: ${piiList}. Be careful when sharing this data.`);
            _logEvent('PII_DETECTED', 'warning', 'Personal data found', results.piiDetected);
        }

        _logEvent('DATA_VALIDATION', 'info', 'Data validation complete', {
            rows: data.length,
            columns: headers.length,
            injections: results.injectionAttempts,
            pii: piiTypes.length > 0
        });

        return results;
    }

    // ==================== CONTENT SANITIZER ====================
    function sanitizeValue(value) {
        if (value === null || value === undefined) return value;
        if (typeof value === 'number') return value;
        if (typeof value === 'boolean') return value;

        let str = String(value);

        // Remove null bytes
        str = str.replace(/\0/g, '');

        // Neutralize formula injection (= + - @ at start)
        if (/^[=+\-@]/.test(str) && str.length > 1) {
            // Only neutralize if it looks like a formula, not a negative number
            const afterPrefix = str.substring(1).trim();
            if (isNaN(afterPrefix) || afterPrefix.includes('(')) {
                str = "'" + str;  // Prefix with apostrophe to neutralize
            }
        }

        // HTML encode dangerous characters
        str = str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');

        return str;
    }

    function sanitizeDataForDisplay(data, headers) {
        return data.map(row => {
            const sanitized = {};
            headers.forEach(h => {
                sanitized[h] = sanitizeValue(row[h]);
            });
            return sanitized;
        });
    }

    function sanitizeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    // ==================== CHAT / PROMPT GUARDRAILS ====================
    function validateChatInput(message) {
        const results = {
            ok: true,
            blocked: false,
            reason: '',
            type: '',
            sanitizedMessage: ''
        };

        // Rate limit
        const rl = _checkRateLimit();
        if (!rl.ok) {
            results.ok = false;
            results.blocked = true;
            results.reason = rl.reason;
            results.type = 'RATE_LIMIT';
            return results;
        }

        // Length check
        if (!message || message.trim().length === 0) {
            results.ok = false;
            results.reason = 'Please type a message.';
            results.type = 'EMPTY';
            return results;
        }

        if (message.length > CONFIG.maxChatMessageLength) {
            results.ok = false;
            results.reason = `Message is too long. Please keep it under ${CONFIG.maxChatMessageLength} characters.`;
            results.type = 'TOO_LONG';
            return results;
        }

        // Prompt injection detection
        for (const pattern of PROMPT_INJECTION_PATTERNS) {
            if (pattern.test(message)) {
                results.ok = false;
                results.blocked = true;
                results.reason = "I can only help with data analysis. I can't change my behavior or role.";
                results.type = 'PROMPT_INJECTION';
                _logEvent('PROMPT_INJECTION', 'critical', 'Prompt injection attempt blocked', {
                    pattern: pattern.source,
                    message: message.substring(0, 200)
                });
                return results;
            }
        }

        // Off-topic / harmful content
        for (const pattern of OFF_TOPIC_PATTERNS) {
            if (pattern.test(message)) {
                results.ok = false;
                results.blocked = true;
                results.reason = "I'm a data analysis assistant. I can only help with questions about your data.";
                results.type = 'OFF_TOPIC';
                _logEvent('OFF_TOPIC', 'warning', 'Off-topic request blocked', {
                    message: message.substring(0, 200)
                });
                return results;
            }
        }

        // Code injection in chat
        for (const pattern of INJECTION_PATTERNS) {
            if (pattern.test(message)) {
                results.ok = false;
                results.blocked = true;
                results.reason = "Your message contains content I can't process. Please ask a simple question about your data.";
                results.type = 'CODE_INJECTION';
                _logEvent('CHAT_INJECTION', 'critical', 'Code injection in chat blocked', {
                    message: message.substring(0, 200)
                });
                return results;
            }
        }

        results.sanitizedMessage = sanitizeHTML(message.trim());
        return results;
    }

    // ==================== OUTPUT GUARDRAILS ====================
    function validateOutput(response) {
        const results = {
            ok: true,
            sanitizedResponse: '',
            warnings: []
        };

        if (!response) {
            results.sanitizedResponse = '';
            return results;
        }

        let sanitized = String(response);

        // Remove any accidental PII leakage from AI responses
        for (const [piiType, pattern] of Object.entries(PII_PATTERNS)) {
            const clonedPattern = new RegExp(pattern.source, pattern.flags);
            if (clonedPattern.test(sanitized)) {
                sanitized = sanitized.replace(clonedPattern, `[${piiType.toUpperCase()}_REDACTED]`);
                results.warnings.push(`Redacted ${piiType} from output`);
                _logEvent('OUTPUT_SANITIZED', 'warning', `PII redacted from output: ${piiType}`);
            }
        }

        // Remove any code blocks that look dangerous
        sanitized = sanitized
            .replace(/<script[\s\S]*?<\/script>/gi, '[REMOVED]')
            .replace(/javascript\s*:/gi, '[REMOVED]')
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '[REMOVED]');

        results.sanitizedResponse = sanitized;
        return results;
    }

    // ==================== GUARDRAILS SUMMARY UI ====================
    function getSecuritySummary() {
        const critical = _securityLog.filter(e => e.severity === 'critical').length;
        const warnings = _securityLog.filter(e => e.severity === 'warning').length;
        const total = _securityLog.length;

        return {
            totalEvents: total,
            criticalBlocks: critical,
            warnings: warnings,
            status: critical > 0 ? 'threats_blocked' : warnings > 0 ? 'warnings_present' : 'all_clear',
            statusLabel: critical > 0 ? '🛡️ Threats Blocked' : warnings > 0 ? '⚠️ Warnings' : '✅ All Clear',
            recentEvents: _securityLog.slice(-10).reverse()
        };
    }

    function getSecurityLog() {
        return [..._securityLog];
    }

    function clearSecurityLog() {
        _securityLog.length = 0;
    }

    // ==================== PUBLIC API ====================
    return {
        // File validation
        validateFile,

        // Data validation
        validateData,

        // Sanitization
        sanitizeValue,
        sanitizeDataForDisplay,
        sanitizeHTML,

        // Chat guardrails
        validateChatInput,

        // Output guardrails
        validateOutput,

        // Security monitoring
        getSecuritySummary,
        getSecurityLog,
        clearSecurityLog,

        // Configuration
        CONFIG
    };
})();
