# 📊 Data Dev AI
### *Your Intelligent Data Scientist Companion*

[![Security: Guardrails](https://img.shields.io/badge/Security-NeMo_Guardrails-orange.svg)](https://github.com/NVIDIA/NeMo-Guardrails)
[![Frontend: Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla_JS-yellow.svg)](https://javascript.info)
[![Theme: Sunset_Vibrant](https://img.shields.io/badge/Theme-Sunset_Vibrant-red.svg)](https://colorhunt.co/palette/fef3e2fab12ffa812fdd0303)

**Data Dev AI** is a powerful, full-stack data analysis platform designed to turn raw data into actionable insights instantly. Protected by robust, NeMo-inspired security guardrails, it provides a safe and intuitive environment for anyone to explore datasets without writing a single line of code.

---

## ✨ Key Features

- **🚀 Instant Analysis**: Drop a CSV file and get immediate insights, quality reports, and visualizations.
- **🛡️ Secure by Design**: Integrated client-side and server-side guardrails to prevent prompt injections, PII leakage, and off-topic requests.
- **📊 Interactive Visuals**: Dynamic charts powered by Chart.js that automatically adapt to your data's structure.
- **🧠 AI Chat Assistant**: Ask questions about your data in plain English and get intelligent, protected responses.
- **🎨 Sunset Aesthetic**: A vibrant, modern design system optimized for readability and user engagement.
- **🧹 Quality Scanner**: Automatically detects missing values, duplicates, and outliers.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (ES6+)
- **Libraries**: [PapaParse](https://www.papaparse.com/) (CSV), [Chart.js](https://www.chartjs.org/) (Data Viz)
- **Security**: NeMo Guardrails inspired prompt & content validation
- **Backend**: Python (FastAPI), Uvicorn

---

## 📂 Project Structure

```text
├── index.html          # Main application interface
├── js/                 # Logic and security engines
│   ├── app.js          # Core application logic
│   └── guardrails.js   # Client-side security engine
├── css/                # Styling and animations
│   └── style.css       # Design system & theme
├── backend/            # Python backend server
│   ├── server.py       # FastAPI application
│   ├── requirements.txt
│   └── config/         # NeMo Guardrails configuration
└── README.md
```

---

## 🚀 Getting Started

### 1. Frontend Setup
Just open `index.html` in any modern web browser! No installation required for the static interface.

### 2. Backend Setup (Optional for AI Chat)
To enable the AI Chat Assistant, you'll need to run the Python server:

1. Navigate to the backend folder: `cd backend`
2. Install dependencies: `pip install -r requirements.txt`
3. Set up your environment:
   - Create a `.env` file from `.env.example`
   - Add your `OPENAI_API_KEY`
4. Start the server: `python server.py`

---

## 🛡️ Security Highlights

Data Dev AI implements a multi-layer defense strategy:
1. **Input Rails**: Blocks prompt injections and malicious content before processing.
2. **PII Masking**: Automatically detects and redacts sensitive info (emails, SSNs, CCs).
3. **Output Rails**: Ensures the AI response stays within data science topics and remains professional.
4. **Rate Limiting**: Protects the backend from excessive requests.

---

## 👨‍💻 Created By
Developed with ❤️ for Data Scientists and Analysts everywhere.

*License: MIT*
