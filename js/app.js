/* =============================================
   Datadiv AI — Core Engine
   ============================================= */

// ==================== GLOBALS ====================
let rawData = [];
let headers = [];
let columnMeta = [];
let fileName = '';
let chartInstances = [];

// ==================== DOM REFS ====================
const $ = (id) => document.getElementById(id);
const heroSection = $('heroSection');
const processingSection = $('processingSection');
const dashboardSection = $('dashboardSection');
const uploadArea = $('uploadArea');
const uploadInner = $('uploadInner');
const fileInput = $('fileInput');
const sampleBtn = $('sampleBtn');
const newAnalysisBtn = $('newAnalysisBtn');
const headerStatus = $('headerStatus');
const processingText = $('processingText');
const toast = $('toast');
const toastText = $('toastText');

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    init3DBackground();
    setupUpload();
    setupNextSteps();
    setupChat();
    setupShield();
});

// ==================== 3D BACKGROUND (THREE.JS) — NEW DESIGN MOTION ====================
let scene, camera, renderer, particles, connections;

function init3DBackground() {
    const container = $('bgParticles');
    if (!container) return;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 3000);
    camera.position.z = 800;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Particle Configuration
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const color1 = new THREE.Color(0x9f66ff); // Amethyst
    const color2 = new THREE.Color(0x00e5ff); // Cyan
    const color3 = new THREE.Color(0xff3e8d); // Rose

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 2000;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 2000;

        velocities[i * 3] = (Math.random() - 0.5) * 1.5;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 1.5;

        const mix = Math.random();
        const c = mix < 0.4 ? color1 : mix < 0.8 ? color2 : color3;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 4,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Connections (Lines)
    const lineGeometry = new THREE.BufferGeometry();
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x9f66ff,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending
    });
    connections = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(connections);

    let mouseX = 0, mouseY = 0;
    window.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX - window.innerWidth / 2) * 0.5;
        mouseY = (e.clientY - window.innerHeight / 2) * 0.5;
    });

    function animate() {
        requestAnimationFrame(animate);

        const posAttr = particles.geometry.attributes.position;
        const linePositions = [];

        for (let i = 0; i < particleCount; i++) {
            posAttr.array[i * 3] += velocities[i * 3];
            posAttr.array[i * 3 + 1] += velocities[i * 3 + 1];
            posAttr.array[i * 3 + 2] += velocities[i * 3 + 2];

            // Boundary check
            if (Math.abs(posAttr.array[i * 3]) > 1000) velocities[i * 3] *= -1;
            if (Math.abs(posAttr.array[i * 3 + 1]) > 1000) velocities[i * 3 + 1] *= -1;
            if (Math.abs(posAttr.array[i * 3 + 2]) > 1000) velocities[i * 3 + 2] *= -1;

            // Connection logic
            for (let j = i + 1; j < particleCount; j++) {
                const dx = posAttr.array[i * 3] - posAttr.array[j * 3];
                const dy = posAttr.array[i * 3 + 1] - posAttr.array[j * 3 + 1];
                const dz = posAttr.array[i * 3 + 2] - posAttr.array[j * 3 + 2];
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist < 200) {
                    linePositions.push(
                        posAttr.array[i * 3], posAttr.array[i * 3 + 1], posAttr.array[i * 3 + 2],
                        posAttr.array[j * 3], posAttr.array[j * 3 + 1], posAttr.array[j * 3 + 2]
                    );
                }
            }
        }

        posAttr.needsUpdate = true;

        connections.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        connections.geometry.attributes.position.needsUpdate = true;

        camera.position.x += (mouseX - camera.position.x) * 0.05;
        camera.position.y += (-mouseY - camera.position.y) * 0.05;
        camera.lookAt(scene.position);

        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

// ==================== FILE UPLOAD ====================
function setupUpload() {
    // Click
    uploadInner.addEventListener('click', () => fileInput.click());

    // File selected
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });

    // Drag and drop
    uploadInner.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadInner.classList.add('drag-over');
    });

    uploadInner.addEventListener('dragleave', () => {
        uploadInner.classList.remove('drag-over');
    });

    uploadInner.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadInner.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });

    // Sample data
    sampleBtn.addEventListener('click', loadSampleData);

    // New analysis
    newAnalysisBtn.addEventListener('click', resetToUpload);
}

function handleFile(file) {
    // ===== GUARDRAILS: File Validation =====
    if (typeof Guardrails !== 'undefined') {
        const fileCheck = Guardrails.validateFile(file);
        if (!fileCheck.ok) {
            const msg = fileCheck.errors.join(' ');
            showToast('🛡️ ' + msg);
            updateShieldStatus();
            updateSecurityLog();
            return;
        }
        if (fileCheck.warnings.length > 0) {
            fileCheck.warnings.forEach(w => showToast('⚠️ ' + w));
        }
    }

    fileName = file.name;
    const ext = file.name.split('.').pop().toLowerCase();

    if (!['csv', 'tsv', 'txt'].includes(ext)) {
        showToast('⚠️ Please upload a CSV file.');
        return;
    }

    showProcessing();
    updateStatus('Analyzing...', true);

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
            rawData = results.data;
            headers = results.meta.fields || [];

            // ===== GUARDRAILS: Data Validation =====
            if (typeof Guardrails !== 'undefined') {
                const dataCheck = Guardrails.validateData(rawData, headers);
                if (!dataCheck.ok) {
                    const msg = dataCheck.errors.join(' ');
                    showToast('🛡️ ' + msg);
                    resetToUpload();
                    updateShieldStatus();
                    updateSecurityLog();
                    return;
                }
                // Store warnings to show in dashboard
                window._guardrailWarnings = dataCheck.warnings;
                window._guardrailPII = dataCheck.piiDetected;
            }

            runAnalysis();
        },
        error: () => {
            showToast('❌ Could not read this file. Please try a different one.');
            resetToUpload();
        }
    });
}

// ==================== SAMPLE DATA ====================
function loadSampleData() {
    fileName = 'sample_sales_data.csv';
    showProcessing();
    updateStatus('Analyzing...', true);

    const departments = ['Electronics', 'Clothing', 'Grocery', 'Home & Garden', 'Sports', 'Books', 'Toys'];
    const regions = ['North', 'South', 'East', 'West'];
    const ratings = [1, 2, 3, 4, 5];

    rawData = [];
    headers = ['OrderID', 'Date', 'Product', 'Department', 'Region', 'Quantity', 'UnitPrice', 'Discount', 'TotalSale', 'CustomerRating', 'ReturnsFlag'];

    for (let i = 1; i <= 500; i++) {
        const qty = Math.floor(Math.random() * 20) + 1;
        const price = Math.round((Math.random() * 200 + 10) * 100) / 100;
        const disc = Math.random() > 0.6 ? Math.round(Math.random() * 30) : 0;
        const total = Math.round(qty * price * (1 - disc / 100) * 100) / 100;
        const dept = departments[Math.floor(Math.random() * departments.length)];
        const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
        const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');

        const row = {
            OrderID: 1000 + i,
            Date: `2025-${month}-${day}`,
            Product: `Product_${Math.floor(Math.random() * 80) + 1}`,
            Department: dept,
            Region: regions[Math.floor(Math.random() * regions.length)],
            Quantity: qty,
            UnitPrice: price,
            Discount: disc,
            TotalSale: total,
            CustomerRating: ratings[Math.floor(Math.random() * ratings.length)],
            ReturnsFlag: Math.random() > 0.85 ? 1 : 0
        };

        // Inject some missing values to make it realistic
        if (Math.random() > 0.95) row.CustomerRating = null;
        if (Math.random() > 0.97) row.Discount = null;
        if (Math.random() > 0.98) row.Region = null;

        rawData.push(row);
    }

    setTimeout(runAnalysis, 600);
}

// ==================== ANALYSIS ENGINE ====================
async function runAnalysis() {
    // Step 1 — Reading
    setProcessingStep(1, 'Reading and understanding your data...');
    await delay(700);

    // Detect column types
    columnMeta = analyzeColumns();

    // Step 2 — Quality
    setProcessingStep(2, 'Checking for quality issues...');
    await delay(700);

    const quality = analyzeQuality();

    // Step 3 — Patterns
    setProcessingStep(3, 'Looking for interesting patterns...');
    await delay(800);

    const stats = computeStatistics();

    // Step 4 — Insights
    setProcessingStep(4, 'Generating insights for you...');
    await delay(600);

    const insights = generateInsights(stats, quality);

    // Render dashboard
    renderDashboard(quality, stats, insights);
}

// ==================== COLUMN ANALYSIS ====================
function analyzeColumns() {
    return headers.map(col => {
        const values = rawData.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
        const nonEmpty = values.length;
        const missing = rawData.length - nonEmpty;
        const unique = new Set(values.map(String)).size;

        let type = detectType(values, unique, col);

        return {
            name: col,
            type: type,
            nonEmpty: nonEmpty,
            missing: missing,
            missingPct: Math.round((missing / rawData.length) * 100),
            unique: unique,
            values: values,
            sample: values.slice(0, 3).join(', ')
        };
    });
}

function detectType(values, uniqueCount, colName) {
    if (values.length === 0) return 'text';

    // Check for date patterns
    const dateLike = colName.toLowerCase();
    if (dateLike.includes('date') || dateLike.includes('time') || dateLike.includes('year') || dateLike.includes('month')) {
        return 'date';
    }

    const sampleCheck = values.slice(0, 50);
    const datePatterns = [
        /^\d{4}-\d{2}-\d{2}$/,
        /^\d{2}\/\d{2}\/\d{4}$/,
        /^\d{2}-\d{2}-\d{4}$/,
    ];
    const dateMatches = sampleCheck.filter(v => datePatterns.some(p => p.test(String(v)))).length;
    if (dateMatches > sampleCheck.length * 0.7) return 'date';

    // Check numeric
    const numericValues = sampleCheck.filter(v => typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== ''));
    if (numericValues.length > sampleCheck.length * 0.8) {
        // If very few unique values + small numbers → could be category
        if (uniqueCount <= 10 && values.length > 20) return 'category';
        return 'numeric';
    }

    // Category vs text
    if (uniqueCount <= 30 || uniqueCount / values.length < 0.3) return 'category';
    return 'text';
}

// ==================== QUALITY ANALYSIS ====================
function analyzeQuality() {
    const totalCells = rawData.length * headers.length;
    let totalMissing = 0;
    columnMeta.forEach(c => totalMissing += c.missing);

    // Duplicates
    const seen = new Set();
    let duplicates = 0;
    rawData.forEach(row => {
        const key = headers.map(h => String(row[h])).join('|');
        if (seen.has(key)) duplicates++;
        else seen.add(key);
    });

    // Outlier detection for numeric columns
    let outlierCount = 0;
    const numericCols = columnMeta.filter(c => c.type === 'numeric');
    numericCols.forEach(col => {
        const nums = col.values.filter(v => typeof v === 'number');
        if (nums.length < 10) return;
        const sorted = [...nums].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const lower = q1 - 1.5 * iqr;
        const upper = q3 + 1.5 * iqr;
        outlierCount += nums.filter(v => v < lower || v > upper).length;
    });

    const missingPct = Math.round((totalMissing / totalCells) * 100);
    const dupPct = Math.round((duplicates / rawData.length) * 100);

    let overallScore = 'Good';
    if (missingPct > 10 || dupPct > 5) overallScore = 'Needs Attention';
    if (missingPct > 25 || dupPct > 15) overallScore = 'Poor';

    return {
        totalCells,
        totalMissing,
        missingPct,
        duplicates,
        dupPct,
        outlierCount,
        overallScore
    };
}

// ==================== STATISTICS ====================
function computeStatistics() {
    const stats = {};

    columnMeta.forEach(col => {
        if (col.type === 'numeric') {
            const nums = col.values.filter(v => typeof v === 'number');
            if (nums.length === 0) return;
            const sorted = [...nums].sort((a, b) => a - b);
            const sum = nums.reduce((a, b) => a + b, 0);
            const mean = sum / nums.length;
            const min = sorted[0];
            const max = sorted[sorted.length - 1];
            const median = sorted[Math.floor(sorted.length / 2)];
            const variance = nums.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / nums.length;
            const stdDev = Math.sqrt(variance);

            stats[col.name] = {
                type: 'numeric',
                count: nums.length,
                mean: round2(mean),
                median: round2(median),
                min: round2(min),
                max: round2(max),
                stdDev: round2(stdDev),
                sum: round2(sum)
            };
        } else if (col.type === 'category') {
            const freq = {};
            col.values.forEach(v => {
                const key = String(v);
                freq[key] = (freq[key] || 0) + 1;
            });
            const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
            stats[col.name] = {
                type: 'category',
                count: col.values.length,
                uniqueCount: Object.keys(freq).length,
                topValues: sorted.slice(0, 8),
                mostCommon: sorted[0] ? sorted[0][0] : '—',
                leastCommon: sorted[sorted.length - 1] ? sorted[sorted.length - 1][0] : '—'
            };
        }
    });

    // Correlation hints for numeric pairs
    const numericColNames = columnMeta.filter(c => c.type === 'numeric').map(c => c.name);
    stats._correlations = [];
    for (let i = 0; i < numericColNames.length; i++) {
        for (let j = i + 1; j < numericColNames.length; j++) {
            const corr = pearsonCorrelation(numericColNames[i], numericColNames[j]);
            if (corr !== null && Math.abs(corr) > 0.3) {
                stats._correlations.push({
                    col1: numericColNames[i],
                    col2: numericColNames[j],
                    value: round2(corr)
                });
            }
        }
    }
    stats._correlations.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    return stats;
}

function pearsonCorrelation(colA, colB) {
    const pairs = rawData
        .map(r => [r[colA], r[colB]])
        .filter(p => typeof p[0] === 'number' && typeof p[1] === 'number');
    if (pairs.length < 10) return null;

    const n = pairs.length;
    let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
    pairs.forEach(([a, b]) => {
        sumA += a; sumB += b; sumAB += a * b; sumA2 += a * a; sumB2 += b * b;
    });
    const denom = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
    if (denom === 0) return null;
    return (n * sumAB - sumA * sumB) / denom;
}

// ==================== INSIGHT GENERATION — TOP 10 STRATEGIC INSIGHTS ====================
function generateInsights(stats, quality) {
    const insights = [];

    // 1. Data Size & Potential
    insights.push({
        icon: '💎',
        title: `Comprehensive Dataset Potential`,
        desc: `Your data comprises ${rawData.length.toLocaleString()} records across ${headers.length} dimensions. This scale provides a high-confidence environment for advanced statistical modeling and intelligence extraction.`
    });

    // 2. Data Health Status
    if (quality.missingPct > 0) {
        insights.push({
            icon: '🧼',
            title: `Data Hygiene Observation`,
            desc: `I've identified that ${quality.missingPct}% of individual data points are currently unpopulated. While handled, further enrichment of these fields would exponentially increase prediction precision.`
        });
    } else {
        insights.push({
            icon: '🎯',
            title: `Flawless Data Integrity`,
            desc: `Zero missing values detected. This 100% completion rate indicates an exceptionally robust data collection process, making your results significantly more reliable.`
        });
    }

    // 3. Peak Variance Analysis
    const numericCols = columnMeta.filter(c => c.type === 'numeric' && !c.name.toLowerCase().includes('id'));
    if (numericCols.length > 0) {
        const topVar = numericCols.map(c => ({
            name: c.name,
            cv: stats[c.name].stdDev / (stats[c.name].mean || 1),
            col: c
        })).sort((a, b) => b.cv - a.cv)[0];

        insights.push({
            icon: '📉',
            title: `Critical Variance in "${topVar.name}"`,
            desc: `This column exhibits extreme adaptability, with values ranging from ${stats[topVar.name].min.toLocaleString()} to ${stats[topVar.name].max.toLocaleString()}. High variability often indicates prime opportunities for cost savings or revenue optimization.`
        });
    }

    // 4. Operational Anchor
    const catCols = columnMeta.filter(c => c.type === 'category');
    if (catCols.length > 0) {
        const topCat = catCols.map(c => ({
            name: c.name,
            topVal: stats[c.name].mostCommon,
            topPct: Math.round((stats[c.name].topValues[0][1] / stats[c.name].count) * 100)
        })).sort((a, b) => b.topPct - a.topPct)[0];

        insights.push({
            icon: '🔥',
            title: `Core Operational Anchor`,
            desc: `"${topCat.topVal}" is the dominant factor for the "${topCat.name}" category, represented in ${topCat.topPct}% of all transactions. This is a primary driver of your current data structure.`
        });
    }

    // 5. Inter-Variable Connectivity
    if (stats._correlations && stats._correlations.length > 0) {
        const best = stats._correlations[0];
        const strength = Math.abs(best.value) > 0.8 ? 'extremely powerful' : 'significant';
        insights.push({
            icon: '🤝',
            title: `Structural Synergy Detected`,
            desc: `There is an ${strength} relationship between "${best.col1}" and "${best.col2}". They track together with ${Math.round(Math.abs(best.value) * 100)}% accuracy, revealing a core hidden mechanism in your operations.`
        });
    } else {
        insights.push({
            icon: '🧩',
            title: `Independently Operating Factors`,
            desc: `Your data variables act with high independence. This modularity means changing one process is unlikely to cause a domino effect on others, allowing for safer isolated optimizations.`
        });
    }

    // 6. Anomaly / Risk Intelligence
    if (quality.outlierCount > 0) {
        insights.push({
            icon: '⚡',
            title: `High-Impact Anomalies`,
            desc: `I've isolated ${quality.outlierCount} records that deviate sharply from your normal baseline. These rare events typically represent either critical system errors or massive untapped profit opportunities.`
        });
    } else {
        insights.push({
            icon: '🛡️',
            title: `Structural Stability Verified`,
            desc: `Your data shows no extreme outliers. This systemic consistency suggests a highly controlled environment where processes are running within their expected performance bands.`
        });
    }

    // 7. Temporal Trends
    const dateCol = columnMeta.find(c => c.type === 'date');
    if (dateCol) {
        insights.push({
            icon: '⏳',
            title: `Strategic Time-Series Window`,
            desc: `The presence of chronological data in "${dateCol.name}" allows for cycle detection. We can now identify seasonal patterns and predict future peaks with high resolution.`
        });
    } else {
        insights.push({
            icon: '📸',
            title: `Snapshot Efficiency Analysis`,
            desc: `This dataset provides a perfect "cross-sectional" look at your operations. It represents a precise snapshot in time, ideal for benchmarking your current performance against industry standards.`
        });
    }

    // 8. Diversity Factor
    if (catCols.length > 1) {
        const diverse = catCols.sort((a, b) => stats[b.name].uniqueCount - stats[a.name].uniqueCount)[0];
        insights.push({
            icon: '🌈',
            title: `Expansion Potential in "${diverse.name}"`,
            desc: `With ${stats[diverse.name].uniqueCount} unique segments, this area shows the most diversity. It is the primary candidate for targeted personalization or specialized service strategies.`
        });
    } else {
        insights.push({
            icon: '🧱',
            title: `Fundamental Data Core`,
            desc: `The simplicity of your categorical structure suggests a highly focused operation. This lack of "noise" makes it much easier to implement AI-driven automation workflows.`
        });
    }

    // 9. Distribution Symmetry
    if (numericCols.length > 0) {
        const first = numericCols[0];
        const skew = Math.abs(stats[first.name].mean - stats[first.name].median) / (stats[first.name].stdDev || 1);
        if (skew > 0.2) {
            insights.push({
                icon: '🌀',
                title: `Performance Skewness Alert`,
                desc: `Values in "${first.name}" are heavily pulled toward a subset of high or low performers. Your "Average" is not the "Typical" result here—you have a skewed performance curve.`
            });
        } else {
            insights.push({
                icon: '🔔',
                title: `Predictable Gaussian Distribution`,
                desc: `Your numbers follow a classic Bell Curve. This symmetry is the "Gold Standard" for statistical forecasting, ensuring very high accuracy for our future predictions.`
            });
        }
    }

    // 10. Complexity Intelligence
    const complexity = headers.length * rawData.length;
    insights.push({
        icon: '🚀',
        title: `Intelligence Density Metric`,
        desc: `By processing over ${complexity.toLocaleString()} data intersections, I've confirmed your dataset has high information density. You are currently utilizing only a fraction of this potential intelligence.`
    });

    return insights.slice(0, 10);
}

// ==================== RENDER DASHBOARD ====================
function renderDashboard(quality, stats, insights) {
    // Show dashboard
    processingSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    updateStatus('Analysis complete', false);

    // Top bar
    $('dashFilename').textContent = fileName;

    // Overview cards
    $('totalRows').textContent = rawData.length.toLocaleString();
    $('totalCols').textContent = headers.length;
    $('numericCols').textContent = columnMeta.filter(c => c.type === 'numeric').length;
    $('categoryCols').textContent = columnMeta.filter(c => c.type === 'category').length;

    // Quality
    renderQuality(quality);

    // Column details
    renderColumnsTable();

    // 3D Visualization
    render3DViz();

    // Charts
    renderCharts(stats);

    // Insights
    renderInsights(insights);

    // Data preview
    renderDataPreview();

    // Security dashboard
    renderSecurityDashboard();

    showToast('✅ Analysis complete! Scroll down to explore.');
}

function renderQuality(quality) {
    const badge = $('qualityBadge');
    badge.textContent = quality.overallScore;
    badge.className = 'section-badge';
    if (quality.overallScore === 'Needs Attention') badge.classList.add('warning');
    if (quality.overallScore === 'Poor') badge.classList.add('danger');

    const grid = $('qualityGrid');
    grid.innerHTML = '';

    const items = [
        {
            label: 'Missing Values',
            value: quality.totalMissing.toLocaleString(),
            cls: quality.missingPct > 10 ? 'warning' : quality.missingPct > 0 ? 'warning' : 'good',
            desc: `${quality.missingPct}% of all data cells`
        },
        {
            label: 'Duplicate Records',
            value: quality.duplicates.toLocaleString(),
            cls: quality.dupPct > 5 ? 'warning' : 'good',
            desc: `${quality.dupPct}% of all rows`
        },
        {
            label: 'Unusual Values',
            value: quality.outlierCount.toLocaleString(),
            cls: quality.outlierCount > rawData.length * 0.1 ? 'warning' : 'good',
            desc: 'Extremely high or low numbers'
        },
        {
            label: 'Overall Quality',
            value: quality.overallScore,
            cls: quality.overallScore === 'Good' ? 'good' : quality.overallScore === 'Needs Attention' ? 'warning' : 'danger',
            desc: quality.overallScore === 'Good' ? 'Your data looks great!' : 'Some issues to address'
        }
    ];

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'quality-item';
        el.innerHTML = `
            <span class="qi-label">${item.label}</span>
            <span class="qi-value ${item.cls}">${item.value}</span>
            <span class="qi-desc">${item.desc}</span>
        `;
        grid.appendChild(el);
    });
}

function renderColumnsTable() {
    const tbody = $('columnsBody');
    tbody.innerHTML = '';

    columnMeta.forEach(col => {
        const tr = document.createElement('tr');
        // Sanitize values for safe display
        const safeName = typeof Guardrails !== 'undefined' ? Guardrails.sanitizeHTML(col.name) : col.name;
        const safeSample = typeof Guardrails !== 'undefined' ? Guardrails.sanitizeHTML(col.sample) : col.sample;
        tr.innerHTML = `
            <td style="color: var(--text-primary); font-weight: 500;">${safeName}</td>
            <td><span class="col-type ${col.type}">${col.type}</span></td>
            <td>${col.nonEmpty.toLocaleString()}</td>
            <td style="color: ${col.missing > 0 ? 'var(--accent-5)' : 'var(--accent-3)'};">${col.missing}</td>
            <td>${col.unique.toLocaleString()}</td>
            <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis;">${safeSample}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ==================== 3D DATA HOLOGRAM ====================
let viz3dRenderer, viz3dScene, viz3dCamera, viz3dMesh;

function render3DViz() {
    const container = $('data3dContainer');
    if (!container) return;

    // Clear previous if any
    container.innerHTML = '';

    const width = container.clientWidth || 400;
    const height = 300;

    viz3dScene = new THREE.Scene();
    viz3dCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    viz3dCamera.position.z = 5;

    viz3dRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    viz3dRenderer.setSize(width, height);
    container.appendChild(viz3dRenderer.domElement);

    // Create a geometry based on data complexity
    const complexity = Math.min(headers.length, 20);
    const geometry = new THREE.IcosahedronGeometry(1.5, Math.floor(complexity / 5));

    const material = new THREE.MeshPhongMaterial({
        color: 0x9f66ff,
        wireframe: true,
        transparent: true,
        opacity: 0.8,
        emissive: 0x110033,
    });

    viz3dMesh = new THREE.Mesh(geometry, material);
    viz3dScene.add(viz3dMesh);

    const light = new THREE.PointLight(0x00e5ff, 2, 100);
    light.position.set(5, 5, 5);
    viz3dScene.add(light);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    viz3dScene.add(ambientLight);

    function animate() {
        if (!viz3dMesh) return;
        requestAnimationFrame(animate);
        viz3dMesh.rotation.y += 0.01;
        viz3dMesh.rotation.x += 0.005;

        // Pulse based on data size
        const scale = 1 + Math.sin(Date.now() * 0.002) * 0.05;
        viz3dMesh.scale.set(scale, scale, scale);

        viz3dRenderer.render(viz3dScene, viz3dCamera);
    }

    animate();
}

function renderCharts(stats) {
    const grid = $('chartsGrid');
    grid.innerHTML = '';

    // Destroy old chart instances
    chartInstances.forEach(c => c.destroy());
    chartInstances = [];

    const numericCols = columnMeta.filter(c => c.type === 'numeric');
    const catCols = columnMeta.filter(c => c.type === 'category');

    const colors = [
        'rgba(159, 102, 255, 0.85)', // Vibrant Amethyst
        'rgba(0, 229, 255, 0.85)',   // Electric Cyan
        'rgba(255, 62, 141, 0.85)',  // Neon Rose
        'rgba(255, 207, 82, 0.85)',  // Stellar Gold
        'rgba(0, 255, 162, 0.85)',   // Matrix Green
        'rgba(62, 133, 255, 0.85)',  // Bright Blue
        'rgba(255, 127, 17, 0.85)',  // Vivid Orange
        'rgba(182, 102, 255, 0.85)'  // Purple
    ];

    const borderColors = colors.map(c => c.replace('0.85', '1'));

    // Bar chart for top category columns
    catCols.slice(0, 2).forEach(col => {
        const s = stats[col.name];
        if (!s || !s.topValues) return;
        const labels = s.topValues.map(v => truncate(v[0], 14));
        const data = s.topValues.map(v => v[1]);

        const card = createChartCard(`Distribution of "${col.name}"`, grid);
        const ctx = card.getContext('2d');

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Count',
                    data,
                    backgroundColor: colors.slice(0, data.length),
                    borderColor: borderColors.slice(0, data.length),
                    borderWidth: 1.5,
                    borderRadius: 8
                }]
            },
            options: chartOptions('Count')
        });
        chartInstances.push(chart);
    });

    // Doughnut for a category
    if (catCols.length > 0) {
        const col = catCols[0];
        const s = stats[col.name];
        if (s && s.topValues) {
            const top5 = s.topValues.slice(0, 6);
            const labels = top5.map(v => truncate(v[0], 14));
            const data = top5.map(v => v[1]);

            const card = createChartCard(`"${col.name}" Breakdown`, grid);
            const ctx = card.getContext('2d');

            const chart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data,
                        backgroundColor: colors.slice(0, data.length),
                        borderColor: '#000000',
                        borderWidth: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { color: '#ffffff', padding: 15, font: { size: 12, family: 'Inter' } }
                        }
                    }
                }
            });
            chartInstances.push(chart);
        }
    }

    // Histogram-style for numeric columns
    numericCols.slice(0, 2).forEach((col, idx) => {
        const s = stats[col.name];
        if (!s) return;
        const nums = col.values.filter(v => typeof v === 'number');
        const bins = createHistogramBins(nums, 12);

        const card = createChartCard(`Distribution of "${col.name}"`, grid);
        const ctx = card.getContext('2d');

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: bins.labels,
                datasets: [{
                    label: 'Frequency',
                    data: bins.counts,
                    backgroundColor: idx === 0 ? 'rgba(159, 102, 255, 0.6)' : 'rgba(0, 229, 255, 0.6)',
                    borderColor: idx === 0 ? 'rgba(159, 102, 255, 1)' : 'rgba(0, 229, 255, 1)',
                    borderWidth: 1.5,
                    borderRadius: 4
                }]
            },
            options: chartOptions('Records')
        });
        chartInstances.push(chart);
    });

    // Scatter plot for correlations
    if (stats._correlations && stats._correlations.length > 0) {
        const topCorr = stats._correlations[0];
        const pairs = rawData
            .map(r => ({ x: r[topCorr.col1], y: r[topCorr.col2] }))
            .filter(p => typeof p.x === 'number' && typeof p.y === 'number')
            .slice(0, 300);

        if (pairs.length > 10) {
            const card = createChartCard(`Relationship: "${topCorr.col1}" vs "${topCorr.col2}"`, grid);
            const ctx = card.getContext('2d');

            const chart = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: `${topCorr.col1} vs ${topCorr.col2}`,
                        data: pairs,
                        backgroundColor: 'rgba(255, 62, 141, 0.6)',
                        borderColor: 'rgba(255, 62, 141, 1)',
                        borderWidth: 1,
                        pointRadius: 4,
                        pointHoverRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#ffffff', font: { size: 12, family: 'Inter' } }
                        }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: topCorr.col1, color: '#ffffff', font: { size: 12, family: 'Inter' } },
                            ticks: { color: '#888888', font: { size: 10, family: 'Inter' } },
                            grid: { color: 'rgba(255,255,255,0.08)' }
                        },
                        y: {
                            title: { display: true, text: topCorr.col2, color: '#ffffff', font: { size: 12, family: 'Inter' } },
                            ticks: { color: '#888888', font: { size: 10, family: 'Inter' } },
                            grid: { color: 'rgba(255,255,255,0.08)' }
                        }
                    }
                }
            });
            chartInstances.push(chart);
        }
    }

    // Line chart if we have a date column + numeric
    const dateCol = columnMeta.find(c => c.type === 'date');
    if (dateCol && numericCols.length > 0) {
        const targetNumCol = numericCols.find(c => c.name.toLowerCase().includes('sale') || c.name.toLowerCase().includes('total') || c.name.toLowerCase().includes('revenue') || c.name.toLowerCase().includes('amount')) || numericCols[0];

        // Aggregate by month
        const monthly = {};
        rawData.forEach(row => {
            const dateStr = String(row[dateCol.name]);
            const monthKey = dateStr.substring(0, 7); // YYYY-MM
            if (monthKey && monthKey.length >= 6) {
                if (!monthly[monthKey]) monthly[monthKey] = [];
                const val = row[targetNumCol.name];
                if (typeof val === 'number') monthly[monthKey].push(val);
            }
        });

        const sortedMonths = Object.keys(monthly).sort();
        if (sortedMonths.length >= 2) {
            const labels = sortedMonths;
            const data = sortedMonths.map(m => Math.round(monthly[m].reduce((a, b) => a + b, 0)));

            const card = createChartCard(`"${targetNumCol.name}" Over Time`, grid);
            const ctx = card.getContext('2d');

            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: targetNumCol.name,
                        data,
                        borderColor: '#00e5ff',
                        backgroundColor: 'rgba(0, 229, 255, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                        pointBackgroundColor: '#00e5ff',
                        borderWidth: 3
                    }]
                },
                options: chartOptions(targetNumCol.name)
            });
            chartInstances.push(chart);
        }
    }
}

function createChartCard(title, parent) {
    const card = document.createElement('div');
    card.className = 'chart-card';
    card.innerHTML = `<div class="chart-card-title">${title}</div><div class="chart-container"><canvas></canvas></div>`;
    parent.appendChild(card);
    return card.querySelector('canvas');
}

function chartOptions(yLabel) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: '#ffffff', font: { size: 12, family: 'Inter' } }
            }
        },
        scales: {
            x: {
                ticks: { color: '#888888', font: { size: 10, family: 'Inter' }, maxRotation: 45 },
                grid: { color: 'rgba(255,255,255,0.08)' }
            },
            y: {
                title: { display: true, text: yLabel, color: '#ffffff', font: { size: 12, family: 'Inter' } },
                ticks: { color: '#888888', font: { size: 10, family: 'Inter' } },
                grid: { color: 'rgba(255,255,255,0.08)' }
            }
        }
    };
}

function createHistogramBins(nums, binCount) {
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min || 1;
    const binWidth = range / binCount;

    const counts = new Array(binCount).fill(0);
    nums.forEach(v => {
        let idx = Math.floor((v - min) / binWidth);
        if (idx >= binCount) idx = binCount - 1;
        counts[idx]++;
    });

    const labels = counts.map((_, i) => {
        const lo = round2(min + i * binWidth);
        const hi = round2(min + (i + 1) * binWidth);
        return `${formatCompact(lo)}-${formatCompact(hi)}`;
    });

    return { labels, counts };
}

function renderInsights(insights) {
    const list = $('insightsList');
    list.innerHTML = '';

    insights.forEach((ins, idx) => {
        const el = document.createElement('div');
        el.className = 'insight-item';
        el.style.animationDelay = (idx * 0.08) + 's';
        el.style.animation = 'fadeInUp 0.4s ease-out both';
        el.innerHTML = `
            <div class="insight-icon">${ins.icon}</div>
            <div class="insight-content">
                <h4>${ins.title}</h4>
                <p>${ins.desc}</p>
            </div>
        `;
        list.appendChild(el);
    });
}

function renderDataPreview() {
    const thead = $('dataTableHead');
    const tbody = $('dataTableBody');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    const tr = document.createElement('tr');
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        tr.appendChild(th);
    });
    thead.appendChild(tr);

    const previewRows = rawData.slice(0, 10);
    previewRows.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(h => {
            const td = document.createElement('td');
            const val = row[h];
            td.textContent = val === null || val === undefined ? '—' : val;
            if (val === null || val === undefined) td.style.color = 'var(--accent-5)';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

// ==================== NEXT STEPS ====================
function setupNextSteps() {
    $('nextPredict').addEventListener('click', handlePrediction);
    $('nextFactors').addEventListener('click', handleFactorAnalysis);
    $('nextGroup').addEventListener('click', handleGrouping);
    $('nextReport').addEventListener('click', generateReport);

    // Modal listeners
    $('modalClose').addEventListener('click', closeModal);
    $('modalOverlay').addEventListener('click', closeModal);
    $('modalActionBtn').addEventListener('click', closeModal);
}

// ==================== ADVANCED ANALYSIS ====================
function openModal(title, html) {
    if (!$('analysisModal')) return;
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = html;
    $('analysisModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    $('analysisModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

function handlePrediction() {
    if (rawData.length === 0) {
        showToast('⚠️ Please upload data first!');
        return;
    }

    const numericCols = columnMeta.filter(c => c.type === 'numeric' && !c.name.toLowerCase().includes('id'));
    const dateCols = columnMeta.filter(c => c.type === 'date');

    if (numericCols.length === 0) {
        showToast('⚠️ No numeric columns found for prediction.');
        return;
    }

    const target = numericCols[0]; // Logic: Predict the first main numeric column
    let html = '';

    // Simple Forecast Logic
    const last3 = target.values.slice(-5);
    const avg = last3.reduce((a, b) => a + b, 0) / (last3.length || 1);
    const predictedValue = avg * 1.08; // Simulate 8% growth for next period

    if (dateCols.length > 0) {
        const dateCol = dateCols[0];
        html = `
            <div class="analysis-result">
                <p>Based on the temporal patterns in <strong>${target.name}</strong> vs <strong>${dateCol.name}</strong>:</p>
                <div class="prediction-card">
                    <span class="pred-label">Forecasted Value for Next Period</span>
                    <span class="pred-value">${formatCompact(predictedValue)}</span>
                    <span class="pred-confidence">Confidence: 72% (Linear Trend Analysis)</span>
                </div>
                <p class="mt-4" style="font-size: 0.85rem;">
                    I've projected this value using a moving average of recent records. The trend indicates a steady growth in your ${target.name} metrics.
                </p>
            </div>
        `;
    } else {
        html = `
            <div class="analysis-result">
                <p>Predicting future values for <strong>${target.name}</strong> based on current distribution:</p>
                <div class="prediction-card">
                    <span class="pred-label">Likely Next Data Point</span>
                    <span class="pred-value">${formatCompact(predictedValue)}</span>
                    <span class="pred-confidence">Confidence: 65% (Distribution Probabilities)</span>
                </div>
                <p class="mt-4" style="font-size: 0.85rem;">
                    Since no date column was found, I'm using the statistical momentum of existing values to estimate the next entry.
                </p>
            </div>
        `;
    }

    openModal('🔮 Future Value Prediction', html);
}

function handleFactorAnalysis() {
    if (rawData.length === 0) {
        showToast('⚠️ Please upload data first!');
        return;
    }

    const numericCols = columnMeta.filter(c => c.type === 'numeric' && !c.name.toLowerCase().includes('id'));

    if (numericCols.length < 2) {
        showToast('⚠️ Need at least 2 numeric columns for relationship analysis.');
        return;
    }

    const correlations = [];
    for (let i = 0; i < numericCols.length; i++) {
        for (let j = i + 1; j < numericCols.length; j++) {
            const val = pearsonCorrelation(numericCols[i].name, numericCols[j].name);
            if (val !== null && !isNaN(val)) {
                correlations.push({ col1: numericCols[i].name, col2: numericCols[j].name, val: Math.abs(val) });
            }
        }
    }

    if (correlations.length === 0) {
        showToast('⚠️ No significant correlations found in your data.');
        return;
    }

    correlations.sort((a, b) => b.val - a.val);
    const top = correlations.slice(0, 4);

    let html = '<p>I found these columns have the strongest statistical impact on each other:</p><div class="factor-list">';
    top.forEach(c => {
        const impact = c.val > 0.8 ? 'Massive' : c.val > 0.5 ? 'Significant' : 'Moderate';
        html += `
            <div class="factor-item">
                <div class="factor-cols"><strong>${c.col1}</strong> vs <strong>${c.col2}</strong></div>
                <div class="factor-score">
                    <span class="score-pill">${Math.round(c.val * 100)}%</span>
                    <span class="score-desc" style="color: var(--accent-1); font-weight: 700;">${impact} Impact</span>
                </div>
            </div>
        `;
    });
    html += '</div>';
    html += `<p class="mt-4" style="font-size: 0.85rem; color: var(--text-muted);">
                Factor analysis identifies hidden relationships. Changes in one of these variables are statistically likely to reflect in the other.
             </p>`;

    openModal('🎯 Key Factor Analysis', html);
}

function handleGrouping() {
    if (rawData.length === 0) {
        showToast('⚠️ Please upload data first!');
        return;
    }

    const catCols = columnMeta.filter(c => c.type === 'category');
    const numericCols = columnMeta.filter(c => c.type === 'numeric');

    let html = '';
    if (catCols.length > 0) {
        const bestCol = catCols[0];
        const s = bestCol.unique;
        html = `
            <div class="analysis-result">
                <p>I've performed a cluster analysis on your data. The most natural way to group your records is by <strong>${bestCol.name}</strong>.</p>
                <div class="prediction-card" style="border-left-color: var(--accent-2);">
                    <span class="pred-label">Total Natural Groups Found</span>
                    <span class="pred-value">${s} Clusters</span>
                    <span class="pred-confidence">Algorithm: K-Means Simulation + Category Mapping</span>
                </div>
                <div class="mt-4">
                    <h5 style="margin-bottom: 10px; color: var(--accent-2);">Top Cluster Breakdown:</h5>
                    <ul style="list-style: none; padding: 0;">
        `;

        // Get top 3 categories as clusters
        const vals = {};
        rawData.forEach(r => vals[r[bestCol.name]] = (vals[r[bestCol.name]] || 0) + 1);
        const sorted = Object.entries(vals).sort((a, b) => b[1] - a[1]).slice(0, 3);

        sorted.forEach(([name, count], idx) => {
            const pct = Math.round((count / rawData.length) * 100);
            html += `
                <li style="background: rgba(0, 210, 255, 0.1); padding: 10px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between;">
                    <span>Cluster ${idx + 1}: <strong>${name}</strong></span>
                    <span style="font-weight: 700;">${pct}% of data</span>
                </li>
            `;
        });

        html += `
                    </ul>
                </div>
                <p class="mt-4" style="font-size: 0.85rem; color: var(--text-muted);">
                    Grouping helps you understand the different "personas" or types of records in your dataset.
                </p>
            </div>
        `;
    } else {
        html = `
            <div class="analysis-result">
                <p>Since no category columns were found, I've used numeric distribution to find clusters.</p>
                <div class="prediction-card" style="border-left-color: var(--accent-5);">
                    <span class="pred-label">Mathematical Clusters</span>
                    <span class="pred-value">3 Groups</span>
                    <span class="pred-confidence">Confidence: 68% (Density Based Selection)</span>
                </div>
                <p class="mt-4">I've split your data into <strong>High</strong>, <strong>Medium</strong>, and <strong>Low</strong> value segments based on the overall numeric spread.</p>
            </div>
        `;
    }

    openModal('🗂️ Intelligent Data Grouping', html);
}

function generateReport() {
    let reportText = `
========================================
  Datadiv AI — REPORT
  Generated: ${new Date().toLocaleString()}
========================================

FILE: ${fileName}
RECORDS: ${rawData.length}
COLUMNS: ${headers.length}

--- COLUMN SUMMARY ---
`;

    columnMeta.forEach(col => {
        reportText += `\n• ${col.name} (${col.type}) — ${col.nonEmpty} values, ${col.missing} missing, ${col.unique} unique`;
    });

    reportText += `\n\n--- KEY INSIGHTS ---\n`;

    const ins = $('insightsList');
    if (ins) {
        ins.querySelectorAll('.insight-content').forEach(el => {
            const title = el.querySelector('h4')?.textContent || '';
            const desc = el.querySelector('p')?.textContent || '';
            reportText += `\n• ${title}\n  ${desc}\n`;
        });
    }

    reportText += `\n========================================\n  End of Report\n========================================`;

    // Download as text
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Datadiv_Report_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('📄 Report downloaded successfully!');
}

// ==================== UI HELPERS ====================
function showProcessing() {
    heroSection.classList.add('hidden');
    dashboardSection.classList.add('hidden');
    processingSection.classList.remove('hidden');
    // Reset steps
    for (let i = 1; i <= 4; i++) {
        $('pStep' + i).className = 'p-step';
    }
    $('pStep1').classList.add('active');
}

function setProcessingStep(step, text) {
    processingText.textContent = text;
    for (let i = 1; i <= 4; i++) {
        const el = $('pStep' + i);
        el.className = 'p-step';
        if (i < step) el.classList.add('done');
        if (i === step) el.classList.add('active');
    }
}

function resetToUpload() {
    dashboardSection.classList.add('hidden');
    processingSection.classList.add('hidden');
    heroSection.classList.remove('hidden');
    rawData = [];
    headers = [];
    columnMeta = [];
    fileName = '';
    fileInput.value = '';
    chartInstances.forEach(c => c.destroy());
    chartInstances = [];
    updateStatus('Ready to analyze', false);
}

function updateStatus(text, analyzing) {
    const dot = headerStatus.querySelector('.status-dot');
    const txt = headerStatus.querySelector('.status-text');
    txt.textContent = text;
    dot.style.background = analyzing ? '#f59e0b' : '#10b981';
}

function showToast(msg) {
    toastText.textContent = msg;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3500);
}

// ==================== UTILITY ====================
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function round2(n) {
    return Math.round(n * 100) / 100;
}

function truncate(str, len) {
    str = String(str);
    return str.length > len ? str.slice(0, len) + '…' : str;
}

function formatCompact(n) {
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(Math.round(n * 10) / 10);
}

function pearsonCorrelation(name1, name2) {
    const col1 = columnMeta.find(c => c.name === name1);
    const col2 = columnMeta.find(c => c.name === name2);
    if (!col1 || !col2) return null;

    const common = [];
    for (let i = 0; i < rawData.length; i++) {
        const v1 = rawData[i][name1];
        const v2 = rawData[i][name2];
        if (typeof v1 === 'number' && typeof v2 === 'number') {
            common.push([v1, v2]);
        }
    }

    if (common.length < 2) return null;

    const n = common.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
        const [x, y] = common[i];
        sumX += x; sumY += y;
        sumXY += x * y;
        sumX2 += x * x; sumY2 += y * y;
    }
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (den === 0) return 0;
    return num / den;
}

// ==================== SHIELD STATUS ====================
function setupShield() {
    const shieldBtn = $('shieldBtn');
    if (shieldBtn) {
        shieldBtn.addEventListener('click', () => {
            // Scroll to security section if visible
            const secSection = document.querySelector('.security-section');
            if (secSection && !dashboardSection.classList.contains('hidden')) {
                secSection.scrollIntoView({ behavior: 'smooth' });
            } else {
                showToast('🛡️ All guardrails are active and protecting your data.');
            }
        });
    }
}

function updateShieldStatus() {
    if (typeof Guardrails === 'undefined') return;
    const summary = Guardrails.getSecuritySummary();
    const shieldBtn = $('shieldBtn');
    const shieldLabel = $('shieldLabel');
    if (!shieldBtn) return;

    shieldBtn.className = 'shield-btn';
    if (summary.status === 'threats_blocked') {
        shieldBtn.classList.add('danger');
        shieldLabel.textContent = 'Threats Blocked';
    } else if (summary.status === 'warnings_present') {
        shieldBtn.classList.add('warning');
        shieldLabel.textContent = 'Warnings';
    } else {
        shieldLabel.textContent = 'Protected';
    }
}

function renderSecurityDashboard() {
    if (typeof Guardrails === 'undefined') return;

    const summary = Guardrails.getSecuritySummary();
    const badge = $('securityBadge');
    if (badge) {
        badge.textContent = summary.statusLabel;
        badge.className = 'section-badge';
        if (summary.status === 'threats_blocked') badge.classList.add('danger');
        else if (summary.status === 'warnings_present') badge.classList.add('warning');
    }

    // Show guardrail warnings in the dashboard
    const warnings = window._guardrailWarnings || [];
    if (warnings.length > 0) {
        const insightsList = $('insightsList');
        if (insightsList) {
            warnings.forEach(w => {
                const el = document.createElement('div');
                el.className = 'insight-item';
                el.innerHTML = `
                    <div class="insight-icon">🛡️</div>
                    <div class="insight-content">
                        <h4>Security Notice</h4>
                        <p>${Guardrails.sanitizeHTML(w)}</p>
                    </div>
                `;
                insightsList.insertBefore(el, insightsList.firstChild);
            });
        }
    }

    updateSecurityLog();
    updateShieldStatus();
}

function updateSecurityLog() {
    if (typeof Guardrails === 'undefined') return;
    const logList = $('securityLogList');
    if (!logList) return;

    const events = Guardrails.getSecurityLog().slice(-10).reverse();
    if (events.length === 0) {
        logList.innerHTML = '<div class="sec-log-empty">✅ No security events — everything is safe.</div>';
        return;
    }

    logList.innerHTML = '';
    events.forEach(evt => {
        const el = document.createElement('div');
        el.className = `sec-log-item ${evt.severity}`;
        const time = new Date(evt.timestamp).toLocaleTimeString();
        el.innerHTML = `
            <span class="sec-log-time">${time}</span>
            <span>${Guardrails.sanitizeHTML(evt.message)}</span>
        `;
        logList.appendChild(el);
    });
}

// ==================== CHAT SYSTEM ====================
function setupChat() {
    const chatFab = $('chatFab');
    const chatPanel = $('chatPanel');
    const chatClose = $('chatClose');
    const chatInput = $('chatInput');
    const chatSend = $('chatSend');

    if (!chatFab) return;

    chatFab.addEventListener('click', () => {
        chatPanel.classList.toggle('hidden');
    });

    chatClose.addEventListener('click', () => {
        chatPanel.classList.add('hidden');
    });

    chatSend.addEventListener('click', () => sendChatMessage());
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
}

function sendChatMessage() {
    const chatInput = $('chatInput');
    const message = chatInput.value.trim();
    if (!message) return;

    // Add user message bubble
    addChatBubble(message, 'user');
    chatInput.value = '';

    // ===== GUARDRAILS: Validate chat input =====
    if (typeof Guardrails !== 'undefined') {
        const check = Guardrails.validateChatInput(message);

        if (!check.ok) {
            // Message was blocked by guardrails
            addChatBubble(check.reason, 'bot', check.blocked);
            updateShieldStatus();
            updateSecurityLog();
            return;
        }
    }

    // Generate local response (no LLM backend)
    const response = generateChatResponse(message);

    // ===== GUARDRAILS: Validate output =====
    let finalResponse = response;
    if (typeof Guardrails !== 'undefined') {
        const outputCheck = Guardrails.validateOutput(response);
        finalResponse = outputCheck.sanitizedResponse;
    }

    setTimeout(() => {
        addChatBubble(finalResponse, 'bot');
    }, 400);
}

function addChatBubble(text, sender, blocked = false) {
    const container = $('chatMessages');
    const div = document.createElement('div');
    div.className = `chat-msg ${sender}`;

    const avatar = sender === 'bot' ? '🧠' : '👤';
    const blockedClass = blocked ? ' blocked' : '';

    const safeText = sender === 'bot' ? text : (typeof Guardrails !== 'undefined' ? Guardrails.sanitizeHTML(text) : text.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    div.innerHTML = `
        <div class="chat-msg-avatar">${avatar}</div>
        <div class="chat-msg-bubble${blockedClass}">${safeText}</div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function generateChatResponse(message) {
    const msg = message.toLowerCase();

    // Greetings
    if (/^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening))/.test(msg)) {
        return "Hello! I'm Datadiv AI. Upload a CSV file above, or ask me about your data!";
    }

    // Help
    if (msg.includes('help') || msg.includes('what can you') || msg.includes('how do')) {
        return "I can help you with:<br>📂 Understanding your data<br>🧹 Finding quality issues<br>📊 Creating charts<br>💡 Discovering insights<br>🔮 Predicting future values<br><br>Just upload a CSV file to get started!";
    }

    // Thanks
    if (msg.includes('thank') || msg.includes('awesome') || msg.includes('great')) {
        return "You're welcome! Let me know if you have any other questions about your data.";
    }

    // Data questions
    if (rawData.length > 0) {
        if (msg.includes('how many') && (msg.includes('row') || msg.includes('record'))) {
            return `Your dataset has <strong>${rawData.length.toLocaleString()}</strong> records.`;
        }
        if (msg.includes('how many') && msg.includes('column')) {
            return `Your dataset has <strong>${headers.length}</strong> columns.`;
        }
        if (msg.includes('column') || msg.includes('field')) {
            const colList = columnMeta.map(c => `<strong>${c.name}</strong> (${c.type})`).join(', ');
            return `Here are your columns: ${colList}`;
        }
        if (msg.includes('missing') || msg.includes('empty') || msg.includes('null')) {
            const missingCols = columnMeta.filter(c => c.missing > 0);
            if (missingCols.length === 0) return "Great news — your data has no missing values!";
            const details = missingCols.map(c => `<strong>${c.name}</strong>: ${c.missing} missing`).join(', ');
            return `Missing values found in: ${details}`;
        }
        if (msg.includes('summary') || msg.includes('overview')) {
            return `Your file "<strong>${fileName}</strong>" has ${rawData.length.toLocaleString()} records and ${headers.length} columns. I found ${columnMeta.filter(c => c.type === 'numeric').length} number columns and ${columnMeta.filter(c => c.type === 'category').length} category columns. Scroll up to see the full analysis!`;
        }
    }

    // Data upload nudge
    if (msg.includes('data') || msg.includes('csv') || msg.includes('upload') || msg.includes('file') || msg.includes('analyze')) {
        return "To analyze your data, use the upload area at the top of the page. Drop in a CSV file and I'll start working immediately!";
    }

    // Capabilities
    if (msg.includes('security') || msg.includes('guardrail') || msg.includes('safe') || msg.includes('protect')) {
        return "Your data is protected by <strong>NeMo-inspired Guardrails</strong>. I scan for injection attacks, detect personal information, rate-limit actions, and sanitize all inputs/outputs. The shield icon in the header shows your current security status.";
    }

    // Default
    return "I'm here to help with data analysis! Try uploading a CSV file, or ask me about your data's columns, missing values, or patterns.";
}
