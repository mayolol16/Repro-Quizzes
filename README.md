# IMC534 Reproductive & Endocrine USMLE Step 1 QBank

An interactive board-style question bank web application designed for the University at Buffalo Jacobs School of Medicine IMC534 reproductive curriculum, featuring **1,426 clinical vignettes** across Weeks 1–3, the Repro Notebooks, and Pharmacology modules aligned with **First Aid 2025**.

## 🚀 How to Load the App

### Option 1: Direct Browser Open (Fastest, No Terminal Needed)
You can open `index.html` directly in your browser without needing to run any server:
```bash
open "/Users/markyoussef_1/Desktop/Med School/M2/Fall/IMC534 Endo Repo/qbank_app/index.html"
```
Or simply double-click **`index.html`** in Finder!

### Option 2: Using the One-Click Launch Script
In your terminal, run:
```bash
"/Users/markyoussef_1/Desktop/Med School/M2/Fall/IMC534 Endo Repo/qbank_app/start.sh"
```
This automatically starts a local web server at `http://localhost:8080` and opens it in your default browser.

### Option 3: Standard Python Web Server
```bash
cd "/Users/markyoussef_1/Desktop/Med School/M2/Fall/IMC534 Endo Repo/qbank_app"
python3 -m http.server 8080
```
Then visit: **`http://localhost:8080`** in Chrome, Safari, or Arc.

---

## 🌟 Comprehensive 1,426-Question Repository Breakdown

1. **Lecture-by-Lecture Board Questions (870 Qs)**:
   - **Week 1 (330 Qs)**: Pelvic Anatomy, Histology, Puberty, HPO Axis, Uterine & LGTD Pathology, and CBIL Case 4.
   - **Week 2 (180 Qs)**: Breast Disorders, STIs, Ovarian Neoplasms, GTD, and CBIL Case 5.
   - **Week 3 (360 Qs)**: Obstetrics, Maternal Physiology, Teratogens, Male Repro Histology, Infertility, HPT Axis, Sexual Dysfunction, Testicular & Prostate Pathology, and Antepartum Bleeding.
2. **Repro Notebook Clinical Question Sets (497 Qs)**:
   - **Repro Notebook Weeks 4–5 (278 Qs)**: Complete Sets 1 through 14 covering all core reproductive block foundations.
   - **Repro Notebook Week 6 (219 Qs)**: Complete Sets 1 through 10 covering advanced obstetrics, maternal-fetal adaptations, and male genitourinary disorders.
3. **Pharmacology Module (59 Qs)**:
   - **Dr. Bradford Workshop 2**: Puberty, Breast & Ovarian Cancer Therapies, Genital Infections, and Menopause.
   - **Dr. Bradford Review Session 3**: Teratogenic Exposures, Pregnancy Therapeutics, and Infertility Agents.
   - **Rapid-Fire & NBME Drills**: Functional Hypothalamic Amenorrhea (FHA), Hyperprolactinemia, PCOS, and Primary Ovarian Insufficiency (POI).

---

## 🎯 High-Yield Features

- **Learning Objective & Weakness Analytics**: Diagnoses your accuracy on every concept; flags objectives with < 70% accuracy as high-risk.
- **One-Click Weakness Drills**: Generates a custom quiz pulling questions strictly from your diagnosed blind spots.
- **Tutor, Timed Exam, & Untimed Exam Modes**: Immediate feedback with First Aid pearls, or 75-second-per-question countdown simulation.
- **Interactive Board Features**:
  - 🖍️ **Clinical Text Highlighting**: Select any text in the clinical vignette to highlight in **Yellow**, **Green**, or **Pink**.
  - ⚡ **Auto-Highlighter Mode**: Click `🖍️ Highlight` on the toolbar (or press `H`) to automatically highlight any selected text as you read.
  - 🧹 **Clear & Remove**: Click any existing highlight to remove it individually, or click `🧹 Clear` to reset all highlights on the question.
  - ✂️ **Distractor Strikethrough**: Cross out options you eliminate (click or press `S`).
  - 🚩 **Question Bookmarking**: Flag challenging vignettes (click or press `F`).
  - ⌨️ **Board Shortcuts**: `H` for highlight, `S` for strikethrough, `F` for flag.
- **Persistent Local Progress**: Automatically tracks your question history and accuracy in `localStorage`.
