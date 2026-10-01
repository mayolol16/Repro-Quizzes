# IMC535 Neuroscience & Behavior USMLE Step 1 QBank

An interactive board-style question bank web application designed for the University at Buffalo Jacobs School of Medicine **IMC535 Neuroscience & Behavior** curriculum, covering **Exams 1–4** and aligned with **First Aid 2025/2026**.

## 🚀 How to Launch the App

### Option 1: Direct Browser Open (Fastest, Zero Dependencies)
Open `index.html` directly in your browser without running any server:
```bash
open "/Users/markyoussef_1/Desktop/Med School/M2/Fall/IMC535 Neuro/qbank/index.html"
```
Or simply double-click **`index.html`** in Finder!

### Option 2: Using the One-Click Launcher
In your terminal, run:
```bash
"/Users/markyoussef_1/Desktop/Med School/M2/Fall/IMC535 Neuro/qbank/start.sh"
```
This starts a local web server at `http://localhost:8081` and automatically opens your default browser.

### Option 3: Standard Python Web Server
```bash
cd "/Users/markyoussef_1/Desktop/Med School/M2/Fall/IMC535 Neuro/qbank"
python3 -m http.server 8081
```
Then visit **`http://localhost:8081`** in Chrome, Safari, or Arc.

---

## 🏛️ Curriculum & 4-Exam Architecture

The web application is structured around the 4 core exams of IMC535:

1. **Exam 1 (Weeks 1–3): Foundations & Neuroanatomy**
   - **Week 1**: CNS Gross Anatomy, Neuroembryology & Malformations, Lysosomal Storage Diseases (Sphingolipidoses), Action Potentials & Local Anesthetics, Synaptic Transmission, Glia & Histology, Ventricular System / CSF / Hydrocephalus, NMJ Disorders & Cholinomimetics.
   - **Week 2**: Radiologic Examination of the CNS, Spinal Cord Anatomy & Landmark Dermatomes, Somatosensory Pathways (Spinothalamic / Anterolateral, Dorsal Column-Medial Lemniscal).
   - **Week 3**: Motor Pathways, Cerebellar Circuits & Ataxias, Basal Ganglia, and Brainstem Integration.
2. **Exam 2 (Weeks 4–5): Sensory, Motor & Pathways**
3. **Exam 3 (Weeks 6–8): Brainstem, Cranial Nerves & Laboratory Practical**
4. **Exam 4 (Weeks 9–11): Psychiatry & NBME Customized Subject Exam**

---

## 🎯 Board-Style Features Included

- **Curricular Diagnostics**: Tracks 42+ institutional learning objectives for Exam 1, flagging concepts with < 70% accuracy as high-risk blindspots.
- **USMLE Testing Modes**:
  - **Tutor Mode**: Immediate answer revelation with detailed rationale, First Aid pearl, and linked learning objectives.
  - **Timed Exam**: 75-second countdown timer per question simulating board conditions.
  - **Untimed Exam**: Immediate practice with post-exam score report.
- **Interactive Tools**:
  - 🖍️ **3-Color Highlighter**: Highlight clinical stems in Yellow, Green, or Pink (`H`).
  - ✂️ **Distractor Strikethrough**: Eliminate incorrect options (`S` or right-click).
  - 🚩 **Question Bookmarking**: Flag items for review (`F`).
  - ⏱️ **Exam Timer & Pause**: Conceals questions while paused to preserve testing integrity.
  - 📐 **KaTeX Math Engine**: Renders neurobiochemical notation and formulas.
  - 💾 **Local Progress Persistence**: Saves question attempts, bookmarks, and theme in `localStorage`.
